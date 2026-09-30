package llm

import "testing"

func TestSafeExitRequiresSettledFullTrust(t *testing.T) {
	for _, tc := range []struct {
		name                          string
		trust, gain, pressure, rounds int
		want                          string
	}{
		{"too low", 5, 5, 0, 4, ""},
		{"last turn too low", 10, 0, 0, 0, EndingRefusalType},
		{"reaches full this turn", 10, 5, 0, 0, EndingSafeExitType},
		{"already full", 15, 0, 0, 4, EndingSafeExitType},
		{"pressure drops below full", 15, 0, 1, 4, ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ending := EndingSafeExitType
			result := enforceSafeExitTrust("离开天台", TurnEvaluation{EndingType: &ending, AiState: EvaluationAiStateLeaving, TrustDelta: tc.gain, PressureDelta: tc.pressure}, tc.trust, tc.rounds)
			got := ""
			if result.Evaluation.EndingType != nil {
				got = *result.Evaluation.EndingType
			}
			if got != tc.want {
				t.Fatalf("ending = %q, want %q", got, tc.want)
			}
			if tc.want != EndingSafeExitType && (result.Reply == "离开天台" || result.Evaluation.AiState == EvaluationAiStateLeaving) {
				t.Fatal("premature departure narrative/state survived")
			}
		})
	}
}
