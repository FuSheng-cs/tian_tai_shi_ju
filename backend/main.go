package main

import (
	"log"

	"game_damo/backend/config"
	"game_damo/backend/handlers"

	"github.com/gin-gonic/gin"
)

func main() {
	// 加载配置
	config.Load()

	// 创建 Gin 路由
	r := gin.Default()

	// CORS 中间件（开发环境允许所有来源；生产环境由 Nginx 统一代理，前后端同源，无需 CORS）
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// API 路由组
	api := r.Group("/api")
	{
		// 健康检查
		api.GET("/health", handlers.HandleHealth)

		// 游戏接口
		api.POST("/chat", handlers.HandleChat)
		api.POST("/hint", handlers.HandleHint)
		api.POST("/chat-after", handlers.HandleChatAfter)
		api.POST("/ending-summary", handlers.HandleEndingSummary)
	}

	addr := ":" + config.Cfg.Port
	log.Printf("[Server] DAMO Backend starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("[Server] Failed to start: %v", err)
	}
}
