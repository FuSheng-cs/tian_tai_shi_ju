package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func apiRequest(handler http.Handler, method, path, body string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	return response
}

func TestHTTPContractAndUntrustedStateRejected(t *testing.T) {
	game := testGame(t, nil)
	handler := NewAPI(game, "")
	health := apiRequest(handler, "GET", "/api/v2/health", "")
	if health.Code != 200 || !strings.Contains(health.Body.String(), `"aiConfigured":false`) {
		t.Fatal("health must report configured status honestly", health.Body.String())
	}
	response := apiRequest(handler, "POST", "/api/v2/sessions", `{"mode":"live"}`)
	if response.Code != 503 || !strings.Contains(response.Body.String(), "ai_unavailable") {
		t.Fatal("live must not pretend to be configured", response.Body.String())
	}
	response = apiRequest(handler, "POST", "/api/v2/sessions", `{"mode":"rehearsal"}`)
	if response.Code != 201 {
		t.Fatal(response.Body.String())
	}
	var session Session
	if err := json.Unmarshal(response.Body.Bytes(), &session); err != nil {
		t.Fatal(err)
	}
	for _, body := range []string{
		`{"requestId":"request-001","expectedRevision":0,"text":"听见了。","turn":10}`,
		`{"requestId":"request-001","expectedRevision":0,"text":"听见了。","history":[]}`,
		`{"requestId":"request-001","expectedRevision":0,"text":"听见了。","apiKey":"credential"}`,
		`{"requestId":"request-001","expectedRevision":0,"text":"听见了。","base_url":"http://127.0.0.1"}`,
		`{"requestId":"request-001","expectedRevision":0,"text":"听见了。","text":"覆盖"}`,
		`{"requestId":"request-001","expectedRevision":null,"text":"听见了。"}`,
		`{"requestId":"request-001","text":"听见了。"}`,
		`{"requestId":"request-001","ExpectedRevision":0,"text":"听见了。"}`,
		`{"requestId":"request-001","expectedRevision":0,"text":"听见了。"} {}`,
	} {
		response = apiRequest(handler, "POST", "/api/v2/sessions/"+session.ID+"/turns", body)
		if response.Code != 400 {
			t.Fatalf("untrusted command accepted: %s: %s", body, response.Body.String())
		}
	}
	stored, _ := game.Get(session.ID)
	if stored.Turn != 0 {
		t.Fatal("bad requests consumed a turn")
	}
	response = apiRequest(handler, "POST", "/api/v2/sessions/"+session.ID+"/turns", `{"requestId":"request-001","expectedRevision":0,"text":"听见了。","observation":"door"}`)
	if response.Code != 200 || !strings.Contains(response.Body.String(), `"turn":1`) {
		t.Fatal(response.Body.String())
	}
	for header, expected := range map[string]string{"Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff"} {
		if response.Header().Get(header) != expected {
			t.Fatalf("missing privacy header %s", header)
		}
	}
	response = apiRequest(handler, "GET", "/api/v2/sessions/"+session.ID, "")
	if response.Code != 200 {
		t.Fatal("resume failed")
	}
}

func TestSameOriginBodyLimitAndSanitizedErrors(t *testing.T) {
	game := testGame(t, nil)
	handler := NewAPI(game, "https://v2.tiantaishiju.top")
	request := httptest.NewRequest("POST", "/api/v2/sessions", strings.NewReader(`{"mode":"rehearsal"}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Origin", "https://attacker.example")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != 403 || response.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatal("cross origin request allowed")
	}
	request = httptest.NewRequest("POST", "/api/v2/sessions", strings.NewReader(`{"mode":"rehearsal"}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Origin", "https://v2.tiantaishiju.top")
	request.Header.Set("Sec-Fetch-Site", "same-origin")
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != 201 {
		t.Fatal("same-origin proxy request rejected", response.Body.String())
	}
	response = apiRequest(handler, "POST", "/api/v2/sessions", `{"mode":"`+strings.Repeat("x", 20<<10)+`"}`)
	if response.Code != 413 {
		t.Fatal("body size limit missing", response.Code)
	}
	response = apiRequest(handler, "GET", "/api/v2/sessions/not-a-capability", "")
	if response.Code != 404 || bytes.Contains(response.Body.Bytes(), []byte(game.store.dir)) {
		t.Fatal("unsafe error")
	}
	response = httptest.NewRecorder()
	writeError(response, fmt.Errorf("key secret /private/file/path"))
	if strings.Contains(response.Body.String(), "secret") || strings.Contains(response.Body.String(), "/private") {
		t.Fatal("internal error leaked")
	}
}

func TestPersistedSessionCapacityAndRateLimit(t *testing.T) {
	game := testGame(t, nil)
	game.store.maxSessions = 1
	handler := NewAPI(game, "")
	first := apiRequest(handler, "POST", "/api/v2/sessions", `{"mode":"rehearsal"}`)
	second := apiRequest(handler, "POST", "/api/v2/sessions", `{"mode":"rehearsal"}`)
	if first.Code != 201 || second.Code != 503 || !strings.Contains(second.Body.String(), "session_capacity") {
		t.Fatal("durable count limit did not apply")
	}
	for i := 0; i < 11; i++ {
		second = apiRequest(handler, "POST", "/api/v2/sessions", `{"mode":"rehearsal"}`)
	}
	if second.Code != 429 || second.Header().Get("Retry-After") == "" {
		t.Fatal("create rate limit did not apply")
	}
}

func TestCreationLimitDoesNotBlockExistingGameOrHealth(t *testing.T) {
	game := testGame(t, nil)
	handler := NewAPI(game, "")
	first := apiRequest(handler, "POST", "/api/v2/sessions", `{"mode":"rehearsal"}`)
	var session Session
	if err := json.Unmarshal(first.Body.Bytes(), &session); err != nil {
		t.Fatal(err)
	}
	for i := 1; i < 13; i++ {
		response := apiRequest(handler, "POST", "/api/v2/sessions", `{"mode":"rehearsal"}`)
		if i == 12 && response.Code != 429 {
			t.Fatal("thirteenth creation must be rate-limited")
		}
	}
	for _, path := range []string{"/api/v2/health", "/api/v2/sessions/" + session.ID} {
		if response := apiRequest(handler, "GET", path, ""); response.Code != 200 {
			t.Fatalf("creation limit blocked an existing read: %s", response.Body.String())
		}
	}
	response := apiRequest(handler, "POST", "/api/v2/sessions/"+session.ID+"/turns", `{"requestId":"request-001","expectedRevision":0,"text":"我还在听。"}`)
	if response.Code != 200 {
		t.Fatalf("creation limit blocked an existing turn: %s", response.Body.String())
	}
}

func TestTrustedProxyIdentityCannotBeSpoofedByDirectClients(t *testing.T) {
	trusted, err := trustedProxyCIDRs("127.0.0.1/32, ::1/128")
	if err != nil {
		t.Fatal(err)
	}
	api := &API{trustedProxies: trusted}
	for _, test := range []struct {
		peer   string
		header []string
		want   string
	}{
		{"127.0.0.1:1234", []string{"198.51.100.20"}, "198.51.100.20"},
		{"[::1]:1234", []string{"2001:db8::20"}, "2001:db8::20"},
		{"192.0.2.1:1234", []string{"198.51.100.20"}, "192.0.2.1"},
		{"127.0.0.1:1234", []string{"198.51.100.20, 198.51.100.21"}, "127.0.0.1"},
		{"127.0.0.1:1234", []string{"198.51.100.20", "198.51.100.21"}, "127.0.0.1"},
		{"127.0.0.1:1234", []string{"not-an-ip"}, "127.0.0.1"},
		{"127.0.0.1:1234", []string{"0.0.0.0"}, "127.0.0.1"},
		{"127.0.0.1:1234", nil, "127.0.0.1"},
	} {
		request := httptest.NewRequest("GET", "/api/v2/health", nil)
		request.RemoteAddr = test.peer
		for _, value := range test.header {
			request.Header.Add("X-Real-IP", value)
		}
		request.Header.Set("X-Forwarded-For", "203.0.113.99")
		if actual := api.clientIP(request); actual != test.want {
			t.Errorf("peer %s header %v: want %s got %s", test.peer, test.header, test.want, actual)
		}
	}
	api.trustedProxies = nil
	request := httptest.NewRequest("GET", "/api/v2/health", nil)
	request.RemoteAddr = "127.0.0.1:1234"
	request.Header.Set("X-Real-IP", "198.51.100.20")
	if got := api.clientIP(request); got != "127.0.0.1" {
		t.Fatal("proxy trust must be opt-in")
	}

	for _, peer := range []string{"192.0.2.1:1234", "127.0.0.1:1234"} {
		limiter := &API{trustedProxies: trusted, rates: make(map[string]rateEntry), now: func() time.Time { return time.Unix(0, 0) }}
		for i := 0; i < 13; i++ {
			request := httptest.NewRequest("POST", "/api/v2/sessions", nil)
			request.RemoteAddr = peer
			request.Header.Set("X-Real-IP", fmt.Sprintf("198.51.100.%d", i+1))
			allowed := limiter.allow(request)
			if peer == "192.0.2.1:1234" && i == 12 && allowed {
				t.Fatal("untrusted forwarded header reset the creation budget")
			}
			if peer == "127.0.0.1:1234" && !allowed {
				t.Fatal("trusted proxy clients did not get independent budgets")
			}
		}
	}
}

func TestOperationalConfigRejectsInvalidCapacityAndProxyNetworks(t *testing.T) {
	for _, raw := range []string{"0", "-1", "100001", "all", "1.5"} {
		if _, err := sessionCapacity(raw); err == nil {
			t.Errorf("bad session capacity accepted: %s", raw)
		}
	}
	if value, err := sessionCapacity(""); err != nil || value != 10000 {
		t.Fatal("default capacity changed")
	}
	if value, err := sessionCapacity("100000"); err != nil || value != 100000 {
		t.Fatal("valid capacity rejected")
	}
	for _, raw := range []string{"127.0.0.1", "localhost/32", "127.0.0.1/33", "0.0.0.0/0", "::/0", "127.0.0.1/32,"} {
		if _, err := trustedProxyCIDRs(raw); err == nil {
			t.Errorf("bad proxy network accepted: %s", raw)
		}
	}
}
