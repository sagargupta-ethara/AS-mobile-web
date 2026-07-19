import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Trash2, Award, Calendar, Clock, Send, CheckCircle, XCircle, Image, FileText, Repeat } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { api } from "@/apiClient";
import { colors } from "@/theme/colors";
import { OverallStatusPill, PriorityPill, AssignmentStatusPill, RatingStars } from "@/components/Pills";
import { Page, SectionCard, IconButton, Spinner, EmptyState, Avatar } from "@/components/ui-kit";

export default function TaskDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [submitFor, setSubmitFor] = useState(null);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState([]);
  const [reviewFor, setReviewFor] = useState(null);
  const [decision, setDecision] = useState("approve");
  const [rating, setRating] = useState(4);
  const [feedback, setFeedback] = useState("");

  const load = useCallback(async () => {
    try { setTask(await api.get(`/tasks/${id}`)); } catch { /* silent */ }
  }, [id]);

  useEffect(() => { load().then(() => setLoading(false)); }, [load]);

  const canManage = user && task && (user.role === "admin" || task.created_by === user.id);

  const pickPhoto = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*"; input.multiple = true;
    input.onchange = async (e) => {
      for (const file of e.target.files) {
        const reader = new FileReader();
        reader.onload = () => setPhotos((p) => [...p, reader.result]);
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const doSubmit = async () => {
    if (!task || !submitFor) return;
    if (photos.length === 0 && !note.trim()) return;
    setBusy(true);
    try {
      const updated = await api.post(`/tasks/${task.id}/assignments/${submitFor.id}/submit`, { photos, files: [], note });
      setTask(updated); setSubmitFor(null); setPhotos([]); setNote("");
    } catch { /* silent */ } finally { setBusy(false); }
  };

  const startAssignment = async (a) => {
    setBusy(true);
    try { setTask(await api.post(`/tasks/${task.id}/assignments/${a.id}/status`, { status: "in_progress" })); } catch { /* silent */ } finally { setBusy(false); }
  };

  const doReview = async () => {
    if (!task || !reviewFor) return;
    setBusy(true);
    try {
      const updated = await api.post(`/tasks/${task.id}/assignments/${reviewFor.id}/review`, { decision, rating, feedback });
      setTask(updated); setReviewFor(null);
    } catch { /* silent */ } finally { setBusy(false); }
  };

  const deleteTask = async () => {
    setBusy(true);
    try { await api.del(`/tasks/${task.id}`); navigate(-1); } catch { setBusy(false); }
  };

  if (loading) return <Page testId="task-detail-page"><Spinner /></Page>;
  if (!task) return <Page testId="task-detail-page"><EmptyState icon={<FileText size={26} />} title="Task not found" message="This task may have been removed or is no longer available." /></Page>;

  return (
    <Page testId="task-detail-page">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-6 md:mb-8">
        <div className="flex items-start gap-3 min-w-0">
          <IconButton icon={<ChevronLeft size={20} />} variant="outline" onClick={() => navigate(-1)} label="Back" testId="task-detail-back" />
          <div className="min-w-0">
            {task.project_name ? (
              <button
                data-testid="task-project-link"
                onClick={() => task.project_id && navigate(`/projects/${task.project_id}`)}
                className="block text-[11.5px] tracking-[2px] font-bold mb-1.5 hover:underline focus:outline-none"
                style={{ color: colors.brand.gold }}
              >
                ◆ {task.project_name}
              </button>
            ) : task.category ? (
              <p className="text-[11px] tracking-[2px] font-bold uppercase mb-1.5" style={{ color: colors.brand.maroon }}>{task.category}</p>
            ) : null}
            <h1 className="font-display text-2xl md:text-[28px] font-bold leading-tight" style={{ color: colors.text.primary }} data-testid="task-detail-title">{task.title}</h1>
            <div className="flex flex-wrap gap-2 mt-3">
              <OverallStatusPill status={task.overall_status} />
              <PriorityPill priority={task.priority} />
              {task.is_recurring && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10.5px] font-bold tracking-[1px]" style={{ backgroundColor: "rgba(212,175,55,0.15)", borderColor: colors.border.medium, color: colors.brand.goldDeep }}>
                  <Repeat size={11} /> {task.recurrence?.toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </div>
        {canManage && (
          <IconButton icon={<Trash2 size={18} />} variant="outline" onClick={deleteTask} label="Delete task" testId="task-delete" />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        {/* Main column */}
        <div className="lg:col-span-2 flex flex-col gap-4 md:gap-5">
          {task.description && (
            <SectionCard title="Description">
              <p className="text-[14.5px] leading-relaxed" style={{ color: colors.text.primary }}>{task.description}</p>
            </SectionCard>
          )}

          <SectionCard title={`Assignments (${task.assignments.length})`}>
            <div className="flex flex-col gap-4">
              {task.assignments.map((a) => {
                const isMine = user?.id === a.assignee_id;
                const isReviewer = canManage;
                return (
                  <div key={a.id} data-testid={`assignment-${a.id}`} className="rounded-2xl border p-4" style={{ backgroundColor: colors.bg.cardMuted, borderColor: colors.border.subtle }}>
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar name={a.assignee_name || "?"} role={a.assignee_role} size={40} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: colors.text.primary }}>{a.assignee_name}{isMine ? " (you)" : ""}</p>
                        <div className="mt-1"><AssignmentStatusPill status={a.status} small /></div>
                      </div>
                      {a.final_rating != null && <RatingStars value={a.final_rating} size={13} showValue />}
                    </div>

                    {a.rounds.map((r, ridx) => (
                      <div key={r.id} className="rounded-xl border p-3 mb-2.5 last:mb-0" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.subtle }}>
                        <div className="flex justify-between items-center mb-1.5 flex-wrap gap-1.5">
                          <span className="text-[11.5px] font-bold" style={{ color: colors.brand.maroon }}>
                            Round {ridx + 1} · <span style={{ color: colors.text.muted }}>{new Date(r.submitted_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
                          </span>
                          {r.decision ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9.5px] font-bold tracking-[0.6px]"
                              style={{
                                backgroundColor: r.decision === "approve" ? "rgba(9,121,105,0.15)" : "rgba(123,24,30,0.15)",
                                borderColor: r.decision === "approve" ? colors.brand.emerald : colors.brand.maroon,
                                color: r.decision === "approve" ? colors.brand.emerald : colors.brand.maroon,
                              }}
                            >
                              {r.decision === "approve" ? <CheckCircle size={11} /> : <XCircle size={11} />}
                              {r.decision.toUpperCase()}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold tracking-[0.5px]" style={{ color: colors.brand.gold }}>Awaiting review</span>
                          )}
                        </div>
                        {r.note && <p className="text-[12.5px] italic mb-1.5" style={{ color: colors.text.secondary }}>&ldquo;{r.note}&rdquo;</p>}
                        {r.photos?.length > 0 && (
                          <div className="flex gap-1.5 overflow-x-auto py-1">
                            {r.photos.map((p, i) => <img key={i} src={p} alt="" className="w-[60px] h-[60px] rounded-lg object-cover" data-testid={`round-photo-${r.id}-${i}`} />)}
                          </div>
                        )}
                        {r.rating != null && (
                          <div className="mt-2 pt-2 border-t" style={{ borderColor: colors.border.subtle }}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[11px] font-semibold" style={{ color: colors.text.muted }}>by {r.reviewed_by_name || "—"}</span>
                              <RatingStars value={r.rating} size={12} showValue />
                            </div>
                            {r.feedback && <p className="text-[12.5px] leading-[17px] mt-1" style={{ color: colors.text.primary }}>{r.feedback}</p>}
                          </div>
                        )}
                      </div>
                    ))}

                    <div className="flex gap-2 mt-3 flex-wrap">
                      {isMine && (a.status === "pending") && (
                        <button
                          data-testid={`start-${a.id}`}
                          onClick={() => startAssignment(a)}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border text-[12.5px] font-bold transition-all hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-[#D4AF37] disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ borderColor: colors.brand.maroon, color: colors.brand.maroon, backgroundColor: colors.bg.card }}
                        >
                          Start
                        </button>
                      )}
                      {isMine && ["pending", "in_progress", "rejected"].includes(a.status) && (
                        <button
                          data-testid={`submit-${a.id}`}
                          onClick={() => { setSubmitFor(a); setNote(""); setPhotos([]); }}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-[12.5px] font-bold transition-all hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-[#D4AF37] disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ backgroundColor: colors.brand.maroon, color: colors.text.inverse, border: `1px solid ${colors.brand.maroon}` }}
                        >
                          <Send size={13} />{a.status === "rejected" ? "Resubmit" : "Submit"}
                        </button>
                      )}
                      {isReviewer && a.status === "submitted" && (
                        <>
                          <button
                            data-testid={`reject-${a.id}`}
                            onClick={() => { setReviewFor(a); setDecision("reject"); setRating(3); setFeedback(""); }}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border text-[12.5px] font-bold transition-all hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-[#D4AF37] disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ borderColor: colors.brand.maroon, color: colors.brand.maroon, backgroundColor: colors.bg.card }}
                          >
                            <XCircle size={13} />Reject
                          </button>
                          <button
                            data-testid={`approve-${a.id}`}
                            onClick={() => { setReviewFor(a); setDecision("approve"); setRating(5); setFeedback(""); }}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-[12.5px] font-bold transition-all hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-[#D4AF37] disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ backgroundColor: colors.brand.emerald, color: colors.text.inverse, border: `1px solid ${colors.brand.emerald}` }}
                          >
                            <CheckCircle size={13} />Approve
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>

        {/* Side rail: meta */}
        <div className="flex flex-col gap-4 md:gap-5">
          <SectionCard title="Details">
            <div className="flex flex-col">
              <MetaRow icon={<Award size={14} style={{ color: colors.brand.gold }} />} label="Assigned by" value={task.created_by_name || "—"} />
              <MetaRow icon={<Calendar size={14} style={{ color: colors.brand.gold }} />} label="Due date" value={task.due_date ? new Date(task.due_date).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "No due date"} />
              <MetaRow icon={<Clock size={14} style={{ color: colors.brand.gold }} />} label="Created" value={new Date(task.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} last />
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Submit modal */}
      {submitFor && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ backgroundColor: "rgba(26,18,16,0.65)" }}>
          <div className="w-full max-w-[460px] rounded-2xl border p-5" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.medium }} data-testid="submit-modal">
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-8 h-8 rounded-full border flex items-center justify-center" style={{ borderColor: colors.brand.gold, backgroundColor: "rgba(212,175,55,0.15)" }}><Send size={15} style={{ color: colors.brand.gold }} /></div>
              <h3 className="flex-1 font-display text-[17px] font-bold" style={{ color: colors.brand.maroon }}>Submit for Review</h3>
              <button data-testid="submit-modal-close" onClick={() => setSubmitFor(null)} className="text-lg focus:outline-none" style={{ color: colors.text.muted }}>✕</button>
            </div>
            <p className="text-[12.5px] mb-3" style={{ color: colors.text.secondary }}>Add photos or a short note describing what you completed.</p>
            <textarea
              data-testid="submit-note-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Notes (optional)…"
              className="w-full rounded-xl border p-3 text-sm min-h-[80px] outline-none focus:ring-2 focus:ring-[#D4AF37] resize-none"
              style={{ backgroundColor: colors.bg.cardMuted, borderColor: colors.border.subtle, color: colors.text.primary }}
            />
            <div className="flex flex-wrap gap-2 mt-2.5">
              {photos.map((p, i) => (
                <div key={i} className="relative">
                  <img src={p} alt="" className="w-[60px] h-[60px] rounded-lg object-cover" />
                  <button data-testid={`remove-photo-${i}`} onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px]" style={{ backgroundColor: colors.brand.maroon, color: colors.text.inverse }}>✕</button>
                </div>
              ))}
              <button data-testid="pick-photo" onClick={pickPhoto} className="w-[60px] h-[60px] rounded-lg border-[1.5px] border-dashed flex flex-col items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ borderColor: colors.brand.gold, backgroundColor: "rgba(212,175,55,0.10)" }}>
                <Image size={20} style={{ color: colors.brand.gold }} />
                <span className="text-[9px] font-bold mt-0.5" style={{ color: colors.brand.gold }}>Photo</span>
              </button>
            </div>
            <button
              data-testid="confirm-submit"
              disabled={busy || (photos.length === 0 && !note.trim())}
              onClick={doSubmit}
              className="w-full flex items-center justify-center gap-2 mt-3.5 h-11 rounded-xl text-sm font-bold transition-opacity focus:outline-none focus:ring-2 focus:ring-[#D4AF37] disabled:cursor-not-allowed"
              style={{ backgroundColor: colors.brand.maroon, color: colors.text.inverse, opacity: busy || (photos.length === 0 && !note.trim()) ? 0.5 : 1 }}
            >
              {busy ? <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <><Send size={16} />Send for Review</>}
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Review modal */}
      {reviewFor && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ backgroundColor: "rgba(26,18,16,0.65)" }}>
          <div className="w-full max-w-[460px] rounded-2xl border p-5" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.medium }} data-testid="review-modal">
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-8 h-8 rounded-full border flex items-center justify-center" style={{ borderColor: colors.brand.gold, backgroundColor: "rgba(212,175,55,0.15)" }}>{decision === "approve" ? <CheckCircle size={16} style={{ color: colors.brand.emerald }} /> : <XCircle size={16} style={{ color: colors.brand.maroon }} />}</div>
              <h3 className="flex-1 font-display text-[17px] font-bold" style={{ color: colors.brand.maroon }}>{decision === "approve" ? "Approve & Rate" : "Reject & Rate"}</h3>
              <button data-testid="review-modal-close" onClick={() => setReviewFor(null)} className="text-lg focus:outline-none" style={{ color: colors.text.muted }}>✕</button>
            </div>
            <p className="text-[12.5px] mb-3" style={{ color: colors.text.secondary }}>{decision === "approve" ? "Rate this submission." : "Rate this attempt and give feedback."}</p>
            <div className="flex justify-center gap-1 my-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} data-testid={`rating-star-${n}`} onClick={() => setRating(n)} className="text-[32px] mx-1 focus:outline-none transition-transform hover:scale-110" style={{ color: n <= rating ? colors.brand.gold : "rgba(212,175,55,0.35)" }}>★</button>
              ))}
            </div>
            <textarea
              data-testid="review-feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={decision === "reject" ? "What needs to be improved?" : "Optional feedback…"}
              className="w-full rounded-xl border p-3 text-sm min-h-[80px] outline-none focus:ring-2 focus:ring-[#D4AF37] resize-none"
              style={{ backgroundColor: colors.bg.cardMuted, borderColor: colors.border.subtle, color: colors.text.primary }}
            />
            <button
              data-testid="confirm-review"
              disabled={busy}
              onClick={doReview}
              className="w-full flex items-center justify-center gap-2 mt-3.5 h-11 rounded-xl text-sm font-bold transition-opacity focus:outline-none focus:ring-2 focus:ring-[#D4AF37] disabled:cursor-not-allowed"
              style={{ backgroundColor: decision === "approve" ? colors.brand.emerald : colors.brand.maroon, color: colors.text.inverse, opacity: busy ? 0.6 : 1 }}
            >
              {busy ? <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <>{decision === "approve" ? <CheckCircle size={16} /> : <XCircle size={16} />}{decision === "approve" ? "Approve" : "Reject"}</>}
            </button>
          </div>
        </div>,
        document.body
      )}
    </Page>
  );
}

function MetaRow({ icon, label, value, last }) {
  return (
    <div className={`flex items-center gap-3 py-3 ${last ? "" : "border-b"}`} style={{ borderColor: colors.border.subtle }}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(212,175,55,0.15)" }}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10.5px] tracking-[1.5px] font-bold uppercase mb-0.5" style={{ color: colors.text.muted }}>{label}</p>
        <p className="text-sm font-semibold" style={{ color: colors.text.primary }}>{value}</p>
      </div>
    </div>
  );
}
