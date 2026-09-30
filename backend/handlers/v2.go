package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"game_damo/backend/config"
	"game_damo/backend/game"
	"game_damo/backend/llm"

	"github.com/gin-gonic/gin"
)

const maxV2BodyBytes = 16 << 10

type v2SessionResponse struct {
	State game.PublicState `json:"state"`
}

type v2EventsResponse struct {
	Events []game.Event `json:"events"`
}

type v2ErrorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// NewV2SessionService wires the old provider client behind the new narrator
// port. Browser requests never carry provider names or API keys; configuration
// is owned by the server and the deterministic fallback keeps a demo usable
// when no model is configured.
func NewV2SessionService() *game.SessionService {
	return game.NewSessionService(newV2Narrator(), time.Now)
}

func newV2Narrator() game.Narrator {
	return game.NarratorFunc(func(ctx context.Context, state game.State, command game.SubmitTurn) (game.TurnAssessment, error) {
		if err := ctx.Err(); err != nil {
			return game.TurnAssessment{}, err
		}
		if config.Cfg == nil || strings.TrimSpace(config.Cfg.ServerAPIKey) == "" {
			return game.TurnAssessment{}, errors.New("server LLM is not configured")
		}
		history := make([]llm.Message, len(state.Messages))
		for i, message := range state.Messages {
			history[i] = llm.Message{Role: string(message.Role), Content: message.Content}
		}
		result, err := llm.Chat(llm.ClientConfig{
			Provider: config.Cfg.ServerProvider,
			APIKey:   config.Cfg.ServerAPIKey,
			Model:    config.Cfg.ServerModel,
			BaseURL:  config.Cfg.ServerBaseURL,
		}, command.Text, history, state.Opportunities, state.Affection, state.Touches, int(state.Revision), string(state.AiState))
		if err != nil {
			return game.TurnAssessment{}, err
		}
		if err := ctx.Err(); err != nil {
			return game.TurnAssessment{}, err
		}
		return assessmentFromLegacy(result), nil
	})
}

func assessmentFromLegacy(result llm.ChatTurnResult) game.TurnAssessment {
	evaluation := result.Evaluation
	aiState := evaluation.AiState
	if aiState == llm.EvaluationAiStateTurnBack {
		aiState = string(game.AiStateTurnBack)
	}
	assessment := game.TurnAssessment{
		Reply:                 result.Reply,
		Emotion:               game.Emotion(evaluation.Emotion),
		AiState:               game.AiState(aiState),
		TouchSignal:           evaluation.AffectionDelta >= game.AffectionPerTouch,
		PressureDelta:         evaluation.PressureDelta,
		RecoverySignal:        aiState == string(game.AiStateTurnBack),
		Confidence:            evaluation.Confidence,
	}
	if evaluation.EndingType != nil {
		switch strings.TrimSpace(*evaluation.EndingType) {
		case "end_acquaintance":
			assessment.ContactExchangeSignal = true
		case "end_death":
			assessment.FatalSignal = true
		}
	}
	return assessment
}

// RegisterV2Routes exposes commands and projections, never client supplied
// history or score fields. The service owns session state and optimistic
// concurrency.
func RegisterV2Routes(group *gin.RouterGroup, service *game.SessionService) {
	v2 := group.Group("/v2")
	v2.POST("/sessions", func(c *gin.Context) {
		sessionID, err := newSessionID()
		if err != nil {
			writeV2Error(c, err)
			return
		}
		state, err := service.Create(c.Request.Context(), sessionID)
		if err != nil {
			writeV2Error(c, err)
			return
		}
		c.JSON(http.StatusCreated, v2SessionResponse{State: state})
	})
	v2.GET("/sessions/:sessionID", func(c *gin.Context) {
		state, err := service.Get(c.Request.Context(), c.Param("sessionID"))
		if err != nil {
			writeV2Error(c, err)
			return
		}
		c.JSON(http.StatusOK, v2SessionResponse{State: state})
	})
	v2.GET("/sessions/:sessionID/events", func(c *gin.Context) {
		events, err := service.Events(c.Request.Context(), c.Param("sessionID"))
		if err != nil {
			writeV2Error(c, err)
			return
		}
		c.JSON(http.StatusOK, v2EventsResponse{Events: events})
	})
	v2.POST("/sessions/:sessionID/turns", func(c *gin.Context) {
		var command game.SubmitTurn
		if err := decodeV2JSON(c, &command); err != nil {
			writeV2Error(c, fmt.Errorf("%w: %v", game.ErrInvalidCommand, err))
			return
		}
		if command.SessionID != c.Param("sessionID") {
			writeV2Error(c, fmt.Errorf("%w: path and body session differ", game.ErrInvalidCommand))
			return
		}
		result, err := service.Submit(c.Request.Context(), command)
		if err != nil {
			writeV2Error(c, err)
			return
		}
		c.JSON(http.StatusOK, result)
	})
}

func newSessionID() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return "s_" + hex.EncodeToString(bytes), nil
}

func decodeV2JSON(c *gin.Context, destination interface{}) error {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxV2BodyBytes)
	decoder := json.NewDecoder(c.Request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		return err
	}
	var extra interface{}
	if err := decoder.Decode(&extra); err != io.EOF {
		if err == nil {
			return errors.New("request must contain one JSON object")
		}
		return err
	}
	return nil
}

func writeV2Error(c *gin.Context, err error) {
	status := http.StatusInternalServerError
	code := "internal_error"
	switch {
	case errors.Is(err, game.ErrSessionNotFound):
		status, code = http.StatusNotFound, "session_not_found"
	case errors.Is(err, game.ErrSessionExists):
		status, code = http.StatusConflict, "session_exists"
	case errors.Is(err, game.ErrRevisionConflict):
		status, code = http.StatusConflict, "revision_conflict"
	case errors.Is(err, game.ErrCommandInProgress):
		status, code = http.StatusConflict, "command_in_progress"
	case errors.Is(err, game.ErrCommandConflict):
		status, code = http.StatusConflict, "command_conflict"
	case errors.Is(err, game.ErrSessionEnded):
		status, code = http.StatusConflict, "session_ended"
	case errors.Is(err, game.ErrInvalidCommand), errors.Is(err, game.ErrCommandRequired),
		errors.Is(err, game.ErrTextRequired), errors.Is(err, game.ErrOutOfOpportunities):
		status, code = http.StatusBadRequest, "invalid_command"
	case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
		status, code = http.StatusRequestTimeout, "request_cancelled"
	}
	c.JSON(status, v2ErrorResponse{Code: code, Message: err.Error()})
}
