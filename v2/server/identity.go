package main

import (
	"net/http"
	"strings"
)

// Identity is a response-only projection of something the character has
// already said. It is deliberately absent from saves, receipts and prompts.
type publicIdentity struct {
	Name            string `json:"name"`
	SourceMessageID string `json:"sourceMessageId"`
}

type publicScene struct {
	Location        string `json:"location"`
	SourceMessageID string `json:"sourceMessageId"`
}

type sessionResponse struct {
	Session
	Identity *publicIdentity `json:"identity,omitempty"`
	Scene    *publicScene    `json:"scene,omitempty"`
}

func projectSession(session Session) sessionResponse {
	response := sessionResponse{Session: session}
	for _, message := range session.Messages {
		if response.Identity == nil && message.Role == "character" && message.ID != "" && introducesCanonicalName(message.Text) {
			response.Identity = &publicIdentity{Name: "艾", SourceMessageID: message.ID}
		}
		if message.Role == "narrator" && message.ID != "" {
			if location := narratedLocation(message.Text); location != "" {
				response.Scene = &publicScene{Location: location, SourceMessageID: message.ID}
			}
		}
	}
	return response
}

func writeSession(w http.ResponseWriter, status int, session Session) {
	writeJSON(w, status, projectSession(session))
}

func introducesCanonicalName(text string) bool {
	// Only a few unequivocal canonical self-introduction sentences qualify.
	// The introduction itself must be outside quotation spans and declarative.
	// Later unrelated questions or quoted words do not undo a clear introduction.
	text = outsideQuotedSpans(text)
	if strings.ContainsAny(text, ":：") {
		return false // A colon can introduce an unmarked quotation or example.
	}
	for _, marker := range []string{
		"如果", "假如", "假设", "要是", "假装", "扮演", "比如", "例如", "例句", "示范",
		"台词", "这句话", "这几个字", "让我说", "你要说", "你可以说", "照着说", "请说", "请写", "请念", "写道", "说道",
		"不叫艾", "不是艾", "不是我的名字", "不是真名", "不是真的", "是假的", "说错了", "才怪", "开玩笑", "骗你",
	} {
		if strings.Contains(text, marker) {
			return false
		}
	}
	sentences := strings.FieldsFunc(text, func(value rune) bool {
		return strings.ContainsRune("。.!！;；\n\r…", value)
	})
	for _, sentence := range sentences {
		switch strings.TrimSpace(sentence) {
		case "我叫艾", "叫我艾", "我叫艾，艾草的艾", "我叫艾,艾草的艾":
			return true
		}
	}
	return false
}

func outsideQuotedSpans(text string) string {
	var output strings.Builder
	var closing rune
	for _, value := range text {
		if closing != 0 {
			if value == closing {
				closing = 0
			}
			continue
		}
		switch value {
		case '"', '\'', '`':
			closing = value
		case '“':
			closing = '”'
		case '‘':
			closing = '’'
		case '「':
			closing = '」'
		case '『':
			closing = '』'
		case '”', '’', '」', '』':
			return "\ufffc" // An unmatched closing quote leaves authorship unclear.
		}
		if closing != 0 {
			// Preserve a non-word barrier instead of deleting quoted words and
			// accidentally joining fragments into a self-introduction.
			output.WriteRune('\ufffc')
			continue
		}
		output.WriteRune(value)
	}
	return output.String()
}

func narratedLocation(text string) string {
	// A phase or an invitation is not movement. Recognize only completed,
	// character-owned movement clauses; unknown descriptions retain the last
	// proved location. The response source always points to accepted narration.
	if strings.ContainsAny(text, "\"'`“”‘’「」『』?？:：") {
		return ""
	}
	for _, marker := range []string{"如果", "假如", "假设", "要是", "仿佛", "想象", "比如", "例如", "例句", "示范", "这句话", "可能", "似乎", "并没有", "其实没有"} {
		if strings.Contains(text, marker) {
			return ""
		}
	}
	// This existing authored action has an explicit subject but a carried
	// subject after the comma. Keep its recognition exact rather than infer
	// general consent or compound-action grammar.
	if text == "她抱好纸袋，自己走到门内那块干燥地面旁。" {
		return "threshold"
	}
	location := ""
	clauses := strings.FieldsFunc(text, func(value rune) bool {
		return strings.ContainsRune("，,。.!！;；\n\r", value)
	})
	for _, raw := range clauses {
		clause := strings.TrimSpace(raw)
		for _, prefix := range []string{"她慢慢", "她缓缓"} {
			if strings.HasPrefix(clause, prefix) {
				clause = "她" + strings.TrimPrefix(clause, prefix)
				break
			}
		}
		switch clause {
		case "她走进门内", "她走进楼道", "她走进楼梯间", "她跨过门槛走进楼梯间":
			location = "threshold"
		case "她走回天台", "她回到天台", "她退回天台", "她走回屋顶":
			location = "rooftop"
		}
	}
	return location
}
