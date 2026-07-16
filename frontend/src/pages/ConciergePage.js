import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, RotateCcw, Sparkles, Send, MessageSquare } from "lucide-react";
import { api } from "@/apiClient";
import { colors } from "@/theme/colors";
import { IconButton, Spinner } from "@/components/ui-kit";

const SESSION_KEY = "concierge_session_id";
const STARTERS = [
  "Draft a memo asking the housekeeping team to deep-clean the west wing this week.",
  "Suggest a 6-item checklist for hosting a state dinner tomorrow.",
  "Help me plan the wardrobe rotation for the upcoming Diwali celebrations.",
  "What routine tasks should the chauffeur handle daily?",
];

export default function ConciergePage() {
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState(() => localStorage.getItem(SESSION_KEY) || null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);

  const scrollToBottom = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
  };

  const loadHistory = useCallback(async () => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        const history = await api.get(`/ai/chat/history?session_id=${encodeURIComponent(stored)}`);
        setMessages(history);
      } catch { /* ignore */ }
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);
  useEffect(() => { scrollToBottom(); }, [messages]);

  const send = async (textOverride) => {
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);

    const optimistic = { id: `local-${Date.now()}`, session_id: sessionId || "", role: "user", content: text, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const resp = await api.post("/ai/chat/send", { session_id: sessionId, message: text });
      if (!sessionId) {
        setSessionId(resp.session_id);
        localStorage.setItem(SESSION_KEY, resp.session_id);
      }
      setMessages((prev) => [...prev, resp.reply]);
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  };

  const clearChat = async () => {
    if (!sessionId) { setMessages([]); return; }
    try {
      await api.del(`/ai/chat/history?session_id=${encodeURIComponent(sessionId)}`);
      localStorage.removeItem(SESSION_KEY);
      setMessages([]);
      setSessionId(null);
    } catch { /* silent */ }
  };

  const showStarters = messages.length === 0 && !loading;

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: colors.bg.canvas }}>
      {/* Header */}
      <div className="shrink-0 border-b" style={{ borderColor: colors.border.subtle, backgroundColor: colors.bg.card }}>
        <div className="max-w-3xl mx-auto w-full flex items-center gap-3 px-4 py-3">
          <IconButton
            testId="concierge-back"
            icon={<ChevronLeft size={18} />}
            label="Back"
            variant="outline"
            size={38}
            onClick={() => navigate(-1)}
          />
          <div className="flex-1 text-center">
            <p className="text-[9.5px] tracking-[2.5px] font-bold mb-0.5" style={{ color: colors.brand.gold }}>ROYAL CONCIERGE · AI</p>
            <h1 className="font-display text-lg font-bold" style={{ color: colors.brand.maroon }}>AI Concierge</h1>
          </div>
          <IconButton
            testId="concierge-clear"
            icon={<RotateCcw size={17} />}
            label="Clear chat"
            variant="outline"
            size={38}
            onClick={clearChat}
          />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scroll-elegant">
        <div className="max-w-3xl mx-auto w-full px-4 pt-5 pb-4">
          {loading ? (
            <Spinner />
          ) : (
            <>
              {showStarters && <WelcomeCard onPick={(t) => send(t)} />}
              {messages.map((msg) => <Bubble key={msg.id} msg={msg} />)}
              {sending && <TypingBubble />}
              <div ref={bottomRef} />
            </>
          )}
        </div>
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t" style={{ borderColor: colors.border.subtle, backgroundColor: colors.bg.card }}>
        <div className="max-w-3xl mx-auto w-full px-4 py-3">
          <div
            className="flex items-end gap-2 rounded-2xl border pl-4 pr-2 py-2 shadow-card"
            style={{ backgroundColor: colors.bg.canvas, borderColor: colors.border.subtle }}
          >
            <textarea
              data-testid="concierge-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask the concierge…"
              disabled={sending}
              rows={1}
              className="flex-1 bg-transparent outline-none text-[15px] py-2 resize-none max-h-[120px]"
              style={{ color: colors.text.primary }}
            />
            <button
              data-testid="concierge-send"
              onClick={() => send()}
              disabled={sending || !input.trim()}
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              style={{ backgroundColor: colors.brand.maroon, opacity: sending || !input.trim() ? 0.5 : 1 }}
            >
              {sending ? (
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <Send size={16} style={{ color: colors.text.inverse }} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WelcomeCard({ onPick }) {
  return (
    <div className="flex flex-col items-center px-2 pt-8 pb-2" data-testid="concierge-welcome">
      <span
        className="w-16 h-16 rounded-2xl border-[1.5px] flex items-center justify-center mb-4"
        style={{ borderColor: colors.brand.gold, backgroundColor: "rgba(212,175,55,0.12)" }}
      >
        <Sparkles size={26} style={{ color: colors.brand.gold }} />
      </span>
      <h2 className="font-display text-2xl font-bold mb-1.5" style={{ color: colors.brand.maroon }}>At your service.</h2>
      <p className="text-[13.5px] text-center leading-5 mb-6 px-2 max-w-md" style={{ color: colors.text.secondary }}>
        I can draft memos, suggest checklists, plan events, or answer questions about household operations.
      </p>
      <p className="text-[10.5px] tracking-[2px] font-bold mb-2.5 self-start" style={{ color: colors.text.muted }}>SUGGESTED ENQUIRIES</p>
      <div className="w-full flex flex-col gap-2">
        {STARTERS.map((s, i) => (
          <button
            key={i}
            data-testid={`concierge-starter-${i}`}
            onClick={() => onPick(s)}
            className="w-full flex items-center gap-2.5 p-3.5 rounded-xl border text-left transition-all hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            style={{ backgroundColor: colors.bg.card, borderColor: colors.border.subtle }}
          >
            <MessageSquare size={14} style={{ color: colors.brand.gold }} className="shrink-0" />
            <span className="flex-1 text-[13px] leading-[18px]" style={{ color: colors.text.secondary }}>{s}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Bubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex items-end gap-2 mb-3 ${isUser ? "justify-end" : "justify-start"}`} data-testid={`msg-${msg.role}`}>
      {!isUser && (
        <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mb-0.5" style={{ backgroundColor: colors.brand.maroon }}>
          <Sparkles size={13} style={{ color: colors.brand.gold }} />
        </span>
      )}
      <div
        className={`max-w-[75%] px-4 py-3 rounded-2xl shadow-card ${isUser ? "rounded-br-md" : "rounded-bl-md border"}`}
        style={{
          backgroundColor: isUser ? colors.brand.maroon : colors.bg.card,
          borderColor: isUser ? undefined : colors.border.subtle,
        }}
      >
        <p className="text-[14.5px] leading-[21px] whitespace-pre-wrap" style={{ color: isUser ? colors.text.inverse : colors.text.primary }}>
          {msg.content}
        </p>
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-end gap-2 mb-3 justify-start">
      <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mb-0.5" style={{ backgroundColor: colors.brand.maroon }}>
        <Sparkles size={13} style={{ color: colors.brand.gold }} />
      </span>
      <div className="px-4 py-3 rounded-2xl rounded-bl-md border shadow-card" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.subtle }}>
        <div className="flex gap-1 py-1">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: colors.brand.maroon }} />
          <span className="w-1.5 h-1.5 rounded-full animate-pulse opacity-60" style={{ backgroundColor: colors.brand.maroon, animationDelay: "0.2s" }} />
          <span className="w-1.5 h-1.5 rounded-full animate-pulse opacity-35" style={{ backgroundColor: colors.brand.maroon, animationDelay: "0.4s" }} />
        </div>
      </div>
    </div>
  );
}
