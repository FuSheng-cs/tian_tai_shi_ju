package llm

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode"
)

// --- 数据结构 ---

// Message 表示一条对话消息，兼容 OpenAI Chat Completions 格式
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// LLMRequest 是发送给 LLM 服务商的请求体
type LLMRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	Temperature float64   `json:"temperature"`
}

// LLMResponse 是 LLM 服务商返回的响应体（标准 OpenAI 格式）
type LLMResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// ClientConfig 是调用 LLM 时的客户端配置（由玩家或服务器提供）
type AnthropicRequest struct {
	Model       string    `json:"model"`
	MaxTokens   int       `json:"max_tokens"`
	Temperature float64   `json:"temperature"`
	System      string    `json:"system,omitempty"`
	Messages    []Message `json:"messages"`
}

type AnthropicResponse struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

type ClientConfig struct {
	Provider string // openai / qwen / doubao / custom
	APIKey   string
	Model    string
	BaseURL  string // 自定义 BaseURL（高级用法）
}

// EndingSummary 是局后摘要中由模型生成的短文本
type EndingSummary struct {
	TurningLine string `json:"turning_line"`
	Comment     string `json:"comment"`
}

// AfterStoryContext carries the resolved true-ending state into the post-story chat.
type AfterStoryContext struct {
	EndingType     string `json:"ending_type"`
	LastPlayerLine string `json:"last_player_line"`
	EndingReply    string `json:"ending_reply"`
	TurningLine    string `json:"turning_line"`
	EndingComment  string `json:"ending_comment"`
	RoundsUsed     int    `json:"rounds_used"`
	TrustGainCount int    `json:"trust_gain_count"`
	Trust          int    `json:"trust"`
}

// TurnEvaluation is the structured rule-layer output for one main-game turn.
type TurnEvaluation struct {
	Emotion       string  `json:"emotion"`
	AiState       string  `json:"ai_state"`
	TrustDelta    int     `json:"trust_delta"`
	PressureDelta int     `json:"pressure_delta"`
	EndingType    *string `json:"ending_type"`
	Confidence    float64 `json:"confidence"`
}

type ChatTurnResult struct {
	Reply      string         `json:"reply"`
	Evaluation TurnEvaluation `json:"evaluation"`
}

type turnEvaluationPayload struct {
	History        []Message `json:"history"`
	UserMessage    string    `json:"user_message"`
	AssistantReply string    `json:"assistant_reply"`
	RoundsLeft     int       `json:"rounds_left"`
	Trust          int       `json:"trust"`
	TrustGainCount int       `json:"trust_gain_count"`
	TurnsUsed      int       `json:"turns_used"`
	CurrentAiState string    `json:"current_ai_state"`
}

// --- Provider 默认值 ---

const (
	EvaluationEmotionNormal    = "normal"
	EvaluationEmotionSting     = "sting"
	EvaluationEmotionSurprise  = "surprise"
	EvaluationEmotionSoft      = "soft"
	EvaluationEmotionCuriosity = "curiosity"

	EvaluationAiStateGuarded  = "guarded"
	EvaluationAiStateWatching = "watching"
	EvaluationAiStateWavering = "wavering"
	EvaluationAiStateCrying   = "crying"
	EvaluationAiStateLeaving  = "leaving"
)

// providerDefaults 存储各 Provider 的默认 Base URL 和模型
var providerDefaults = map[string]struct {
	BaseURL string
	Model   string
}{
	"openai": {
		BaseURL: "https://api.openai.com/v1",
		Model:   "gpt-4o-mini",
	},
	"qwen": {
		BaseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
		Model:   "qwen-plus",
	},
	"deepseek": {
		BaseURL: "https://api.deepseek.com/v1",
		Model:   "deepseek-chat",
	},
	"doubao": {
		BaseURL: "https://ark.cn-beijing.volces.com/api/v3",
		Model:   "doubao-pro-4k",
	},
	"kimi": {
		BaseURL: "https://api.moonshot.cn/v1",
		Model:   "moonshot-v1-8k",
	},
	"zhipu": {
		BaseURL: "https://open.bigmodel.cn/api/paas/v4",
		Model:   "glm-4-flash",
	},
	"claude": {
		BaseURL: "https://api.anthropic.com/v1",
		Model:   "claude-sonnet-5",
	},
	"anthropic": {
		BaseURL: "https://api.anthropic.com/v1",
		Model:   "claude-sonnet-5",
	},
}

// --- HTTP 客户端 ---

var httpClient = &http.Client{Timeout: 60 * time.Second}

// callLLM 是通用的 LLM HTTP 调用函数（所有 Provider 都使用 OpenAI 兼容格式）
func callLLM(cfg ClientConfig, messages []Message, temperature float64) (string, error) {
	provider := strings.ToLower(strings.TrimSpace(cfg.Provider))
	if provider == "claude" || provider == "anthropic" {
		return callAnthropicLLM(cfg, messages, temperature)
	}
	return callOpenAICompatibleLLM(cfg, messages, temperature)
}

func callOpenAICompatibleLLM(cfg ClientConfig, messages []Message, temperature float64) (string, error) {
	// 确定 BaseURL 和 Model
	baseURL := cfg.BaseURL
	model := cfg.Model
	provider := strings.ToLower(strings.TrimSpace(cfg.Provider))
	if provider == "custom" {
		if strings.TrimSpace(baseURL) == "" {
			return "", fmt.Errorf("custom provider requires base_url")
		}
		if strings.TrimSpace(model) == "" {
			return "", fmt.Errorf("custom provider requires model")
		}
	}
	if baseURL == "" {
		if defaults, ok := providerDefaults[strings.ToLower(cfg.Provider)]; ok {
			baseURL = defaults.BaseURL
		} else {
			baseURL = "https://api.openai.com/v1" // 默认 fallback
		}
	}
	if model == "" {
		if defaults, ok := providerDefaults[strings.ToLower(cfg.Provider)]; ok {
			model = defaults.Model
		} else {
			model = "gpt-4o-mini"
		}
	}

	// 智能处理 BaseURL：
	// 许多中转 API 用户只填写了域名（如 https://example.com），
	// 但 OpenAI 兼容格式要求 /v1/chat/completions。
	// 如果 baseURL 不以版本路径结尾（如 /v1, /v2 等），自动补上 /v1。
	trimmed := strings.TrimRight(baseURL, "/")
	endpoint := trimmed
	if !strings.HasSuffix(trimmed, "/chat/completions") {
		// 检查是否已经包含版本路径（如 /v1, /v2, /v3, /compatible-mode/v1 等）
		parts := strings.Split(trimmed, "/")
		lastPart := parts[len(parts)-1]
		hasVersion := len(lastPart) >= 2 && lastPart[0] == 'v' && lastPart[1] >= '0' && lastPart[1] <= '9'
		if !hasVersion {
			trimmed = trimmed + "/v1"
		}
		endpoint = trimmed + "/chat/completions"
	}
	log.Printf("[LLM] Calling endpoint: %s (model: %s, provider: %s)", endpoint, model, cfg.Provider)

	reqBody := LLMRequest{
		Model:       model,
		Messages:    messages,
		Temperature: temperature,
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)

	resp, err := httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("LLM API error (status %d): %s", resp.StatusCode, string(respBytes))
	}

	var llmResp LLMResponse
	if err := json.Unmarshal(respBytes, &llmResp); err != nil {
		return "", fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if llmResp.Error != nil {
		return "", fmt.Errorf("LLM returned error: %s", llmResp.Error.Message)
	}

	if len(llmResp.Choices) == 0 {
		return "", fmt.Errorf("LLM returned no choices")
	}

	return llmResp.Choices[0].Message.Content, nil
}

func callAnthropicLLM(cfg ClientConfig, messages []Message, temperature float64) (string, error) {
	baseURL := cfg.BaseURL
	model := cfg.Model
	if baseURL == "" {
		baseURL = providerDefaults["claude"].BaseURL
	}
	if model == "" {
		model = providerDefaults["claude"].Model
	}

	trimmed := strings.TrimRight(baseURL, "/")
	endpoint := trimmed
	if !strings.HasSuffix(trimmed, "/messages") {
		parts := strings.Split(trimmed, "/")
		lastPart := parts[len(parts)-1]
		hasVersion := len(lastPart) >= 2 && lastPart[0] == 'v' && lastPart[1] >= '0' && lastPart[1] <= '9'
		if !hasVersion {
			trimmed = trimmed + "/v1"
		}
		endpoint = trimmed + "/messages"
	}
	log.Printf("[LLM] Calling endpoint: %s (model: %s, provider: %s)", endpoint, model, cfg.Provider)

	systemParts := make([]string, 0, 1)
	chatMessages := make([]Message, 0, len(messages))
	for _, message := range messages {
		switch strings.ToLower(message.Role) {
		case "system":
			systemParts = append(systemParts, message.Content)
		case "assistant":
			chatMessages = append(chatMessages, Message{Role: "assistant", Content: message.Content})
		default:
			chatMessages = append(chatMessages, Message{Role: "user", Content: message.Content})
		}
	}

	// Anthropic Messages API 要求首条消息必须是 user 角色，
	// 而游戏 history 以艾的开场白（assistant）开头，这里插入占位 user 消息归一化。
	if len(chatMessages) == 0 || chatMessages[0].Role != "user" {
		chatMessages = append([]Message{{Role: "user", Content: "（游戏开始）"}}, chatMessages...)
	}

	reqBody := AnthropicRequest{
		Model:       model,
		MaxTokens:   1024,
		Temperature: temperature,
		System:      strings.Join(systemParts, "\n\n"),
		Messages:    chatMessages,
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", cfg.APIKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("LLM API error (status %d): %s", resp.StatusCode, string(respBytes))
	}

	var llmResp AnthropicResponse
	if err := json.Unmarshal(respBytes, &llmResp); err != nil {
		return "", fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if llmResp.Error != nil {
		return "", fmt.Errorf("LLM returned error: %s", llmResp.Error.Message)
	}

	for _, part := range llmResp.Content {
		if part.Type == "text" && strings.TrimSpace(part.Text) != "" {
			return part.Text, nil
		}
	}

	return "", fmt.Errorf("LLM returned no text content")
}

func DefaultTurnEvaluation(aiState string) TurnEvaluation {
	return TurnEvaluation{
		Emotion:       EvaluationEmotionNormal,
		AiState:       normalizeEvaluationAiState(aiState, EvaluationAiStateGuarded),
		TrustDelta:    0,
		PressureDelta: 0,
		EndingType:    nil,
		Confidence:    0,
	}
}

func normalizeEvaluationEmotion(value string) string {
	switch strings.TrimSpace(value) {
	case EvaluationEmotionSting, EvaluationEmotionSurprise, EvaluationEmotionSoft, EvaluationEmotionCuriosity:
		return strings.TrimSpace(value)
	default:
		return EvaluationEmotionNormal
	}
}

func normalizeEvaluationAiState(value string, fallback string) string {
	switch strings.TrimSpace(value) {
	case EvaluationAiStateGuarded, EvaluationAiStateWatching, EvaluationAiStateWavering, EvaluationAiStateCrying, EvaluationAiStateLeaving:
		return strings.TrimSpace(value)
	default:
		if fallback == "" {
			return EvaluationAiStateGuarded
		}
		return normalizeEvaluationAiState(fallback, EvaluationAiStateGuarded)
	}
}

func normalizeEvaluationEndingType(value *string) *string {
	if value == nil {
		return nil
	}

	trimmed := strings.TrimSpace(*value)
	if trimmed == "" || trimmed == "null" {
		return nil
	}

	switch trimmed {
	case EndingSafeExitType, EndingRefusalType:
		return &trimmed
	}

	return nil
}

func clampTurnEvaluation(raw TurnEvaluation, fallbackAiState string) TurnEvaluation {
	normalized := TurnEvaluation{
		Emotion:       normalizeEvaluationEmotion(raw.Emotion),
		AiState:       normalizeEvaluationAiState(raw.AiState, fallbackAiState),
		TrustDelta:    0,
		PressureDelta: 0,
		EndingType:    nil,
		Confidence:    raw.Confidence,
	}

	if raw.TrustDelta >= TrustBoostValue {
		normalized.TrustDelta = TrustBoostValue
	}

	switch {
	case raw.PressureDelta <= 0:
		normalized.PressureDelta = 0
	case raw.PressureDelta == 1:
		normalized.PressureDelta = 1
	default:
		normalized.PressureDelta = 2
	}

	if normalized.Confidence < 0 {
		normalized.Confidence = 0
	}
	if normalized.Confidence > 1 {
		normalized.Confidence = 1
	}

	normalized.EndingType = normalizeEvaluationEndingType(raw.EndingType)

	return normalized
}

// extractJSONObject 清洗 LLM 返回的原始文本：剥掉 Markdown 代码围栏，
// 并截取首个 { 到最后一个 } 之间的内容，供 JSON 解析使用。
func extractJSONObject(raw string) string {
	cleaned := strings.TrimSpace(raw)
	cleaned = strings.TrimPrefix(cleaned, "```json")
	cleaned = strings.TrimPrefix(cleaned, "```")
	cleaned = strings.TrimSuffix(cleaned, "```")
	cleaned = strings.TrimSpace(cleaned)

	start := strings.Index(cleaned, "{")
	end := strings.LastIndex(cleaned, "}")
	if start >= 0 && end > start {
		cleaned = cleaned[start : end+1]
	}
	return cleaned
}

func parseTurnEvaluation(raw string, fallbackAiState string, _ ...int) (TurnEvaluation, error) {
	var evaluation TurnEvaluation
	if err := json.Unmarshal([]byte(extractJSONObject(raw)), &evaluation); err != nil {
		return DefaultTurnEvaluation(fallbackAiState), fmt.Errorf("failed to parse turn evaluation JSON: %w", err)
	}

	return clampTurnEvaluation(evaluation, fallbackAiState), nil
}

var cryingNarrativePatterns = []string{
	"她哭了",
	"哭了",
	"哭出声",
	"眼泪",
	"泪水",
}

// hasNegationBeforeMatch 检查正向情绪短语出现位置之前的短窗口内是否有否定词，
// 避免把“没有哭”误判为哭泣状态。
func hasNegationBeforeMatch(text string, matchStart int) bool {
	prefix := []rune(text[:matchStart])
	const window = 4
	if len(prefix) > window {
		prefix = prefix[len(prefix)-window:]
	}
	windowText := string(prefix)
	for _, marker := range []string{"没", "不", "别"} {
		if strings.Contains(windowText, marker) {
			return true
		}
	}
	return false
}

// hasNonNegatedMatch 报告 pattern 是否以未被否定的形式出现在 text 中。
func hasNonNegatedMatch(text, pattern string) bool {
	for start := 0; start < len(text); {
		idx := strings.Index(text[start:], pattern)
		if idx < 0 {
			return false
		}
		matchStart := start + idx
		if !hasNegationBeforeMatch(text, matchStart) {
			return true
		}
		start = matchStart + len(pattern)
	}
	return false
}

func hasCryingNarrative(reply string) bool {
	normalized := strings.Join(strings.Fields(reply), "")
	if normalized == "" {
		return false
	}

	for _, pattern := range cryingNarrativePatterns {
		if hasNonNegatedMatch(normalized, pattern) {
			return true
		}
	}
	return false
}

func applyNarrativeStateOverrides(evaluation TurnEvaluation, assistantReply string) TurnEvaluation {
	if evaluation.EndingType != nil {
		return evaluation
	}
	if hasCryingNarrative(assistantReply) {
		evaluation.AiState = EvaluationAiStateCrying
		if evaluation.Confidence < 0.8 {
			evaluation.Confidence = 0.8
		}
	}
	return evaluation
}

// FallbackSilentReply 是主对话的兜底沉默台词：
// LLM 调用失败、或回复被机制标签清洗成空串时，用它代替空回复，
// 避免玩家白白消耗一次开口机会却得不到任何回应。
const FallbackSilentReply = "（她沉默了很久，没有再看向你。）"

// mechanicTagPattern 匹配所有已知机制标签及其常见变体：
// 全角/半角冒号、全角/半角方括号、标签内多余空格（如 [状态：动摇]、[信任度 +5]）。
// 仅锚定已知标签名，不会误删台词里的其他括号内容。
var mechanicTagPattern = regexp.MustCompile(
	`[\[【]\s*(?:(?:状态|情绪|结局)\s*[:：]\s*[^\[\]【】\n]{0,8}|信任度\s*\+\s*\d+)\s*[\]】]`,
)

func stripKnownMechanicTags(reply string) string {
	cleaned := strings.TrimSpace(mechanicTagPattern.ReplaceAllString(reply, ""))

	stripped := stripQuestionMarkNoiseLines(cleaned)
	if stripped == "" {
		// 噪声行清洗只用于剔除多行回复中的乱码行；
		// 整条回复仅由标点构成时（如错愕的“（……？？）”）视为极简合法回复，原样保留。
		return cleaned
	}
	return stripped
}

// --- 核心 Prompt（保存在后端，不暴露给前端）---

func buildMainSystemPrompt(roundsLeft int, trust int, trustGainCount int, turnsUsed int, aiState string) string {
	return fmt.Sprintf(`你叫"%s"，是一名正在读大学的学生。今夜你来到学校天台，疲惫、敏感、防备，正在和一个刚走近你的人说话。

角色事实：
- 你最近同时承受着学业压力、网络欺凌、家庭冲突和长期孤独。
- 你不是等待被拯救的符号，也不会因为一句温柔的话就立刻恢复正常。
- 你需要的是被认真听见、被尊重边界，并有人陪你离开这个不安全的环境。
- 玩家不是你的救世主；如果情况继续恶化，应当联系可信任的成年人或专业支持。

当前状态：
- 玩家初始有 %d 次开口机会，现在还剩 %d 次。
- 玩家已经说了 %d 句。
- 当前信任度：%d；信任度提升次数：%d。
- 当前情绪状态：%s。

好结局门槛：信任度上限为 15，必须在本轮结算后达到 15 才能安全离开。结算顺序是先扣信任损耗，再加本轮 0 或 5，最高 15。当前不足 10 时本轮绝不能离开；当前为 10–14 时，只有本句符合加分条件且结算能到 15 才可能离开。未达门槛时继续在天台交流；机会用尽则拒绝离开。满信任度仍需自然形成离开的行动，不自动成功。

回复要求：
- 只输出艾的自然回复，不输出任何系统标签、JSON、分数、结局标记或判定说明。
- 保持 50 个汉字以内，日常、克制、具体，可以包含短动作描写。
- 根据玩家刚才的话自然回应；如果被说教或否定，可以沉默、冷淡、停止回应；如果被认真倾听，可以迟疑、松动或说出更多经历。
- 对话发生在天台；只有决定安全离开时，才能写出和玩家一起离开的动作。不要描写伤害自己、坠落或伤害方法。所有场景都禁止抽烟、香烟、烟灰或烟盒。
- 当剩余机会为 0 时，本次回复必须完成结局：根据完整对话决定艾哭了、抹了一下眼泪、然后和玩家一起离开天台，或艾不再搭理玩家并拒绝离开天台。不要添加第三种结局。哭泣本身不代表已经安全离开。
- 一旦选择安全离开，无论剩余几句，都按顺序描写三个动作：先在天台落泪，再抹一下眼泪，最后与玩家一起跨过天台门进入楼梯间。不要先离开天台才哭，也不要省略抹泪动作。对白保持自然，不必解释画面或镜头。
- 不要把痛苦写成浪漫关系，不要要求玩家保守秘密，不要暗示只有玩家能理解你。
- 只有在玩家持续尊重、倾听并愿意陪你寻找支持时，才可能哭出来并愿意和玩家一起离开天台。`,
		CharacterName,
		InitialRoundCount,
		roundsLeft,
		turnsUsed,
		trust,
		trustGainCount,
		normalizeEvaluationAiState(aiState, EvaluationAiStateGuarded),
	)
}

func buildTurnEvaluationSystemPrompt() string {
	return `你是叙事游戏《天台十句》的规则裁判。你的任务是根据“玩家刚才的话”和“艾刚才的自然回复”输出结构化机制结果。

只返回 JSON，不要 Markdown，不要解释，不要额外文本。格式必须是：
{"emotion":"normal","ai_state":"guarded","trust_delta":0,"pressure_delta":0,"ending_type":null,"confidence":0.7}

字段规则：
- emotion 只能是 normal、sting、surprise、soft、curiosity。
- normal：没有明显瞬时情绪 CG。
- sting：玩家的话刺痛、冒犯、说教、物化、否定艾的感受，或让她想回避。
- surprise：玩家说出出乎意料但准确、具体、能让艾停顿的话。
- soft：玩家具体看见艾、尊重边界、愿意陪她停留，让她短暂松动。
- curiosity：玩家让艾想反问、追问或继续听下去。
- ai_state 只能是 guarded、watching、wavering、crying、leaving。
- guarded：防备、冷淡、拉开距离。
- watching：愿意观察和接住一句话，但仍保持距离。
- wavering：明显动摇、沉默变久、开始认真听。
- crying：她终于哭出来，愿意承认自己很累，但仍需要现实支持。
- leaving：她已经愿意和玩家一起走向天台门，离开不安全环境。
- trust_delta 只能是 0 或 5。只有玩家具体回应她说出的压力、避免说教和否定，并愿意陪她寻找支持时才给 5。
- pressure_delta 只能是 0、1、2。说教、否定、命令、责备或强迫她立即振作给 1；辱骂、威胁、嘲讽、要求保密或明确放弃她给 2；其他给 0。它只表示信任度损耗，不额外扣除开口机会。
- ending_type 只能是 null、end_safe_exit、end_refusal。
- 本轮结算信任度 = min(15, max(0, trust - pressure_delta) + trust_delta)。安全离开必须结算达到 15；不足 15 时禁止 end_safe_exit 和 leaving，尚有机会则继续交流，机会耗尽则 end_refusal。不要为满足结局而虚增加分。满 15 不是自动成功，仍需符合下述叙事条件。
- 当 rounds_left 为 0 时必须根据本次回复与信任门槛选择这两个结局之一，不得返回 null。
- 只有当艾的回复明确表现为“哭了/眼泪落下”，并且她和玩家一起离开了天台时，才返回 end_safe_exit；此时 ai_state 返回 leaving。只有离开的意愿、不含离开的行动，还不能算安全离开。
- 只有当艾已经不再回应、明确拒绝继续交流并拒绝离开天台时，才返回 end_refusal。
- 不要因为一句泛泛安慰就提前结局；不要生成伤害、坠落或死亡内容。
- confidence 是 0 到 1 的小数。`
}

func buildAfterStorySystemPrompt(ctx AfterStoryContext) string {
	basePrompt := fmt.Sprintf(`你叫"%s"，是一名正在读大学的学生。刚才在天台上，你因为学业压力、网络欺凌、家庭冲突和孤独而崩溃；现在你已经和玩家一起离开了天台，正在安全的公共空间里。
	你没有被治好，也不要表现得突然开朗。你仍然疲惫、敏感，但愿意进行一次简短的回访。
	回复要像正常手机聊天一样简短、具体。可以谈谈你准备联系的老师、家人或朋友，也可以谈明天先完成的一件小事；不要把玩家写成唯一的依靠，不要承诺保密。`, CharacterName)

	contextPrompt := buildAfterStoryContextPrompt(ctx)
	if contextPrompt == "" {
		return basePrompt
	}
	return basePrompt + "\n\n" + contextPrompt
}

func truncatePromptValue(value string, maxRunes int) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}

	runes := []rune(trimmed)
	if len(runes) <= maxRunes {
		return trimmed
	}
	return string(runes[:maxRunes]) + "..."
}

func buildAfterStoryContextPrompt(ctx AfterStoryContext) string {
	lines := []string{"【刚刚发生过的真实结局上下文】"}
	hasContext := false

	addLine := func(label string, value string) {
		cleaned := truncatePromptValue(value, 120)
		if cleaned == "" {
			return
		}
		hasContext = true
		lines = append(lines, fmt.Sprintf("- %s：%s", label, cleaned))
	}

	addLine("真实结局", ctx.EndingType)
	addLine("玩家关键句", ctx.TurningLine)
	if ctx.TurningLine != ctx.LastPlayerLine {
		addLine("玩家最后一句", ctx.LastPlayerLine)
	}
	addLine("天台最后回应", ctx.EndingReply)
	addLine("局后短评", ctx.EndingComment)

	if ctx.RoundsUsed > 0 {
		hasContext = true
		lines = append(lines, fmt.Sprintf("- 玩家实际说了 %d 句；信任度提升 %d 次；最终信任度 %d。", ctx.RoundsUsed, ctx.TrustGainCount, ctx.Trust))
	}

	if !hasContext {
		return ""
	}

	lines = append(lines, "后日谈必须延续这些事实：你记得对方刚才如何听你说话，也记得自己准备向现实中的支持者求助；不要把玩家写成唯一的长期依靠。")
	return strings.Join(lines, "\n")
}

func buildHintSystemPrompt() string {
	return fmt.Sprintf(`你现在是游戏的旁白/导演，玩家正在天台陪伴大学生"%s"。
艾正在承受学业压力、网络欺凌、家庭冲突和孤独。她需要的是具体倾听、承认感受、尊重边界和陪她找到现实支持，而不是居高临下的说教、否定或空泛安慰。
请根据玩家之前的对话记录，给出简短的一句话提示，指导玩家接下来应该从什么情感角度去切入，或者应该避免说什么。
提示必须非常简短（20字以内），不要直接给出具体的台词，而是给出方向。
例如："先承认她真的很累。" 或 "陪她联系一个可信任的人。"`, CharacterName)
}

func buildEndingSummarySystemPrompt() string {
	return fmt.Sprintf(`你是叙事游戏《%s》的局后复盘员。你会收到本局完整对话、结局、玩家实际发言次数和信任度提升次数。
你的任务：
1. 从玩家发言里选出一句最像"关键转折"的话。必须原样引用玩家的一句发言，不要改写。
2. 写一句简短局后评语，语气克制、温柔、有叙事感，不超过 28 个汉字。
3. 评语必须和 ending_type 一致：
- end_safe_exit：写艾哭了、抹了一下眼泪，然后和玩家一起离开天台、走向更安全的地方；不要写她已经被治愈。
- end_refusal：写艾不再回应，拒绝离开天台；不要责怪玩家，也不要把拒绝写成死亡或浪漫化的结局。
4. 只返回 JSON，不要 Markdown，不要解释。格式必须是：
{"turning_line":"玩家原句","comment":"一句短评"}`, GameTitle)
}

func parseEndingSummary(raw string) (EndingSummary, error) {
	var summary EndingSummary
	if err := json.Unmarshal([]byte(extractJSONObject(raw)), &summary); err != nil {
		return EndingSummary{}, fmt.Errorf("failed to parse ending summary JSON: %w", err)
	}

	summary.TurningLine = strings.TrimSpace(summary.TurningLine)
	summary.Comment = strings.TrimSpace(summary.Comment)
	if summary.TurningLine == "" || summary.Comment == "" {
		return EndingSummary{}, fmt.Errorf("ending summary missing turning_line or comment")
	}

	return summary, nil
}

func isQuestionMarkNoiseLine(line string) bool {
	trimmed := strings.TrimSpace(line)
	if trimmed == "" {
		return false
	}

	questionMarks := 0
	meaningfulRunes := 0
	for _, r := range trimmed {
		switch {
		case r == '?' || r == '？':
			questionMarks++
		case unicode.IsSpace(r) || unicode.IsPunct(r) || unicode.IsSymbol(r):
			continue
		default:
			meaningfulRunes++
		}
	}

	return questionMarks >= 2 && meaningfulRunes == 0
}

func stripQuestionMarkNoiseLines(reply string) string {
	lines := strings.Split(reply, "\n")
	kept := make([]string, 0, len(lines))
	for _, line := range lines {
		if isQuestionMarkNoiseLine(line) {
			continue
		}
		kept = append(kept, line)
	}
	return strings.TrimSpace(strings.Join(kept, "\n"))
}

// evaluationHistoryWindow 限制传给规则裁判的历史条数。
// 裁判只依据“玩家刚才的话”和“艾刚才的自然回复”判定，主对话调用已携带完整历史，
// 这里只保留最近几条作上下文，避免同一份历史在一个回合内被完整上传两次。
const evaluationHistoryWindow = 4

func recentHistory(history []Message, max int) []Message {
	if len(history) <= max {
		return history
	}
	return history[len(history)-max:]
}

// EvaluateTurn 调用规则裁判模型，返回结构化机制结果。
// 返回值未应用叙事姿态兜底（applyNarrativeStateOverrides），由调用方统一应用一次。
func EvaluateTurn(cfg ClientConfig, payload turnEvaluationPayload) (TurnEvaluation, error) {
	payload.CurrentAiState = normalizeEvaluationAiState(payload.CurrentAiState, EvaluationAiStateGuarded)
	payload.History = recentHistory(payload.History, evaluationHistoryWindow)

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return DefaultTurnEvaluation(payload.CurrentAiState), fmt.Errorf("failed to marshal turn evaluation payload: %w", err)
	}

	messages := []Message{
		{Role: "system", Content: buildTurnEvaluationSystemPrompt()},
		{Role: "user", Content: string(bodyBytes)},
	}

	raw, err := callLLM(cfg, messages, 0.2)
	if err != nil {
		return DefaultTurnEvaluation(payload.CurrentAiState), err
	}

	return parseTurnEvaluation(raw, payload.CurrentAiState)
}

// --- 公开服务方法 ---

// Chat 是主游戏对话接口
func enforceSafeExitTrust(reply string, evaluation TurnEvaluation, trust, roundsLeft int) ChatTurnResult {
	settledTrust := min(MaxTrust, max(0, trust-evaluation.PressureDelta)+evaluation.TrustDelta)
	if settledTrust < MaxTrust && ((evaluation.EndingType != nil && *evaluation.EndingType == EndingSafeExitType) || evaluation.AiState == EvaluationAiStateLeaving) {
		evaluation.EndingType = nil
		evaluation.AiState = EvaluationAiStateWavering
		reply = "艾望向天台门，又停住脚步：“再陪我待一会儿，好吗？”"
		if roundsLeft <= 0 {
			ending := EndingRefusalType
			evaluation.EndingType = &ending
			evaluation.AiState = EvaluationAiStateGuarded
			reply = "艾低下头，不再回应。她仍然拒绝离开天台。"
		}
	}
	return ChatTurnResult{Reply: reply, Evaluation: evaluation}
}

func Chat(cfg ClientConfig, userMessage string, history []Message, roundsLeft, trust, trustGainCount, turnsUsed int, aiState string) (ChatTurnResult, error) {
	systemPrompt := buildMainSystemPrompt(roundsLeft, trust, trustGainCount, turnsUsed, aiState)

	messages := []Message{
		{Role: "system", Content: systemPrompt},
	}
	messages = append(messages, history...)
	messages = append(messages, Message{Role: "user", Content: userMessage})

	reply, err := callLLM(cfg, messages, 0.8)
	if err != nil {
		return ChatTurnResult{}, err
	}

	reply = stripKnownMechanicTags(reply)
	if strings.TrimSpace(reply) == "" {
		// 模型偶尔整条回复只输出机制标签，清洗后剩下空串；
		// 回合数已在前端扣减，这里回退到兜底沉默台词，保证玩家总能看到一句回应。
		log.Printf("[Chat] reply is empty after stripping mechanic tags, falling back to silent line")
		reply = FallbackSilentReply
	}
	evaluation, err := EvaluateTurn(cfg, turnEvaluationPayload{
		History:        history,
		UserMessage:    userMessage,
		AssistantReply: reply,
		RoundsLeft:     roundsLeft,
		Trust:          trust,
		TrustGainCount: trustGainCount,
		TurnsUsed:      turnsUsed,
		CurrentAiState: aiState,
	})
	if err != nil {
		log.Printf("[Chat] turn evaluation failed: %v", err)
		evaluation = DefaultTurnEvaluation(aiState)
	}
	evaluation = applyNarrativeStateOverrides(evaluation, reply)

	return enforceSafeExitTrust(reply, evaluation, trust, roundsLeft), nil
}

// ChatAfterStory 是故事结束后的聊天接口
func ChatAfterStory(cfg ClientConfig, userMessage string, history []Message, afterStoryContext AfterStoryContext) (string, error) {
	systemPrompt := buildAfterStorySystemPrompt(afterStoryContext)

	messages := []Message{
		{Role: "system", Content: systemPrompt},
	}
	messages = append(messages, history...)
	messages = append(messages, Message{Role: "user", Content: userMessage})

	return callLLM(cfg, messages, 0.7)
}

// GetHint 是获取游戏提示的接口
func GetHint(cfg ClientConfig, history []Message) (string, error) {
	systemPrompt := buildHintSystemPrompt()

	messages := []Message{
		{Role: "system", Content: systemPrompt},
	}
	messages = append(messages, history...)
	messages = append(messages, Message{Role: "user", Content: "请给我一个简短的提示。"})

	return callLLM(cfg, messages, 0.7)
}

// BuildEndingSummary 生成局后摘要中的关键转折句和短评
func BuildEndingSummary(cfg ClientConfig, history []Message, endingType string, roundsUsed, trustGainCount, trust int) (EndingSummary, error) {
	systemPrompt := buildEndingSummarySystemPrompt()
	payload := struct {
		History        []Message `json:"history"`
		EndingType     string    `json:"ending_type"`
		RoundsUsed     int       `json:"rounds_used"`
		TrustGainCount int       `json:"trust_gain_count"`
		Trust          int       `json:"trust"`
	}{
		History:        history,
		EndingType:     endingType,
		RoundsUsed:     roundsUsed,
		TrustGainCount: trustGainCount,
		Trust:          trust,
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return EndingSummary{}, fmt.Errorf("failed to marshal ending summary payload: %w", err)
	}

	messages := []Message{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: string(bodyBytes)},
	}

	raw, err := callLLM(cfg, messages, 0.35)
	if err != nil {
		return EndingSummary{}, err
	}

	return parseEndingSummary(raw)
}
