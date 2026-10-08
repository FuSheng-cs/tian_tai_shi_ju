package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"
)

const maxTurns = 10
const maxRevision = maxTurns + 1 + 4
const silenceText = "让这一刻安静一会儿。"

var sessionIDPattern = regexp.MustCompile(`^[a-f0-9]{64}$`)
var requestIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{8,96}$`)

type Message struct {
	ID     string `json:"id"`
	Role   string `json:"role"`
	Text   string `json:"text"`
	Intent string `json:"intent,omitempty"`
}

type Memory struct {
	ID         string `json:"id"`
	Title      string `json:"title"`
	Text       string `json:"text"`
	SourceTurn int    `json:"sourceTurn"`
}

type Ending struct {
	ID         string   `json:"id"`
	Title      string   `json:"title"`
	Subtitle   string   `json:"subtitle"`
	Paragraphs []string `json:"paragraphs"`
	Echo       string   `json:"echo"`
}

type Session struct {
	ID           string    `json:"id"`
	Revision     int       `json:"revision"`
	Mode         string    `json:"mode"`
	Turn         int       `json:"turn"`
	Status       string    `json:"status"`
	Phase        string    `json:"phase"`
	Messages     []Message `json:"messages"`
	Observations []string  `json:"observations"`
	Memories     []Memory  `json:"memories"`
	Ending       *Ending   `json:"ending"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type TurnCommand struct {
	RequestID        string `json:"requestId"`
	ExpectedRevision int    `json:"expectedRevision"`
	Text             string `json:"text"`
	Observation      string `json:"observation,omitempty"`
	Intent           string `json:"intent,omitempty"`
}

type ObservationCommand struct {
	RequestID        string `json:"requestId"`
	ExpectedRevision int    `json:"expectedRevision"`
	Observation      string `json:"observation"`
}

type EndingCommand struct {
	RequestID        string  `json:"requestId"`
	ExpectedRevision int     `json:"expectedRevision"`
	Choice           string  `json:"choice"`
	EchoMessageID    *string `json:"echoMessageId,omitempty"`
}

type Narrative struct {
	Reply     string           `json:"reply"`
	Narration string           `json:"narration"`
	Memory    *NarrativeMemory `json:"memory"`
}

type NarrativeMemory struct {
	Title string `json:"title"`
	Text  string `json:"text"`
}

type FinalNarrative struct {
	Reply     string `json:"reply"`
	Narration string `json:"narration"`
}

type Receipt struct {
	Digest  string  `json:"digest"`
	Session Session `json:"session"`
}

type Record struct {
	SchemaVersion int                `json:"schemaVersion"`
	Session       Session            `json:"session"`
	Receipts      map[string]Receipt `json:"receipts"`
}

type APIError struct {
	Status    int    `json:"-"`
	Code      string `json:"code"`
	Message   string `json:"message"`
	Retryable bool   `json:"retryable"`
}

func (e *APIError) Error() string { return e.Code }

func failure(status int, code, message string, retryable bool) error {
	return &APIError{Status: status, Code: code, Message: message, Retryable: retryable}
}

func publicError(err error) *APIError {
	var result *APIError
	if errors.As(err, &result) {
		return result
	}
	return &APIError{Status: 500, Code: "internal_error", Message: "这一页暂时没有保存成功。请稍后重试。", Retryable: true}
}

func validObservation(value string) bool {
	switch value {
	case "", "camera", "receipt", "door", "rain":
		return true
	default:
		return false
	}
}

func validateRequestID(id string, revision int) error {
	if !requestIDPattern.MatchString(id) || revision < 0 || revision > maxRevision {
		return failure(400, "invalid_command", "这句话的编号不完整，请刷新页面后重试。", false)
	}
	return nil
}

func validateTurn(command TurnCommand) error {
	if err := validateRequestID(command.RequestID, command.ExpectedRevision); err != nil {
		return err
	}
	text := strings.TrimSpace(command.Text)
	if !utf8.ValidString(text) || text == "" || utf8.RuneCountInString(text) > 120 || !validObservation(command.Observation) || (command.Intent != "" && command.Intent != "silence") || (command.Intent == "silence" && text != silenceText) {
		return failure(400, "invalid_input", "请写下 1 至 120 个字，并选择天台上真实存在的事物。", false)
	}
	return nil
}

func validateRecord(record Record, id string) error {
	s := record.Session
	if record.SchemaVersion != 1 || !sessionIDPattern.MatchString(s.ID) || s.ID != id || record.Receipts == nil {
		return fmt.Errorf("invalid session record")
	}
	if s.Mode != "live" && s.Mode != "rehearsal" {
		return fmt.Errorf("invalid session mode")
	}
	if s.Turn < 0 || s.Turn > maxTurns || s.Revision < s.Turn || s.Revision > maxRevision {
		return fmt.Errorf("invalid turn state")
	}
	if s.Status == "ended" {
		if s.Ending == nil || s.Revision < s.Turn+1 || s.Revision > s.Turn+1+len(s.Observations) {
			return fmt.Errorf("invalid ending state")
		}
		switch s.Ending.ID {
		case "leave": // Explicit early close adds one revision, never a spoken turn.
		case "handoff", "separate", "correspondence":
			if s.Turn != maxTurns {
				return fmt.Errorf("full ending requires ten turns")
			}
		default:
			return fmt.Errorf("invalid ending choice")
		}
	} else if s.Ending != nil || s.Revision > s.Turn+len(s.Observations) || (s.Status != "active" && s.Status != "choosing") || (s.Status == "choosing") != (s.Turn == maxTurns) {
		return fmt.Errorf("invalid active state")
	}
	if s.Phase != phaseForTurn(s.Turn) || s.Messages == nil || s.Observations == nil || s.Memories == nil || s.CreatedAt.IsZero() || s.UpdatedAt.Before(s.CreatedAt) {
		return fmt.Errorf("invalid session projection")
	}
	playerCount := 0
	for _, message := range s.Messages {
		if message.ID == "" || strings.TrimSpace(message.Text) == "" || (message.Role != "player" && message.Role != "character" && message.Role != "narrator") {
			return fmt.Errorf("invalid message")
		}
		if message.Intent != "" && (message.Intent != "silence" || message.Role != "player" || message.Text != silenceText) {
			return fmt.Errorf("invalid player action")
		}
		if message.Role == "player" {
			playerCount++
		}
	}
	if playerCount != s.Turn || len(s.Memories) > s.Turn || len(s.Observations) > 4 || len(record.Receipts) != s.Revision {
		return fmt.Errorf("invalid transcript")
	}
	seen := make(map[string]bool)
	for _, observation := range s.Observations {
		if observation == "" || !validObservation(observation) || seen[observation] {
			return fmt.Errorf("invalid observations")
		}
		seen[observation] = true
	}
	for _, memory := range s.Memories {
		if memory.SourceTurn < 1 || memory.SourceTurn > s.Turn || memory.ID == "" || memory.Title == "" || memory.Text == "" {
			return fmt.Errorf("invalid memory")
		}
	}
	return nil
}

func cloneSession(session Session) Session {
	// All fields are JSON values; this keeps receipt snapshots independent of
	// the mutable candidate without hand-maintaining nested slice copies.
	data, _ := json.Marshal(session)
	var result Session
	_ = json.Unmarshal(data, &result)
	return result
}
