package llm

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"regexp"
	"strings"
	"testing"
)

func TestProviderDefaultsMatchFrontend(t *testing.T) {
	data, err := os.ReadFile("../../legacy_vue/src/modules/LLMService.ts")
	if err != nil {
		t.Fatal(err)
	}
	for provider, defaults := range providerDefaults {
		if provider == "anthropic" {
			continue
		}
		pattern := `(?s)id: '` + provider + `',.*?defaultModel: '([^']*)',.*?defaultBaseUrl: '([^']*)'`
		match := regexp.MustCompile(pattern).FindStringSubmatch(string(data))
		if len(match) != 3 || match[1] != defaults.Model || match[2] != defaults.BaseURL {
			t.Errorf("%s frontend/backend defaults differ: %v vs %+v", provider, match, defaults)
		}
	}
}

func TestCurrentModelsSendCompatibleRequests(t *testing.T) {
	for _, tc := range []struct {
		provider, model, thinking, effort string
		temperature, disableQwen          bool
	}{
		{"deepseek", "deepseek-flash", "disabled", "", true, false},
		{"qwen", "qwen3.7-plus", "", "", true, true},
		{"kimi", "kimi-k2.6", "disabled", "", false, false},
		{"openai", "gpt-6-luna", "", "none", false, false},
		{"openai", "gpt-6.1-sol", "", "low", false, false},
		{"zhipu", "glm-5.3-flash", "", "low", false, false},
		{"claude", "claude-sonnet-5-5", "", "", false, false},
		{"custom", "legacy-model", "", "", true, false},
	} {
		t.Run(tc.model, func(t *testing.T) {
			var captured map[string]json.RawMessage
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
					t.Error(err)
				}
				w.Header().Set("Content-Type", "application/json")
				if tc.provider == "claude" {
					_, _ = w.Write([]byte(`{"content":[{"type":"thinking","thinking":"internal"},{"type":"text","text":"ok"}]}`))
				} else {
					writeOpenAIContent(t, w, "ok")
				}
			}))
			defer server.Close()
			reply, err := callLLM(ClientConfig{Provider: tc.provider, Model: tc.model,
				APIKey: "test-key", BaseURL: server.URL}, []Message{{Role: "user", Content: "hello"}}, 0)
			if err != nil || reply != "ok" {
				t.Fatalf("reply=%q error=%v", reply, err)
			}
			if _, ok := captured["temperature"]; ok != tc.temperature {
				t.Errorf("temperature presence = %v", ok)
			}
			if tc.thinking != "" && string(captured["thinking"]) != `{"type":"`+tc.thinking+`"}` {
				t.Errorf("thinking=%s", captured["thinking"])
			}
			if tc.effort != "" && string(captured["reasoning_effort"]) != `"`+tc.effort+`"` {
				t.Errorf("effort=%s", captured["reasoning_effort"])
			}
			if tc.disableQwen && string(captured["enable_thinking"]) != "false" {
				t.Errorf("enable_thinking=%s", captured["enable_thinking"])
			}
		})
	}
}

func TestKimiPreservedThinkingRequiresSupportedHistory(t *testing.T) {
	_, err := callLLM(ClientConfig{Provider: "kimi", Model: "kimi-k3", APIKey: "test-key"}, nil, 0)
	if err == nil || !strings.Contains(err.Error(), "preserved reasoning history") {
		t.Fatalf("expected compatibility error, got %v", err)
	}
}
