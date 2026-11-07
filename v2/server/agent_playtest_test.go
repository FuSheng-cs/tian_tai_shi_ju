package main

// This opt-in harness is compiled only by go test. It cannot be enabled in the
// shipping API binary. The actor is an independent live model agent, not a script.

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"
)

type agentTraceKey struct{}

type agentTrace struct {
	ID    string
	JobID string
}

type agentQueueTransport struct {
	dir string
}

type agentRequestSummary struct {
	JobID        string    `json:"jobId"`
	HTTPTraceID  string    `json:"httpTraceId,omitempty"`
	Kind         string    `json:"kind"`
	Turn         int       `json:"turn,omitempty"`
	Phase        string    `json:"phase,omitempty"`
	Choice       string    `json:"choice,omitempty"`
	SubmittedAt  time.Time `json:"submittedAt"`
	DeadlineAt   time.Time `json:"deadlineAt"`
	RequestFile  string    `json:"requestFile"`
	ResponseFile string    `json:"responseFile"`
	RequestHash  string    `json:"requestSha256"`
}

func agentID() (string, error) {
	var value [16]byte
	if _, err := rand.Read(value[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(value[:]), nil
}

func agentHash(value []byte) string {
	hash := sha256.Sum256(value)
	return hex.EncodeToString(hash[:])
}

func agentWrite(path string, value []byte) error {
	file, err := os.CreateTemp(filepath.Dir(path), ".writing-*")
	if err != nil {
		return err
	}
	name := file.Name()
	defer os.Remove(name)
	defer file.Close()
	if err := file.Chmod(0600); err != nil {
		return err
	}
	if _, err := file.Write(value); err != nil {
		return err
	}
	if err := file.Sync(); err != nil {
		return err
	}
	if err := file.Close(); err != nil {
		return err
	}
	return os.Rename(name, path)
}

func agentWriteJSON(path string, value any) error {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	return agentWrite(path, data)
}

func (a *agentQueueTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	// No network method exists in this adapter. In particular, never delegate
	// errors to http.DefaultTransport or use a real provider credential.
	if request.Method != http.MethodPost || request.URL.Hostname() != "agent-playtest.invalid" {
		return nil, errors.New("unexpected actor request")
	}
	body, err := io.ReadAll(io.LimitReader(request.Body, 256<<10+1))
	if err != nil || len(body) > 256<<10 {
		return nil, errors.New("invalid actor envelope")
	}
	var envelope struct {
		Messages []struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"messages"`
	}
	if err := json.Unmarshal(body, &envelope); err != nil || len(envelope.Messages) != 2 || envelope.Messages[0].Role != "system" || envelope.Messages[1].Role != "user" {
		return nil, errors.New("unexpected actor message roles")
	}
	var scene struct {
		Task   string `json:"task"`
		Turn   int    `json:"turn"`
		Phase  string `json:"phase"`
		Choice string `json:"choice"`
	}
	if err := json.Unmarshal([]byte(envelope.Messages[1].Content), &scene); err != nil {
		return nil, errors.New("invalid actor scene")
	}
	jobID, err := agentID()
	if err != nil {
		return nil, err
	}
	kind := "turn"
	if scene.Task == "respond_to_ending_offer" {
		kind = "ending"
	}
	now := time.Now().UTC()
	deadline, ok := request.Context().Deadline()
	if !ok {
		deadline = now.Add(45 * time.Second)
	}
	summary := agentRequestSummary{
		JobID: jobID, Kind: kind, Turn: scene.Turn, Phase: scene.Phase, Choice: scene.Choice,
		SubmittedAt: now, DeadlineAt: deadline.UTC(), RequestHash: agentHash(body),
		RequestFile: "queue/" + jobID + ".request.json", ResponseFile: "responses/" + jobID + ".response.json",
	}
	if trace, ok := request.Context().Value(agentTraceKey{}).(*agentTrace); ok {
		trace.JobID = jobID
		summary.HTTPTraceID = trace.ID
	}
	if err := agentWrite(filepath.Join(a.dir, filepath.FromSlash(summary.RequestFile)), body); err != nil {
		return nil, errors.New("cannot save actor request")
	}
	if err := agentWriteJSON(filepath.Join(a.dir, "queue", jobID+".summary.json"), summary); err != nil {
		return nil, errors.New("cannot save actor summary")
	}
	resultPath := filepath.Join(a.dir, "queue", jobID+".result.json")
	finish := func(status string, response []byte) {
		_ = agentWriteJSON(resultPath, map[string]any{
			"jobId": jobID, "httpTraceId": summary.HTTPTraceID, "status": status,
			"finishedAt": time.Now().UTC(), "requestSha256": summary.RequestHash,
			"responseSha256": agentHash(response), "responseBytes": len(response),
		})
	}
	ticker := time.NewTicker(75 * time.Millisecond)
	defer ticker.Stop()
	responsePath := filepath.Join(a.dir, filepath.FromSlash(summary.ResponseFile))
	for {
		select {
		case <-request.Context().Done():
			finish("timeout_or_cancelled", nil)
			return nil, request.Context().Err()
		case <-ticker.C:
			info, err := os.Lstat(responsePath)
			if errors.Is(err, os.ErrNotExist) {
				continue
			}
			if err != nil || !info.Mode().IsRegular() || info.Size() > 32<<10 {
				finish("invalid_response_file", nil)
				return nil, errors.New("invalid actor response file")
			}
			response, err := os.ReadFile(responsePath)
			if err != nil {
				finish("unreadable_response_file", nil)
				return nil, errors.New("cannot read actor response")
			}
			// The original bytes go directly to the production decoder. Do not
			// trim fences, fix quotation marks, shorten prose, or fabricate memory.
			wrapped, err := json.Marshal(map[string]any{"choices": []any{map[string]any{
				"message": map[string]string{"content": string(response)}, "finish_reason": "stop",
			}}})
			if err != nil {
				return nil, err
			}
			finish("delivered_to_production_validator", response)
			return &http.Response{
				StatusCode: http.StatusOK, Header: http.Header{"Content-Type": {"application/json"}},
				Body: io.NopCloser(bytes.NewReader(wrapped)), Request: request,
			}, nil
		}
	}
}

func agentOperation(request *http.Request) string {
	path := request.URL.Path
	switch {
	case path == "/api/v2/health":
		return "health"
	case path == "/api/v2/sessions":
		return "create"
	case strings.HasSuffix(path, "/turns"):
		return "turn"
	case strings.HasSuffix(path, "/ending"):
		return "ending"
	case strings.HasSuffix(path, "/observations"):
		return "observation"
	default:
		return "read_or_other"
	}
}

func agentTraceHandler(dir string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		traceID, err := agentID()
		if err != nil {
			http.Error(w, "cannot initialize local trace", http.StatusInternalServerError)
			return
		}
		trace := &agentTrace{ID: traceID}
		started := time.Now().UTC()
		capture := httptest.NewRecorder()
		next.ServeHTTP(capture, request.WithContext(context.WithValue(request.Context(), agentTraceKey{}, trace)))
		var snapshot map[string]json.RawMessage
		if err := json.Unmarshal(capture.Body.Bytes(), &snapshot); err == nil {
			delete(snapshot, "id") // Session capability never enters actor traces.
		}
		_ = agentWriteJSON(filepath.Join(dir, "traces", traceID+".json"), map[string]any{
			"httpTraceId": traceID, "jobId": trace.JobID, "operation": agentOperation(request),
			"startedAt": started, "finishedAt": time.Now().UTC(), "httpStatus": capture.Code,
			"snapshot": snapshot,
		})
		for key, values := range capture.Header() {
			w.Header()[key] = values
		}
		w.Header().Set("X-Local-Playtest-Trace", traceID)
		w.WriteHeader(capture.Code)
		_, _ = w.Write(capture.Body.Bytes())
	})
}

func agentPlaytestDirectory(raw string) (string, error) {
	allowed, err := filepath.Abs(filepath.Join("..", ".run"))
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(raw) == "" {
		raw = filepath.Join(allowed, "agent-playtest")
	}
	dir, err := filepath.Abs(raw)
	if err != nil {
		return "", err
	}
	relative, err := filepath.Rel(allowed, dir)
	if err != nil || relative == "." || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
		return "", errors.New("actor queue must be inside ignored v2/.run, in its own directory")
	}
	if err := os.MkdirAll(dir, 0700); err != nil {
		return "", err
	}
	info, err := os.Lstat(dir)
	if err != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
		return "", errors.New("actor queue must be a real directory")
	}
	if runtime.GOOS == "windows" {
		account, err := user.Current()
		if err != nil {
			return "", errors.New("cannot identify local queue owner")
		}
		// Restrict this ignored test directory to its user and LocalSystem.
		// Never print command output, which includes local account details.
		cmd := exec.Command("icacls", dir, "/inheritance:r", "/grant:r", "*"+account.Uid+":(OI)(CI)F", "*S-1-5-18:(OI)(CI)F")
		if err := cmd.Run(); err != nil {
			return "", errors.New("cannot restrict local queue permissions")
		}
	} else if err := os.Chmod(dir, 0700); err != nil {
		return "", err
	}
	for _, name := range []string{"queue", "responses", "traces", "sessions"} {
		if err := os.MkdirAll(filepath.Join(dir, name), 0700); err != nil {
			return "", err
		}
	}
	return dir, nil
}

func TestAgentPlaytestServer(t *testing.T) {
	if os.Getenv("V2_AGENT_PLAYTEST") != "1" {
		t.Skip("local actor bridge requires explicit V2_AGENT_PLAYTEST=1")
	}
	dir, err := agentPlaytestDirectory(os.Getenv("V2_AGENT_PLAYTEST_DIR"))
	if err != nil {
		t.Fatal("cannot initialize local actor directory:", err)
	}
	if _, err := os.Stat(filepath.Join(dir, "STOP")); err == nil {
		t.Fatal("this run has a STOP marker; choose a fresh ignored run directory")
	}
	minutes := 120
	if raw := os.Getenv("V2_AGENT_PLAYTEST_MINUTES"); raw != "" {
		minutes, err = strconv.Atoi(raw)
		if err != nil || minutes < 1 || minutes > 240 {
			t.Fatal("V2_AGENT_PLAYTEST_MINUTES must be between 1 and 240")
		}
	}
	store, err := NewStore(filepath.Join(dir, "sessions"))
	if err != nil {
		t.Fatal("cannot initialize local playtest storage")
	}
	narrator, err := NewModelNarrator("https://agent-playtest.invalid/v1", "local-placeholder-not-a-provider-key", "independent-live-model-agent")
	if err != nil {
		t.Fatal("cannot initialize production narrator for local bridge")
	}
	narrator.lookup = func(context.Context, string) ([]net.IPAddr, error) {
		return []net.IPAddr{{IP: net.ParseIP("8.8.8.8")}}, nil
	}
	narrator.client.Transport = &agentQueueTransport{dir: dir}
	// Preserve the real narrator's 45-second timeout and redirect policy.
	server := &http.Server{
		Addr: "127.0.0.1:8083", Handler: agentTraceHandler(dir, NewAPI(NewGame(store, narrator), "")),
		ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second,
		WriteTimeout: 60 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 8 << 10,
	}
	listener, err := net.Listen("tcp", server.Addr)
	if err != nil {
		t.Fatal("local actor listener unavailable; no other process was changed")
	}
	defer listener.Close()
	ready := map[string]any{
		"kind": "local-only independent live-model agent bridge", "listen": server.Addr,
		"startedAt": time.Now().UTC(), "maxMinutes": minutes, "providerTimeoutSeconds": 45,
		"queueDirectory": "queue", "responseDirectory": "responses", "traceDirectory": "traces",
		"quitMarker": "STOP", "networkProviderVerified": false,
	}
	if err := agentWriteJSON(filepath.Join(dir, "ready.json"), ready); err != nil {
		t.Fatal("cannot write local bridge readiness")
	}
	t.Log("local actor bridge ready at 127.0.0.1:8083; requests wait for independently generated JSON")
	done := make(chan error, 1)
	go func() { done <- server.Serve(listener) }()
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	expires := time.NewTimer(time.Duration(minutes) * time.Minute)
	defer expires.Stop()
	wait := true
	for wait {
		select {
		case err := <-done:
			if !errors.Is(err, http.ErrServerClosed) {
				t.Fatal("local actor server stopped unexpectedly")
			}
			wait = false
		case <-expires.C:
			wait = false
		case <-ticker.C:
			if _, err := os.Stat(filepath.Join(dir, "STOP")); err == nil {
				wait = false
			}
		}
	}
	shutdown, cancel := context.WithTimeout(context.Background(), 55*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdown); err != nil {
		_ = server.Close()
		t.Fatal("local actor server required a forced close after grace period")
	}
	_ = agentWriteJSON(filepath.Join(dir, "stopped.json"), map[string]any{"stoppedAt": time.Now().UTC()})
}

func TestAgentQueuePreservesProductionEnvelopeAndRawResponse(t *testing.T) {
	dir := t.TempDir()
	for _, name := range []string{"queue", "responses"} {
		if err := os.Mkdir(filepath.Join(dir, name), 0700); err != nil {
			t.Fatal(err)
		}
	}
	body := []byte(`{"model":"actor","messages":[{"role":"system","content":"JSON only"},{"role":"user","content":"{\"turn\":1,\"phase\":\"arrival\",\"playerLine\":\"门留着。\"}"}]}`)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	request, _ := http.NewRequestWithContext(ctx, http.MethodPost, "https://agent-playtest.invalid/v1/chat/completions", bytes.NewReader(body))
	request.Header.Set("Authorization", "Bearer must-not-be-written")
	var workers sync.WaitGroup
	workers.Add(1)
	go func() {
		defer workers.Done()
		for ctx.Err() == nil {
			files, _ := filepath.Glob(filepath.Join(dir, "queue", "*.summary.json"))
			if len(files) == 1 {
				data, _ := os.ReadFile(files[0])
				var summary agentRequestSummary
				if err := json.Unmarshal(data, &summary); err != nil {
					t.Error(err)
					return
				}
				original, _ := os.ReadFile(filepath.Join(dir, filepath.FromSlash(summary.RequestFile)))
				if !bytes.Equal(original, body) || summary.Turn != 1 || summary.RequestHash != agentHash(body) || bytes.Contains(original, []byte("must-not-be-written")) {
					t.Error("actor envelope changed or leaked header")
				}
				// Deliberately invalid prose is preserved for the real parser to reject.
				if err := agentWrite(filepath.Join(dir, filepath.FromSlash(summary.ResponseFile)), []byte("```json\n{\"reply\":\"嗯。\"}\n```")); err != nil {
					t.Error(err)
				}
				return
			}
			time.Sleep(10 * time.Millisecond)
		}
	}()
	response, err := (&agentQueueTransport{dir: dir}).RoundTrip(request)
	workers.Wait()
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	var completion struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(response.Body).Decode(&completion); err != nil || completion.Choices[0].Message.Content != "```json\n{\"reply\":\"嗯。\"}\n```" {
		t.Fatal("adapter changed actor output", err)
	}
	if _, err := decodeNarrative(completion.Choices[0].Message.Content, TurnCommand{}); err == nil {
		t.Fatal("production validator accepted invalid actor JSON")
	}
}

func TestAgentQueueCancellationLeavesAnAuditResult(t *testing.T) {
	dir := t.TempDir()
	for _, name := range []string{"queue", "responses"} {
		if err := os.Mkdir(filepath.Join(dir, name), 0700); err != nil {
			t.Fatal(err)
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Millisecond)
	defer cancel()
	request, _ := http.NewRequestWithContext(ctx, http.MethodPost, "https://agent-playtest.invalid/v1/chat/completions", strings.NewReader(`{"messages":[{"role":"system","content":"JSON"},{"role":"user","content":"{}"}]}`))
	if _, err := (&agentQueueTransport{dir: dir}).RoundTrip(request); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatal("actor deadline was not propagated", err)
	}
	files, _ := filepath.Glob(filepath.Join(dir, "queue", "*.result.json"))
	if len(files) != 1 {
		t.Fatal("timeout has no audit result")
	}
	data, _ := os.ReadFile(files[0])
	if !strings.Contains(string(data), "timeout_or_cancelled") {
		t.Fatal("timeout was not reported honestly")
	}
}

func TestAgentTraceRedactsSessionCapability(t *testing.T) {
	dir := t.TempDir()
	if err := os.Mkdir(filepath.Join(dir, "traces"), 0700); err != nil {
		t.Fatal(err)
	}
	capability := strings.Repeat("a", 64)
	handler := agentTraceHandler(dir, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]any{"id": capability, "turn": 0, "revision": 0})
	}))
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v2/sessions/"+capability, nil))
	files, _ := filepath.Glob(filepath.Join(dir, "traces", "*.json"))
	if len(files) != 1 || response.Header().Get("X-Local-Playtest-Trace") == "" {
		t.Fatal("safe trace missing")
	}
	data, _ := os.ReadFile(files[0])
	if bytes.Contains(data, []byte(capability)) || !bytes.Contains(response.Body.Bytes(), []byte(capability)) {
		t.Fatal("trace redaction changed API or leaked capability")
	}
}
