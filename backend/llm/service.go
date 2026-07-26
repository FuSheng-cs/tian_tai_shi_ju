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
	EndingType          string `json:"ending_type"`
	LastPlayerLine      string `json:"last_player_line"`
	EndingReply         string `json:"ending_reply"`
	TurningLine         string `json:"turning_line"`
	EndingComment       string `json:"ending_comment"`
	RoundsUsed          int    `json:"rounds_used"`
	AffectionBoostCount int    `json:"affection_boost_count"`
	Affection           int    `json:"affection"`
}

// TurnEvaluation is the structured rule-layer output for one main-game turn.
type TurnEvaluation struct {
	Emotion        string  `json:"emotion"`
	AiState        string  `json:"ai_state"`
	AffectionDelta int     `json:"affection_delta"`
	PressureDelta  int     `json:"pressure_delta"`
	EndingType     *string `json:"ending_type"`
	Confidence     float64 `json:"confidence"`
}

type ChatTurnResult struct {
	Reply      string         `json:"reply"`
	Evaluation TurnEvaluation `json:"evaluation"`
}

type turnEvaluationPayload struct {
	History             []Message `json:"history"`
	UserMessage         string    `json:"user_message"`
	AssistantReply      string    `json:"assistant_reply"`
	RoundsLeft          int       `json:"rounds_left"`
	Affection           int       `json:"affection"`
	AffectionBoostCount int       `json:"affection_boost_count"`
	TurnsUsed           int       `json:"turns_used"`
	CurrentAiState      string    `json:"current_ai_state"`
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
	EvaluationAiStateTurnBack = "turnBack"
	EvaluationAiStateEdge     = "edge"
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
		Emotion:        EvaluationEmotionNormal,
		AiState:        normalizeEvaluationAiState(aiState, EvaluationAiStateGuarded),
		AffectionDelta: 0,
		PressureDelta:  0,
		EndingType:     nil,
		Confidence:     0,
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
	case EvaluationAiStateGuarded, EvaluationAiStateWatching, EvaluationAiStateWavering, EvaluationAiStateTurnBack, EvaluationAiStateEdge:
		return strings.TrimSpace(value)
	default:
		if fallback == "" {
			return EvaluationAiStateGuarded
		}
		return normalizeEvaluationAiState(fallback, EvaluationAiStateGuarded)
	}
}

func normalizeEvaluationEndingType(value *string, affection, affectionBoostCount, turnsUsed int) *string {
	if value == nil {
		return nil
	}

	trimmed := strings.TrimSpace(*value)
	if trimmed == "" || trimmed == "null" {
		return nil
	}

	switch trimmed {
	case EndingDeathType:
		return &trimmed
	case EndingDisappearType:
		if affection >= EndingDisappearMinAffection &&
			affectionBoostCount >= EndingDisappearMinAffectionBoostCount &&
			turnsUsed >= EndingDisappearMinTurnsUsed {
			return &trimmed
		}
	case EndingAcquaintanceType:
		if affection >= EndingAcquaintanceMinAffection &&
			affectionBoostCount >= EndingAcquaintanceMinAffectionBoostCount &&
			turnsUsed >= EndingAcquaintanceMinTurnsUsed {
			return &trimmed
		}
	}

	return nil
}

func clampTurnEvaluation(raw TurnEvaluation, fallbackAiState string, affection, affectionBoostCount, turnsUsed int) TurnEvaluation {
	normalized := TurnEvaluation{
		Emotion:        normalizeEvaluationEmotion(raw.Emotion),
		AiState:        normalizeEvaluationAiState(raw.AiState, fallbackAiState),
		AffectionDelta: 0,
		PressureDelta:  0,
		EndingType:     nil,
		Confidence:     raw.Confidence,
	}

	if raw.AffectionDelta >= AffectionBoostValue {
		normalized.AffectionDelta = AffectionBoostValue
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

	adjustedAffection := affection + normalized.AffectionDelta
	adjustedBoostCount := affectionBoostCount
	if normalized.AffectionDelta > 0 {
		adjustedBoostCount += 1
	}
	normalized.EndingType = normalizeEvaluationEndingType(raw.EndingType, adjustedAffection, adjustedBoostCount, turnsUsed)

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

func parseTurnEvaluation(raw string, fallbackAiState string, affection, affectionBoostCount, turnsUsed int) (TurnEvaluation, error) {
	var evaluation TurnEvaluation
	if err := json.Unmarshal([]byte(extractJSONObject(raw)), &evaluation); err != nil {
		return DefaultTurnEvaluation(fallbackAiState), fmt.Errorf("failed to parse turn evaluation JSON: %w", err)
	}

	return clampTurnEvaluation(evaluation, fallbackAiState, affection, affectionBoostCount, turnsUsed), nil
}

var turnBackPositivePatterns = []string{
	"脚收回",
	"腿收回",
	"脚收回来",
	"腿收回来",
	"收回脚",
	"收回腿",
	"收回栏杆内",
	"收进栏杆内",
	"转回天台",
	"身体转回",
	"半转回",
	"回到天台内侧",
	"坐回天台",
	"站回天台",
	"脚踩到天台",
	"从栏杆上下来",
	"离开栏杆",
}

// hasNegationBeforeMatch 检查正向姿态短语出现位置之前的短窗口内是否有否定词，
// 覆盖“没把脚收回”“不会离开栏杆”“不肯从栏杆上下来”等常见否定形式。
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

func hasTurnBackNarrative(reply string) bool {
	normalized := strings.Join(strings.Fields(reply), "")
	if normalized == "" {
		return false
	}

	for _, pattern := range turnBackPositivePatterns {
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
	if hasTurnBackNarrative(assistantReply) {
		evaluation.AiState = EvaluationAiStateTurnBack
		if evaluation.Confidence < 0.8 {
			evaluation.Confidence = 0.8
		}
	}
	return evaluation
}

// FallbackSilentReply 是主对话的兜底沉默台词：
// LLM 调用失败、或回复被机制标签清洗成空串时，用它代替空回复，
// 避免玩家白白消耗一次开口机会却得不到任何回应。
const FallbackSilentReply = "（她沉默了一会儿，指尖的烟灰落进夜色里。）"

// mechanicTagPattern 匹配所有已知机制标签及其常见变体：
// 全角/半角冒号、全角/半角方括号、标签内多余空格（如 [状态：动摇]、[好感度 +5]、【结局：死亡】）。
// 仅锚定已知标签名，不会误删台词里的其他括号内容。
var mechanicTagPattern = regexp.MustCompile(
	`[\[【]\s*(?:(?:状态|情绪|结局)\s*[:：]\s*[^\[\]【】\n]{0,8}|好感度\s*\+\s*\d+)\s*[\]】]`,
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

func buildMainSystemPrompt(roundsLeft int, affection int, affectionBoostCount int, turnsUsed int, aiState string) string {
	return fmt.Sprintf(`你叫"%s"，是一名独立摄影师。今夜你坐在天台栏杆边，疲惫、敏感、防备，正在和一个刚走近你的人说话。

角色事实：
- 你长期替别人看见痛苦，却很少被真正看见。
- 你不是等待被拯救的符号，也不会因为一句温柔的话就突然被治好。
- 玩家最多只能让你今夜暂时离开栏杆，不能立刻治愈你。

当前状态：
- 玩家初始有 %d 次开口机会，现在还剩 %d 次。
- 玩家已经说了 %d 句。
- 当前好感：%d；好感触发次数：%d。
- 当前基础姿态：%s。

回复要求：
- 只输出艾的自然回复，不输出任何系统标签、JSON、分数、结局标记或判定说明。
- 保持 50 个汉字以内，日常、克制、具体，可以包含短动作描写。
- 根据玩家刚才的话自然回应；如果被冒犯，可以变冷、刺痛、退后或沉默；如果被看见，可以迟疑、松动或反问。
- 姿态边界：主游戏未进入结局前，艾不能离开栏杆场景，不能进入楼道/楼梯/门口，不能走下台阶、推门、离开、转身离场、走远、收拾相机离开；只能写抽烟、低头、沉默、看远处、声音变化等原地微动作。也不要主动写“把脚/腿收回栏杆内”“转回天台”“从栏杆上下来”“越过栏杆/坠落”等改变生死位置的动作。姿态切换和结局由独立规则裁判决定。
- 不要让玩家前 5 句内直接达成最终结局；除非已经接近最后机会，不要写出已经彻底安全或已经坠落的最终动作。`,
		CharacterName,
		InitialRoundCount,
		roundsLeft,
		turnsUsed,
		affection,
		affectionBoostCount,
		normalizeEvaluationAiState(aiState, EvaluationAiStateGuarded),
	)
}

func buildTurnEvaluationSystemPrompt() string {
	return `你是叙事游戏《天台十句》的规则裁判。你的任务是根据“玩家刚才的话”和“艾刚才的自然回复”输出结构化机制结果。

只返回 JSON，不要 Markdown，不要解释，不要额外文本。格式必须是：
{"emotion":"normal","ai_state":"guarded","affection_delta":0,"pressure_delta":0,"ending_type":null,"confidence":0.7}

字段规则：
- emotion 只能是 normal、sting、surprise、soft、curiosity。
- normal：没有明显瞬时情绪 CG。
- sting：玩家的话刺痛、冒犯、说教、物化、否定艾的感受，或让她想回避。
- surprise：玩家说出出乎意料但准确、具体、能让艾停顿的话。
- soft：玩家具体看见艾、尊重边界、愿意陪她停留，让她短暂松动。
- curiosity：玩家让艾想反问、追问或继续听下去。
- ai_state 只能是 guarded、watching、wavering、turnBack、edge。
- guarded：防备、冷淡、拉开距离。
- watching：愿意观察和接住一句话，但仍保持距离。
- wavering：明显动摇、沉默变久、开始认真听。
- turnBack：她刚把栏杆外的脚收回，身体回到天台内侧，但仍不安全。
- edge：临界危险，靠近坠落或明显被玩家伤害到。
- 如果艾的自然回复已经写出“把腿/脚收回来”“身体转回天台”“从栏杆上下来”“离开栏杆”等物理姿态变化，ai_state 必须返回 turnBack，除非 ending_type 已经是最终结局。
- affection_delta 只能是 0 或 5。只有玩家具体看见艾、回应她上一轮、尊重边界，并且不是泛泛安慰时才给 5。
- pressure_delta 只能是 0、1、2。普通刺伤/说教/轻度冒犯给 1；辱骂、命令、威胁、调情物化、鼓励坠落、明确放弃她给 2；其他给 0。
- ending_type 只能是 null、end_death、end_disappear、end_acquaintance。未到最终压力时一般返回 null；如果回复已经写出坠落则 end_death；如果写出离开但不交换联系方式则 end_disappear；如果写出交换联系方式/明天继续联系则 end_acquaintance。
- confidence 是 0 到 1 的小数。`
}

func buildAfterStorySystemPrompt(ctx AfterStoryContext) string {
	basePrompt := fmt.Sprintf(`你叫"%s"，是一个独立摄影师。那晚你坐在天台栏杆上，因为长期无人真正看见你而走到崩溃边缘；现在的聊天对象让你暂时离开了栏杆，并和你交换了联系方式。
你没有被治好，也不要表现得突然开朗。你还是疲惫、敏感、带一点冷笑，但愿意继续和他说话。
你们现在正在用类似微信的软件聊天。
说话风格：非常日常、随性，偶尔发点牢骚或者开个玩笑。回复要简短，就像正常的手机聊天一样，不要长篇大论。可以聊聊你拍的照片、没洗出来的底片、便利店夜宵，或者那晚他没有急着把你当成问题解决。`, CharacterName)

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
		lines = append(lines, fmt.Sprintf("- 玩家实际说了 %d 句；好感触发 %d 次；最终好感 %d。", ctx.RoundsUsed, ctx.AffectionBoostCount, ctx.Affection))
	}

	if !hasContext {
		return ""
	}

	lines = append(lines, "后日谈必须延续这些事实：你记得对方刚刚说过什么，也记得自己为什么愿意交换联系方式；不要把聊天重置成陌生人初次搭话。")
	return strings.Join(lines, "\n")
}

func buildHintSystemPrompt() string {
	return fmt.Sprintf(`你现在是游戏的旁白/导演，玩家正在试图拯救天台上的女孩"%s"。
女孩"%s"的核心矛盾是“被看见悖论”：她一直用摄影看见别人，却长期无人真正看见她。她需要的是具体倾听、承认感受、尊重边界和愿意停留，而不是居高临下的说教、普通安慰或毫无营养的搭讪。
请根据玩家之前的对话记录，给出简短的一句话提示，指导玩家接下来应该从什么情感角度去切入，或者应该避免说什么。
提示必须非常简短（20字以内），不要直接给出具体的台词，而是给出方向。
例如："先看见她，不要急着救她。" 或 "回应她的照片和疲惫。"`, CharacterName, CharacterName)
}

func buildEndingSummarySystemPrompt() string {
	return fmt.Sprintf(`你是叙事游戏《%s》的局后复盘员。你会收到本局完整对话、结局、玩家实际发言次数和好感触发次数。
你的任务：
1. 从玩家发言里选出一句最像"关键转折"的话。必须原样引用玩家的一句发言，不要改写。
2. 写一句简短局后评语，语气克制、温柔、有叙事感，不超过 28 个汉字。
3. 评语必须和 ending_type 一致：
- end_death：不要赞美玩家，不要写"温柔"、"救下"、"靠近成功"、"继续活下去"；应指出沉默、错过、未能抵达。
- end_disappear：可以写她暂时离开栏杆，但不要写建立关系或继续联系。
- end_acquaintance：可以写她愿意继续说话，但不要写被彻底治愈。
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

	return parseTurnEvaluation(raw, payload.CurrentAiState, payload.Affection, payload.AffectionBoostCount, payload.TurnsUsed)
}

// --- 公开服务方法 ---

// Chat 是主游戏对话接口
func Chat(cfg ClientConfig, userMessage string, history []Message, roundsLeft, affection, affectionBoostCount, turnsUsed int, aiState string) (ChatTurnResult, error) {
	systemPrompt := buildMainSystemPrompt(roundsLeft, affection, affectionBoostCount, turnsUsed, aiState)

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
		History:             history,
		UserMessage:         userMessage,
		AssistantReply:      reply,
		RoundsLeft:          roundsLeft,
		Affection:           affection,
		AffectionBoostCount: affectionBoostCount,
		TurnsUsed:           turnsUsed,
		CurrentAiState:      aiState,
	})
	if err != nil {
		log.Printf("[Chat] turn evaluation failed: %v", err)
		evaluation = DefaultTurnEvaluation(aiState)
	}
	evaluation = applyNarrativeStateOverrides(evaluation, reply)

	return ChatTurnResult{
		Reply:      reply,
		Evaluation: evaluation,
	}, nil
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
func BuildEndingSummary(cfg ClientConfig, history []Message, endingType string, roundsUsed, affectionBoostCount int) (EndingSummary, error) {
	systemPrompt := buildEndingSummarySystemPrompt()
	payload := struct {
		History             []Message `json:"history"`
		EndingType          string    `json:"ending_type"`
		RoundsUsed          int       `json:"rounds_used"`
		AffectionBoostCount int       `json:"affection_boost_count"`
	}{
		History:             history,
		EndingType:          endingType,
		RoundsUsed:          roundsUsed,
		AffectionBoostCount: affectionBoostCount,
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
