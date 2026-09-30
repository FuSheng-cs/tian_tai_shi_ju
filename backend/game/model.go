// Package game contains the deterministic v2 domain engine.
//
// It deliberately has no HTTP, LLM, storage, or UI dependency. A model may
// suggest a reply and signals, but it cannot construct or mutate State.
package game

import (
	"errors"
	"fmt"
	"strings"
	"time"
)

const (
	SchemaVersion       = 2
	InitialOpportunities = 10
	InitialHints         = 3
	AffectionPerTouch    = 5
	MaxPlayerRunes       = 400
	MaxReplyRunes        = 200
	MinTurnsForEnding    = 7
)

var (
	ErrInvalidState      = errors.New("game: invalid state")
	ErrInvalidCommand    = errors.New("game: invalid command")
	ErrRevisionConflict  = errors.New("game: revision conflict")
	ErrSessionEnded      = errors.New("game: session is already ended")
	ErrCommandRequired   = errors.New("game: command id is required")
	ErrTextRequired      = errors.New("game: player text is required")
	ErrOutOfOpportunities = errors.New("game: no opportunities remain")
)

type Phase string

const (
	PhasePlaying   Phase = "playing"
	PhaseEnded     Phase = "ended"
	PhaseAfterStory Phase = "after_story"
)

type EndingType string

const (
	EndingDeath        EndingType = "end_death"
	EndingDisappear    EndingType = "end_disappear"
	EndingAcquaintance EndingType = "end_acquaintance"
)

type AiState string

const (
	AiStateGuarded  AiState = "guarded"
	AiStateWatching AiState = "watching"
	AiStateWavering AiState = "wavering"
	AiStateTurnBack AiState = "turn_back"
	AiStateEdge     AiState = "edge"
)

type Emotion string

const (
	EmotionNormal    Emotion = "normal"
	EmotionSting     Emotion = "sting"
	EmotionSurprise  Emotion = "surprise"
	EmotionSoft      Emotion = "soft"
	EmotionCuriosity Emotion = "curiosity"
)

type Position string

const (
	PositionRooftopEdge      Position = "rooftop_edge"
	PositionRooftopInner     Position = "rooftop_inner"
	PositionLeftAlone        Position = "left_alone"
	PositionContactExchanged Position = "contact_exchanged"
)

type MessageRole string

const (
	RoleUser      MessageRole = "user"
	RoleAssistant MessageRole = "assistant"
)

type Message struct {
	Role    MessageRole `json:"role"`
	Content string      `json:"content"`
}

type Event struct {
	Revision uint64            `json:"revision"`
	Type     string            `json:"type"`
	Data     map[string]string `json:"data,omitempty"`
	At       time.Time         `json:"at"`
}

// State is the only mutable aggregate owned by the domain. Processed commands
// are included so a storage adapter can make retries idempotent.
type State struct {
	SchemaVersion    int                    `json:"schema_version"`
	SessionID        string                 `json:"session_id"`
	Revision         uint64                 `json:"revision"`
	Phase            Phase                  `json:"phase"`
	Opportunities    int                    `json:"opportunities"`
	HintsRemaining   int                    `json:"hints_remaining"`
	Touches          int                    `json:"touches"`
	Affection        int                    `json:"affection"`
	AiState          AiState                `json:"ai_state"`
	Emotion          Emotion                `json:"emotion"`
	Position         Position               `json:"position"`
	Messages         []Message              `json:"messages"`
	Events           []Event                `json:"events"`
	Ending           *EndingType            `json:"ending"`
	ProcessedCommand map[string]CommandReceipt `json:"processed_commands,omitempty"`
}

type CommandReceipt struct {
	CommandID string     `json:"command_id"`
	Result    TurnResult `json:"result"`
}

type PublicState struct {
	SchemaVersion  int          `json:"schema_version"`
	SessionID      string       `json:"session_id"`
	Revision       uint64       `json:"revision"`
	Phase          Phase        `json:"phase"`
	Opportunities  int          `json:"opportunities"`
	HintsRemaining int          `json:"hints_remaining"`
	Touches        int          `json:"touches"`
	Affection      int          `json:"affection"`
	AiState        AiState      `json:"ai_state"`
	Emotion        Emotion      `json:"emotion"`
	Position       Position     `json:"position"`
	Messages       []Message    `json:"messages"`
	Ending         *EndingType  `json:"ending"`
}

// SubmitTurn is a command, not a state patch. The client supplies only its
// identity, optimistic-concurrency revision, and the new line of dialogue.
type SubmitTurn struct {
	CommandID        string `json:"command_id"`
	SessionID        string `json:"session_id"`
	ExpectedRevision uint64 `json:"expected_revision"`
	Text             string `json:"text"`
}

// TurnAssessment is an untrusted narrative suggestion produced by the
// orchestration layer. The engine clamps and gates every field before it can
// affect State. In particular, it contains signals rather than an ending.
type TurnAssessment struct {
	Reply                  string   `json:"reply"`
	Emotion                Emotion  `json:"emotion"`
	AiState                AiState  `json:"ai_state"`
	TouchSignal            bool     `json:"touch_signal"`
	PressureDelta          int      `json:"pressure_delta"`
	RecoverySignal         bool     `json:"recovery_signal"`
	ContactExchangeSignal  bool     `json:"contact_exchange_signal"`
	FatalSignal            bool     `json:"fatal_signal"`
	Confidence             float64  `json:"confidence"`
}

type TurnResult struct {
	CommandID string      `json:"command_id"`
	Revision  uint64      `json:"revision"`
	Replay    bool        `json:"replay"`
	Reply     string      `json:"reply"`
	Ending    *EndingType `json:"ending"`
	Events    []Event     `json:"events"`
	State     PublicState `json:"state"`
}

func NewState(sessionID string, now time.Time) (State, error) {
	if strings.TrimSpace(sessionID) == "" {
		return State{}, fmt.Errorf("%w: session id is empty", ErrInvalidState)
	}
	state := State{
		SchemaVersion:    SchemaVersion,
		SessionID:        sessionID,
		Phase:            PhasePlaying,
		Opportunities:    InitialOpportunities,
		HintsRemaining:   InitialHints,
		AiState:          AiStateGuarded,
		Emotion:          EmotionNormal,
		Position:         PositionRooftopEdge,
		Messages:         make([]Message, 0, InitialOpportunities*2+1),
		Events:           make([]Event, 0, InitialOpportunities*3),
		ProcessedCommand: make(map[string]CommandReceipt),
	}
	state.Events = append(state.Events, Event{Revision: 0, Type: "session.created", At: now.UTC()})
	return state, nil
}

func (s State) Public() PublicState {
	return PublicState{
		SchemaVersion:  s.SchemaVersion,
		SessionID:      s.SessionID,
		Revision:       s.Revision,
		Phase:          s.Phase,
		Opportunities:  s.Opportunities,
		HintsRemaining: s.HintsRemaining,
		Touches:        s.Touches,
		Affection:      s.Affection,
		AiState:        s.AiState,
		Emotion:        s.Emotion,
		Position:       s.Position,
		Messages:       append([]Message(nil), s.Messages...),
		Ending:         cloneEnding(s.Ending),
	}
}

func cloneEnding(ending *EndingType) *EndingType {
	if ending == nil {
		return nil
	}
	copy := *ending
	return &copy
}

func (s State) Validate() error {
	if s.SchemaVersion != SchemaVersion || strings.TrimSpace(s.SessionID) == "" {
		return fmt.Errorf("%w: schema or session id", ErrInvalidState)
	}
	if s.Phase != PhasePlaying && s.Phase != PhaseEnded && s.Phase != PhaseAfterStory {
		return fmt.Errorf("%w: unknown phase %q", ErrInvalidState, s.Phase)
	}
	if s.Opportunities < 0 || s.Opportunities > InitialOpportunities {
		return fmt.Errorf("%w: opportunities=%d", ErrInvalidState, s.Opportunities)
	}
	if s.HintsRemaining < 0 || s.HintsRemaining > InitialHints || s.Touches < 0 || s.Affection < 0 {
		return fmt.Errorf("%w: resource below/above bounds", ErrInvalidState)
	}
	if s.Affection != s.Touches*AffectionPerTouch {
		return fmt.Errorf("%w: affection does not derive from touches", ErrInvalidState)
	}
	if !validAiState(s.AiState) || !validEmotion(s.Emotion) || !validPosition(s.Position) {
		return fmt.Errorf("%w: invalid presentation state", ErrInvalidState)
	}
	if s.Phase == PhaseEnded && s.Ending == nil {
		return fmt.Errorf("%w: ended session has no ending", ErrInvalidState)
	}
	if s.Phase == PhasePlaying && s.Ending != nil {
		return fmt.Errorf("%w: playing session already has ending", ErrInvalidState)
	}
	for _, message := range s.Messages {
		if (message.Role != RoleUser && message.Role != RoleAssistant) || strings.TrimSpace(message.Content) == "" {
			return fmt.Errorf("%w: invalid transcript message", ErrInvalidState)
		}
	}
	return nil
}

func validPosition(value Position) bool {
	switch value {
	case PositionRooftopEdge, PositionRooftopInner, PositionLeftAlone, PositionContactExchanged:
		return true
	default:
		return false
	}
}

func validAiState(value AiState) bool {
	switch value {
	case AiStateGuarded, AiStateWatching, AiStateWavering, AiStateTurnBack, AiStateEdge:
		return true
	default:
		return false
	}
}

func validEmotion(value Emotion) bool {
	switch value {
	case EmotionNormal, EmotionSting, EmotionSurprise, EmotionSoft, EmotionCuriosity:
		return true
	default:
		return false
	}
}
