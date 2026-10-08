package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

type Narrator interface {
	Generate(context.Context, Session, TurnCommand) (Narrative, error)
}

type Finalizer interface {
	Finalize(context.Context, Session, EndingCommand) (FinalNarrative, error)
}

type Game struct {
	store     *Store
	live      Narrator
	rehearsal Narrator
	now       func() time.Time
}

func NewGame(store *Store, live Narrator) *Game {
	return &Game{store: store, live: live, rehearsal: RehearsalNarrator{}, now: time.Now}
}

func phaseForTurn(turn int) string {
	switch {
	case turn < 3:
		return "arrival"
	case turn < 7:
		return "listening"
	case turn < 10:
		return "threshold"
	default:
		return "dawn"
	}
}

func (g *Game) Create(ctx context.Context, mode string) (Session, error) {
	if mode != "live" && mode != "rehearsal" {
		return Session{}, failure(400, "invalid_mode", "请选择真实对话或离线序章。", false)
	}
	if mode == "live" && g.live == nil {
		return Session{}, failure(503, "ai_unavailable", "真实对话暂未连接。你可以先进入离线序章。", true)
	}
	if err := ctx.Err(); err != nil {
		return Session{}, err
	}
	id, err := randomID()
	if err != nil {
		return Session{}, err
	}
	now := g.now().UTC()
	session := Session{
		ID: id, Mode: mode, Status: "active", Phase: "arrival",
		Messages: openingMessages(), Observations: []string{}, Memories: []Memory{},
		CreatedAt: now, UpdatedAt: now,
	}
	if err := g.store.Create(Record{SchemaVersion: 1, Session: session, Receipts: make(map[string]Receipt)}); err != nil {
		return Session{}, err
	}
	return session, nil
}

func (g *Game) Get(id string) (Session, error) {
	record, err := g.store.Read(id)
	return record.Session, err
}

func commandDigest(kind string, command any) string {
	data, _ := json.Marshal(command)
	hash := sha256.Sum256(append([]byte(kind+":"), data...))
	return hex.EncodeToString(hash[:])
}

func checkReceipt(record Record, requestID, digest string) (Session, bool, error) {
	receipt, found := record.Receipts[requestID]
	if !found {
		return Session{}, false, nil
	}
	if receipt.Digest != digest {
		return Session{}, false, failure(409, "request_conflict", "这句话的编号已被使用，请刷新后重试。", false)
	}
	return cloneSession(receipt.Session), true, nil
}

func (g *Game) Turn(ctx context.Context, id string, command TurnCommand) (Session, error) {
	command.Text = strings.TrimSpace(command.Text)
	if err := validateTurn(command); err != nil {
		return Session{}, err
	}
	unlock, err := g.store.acquire(id)
	if err != nil {
		return Session{}, err
	}
	defer unlock()
	record, err := g.store.Read(id)
	if err != nil {
		return Session{}, err
	}
	digest := commandDigest("turn", command)
	if session, found, err := checkReceipt(record, command.RequestID, digest); found || err != nil {
		return session, err
	}
	session := record.Session
	if command.ExpectedRevision != session.Revision {
		return Session{}, failure(409, "revision_conflict", "这一夜已有新的记录，请重新载入后继续。", true)
	}
	if session.Status == "ended" {
		return Session{}, failure(409, "night_complete", "这一夜已经收好，可以回看记录。", false)
	}
	if session.Status != "active" || session.Turn >= maxTurns {
		return Session{}, failure(409, "night_complete", "十句话已经说完，请为这一夜留一个去处。", false)
	}
	narrator := g.rehearsal
	if session.Mode == "live" {
		narrator = g.live
	}
	if narrator == nil {
		return Session{}, failure(503, "ai_unavailable", "对话连接暂时中断。这句话尚未消耗。", true)
	}
	narrative, err := narrator.Generate(ctx, cloneSession(session), command)
	if err != nil {
		return Session{}, failure(502, "narrative_unavailable", "风声暂时盖住了回应。这句话尚未消耗，请再试一次。", true)
	}
	if err := validateNarrative(narrative, command); err != nil {
		return Session{}, failure(502, "invalid_narrative", "这一句回应没有完整抵达。这句话尚未消耗，请重试。", true)
	}
	if err := ctx.Err(); err != nil {
		return Session{}, failure(408, "request_cancelled", "连接已暂停。这句话尚未消耗。", true)
	}
	session.Turn++
	session.Revision++
	session.Phase = phaseForTurn(session.Turn)
	session.UpdatedAt = g.now().UTC()
	if session.Turn == maxTurns {
		session.Status = "choosing"
	}
	session.Messages = append(session.Messages,
		Message{ID: fmt.Sprintf("%d-player", session.Turn), Role: "player", Text: command.Text, Intent: command.Intent},
		Message{ID: fmt.Sprintf("%d-narrator", session.Turn), Role: "narrator", Text: narrative.Narration},
		Message{ID: fmt.Sprintf("%d-character", session.Turn), Role: "character", Text: narrative.Reply},
	)
	if command.Observation != "" && !contains(session.Observations, command.Observation) {
		session.Observations = append(session.Observations, command.Observation)
	}
	if narrative.Memory != nil {
		session.Memories = append(session.Memories, Memory{
			ID: fmt.Sprintf("memory-%02d", session.Turn), Title: narrative.Memory.Title,
			Text: narrative.Memory.Text, SourceTurn: session.Turn,
		})
	}
	record.Session = session
	record.Receipts[command.RequestID] = Receipt{Digest: digest, Session: cloneSession(session)}
	if err := g.store.Write(record); err != nil {
		return Session{}, err
	}
	return session, nil
}

// Observe commits a visible fact without spending dialogue or consulting the
// model. It uses the same lock and durable receipt as every other mutation.
func (g *Game) Observe(ctx context.Context, id string, command ObservationCommand) (Session, error) {
	if err := validateRequestID(command.RequestID, command.ExpectedRevision); err != nil {
		return Session{}, err
	}
	if command.Observation == "" || !validObservation(command.Observation) {
		return Session{}, failure(400, "invalid_observation", "请留意天台上真实存在的事物。", false)
	}
	unlock, err := g.store.acquire(id)
	if err != nil {
		return Session{}, err
	}
	defer unlock()
	record, err := g.store.Read(id)
	if err != nil {
		return Session{}, err
	}
	digest := commandDigest("observation", command)
	if session, found, err := checkReceipt(record, command.RequestID, digest); found || err != nil {
		return session, err
	}
	session := record.Session
	if command.ExpectedRevision != session.Revision {
		return Session{}, failure(409, "revision_conflict", "这一夜已有新的记录，请重新载入后继续。", true)
	}
	if session.Status == "ended" {
		return Session{}, failure(409, "night_complete", "这一夜已收好，可以在记录里回看。", false)
	}
	if contains(session.Observations, command.Observation) {
		return Session{}, failure(409, "observation_known", "这处细节已经记下了。", false)
	}
	if err := ctx.Err(); err != nil {
		return Session{}, failure(408, "request_cancelled", "连接已暂停。这处细节尚未保存。", true)
	}
	session.Observations = append(session.Observations, command.Observation)
	session.Revision++
	session.UpdatedAt = g.now().UTC()
	record.Session = session
	record.Receipts[command.RequestID] = Receipt{Digest: digest, Session: cloneSession(session)}
	if err := g.store.Write(record); err != nil {
		return Session{}, err
	}
	return session, nil
}

func (g *Game) End(ctx context.Context, id string, command EndingCommand) (Session, error) {
	if err := validateRequestID(command.RequestID, command.ExpectedRevision); err != nil {
		return Session{}, err
	}
	if command.Choice != "leave" && command.Choice != "handoff" && command.Choice != "separate" && command.Choice != "correspondence" {
		return Session{}, failure(400, "invalid_choice", "请选择这一夜结束后的去处。", false)
	}
	unlock, err := g.store.acquire(id)
	if err != nil {
		return Session{}, err
	}
	defer unlock()
	record, err := g.store.Read(id)
	if err != nil {
		return Session{}, err
	}
	digest := commandDigest("ending", command)
	if session, found, err := checkReceipt(record, command.RequestID, digest); found || err != nil {
		return session, err
	}
	session := record.Session
	if session.Revision != command.ExpectedRevision {
		return Session{}, failure(409, "revision_conflict", "这一夜已有新的记录，请重新载入后继续。", true)
	}
	if session.Status == "ended" {
		return Session{}, failure(409, "ending_not_ready", "这一夜已经收好，可以回看记录。", false)
	}
	if command.Choice != "leave" && (session.Status != "choosing" || session.Turn != maxTurns) {
		return Session{}, failure(409, "ending_not_ready", "这类章末提议在第十次回应后可用；也可以现在收好这一夜。", false)
	}
	echo, err := selectedEcho(session, command.EchoMessageID)
	if err != nil {
		return Session{}, err
	}
	if err := ctx.Err(); err != nil {
		return Session{}, err
	}
	if command.Choice == "leave" {
		session.Ending = makeLeaveEnding(session)
	} else if session.Mode == "live" {
		finalizer, ok := g.live.(Finalizer)
		if !ok {
			return Session{}, failure(503, "ai_unavailable", "对话连接暂时中断。你的提议尚未提交，请稍后重试。", true)
		}
		narrative, err := finalizer.Finalize(ctx, cloneSession(session), command)
		if err != nil {
			return Session{}, failure(502, "narrative_unavailable", "这一夜的回应还没有完整抵达。你的提议尚未提交，请重试。", true)
		}
		if err := validateFinalNarrative(narrative); err != nil {
			return Session{}, failure(502, "invalid_narrative", "告别的回应没有完整抵达。你的提议尚未提交，请重试。", true)
		}
		if err := ctx.Err(); err != nil {
			return Session{}, failure(408, "request_cancelled", "连接已暂停。你的提议尚未提交。", true)
		}
		session.Ending = makeLiveEnding(session, command.Choice, narrative)
	} else {
		session.Ending = makeEnding(session, command.Choice)
	}
	session.Ending.Echo = echo
	session.Status = "ended"
	session.Revision++
	session.UpdatedAt = g.now().UTC()
	record.Session = session
	record.Receipts[command.RequestID] = Receipt{Digest: digest, Session: cloneSession(session)}
	if err := g.store.Write(record); err != nil {
		return Session{}, err
	}
	return session, nil
}

func selectedEcho(session Session, messageID *string) (string, error) {
	if messageID == nil || *messageID == "" {
		return "", nil
	}
	for _, message := range session.Messages {
		if message.ID == *messageID && message.Role == "player" && message.Intent != "silence" {
			return message.Text, nil
		}
	}
	return "", failure(400, "invalid_echo", "只能留下这一夜里你实际说过的一句话，也可以不留。", false)
}

func contains(values []string, value string) bool {
	for _, item := range values {
		if item == value {
			return true
		}
	}
	return false
}
