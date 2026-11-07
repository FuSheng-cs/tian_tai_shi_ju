package main

import (
	"context"
	"errors"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"
)

func envOr(name, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(name)); value != "" {
		return value
	}
	return fallback
}

func run() error {
	capacity, err := sessionCapacity(os.Getenv("V2_MAX_SESSIONS"))
	if err != nil {
		return err
	}
	trustedProxies, err := trustedProxyCIDRs(os.Getenv("V2_TRUSTED_PROXY_CIDRS"))
	if err != nil {
		return err
	}
	store, err := NewStore(envOr("V2_DATA_DIR", "/workspace/.cache/tiantai-v2"))
	if err != nil {
		return errors.New("cannot initialize v2 session storage")
	}
	store.maxSessions = capacity
	var narrator Narrator
	key, model := strings.TrimSpace(os.Getenv("V2_LLM_API_KEY")), strings.TrimSpace(os.Getenv("V2_LLM_MODEL"))
	if key != "" && model != "" {
		narrator, err = NewModelNarrator(envOr("V2_LLM_BASE_URL", "https://api.openai.com/v1"), key, model)
		if err != nil {
			return errors.New("invalid v2 model configuration; check HTTPS public endpoint and model fields")
		}
	}
	origin := strings.TrimRight(strings.TrimSpace(os.Getenv("V2_PUBLIC_ORIGIN")), "/")
	if origin != "" {
		u, err := url.Parse(origin)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || u.User != nil || u.Path != "" || u.RawQuery != "" || u.Fragment != "" {
			return errors.New("V2_PUBLIC_ORIGIN must be a single HTTP(S) origin")
		}
	}
	server := &http.Server{
		Addr: envOr("V2_LISTEN_ADDR", "127.0.0.1:8082"), Handler: NewAPI(NewGame(store, narrator), origin, trustedProxies...),
		ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second,
		WriteTimeout: 60 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 8 << 10,
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	done := make(chan error, 1)
	go func() { done <- server.ListenAndServe() }()
	log.Printf("Tiantai v2 API ready; AI configured: %t", narrator != nil)
	select {
	case err := <-done:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return errors.New("v2 API listener failed")
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 55*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			_ = server.Close()
			return errors.New("v2 API shutdown timed out")
		}
		return nil
	}
}

func sessionCapacity(raw string) (int, error) {
	if strings.TrimSpace(raw) == "" {
		return 10000, nil
	}
	value, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || value < 1 || value > 100000 {
		return 0, errors.New("V2_MAX_SESSIONS must be an integer between 1 and 100000")
	}
	return value, nil
}

func trustedProxyCIDRs(raw string) ([]*net.IPNet, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, nil
	}
	values := strings.Split(raw, ",")
	if len(values) > 32 {
		return nil, errors.New("V2_TRUSTED_PROXY_CIDRS contains too many networks")
	}
	networks := make([]*net.IPNet, 0, len(values))
	for _, value := range values {
		_, network, err := net.ParseCIDR(strings.TrimSpace(value))
		if err != nil {
			return nil, errors.New("V2_TRUSTED_PROXY_CIDRS must contain comma-separated IP CIDRs")
		}
		ones, _ := network.Mask.Size()
		if ones == 0 {
			return nil, errors.New("V2_TRUSTED_PROXY_CIDRS cannot trust all addresses")
		}
		networks = append(networks, network)
	}
	return networks, nil
}

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}
