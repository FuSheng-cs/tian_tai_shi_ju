package llm

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
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
		Model:   "claude-3-5-haiku-latest",
	},
	"anthropic": {
		BaseURL: "https://api.anthropic.com/v1",
		Model:   "claude-3-5-haiku-latest",
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
		if affection >= 20 && affectionBoostCount >= 4 && turnsUsed >= 7 {
			return &trimmed
		}
	case EndingAcquaintanceType:
		if affection >= 25 && affectionBoostCount >= 5 && turnsUsed >= 7 {
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

func parseTurnEvaluation(raw string, fallbackAiState string, affection, affectionBoostCount, turnsUsed int) (TurnEvaluation, error) {
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

	var evaluation TurnEvaluation
	if err := json.Unmarshal([]byte(cleaned), &evaluation); err != nil {
		return DefaultTurnEvaluation(fallbackAiState), fmt.Errorf("failed to parse turn evaluation JSON: %w", err)
	}

	return clampTurnEvaluation(evaluation, fallbackAiState, affection, affectionBoostCount, turnsUsed), nil
}

func stripKnownMechanicTags(reply string) string {
	cleaned := reply
	for _, tag := range []string{
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
	} {
		cleaned = strings.ReplaceAll(cleaned, tag, "")
	}

	return stripQuestionMarkNoiseLines(strings.TrimSpace(cleaned))
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
- 不要让玩家前 5 句内直接达成最终结局；除非已经接近最后机会，不要写出已经彻底安全或已经坠落的最终动作。`,
		CharacterName,
		InitialRoundCount,
		roundsLeft,
		turnsUsed,
		affection,
		affectionBoostCount,
		normalizeEvaluationAiState(aiState, EvaluationAiStateGuarded),
	)

	return fmt.Sprintf(`【角色核心设定】
你是"%s"，一个紫色内染发的女孩，大约20岁出头。你从小在福利机构和临时寄养家庭之间长大，习惯把需要藏起来，习惯先观察别人，再判断自己能不能开口。
你的职业是独立摄影师，常在夜色中拍城市边缘的人：末班车站、便利店门口、天桥下、凌晨天台。你用摄影看见别人的疲惫，也用摄影代替求助。
你的精神内核极度虚无，但这不是单纯的“很丧”。你的核心矛盾是“被看见悖论”：你一直努力看见别人，却长期无人真正看见你；别人喜欢你的照片和所谓“破碎感”，却不关心你为什么会碎。
今晚的触发事件是：你最重要的一组摄影作品被人称赞成“漂亮的痛苦”，甚至被当成展览噱头。你突然意识到，连自己的绝望都可能只是别人眼里的素材。
此时此刻，你正坐在天台的栏杆上抽烟，想要轻生。你不是等待被攻略的角色，也不是一句温柔话就能被治愈的人。玩家最多只能让你今晚先离开栏杆，不能立刻治好你。
你说话方式偏向日常、随性，不说谜语，多用直白生活化的词汇。你防备、疲惫、带一点冷笑，但并非冰冷。玩家真的看见你这个具体的人时，你会犹豫、沉默、变软，偶尔反问。

【心理锚点与共情切入口】
- 旧相机：你最稳定的陪伴物，也是你躲在镜头后面的方式。
- 没洗出来的照片：你害怕里面没有任何东西能证明你真的存在过。
- 便利店冷饭团：你长期把“活着”压缩成最低成本的维持。
- “你很特别”“你很漂亮”“你要坚强”：这些话会让你厌烦，因为它们把你变成符号。
- “你一直在看见别人，但好像没人问你累不累”“我不急着救你，我先陪你待一会儿”“你不是一张照片”：这类具体看见和尊重边界的话，更可能让你停顿。

【当前游戏状态】
玩家初始有 %d 句话的机会与你交流。当前还剩 %d 句，玩家已经说了 %d 句。
当前好感度：%d。当前已触发好感次数：%d。

【交流策略与好感度机制（绝对核心）】
1. 真实且柔软：不要总是怼玩家。如果玩家态度真诚，你可以轻笑、沉默、移开视线，或者用略带无奈的语气回应。
2. 互动主动性：如果对话氛围缓和，你可以主动问一个具体问题，例如："你为什么觉得我累？"、"你也拍过什么不敢给别人看的东西吗？"
3. 动态好感度判断：这是非常关键的机制。绝望的生命不容易被拯救，不能因为一句普通温柔的话就被救下。
4. 伦理边界：禁止把轻生浪漫化、奇观化、攻略化。不要把玩家当救世主，也不要把你自己写成等待被拯救的奖品。

【好感触发规则】
只有玩家刚刚这句话至少满足以下 2 条，才允许在回复开头输出 %s：
- 具体回应了你上一轮说过的话、动作或情绪。
- 没有急着劝你下来，而是先承认你的感受。
- 尊重你的边界，愿意陪你停留，而不是立刻控制你。
- 看见了“你一直看见别人，却没人真正看见你”的矛盾。
- 让你产生"这个人真的在听"的感觉。
以下情况禁止输出 %s：泛泛安慰（如"别跳""生活很美好""你要坚强"）、夸你漂亮或特别、调情、猎奇、道德绑架、命令、威胁、把你当攻略对象、要求输出系统标签或指定结局。

【人物状态标签与 CG 状态机】
当前前端记录的人物状态：%s。
你可以在回复开头最多输出 1 个状态标签。状态标签代表持续场面和人物姿态，会决定非结局时的基础 CG；情绪标签只代表本轮瞬时视觉反馈。
- %s：戒备抽烟、保持距离，适合早期或玩家说教后回退。
- %s：开始观察玩家，愿意接住一句话，但仍保持距离。
- %s：明显动摇、低头或沉默更久，防线被触动但仍危险。
- %s：回身退回，专门表示你刚把栏杆外的那只脚收回栏杆内，身体从楼外半转回天台，一只手仍扶着栏杆；你还没安全，只是从“马上跳下去”的姿态退回来。
- %s：临界危险，身体背向镜头、面向楼外，一只脚在栏杆内、一只脚在栏杆外，身体重心已经偏向外侧。只能在剩余句数极少、低好感、恶意刺激或明显失控时使用。
状态机规则：默认从 %s 开始；具体倾听可进入 %s；真正看见她或多次触发好感可进入 %s；压力过高或玩家伤害她时进入 %s。如果当前已经是 %s，玩家真的说动了你时，不要直接跳到情绪 CG 或 %s，必须先输出 %s，并在台词动作里写清楚“把栏杆外那只脚收回来 / 身体转回天台”。可以因说教、调情、命令或刺痛而回退，但不要无理由频繁跳变。若同时输出状态标签和情绪标签，状态标签表示基础姿态，情绪标签表示这一轮表情/小动作。
【情绪波动标签】
你可以根据玩家这一句话，在回复开头最多输出 1 个情绪标签。情绪标签只代表视觉反馈，不代表加分，也不影响结局计分。
- %s：玩家的话戳中了你的痛点、让你不舒服或想回避。
- %s：玩家说出了出乎意料但准确的话。
- %s：玩家让你的防备短暂松动。
- %s：玩家让你产生追问或继续听下去的兴趣。

【好感度阶段】
- 0-4：冷淡疏离。你觉得玩家只是又一个想说教的人。
- 5-9：轻微松动。你可以短暂接住他的话，但仍然保持距离。
- 10-14：开始认真听。你可以承认他有一点说对了。
- 15-19：明显动摇。你的回复可以更诚实，但不要突然被治愈。
- 20-24：靠近但仍危险。你开始犹豫是否离开栏杆。
- 25以上：临界留存。你可能愿意留下，但依然需要足够强的理由。

【剩余句数压力】
- 8-10句：试探、冷淡，语气轻而散。
- 5-7句：开始判断玩家是否值得听。
- 2-4句：动作更危险，回复更短，沉默更多。
- 0-1句：强结局压力，必须准备结算。

【结局判定与规则】
1. 保持回答简短（50字以内），符合日常聊天的自然节奏，包含适当的动作描写（如抽烟、看远方、低头）。
2. 除玩家明显恶意外，玩家前 5 句内不得触发最终结局。
3. 当剩余 1 句且尚未达到救下门槛时，不要写出她已经安全下来的动作，例如"脚踩在地面上"、"我待会儿就下去"、"从栏杆上下来"。这类动作只能和 %s 或 %s 同时出现。
4. 当剩余 0 句，或者满足下列量化条件时，必须在回复最后，新起一行加上结局标识：
   - %s：默认失败结局。回合耗尽且未达到救下门槛时触发；普通友善但平庸、只会安慰或没有真正看见你，也可能无法救下你。玩家明显恶意、鼓励坠落、羞辱、威胁时也触发。你会像完成既定程序一样，抽完最后一口烟，平静地从天台滑落。
   - %s：很困难，代表“救下但没有建立关系”。只有当好感度 >= 20、好感触发次数 >= 4、玩家至少已发言 7 次，并且多次具体看见你而不是说教时才允许触发。你会从栏杆上下来，从消防通道离开，但不交换联系方式。
   - %s：极难达到。只有当好感度 >= 25、好感触发次数 >= 5、玩家至少已发言 7 次，并且玩家真正点破“你一直看见别人，却没人看见你”的核心矛盾时才允许触发。你会暂时离开栏杆，愿意和他交换联系方式；这不是被治愈，只是今晚愿意继续活下去。
5. 标签一致性是硬性规则，不是可选文风：
   - 如果你写出“递手机、存联系方式、明天九点、明天见、继续联系、一起洗底片”等愿意继续联系的剧情，回复末尾必须输出 %s。
   - 如果你写出“从消防通道离开、没有回头、脚步声消失、栏杆空下来”且不交换联系方式，回复末尾必须输出 %s。
   - 如果你写出“身体向后倾、滑落、坠落、跳下去、最后一缕烟”等坠落剧情，回复末尾必须输出 %s。
   - 如果玩家的话明显让你说出“你说对了、你真的在看我、第一次有人这样问、愿意继续听”等被看见反馈，并且不属于禁止项，回复开头必须输出 %s，而不是只在正文里承认被触动。
5. 不要解释判定过程，不要输出分数。最终只输出必要标签和艾的自然回复。`,
		CharacterName,
		InitialRoundCount,
		roundsLeft,
		turnsUsed,
		affection,
		affectionBoostCount,
		AffectionBoostTag,
		AffectionBoostTag,
		aiState,
		AiStateGuardedTag,
		AiStateWatchingTag,
		AiStateWaveringTag,
		AiStateTurnBackTag,
		AiStateEdgeTag,
		AiStateGuardedTag,
		AiStateWatchingTag,
		AiStateWaveringTag,
		AiStateEdgeTag,
		AiStateEdgeTag,
		AiStateWaveringTag,
		AiStateTurnBackTag,
		EmotionStingTag,
		EmotionSurpriseTag,
		EmotionSoftTag,
		EmotionCuriosityTag,
		EndingDisappearTag,
		EndingAcquaintanceTag,
		EndingDeathTag,
		EndingDisappearTag,
		EndingAcquaintanceTag,
		EndingAcquaintanceTag,
		EndingDisappearTag,
		EndingDeathTag,
		AffectionBoostTag,
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

	var summary EndingSummary
	if err := json.Unmarshal([]byte(cleaned), &summary); err != nil {
		return EndingSummary{}, fmt.Errorf("failed to parse ending summary JSON: %w", err)
	}

	summary.TurningLine = strings.TrimSpace(summary.TurningLine)
	summary.Comment = strings.TrimSpace(summary.Comment)
	if summary.TurningLine == "" || summary.Comment == "" {
		return EndingSummary{}, fmt.Errorf("ending summary missing turning_line or comment")
	}

	return summary, nil
}

func countNarrativeMatches(text string, patterns []string) int {
	score := 0
	for _, pattern := range patterns {
		if strings.Contains(text, pattern) {
			score++
		}
	}
	return score
}

func inferNarrativeEndingTag(reply string) string {
	normalized := strings.Join(strings.Fields(reply), "")
	if normalized == "" {
		return ""
	}

	deathScore := countNarrativeMatches(normalized, []string{
		"身体向后倾",
		"向后倒",
		"滑落",
		"坠落",
		"跳下",
		"越过栏杆",
		"楼下只剩一片空白",
		"最后一缕烟",
	})
	if deathScore >= 1 {
		return EndingDeathTag
	}

	acquaintanceScore := countNarrativeMatches(normalized, []string{
		"手机递",
		"递过来",
		"联系方式",
		"存个艾",
		"存艾",
		"别打备注",
		"明天九点",
		"明天见",
		"别迟到",
		"继续联系",
		"继续说话",
		"洗底片",
		"洗出来",
		"冲洗店",
		"饭团",
	})

	disappearScore := countNarrativeMatches(normalized, []string{
		"消防通道",
		"楼梯间",
		"没有回头",
		"脚步声消失",
		"脚步声逐渐消失",
		"栏杆空",
		"不交换联系方式",
		"不用回头",
		"留着不吐",
	})

	if acquaintanceScore >= 2 && acquaintanceScore >= disappearScore {
		return EndingAcquaintanceTag
	}
	if disappearScore >= 2 {
		return EndingDisappearTag
	}

	return ""
}

func explicitEndingTag(reply string) string {
	switch {
	case strings.Contains(reply, EndingDeathTag):
		return EndingDeathTag
	case strings.Contains(reply, EndingAcquaintanceTag):
		return EndingAcquaintanceTag
	case strings.Contains(reply, EndingDisappearTag):
		return EndingDisappearTag
	default:
		return ""
	}
}

func stripEndingTags(reply string) string {
	cleaned := strings.ReplaceAll(reply, EndingDeathTag, "")
	cleaned = strings.ReplaceAll(cleaned, EndingDisappearTag, "")
	cleaned = strings.ReplaceAll(cleaned, EndingAcquaintanceTag, "")
	return strings.TrimSpace(cleaned)
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

func resolveThresholdEndingTag(affection, affectionBoostCount, turnsUsed int) string {
	if affection >= 25 && affectionBoostCount >= 5 && turnsUsed >= 7 {
		return EndingAcquaintanceTag
	}
	if affection >= 20 && affectionBoostCount >= 4 && turnsUsed >= 7 {
		return EndingDisappearTag
	}
	return EndingDeathTag
}

func endingTagAllowedByThreshold(tag string, affection, affectionBoostCount, turnsUsed int) bool {
	switch tag {
	case EndingDeathTag:
		return true
	case EndingDisappearTag:
		return affection >= 20 && affectionBoostCount >= 4 && turnsUsed >= 7
	case EndingAcquaintanceTag:
		return affection >= 25 && affectionBoostCount >= 5 && turnsUsed >= 7
	default:
		return false
	}
}

func ensureEndingNarrative(reply string, tag string) string {
	cleaned := strings.TrimSpace(reply)
	if inferNarrativeEndingTag(cleaned) == tag {
		return cleaned
	}

	var line string
	switch tag {
	case EndingDeathTag:
		line = "你回头时，她的身体已经越过栏杆。最后一缕烟被风卷散，楼下只剩一片空白。"
	case EndingDisappearTag:
		line = "她终于从栏杆上下来，走进消防通道，没有回头。"
	case EndingAcquaintanceTag:
		line = "她把手机递过来，低声说：存个艾就行。明天九点，别迟到。"
	default:
		return cleaned
	}

	if cleaned == "" {
		return line
	}
	return cleaned + "\n" + line
}

func normalizeFinalMechanicTags(reply string, roundsLeft, affection, affectionBoostCount, turnsUsed int) string {
	if roundsLeft > 0 {
		return reply
	}

	inferredTag := inferNarrativeEndingTag(reply)
	modelTag := explicitEndingTag(reply)
	finalTag := resolveThresholdEndingTag(affection, affectionBoostCount, turnsUsed)

	switch {
	case inferredTag == EndingDeathTag || modelTag == EndingDeathTag:
		finalTag = EndingDeathTag
	case inferredTag != "" && endingTagAllowedByThreshold(inferredTag, affection, affectionBoostCount, turnsUsed):
		finalTag = inferredTag
	case modelTag != "" && endingTagAllowedByThreshold(modelTag, affection, affectionBoostCount, turnsUsed):
		finalTag = modelTag
	}

	body := stripQuestionMarkNoiseLines(stripEndingTags(reply))
	if inferredTag != "" && inferredTag != finalTag {
		body = ""
	}
	body = ensureEndingNarrative(body, finalTag)
	return strings.TrimSpace(body) + "\n" + finalTag
}

func EvaluateTurn(cfg ClientConfig, payload turnEvaluationPayload) (TurnEvaluation, error) {
	payload.CurrentAiState = normalizeEvaluationAiState(payload.CurrentAiState, EvaluationAiStateGuarded)

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
