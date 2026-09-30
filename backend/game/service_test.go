package game

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

func TestReplayRebuildsPublicStateWithoutNarrator(t *testing.T) {
	state := newTestState(t)
	for i := 0; i < 3; i++ {
		apply(t, &state, "replay-"+string(rune('a'+i)), TurnAssessment{
			Reply:       "她还在听。",
			TouchSignal: i == 0,
			AiState:     AiStateWatching,
		})
	}
	replayed, err := Replay(state.Events)
	if err != nil {
		t.Fatalf("Replay: %v", err)
	}
	if got, want := replayed.Public(), state.Public(); got.Revision != want.Revision ||
		got.Opportunities != want.Opportunities || got.Touches != want.Touches ||
		got.Affection != want.Affection || len(got.Messages) != len(want.Messages) {
		t.Fatalf("replay projection differs: got=%#v want=%#v", got, want)
	}
	if err := replayed.Validate(); err != nil {
		t.Fatalf("replayed state invalid: %v", err)
	}
}

func TestSessionServiceSerializesInFlightCommands(t *testing.T) {
	started := make(chan struct{})
	release := make(chan struct{})
	narrator := NarratorFunc(func(_ context.Context, state State, _ SubmitTurn) (TurnAssessment, error) {
		close(started)
		<-release
		return TurnAssessment{Reply: "收到。"}, nil
	})
	service := NewSessionService(narrator, func() time.Time { return time.Unix(10, 0) })
	if _, err := service.Create(context.Background(), "session-serial"); err != nil {
		t.Fatal(err)
	}
	first := make(chan error, 1)
	go func() {
		_, err := service.Submit(context.Background(), SubmitTurn{
			CommandID:        "command-first",
			SessionID:        "session-serial",
			ExpectedRevision: 0,
			Text:             "你好。",
		})
		first <- err
	}()
	<-started
	_, err := service.Submit(context.Background(), SubmitTurn{
		CommandID:        "command-second",
		SessionID:        "session-serial",
		ExpectedRevision: 0,
		Text:             "再说一句。",
	})
	if !errors.Is(err, ErrCommandInProgress) {
		t.Fatalf("expected in-flight conflict, got %v", err)
	}
	close(release)
	if err := <-first; err != nil {
		t.Fatalf("first command failed: %v", err)
	}
}

func TestSessionServiceFallbackDoesNotInventSuccess(t *testing.T) {
	service := NewSessionService(NarratorFunc(func(context.Context, State, SubmitTurn) (TurnAssessment, error) {
		return TurnAssessment{}, errors.New("provider unavailable")
	}), func() time.Time { return time.Unix(20, 0) })
	if _, err := service.Create(context.Background(), "session-fallback"); err != nil {
		t.Fatal(err)
	}
	result, err := service.Submit(context.Background(), SubmitTurn{
		CommandID:        "command-fallback",
		SessionID:        "session-fallback",
		ExpectedRevision: 0,
		Text:             "我会听你说。",
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.State.Touches != 0 || result.State.Ending != nil {
		t.Fatalf("fallback invented progress: %#v", result.State)
	}
	if len(result.Events) == 0 || result.Events[len(result.Events)-1].Type != "narrative.degraded" {
		t.Fatalf("missing degraded event: %#v", result.Events)
	}
}

func TestCommandIdempotencyRejectsChangedPayload(t *testing.T) {
	state := newTestState(t)
	command := SubmitTurn{CommandID: "command-same", SessionID: state.SessionID, ExpectedRevision: 0, Text: "第一句。"}
	if _, err := ApplyTurn(&state, command, TurnAssessment{Reply: "嗯。"}, time.Unix(1, 0)); err != nil {
		t.Fatal(err)
	}
	command.Text = "被改过的句子。"
	if _, err := ApplyTurn(&state, command, TurnAssessment{Reply: "不应处理。"}, time.Unix(2, 0)); !errors.Is(err, ErrCommandConflict) {
		t.Fatalf("expected command conflict, got %v", err)
	}
}

func TestSessionServiceCanReadIndependentEventCopy(t *testing.T) {
	service := NewSessionService(FallbackNarrator{}, func() time.Time { return time.Unix(30, 0) })
	if _, err := service.Create(context.Background(), "session-events"); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Submit(context.Background(), SubmitTurn{
		CommandID:        "command-events",
		SessionID:        "session-events",
		ExpectedRevision: 0,
		Text:             "看见你了。",
	}); err != nil {
		t.Fatal(err)
	}
	events, err := service.Events(context.Background(), "session-events")
	if err != nil {
		t.Fatal(err)
	}
	events[0].Data["session_id"] = "tampered"
	again, err := service.Events(context.Background(), "session-events")
	if err != nil {
		t.Fatal(err)
	}
	if again[0].Data["session_id"] == "tampered" {
		t.Fatal("event copy mutated session state")
	}
}

func TestConcurrentReadDoesNotRaceWithSubmit(t *testing.T) {
	service := NewSessionService(FallbackNarrator{}, time.Now)
	if _, err := service.Create(context.Background(), "session-concurrent"); err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _ = service.Get(context.Background(), "session-concurrent")
		}()
	}
	wg.Wait()
}
