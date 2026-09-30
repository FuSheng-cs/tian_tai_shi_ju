package main

import (
	"log"

	"game_damo/backend/config"
	"game_damo/backend/handlers"

	"github.com/gin-gonic/gin"
)

func main() {
	config.Load()

	r := gin.Default()
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

	api := r.Group("/api")
	api.GET("/health", handlers.HandleHealth)
	api.POST("/chat", handlers.HandleChat)
	api.POST("/hint", handlers.HandleHint)
	api.POST("/chat-after", handlers.HandleChatAfter)
	api.POST("/ending-summary", handlers.HandleEndingSummary)

	// v2 owns the session aggregate on the server. The legacy endpoints above
	// remain available during migration, but no v2 request accepts a browser
	// supplied history, score, or provider credential.
	handlers.RegisterV2Routes(api, handlers.NewV2SessionService())

	addr := ":" + config.Cfg.Port
	log.Printf("[Server] DAMO Backend starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("[Server] Failed to start: %v", err)
	}
}
