import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Award } from "lucide-react";
import { api } from "@/apiClient";
import { colors } from "@/theme/colors";
import { RatingStars } from "@/components/Pills";

function initials(name) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase() || "").join("");
}

function formatAction(action) {
  return action.split("_").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
}

export default function TeamMemberPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try { setProfile(await api.get(`/users/${id}/profile`)); } catch { /* silent */ }
  }, [id]);

  useEffect(() => { load().then(() => setLoading(false)); }, [load]);

  if (loading) return <div className="flex justify-center py-20"><span className="animate-spin w-8 h-8 border-3 rounded-full" style={{ borderColor: colors.brand.maroon, borderTopColor: "transparent" }} /></div>;
  if (!profile) return <div className="flex justify-center py-20" style={{ color: colors.text.secondary }}>Profile not found.</div>;

  const roleLabel = profile.user.role === "admin" ? "Administrator" : profile.user.role === "manager" ? "Household Manager" : "Household Tasker";

  return (
    <div className="pb-24 overflow-y-auto" style={{ backgroundColor: colors.bg.primary }}>
      {/* Hero */}
      <div
        className="flex flex-col items-center px-5 pt-5 pb-6 rounded-b-3xl overflow-hidden relative"
        style={{ background: `linear-gradient(135deg, ${colors.brand.maroonDeep}, ${colors.brand.maroon})` }}
      >
        <div className="flex justify-between items-center w-full mb-4">
          <button
            data-testid="team-back"
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            style={{ backgroundColor: "rgba(253,251,247,0.12)" }}
          >
            <ChevronLeft size={22} style={{ color: colors.text.inverse }} />
          </button>
          <span className="text-[10.5px] tracking-[2.5px] font-bold" style={{ color: colors.brand.gold }}>MEMBER DOSSIER</span>
          <div className="w-10" />
        </div>

        <div
          className="w-[84px] h-[84px] rounded-full border-[1.5px] flex items-center justify-center mb-3"
          style={{ borderColor: colors.brand.gold, backgroundColor: "rgba(212,175,55,0.15)" }}
        >
          <span className="text-[28px] font-semibold" style={{ color: colors.brand.gold }}>{initials(profile.user.name)}</span>
        </div>
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: colors.text.inverse }} data-testid="profile-name">{profile.user.name}</h1>
        <p className="text-[12.5px] mt-1 mb-3" style={{ color: "rgba(253,251,247,0.75)" }}>{profile.user.email}</p>

        <span
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-[11px] tracking-[1.4px] font-bold mb-2.5"
          style={{ borderColor: colors.border.medium, backgroundColor: "rgba(212,175,55,0.15)", color: colors.brand.gold }}
        >
          <Award size={12} />
          {roleLabel}
        </span>

        {profile.user.ratings_count > 0 ? (
          <div className="flex items-center gap-2.5 mt-2">
            <RatingStars value={profile.user.avg_rating} size={18} showValue />
            <span className="text-xs font-semibold" style={{ color: "rgba(253,251,247,0.85)" }}>across {profile.user.ratings_count} tasks</span>
          </div>
        ) : (
          <p className="text-xs mt-2" style={{ color: "rgba(253,251,247,0.55)" }}>No completed tasks yet</p>
        )}
      </div>

      <div className="p-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2.5 mb-1">
          <StatTile label="Active" value={profile.active_assignments} accent={colors.brand.navy} />
          <StatTile label="Completed" value={profile.completed_assignments} accent={colors.brand.emerald} />
          <StatTile label="Rejections" value={profile.rejection_count} accent={colors.brand.maroon} />
        </div>

        {/* Recent Reviews */}
        <SectionHeader label="Recent Reviews" />
        {profile.recent_reviews.length === 0 ? (
          <div className="flex flex-col items-center py-5 gap-1.5">
            <span className="text-[30px]" style={{ color: colors.brand.gold }}>★</span>
            <p className="text-xs" style={{ color: colors.text.muted }}>No reviews yet</p>
          </div>
        ) : (
          profile.recent_reviews.map((r, idx) => (
            <div
              key={idx}
              data-testid={`review-row-${idx}`}
              className="rounded-xl border p-3 mb-2"
              style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }}
            >
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-bold truncate" style={{ color: colors.text.primary }}>{r.task_title}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span
                      className="inline-flex px-1.5 py-0.5 rounded-full border text-[9.5px] font-bold tracking-[0.5px]"
                      style={{
                        borderColor: r.decision === "approve" ? colors.brand.emerald : colors.brand.maroon,
                        backgroundColor: r.decision === "approve" ? "rgba(9,121,105,0.12)" : "rgba(123,24,30,0.12)",
                        color: r.decision === "approve" ? colors.brand.emerald : colors.brand.maroon,
                      }}
                    >
                      {r.decision.toUpperCase()}
                    </span>
                    {r.reviewed_at && (
                      <span className="text-[10.5px] font-semibold" style={{ color: colors.text.muted }}>
                        {new Date(r.reviewed_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    )}
                  </div>
                </div>
                <RatingStars value={r.rating} size={13} showValue />
              </div>
              {r.feedback && (
                <p className="text-[12.5px] leading-[18px] mt-2" style={{ color: colors.text.secondary }}>{r.feedback}</p>
              )}
            </div>
          ))
        )}

        {/* Activity Log */}
        <SectionHeader label="Activity Log" />
        {profile.logs.length === 0 ? (
          <div className="flex flex-col items-center py-5 gap-1.5">
            <span className="text-[28px]" style={{ color: colors.brand.gold }}>⏱</span>
            <p className="text-xs" style={{ color: colors.text.muted }}>No activity yet</p>
          </div>
        ) : (
          profile.logs.slice(0, 20).map((l) => (
            <div key={l.id} className="flex gap-3 py-2.5 border-b" style={{ borderColor: colors.border.subtle }}>
              <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: colors.brand.gold }} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold" style={{ color: colors.text.primary }}>
                  {formatAction(l.action)}
                  <span className="font-medium" style={{ color: colors.text.muted }}> · {l.entity_type}</span>
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: colors.text.muted }}>
                  {new Date(l.created_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SectionHeader({ label }) {
  return (
    <p className="text-[11px] tracking-[2.5px] font-bold uppercase mt-6 mb-3" style={{ color: colors.text.secondary }}>
      {label}
    </p>
  );
}

function StatTile({ label, value, accent }) {
  return (
    <div className="relative rounded-xl p-3 border overflow-hidden" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }}>
      <div className="absolute top-0 left-0 bottom-0 w-[3px]" style={{ backgroundColor: accent }} />
      <p className="text-[22px] font-bold ml-1" style={{ color: colors.brand.maroon }}>{value}</p>
      <p className="text-[10px] tracking-[1.2px] font-bold uppercase mt-0.5 ml-1" style={{ color: colors.text.secondary }}>{label}</p>
    </div>
  );
}
