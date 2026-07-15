import React, { useState } from "react";
import { Sparkles, X, ArrowRight } from "lucide-react";
import { api } from "@/apiClient";
import { colors } from "@/theme/colors";

const SUGGESTIONS = [
  "Prepare drawing room for tea with 6 guests at 4pm tomorrow",
  "Weekly polish of the silverware every Saturday morning",
  "Urgent — service the Rolls-Royce before Friday",
  "Fresh flowers in all guest suites by 10am every Monday",
];

export default function AiTaskAssistant({ visible, onClose, onApply }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed) { setError("Describe the task first"); return; }
    setLoading(true);
    setError(null);
    try {
      const parsed = await api.post("/ai/task-parse", { text: trimmed });
      onApply(parsed);
      setText("");
    } catch (e) {
      setError(e?.message || "AI could not parse this. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    if (loading) return;
    setText("");
    setError(null);
    onClose();
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ backgroundColor: "rgba(26,18,16,0.65)" }}>
      <div className="w-full max-w-[520px] rounded-[20px] border overflow-hidden" style={{ backgroundColor: colors.bg.primary, borderColor: colors.border.medium }} data-testid="ai-task-assistant-modal">
        {/* Header */}
        <div className="p-5 pb-4" style={{ background: `linear-gradient(135deg, ${colors.brand.maroon}, ${colors.brand.maroonDeep})` }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border flex items-center justify-center" style={{ borderColor: colors.brand.gold, backgroundColor: "rgba(212,175,55,0.15)" }}>
              <Sparkles size={18} style={{ color: colors.brand.gold }} />
            </div>
            <div className="flex-1">
              <p className="text-[9.5px] tracking-[2.5px] font-bold mb-0.5" style={{ color: colors.brand.gold }}>ROYAL CONCIERGE ✦ AI</p>
              <p className="text-[19px] font-bold tracking-tight" style={{ color: colors.text.inverse }}>Task Assistant</p>
            </div>
            <button
              data-testid="ai-modal-close"
              onClick={close}
              className="w-8 h-8 rounded-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              style={{ backgroundColor: "rgba(253,251,247,0.15)" }}
            >
              <X size={20} style={{ color: colors.text.inverse }} />
            </button>
          </div>
          <p className="text-[12.5px] leading-[18px] mt-2.5" style={{ color: "rgba(253,251,247,0.85)" }}>
            Describe the task in plain English. AI will fill in the form.
          </p>
        </div>

        {/* Body */}
        <div className="p-5">
          <textarea
            data-testid="ai-task-input"
            value={text}
            onChange={(e) => { setText(e.target.value); if (error) setError(null); }}
            placeholder="e.g. Prepare the master suite for guests arriving from Delhi tomorrow at 6pm — urgent"
            className="w-full rounded-xl border p-3.5 text-[15px] min-h-[100px] outline-none focus:ring-2 focus:ring-[#D4AF37] resize-none"
            style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle, color: colors.text.primary }}
          />

          {error ? (
            <p data-testid="ai-task-error" className="text-[12.5px] font-semibold mt-2" style={{ color: colors.brand.maroon }}>{error}</p>
          ) : (
            <>
              <p className="text-[10px] tracking-[2px] font-bold mt-3 mb-2" style={{ color: colors.text.muted }}>OR TRY ONE OF THESE</p>
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  data-testid={`ai-suggestion-${i}`}
                  onClick={() => setText(s)}
                  className="w-full flex items-center gap-2 py-2.5 px-3 rounded-[10px] border mb-1.5 text-left transition-colors hover:bg-[rgba(212,175,55,0.06)] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }}
                >
                  <ArrowRight size={14} style={{ color: colors.brand.gold }} className="shrink-0" />
                  <span className="flex-1 text-[12.5px] leading-[18px]" style={{ color: colors.text.secondary }}>{s}</span>
                </button>
              ))}
            </>
          )}

          <button
            data-testid="ai-generate-button"
            onClick={submit}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 mt-3 py-3.5 rounded-xl text-sm font-bold transition-opacity focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            style={{ backgroundColor: colors.brand.maroon, color: colors.text.inverse, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? (
              <>
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                <span>Consulting concierge...</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>Generate Task</span>
              </>
            )}
          </button>

          <p className="text-center mt-3 text-[10.5px] tracking-[0.5px]" style={{ color: colors.text.muted }}>
            Powered by GPT-4o · Fields can be edited before saving.
          </p>
        </div>
      </div>
    </div>
  );
}
