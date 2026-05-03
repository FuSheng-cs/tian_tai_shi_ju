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
		"标签一致性是硬性规则",
		"递手机、存联系方式、明天九点",
	}

	for _, item := range required {
		if !strings.Contains(prompt, item) {
			t.Fatalf("prompt missing required gameplay rule: %s", item)
		}
	}
}

func TestNormalizeFinalMechanicTagsInfersMissingEndingTags(t *testing.T) {
	tests := []struct {
		name string
		text string
		want string
	}{
		{
			name: "acquaintance",
			text: "她把手机递过来，说：存个艾就行。明天九点，别迟到。",
			want: EndingAcquaintanceTag,
		},
		{
			name: "disappear",
			text: "她走进消防通道，没有回头，脚步声逐渐消失。",
			want: EndingDisappearTag,
		},
		{
			name: "death",
			text: "她轻轻呼出最后一缕烟，身体向后倾去。",
			want: EndingDeathTag,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := normalizeFinalMechanicTags(tt.text, 0, 25, 5, 7)
			if !strings.Contains(got, tt.want) {
				t.Fatalf("expected inferred tag %s in %q", tt.want, got)
			}
		})
	}
}

func TestNormalizeFinalMechanicTagsAddsDeathNarrativeForDefaultFailure(t *testing.T) {
	got := normalizeFinalMechanicTags("嗯。注意安全。", 0, 0, 0, 10)

	if !strings.Contains(got, EndingDeathTag) {
		t.Fatalf("expected death tag in %q", got)
	}
	if !strings.Contains(got, "越过栏杆") || !strings.Contains(got, "楼下只剩一片空白") {
		t.Fatalf("expected explicit death narrative in %q", got)
	}
}

func TestNormalizeFinalMechanicTagsDropsQuestionMarkNoise(t *testing.T) {
	got := normalizeFinalMechanicTags("????,????\n", 0, 0, 0, 10)

	if strings.Contains(got, "????") {
		t.Fatalf("should remove question mark noise, got %q", got)
	}
	if !strings.Contains(got, "越过栏杆") || !strings.Contains(got, EndingDeathTag) {
		t.Fatalf("should preserve deterministic death ending, got %q", got)
	}
}

func TestNormalizeFinalMechanicTagsRejectsUnmetRescueTag(t *testing.T) {
	text := "她终于从栏杆上下来，走进消防通道，没有回头。\n" + EndingDisappearTag
	got := normalizeFinalMechanicTags(text, 0, 0, 0, 10)

	if !strings.Contains(got, EndingDeathTag) {
		t.Fatalf("expected unmet rescue to fall back to death, got %q", got)
	}
	if strings.Contains(got, EndingDisappearTag) {
		t.Fatalf("should remove disallowed rescue tag, got %q", got)
	}
	if strings.Contains(got, "消防通道") || strings.Contains(got, "没有回头") {
		t.Fatalf("should remove disallowed rescue narrative, got %q", got)
	}
}

func TestNormalizeFinalMechanicTagsDoesNotEndEarly(t *testing.T) {
	text := "她把手机递过来，说：存个艾就行。明天九点，别迟到。"
	got := normalizeFinalMechanicTags(text, 1, 25, 5, 7)
	if got != text {
		t.Fatalf("should not add ending tags before final pressure turn, got %q", got)
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
