package llm

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestBuildMainSystemPromptContainsGameplayMechanics(t *testing.T) {
	prompt := buildMainSystemPrompt(3, 25, 5, 7, AiStateWaveringTag)

	required := []string{
		AffectionBoostTag,
		EmotionStingTag,
		EmotionSurpriseTag,
		EmotionSoftTag,
		EmotionCuriosityTag,
		AiStateGuardedTag,
		AiStateWatchingTag,
		AiStateWaveringTag,
		AiStateTurnBackTag,
		AiStateEdgeTag,
		"状态标签代表持续场面",
		"情绪标签只代表本轮瞬时视觉反馈",
		"一只脚在栏杆内、一只脚在栏杆外",
		"必须先输出 [状态:回身]",
		"好感度 >= 20",
		"好感触发次数 >= 4",
		"好感度 >= 25",
		"好感触发次数 >= 5",
		"玩家至少已发言 7 次",
		"前 5 句内不得触发最终结局",
		"情绪标签只代表视觉反馈",
		"普通友善但平庸",
	}

	for _, item := range required {
		if !strings.Contains(prompt, item) {
			t.Fatalf("prompt missing required gameplay rule: %s", item)
		}
	}
}

func TestBuildMainSystemPromptKeepsCharacterCore(t *testing.T) {
	prompt := buildMainSystemPrompt(10, 0, 0, 0, AiStateGuardedTag)

	required := []string{
		"你是\"艾\"，一个紫色内染发的女孩",
		"你的职业是独立摄影师",
		"你的精神内核极度虚无",
		"被看见悖论",
		"你一直努力看见别人，却长期无人真正看见你",
		"绝望的生命不容易被拯救",
		"此时此刻，你正坐在天台的栏杆上抽烟",
	}

	for _, item := range required {
		if !strings.Contains(prompt, item) {
			t.Fatalf("prompt changed or removed character core: %s", item)
		}
	}
}

func TestAfterStoryPromptKeepsTemporarySurvivalFraming(t *testing.T) {
	prompt := buildAfterStorySystemPrompt()

	required := []string{
		"暂时离开了栏杆",
		"你没有被治好",
		"愿意继续和他说话",
	}

	for _, item := range required {
		if !strings.Contains(prompt, item) {
			t.Fatalf("after story prompt missing temporary survival framing: %s", item)
		}
	}
}

func TestCallLLMUsesAnthropicMessagesAPIForClaude(t *testing.T) {
	var captured AnthropicRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/messages" {
			t.Fatalf("unexpected Anthropic endpoint: %s", r.URL.Path)
		}
		if got := r.Header.Get("x-api-key"); got != "test-key" {
			t.Fatalf("unexpected api key header: %s", got)
		}
		if got := r.Header.Get("anthropic-version"); got == "" {
			t.Fatal("missing anthropic-version header")
		}
		if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
			t.Fatalf("failed to decode request: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"content":[{"type":"text","text":"ok"}]}`))
	}))
	defer server.Close()

	oldClient := httpClient
	httpClient = server.Client()
	defer func() {
		httpClient = oldClient
	}()

	reply, err := callLLM(ClientConfig{
		Provider: "claude",
		APIKey:   "test-key",
		Model:    "claude-test",
		BaseURL:  server.URL,
	}, []Message{
		{Role: "system", Content: "system prompt"},
		{Role: "user", Content: "hello"},
	}, 0.4)
	if err != nil {
		t.Fatalf("callLLM returned error: %v", err)
	}
	if reply != "ok" {
		t.Fatalf("unexpected reply: %s", reply)
	}
	if captured.Model != "claude-test" {
		t.Fatalf("unexpected model: %s", captured.Model)
	}
	if captured.System != "system prompt" {
		t.Fatalf("unexpected system prompt: %s", captured.System)
	}
	if len(captured.Messages) != 1 || captured.Messages[0].Role != "user" || captured.Messages[0].Content != "hello" {
		t.Fatalf("unexpected messages: %#v", captured.Messages)
	}
}

func TestCustomProviderRequiresExplicitEndpointAndModel(t *testing.T) {
	_, err := callLLM(ClientConfig{
		Provider: "custom",
		APIKey:   "test-key",
	}, []Message{{Role: "user", Content: "hello"}}, 0.4)
	if err == nil || !strings.Contains(err.Error(), "base_url") {
		t.Fatalf("expected custom base_url error, got %v", err)
	}

	_, err = callLLM(ClientConfig{
		Provider: "custom",
		APIKey:   "test-key",
		BaseURL:  "https://example.com/v1",
	}, []Message{{Role: "user", Content: "hello"}}, 0.4)
	if err == nil || !strings.Contains(err.Error(), "model") {
		t.Fatalf("expected custom model error, got %v", err)
	}
}
