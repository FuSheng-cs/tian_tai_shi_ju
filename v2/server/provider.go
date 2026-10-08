package main

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"
)

type ModelNarrator struct {
	endpoint string
	apiKey   string
	model    string
	client   *http.Client
	lookup   func(context.Context, string) ([]net.IPAddr, error)
	permits  chan struct{}
}

func modelEndpoint(base string) (*url.URL, error) {
	u, err := url.Parse(strings.TrimSpace(base))
	if err != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || (u.Port() != "" && u.Port() != "443") {
		return nil, errors.New("V2_LLM_BASE_URL must be a public HTTPS URL on port 443 without credentials or query")
	}
	host := strings.ToLower(strings.TrimSuffix(u.Hostname(), "."))
	if host == "localhost" || strings.HasSuffix(host, ".localhost") || strings.HasSuffix(host, ".local") || strings.HasSuffix(host, ".internal") || !strings.Contains(host, ".") {
		return nil, errors.New("V2_LLM_BASE_URL must use a public host")
	}
	if ip := net.ParseIP(host); ip != nil && !publicIP(ip) {
		return nil, errors.New("V2_LLM_BASE_URL cannot address a private network")
	}
	u.Path = strings.TrimRight(u.Path, "/")
	if u.Path == "" {
		u.Path = "/v1"
	}
	if !strings.HasSuffix(u.Path, "/chat/completions") {
		u.Path += "/chat/completions"
	}
	return u, nil
}

func publicIP(ip net.IP) bool {
	if !ip.IsGlobalUnicast() || ip.IsPrivate() || ip.IsLoopback() || ip.IsUnspecified() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
		return false
	}
	// Include non-public ranges not covered by net.IP.IsPrivate, notably
	// carrier NAT, metadata services, documentation, and benchmark ranges.
	blocked := []string{
		"0.0.0.0/8", "100.64.0.0/10", "192.0.0.0/24", "192.0.2.0/24",
		"198.18.0.0/15", "198.51.100.0/24", "203.0.113.0/24", "240.0.0.0/4",
		"2001:db8::/32", "2001::/32", "2001:2::/48", "2002::/16", "64:ff9b::/96", "64:ff9b:1::/48", "fec0::/10", "100::/64",
	}
	for _, raw := range blocked {
		_, block, _ := net.ParseCIDR(raw)
		if block.Contains(ip) {
			return false
		}
	}
	return true
}

func resolvePublic(ctx context.Context, host string, lookup func(context.Context, string) ([]net.IPAddr, error)) ([]net.IPAddr, error) {
	addresses, err := lookup(ctx, host)
	if err != nil || len(addresses) == 0 {
		return nil, errors.New("model host lookup failed")
	}
	for _, address := range addresses {
		if !publicIP(address.IP) {
			return nil, errors.New("model host resolved to a non-public address")
		}
	}
	return addresses, nil
}

func NewModelNarrator(base, apiKey, model string) (*ModelNarrator, error) {
	endpoint, err := modelEndpoint(base)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(apiKey) == "" || strings.TrimSpace(model) == "" || strings.ContainsAny(apiKey+model, "\r\n") || len(model) > 150 {
		return nil, errors.New("model credentials are incomplete")
	}
	narrator := &ModelNarrator{
		endpoint: endpoint.String(), apiKey: apiKey, model: model,
		lookup: net.DefaultResolver.LookupIPAddr, permits: make(chan struct{}, 8),
	}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.TLSClientConfig = &tls.Config{MinVersion: tls.VersionTLS12}
	transport.ResponseHeaderTimeout = 40 * time.Second
	transport.MaxIdleConnsPerHost = 8
	transport.Proxy = http.ProxyFromEnvironment
	proxy, err := http.ProxyFromEnvironment(&http.Request{URL: endpoint})
	if err != nil {
		return nil, errors.New("invalid environment proxy")
	}
	dialer := &net.Dialer{Timeout: 10 * time.Second, KeepAlive: 30 * time.Second}
	transport.DialContext = func(ctx context.Context, network, address string) (net.Conn, error) {
		// A platform-configured proxy is trusted infrastructure. Its connection
		// may be private; the requested model destination is still validated
		// before every request. Direct requests are pinned to validated DNS IPs.
		if proxy != nil {
			return dialer.DialContext(ctx, network, address)
		}
		host, port, err := net.SplitHostPort(address)
		if err != nil || !strings.EqualFold(host, endpoint.Hostname()) {
			return nil, errors.New("unexpected model destination")
		}
		addresses, err := resolvePublic(ctx, host, narrator.lookup)
		if err != nil {
			return nil, err
		}
		for _, resolved := range addresses {
			connection, err := dialer.DialContext(ctx, network, net.JoinHostPort(resolved.IP.String(), port))
			if err == nil {
				return connection, nil
			}
		}
		return nil, errors.New("model connection failed")
	}
	narrator.client = &http.Client{
		Timeout: 45 * time.Second, Transport: transport,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return errors.New("model redirects are disabled") },
	}
	return narrator, nil
}

func (m *ModelNarrator) Generate(ctx context.Context, session Session, command TurnCommand) (Narrative, error) {
	// The browser never supplies role-labelled history or system text. The
	// sole user message is a JSON data envelope assembled from durable facts.
	observations := make([]string, 0, len(session.Observations))
	for _, id := range session.Observations {
		observations = append(observations, observationText(id))
	}
	payload, err := json.Marshal(struct {
		Turn              int       `json:"turn"`
		Phase             string    `json:"phase"`
		Transcript        []Message `json:"transcript"`
		Memories          []Memory  `json:"memories"`
		KnownObservations []string  `json:"knownObservations"`
		Observation       string    `json:"observation"`
		PlayerLine        string    `json:"playerLine"`
		PlayerIntent      string    `json:"playerIntent,omitempty"`
	}{session.Turn + 1, phaseForTurn(session.Turn + 1), session.Messages, session.Memories, observations, observationText(command.Observation), command.Text, command.Intent})
	if err != nil {
		return Narrative{}, err
	}
	raw, err := m.complete(ctx, narrativePrompt, payload)
	if err != nil {
		return Narrative{}, err
	}
	return decodeNarrative(raw, command)
}

func (m *ModelNarrator) Finalize(ctx context.Context, session Session, command EndingCommand) (FinalNarrative, error) {
	payload, err := json.Marshal(struct {
		Task       string    `json:"task"`
		Choice     string    `json:"choice"`
		Transcript []Message `json:"transcript"`
		Memories   []Memory  `json:"memories"`
	}{"respond_to_ending_offer", command.Choice, session.Messages, session.Memories})
	if err != nil {
		return FinalNarrative{}, err
	}
	raw, err := m.complete(ctx, finalePrompt, payload)
	if err != nil {
		return FinalNarrative{}, err
	}
	var result FinalNarrative
	if err := decodeObject([]byte(raw), &result, []string{"reply", "narration"}, nil); err != nil {
		return FinalNarrative{}, errors.New("model returned invalid finale JSON")
	}
	if err := validateFinalNarrative(result); err != nil {
		return FinalNarrative{}, err
	}
	return result, nil
}

func (m *ModelNarrator) complete(ctx context.Context, system string, payload []byte) (string, error) {
	select {
	case m.permits <- struct{}{}:
		defer func() { <-m.permits }()
	default:
		return "", errors.New("model concurrency limit")
	}
	endpoint, _ := url.Parse(m.endpoint)
	if _, err := resolvePublic(ctx, endpoint.Hostname(), m.lookup); err != nil {
		return "", err
	}
	type promptMessage struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}
	body, err := json.Marshal(struct {
		Model          string            `json:"model"`
		Messages       []promptMessage   `json:"messages"`
		Temperature    float64           `json:"temperature"`
		MaxTokens      int               `json:"max_tokens"`
		ResponseFormat map[string]string `json:"response_format"`
	}{m.model, []promptMessage{{"system", system}, {"user", string(payload)}}, 0.72, 700, map[string]string{"type": "json_object"}})
	if err != nil {
		return "", err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, m.endpoint, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+m.apiKey)
	response, err := m.client.Do(request)
	if err != nil {
		return "", errors.New("model request failed")
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return "", errors.New("model provider rejected request")
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, 128<<10+1))
	if err != nil || len(data) > 128<<10 {
		return "", errors.New("invalid model response size")
	}
	var envelope struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
			FinishReason string `json:"finish_reason"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(data, &envelope); err != nil || len(envelope.Choices) != 1 || envelope.Choices[0].FinishReason != "stop" {
		return "", errors.New("model response incomplete")
	}
	return envelope.Choices[0].Message.Content, nil
}

func validateFinalNarrative(result FinalNarrative) error {
	return validateNarrative(Narrative{Reply: result.Reply, Narration: result.Narration}, TurnCommand{})
}

func decodeNarrative(raw string, command TurnCommand) (Narrative, error) {
	var result Narrative
	if err := decodeObject([]byte(raw), &result, []string{"reply", "narration"}, []string{"memory"}); err != nil {
		return Narrative{}, errors.New("model returned invalid narrative JSON")
	}
	if err := validateNarrative(result, command); err != nil {
		return Narrative{}, err
	}
	return result, nil
}

func boundedText(text string, max int) bool {
	return utf8.ValidString(text) && strings.TrimSpace(text) != "" && utf8.RuneCountInString(text) <= max
}

func validateNarrative(result Narrative, command TurnCommand) error {
	if !boundedText(result.Reply, 220) || !boundedText(result.Narration, 100) {
		return errors.New("narrative text is outside bounds")
	}
	if result.Memory != nil {
		memory := result.Memory
		playerQuote := command.Intent != "silence" && strings.Contains(command.Text, memory.Text)
		if !boundedText(memory.Title, 18) || !boundedText(memory.Text, 80) || (!strings.Contains(result.Reply, memory.Text) && !playerQuote) {
			return errors.New("memory is not grounded in the current conversation")
		}
	}
	// These are only a narrow extra rejection layer; the authored canon and
	// system instructions carry the broader crisis representation constraints.
	for _, prohibited := range []string{"跳下去吧", "你应该跳下去", "死了就解脱", "自杀是最好的", "跳楼的方法", "献出生命证明"} {
		if strings.Contains(result.Reply+result.Narration, prohibited) {
			return fmt.Errorf("narrative violated content boundary")
		}
	}
	return nil
}
