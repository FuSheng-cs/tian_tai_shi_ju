package llm

import (
	"encoding/json"
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
				"message": map[string]string{
					"content": content,
				},
			},
		},
	}); err != nil {
		t.Fatalf("failed to write OpenAI response: %v", err)
	}
}

func TestBuildMainSystemPromptDoesNotAskForMechanicTags(t *testing.T) {
	prompt := buildMainSystemPrompt(3, 25, 5, 7, EvaluationAiStateWavering)

	forbidden := []string{
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
		EndingDeathTag,
		EndingDisappearTag,
		EndingAcquaintanceTag,
	}

	for _, item := range forbidden {
		if strings.Contains(prompt, item) {
			t.Fatalf("main prompt should not contain mechanic tag %q", item)
		}
	}
	if !strings.Contains(prompt, CharacterName) {
		t.Fatal("main prompt should keep the character name")
	}
	if !strings.Contains(prompt, "JSON") {
		t.Fatal("main prompt should explicitly forbid JSON output")
	}
	requiredBoundaries := []string{
		"姿态边界",
		"主游戏未进入结局前",
		"不能离开栏杆场景",
		"楼道/楼梯/门口",
		"走下台阶",
		"推门",
		"转身离场",
		"走远",
		"收拾相机离开",
		"原地微动作",
		"把脚/腿收回栏杆内",
	}
	for _, item := range requiredBoundaries {
		if !strings.Contains(prompt, item) {
			t.Fatalf("main prompt should keep physical posture boundary %q", item)
		}
	}
}

func TestTurnEvaluationPromptDefinesStructuredJudgeOnly(t *testing.T) {
	prompt := buildTurnEvaluationSystemPrompt()

	required := []string{
		`"emotion"`,
		`"ai_state"`,
		`"affection_delta"`,
		`"pressure_delta"`,
		`"ending_type"`,
		EvaluationEmotionNormal,
		EvaluationEmotionSting,
		EvaluationEmotionSurprise,
		EvaluationEmotionSoft,
		EvaluationEmotionCuriosity,
		EvaluationAiStateGuarded,
		EvaluationAiStateWatching,
		EvaluationAiStateWavering,
		EvaluationAiStateTurnBack,
		EvaluationAiStateEdge,
		"物理姿态变化",
		"ai_state 必须返回 turnBack",
	}

	for _, item := range required {
		if !strings.Contains(prompt, item) {
			t.Fatalf("evaluation prompt missing %q", item)
		}
	}
}

func TestNarrativeStateOverrideForcesTurnBackOnRecoveryAction(t *testing.T) {
	evaluation := TurnEvaluation{
		Emotion:        EvaluationEmotionSoft,
		AiState:        EvaluationAiStateWavering,
		AffectionDelta: AffectionBoostValue,
		PressureDelta:  0,
		EndingType:     nil,
		Confidence:     0.4,
	}

	got := applyNarrativeStateOverrides(evaluation, "（把腿收回来一些，但还坐在栏杆上）呵...这倒是新鲜。")

	if got.AiState != EvaluationAiStateTurnBack {
		t.Fatalf("expected recovery action to force turnBack, got %#v", got)
	}
	if got.Confidence < 0.8 {
		t.Fatalf("expected confidence floor after deterministic override, got %f", got.Confidence)
	}
}

func TestNarrativeStateOverrideKeepsStateWhenRecoveryActionIsNegated(t *testing.T) {
	evaluation := TurnEvaluation{
		Emotion:    EvaluationEmotionSting,
		AiState:    EvaluationAiStateEdge,
		Confidence: 0.7,
	}

	got := applyNarrativeStateOverrides(evaluation, "她没有把脚收回来，只是看着楼下。")

	if got.AiState != EvaluationAiStateEdge {
		t.Fatalf("negated recovery action should not force turnBack, got %#v", got)
	}
}

func TestParseTurnEvaluationClampsInvalidFields(t *testing.T) {
	ending := EndingAcquaintanceType
	got, err := parseTurnEvaluation(`{
		"emotion":"angry",
		"ai_state":"bad-state",
		"affection_delta":7,
		"pressure_delta":9,
		"ending_type":"`+ending+`",
		"confidence":2
	}`, EvaluationAiStateWavering, 0, 0, 2)
	if err != nil {
		t.Fatalf("parseTurnEvaluation returned error: %v", err)
	}

	if got.Emotion != EvaluationEmotionNormal {
		t.Fatalf("unexpected emotion: %s", got.Emotion)
	}
	if got.AiState != EvaluationAiStateWavering {
		t.Fatalf("unexpected ai state: %s", got.AiState)
	}
	if got.AffectionDelta != AffectionBoostValue {
		t.Fatalf("unexpected affection delta: %d", got.AffectionDelta)
	}
	if got.PressureDelta != 2 {
		t.Fatalf("unexpected pressure delta: %d", got.PressureDelta)
	}
	if got.EndingType != nil {
		t.Fatalf("ending should be rejected below thresholds, got %v", *got.EndingType)
	}
	if got.Confidence != 1 {
		t.Fatalf("unexpected confidence: %f", got.Confidence)
	}
}

func TestParseTurnEvaluationAllowsThresholdEndingAfterAffectionDelta(t *testing.T) {
	got, err := parseTurnEvaluation(`{
		"emotion":"soft",
		"ai_state":"turnBack",
		"affection_delta":5,
		"pressure_delta":0,
		"ending_type":"end_acquaintance",
		"confidence":0.9
	}`, EvaluationAiStateWatching, 20, 4, 7)
	if err != nil {
		t.Fatalf("parseTurnEvaluation returned error: %v", err)
	}

	if got.EndingType == nil || *got.EndingType != EndingAcquaintanceType {
		t.Fatalf("expected acquaintance ending, got %#v", got.EndingType)
	}
	if got.Emotion != EvaluationEmotionSoft || got.AiState != EvaluationAiStateTurnBack {
		t.Fatalf("unexpected evaluation: %#v", got)
	}
}

func TestParseTurnEvaluationFallsBackOnMalformedJSON(t *testing.T) {
	got, err := parseTurnEvaluation("not json", EvaluationAiStateEdge, 0, 0, 1)
	if err == nil {
		t.Fatal("expected parse error")
	}
	if got.Emotion != EvaluationEmotionNormal || got.AiState != EvaluationAiStateEdge || got.PressureDelta != 0 {
		t.Fatalf("unexpected fallback evaluation: %#v", got)
	}
}

func TestChatReturnsNaturalReplyAndStructuredEvaluation(t *testing.T) {
	callCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/chat/completions" {
			t.Fatalf("unexpected endpoint: %s", r.URL.Path)
		}
		callCount++

		switch callCount {
		case 1:
			writeOpenAIContent(t, w, AffectionBoostTag+"natural reply")
		case 2:
			writeOpenAIContent(t, w, `{
				"emotion":"soft",
				"ai_state":"watching",
				"affection_delta":5,
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
	defer func() {
		httpClient = oldClient
	}()

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
		result.Evaluation.AffectionDelta != AffectionBoostValue ||
		result.Evaluation.PressureDelta != 1 {
		t.Fatalf("unexpected evaluation: %#v", result.Evaluation)
	}
	if callCount != 2 {
		t.Fatalf("expected chat and evaluation calls, got %d", callCount)
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
	defer func() {
		httpClient = oldClient
	}()

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
		result.Evaluation.PressureDelta != 0 ||
		result.Evaluation.EndingType != nil {
		t.Fatalf("unexpected fallback evaluation: %#v", result.Evaluation)
	}
}

func TestAfterStoryPromptIncludesResolvedEndingContext(t *testing.T) {
	prompt := buildAfterStorySystemPrompt(AfterStoryContext{
		EndingType:          EndingAcquaintanceType,
		LastPlayerLine:      "last line",
		EndingReply:         "ending reply",
		TurningLine:         "turning line",
		EndingComment:       "ending comment",
		RoundsUsed:          9,
		AffectionBoostCount: 5,
		Affection:           26,
	})

	required := []string{
		EndingAcquaintanceType,
		"last line",
		"ending reply",
		"turning line",
		"ending comment",
		"9",
		"5",
		"26",
	}

	for _, item := range required {
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
