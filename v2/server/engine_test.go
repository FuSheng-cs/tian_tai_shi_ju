package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"sync/atomic"
	"testing"
)

type narratorFunc func(context.Context, Session, TurnCommand) (Narrative, error)

func (f narratorFunc) Generate(ctx context.Context, s Session, c TurnCommand) (Narrative, error) {
	return f(ctx, s, c)
}

func testGame(t *testing.T, narrator Narrator) *Game {
	t.Helper()
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	return NewGame(store, narrator)
}

func createSession(t *testing.T, game *Game, mode string) Session {
	t.Helper()
	session, err := game.Create(context.Background(), mode)
	if err != nil {
		t.Fatal(err)
	}
	return session
}

func assertCode(t *testing.T, err error, code string) {
	t.Helper()
	if err == nil || publicError(err).Code != code {
		t.Fatalf("want %s, got %v", code, err)
	}
}

func TestTurnIdempotencyAndDurableReload(t *testing.T) {
	game := testGame(t, nil)
	session := createSession(t, game, "rehearsal")
	command := TurnCommand{RequestID: "request-001", ExpectedRevision: 0, Text: "我把门留着。就站这里。", Observation: "door"}
	first, err := game.Turn(context.Background(), session.ID, command)
	if err != nil {
		t.Fatal(err)
	}
	if first.Turn != 1 || first.Revision != 1 || len(first.Memories) != 1 || !reflect.DeepEqual(first.Observations, []string{"door"}) {
		t.Fatalf("wrong committed state: %+v", first)
	}
	newStore, err := NewStore(game.store.dir)
	if err != nil {
		t.Fatal(err)
	}
	reloaded := NewGame(newStore, nil)
	again, err := reloaded.Turn(context.Background(), session.ID, command)
	if err != nil || !reflect.DeepEqual(first, again) {
		t.Fatalf("receipt changed after restart: %v", err)
	}
	_, err = reloaded.Turn(context.Background(), session.ID, TurnCommand{RequestID: "request-002", ExpectedRevision: 0, Text: "旧页面的话。"})
	assertCode(t, err, "revision_conflict")
	command.Text = "同一个编号，却是另一句话。"
	_, err = reloaded.Turn(context.Background(), session.ID, command)
	assertCode(t, err, "request_conflict")
	file, err := os.Stat(filepath.Join(game.store.dir, session.ID+".json"))
	if err != nil || file.Mode().Perm() != 0600 {
		t.Fatalf("private file mode missing: %v", err)
	}
	stored, err := reloaded.Get(session.ID)
	if err != nil || stored.Turn != 1 {
		t.Fatalf("retries mutated the session: %v", err)
	}
}

func TestNarrativeFailureNeverConsumesTurn(t *testing.T) {
	var called atomic.Int32
	game := testGame(t, narratorFunc(func(context.Context, Session, TurnCommand) (Narrative, error) {
		called.Add(1)
		return Narrative{}, errors.New("secret key and upstream internals must never escape")
	}))
	session := createSession(t, game, "live")
	command := TurnCommand{RequestID: "request-001", Text: "不着急。"}
	_, err := game.Turn(context.Background(), session.ID, command)
	assertCode(t, err, "narrative_unavailable")
	if strings.Contains(publicError(err).Message, "secret") {
		t.Fatal("leaked upstream error")
	}
	stored, _ := game.Get(session.ID)
	if !reflect.DeepEqual(stored, session) || called.Load() != 1 {
		t.Fatal("provider failure changed state")
	}
	game.live = RehearsalNarrator{}
	result, err := game.Turn(context.Background(), session.ID, command)
	if err != nil || result.Turn != 1 {
		t.Fatalf("same command must be retryable after failure: %v", err)
	}
}

func TestCancellationAndInvalidModelMemoryNeverCommit(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	game := testGame(t, narratorFunc(func(context.Context, Session, TurnCommand) (Narrative, error) {
		cancel()
		return Narrative{Reply: "先站那儿吧。", Narration: "她看了看门。"}, nil
	}))
	session := createSession(t, game, "live")
	command := TurnCommand{RequestID: "request-001", Text: "我在这里。"}
	_, err := game.Turn(ctx, session.ID, command)
	assertCode(t, err, "request_cancelled")
	game.live = narratorFunc(func(context.Context, Session, TurnCommand) (Narrative, error) {
		return Narrative{Reply: "先站那儿吧。", Narration: "她看了看门。", Memory: &NarrativeMemory{Title: "伪造的过去", Text: "她已经答应结婚。"}}, nil
	})
	_, err = game.Turn(context.Background(), session.ID, command)
	assertCode(t, err, "invalid_narrative")
	stored, _ := game.Get(session.ID)
	if !reflect.DeepEqual(stored, session) {
		t.Fatal("cancelled or malformed narrative committed")
	}
}

func TestConcurrentTurnIsRejectedWithoutSecondModelCall(t *testing.T) {
	entered := make(chan struct{})
	release := make(chan struct{})
	var calls atomic.Int32
	game := testGame(t, narratorFunc(func(context.Context, Session, TurnCommand) (Narrative, error) {
		calls.Add(1)
		close(entered)
		<-release
		return Narrative{Reply: "嗯，门开着。", Narration: "她看向暖光。"}, nil
	}))
	session := createSession(t, game, "live")
	command := TurnCommand{RequestID: "request-001", Text: "门开着。"}
	done := make(chan error, 1)
	go func() {
		_, err := game.Turn(context.Background(), session.ID, command)
		done <- err
	}()
	<-entered
	_, err := game.Turn(context.Background(), session.ID, command)
	assertCode(t, err, "turn_in_progress")
	// A reader can see the previous stable snapshot while the model runs.
	snapshot, err := game.Get(session.ID)
	if err != nil || snapshot.Turn != 0 {
		t.Fatal("read did not preserve stable snapshot")
	}
	close(release)
	if err := <-done; err != nil || calls.Load() != 1 {
		t.Fatalf("concurrent submit was not isolated: %v", err)
	}
}

func TestTenTurnEndingGateAndExactPlayerEcho(t *testing.T) {
	for _, choice := range []string{"handoff", "separate", "correspondence"} {
		t.Run(choice, func(t *testing.T) {
			game := testGame(t, nil)
			session := createSession(t, game, "rehearsal")
			_, err := game.End(context.Background(), session.ID, EndingCommand{RequestID: "ending-001", Choice: choice})
			assertCode(t, err, "ending_not_ready")
			for turn := 0; turn < maxTurns; turn++ {
				text := fmt.Sprintf("这是我真正在第%d句说的话。", turn+1)
				session, err = game.Turn(context.Background(), session.ID, TurnCommand{RequestID: fmt.Sprintf("request-%03d", turn), ExpectedRevision: turn, Text: text, Observation: "camera"})
				if err != nil {
					t.Fatal(err)
				}
				expectedPhases := []string{"arrival", "arrival", "listening", "listening", "listening", "listening", "threshold", "threshold", "threshold", "dawn"}
				if session.Phase != expectedPhases[turn] {
					t.Fatalf("turn %d phase: want %s, got %s", turn+1, expectedPhases[turn], session.Phase)
				}
			}
			if session.Turn != 10 || session.Status != "choosing" || session.Ending != nil || len(session.Observations) != 1 || session.Phase != "dawn" {
				t.Fatalf("invalid ten-turn boundary: %+v", session)
			}
			_, err = game.Turn(context.Background(), session.ID, TurnCommand{RequestID: "request-extra", ExpectedRevision: 10, Text: "不应该有第十一句。"})
			assertCode(t, err, "night_complete")
			command := EndingCommand{RequestID: "ending-001", ExpectedRevision: 10, Choice: choice}
			ended, err := game.End(context.Background(), session.ID, command)
			if err != nil || ended.Revision != 11 || ended.Ending.ID != choice || ended.Ending.Echo != "这是我真正在第6句说的话。" || ended.Status != "ended" {
				t.Fatalf("ending failed or fabricated echo: %v", err)
			}
			replay, err := game.End(context.Background(), session.ID, command)
			if err != nil || !reflect.DeepEqual(ended, replay) {
				t.Fatal("ending is not idempotent")
			}
			command.RequestID = "ending-002"
			command.ExpectedRevision = 11
			_, err = game.End(context.Background(), session.ID, command)
			assertCode(t, err, "ending_not_ready")
		})
	}
}

func TestNoLiveConfigurationAndUnicodeLimit(t *testing.T) {
	game := testGame(t, nil)
	_, err := game.Create(context.Background(), "live")
	assertCode(t, err, "ai_unavailable")
	session := createSession(t, game, "rehearsal")
	_, err = game.Turn(context.Background(), session.ID, TurnCommand{RequestID: "request-001", Text: strings.Repeat("雨", 121)})
	assertCode(t, err, "invalid_input")
	_, err = game.Turn(context.Background(), session.ID, TurnCommand{RequestID: "request-001", Text: strings.Repeat("雨", 120)})
	if err != nil {
		t.Fatal("120 Unicode characters should be accepted", err)
	}
}

type finalizingNarrator struct {
	Narrator
	finalize func(context.Context, Session, EndingCommand) (FinalNarrative, error)
}

func (n finalizingNarrator) Finalize(ctx context.Context, session Session, command EndingCommand) (FinalNarrative, error) {
	return n.finalize(ctx, session, command)
}

func TestLiveFinaleRespectsRefusalAndIsAtomic(t *testing.T) {
	var calls atomic.Int32
	fail := true
	actor := finalizingNarrator{
		Narrator: narratorFunc(func(context.Context, Session, TurnCommand) (Narrative, error) {
			return Narrative{Reply: "我不想说名字，也不想留联系方式。", Narration: "她把手留在外套口袋里。"}, nil
		}),
		finalize: func(_ context.Context, session Session, command EndingCommand) (FinalNarrative, error) {
			calls.Add(1)
			if session.Turn != 10 || command.Choice != "correspondence" || session.Messages[len(session.Messages)-1].Text != "我不想说名字，也不想留联系方式。" {
				t.Error("finalizer did not receive the actual transcript and offer")
			}
			if fail {
				return FinalNarrative{}, errors.New("provider private error")
			}
			return FinalNarrative{Reply: "我还是不想留联系方式。今晚说到这里就好。", Narration: "她站在原来的位置，轻轻摇头。"}, nil
		},
	}
	game := testGame(t, actor)
	session := createSession(t, game, "live")
	for turn := 0; turn < 10; turn++ {
		var err error
		session, err = game.Turn(context.Background(), session.ID, TurnCommand{RequestID: fmt.Sprintf("live-turn-%02d", turn), ExpectedRevision: turn, Text: "你可以不回答。"})
		if err != nil {
			t.Fatal(err)
		}
	}
	command := EndingCommand{RequestID: "live-ending-001", ExpectedRevision: 10, Choice: "correspondence"}
	_, err := game.End(context.Background(), session.ID, command)
	assertCode(t, err, "narrative_unavailable")
	afterFailure, err := game.Get(session.ID)
	if err != nil || !reflect.DeepEqual(session, afterFailure) || calls.Load() != 1 {
		t.Fatal("failed finale must not commit a revision or ending")
	}
	fail = false
	ended, err := game.End(context.Background(), session.ID, command)
	if err != nil || ended.Revision != 11 || ended.Ending.Echo != "你可以不回答。" || calls.Load() != 2 {
		t.Fatalf("finale retry failed: %v", err)
	}
	prose := strings.Join(ended.Ending.Paragraphs, "\n")
	if !strings.Contains(prose, "我还是不想留联系方式。今晚说到这里就好。") {
		t.Fatal("finale replaced the character's refusal")
	}
	for _, fabricated := range []string{"洗印店", "次日下午", "底片", "名字", "交换", "电话号码", "门口传来脚步"} {
		if strings.Contains(prose, fabricated) {
			t.Errorf("authored closing fabricated unspoken facts: %s", fabricated)
		}
	}
	replay, err := game.End(context.Background(), session.ID, command)
	if err != nil || !reflect.DeepEqual(replay, ended) || calls.Load() != 2 {
		t.Fatal("finale retry called the provider twice")
	}
}

func TestInvalidOrCancelledLiveFinaleDoesNotCommit(t *testing.T) {
	for _, variant := range []string{"invalid", "cancelled", "unavailable"} {
		t.Run(variant, func(t *testing.T) {
			game := testGame(t, RehearsalNarrator{})
			session := createSession(t, game, "live")
			for turn := 0; turn < 10; turn++ {
				var err error
				session, err = game.Turn(context.Background(), session.ID, TurnCommand{RequestID: fmt.Sprintf("live-turn-%02d", turn), ExpectedRevision: turn, Text: "我听见了。"})
				if err != nil {
					t.Fatal(err)
				}
			}
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			if variant != "unavailable" {
				game.live = finalizingNarrator{Narrator: RehearsalNarrator{}, finalize: func(context.Context, Session, EndingCommand) (FinalNarrative, error) {
					if variant == "cancelled" {
						cancel()
						return FinalNarrative{Reply: "我再想想。", Narration: "她看着门。"}, nil
					}
					return FinalNarrative{}, nil
				}}
			}
			_, err := game.End(ctx, session.ID, EndingCommand{RequestID: "live-ending-001", ExpectedRevision: 10, Choice: "handoff"})
			codes := map[string]string{"invalid": "invalid_narrative", "cancelled": "request_cancelled", "unavailable": "ai_unavailable"}
			assertCode(t, err, codes[variant])
			after, _ := game.Get(session.ID)
			if !reflect.DeepEqual(session, after) {
				t.Fatal("uncommitted finale changed stored state")
			}
		})
	}
}
