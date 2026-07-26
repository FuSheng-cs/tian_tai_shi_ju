package config

import (
	"os"
	"path/filepath"
	"testing"
)

// stashEnv 暂存并清空一个环境变量，返回恢复函数。
func stashEnv(t *testing.T, key string) {
	t.Helper()
	old, existed := os.LookupEnv(key)
	if err := os.Unsetenv(key); err != nil {
		t.Fatalf("failed to unset %s: %v", key, err)
	}
	t.Cleanup(func() {
		if existed {
			_ = os.Setenv(key, old)
		} else {
			_ = os.Unsetenv(key)
		}
	})
}

func TestLoadFallsBackToBackendEnvWhenRootEnvMissing(t *testing.T) {
	stashEnv(t, "LLM_PROVIDER")
	stashEnv(t, "LLM_API_KEY")

	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "backend"), 0o755); err != nil {
		t.Fatalf("failed to create backend dir: %v", err)
	}
	envContent := "LLM_PROVIDER=qwen\nLLM_API_KEY=from-backend-env\n"
	if err := os.WriteFile(filepath.Join(dir, "backend", ".env"), []byte(envContent), 0o644); err != nil {
		t.Fatalf("failed to write backend/.env: %v", err)
	}

	oldWd, err := os.Getwd()
	if err != nil {
		t.Fatalf("failed to get working directory: %v", err)
	}
	if err := os.Chdir(dir); err != nil {
		t.Fatalf("failed to chdir: %v", err)
	}
	t.Cleanup(func() {
		if err := os.Chdir(oldWd); err != nil {
			t.Fatalf("failed to restore working directory: %v", err)
		}
	})

	Load()

	if Cfg.ServerAPIKey != "from-backend-env" {
		t.Fatalf("expected backend/.env to load when ./.env is missing, got ServerAPIKey=%q", Cfg.ServerAPIKey)
	}
	if Cfg.ServerProvider != "qwen" {
		t.Fatalf("expected provider from backend/.env, got %q", Cfg.ServerProvider)
	}
}
