import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, RotateCcw, Sparkles, Send, MessageSquare } from "lucide-react";
import { api } from "@/apiClient";
import { colors } from "@/theme/colors";

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
    <div className="flex flex-col h-screen" style={{ backgroundColor: colors.bg.primary }}>
      {/* Header */}
      <div
        className="relative px-4 pt-4 pb-3.5 rounded-b-[20px] overflow-hidden shrink-0"
        style={{ background: `linear-gradient(135deg, ${colors.brand.maroonDeep}, ${colors.brand.maroon})` }}
      >
        <div className="flex items-center gap-2">
          <button
            data-testid="concierge-back"
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            style={{ backgroundColor: "rgba(253,251,247,0.12)" }}
          >
            <ChevronLeft size={22} style={{ color: colors.text.inverse }} />
          </button>
          <div className="flex-1 text-center">
            <p className="text-[9.5px] tracking-[2.5px] font-bold mb-0.5" style={{ color: colors.brand.gold }}>ROYAL CONCIERGE ✦ AI</p>
            <h1 className="text-lg font-bold tracking-tight" style={{ color: colors.text.inverse }}>Estate Concierge</h1>
          </div>
          <button
            data-testid="concierge-clear"
            onClick={clearChat}
            className="w-10 h-10 rounded-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            style={{ backgroundColor: "rgba(253,251,247,0.12)" }}
          >
            <RotateCcw size={20} style={{ color: colors.text.inverse }} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <span className="animate-spin w-8 h-8 border-3 rounded-full" style={{ borderColor: colors.brand.maroon, borderTopColor: "transparent" }} />
          </div>
        ) : (
          <>
            {showStarters && <WelcomeCard onPick={(t) => send(t)} />}
            {messages.map((msg) => <Bubble key={msg.id} msg={msg} />)}
            {sending && <TypingBubble />}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t px-3 pt-2.5 pb-3" style={{ borderColor: colors.border.subtle }}>
        <div
          className="flex items-end gap-2 rounded-[22px] border pl-3.5 pr-1.5 py-1.5"
          style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }}
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
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
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
  );
}

function WelcomeCard({ onPick }) {
  return (
    <div className="flex flex-col items-center px-2 pt-6 pb-2" data-testid="concierge-welcome">
      <div
        className="w-[60px] h-[60px] rounded-full border-[1.5px] flex items-center justify-center mb-3.5"
        style={{ borderColor: colors.brand.gold, backgroundColor: "rgba(212,175,55,0.12)" }}
      >
        <Sparkles size={24} style={{ color: colors.brand.gold }} />
      </div>
      <h2 className="text-[22px] font-bold tracking-tight mb-1.5" style={{ color: colors.brand.maroon }}>At your service.</h2>
      <p className="text-[13.5px] text-center leading-5 mb-6 px-2" style={{ color: colors.text.secondary }}>
        I can draft memos, suggest checklists, plan events, or answer questions about household operations.
      </p>
      <p className="text-[10.5px] tracking-[2px] font-bold mb-2.5 self-start" style={{ color: colors.text.muted }}>SUGGESTED ENQUIRIES</p>
      {STARTERS.map((s, i) => (
        <button
          key={i}
          data-testid={`concierge-starter-${i}`}
          onClick={() => onPick(s)}
          className="w-full flex items-center gap-2.5 p-3 rounded-xl border mb-2 text-left transition-colors hover:bg-[rgba(212,175,55,0.06)] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
          style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }}
        >
          <MessageSquare size={14} style={{ color: colors.brand.gold }} className="shrink-0" />
          <span className="flex-1 text-[13px] leading-[18px]" style={{ color: colors.text.secondary }}>{s}</span>
        </button>
      ))}
    </div>
  );
}

function Bubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex items-end gap-2 mb-2.5 ${isUser ? "justify-end" : "justify-start"}`} data-testid={`msg-${msg.role}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mb-0.5" style={{ backgroundColor: colors.brand.maroon }}>
          <Sparkles size={12} style={{ color: colors.brand.gold }} />
        </div>
      )}
      <div
        className={`max-w-[78%] px-3.5 py-3 rounded-2xl ${isUser ? "rounded-br-sm" : "rounded-bl-sm border"}`}
        style={{
          backgroundColor: isUser ? colors.brand.maroon : colors.bg.secondary,
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
    <div className="flex items-end gap-2 mb-2.5 justify-start">
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mb-0.5" style={{ backgroundColor: colors.brand.maroon }}>
        <Sparkles size={12} style={{ color: colors.brand.gold }} />
      </div>
      <div className="px-3.5 py-3 rounded-2xl rounded-bl-sm border" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }}>
        <div className="flex gap-1 py-1">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: colors.brand.maroon }} />
          <span className="w-1.5 h-1.5 rounded-full animate-pulse opacity-60" style={{ backgroundColor: colors.brand.maroon, animationDelay: "0.2s" }} />
          <span className="w-1.5 h-1.5 rounded-full animate-pulse opacity-35" style={{ backgroundColor: colors.brand.maroon, animationDelay: "0.4s" }} />
        </div>
      </div>
    </div>
  );
}
