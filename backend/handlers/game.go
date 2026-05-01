package handlers

import (
	"log"
	"net/http"
	"strings"

	"game_damo/backend/config"
	"game_damo/backend/llm"

	"github.com/gin-gonic/gin"
)

// --- 请求/响应结构 ---

// Message 与前端 gameStore 中的 Message 保持一致
type Message struct {
	Role    string `json:"role" binding:"required"`
	Content string `json:"content" binding:"required"`
}

// ChatRequest 是 /api/chat 的请求体
type ChatRequest struct {
	// 对话历史（不含当前用户消息）
	History []Message `json:"history"`
	// 当前用户发送的消息
	UserMessage string `json:"user_message" binding:"required"`
	// 游戏状态
	RoundsLeft          int    `json:"rounds_left"`
	Affection           int    `json:"affection"`
	AffectionBoostCount int    `json:"affection_boost_count"`
	TurnsUsed           int    `json:"turns_used"`
	AiState             string `json:"ai_state"`
	// 玩家提供的 LLM 配置
	Provider string `json:"provider"`
	APIKey   string `json:"api_key"`
	Model    string `json:"model"`
	BaseURL  string `json:"base_url"`
}

// HintRequest 是 /api/hint 的请求体
type HintRequest struct {
	History  []Message `json:"history"`
	Provider string    `json:"provider"`
	APIKey   string    `json:"api_key"`
	Model    string    `json:"model"`
	BaseURL  string    `json:"base_url"`
}

// ChatAfterRequest 是 /api/chat-after 的请求体
type ChatAfterRequest struct {
	History     []Message `json:"history"`
	UserMessage string    `json:"user_message" binding:"required"`
	Provider    string    `json:"provider"`
	APIKey      string    `json:"api_key"`
	Model       string    `json:"model"`
	BaseURL     string    `json:"base_url"`
}

// EndingSummaryRequest 是 /api/ending-summary 的请求体
type EndingSummaryRequest struct {
	History             []Message `json:"history"`
	EndingType          string    `json:"ending_type"`
	RoundsUsed          int       `json:"rounds_used"`
	AffectionBoostCount int       `json:"affection_boost_count"`
	Provider            string    `json:"provider"`
	APIKey              string    `json:"api_key"`
	Model               string    `json:"model"`
	BaseURL             string    `json:"base_url"`
}

// ChatResponse 是统一的 API 响应体
type ChatResponse struct {
	Reply string `json:"reply"`
	Error string `json:"error,omitempty"`
}

// EndingSummaryResponse 是结局摘要的结构化响应
type EndingSummaryResponse struct {
	TurningLine string `json:"turning_line"`
	Comment     string `json:"comment"`
	Error       string `json:"error,omitempty"`
}

// --- 辅助函数 ---

// buildClientConfig 从请求中构建 LLM 客户端配置
// 优先级：玩家提供的 Key > 服务器配置的 Key
func buildClientConfig(provider, apiKey, model, baseURL string) (llm.ClientConfig, bool) {
	cfg := llm.ClientConfig{
		Provider: provider,
		APIKey:   apiKey,
		Model:    model,
		BaseURL:  baseURL,
	}

	// 如果玩家没有提供 API Key，尝试使用服务器配置的 Key
	if strings.TrimSpace(cfg.APIKey) == "" {
		if config.Cfg.ServerAPIKey != "" {
			// 当玩家未提供自己的 Key 时，完整切换到服务器侧配置，
			// 避免前端残留的 provider/model/baseURL 与服务端 Key 不匹配。
			cfg = llm.ClientConfig{
				Provider: config.Cfg.ServerProvider,
				APIKey:   config.Cfg.ServerAPIKey,
				Model:    config.Cfg.ServerModel,
				BaseURL:  config.Cfg.ServerBaseURL,
			}
		} else {
			// 没有任何 API Key 可用
			return llm.ClientConfig{}, false
		}
	}

	// 设置 Provider 默认值
	if cfg.Provider == "" {
		cfg.Provider = "openai"
	}

	return cfg, true
}

// convertMessages 将 handler 中的 Message 转换为 llm 包的 Message
func convertMessages(msgs []Message) []llm.Message {
	result := make([]llm.Message, len(msgs))
	for i, m := range msgs {
		result[i] = llm.Message{Role: m.Role, Content: m.Content}
	}
	return result
}

// --- HTTP 处理器 ---

// HandleChat 处理主游戏对话请求
// POST /api/chat
func HandleChat(c *gin.Context) {
	var req ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ChatResponse{Error: "无效的请求格式: " + err.Error()})
		return
	}

	clientCfg, ok := buildClientConfig(req.Provider, req.APIKey, req.Model, req.BaseURL)
	if !ok {
		// 无 API Key：返回模拟回复（与原来 mockChat 行为一致）
		c.JSON(http.StatusOK, ChatResponse{
			Reply: "过去就像昨天的雨水，早就干了。你问这些做什么？（此为模拟回复，请在设置中配置 API Key）",
		})
		return
	}

	history := convertMessages(req.History)
	reply, err := llm.Chat(clientCfg, req.UserMessage, history, req.RoundsLeft, req.Affection, req.AffectionBoostCount, req.TurnsUsed, req.AiState)
	if err != nil {
		log.Printf("[HandleChat] LLM error: %v", err)
		c.JSON(http.StatusOK, ChatResponse{
			Error: "LLM 调用失败: " + err.Error(),
			Reply: "（风太大了，我听不清你说什么... 请检查 API Key 或网络连接）",
		})
		return
	}

	c.JSON(http.StatusOK, ChatResponse{Reply: reply})
}

// HandleHint 处理游戏提示请求
// POST /api/hint
func HandleHint(c *gin.Context) {
	var req HintRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ChatResponse{Error: "无效的请求格式: " + err.Error()})
		return
	}

	clientCfg, ok := buildClientConfig(req.Provider, req.APIKey, req.Model, req.BaseURL)
	if !ok {
		c.JSON(http.StatusOK, ChatResponse{
			Reply: "（模拟提示：试着展现出你并不急于改变她，只是想倾听。）",
		})
		return
	}

	history := convertMessages(req.History)
	hint, err := llm.GetHint(clientCfg, history)
	if err != nil {
		log.Printf("[HandleHint] LLM error: %v", err)
		c.JSON(http.StatusOK, ChatResponse{
			Error: "提示获取失败: " + err.Error(),
			Reply: "提示获取失败，请检查网络或 API Key。",
		})
		return
	}

	c.JSON(http.StatusOK, ChatResponse{Reply: hint})
}

// HandleChatAfter 处理故事结束后的聊天请求
// POST /api/chat-after
func HandleChatAfter(c *gin.Context) {
	var req ChatAfterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ChatResponse{Error: "无效的请求格式: " + err.Error()})
		return
	}

	clientCfg, ok := buildClientConfig(req.Provider, req.APIKey, req.Model, req.BaseURL)
	if !ok {
		c.JSON(http.StatusOK, ChatResponse{
			Reply: "（模拟回复：你发的信息我收到啦。记得配置 API Key 哦。）",
		})
		return
	}

	history := convertMessages(req.History)
	reply, err := llm.ChatAfterStory(clientCfg, req.UserMessage, history)
	if err != nil {
		log.Printf("[HandleChatAfter] LLM error: %v", err)
		c.JSON(http.StatusOK, ChatResponse{
			Error: "聊天失败: " + err.Error(),
			Reply: "网络好像不太好，消息没发出去。",
		})
		return
	}

	c.JSON(http.StatusOK, ChatResponse{Reply: reply})
}

// HandleEndingSummary 生成局后摘要中的关键转折句和短评
// POST /api/ending-summary
func HandleEndingSummary(c *gin.Context) {
	var req EndingSummaryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, EndingSummaryResponse{Error: "无效的请求格式: " + err.Error()})
		return
	}

	clientCfg, ok := buildClientConfig(req.Provider, req.APIKey, req.Model, req.BaseURL)
	if !ok {
		c.JSON(http.StatusOK, EndingSummaryResponse{Error: "未配置可用的 LLM API Key"})
		return
	}

	history := convertMessages(req.History)
	summary, err := llm.BuildEndingSummary(clientCfg, history, req.EndingType, req.RoundsUsed, req.AffectionBoostCount)
	if err != nil {
		log.Printf("[HandleEndingSummary] LLM error: %v", err)
		c.JSON(http.StatusOK, EndingSummaryResponse{Error: "结局摘要生成失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, EndingSummaryResponse{
		TurningLine: summary.TurningLine,
		Comment:     summary.Comment,
	})
}

// HandleHealth 是健康检查接口，供 Nginx/监控使用
// GET /api/health
func HandleHealth(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
