package game

// The domain returns copies at every storage/API boundary. Without these
// copies a handler could retain a slice from a receipt and accidentally mutate
// the aggregate that is supposed to be protected by the session service.

func cloneEvents(events []Event) []Event {
	if len(events) == 0 {
		return []Event{}
	}
	cloned := make([]Event, len(events))
	for i, event := range events {
		cloned[i] = event
		if event.Data != nil {
			cloned[i].Data = make(map[string]string, len(event.Data))
			for key, value := range event.Data {
				cloned[i].Data[key] = value
			}
		}
	}
	return cloned
}

func clonePublicState(state PublicState) PublicState {
	state.Messages = append([]Message{}, state.Messages...)
	state.Ending = cloneEnding(state.Ending)
	return state
}

func cloneTurnResult(result TurnResult) TurnResult {
	result.Events = cloneEvents(result.Events)
	result.Ending = cloneEnding(result.Ending)
	result.State = clonePublicState(result.State)
	return result
}

func cloneState(state State) State {
	cloned := state
	cloned.Messages = append([]Message{}, state.Messages...)
	cloned.Events = cloneEvents(state.Events)
	cloned.Ending = cloneEnding(state.Ending)
	if state.ProcessedCommand != nil {
		cloned.ProcessedCommand = make(map[string]CommandReceipt, len(state.ProcessedCommand))
		for key, receipt := range state.ProcessedCommand {
			receipt.Result = cloneTurnResult(receipt.Result)
			cloned.ProcessedCommand[key] = receipt
		}
	}
	return cloned
}
