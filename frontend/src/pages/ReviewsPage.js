import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, CheckCircle, Library, Repeat, Clock, Inbox } from "lucide-react";
import { api } from "@/apiClient";
import { colors } from "@/theme/colors";
import { PriorityPill } from "@/components/Pills";
import { Page, PageHeader, Card, Spinner, EmptyState, Avatar } from "@/components/ui-kit";

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

  const load = useCallback(async () => { try { setItems(await api.get("/reviews/pending")); } catch { /* silent */ } }, []);
  useEffect(() => { load().then(() => setLoading(false)); }, [load]);

  return (
    <Page testId="reviews-page">
      <PageHeader
        overline="Pending Your Review"
        title="Review Queue"
        icon={<Inbox size={20} />}
        subtitle={loading ? undefined : items.length === 0 ? "You're all caught up" : `${items.length} submission${items.length === 1 ? "" : "s"} awaiting your review`}
        actions={
          !loading &&
          items.length > 0 && (
            <span
              className="inline-flex items-center justify-center min-w-[40px] h-10 px-3 rounded-xl font-display text-[18px] font-bold"
              style={{ backgroundColor: "rgba(212,175,55,0.16)", color: colors.brand.goldDeep, border: `1px solid ${colors.border.medium}` }}
            >
              {items.length}
            </span>
          )
        }
      />

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CheckCircle size={30} />}
          title="All caught up"
          message="No submissions awaiting review right now."
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {items.map((r) => (
            <Card
              key={`${r.task_id}-${r.assignment_id}`}
              testId={`review-row-${r.assignment_id}`}
              onClick={() => navigate(`/tasks/${r.task_id}`)}
              className="p-4 flex items-center gap-3.5"
            >
              <Avatar name={r.assignee_name} role={r.assignee_role} size={44} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center gap-2 mb-1">
                  <span className="text-[13.5px] font-bold truncate" style={{ color: colors.brand.maroon }}>{r.assignee_name}</span>
                  <PriorityPill priority={r.priority} />
                </div>
                <p className="text-sm leading-[19px] mb-2 line-clamp-1" style={{ color: colors.text.primary }}>{r.task_title}</p>
                <div className="flex items-center flex-wrap gap-1.5">
                  {r.project_name && (
                    <Chip icon={<Library size={11} />} label={r.project_name} />
                  )}
                  <Chip icon={<Repeat size={11} />} label={`Round ${r.round_index}`} />
                  <Chip icon={<Clock size={11} />} label={timeAgo(r.submitted_at)} />
                </div>
              </div>
              <ChevronRight size={18} style={{ color: colors.text.muted }} className="shrink-0" />
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}

function Chip({ icon, label }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold border max-w-[160px]"
      style={{ backgroundColor: colors.bg.cardMuted, borderColor: colors.border.subtle, color: colors.text.secondary }}
    >
      <span style={{ color: colors.brand.gold }}>{icon}</span>
      <span className="truncate">{label}</span>
    </span>
  );
}
