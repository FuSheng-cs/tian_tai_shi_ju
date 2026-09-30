package game

import (
	"fmt"
	"strings"
	"time"
)

const fallbackReply = "（她没有接话，只是看向远处的灯。）"

// ApplyTurn is the only operation that mutates a playing State. It is
// deterministic for the same state, command, and assessment. The assessment
// may originate from an LLM, but no assessment field is trusted as a state
// patch or as a final ending decision.
func ApplyTurn(state *State, command SubmitTurn, assessment TurnAssessment, now time.Time) (TurnResult, error) {
	if state == nil {
		return TurnResult{}, fmt.Errorf("%w: nil state", ErrInvalidState)
	}
	if err := state.Validate(); err != nil {
		return TurnResult{}, err
	}
	if state.ProcessedCommand == nil {
		state.ProcessedCommand = make(map[string]CommandReceipt)
	}
	if strings.TrimSpace(command.CommandID) == "" {
		return TurnResult{}, ErrCommandRequired
	}
	if command.SessionID != state.SessionID {
		return TurnResult{}, fmt.Errorf("%w: session id mismatch", ErrInvalidCommand)
	}
	if receipt, ok := state.ProcessedCommand[command.CommandID]; ok {
		result := receipt.Result
		result.Replay = true
		return result, nil
	}
	if state.Phase != PhasePlaying {
		return TurnResult{}, ErrSessionEnded
	}
	if command.ExpectedRevision != state.Revision {
		return TurnResult{}, fmt.Errorf("%w: expected=%d actual=%d", ErrRevisionConflict, command.ExpectedRevision, state.Revision)
	}
	text := strings.TrimSpace(command.Text)
	if text == "" {
		return TurnResult{}, ErrTextRequired
	}
	if len([]rune(text)) > MaxPlayerRunes {
		return TurnResult{}, fmt.Errorf("%w: player text is too long", ErrInvalidCommand)
	}
	if state.Opportunities <= 0 {
		return TurnResult{}, ErrOutOfOpportunities
	}

	pressure := clampPressure(assessment.PressureDelta)
	// A single turn cannot be both a harmful hit and a valid touch. This is a
	// rule-level invariant rather than a prompt instruction.
	touch := assessment.TouchSignal && pressure == 0
	recovery := acceptsRecoverySignal(state, assessment)
	opportunities := state.Opportunities - 1 - pressure
	if touch {
		opportunities++
	}
	if opportunities < 0 {
		opportunities = 0
	}
	if opportunities > InitialOpportunities {
		opportunities = InitialOpportunities
	}

	state.Messages = append(state.Messages,
		Message{Role: RoleUser, Content: text},
		Message{Role: RoleAssistant, Content: normalizeReply(assessment.Reply)},
	)
	state.Opportunities = opportunities
	state.Emotion = normalizeEmotion(assessment.Emotion)
	if touch {
		state.Touches++
		state.Affection = state.Touches * AffectionPerTouch
	}
	state.AiState = resolveAiState(state, assessment, touch, recovery)
	state.Revision++

	acceptedEvents := []Event{{
		Revision: state.Revision,
		Type:     "turn.accepted",
		Data: map[string]string{
			"command_id": command.CommandID,
			"pressure_delta": fmt.Sprintf("%d", pressure),
			"touch": fmt.Sprintf("%t", touch),
		},
		At: now.UTC(),
	}}
	if pressure > 0 {
		acceptedEvents = append(acceptedEvents, Event{
			Revision: state.Revision,
			Type:     "pressure.applied",
			Data:     map[string]string{"delta": fmt.Sprintf("%d", pressure)},
			At:       now.UTC(),
		})
	}
	if touch {
		acceptedEvents = append(acceptedEvents, Event{
			Revision: state.Revision,
			Type:     "touch.registered",
			Data:     map[string]string{"touches": fmt.Sprintf("%d", state.Touches)},
			At:       now.UTC(),
		})
	}

	var ending *EndingType
	turnsUsed := countPlayerMessages(state.Messages)
	if candidate := resolveEnding(state, assessment, recovery, opportunities, turnsUsed); candidate != nil {
		ending = candidate
		state.Ending = candidate
		state.Phase = PhaseEnded
		acceptedEvents = append(acceptedEvents, Event{
			Revision: state.Revision,
			Type:     "ending.resolved",
			Data:     map[string]string{"ending": string(*candidate)},
			At:       now.UTC(),
		})
	}
	state.Position = resolvePosition(state, recovery, ending)

	state.Events = append(state.Events, acceptedEvents...)
	result := TurnResult{
		CommandID: command.CommandID,
		Revision:  state.Revision,
		Reply:     state.Messages[len(state.Messages)-1].Content,
		Ending:    cloneEnding(ending),
		Events:    append([]Event(nil), acceptedEvents...),
		State:     state.Public(),
	}
	state.ProcessedCommand[command.CommandID] = CommandReceipt{CommandID: command.CommandID, Result: result}

	if err := state.Validate(); err != nil {
		return TurnResult{}, err
	}
	return result, nil
}

func normalizeReply(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallbackReply
	}
	runes := []rune(value)
	if len(runes) > MaxReplyRunes {
		return string(runes[:MaxReplyRunes])
	}
	return value
}

func clampPressure(value int) int {
	if value <= 0 {
		return 0
	}
	if value == 1 {
		return 1
	}
	return 2
}

func normalizeEmotion(value Emotion) Emotion {
	if validEmotion(value) {
		return value
	}
	return EmotionNormal
}

func deriveAiState(state *State) AiState {
	if state.Opportunities <= 1 {
		return AiStateEdge
	}
	switch {
	case state.Affection >= 15:
		return AiStateWavering
	case state.Affection >= 5:
		return AiStateWatching
	default:
		return AiStateGuarded
	}
}

func resolveAiState(state *State, assessment TurnAssessment, touch, recovery bool) AiState {
	candidate := assessment.AiState
	if !validAiState(candidate) {
		candidate = deriveAiState(state)
	}
	if recovery && state.AiState == AiStateEdge {
		return AiStateTurnBack
	}
	if state.Opportunities <= 1 && candidate != AiStateTurnBack {
		return AiStateEdge
	}
	if touch && candidate == AiStateGuarded {
		return AiStateWatching
	}
	return candidate
}

func resolvePosition(state *State, recovery bool, ending *EndingType) Position {
	if ending != nil && *ending == EndingAcquaintance {
		return PositionContactExchanged
	}
	if ending != nil && *ending == EndingDisappear {
		return PositionLeftAlone
	}
	if ending != nil && *ending == EndingDeath {
		return PositionRooftopEdge
	}
	if recovery {
		return PositionRooftopInner
	}
	return state.Position
}

func resolveEnding(state *State, assessment TurnAssessment, recovery bool, opportunities, turnsUsed int) *EndingType {
	// Recovery and contact are evidence signals. They are never sufficient by
	// themselves; all quantitative and phase guards remain in this function.
	if turnsUsed >= MinTurnsForEnding && state.Touches >= 5 && state.Affection >= 25 &&
		recovery && assessment.ContactExchangeSignal {
		ending := EndingAcquaintance
		return &ending
	}
	if turnsUsed >= MinTurnsForEnding && state.Touches >= 4 && state.Affection >= 20 &&
		recovery && !assessment.ContactExchangeSignal {
		ending := EndingDisappear
		return &ending
	}
	if opportunities <= 0 || (assessment.FatalSignal && assessment.PressureDelta >= 2 && state.Opportunities <= 2) {
		ending := EndingDeath
		return &ending
	}
	return nil
}

func acceptsRecoverySignal(state *State, assessment TurnAssessment) bool {
	return assessment.RecoverySignal &&
		(state.Position == PositionRooftopEdge || state.AiState == AiStateEdge || assessment.AiState == AiStateTurnBack)
}

func countPlayerMessages(messages []Message) int {
	count := 0
	for _, message := range messages {
		if message.Role == RoleUser {
			count++
		}
	}
	return count
}
