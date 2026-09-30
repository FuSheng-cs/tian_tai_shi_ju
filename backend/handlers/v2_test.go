package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"game_damo/backend/config"
	"game_damo/backend/game"

	"github.com/gin-gonic/gin"
)

func TestV2RoutesKeepStateOnServerAndMakeRetriesIdempotent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	group := router.Group("/api")
	RegisterV2Routes(group, NewV2SessionService())

	create := httptest.NewRecorder()
	router.ServeHTTP(create, httptest.NewRequest(http.MethodPost, "/api/v2/sessions", nil))
	if create.Code != http.StatusCreated {
		t.Fatalf("create status=%d body=%s", create.Code, create.Body.String())
	}
	var created v2SessionResponse
	if err := json.Unmarshal(create.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if created.State.SessionID == "" || created.State.Revision != 0 || created.State.Messages == nil {
		t.Fatalf("invalid created projection: %#v", created.State)
	}

	command := game.SubmitTurn{
		CommandID:        "command-v2",
		SessionID:        created.State.SessionID,
		ExpectedRevision: 0,
		Text:             "我听见你了。",
	}
	body, _ := json.Marshal(command)
	turn := httptest.NewRecorder()
	router.ServeHTTP(turn, httptest.NewRequest(http.MethodPost,
		"/api/v2/sessions/"+created.State.SessionID+"/turns", bytes.NewReader(body)))
	if turn.Code != http.StatusOK {
		t.Fatalf("turn status=%d body=%s", turn.Code, turn.Body.String())
	}
	var first game.TurnResult
	if err := json.Unmarshal(turn.Body.Bytes(), &first); err != nil {
		t.Fatal(err)
	}
	if first.Replay || first.Revision != 1 || first.State.Revision != 1 {
		t.Fatalf("unexpected first result: %#v", first)
	}

	retry := httptest.NewRecorder()
	router.ServeHTTP(retry, httptest.NewRequest(http.MethodPost,
		"/api/v2/sessions/"+created.State.SessionID+"/turns", bytes.NewReader(body)))
	if retry.Code != http.StatusOK {
		t.Fatalf("retry status=%d body=%s", retry.Code, retry.Body.String())
	}
	var second game.TurnResult
	if err := json.Unmarshal(retry.Body.Bytes(), &second); err != nil {
		t.Fatal(err)
	}
	if !second.Replay || second.Revision != first.Revision || len(second.State.Messages) != 2 {
		t.Fatalf("retry was not a receipt: %#v", second)
	}

	staleCommand := command
	staleCommand.CommandID = "command-stale"
	staleBody, _ := json.Marshal(staleCommand)
	stale := httptest.NewRecorder()
	router.ServeHTTP(stale, httptest.NewRequest(http.MethodPost,
		"/api/v2/sessions/"+created.State.SessionID+"/turns", bytes.NewReader(staleBody)))
	if stale.Code != http.StatusConflict {
		t.Fatalf("stale status=%d body=%s", stale.Code, stale.Body.String())
	}
}

func TestV2RoutesRejectUnknownFieldsAndMissingSessions(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	group := router.Group("/api")
	RegisterV2Routes(group, NewV2SessionService())

	unknown := httptest.NewRecorder()
	router.ServeHTTP(unknown, httptest.NewRequest(http.MethodPost, "/api/v2/sessions/missing/turns",
		bytes.NewBufferString(`{"command_id":"command-x","session_id":"missing","expected_revision":0,"text":"hi","score":99}`)))
	if unknown.Code != http.StatusBadRequest {
		t.Fatalf("unknown field status=%d body=%s", unknown.Code, unknown.Body.String())
	}

	missing := httptest.NewRecorder()
	router.ServeHTTP(missing, httptest.NewRequest(http.MethodGet, "/api/v2/sessions/missing", nil))
	if missing.Code != http.StatusNotFound {
		t.Fatalf("missing session status=%d body=%s", missing.Code, missing.Body.String())
	}
}

func TestV2EventsRequireSeparateAdminToken(t *testing.T) {
	oldConfig := config.Cfg
	config.Cfg = &config.Config{V2AdminToken: "event-secret"}
	t.Cleanup(func() { config.Cfg = oldConfig })

	gin.SetMode(gin.TestMode)
	router := gin.New()
	group := router.Group("/api")
	service := NewV2SessionService()
	RegisterV2Routes(group, service)
	state, err := service.Create(context.Background(), "session-events-api")
	if err != nil {
		t.Fatal(err)
	}

	for _, authorization := range []string{"", "Bearer wrong"} {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodGet, "/api/v2/sessions/"+state.SessionID+"/events", nil)
		if authorization != "" {
			request.Header.Set("Authorization", authorization)
		}
		router.ServeHTTP(recorder, request)
		if recorder.Code != http.StatusForbidden {
			t.Fatalf("authorization %q status=%d body=%s", authorization, recorder.Code, recorder.Body.String())
		}
	}

	authorized := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v2/sessions/"+state.SessionID+"/events", nil)
	request.Header.Set("Authorization", "Bearer event-secret")
	router.ServeHTTP(authorized, request)
	if authorized.Code != http.StatusOK {
		t.Fatalf("authorized event read status=%d body=%s", authorized.Code, authorized.Body.String())
	}
}
