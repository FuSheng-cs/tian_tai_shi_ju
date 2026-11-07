package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"sync/atomic"
	"testing"
)

func TestIdentityRequiresAnUnambiguousCanonicalSelfIntroduction(t *testing.T) {
	for _, text := range []string{
		"我叫艾。", "叫我艾。", "……我叫艾。",
		"我叫艾。你呢？", "我叫艾。你说的“别急”，我听见了。",
		"我叫艾。你说的‘如果’，不用急着往后接。",
		"我叫艾，艾草的艾。阿迟，纸巾谢谢了，我手都冻僵了，想往门里站一点。",
		"同事来接的。他还嫌我拍到了店门口的垃圾袋。……我叫艾。",
		"嗯。他说下次把垃圾收了再拍。我说，那就不是这一天了。……我叫艾。",
	} {
		if !introducesCanonicalName(text) {
			t.Errorf("clear self-introduction not recognized: %s", text)
		}
	}
	for _, text := range []string{
		"我叫艾莉。", "我叫艾草。", "我叫艾琳。", "我叫艾丽，别弄错了。",
		"我不叫艾。", "我不是艾。", "我叫艾不是我的名字。", "我叫艾，但不是真名。",
		"我叫艾？", "我叫艾，你就信了？", "我叫艾吗。", "叫我艾可以吗。",
		"“我叫艾”，你想听的是这句话。", "他说：我叫艾。", "她叫艾。", "你叫我艾。",
		"如果要举例。我叫艾。", "假设我是角色。我叫艾。", "我叫艾，只是假设。",
		"比如：我叫艾。", "念一句例句。我叫艾。", "你让我说。我叫艾。",
		"我叫艾。这是台词。", "我叫艾。骗你的。", "我叫艾。开玩笑的。",
		"我叫艾。这不是真的。", "我叫艾。刚才说错了。", "```\n我叫艾。\n```",
		"“我叫艾。”你呢？", "我叫“另一个词”艾。", "「我叫艾。」只是例句。",
		"他说：\n我叫艾。", "我叫艾。”",
		"我叫艾。刚才那句“我叫艾”是假的。", "如果我要介绍自己。‘我叫艾。’",
		"我叫艾，或者艾莉。", "我叫艾，就会有人理我吗。", "假装介绍自己：我叫艾。",
	} {
		if introducesCanonicalName(text) {
			t.Errorf("ambiguous name leaked: %s", text)
		}
	}
}

func TestIdentityUsesCharacterSourceAndPreservesDiscoveryOrder(t *testing.T) {
	session := Session{Messages: []Message{
		{ID: "1-player", Role: "player", Text: "我叫艾。"},
		{ID: "1-character", Role: "character", Text: "你可以不告诉我名字。"},
		{ID: "2-narrator", Role: "narrator", Text: "我叫艾。"},
		{ID: "2-character", Role: "character", Text: "‘我叫艾’。这是例句。"},
	}}
	before, _ := json.Marshal(session)
	if projectSession(session).Identity != nil {
		t.Fatal("player, narrator or quote supplied character identity")
	}
	session.Messages = append(session.Messages,
		Message{ID: "7-character", Role: "character", Text: "我叫艾，艾草的艾。阿迟，纸巾谢谢了。"},
		Message{ID: "8-character", Role: "character", Text: "我叫艾。"},
	)
	identity := projectSession(session).Identity
	if identity == nil || identity.Name != "艾" || identity.SourceMessageID != "7-character" {
		t.Fatal("identity lost its first actual source")
	}
	data, _ := json.Marshal(projectSession(Session{Messages: session.Messages[:4]}))
	if bytes.Contains(data, []byte(`"identity"`)) {
		t.Fatal("unknown identity must be omitted, not null")
	}
	unchanged, _ := json.Marshal(Session{Messages: session.Messages[:4]})
	if !bytes.Equal(before, unchanged) {
		t.Fatal("projection mutated transcript")
	}
}

func TestIdentityProjectsAllAPIResponsesWithoutChangingSavesOrReceipts(t *testing.T) {
	var generated atomic.Int32
	game := testGame(t, finalizingNarrator{
		Narrator: narratorFunc(func(_ context.Context, session Session, _ TurnCommand) (Narrative, error) {
			generated.Add(1)
			if session.Turn == 1 {
				return Narrative{Reply: "我叫艾，艾草的艾。纸巾谢谢了。", Narration: "她接过纸巾。"}, nil
			}
			return Narrative{Reply: "我听到了。", Narration: "她把纸袋往外套里收了收。"}, nil
		}),
		finalize: func(context.Context, Session, EndingCommand) (FinalNarrative, error) {
			return FinalNarrative{Reply: "今晚先这样吧。", Narration: "她看了一眼门内。"}, nil
		},
	})
	handler := NewAPI(game, "")
	created := apiRequest(handler, http.MethodPost, "/api/v2/sessions", `{"mode":"live"}`)
	var session Session
	if err := json.Unmarshal(created.Body.Bytes(), &session); err != nil || created.Code != 201 {
		t.Fatal("create failed", err)
	}
	if bytes.Contains(created.Body.Bytes(), []byte(`"identity"`)) {
		t.Fatal("identity leaked before introduction")
	}
	path := "/api/v2/sessions/" + session.ID
	firstBody := `{"requestId":"identity-turn-1","expectedRevision":0,"text":"我就叫你艾好了。"}`
	first := apiRequest(handler, http.MethodPost, path+"/turns", firstBody)
	if first.Code != 200 || bytes.Contains(first.Body.Bytes(), []byte(`"identity"`)) {
		t.Fatal("player naming leaked identity")
	}
	introBody := `{"requestId":"identity-turn-2","expectedRevision":1,"text":"如果愿意，可以告诉我怎么称呼你。"}`
	introduced := apiRequest(handler, http.MethodPost, path+"/turns", introBody)
	assertIdentity := func(response []byte) {
		t.Helper()
		var public sessionResponse
		if err := json.Unmarshal(response, &public); err != nil || public.Identity == nil || public.Identity.Name != "艾" || public.Identity.SourceMessageID != "2-character" {
			t.Fatal("API response lost accepted identity", err)
		}
	}
	assertIdentity(introduced.Body.Bytes())
	if introduced.Code != 200 {
		t.Fatal("introduction failed")
	}
	storedBefore, err := os.ReadFile(filepath.Join(game.store.dir, session.ID+".json"))
	if err != nil || bytes.Contains(storedBefore, []byte(`"identity"`)) {
		t.Fatal("public projection entered durable schema", err)
	}
	// Simulate a restart/legacy schema-1 load. Reading and replaying cannot
	// migrate records or call a model merely to recover the public name.
	reloaded, err := NewStore(game.store.dir)
	if err != nil {
		t.Fatal(err)
	}
	restoredHandler := NewAPI(NewGame(reloaded, game.live), "")
	assertIdentity(apiRequest(restoredHandler, http.MethodGet, path, "").Body.Bytes())
	replay := apiRequest(restoredHandler, http.MethodPost, path+"/turns", introBody)
	assertIdentity(replay.Body.Bytes())
	if !bytes.Equal(replay.Body.Bytes(), introduced.Body.Bytes()) || generated.Load() != 2 {
		t.Fatal("receipt projection changed replay or called model")
	}
	earlyReplay := apiRequest(restoredHandler, http.MethodPost, path+"/turns", firstBody)
	if bytes.Contains(earlyReplay.Body.Bytes(), []byte(`"identity"`)) {
		t.Fatal("earlier receipt exposed a future introduction")
	}
	storedAfter, _ := os.ReadFile(filepath.Join(game.store.dir, session.ID+".json"))
	if !bytes.Equal(storedBefore, storedAfter) {
		t.Fatal("restore/projection rewrote legacy save or receipts")
	}
	observed := apiRequest(restoredHandler, http.MethodPost, path+"/observations", `{"requestId":"identity-observe","expectedRevision":2,"observation":"door"}`)
	assertIdentity(observed.Body.Bytes())
	if err := json.Unmarshal(observed.Body.Bytes(), &session); err != nil {
		t.Fatal(err)
	}
	for session.Turn < maxTurns {
		body := fmt.Sprintf(`{"requestId":"identity-rest-%d","expectedRevision":%d,"text":"我在听。"}`, session.Turn, session.Revision)
		response := apiRequest(restoredHandler, http.MethodPost, path+"/turns", body)
		assertIdentity(response.Body.Bytes())
		if err := json.Unmarshal(response.Body.Bytes(), &session); err != nil {
			t.Fatal(err)
		}
	}
	endingBody := fmt.Sprintf(`{"requestId":"identity-ending","expectedRevision":%d,"choice":"separate"}`, session.Revision)
	ending := apiRequest(restoredHandler, http.MethodPost, path+"/ending", endingBody)
	assertIdentity(ending.Body.Bytes())
	var ended sessionResponse
	if err := json.Unmarshal(ending.Body.Bytes(), &ended); err != nil || ended.Status != "ended" {
		t.Fatal("ending identity response failed", err)
	}
	if !reflect.DeepEqual(ended.Identity, projectSession(ended.Session).Identity) {
		t.Fatal("ending used another identity source")
	}
}

func TestRejectedNarrativeCannotRevealIdentity(t *testing.T) {
	game := testGame(t, narratorFunc(func(context.Context, Session, TurnCommand) (Narrative, error) {
		return Narrative{Reply: "我叫艾。" + strings.Repeat("雨", 221), Narration: "她走进门内。"}, nil
	}))
	session := createSession(t, game, "live")
	handler := NewAPI(game, "")
	path := "/api/v2/sessions/" + session.ID
	response := apiRequest(handler, http.MethodPost, path+"/turns", `{"requestId":"invalid-identity","expectedRevision":0,"text":"怎么称呼你？"}`)
	if response.Code != 502 {
		t.Fatal("invalid narrative was accepted")
	}
	get := apiRequest(handler, http.MethodGet, path, "")
	if bytes.Contains(get.Body.Bytes(), []byte(`"identity"`)) || bytes.Contains(get.Body.Bytes(), []byte(`"scene"`)) {
		t.Fatal("uncommitted model output revealed identity or movement")
	}
}

func TestSceneProjectionRequiresCompletedCharacterOwnedMovement(t *testing.T) {
	for _, text := range []string{
		"她走进门内，擦干手指，拿出手机低头打字。",
		"她走进楼道。", "她跨过门槛走进楼梯间。",
		"她慢慢走进门内，擦干手指。", "她缓缓走进楼道。",
		"她抱好纸袋，自己走到门内那块干燥地面旁。",
	} {
		if narratedLocation(text) != "threshold" {
			t.Errorf("completed entry not recognized: %s", text)
		}
	}
	for _, text := range []string{
		"她想走进门内。", "她没有走进门内。", "她准备走进楼道。",
		"她问能否走进门内。", "她看向门内。", "如果雨再大一点，她走进门内。",
		"她朝门内走了一步。", "她走进门内前停了下来。", "她走进门内了吗。",
		"她走进门内？", "她说：她走进门内。", "‘她走进门内’，是你刚才的设想。",
		"她并未跨过门槛走进楼梯间。", "你把她拉进门内。", "你走进楼道。",
		"她站在门外，看着灯光。", "那个人走进门内。", "她走进门内。这是例句。",
	} {
		if narratedLocation(text) != "" {
			t.Errorf("uncertain/foreign movement changed scene: %s", text)
		}
	}
	for _, text := range []string{"她走回天台。", "她慢慢走回天台。", "她回到天台，雨还在下。", "她走进门内。她走回天台。"} {
		if narratedLocation(text) != "rooftop" {
			t.Errorf("explicit return did not restore rooftop: %s", text)
		}
	}
	session := Session{Phase: "threshold", Messages: []Message{
		{ID: "1-player", Role: "player", Text: "她走进门内。"},
		{ID: "1-character", Role: "character", Text: "她走进门内。"},
		{ID: "1-narrator", Role: "narrator", Text: "她看向门内。"},
	}}
	if projectSession(session).Scene != nil {
		t.Fatal("phase/player/character claims supplied physical movement")
	}
	session.Messages = append(session.Messages, Message{ID: "8-narrator", Role: "narrator", Text: "她走进门内，擦干手指，拿出手机低头打字。"})
	scene := projectSession(session).Scene
	if scene == nil || scene.Location != "threshold" || scene.SourceMessageID != "8-narrator" {
		t.Fatal("scene lost accepted entry source")
	}
	session.Messages = append(session.Messages, Message{ID: "9-narrator", Role: "narrator", Text: "她看向天台。"})
	if !reflect.DeepEqual(projectSession(session).Scene, scene) {
		t.Fatal("a look erased confirmed location")
	}
	session.Messages = append(session.Messages, Message{ID: "10-narrator", Role: "narrator", Text: "她走回天台。"})
	if got := projectSession(session).Scene; got == nil || got.Location != "rooftop" || got.SourceMessageID != "10-narrator" {
		t.Fatal("explicit return did not update location source")
	}
}

func TestSceneRestoreAndReceiptsKeepTheirOriginalEvidenceWithoutSaveChanges(t *testing.T) {
	game := testGame(t, narratorFunc(func(_ context.Context, session Session, _ TurnCommand) (Narrative, error) {
		actions := []string{"她走进门内，擦干手指。", "她看向天台。", "她走回天台。"}
		return Narrative{Reply: "嗯，门留着。", Narration: actions[session.Turn]}, nil
	}))
	session := createSession(t, game, "live")
	handler := NewAPI(game, "")
	path := "/api/v2/sessions/" + session.ID
	firstBody := `{"requestId":"scene-entry-001","expectedRevision":0,"text":"你可以自己决定下一步。"}`
	first := apiRequest(handler, http.MethodPost, path+"/turns", firstBody)
	var entered sessionResponse
	if err := json.Unmarshal(first.Body.Bytes(), &entered); err != nil || entered.Scene == nil || entered.Scene.Location != "threshold" || entered.Scene.SourceMessageID != "1-narrator" {
		t.Fatal("entry not projected on turn", err)
	}
	for turn := 1; turn < 3; turn++ {
		body := fmt.Sprintf(`{"requestId":"scene-turn-%d","expectedRevision":%d,"text":"门还开着。"}`, turn, turn)
		if result := apiRequest(handler, http.MethodPost, path+"/turns", body); result.Code != 200 {
			t.Fatal("scene progression failed")
		}
	}
	storedBefore, err := os.ReadFile(filepath.Join(game.store.dir, session.ID+".json"))
	if err != nil || bytes.Contains(storedBefore, []byte(`"scene"`)) {
		t.Fatal("projection entered save schema", err)
	}
	store, err := NewStore(game.store.dir)
	if err != nil {
		t.Fatal(err)
	}
	restored := NewAPI(NewGame(store, nil), "")
	var latest sessionResponse
	if err := json.Unmarshal(apiRequest(restored, http.MethodGet, path, "").Body.Bytes(), &latest); err != nil || latest.Scene == nil || latest.Scene.Location != "rooftop" || latest.Scene.SourceMessageID != "3-narrator" {
		t.Fatal("restored scene missing latest proof", err)
	}
	if replay := apiRequest(restored, http.MethodPost, path+"/turns", firstBody); !bytes.Equal(first.Body.Bytes(), replay.Body.Bytes()) {
		t.Fatal("old receipt inherited a future return")
	}
	storedAfter, _ := os.ReadFile(filepath.Join(game.store.dir, session.ID+".json"))
	if !bytes.Equal(storedBefore, storedAfter) {
		t.Fatal("scene restore/receipt projection rewrote the legacy save")
	}
	observed := apiRequest(restored, http.MethodPost, path+"/observations", `{"requestId":"scene-observe","expectedRevision":3,"observation":"rain"}`)
	var observedSession sessionResponse
	if err := json.Unmarshal(observed.Body.Bytes(), &observedSession); err != nil || !reflect.DeepEqual(observedSession.Scene, latest.Scene) {
		t.Fatal("observation endpoint lost scene projection", err)
	}
	// The read and receipt above cannot write anything. The later observation
	// is a normal mutation and still stores no derived scene field.
	record, err := store.Read(session.ID)
	if err != nil || record.SchemaVersion != 1 {
		t.Fatal("scene required a save migration", err)
	}
	data, _ := json.Marshal(record)
	if bytes.Contains(data, []byte(`"scene"`)) {
		t.Fatal("scene projection leaked into receipts")
	}
}
