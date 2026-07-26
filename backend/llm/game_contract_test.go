package llm

import (
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"testing"
)

// TestEndingThresholdsMatchFrontendGameContract 断言后端结局门槛常量与前端
// legacy_vue/src/domain/gameContract.ts 中 ENDING_THRESHOLDS 的当前值一致。
func TestEndingThresholdsMatchFrontendGameContract(t *testing.T) {
	contractPath := filepath.Join("..", "..", "legacy_vue", "src", "domain", "gameContract.ts")
	content, err := os.ReadFile(contractPath)
	if err != nil {
		t.Fatalf("failed to read frontend game contract: %v", err)
	}
	frontend := string(content)

	cases := []struct {
		ending                 string
		minAffection           int
		minAffectionBoostCount int
		minTurnsUsed           int
	}{
		{"disappear", EndingDisappearMinAffection, EndingDisappearMinAffectionBoostCount, EndingDisappearMinTurnsUsed},
		{"acquaintance", EndingAcquaintanceMinAffection, EndingAcquaintanceMinAffectionBoostCount, EndingAcquaintanceMinTurnsUsed},
	}

	for _, tc := range cases {
		pattern := regexp.MustCompile(
			tc.ending + `:\s*\{\s*minAffection:\s*(\d+),\s*minAffectionBoostCount:\s*(\d+),\s*minTurnsUsed:\s*(\d+)`,
		)
		match := pattern.FindStringSubmatch(frontend)
		if match == nil {
			t.Fatalf("frontend ENDING_THRESHOLDS.%s not found in %s", tc.ending, contractPath)
		}

		got := make([]int, 3)
		for i, raw := range match[1:] {
			value, err := strconv.Atoi(raw)
			if err != nil {
				t.Fatalf("failed to parse frontend %s threshold %q: %v", tc.ending, raw, err)
			}
			got[i] = value
		}

		want := []int{tc.minAffection, tc.minAffectionBoostCount, tc.minTurnsUsed}
		for i, name := range []string{"minAffection", "minAffectionBoostCount", "minTurnsUsed"} {
			if got[i] != want[i] {
				t.Fatalf("ENDING_THRESHOLDS.%s.%s = %d in frontend, backend constant is %d",
					tc.ending, name, got[i], want[i])
			}
		}
	}
}
