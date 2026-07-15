import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, CheckCircle, Library, Repeat, Clock } from "lucide-react";
import { api } from "@/apiClient";
import { colors } from "@/theme/colors";
import { PriorityPill } from "@/components/Pills";

function initials(name) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase() || "").join("");
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / (1000 * 60 * 60));
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function ReviewsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setItems(await api.get("/reviews/pending")); } catch { /* silent */ }
  }, []);

  useEffect(() => { load().then(() => setLoading(false)); }, [load]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg.primary }}>
      <div
        className="relative px-4 pt-5 pb-4 rounded-b-[20px] overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${colors.brand.maroonDeep}, ${colors.brand.maroon})` }}
      >
        <div className="flex items-center gap-2.5">
          <button
            data-testid="review-back"
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            style={{ backgroundColor: "rgba(253,251,247,0.12)" }}
          >
            <ChevronLeft size={22} style={{ color: colors.text.inverse }} />
          </button>
          <div className="flex-1">
            <p className="text-[10px] tracking-[2.2px] font-bold" style={{ color: colors.brand.gold }}>PENDING · YOUR REVIEW</p>
            <h1 className="text-[22px] font-bold tracking-tight mt-0.5" style={{ color: colors.text.inverse }}>Review Queue</h1>
          </div>
          <div
            className="min-w-[32px] h-8 rounded-full border flex items-center justify-center px-2.5"
            style={{ borderColor: colors.brand.gold, backgroundColor: "rgba(212,175,55,0.20)" }}
          >
            <span className="font-extrabold text-[13px]" style={{ color: colors.brand.gold }}>{items.length}</span>
          </div>
        </div>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="flex justify-center py-16">
            <span className="animate-spin w-8 h-8 border-3 rounded-full" style={{ borderColor: colors.brand.maroon, borderTopColor: "transparent" }} />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-2">
            <CheckCircle size={48} style={{ color: colors.brand.emerald }} />
            <p className="text-xl font-bold mt-2" style={{ color: colors.brand.emerald }}>All caught up</p>
            <p className="text-[13px] text-center" style={{ color: colors.text.secondary }}>No submissions awaiting your review right now.</p>
          </div>
        ) : (
          items.map((r) => (
            <button
              key={`${r.task_id}-${r.assignment_id}`}
              data-testid={`review-row-${r.assignment_id}`}
              onClick={() => navigate(`/tasks/${r.task_id}`)}
              className="w-full flex items-center gap-3 p-3 rounded-[14px] border mb-2.5 text-left transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              style={{ borderColor: colors.border.subtle }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-[13px] font-bold"
                style={{ backgroundColor: colors.brand.maroon, color: colors.text.inverse }}
              >
                {initials(r.assignee_name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center gap-2 mb-1">
                  <span className="text-[13.5px] font-bold" style={{ color: colors.brand.maroon }}>{r.assignee_name}</span>
                  <PriorityPill priority={r.priority} />
                </div>
                <p className="text-sm leading-[19px] mb-1.5 line-clamp-2" style={{ color: colors.text.primary }}>{r.task_title}</p>
                <div className="flex flex-wrap gap-1.5">
                  {r.project_name && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10.5px] font-semibold" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle, color: colors.text.secondary }}>
                      <Library size={11} style={{ color: colors.brand.gold }} />
                      <span className="truncate max-w-[120px]">{r.project_name}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10.5px] font-semibold" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle, color: colors.text.secondary }}>
                    <Repeat size={11} style={{ color: colors.brand.gold }} />
                    Round {r.round_index}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10.5px] font-semibold" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle, color: colors.text.secondary }}>
                    <Clock size={11} style={{ color: colors.brand.gold }} />
                    {timeAgo(r.submitted_at)}
                  </span>
                </div>
              </div>
              <ChevronRight size={18} style={{ color: colors.text.muted }} className="shrink-0" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
