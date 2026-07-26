package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"game_damo/backend/config"

	"github.com/gin-gonic/gin"
)

func TestHandleChatWithoutAnyKeyReturnsMockReplyHint(t *testing.T) {
	gin.SetMode(gin.TestMode)
	oldCfg := config.Cfg
	config.Cfg = &config.Config{}
	t.Cleanup(func() {
		config.Cfg = oldCfg
	})

	router := gin.New()
	router.POST("/api/chat", HandleChat)

	req := httptest.NewRequest(http.MethodPost, "/api/chat",
		strings.NewReader(`{"user_message":"你好","history":[]}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d", w.Code)
	}

	var resp ChatResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if !strings.Contains(resp.Reply, "模拟回复") {
		t.Fatalf("mock reply should tell the player it is simulated, got %q", resp.Reply)
	}
	if resp.Evaluation == nil {
		t.Fatal("mock reply should still carry a default evaluation")
	}
}
