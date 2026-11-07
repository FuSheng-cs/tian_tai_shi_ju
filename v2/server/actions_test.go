package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
)

func TestFreeObservationsPersistAndReplayWithoutDialogue(t *testing.T) {
	var calls atomic.Int32
	game := testGame(t, narratorFunc(func(context.Context, Session, TurnCommand) (Narrative, error) {
		calls.Add(1)
		return Narrative{Reply: "嗯。", Narration: "她看向门。"}, nil
	}))
	initial := createSession(t, game, "live")
	command := ObservationCommand{RequestID: "observe-001", ExpectedRevision: 0, Observation: "door"}
	first, err := game.Observe(context.Background(), initial.ID, command)
	if err != nil || first.Revision != 1 || first.Turn != 0 || calls.Load() != 0 || !reflect.DeepEqual(first.Messages, initial.Messages) || !reflect.DeepEqual(first.Observations, []string{"door"}) {
		t.Fatalf("observation must only save the visible fact: %v", err)
	}
	store, err := NewStore(game.store.dir)
	if err != nil {
		t.Fatal(err)
	}
	reloaded := NewGame(store, game.live)
	again, err := reloaded.Observe(context.Background(), initial.ID, command)
	if err != nil || !reflect.DeepEqual(first, again) {
		t.Fatal("observation receipt did not survive restart", err)
	}
	_, err = reloaded.Observe(context.Background(), initial.ID, ObservationCommand{RequestID: command.RequestID, ExpectedRevision: 0, Observation: "rain"})
	assertCode(t, err, "request_conflict")
	_, err = reloaded.Observe(context.Background(), initial.ID, ObservationCommand{RequestID: "observe-002", ExpectedRevision: 0, Observation: "rain"})
	assertCode(t, err, "revision_conflict")
	_, err = reloaded.Observe(context.Background(), initial.ID, ObservationCommand{RequestID: "observe-003", ExpectedRevision: 1, Observation: "door"})
	assertCode(t, err, "observation_known")
	session, err := reloaded.Turn(context.Background(), initial.ID, TurnCommand{RequestID: "turn-after-observe", ExpectedRevision: 1, Text: "门留着。"})
	if err != nil || session.Revision != 2 || session.Turn != 1 || calls.Load() != 1 {
		t.Fatal("turn did not follow free observation", err)
	}
}

func TestObservationAndDialogueShareMutationLock(t *testing.T) {
	entered, release := make(chan struct{}), make(chan struct{})
	game := testGame(t, narratorFunc(func(context.Context, Session, TurnCommand) (Narrative, error) {
		close(entered)
		<-release
		return Narrative{Reply: "我听到了。", Narration: "她看向门。"}, nil
	}))
	session := createSession(t, game, "live")
	done := make(chan error, 1)
	go func() {
		_, err := game.Turn(context.Background(), session.ID, TurnCommand{RequestID: "talk-lock-001", Text: "我在。"})
		done <- err
	}()
	<-entered
	_, err := game.Observe(context.Background(), session.ID, ObservationCommand{RequestID: "observe-lock-001", Observation: "rain"})
	assertCode(t, err, "turn_in_progress")
	close(release)
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	stored, _ := game.Get(session.ID)
	if stored.Turn != 1 || len(stored.Observations) != 0 {
		t.Fatal("concurrent observation changed dialogue transaction")
	}
}

func TestConcurrentObservationsCommitAtMostOneRevision(t *testing.T) {
	game := testGame(t, nil)
	session := createSession(t, game, "rehearsal")
	var workers sync.WaitGroup
	var committed atomic.Int32
	for i, observation := range []string{"door", "rain"} {
		workers.Add(1)
		go func(index int, value string) {
			defer workers.Done()
			_, err := game.Observe(context.Background(), session.ID, ObservationCommand{RequestID: fmt.Sprintf("observe-race-%d", index), Observation: value})
			if err == nil {
				committed.Add(1)
				return
			}
			code := publicError(err).Code
			if code != "revision_conflict" && code != "turn_in_progress" {
				t.Errorf("unexpected conflict: %v", err)
			}
		}(i, observation)
	}
	workers.Wait()
	stored, err := game.Get(session.ID)
	if err != nil || committed.Load() != 1 || stored.Revision != 1 || stored.Turn != 0 || len(stored.Observations) != 1 {
		t.Fatal("observation race lost state", err)
	}
}

func TestAllObservationsAndSilenceAllowCompleteNightWithSelectedEcho(t *testing.T) {
	game := testGame(t, nil)
	session := createSession(t, game, "rehearsal")
	for i, id := range []string{"door", "rain", "camera", "receipt"} {
		var err error
		session, err = game.Observe(context.Background(), session.ID, ObservationCommand{RequestID: "observe-full-" + id, ExpectedRevision: i, Observation: id})
		if err != nil {
			t.Fatal(err)
		}
	}
	for turn := 0; turn < maxTurns; turn++ {
		command := TurnCommand{RequestID: fmt.Sprintf("full-turn-%02d", turn), ExpectedRevision: session.Revision, Text: fmt.Sprintf("这是第%d句。", turn+1)}
		if turn == 0 {
			command.Text, command.Intent = silenceText, "silence"
		}
		var err error
		session, err = game.Turn(context.Background(), session.ID, command)
		if err != nil {
			t.Fatal(err)
		}
	}
	if session.Revision != 14 || session.Turn != 10 || session.Status != "choosing" || session.Messages[2].Intent != "silence" {
		t.Fatal("free actions or silence broke turn accounting")
	}
	for _, invalid := range []string{"1-player", "2-character", "not-a-message"} {
		_, err := game.End(context.Background(), session.ID, EndingCommand{RequestID: "bad-echo-" + invalid, ExpectedRevision: 14, Choice: "separate", EchoMessageID: &invalid})
		assertCode(t, err, "invalid_echo")
	}
	echoID := "3-player"
	command := EndingCommand{RequestID: "full-ending-001", ExpectedRevision: 14, Choice: "separate", EchoMessageID: &echoID}
	ended, err := game.End(context.Background(), session.ID, command)
	if err != nil || ended.Revision != 15 || ended.Ending.Echo != "这是第3句。" {
		t.Fatal("ending did not preserve selected original line", err)
	}
	replayed, err := game.End(context.Background(), session.ID, command)
	if err != nil || !reflect.DeepEqual(replayed, ended) {
		t.Fatal("selected echo was not idempotent", err)
	}
}

func TestOmittedEchoIsEmptyAndSilenceDoesNotAcceptArbitraryText(t *testing.T) {
	session := Session{Messages: []Message{{ID: "1-player", Role: "player", Text: "原话。"}}}
	for _, id := range []*string{nil, new(string)} {
		if echo, err := selectedEcho(session, id); err != nil || echo != "" {
			t.Fatal("no selection must leave no quote")
		}
	}
	for _, command := range []TurnCommand{
		{RequestID: "invalid-intent", Text: "原话。", Intent: "silence"},
		{RequestID: "unknown-intent", Text: silenceText, Intent: "consent"},
	} {
		assertCode(t, validateTurn(command), "invalid_input")
	}
}

func TestObservationHTTPValidationCancellationAndLegacySave(t *testing.T) {
	game := testGame(t, nil)
	session := createSession(t, game, "rehearsal")
	handler := NewAPI(game, "")
	path := "/api/v2/sessions/" + session.ID + "/observations"
	for _, body := range []string{
		`{"requestId":"observe-http-001","expectedRevision":0,"observation":"bag"}`,
		`{"requestId":"observe-http-001","expectedRevision":0,"observation":""}`,
		`{"requestId":"observe-http-001","expectedRevision":0,"observation":"door","turn":10}`,
		`{"requestId":"observe-http-001","observation":"door"}`,
	} {
		if response := apiRequest(handler, http.MethodPost, path, body); response.Code != 400 {
			t.Fatalf("bad observation accepted: %s", response.Body.String())
		}
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := game.Observe(ctx, session.ID, ObservationCommand{RequestID: "cancel-observe", Observation: "door"})
	assertCode(t, err, "request_cancelled")
	response := apiRequest(handler, http.MethodPost, path, `{"requestId":"observe-http-001","expectedRevision":0,"observation":"door"}`)
	if response.Code != 200 || response.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("observation HTTP contract failed", response.Body.String())
	}
	var result Session
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil || result.Turn != 0 || result.Revision != 1 {
		t.Fatal("observation HTTP state failed", err)
	}
	// An old schema-1 record uses revision == turn and may already have an
	// observation saved with that turn. It must still be readable and playable.
	legacy := createSession(t, game, "rehearsal")
	legacy, err = game.Turn(context.Background(), legacy.ID, TurnCommand{RequestID: "legacy-turn-001", Text: "门留着。", Observation: "door"})
	if err != nil {
		t.Fatal(err)
	}
	legacy, err = game.Observe(context.Background(), legacy.ID, ObservationCommand{RequestID: "legacy-observe-001", ExpectedRevision: 1, Observation: "rain"})
	if err != nil || legacy.Revision != 2 || legacy.Turn != 1 {
		t.Fatal("legacy record cannot accept new observation", err)
	}
}

func TestRehearsalChoicesAreDistinctAndGrounded(t *testing.T) {
	narrator := RehearsalNarrator{}
	for turn, choices := range rehearsalChoices {
		seen := make(map[string]bool)
		for line := range choices {
			command := TurnCommand{Text: line, Observation: "receipt"}
			result, err := narrator.Generate(context.Background(), Session{Turn: turn}, command)
			if err != nil || validateNarrative(result, command) != nil || seen[result.Reply] {
				t.Fatalf("beat %d lacks two distinct grounded replies: %v", turn, err)
			}
			seen[result.Reply] = true
		}
		if len(seen) != 2 {
			t.Errorf("beat %d does not have two authored options", turn)
		}
	}
	result, _ := narrator.Generate(context.Background(), Session{Turn: 1}, TurnCommand{Text: "相机淋湿了，会坏吗？", Observation: "receipt"})
	if !strings.Contains(result.Reply, "防水") {
		t.Fatal("selected observation must not override the authored camera question")
	}
}

func TestLiveEndingTitlesNeverAssertAcceptedOffer(t *testing.T) {
	for _, choice := range []string{"handoff", "separate", "correspondence"} {
		ending := makeLiveEnding(Session{}, choice, FinalNarrative{Reply: "我还没决定。", Narration: "她轻轻摇头。"})
		if ending.Title == "门内有人" || ending.Title == "各自下楼" || ending.Title == "还没洗出来" || !strings.Contains(strings.Join(ending.Paragraphs, ""), "我还没决定。") {
			t.Fatal("live ending implies consent or replaces refusal")
		}
	}
}
