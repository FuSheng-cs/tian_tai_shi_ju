package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

// Config 保存服务端的全局配置。
// v1 仍允许玩家自带 Key；v2 只读取服务端模型配置。
type Config struct {
	ServerProvider string
	ServerAPIKey   string
	ServerModel    string
	ServerBaseURL  string

	// V2AdminToken protects the diagnostic event projection. It is deliberately
	// separate from the model API key and is never returned to the browser.
	V2AdminToken string
	Port         string
}

var Cfg *Config

// Load 从 .env 文件和环境变量中加载配置。
func Load() {
	loaded := false
	for _, path := range []string{".env", "backend/.env"} {
		if err := godotenv.Load(path); err == nil {
			log.Printf("[Config] Loaded env file: %s", path)
			loaded = true
		}
	}
	if !loaded {
		log.Println("[Config] No .env file found, using environment variables only")
	}

	Cfg = &Config{
		ServerProvider: getEnv("LLM_PROVIDER", ""),
		ServerAPIKey:   getEnv("LLM_API_KEY", ""),
		ServerModel:    getEnv("LLM_MODEL", ""),
		ServerBaseURL:  getEnv("LLM_BASE_URL", ""),
		V2AdminToken:   getEnv("V2_ADMIN_TOKEN", ""),
		Port:           getEnv("PORT", "8080"),
	}

	log.Printf("[Config] Server port: %s", Cfg.Port)
	if Cfg.ServerAPIKey != "" {
		log.Printf("[Config] Server-side LLM configured: provider=%s, model=%s", Cfg.ServerProvider, Cfg.ServerModel)
	} else {
		log.Println("[Config] No server-side LLM API Key configured. v2 will use safe degraded narration.")
	}
}

func getEnv(key, defaultVal string) string {
	if value, ok := os.LookupEnv(key); ok && value != "" {
		return value
	}
	return defaultVal
}
