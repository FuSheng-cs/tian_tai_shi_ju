package llm

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestFrontendAndBackendThemeContract(t *testing.T) {
	contractPath := filepath.Join("..", "..", "legacy_vue", "src", "domain", "gameContract.ts")
	content, err := os.ReadFile(contractPath)
	if err != nil {
		t.Fatalf("failed to read frontend game contract: %v", err)
	}
	frontend := string(content)

	required := []string{
		`你不需要说出十句正确的话，只需要陪一个人找到下一个安全的地方。`,
		`trustBoostValue: 5`,
		`safeExit:`,
		`refusal:`,
		`end_safe_exit`,
		`end_refusal`,
	}
	for _, item := range required {
		if !strings.Contains(frontend, item) {
			t.Fatalf("frontend contract is missing %q", item)
		}
	}

	forbidden := []string{"ENDINGS.death", "affection", "char_girl_smoke"}
	for _, item := range forbidden {
		if strings.Contains(frontend, item) {
			t.Fatalf("frontend contract still contains removed concept %q", item)
		}
	}

	if InitialRoundCount != 10 || TrustBoostValue != 5 {
		t.Fatalf("unexpected backend core values: rounds=%d trust=%d", InitialRoundCount, TrustBoostValue)
	}
	if EndingSafeExitType == EndingRefusalType {
		t.Fatal("ending types must be distinct")
	}
}
