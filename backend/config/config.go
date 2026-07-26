package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

// Config 保存服务端的全局配置
// 服务器端的 API Key 和 Provider 是可选的（兜底用）
// 玩家可以在前端填写自己的 Key，后端优先使用玩家的 Key
type Config struct {
	// 服务器端配置（可选，用作兜底或管理员模式）
	ServerProvider string
	ServerAPIKey   string
	ServerModel    string
	ServerBaseURL  string

	// 服务监听端口
	Port string
}

var Cfg *Config

// Load 从 .env 文件和环境变量中加载配置
func Load() {
	// 逐个尝试加载当前目录和仓库根目录下 backend/.env，任一成功即可，
	// 兼容在 backend/ 目录或项目根目录启动服务两种方式。
	// （godotenv.Load 多参数形式在首个文件失败时会直接返回，不能一次传入多个路径。）
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
		Port:           getEnv("PORT", "8080"),
	}

	log.Printf("[Config] Server port: %s", Cfg.Port)
	if Cfg.ServerAPIKey != "" {
		log.Printf("[Config] Server-side LLM configured: provider=%s, model=%s", Cfg.ServerProvider, Cfg.ServerModel)
	} else {
		log.Println("[Config] No server-side LLM API Key configured. Will rely on player-provided keys.")
	}
}

func getEnv(key, defaultVal string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return defaultVal
}
