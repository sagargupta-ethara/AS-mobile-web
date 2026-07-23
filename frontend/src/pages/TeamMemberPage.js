import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Award, Activity, CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/apiClient";
import { colors } from "@/theme/colors";
import { RatingStars } from "@/components/Pills";
import { Page, Card, SectionCard, IconButton, Spinner, EmptyState, Avatar, StatTile } from "@/components/ui-kit";

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

  if (loading) return <Page testId="team-member-page"><Spinner /></Page>;
  if (!profile) return <Page testId="team-member-page"><p style={{ color: colors.text.secondary }}>Profile not found.</p></Page>;

  const roleLabel = profile.user.role === "admin" ? "Administrator" : profile.user.role === "manager" ? "Household Manager" : "Household Floor Manager";

  return (
    <Page testId="team-member-page">
      <div className="flex items-center gap-3 mb-6 md:mb-8">
        <IconButton icon={<ChevronLeft size={20} />} variant="outline" onClick={() => navigate(-1)} label="Back" testId="team-back" />
        <div className="min-w-0">
          <p className="text-[10.5px] tracking-[3px] font-bold uppercase mb-1" style={{ color: colors.brand.gold }}>Member Dossier</p>
          <h1 className="font-display text-2xl md:text-[28px] font-bold leading-none truncate" style={{ color: colors.brand.maroon }} data-testid="profile-name">
            {profile.user.name}
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        {/* Main column */}
        <div className="lg:col-span-2 flex flex-col gap-4 md:gap-5">
          <SectionCard title="Recent Reviews">
            {profile.recent_reviews.length === 0 ? (
              <EmptyState icon={<span style={{ fontSize: 24 }}>★</span>} title="No reviews yet" message="Reviews will appear here once tasks are rated." />
            ) : (
              <div className="flex flex-col gap-2.5">
                {profile.recent_reviews.map((r, idx) => (
                  <div
                    key={idx}
                    data-testid={`review-row-${idx}`}
                    className="rounded-xl border p-3.5"
                    style={{ backgroundColor: colors.bg.cardMuted, borderColor: colors.border.subtle }}
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
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Activity Log">
            {profile.logs.length === 0 ? (
              <EmptyState icon={<span style={{ fontSize: 22 }}>⏱</span>} title="No activity yet" message="Actions taken by this member will show up here." />
            ) : (
              <div className="flex flex-col">
                {profile.logs.slice(0, 20).map((l) => (
                  <div key={l.id} className="flex gap-3 py-2.5 border-b last:border-b-0" style={{ borderColor: colors.border.subtle }}>
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
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Side rail: identity + stats */}
        <div className="flex flex-col gap-4 md:gap-5">
          <Card className="p-5 flex flex-col items-center text-center">
            <Avatar name={profile.user.name} role={profile.user.role} size={72} className="text-2xl mb-3" />
            <p className="text-sm font-semibold break-all" style={{ color: colors.text.secondary }}>{profile.user.email}</p>
            <span
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-[11px] tracking-[1.4px] font-bold mt-3"
              style={{ borderColor: colors.border.medium, backgroundColor: "rgba(212,175,55,0.12)", color: colors.brand.goldDeep }}
            >
              <Award size={12} />
              {roleLabel}
            </span>
            {profile.user.ratings_count > 0 ? (
              <div className="flex items-center gap-2 mt-3">
                <RatingStars value={profile.user.avg_rating} size={16} showValue />
                <span className="text-xs font-semibold" style={{ color: colors.text.muted }}>({profile.user.ratings_count})</span>
              </div>
            ) : (
              <p className="text-xs mt-3" style={{ color: colors.text.muted }}>No completed tasks yet</p>
            )}
          </Card>

          <div className="grid grid-cols-3 gap-2.5 lg:grid-cols-1 lg:gap-3">
            <StatTile label="Active" value={profile.active_assignments} icon={<Activity size={16} />} accent={colors.brand.navy} />
            <StatTile label="Completed" value={profile.completed_assignments} icon={<CheckCircle2 size={16} />} accent={colors.brand.emerald} />
            <StatTile label="Rejections" value={profile.rejection_count} icon={<XCircle size={16} />} accent={colors.brand.maroon} />
          </div>
        </div>
      </div>
    </Page>
  );
}
