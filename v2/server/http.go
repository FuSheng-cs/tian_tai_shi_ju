package main

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

type rateEntry struct {
	window  time.Time
	reads   int
	creates int
}

type API struct {
	game           *Game
	publicOrigin   string
	trustedProxies []*net.IPNet
	rateMu         sync.Mutex
	rates          map[string]rateEntry
	now            func() time.Time
}

func NewAPI(game *Game, publicOrigin string, trustedProxies ...*net.IPNet) http.Handler {
	api := &API{game: game, publicOrigin: publicOrigin, trustedProxies: trustedProxies, rates: make(map[string]rateEntry), now: time.Now}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v2/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, 200, map[string]any{"status": "ok", "version": "2.0.0", "aiConfigured": game.live != nil})
	})
	mux.HandleFunc("POST /api/v2/sessions", api.create)
	mux.HandleFunc("GET /api/v2/sessions/{id}", api.get)
	mux.HandleFunc("POST /api/v2/sessions/{id}/turns", api.turn)
	mux.HandleFunc("POST /api/v2/sessions/{id}/observations", api.observe)
	mux.HandleFunc("POST /api/v2/sessions/{id}/ending", api.ending)
	mux.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) {
		writeError(w, failure(404, "not_found", "没有找到这个入口。", false))
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
		if !api.allow(r) {
			w.Header().Set("Retry-After", "60")
			writeError(w, failure(429, "rate_limited", "请求太频繁，请稍等片刻再继续。", true))
			return
		}
		if r.Method == http.MethodPost {
			if !api.sameOrigin(r) {
				writeError(w, failure(403, "origin_forbidden", "请从游戏页面发起这次对话。", false))
				return
			}
			contentType := strings.TrimSpace(strings.Split(r.Header.Get("Content-Type"), ";")[0])
			if contentType != "application/json" {
				writeError(w, failure(415, "unsupported_content_type", "请求需要使用 JSON 格式。", false))
				return
			}
		}
		ctx, cancel := context.WithTimeout(r.Context(), 50*time.Second)
		defer cancel()
		mux.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (a *API) allow(r *http.Request) bool {
	host := a.clientIP(r)
	creating := r.Method == http.MethodPost && r.URL.Path == "/api/v2/sessions"
	now := a.now()
	a.rateMu.Lock()
	defer a.rateMu.Unlock()
	entry, exists := a.rates[host]
	if !exists && len(a.rates) >= 4096 {
		for key, value := range a.rates {
			if now.Sub(value.window) >= time.Minute {
				delete(a.rates, key)
			}
		}
		if len(a.rates) >= 4096 {
			return false
		}
	}
	if !exists || now.Sub(entry.window) >= time.Minute {
		entry = rateEntry{window: now}
	}
	entry.reads++
	if creating {
		entry.creates++
	}
	a.rates[host] = entry
	return entry.reads <= 180 && (!creating || entry.creates <= 12)
}

func (a *API) clientIP(r *http.Request) string {
	// Forwarded identity is accepted only from a configured immediate proxy,
	// which must overwrite X-Real-IP. A malformed or multiple-value header
	// falls back to the actual peer and cannot create fresh budget buckets.
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	peer := net.ParseIP(host)
	if peer == nil {
		return host
	}
	for _, network := range a.trustedProxies {
		if network.Contains(peer) {
			values := r.Header.Values("X-Real-IP")
			if len(values) == 1 {
				if real := net.ParseIP(strings.TrimSpace(values[0])); real != nil && !real.IsUnspecified() && !real.IsMulticast() {
					return real.String()
				}
			}
			break
		}
	}
	return peer.String()
}

func (a *API) sameOrigin(r *http.Request) bool {
	if site := r.Header.Get("Sec-Fetch-Site"); site != "" && site != "same-origin" && site != "none" {
		return false
	}
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	if a.publicOrigin != "" {
		return origin == a.publicOrigin
	}
	u, err := url.Parse(origin)
	return err == nil && (u.Scheme == "https" || u.Scheme == "http") && u.User == nil && u.Path == "" && u.RawQuery == "" && u.Fragment == "" && strings.EqualFold(u.Host, r.Host)
}

func decodeJSON(w http.ResponseWriter, r *http.Request, target any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 16<<10)
	data, err := io.ReadAll(r.Body)
	if err != nil {
		var max *http.MaxBytesError
		if errors.As(err, &max) {
			return failure(413, "request_too_large", "这份请求太长了，请缩短后重试。", false)
		}
		return failure(400, "invalid_json", "请求内容不完整，请重试。", false)
	}
	var required, optional []string
	switch target.(type) {
	case *TurnCommand:
		required = []string{"requestId", "expectedRevision", "text"}
		optional = []string{"observation", "intent"}
	case *ObservationCommand:
		required = []string{"requestId", "expectedRevision", "observation"}
	case *EndingCommand:
		required = []string{"requestId", "expectedRevision", "choice"}
		optional = []string{"echoMessageId"}
	default:
		required = []string{"mode"}
	}
	if err := decodeObject(data, target, required, optional); err != nil {
		return failure(400, "invalid_json", "请求格式不完整，或包含了不支持的内容。", false)
	}
	return nil
}

func (a *API) create(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Mode string `json:"mode"`
	}
	if err := decodeJSON(w, r, &input); err != nil {
		writeError(w, err)
		return
	}
	session, err := a.game.Create(r.Context(), input.Mode)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, session)
}

func (a *API) get(w http.ResponseWriter, r *http.Request) {
	session, err := a.game.Get(r.PathValue("id"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, session)
}

func (a *API) turn(w http.ResponseWriter, r *http.Request) {
	var input TurnCommand
	if err := decodeJSON(w, r, &input); err != nil {
		writeError(w, err)
		return
	}
	session, err := a.game.Turn(r.Context(), r.PathValue("id"), input)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, session)
}

func (a *API) ending(w http.ResponseWriter, r *http.Request) {
	var input EndingCommand
	if err := decodeJSON(w, r, &input); err != nil {
		writeError(w, err)
		return
	}
	session, err := a.game.End(r.Context(), r.PathValue("id"), input)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, session)
}

func (a *API) observe(w http.ResponseWriter, r *http.Request) {
	var input ObservationCommand
	if err := decodeJSON(w, r, &input); err != nil {
		writeError(w, err)
		return
	}
	session, err := a.game.Observe(r.Context(), r.PathValue("id"), input)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, session)
}

func writeError(w http.ResponseWriter, err error) {
	public := publicError(err)
	writeJSON(w, public.Status, map[string]any{"error": public})
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
