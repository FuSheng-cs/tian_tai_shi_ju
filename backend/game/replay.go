package game

import (
	"fmt"
	"strconv"
)

// Replay rebuilds a public aggregate from its immutable event stream. The
// event data intentionally contains the normalized command/reply and the
// post-turn projection, so replay does not call an LLM or depend on wall clock
// state. This is the audit seam that lets a future SQLite/Postgres adapter
// replace the in-memory store without changing game rules.
func Replay(events []Event) (State, error) {
	if len(events) == 0 || events[0].Type != "session.created" {
		return State{}, fmt.Errorf("%w: event stream has no session.created", ErrInvalidState)
	}
	sessionID := events[0].Data["session_id"]
	if sessionID == "" {
		return State{}, fmt.Errorf("%w: session.created has no session id", ErrInvalidState)
	}
	state, err := NewState(sessionID, events[0].At)
	if err != nil {
		return State{}, err
	}
	state.Events = cloneEvents(events)

	for _, event := range events[1:] {
		if event.Type != "turn.accepted" {
			continue
		}
		if event.Revision != state.Revision+1 {
			return State{}, fmt.Errorf("%w: non-contiguous turn revision %d", ErrInvalidState, event.Revision)
		}
		text := event.Data["text"]
		reply := event.Data["reply"]
		if text == "" || reply == "" {
			return State{}, fmt.Errorf("%w: turn.accepted has no transcript", ErrInvalidState)
		}
		opportunities, err := parseEventInt(event, "opportunities")
		if err != nil {
			return State{}, err
		}
		touches, err := parseEventInt(event, "touches")
		if err != nil {
			return State{}, err
		}
		affection, err := parseEventInt(event, "affection")
		if err != nil {
			return State{}, err
		}
		state.Messages = append(state.Messages,
			Message{Role: RoleUser, Content: text},
			Message{Role: RoleAssistant, Content: reply},
		)
		state.Revision = event.Revision
		state.Opportunities = opportunities
		state.Touches = touches
		state.Affection = affection
		state.Emotion = Emotion(event.Data["emotion"])
		state.AiState = AiState(event.Data["ai_state"])
		state.Position = Position(event.Data["position"])
		state.Phase = Phase(event.Data["phase"])
		if ending := event.Data["ending"]; ending != "" {
			value := EndingType(ending)
			state.Ending = &value
		} else {
			state.Ending = nil
		}
	}
	if err := state.Validate(); err != nil {
		return State{}, err
	}
	return state, nil
}

func parseEventInt(event Event, key string) (int, error) {
	value, err := strconv.Atoi(event.Data[key])
	if err != nil {
		return 0, fmt.Errorf("%w: invalid %s at revision %d", ErrInvalidState, key, event.Revision)
	}
	return value, nil
}
