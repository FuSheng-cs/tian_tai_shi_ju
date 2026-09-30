package game

import (
	"errors"
	"testing"
	"time"
)

func newTestState(t *testing.T) State {
	t.Helper()
	state, err := NewState("session-123", time.Unix(0, 0))
	if err != nil {
		t.Fatalf("NewState: %v", err)
	}
	return state
}

func apply(t *testing.T, state *State, id string, assessment TurnAssessment) TurnResult {
	t.Helper()
	result, err := ApplyTurn(state, SubmitTurn{
		CommandID:        id,
		SessionID:        state.SessionID,
		ExpectedRevision: state.Revision,
		Text:             "我听见了。",
	}, assessment, time.Unix(int64(state.Revision+1), 0))
	if err != nil {
		t.Fatalf("ApplyTurn(%s): %v", id, err)
	}
	return result
}

func TestApplyTurnKeepsStateAuthoritativeAndClampsAdvice(t *testing.T) {
	state := newTestState(t)
	result := apply(t, &state, "cmd-1", TurnAssessment{
		Reply:         "她看了你一眼。",
		Emotion:       Emotion("made-up"),
		AiState:       AiState("made-up"),
		TouchSignal:   true,
		PressureDelta: 99,
	})

	if result.State.Opportunities != 7 {
		t.Fatalf("expected base cost plus clamped pressure, got %d", result.State.Opportunities)
	}
	if result.State.Touches != 0 || result.State.Affection != 0 {
		t.Fatal("harmful turn must not also receive a touch refund")
	}
	if result.State.Emotion != EmotionNormal {
		t.Fatalf("invalid emotion should normalize to normal, got %q", result.State.Emotion)
	}
	if result.State.AiState != AiStateGuarded {
		t.Fatalf("invalid ai state should derive a safe state, got %q", result.State.AiState)
	}
	if err := state.Validate(); err != nil {
		t.Fatalf("state invariant failed: %v", err)
	}
}

func TestEndingNeedsNarrativeEvidence(t *testing.T) {
	state := newTestState(t)
	for i := 1; i <= 5; i++ {
		result := apply(t, &state, "touch-"+string(rune('0'+i)), TurnAssessment{
			Reply:       "她没有移开视线。",
			TouchSignal: true,
			AiState:     AiStateWavering,
		})
		if result.Ending != nil {
			t.Fatalf("numeric threshold alone must not end the story on turn %d", i)
		}
	}
	for i := 6; i <= 7; i++ {
		result := apply(t, &state, "plain-"+string(rune('0'+i)), TurnAssessment{
			Reply:   "她沉默了一会儿。",
			AiState: AiStateWavering,
		})
		if result.Ending != nil {
			t.Fatalf("without recovery evidence turn %d should continue", i)
		}
	}

	// This is a separate fresh run because the previous seven turns deliberately
	// did not end the session and the contact signal must be tied to the turn.
	state = newTestState(t)
	for i := 1; i <= 6; i++ {
		assessment := TurnAssessment{Reply: "她仍在听。", TouchSignal: i <= 5, AiState: AiStateWavering}
		apply(t, &state, "prep-"+string(rune('0'+i)), assessment)
	}
	result := apply(t, &state, "contact-7", TurnAssessment{
		Reply:                 "她把手机递了过来。",
		AiState:               AiStateTurnBack,
		RecoverySignal:        true,
		ContactExchangeSignal: true,
	})
	if result.Ending == nil || *result.Ending != EndingAcquaintance {
		t.Fatalf("expected evidence-backed acquaintance ending, got %#v", result.Ending)
	}
}

func TestCommandIsIdempotent(t *testing.T) {
	state := newTestState(t)
	command := SubmitTurn{CommandID: "retryable", SessionID: state.SessionID, ExpectedRevision: 0, Text: "你好。"}
	first, err := ApplyTurn(&state, command, TurnAssessment{Reply: "嗯。"}, time.Unix(1, 0))
	if err != nil {
		t.Fatal(err)
	}
	revision := state.Revision
	messageCount := len(state.Messages)
	second, err := ApplyTurn(&state, command, TurnAssessment{Reply: "不应重复。", TouchSignal: true}, time.Unix(2, 0))
	if err != nil {
		t.Fatal(err)
	}
	if !second.Replay || second.Reply != first.Reply || state.Revision != revision || len(state.Messages) != messageCount {
		t.Fatalf("retry changed state: first=%#v second=%#v state=%#v", first, second, state)
	}
}

func TestExhaustionResolvesToDeathOnlyAfterNoSuccess(t *testing.T) {
	state := newTestState(t)
	var last TurnResult
	for i := 0; i < InitialOpportunities; i++ {
		last = apply(t, &state, "turn-"+string(rune('a'+i)), TurnAssessment{Reply: "她没有回答。"})
	}
	if last.Ending == nil || *last.Ending != EndingDeath {
		t.Fatalf("expected exhausted run to resolve to death, got %#v", last.Ending)
	}
	if state.Phase != PhaseEnded {
		t.Fatalf("expected ended phase, got %q", state.Phase)
	}
	_, err := ApplyTurn(&state, SubmitTurn{CommandID: "after", SessionID: state.SessionID, ExpectedRevision: state.Revision, Text: "再说一句"}, TurnAssessment{Reply: ""}, time.Now())
	if !errors.Is(err, ErrSessionEnded) {
		t.Fatalf("expected ended-session error, got %v", err)
	}
}

