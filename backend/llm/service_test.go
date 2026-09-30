package llm

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func writeOpenAIContent(t *testing.T, w http.ResponseWriter, content string) {
	t.Helper()
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]interface{}{
		"choices": []map[string]interface{}{
			{
				"message": map[string]string{"content": content},
			},
		},
	}); err != nil {
		t.Fatalf("failed to write OpenAI response: %v", err)
	}
}

func TestBuildMainSystemPromptContainsSafetyBoundaries(t *testing.T) {
	prompt := buildMainSystemPrompt(3, 10, 2, 7, EvaluationAiStateWavering)

	for _, item := range []string{
		CharacterName,
		"学业压力",
		"网络欺凌",
		"家庭冲突",
		"长期孤独",
		"说教",
		"否定",
		"不安全的环境",
		"JSON",
	} {
		if !strings.Contains(prompt, item) {
			t.Fatalf("main prompt is missing %q", item)
		}
	}

	for _, item := range []string{
		TrustBoostTag,
		EmotionStingTag,
		EmotionSurpriseTag,
		EmotionSoftTag,
		EmotionCuriosityTag,
		AiStateGuardedTag,
		AiStateWatchingTag,
		AiStateWaveringTag,
		AiStateCryingTag,
		AiStateLeavingTag,
		EndingSafeExitTag,
		EndingRefusalTag,
	} {
		if strings.Contains(prompt, item) {
			t.Fatalf("main prompt should not contain mechanic tag %q", item)
		}
	}
}

func TestTurnEvaluationPromptDefinesTrustAndTwoEndings(t *testing.T) {
	prompt := buildTurnEvaluationSystemPrompt()

	for _, item := range []string{
		`"emotion"`,
		`"ai_state"`,
		`"trust_delta"`,
		`"pressure_delta"`,
		`"ending_type"`,
		EvaluationAiStateGuarded,
		EvaluationAiStateWatching,
		EvaluationAiStateWavering,
		EvaluationAiStateCrying,
		EvaluationAiStateLeaving,
		EndingSafeExitType,
		EndingRefusalType,
		"不额外扣除开口机会",
	} {
		if !strings.Contains(prompt, item) {
			t.Fatalf("evaluation prompt is missing %q", item)
		}
	}
	if strings.Contains(prompt, `"affection_delta"`) {
		t.Fatal("evaluation prompt still uses affection_delta")
	}
}

func TestNarrativeStateOverrideDetectsCrying(t *testing.T) {
	evaluation := TurnEvaluation{
		Emotion:       EvaluationEmotionSoft,
		AiState:       EvaluationAiStateWavering,
		TrustDelta:    TrustBoostValue,
		Confidence:    0.4,
		EndingType:    nil,
		PressureDelta: 0,
	}

	got := applyNarrativeStateOverrides(evaluation, "她终于哭了出来，肩膀轻轻发抖。")
	if got.AiState != EvaluationAiStateCrying {
		t.Fatalf("expected crying state, got %#v", got)
	}
	if got.Confidence < 0.8 {
		t.Fatalf("expected confidence floor after deterministic override, got %f", got.Confidence)
	}
}

func TestNarrativeStateOverrideIgnoresNegatedCrying(t *testing.T) {
	evaluation := TurnEvaluation{Emotion: EvaluationEmotionSting, AiState: EvaluationAiStateWavering, Confidence: 0.7}
	got := applyNarrativeStateOverrides(evaluation, "她没有哭，只是低头看着手机。")
	if got.AiState != EvaluationAiStateWavering {
		t.Fatalf("negated crying should not change state, got %#v", got)
	}
}

func TestParseTurnEvaluationClampsAndAcceptsOnlyNewEndings(t *testing.T) {
	ending := EndingRefusalType
	got, err := parseTurnEvaluation(`{
		"emotion":"angry",
		"ai_state":"bad-state",
		"trust_delta":7,
		"pressure_delta":9,
		"ending_type":"`+ending+`",
		"confidence":2
	}`, EvaluationAiStateWavering)
	if err != nil {
		t.Fatalf("parseTurnEvaluation returned error: %v", err)
	}

	if got.Emotion != EvaluationEmotionNormal {
		t.Fatalf("unexpected emotion: %s", got.Emotion)
	}
	if got.AiState != EvaluationAiStateWavering {
		t.Fatalf("unexpected ai state: %s", got.AiState)
	}
	if got.TrustDelta != TrustBoostValue {
		t.Fatalf("unexpected trust delta: %d", got.TrustDelta)
	}
	if got.PressureDelta != 2 {
		t.Fatalf("unexpected pressure delta: %d", got.PressureDelta)
	}
	if got.EndingType == nil || *got.EndingType != EndingRefusalType {
		t.Fatalf("expected refusal ending, got %#v", got.EndingType)
	}
	if got.Confidence != 1 {
		t.Fatalf("unexpected confidence: %f", got.Confidence)
	}
}

func TestParseTurnEvaluationRejectsRemovedEnding(t *testing.T) {
	got, err := parseTurnEvaluation(`{"emotion":"soft","ai_state":"crying","trust_delta":5,"ending_type":"end_death","confidence":0.9}`, EvaluationAiStateWatching)
	if err != nil {
		t.Fatalf("parseTurnEvaluation returned error: %v", err)
	}
	if got.EndingType != nil {
		t.Fatalf("removed ending should be rejected, got %v", *got.EndingType)
	}
}

func TestParseTurnEvaluationFallsBackOnMalformedJSON(t *testing.T) {
	got, err := parseTurnEvaluation("not json", EvaluationAiStateWavering)
	if err == nil {
		t.Fatal("expected parse error")
	}
	if got.Emotion != EvaluationEmotionNormal || got.AiState != EvaluationAiStateWavering || got.TrustDelta != 0 {
		t.Fatalf("unexpected fallback evaluation: %#v", got)
	}
}

func TestChatReturnsNaturalReplyAndStructuredTrustEvaluation(t *testing.T) {
	callCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/chat/completions" {
			t.Fatalf("unexpected endpoint: %s", r.URL.Path)
		}
		callCount++

		switch callCount {
		case 1:
			writeOpenAIContent(t, w, TrustBoostTag+"natural reply")
		case 2:
			writeOpenAIContent(t, w, `{
				"emotion":"soft",
				"ai_state":"watching",
				"trust_delta":5,
				"pressure_delta":1,
				"ending_type":null,
				"confidence":0.8
			}`)
		default:
			t.Fatalf("unexpected LLM call #%d", callCount)
		}
	}))
	defer server.Close()

	oldClient := httpClient
	httpClient = server.Client()
	defer func() { httpClient = oldClient }()

	result, err := Chat(ClientConfig{
		Provider: "custom",
		APIKey:   "test-key",
		Model:    "test-model",
		BaseURL:  server.URL,
	}, "hello", []Message{{Role: "assistant", Content: "opening"}}, 8, 0, 0, 1, EvaluationAiStateGuarded)
	if err != nil {
		t.Fatalf("Chat returned error: %v", err)
	}

	if result.Reply != "natural reply" {
		t.Fatalf("expected mechanic tags stripped, got %q", result.Reply)
	}
	if result.Evaluation.Emotion != EvaluationEmotionSoft ||
		result.Evaluation.AiState != EvaluationAiStateWatching ||
		result.Evaluation.TrustDelta != TrustBoostValue ||
		result.Evaluation.PressureDelta != 1 {
		t.Fatalf("unexpected evaluation: %#v", result.Evaluation)
	}
	if callCount != 2 {
		t.Fatalf("expected chat and evaluation calls, got %d", callCount)
	}
}

func TestChatFallsBackToSilentLineWhenReplyIsOnlyMechanicTags(t *testing.T) {
	callCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		switch callCount {
		case 1:
			writeOpenAIContent(t, w, AiStateWaveringTag+TrustBoostTag)
		case 2:
			writeOpenAIContent(t, w, `{"emotion":"normal","ai_state":"guarded","trust_delta":0,"pressure_delta":0,"ending_type":null,"confidence":0.7}`)
		default:
			t.Fatalf("unexpected LLM call #%d", callCount)
		}
	}))
	defer server.Close()

	oldClient := httpClient
	httpClient = server.Client()
	defer func() { httpClient = oldClient }()

	result, err := Chat(ClientConfig{
		Provider: "custom",
		APIKey:   "test-key",
		Model:    "test-model",
		BaseURL:  server.URL,
	}, "hello", nil, 8, 0, 0, 1, EvaluationAiStateGuarded)
	if err != nil {
		t.Fatalf("Chat returned error: %v", err)
	}
	if result.Reply != FallbackSilentReply {
		t.Fatalf("expected fallback silent reply, got %q", result.Reply)
	}
}

func TestEvaluateTurnSendsOnlyRecentHistoryAndTrustFields(t *testing.T) {
	var captured LLMRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
			t.Fatalf("failed to decode request: %v", err)
		}
		writeOpenAIContent(t, w, `{"emotion":"normal","ai_state":"guarded","trust_delta":0,"pressure_delta":0,"ending_type":null,"confidence":0.7}`)
	}))
	defer server.Close()

	oldClient := httpClient
	httpClient = server.Client()
	defer func() { httpClient = oldClient }()

	history := make([]Message, 0, 10)
	for i := 0; i < 10; i++ {
		role := "assistant"
		if i%2 == 1 {
			role = "user"
		}
		history = append(history, Message{Role: role, Content: fmt.Sprintf("line-%d", i)})
	}

	_, err := EvaluateTurn(ClientConfig{
		Provider: "custom",
		APIKey:   "test-key",
		Model:    "test-model",
		BaseURL:  server.URL,
	}, turnEvaluationPayload{
		History:        history,
		UserMessage:    "hello",
		AssistantReply: "natural reply",
		RoundsLeft:     8,
		Trust:          10,
		TrustGainCount: 2,
		CurrentAiState: EvaluationAiStateGuarded,
	})
	if err != nil {
		t.Fatalf("EvaluateTurn returned error: %v", err)
	}

	if len(captured.Messages) != 2 {
		t.Fatalf("unexpected judge messages: %#v", captured.Messages)
	}
	var payload turnEvaluationPayload
	if err := json.Unmarshal([]byte(captured.Messages[1].Content), &payload); err != nil {
		t.Fatalf("failed to decode judge payload: %v", err)
	}
	if len(payload.History) != evaluationHistoryWindow || payload.Trust != 10 || payload.TrustGainCount != 2 {
		t.Fatalf("unexpected judge payload: %#v", payload)
	}
	if payload.History[len(payload.History)-1].Content != "line-9" {
		t.Fatalf("expected most recent history to be kept, got %#v", payload.History)
	}
}

func TestChatFallsBackWhenEvaluatorFails(t *testing.T) {
	callCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		if callCount == 1 {
			writeOpenAIContent(t, w, "natural reply")
			return
		}
		writeOpenAIContent(t, w, "not json")
	}))
	defer server.Close()

	oldClient := httpClient
	httpClient = server.Client()
	defer func() { httpClient = oldClient }()

	result, err := Chat(ClientConfig{
		Provider: "custom",
		APIKey:   "test-key",
		Model:    "test-model",
		BaseURL:  server.URL,
	}, "hello", nil, 8, 0, 0, 1, EvaluationAiStateWatching)
	if err != nil {
		t.Fatalf("Chat should keep natural reply when evaluator fails, got error: %v", err)
	}
	if result.Reply != "natural reply" {
		t.Fatalf("unexpected reply: %s", result.Reply)
	}
	if result.Evaluation.Emotion != EvaluationEmotionNormal ||
		result.Evaluation.AiState != EvaluationAiStateWatching ||
		result.Evaluation.TrustDelta != 0 ||
		result.Evaluation.EndingType != nil {
		t.Fatalf("unexpected fallback evaluation: %#v", result.Evaluation)
	}
}

func TestAfterStoryPromptIncludesResolvedTrustContext(t *testing.T) {
	prompt := buildAfterStorySystemPrompt(AfterStoryContext{
		EndingType:     EndingSafeExitType,
		LastPlayerLine: "last line",
		EndingReply:    "ending reply",
		TurningLine:    "turning line",
		EndingComment:  "ending comment",
		RoundsUsed:     9,
		TrustGainCount: 5,
		Trust:          26,
	})

	for _, item := range []string{EndingSafeExitType, "last line", "ending reply", "turning line", "ending comment", "9", "5", "26", "现实中的支持者"} {
		if !strings.Contains(prompt, item) {
			t.Fatalf("expected after-story prompt to contain %q", item)
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
	defer func() { httpClient = oldClient }()

	reply, err := callLLM(ClientConfig{
		Provider: "claude",
		APIKey:   "test-key",
		Model:    "claude-test",
		BaseURL:  server.URL,
	}, []Message{{Role: "system", Content: "system prompt"}, {Role: "user", Content: "hello"}}, 0.4)
	if err != nil {
		t.Fatalf("callLLM returned error: %v", err)
	}
	if reply != "ok" || captured.Model != "claude-test" || captured.System != "system prompt" {
		t.Fatalf("unexpected Anthropic request/response: reply=%q request=%#v", reply, captured)
	}
}

func TestCallAnthropicLLMPrependsPlaceholderUserWhenHistoryStartsWithAssistant(t *testing.T) {
	var captured AnthropicRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
			t.Fatalf("failed to decode request: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"content":[{"type":"text","text":"ok"}]}`))
	}))
	defer server.Close()

	oldClient := httpClient
	httpClient = server.Client()
	defer func() { httpClient = oldClient }()

	_, err := callLLM(ClientConfig{Provider: "claude", APIKey: "test-key", Model: "claude-test", BaseURL: server.URL}, []Message{
		{Role: "system", Content: "system prompt"},
		{Role: "assistant", Content: "opening line"},
		{Role: "user", Content: "hello"},
	}, 0.4)
	if err != nil {
		t.Fatalf("callLLM returned error: %v", err)
	}
	if len(captured.Messages) != 3 || captured.Messages[0].Role != "user" || captured.Messages[0].Content != "（游戏开始）" {
		t.Fatalf("expected placeholder user message, got %#v", captured.Messages)
	}
}

func TestStripKnownMechanicTagsRemovesNewVariants(t *testing.T) {
	cases := map[string]string{
		"[状态：动摇]她低下头。":               "她低下头。",
		"[信任度 +5]【结局：拒绝离开】她看着你。":     "她看着你。",
		AiStateWaveringTag + "她沉默。":  "她沉默。",
		TrustBoostTag + "你听见了。":      "你听见了。",
		EndingSafeExitTag + "我们下楼吧。": "我们下楼吧。",
		"（她指了指手机）里面的消息，我还没看完。":       "（她指了指手机）里面的消息，我还没看完。",
	}

	for input, want := range cases {
		if got := stripKnownMechanicTags(input); got != want {
			t.Fatalf("stripKnownMechanicTags(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestStripKnownMechanicTagsKeepsPunctuationOnlyReply(t *testing.T) {
	got := stripKnownMechanicTags("（……？？）")
	if got != "（……？？）" {
		t.Fatalf("punctuation-only reply should not be emptied, got %q", got)
	}
}

func TestStripKnownMechanicTagsStillRemovesNoiseLinesFromMultiLineReply(t *testing.T) {
	got := stripKnownMechanicTags("？？？？\n她低下头。")
	if got != "她低下头。" {
		t.Fatalf("noise line should be removed from multi-line reply, got %q", got)
	}
}

func TestCustomProviderRequiresExplicitEndpointAndModel(t *testing.T) {
	_, err := callLLM(ClientConfig{Provider: "custom", APIKey: "test-key"}, []Message{{Role: "user", Content: "hello"}}, 0.4)
	if err == nil || !strings.Contains(err.Error(), "base_url") {
		t.Fatalf("expected custom base_url error, got %v", err)
	}

	_, err = callLLM(ClientConfig{Provider: "custom", APIKey: "test-key", BaseURL: "https://example.com/v1"}, []Message{{Role: "user", Content: "hello"}}, 0.4)
	if err == nil || !strings.Contains(err.Error(), "model") {
		t.Fatalf("expected custom model error, got %v", err)
	}
}
