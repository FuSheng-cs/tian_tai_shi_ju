package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"reflect"
	"strings"
	"sync/atomic"
	"testing"
)

func TestLeaveAtZeroTurnsOrAfterOnlyObservationsNeverCallsModel(t *testing.T) {
	for _, observations := range [][]string{nil, {"door", "camera", "receipt", "rain"}} {
		t.Run(fmt.Sprintf("observations-%d", len(observations)), func(t *testing.T) {
			var calls atomic.Int32
			actor := finalizingNarrator{
				Narrator: narratorFunc(func(context.Context, Session, TurnCommand) (Narrative, error) {
					calls.Add(1)
					return Narrative{}, errors.New("leave must not generate dialogue")
				}),
				finalize: func(context.Context, Session, EndingCommand) (FinalNarrative, error) {
					calls.Add(1)
					return FinalNarrative{}, errors.New("leave must not generate a finale")
				},
			}
			game := testGame(t, actor)
			session := createSession(t, game, "live")
			for _, observation := range observations {
				var err error
				session, err = game.Observe(context.Background(), session.ID, ObservationCommand{RequestID: "leave-observe-" + observation, ExpectedRevision: session.Revision, Observation: observation})
				if err != nil {
					t.Fatal(err)
				}
			}
			before := cloneSession(session)
			command := EndingCommand{RequestID: "leave-zero-001", ExpectedRevision: session.Revision, Choice: "leave"}
			ended, err := game.End(context.Background(), session.ID, command)
			if err != nil || ended.Status != "ended" || ended.Turn != 0 || ended.Phase != "arrival" || ended.Revision != len(observations)+1 || ended.Ending.ID != "leave" || calls.Load() != 0 {
				t.Fatal("zero-turn leave did not close locally", err)
			}
			if !reflect.DeepEqual(ended.Messages, before.Messages) || !reflect.DeepEqual(ended.Observations, before.Observations) || !reflect.DeepEqual(ended.Memories, before.Memories) {
				t.Fatal("leave changed existing evidence")
			}
			if ended.Ending.Echo != "" || !strings.Contains(strings.Join(ended.Ending.Paragraphs, ""), before.Messages[len(before.Messages)-1].Text) {
				t.Fatal("leave lost exact last reply or invented an echo")
			}
			store, err := NewStore(game.store.dir)
			if err != nil {
				t.Fatal(err)
			}
			restored := NewGame(store, nil)
			read, err := restored.Get(session.ID)
			if err != nil || !reflect.DeepEqual(read, ended) {
				t.Fatal("early-ended save did not survive reload", err)
			}
			replay, err := restored.End(context.Background(), session.ID, command)
			if err != nil || !reflect.DeepEqual(replay, ended) || calls.Load() != 0 {
				t.Fatal("leave replay was not idempotent", err)
			}
			command.Choice = "separate"
			_, err = restored.End(context.Background(), session.ID, command)
			assertCode(t, err, "request_conflict")
			_, err = restored.Turn(context.Background(), session.ID, TurnCommand{RequestID: "turn-after-leave", ExpectedRevision: ended.Revision, Text: "还有一句。"})
			assertCode(t, err, "night_complete")
			_, err = restored.Observe(context.Background(), session.ID, ObservationCommand{RequestID: "observe-after-leave", ExpectedRevision: ended.Revision, Observation: "door"})
			assertCode(t, err, "night_complete")
		})
	}
}

func TestLeavePreservesSilenceAndOnlySelectedSpokenEcho(t *testing.T) {
	var turns, finales atomic.Int32
	game := testGame(t, finalizingNarrator{
		Narrator: narratorFunc(func(context.Context, Session, TurnCommand) (Narrative, error) {
			turns.Add(1)
			return Narrative{Reply: "我现在想一个人待着。", Narration: "她把手机放回口袋。"}, nil
		}),
		finalize: func(context.Context, Session, EndingCommand) (FinalNarrative, error) {
			finales.Add(1)
			return FinalNarrative{}, errors.New("no extra goodbye")
		},
	})
	session := createSession(t, game, "live")
	var err error
	session, err = game.Turn(context.Background(), session.ID, TurnCommand{RequestID: "before-leave-silence", Text: silenceText, Intent: "silence"})
	if err != nil {
		t.Fatal(err)
	}
	session, err = game.Turn(context.Background(), session.ID, TurnCommand{RequestID: "before-leave-spoken", ExpectedRevision: 1, Text: "好，那我先走了。"})
	if err != nil || session.Status != "active" {
		t.Fatal("spoken goodbye must not trigger implicit closure", err)
	}
	for _, invalid := range []string{"1-player", "2-character", "missing"} {
		_, err := game.End(context.Background(), session.ID, EndingCommand{RequestID: "leave-echo-" + invalid, ExpectedRevision: session.Revision, Choice: "leave", EchoMessageID: &invalid})
		assertCode(t, err, "invalid_echo")
	}
	before := cloneSession(session)
	echo := "2-player"
	// A provider outage must not prevent an explicit local closing action.
	game.live = nil
	ended, err := game.End(context.Background(), session.ID, EndingCommand{RequestID: "leave-spoken-001", ExpectedRevision: session.Revision, Choice: "leave", EchoMessageID: &echo})
	if err != nil || ended.Turn != 2 || ended.Revision != 3 || ended.Phase != before.Phase || ended.Ending.Echo != "好，那我先走了。" || turns.Load() != 2 || finales.Load() != 0 {
		t.Fatal("leave added dialogue or lost selected echo", err)
	}
	if !reflect.DeepEqual(before.Messages, ended.Messages) || !strings.Contains(strings.Join(ended.Ending.Paragraphs, ""), "她最后说：“我现在想一个人待着。”") {
		t.Fatal("leave changed the last accepted words")
	}
}

func TestLeaveCannotRevokeInflightTurnAndRejectsStaleOrCancelledCommands(t *testing.T) {
	entered, release := make(chan struct{}), make(chan struct{})
	game := testGame(t, narratorFunc(func(context.Context, Session, TurnCommand) (Narrative, error) {
		close(entered)
		<-release
		return Narrative{Reply: "我听到了。", Narration: "她看向门。"}, nil
	}))
	session := createSession(t, game, "live")
	done := make(chan error, 1)
	go func() {
		_, err := game.Turn(context.Background(), session.ID, TurnCommand{RequestID: "leave-inflight-turn", Text: "不急。"})
		done <- err
	}()
	<-entered
	command := EndingCommand{RequestID: "leave-inflight-close", Choice: "leave"}
	_, err := game.End(context.Background(), session.ID, command)
	assertCode(t, err, "turn_in_progress")
	close(release)
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	_, err = game.End(context.Background(), session.ID, command)
	assertCode(t, err, "revision_conflict")
	command.ExpectedRevision = 1
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err = game.End(ctx, session.ID, command)
	if !errors.Is(err, context.Canceled) {
		t.Fatal("cancelled closing was not cancelled", err)
	}
	current, err := game.Get(session.ID)
	if err != nil || current.Status != "active" || current.Revision != 1 {
		t.Fatal("rejected close changed committed turn", err)
	}
	ended, err := game.End(context.Background(), session.ID, command)
	if err != nil || ended.Status != "ended" || ended.Turn != 1 || ended.Revision != 2 {
		t.Fatal("same close command could not retry", err)
	}
}

func TestLeaveDoesNotUnlockEarlyFullEndingsOrForgedSaveStates(t *testing.T) {
	game := testGame(t, nil)
	session := createSession(t, game, "rehearsal")
	for _, choice := range []string{"handoff", "separate", "correspondence"} {
		_, err := game.End(context.Background(), session.ID, EndingCommand{RequestID: "early-full-" + choice, Choice: choice})
		assertCode(t, err, "ending_not_ready")
		record, err := game.store.Read(session.ID)
		if err != nil {
			t.Fatal(err)
		}
		record.Session.Status = "ended"
		record.Session.Revision = 1
		record.Session.Ending = makeEnding(record.Session, choice)
		record.Receipts["forged-receipt"] = Receipt{Digest: "forged", Session: cloneSession(record.Session)}
		if err := validateRecord(record, session.ID); err == nil {
			t.Fatal("ordinary ending became valid before turn ten")
		}
	}
	for turn := 0; turn < maxTurns; turn++ {
		var err error
		session, err = game.Turn(context.Background(), session.ID, TurnCommand{RequestID: fmt.Sprintf("full-before-leave-%02d", turn), ExpectedRevision: session.Revision, Text: "我在听。"})
		if err != nil {
			t.Fatal(err)
		}
	}
	ended, err := game.End(context.Background(), session.ID, EndingCommand{RequestID: "completed-full-001", ExpectedRevision: session.Revision, Choice: "separate"})
	if err != nil {
		t.Fatal(err)
	}
	_, err = game.End(context.Background(), session.ID, EndingCommand{RequestID: "replace-completed-leave", ExpectedRevision: ended.Revision, Choice: "leave"})
	assertCode(t, err, "ending_not_ready")
	_, err = game.End(context.Background(), session.ID, EndingCommand{RequestID: "replace-completed-stale", ExpectedRevision: 10, Choice: "leave"})
	assertCode(t, err, "revision_conflict")
	stored, err := game.Get(session.ID)
	if err != nil || !reflect.DeepEqual(stored, ended) {
		t.Fatal("leave replaced an already completed ending")
	}
}

func TestLeaveAtTenthTurnUsesSameHTTPContractWithoutFinalizer(t *testing.T) {
	game := testGame(t, narratorFunc(func(context.Context, Session, TurnCommand) (Narrative, error) {
		return Narrative{Reply: "慢走。", Narration: "她把手机留在自己手里。"}, nil
	}))
	session := createSession(t, game, "live")
	for turn := 0; turn < maxTurns; turn++ {
		var err error
		session, err = game.Turn(context.Background(), session.ID, TurnCommand{RequestID: fmt.Sprintf("leave-cap-turn-%02d", turn), ExpectedRevision: session.Revision, Text: "这一夜先到这里。"})
		if err != nil {
			t.Fatal(err)
		}
	}
	handler := NewAPI(game, "")
	body := `{"requestId":"leave-at-cap-http","expectedRevision":10,"choice":"leave","echoMessageId":"10-player"}`
	response := apiRequest(handler, http.MethodPost, "/api/v2/sessions/"+session.ID+"/ending", body)
	var ended Session
	if err := json.Unmarshal(response.Body.Bytes(), &ended); err != nil || response.Code != 200 || ended.Ending.ID != "leave" || ended.Turn != 10 || ended.Revision != 11 || ended.Phase != session.Phase {
		t.Fatal("full-turn local closing failed", err)
	}
	if !reflect.DeepEqual(ended.Messages, session.Messages) {
		t.Fatal("closing added an eleventh character/player exchange")
	}
	replay := apiRequest(handler, http.MethodPost, "/api/v2/sessions/"+session.ID+"/ending", body)
	if replay.Code != 200 || replay.Body.String() != response.Body.String() {
		t.Fatal("HTTP leave retry changed response")
	}
}

func TestLeaveDuringLaterPhasesKeepsProgressAndConfirmedScene(t *testing.T) {
	for _, turnCount := range []int{3, 7, 9} {
		t.Run(fmt.Sprintf("turn-%d", turnCount), func(t *testing.T) {
			game := testGame(t, narratorFunc(func(_ context.Context, session Session, _ TurnCommand) (Narrative, error) {
				narration := "她低头看着纸袋。"
				if session.Turn == 2 {
					narration = "她走进门内，擦干手指。"
				}
				return Narrative{Reply: "我现在想一个人待着。", Narration: narration}, nil
			}))
			session := createSession(t, game, "live")
			for turn := 0; turn < turnCount; turn++ {
				var err error
				session, err = game.Turn(context.Background(), session.ID, TurnCommand{RequestID: fmt.Sprintf("phase-leave-turn-%d", turn), ExpectedRevision: session.Revision, Text: "你可以决定什么时候停下。"})
				if err != nil {
					t.Fatal(err)
				}
			}
			before := projectSession(session)
			ended, err := game.End(context.Background(), session.ID, EndingCommand{RequestID: "phase-leave-close", ExpectedRevision: session.Revision, Choice: "leave"})
			if err != nil || ended.Phase != before.Phase || ended.Turn != before.Turn || ended.Revision != before.Revision+1 || !reflect.DeepEqual(projectSession(ended).Scene, before.Scene) {
				t.Fatal("early closure advanced time or moved the scene", err)
			}
			if before.Scene == nil || before.Scene.Location != "threshold" || before.Scene.SourceMessageID != "3-narrator" {
				t.Fatal("test did not preserve a proven scene")
			}
		})
	}
}
