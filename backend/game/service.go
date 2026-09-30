package game

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"
)

// Narrator is the only boundary where a model, a rules prompt, or a scripted
// demo can enter the domain. It receives a read-only snapshot and can only
// propose a TurnAssessment; ApplyTurn remains the authority for state.
type Narrator interface {
	Assess(context.Context, State, SubmitTurn) (TurnAssessment, error)
}

type NarratorFunc func(context.Context, State, SubmitTurn) (TurnAssessment, error)

func (f NarratorFunc) Assess(ctx context.Context, state State, command SubmitTurn) (TurnAssessment, error) {
	return f(ctx, state, command)
}

// FallbackNarrator makes an unavailable model a visible, safe degraded mode.
// It never invents a touch, recovery, contact exchange, or fatal event.
type FallbackNarrator struct{}

func (FallbackNarrator) Assess(_ context.Context, state State, _ SubmitTurn) (TurnAssessment, error) {
	aiState := state.AiState
	if state.Opportunities <= 1 {
		aiState = AiStateEdge
	}
	return TurnAssessment{
		Reply:    fallbackReply,
		Emotion:  EmotionNormal,
		AiState:  aiState,
		PressureDelta: 0,
	}, nil
}

type sessionEntry struct {
	mu      sync.Mutex
	state   State
	pending string
}

// SessionService is an intentionally small application layer around the pure
// engine. The first vertical slice uses process memory; its interface and
// immutable event stream are designed so a durable repository can be swapped
// in without moving authority back into the browser.
type SessionService struct {
	mu       sync.RWMutex
	sessions map[string]*sessionEntry
	narrator Narrator
	now      func() time.Time
}

func NewSessionService(narrator Narrator, now func() time.Time) *SessionService {
	if narrator == nil {
		narrator = FallbackNarrator{}
	}
	if now == nil {
		now = time.Now
	}
	return &SessionService{
		sessions: make(map[string]*sessionEntry),
		narrator: narrator,
		now:      now,
	}
}

func (s *SessionService) Create(ctx context.Context, sessionID string) (PublicState, error) {
	if err := ctx.Err(); err != nil {
		return PublicState{}, err
	}
	sessionID = strings.TrimSpace(sessionID)
	if sessionID == "" {
		return PublicState{}, fmt.Errorf("%w: session id is empty", ErrInvalidCommand)
	}
	state, err := NewState(sessionID, s.now())
	if err != nil {
		return PublicState{}, err
	}
	entry := &sessionEntry{state: state}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.sessions[sessionID]; exists {
		return PublicState{}, ErrSessionExists
	}
	s.sessions[sessionID] = entry
	return state.Public(), nil
}

func (s *SessionService) entry(sessionID string) (*sessionEntry, error) {
	s.mu.RLock()
	entry := s.sessions[sessionID]
	s.mu.RUnlock()
	if entry == nil {
		return nil, ErrSessionNotFound
	}
	return entry, nil
}

func (s *SessionService) Get(ctx context.Context, sessionID string) (PublicState, error) {
	if err := ctx.Err(); err != nil {
		return PublicState{}, err
	}
	entry, err := s.entry(strings.TrimSpace(sessionID))
	if err != nil {
		return PublicState{}, err
	}
	entry.mu.Lock()
	defer entry.mu.Unlock()
	return entry.state.Public(), nil
}

// Submit reserves one command before calling the narrator. A retry with the
// same command id receives the stored receipt; a different command cannot race
// the in-flight assessment and silently fork the transcript.
func (s *SessionService) Submit(ctx context.Context, command SubmitTurn) (TurnResult, error) {
	if err := ctx.Err(); err != nil {
		return TurnResult{}, err
	}
	entry, err := s.entry(strings.TrimSpace(command.SessionID))
	if err != nil {
		return TurnResult{}, err
	}

	entry.mu.Lock()
	if receipt, ok := entry.state.ProcessedCommand[command.CommandID]; ok {
		if receipt.ExpectedRevision != command.ExpectedRevision || receipt.Text != strings.TrimSpace(command.Text) {
			entry.mu.Unlock()
			return TurnResult{}, ErrCommandConflict
		}
		result := cloneTurnResult(receipt.Result)
		result.Replay = true
		entry.mu.Unlock()
		return result, nil
	}
	if entry.pending != "" {
		entry.mu.Unlock()
		return TurnResult{}, ErrCommandInProgress
	}
	if _, err := validateCommand(&entry.state, command); err != nil {
		entry.mu.Unlock()
		return TurnResult{}, err
	}
	entry.pending = command.CommandID
	snapshot := cloneState(entry.state)
	entry.mu.Unlock()

	assessment, narrativeErr := s.narrator.Assess(ctx, snapshot, command)
	if err := ctx.Err(); err != nil {
		s.clearPending(entry, command.CommandID)
		return TurnResult{}, err
	}
	degraded := narrativeErr != nil
	if degraded {
		assessment, _ = (FallbackNarrator{}).Assess(ctx, snapshot, command)
	}

	entry.mu.Lock()
	defer entry.mu.Unlock()
	if entry.pending != command.CommandID {
		return TurnResult{}, ErrCommandInProgress
	}
	defer func() { entry.pending = "" }()
	result, err := ApplyTurn(&entry.state, command, assessment, s.now())
	if err != nil {
		return TurnResult{}, err
	}
	if degraded {
		degradedEvent := Event{
			Revision: entry.state.Revision,
			Type:     "narrative.degraded",
			Data:     map[string]string{"fallback": "true"},
			At:       s.now().UTC(),
		}
		entry.state.Events = append(entry.state.Events, degradedEvent)
		result.Events = append(result.Events, degradedEvent)
		result.State = entry.state.Public()
		entry.state.ProcessedCommand[command.CommandID] = CommandReceipt{
			CommandID:        command.CommandID,
			ExpectedRevision: command.ExpectedRevision,
			Text:             strings.TrimSpace(command.Text),
			Result:           cloneTurnResult(result),
		}
	}
	return cloneTurnResult(result), nil
}

func (s *SessionService) clearPending(entry *sessionEntry, commandID string) {
	entry.mu.Lock()
	if entry.pending == commandID {
		entry.pending = ""
	}
	entry.mu.Unlock()
}

// Events returns a copy for audit/export tooling. The HTTP projection does not
// expose internal receipts or timestamps unless the caller asks for events.
func (s *SessionService) Events(ctx context.Context, sessionID string) ([]Event, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	entry, err := s.entry(strings.TrimSpace(sessionID))
	if err != nil {
		return nil, err
	}
	entry.mu.Lock()
	defer entry.mu.Unlock()
	return cloneEvents(entry.state.Events), nil
}
