import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import {
  Award,
  Calendar,
  CheckCircle,
  ChevronLeft,
  Clock,
  Download,
  File as FileIcon,
  FileText,
  Image,
  Paperclip,
  Repeat,
  Send,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { api } from "@/apiClient";
import { colors } from "@/theme/colors";
import { OverallStatusPill, PriorityPill, AssignmentStatusPill, RatingStars } from "@/components/Pills";
import { Page, SectionCard, IconButton, Spinner, EmptyState, Avatar } from "@/components/ui-kit";

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const FILE_ACCEPT = [
  "image/*",
  "application/pdf",
  "text/plain",
  "text/csv",
  ".pdf",
  ".txt",
  ".csv",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
].join(",");
const FILE_HELP_TEXT = "Images, PDF, TXT, CSV, Word, or Excel up to 8 MB combined.";

function readableSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function dataUriSize(dataUri = "") {
  const payload = dataUri.split(",")[1] || "";
  return Math.floor((payload.length * 3) / 4);
}

function currentAttachmentBytes(photos, files) {
  return photos.reduce((total, photo) => total + dataUriSize(photo), 0) + files.reduce((total, file) => total + (file.size || 0), 0);
}

function isImageMime(mime = "") {
  return mime.startsWith("image/");
}

function isPdfMime(mime = "") {
  return mime === "application/pdf" || mime.includes("pdf");
}

function fileIconFor(mime = "") {
  if (isImageMime(mime)) return Image;
  if (isPdfMime(mime) || mime.includes("word") || mime.includes("msword")) return FileText;
  return FileIcon;
}

function readFileAsDataUri(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  });
}

function attachmentId(file) {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${file.name}-${file.size}`;
}

function FileChip({ file, onOpen, onRemove, testId, removeTestId }) {
  const Icon = fileIconFor(file.mime);
  const Component = onOpen ? "button" : "div";

  return (
    <Component
      type={onOpen ? "button" : undefined}
      data-testid={testId}
      onClick={onOpen}
      className="w-full flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
      style={{ backgroundColor: colors.bg.cardMuted, borderColor: colors.border.subtle }}
    >
      <Icon size={15} style={{ color: colors.brand.gold }} />
      <span className="flex-1 min-w-0 truncate text-[12px] font-semibold" style={{ color: colors.text.primary }}>{file.name}</span>
      {file.size ? <span className="text-[10.5px] font-semibold shrink-0" style={{ color: colors.text.muted }}>{readableSize(file.size)}</span> : null}
      {onRemove ? (
        <button
          data-testid={removeTestId}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
          style={{ color: colors.brand.maroon }}
          aria-label={`Remove ${file.name}`}
        >
          <X size={13} />
        </button>
      ) : null}
    </Component>
  );
}

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
  const [files, setFiles] = useState([]);
  const [submitError, setSubmitError] = useState("");
  const [viewer, setViewer] = useState(null);
  const [reviewFor, setReviewFor] = useState(null);
  const [decision, setDecision] = useState("approve");
  const [rating, setRating] = useState(4);
  const [feedback, setFeedback] = useState("");

  const load = useCallback(async () => {
    try {
      setTask(await api.get(`/tasks/${id}`));
    } catch {
    }
  }, [id]);

  useEffect(() => {
    load().then(() => setLoading(false));
  }, [load]);

  const canManage = user && task && (user.role === "admin" || task.created_by === user.id);

  const pickPhoto = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = async (event) => {
      let nextBytes = currentAttachmentBytes(photos, files);
      for (const file of event.target.files || []) {
        if (file.size > MAX_ATTACHMENT_BYTES || nextBytes + file.size > MAX_ATTACHMENT_BYTES) {
          setSubmitError("Attachments can be up to 8 MB combined.");
          continue;
        }
        nextBytes += file.size;
        const reader = new FileReader();
        reader.onload = () => setPhotos((prev) => [...prev, reader.result]);
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const pickFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = FILE_ACCEPT;
    input.multiple = true;
    input.onchange = async (event) => {
      const selected = Array.from(event.target.files || []);
      const nextFiles = [];
      let nextBytes = currentAttachmentBytes(photos, files);
      for (const file of selected) {
        if (file.size > MAX_ATTACHMENT_BYTES || nextBytes + file.size > MAX_ATTACHMENT_BYTES) {
          setSubmitError("Attachments can be up to 8 MB combined.");
          continue;
        }
        try {
          nextFiles.push({
            id: attachmentId(file),
            name: file.name || "attachment",
            mime: file.type || "application/octet-stream",
            size: file.size || 0,
            data_uri: await readFileAsDataUri(file),
          });
          nextBytes += file.size || 0;
        } catch {
          setSubmitError(`Could not read ${file.name || "that file"}.`);
        }
      }
      if (nextFiles.length > 0) {
        setSubmitError("");
        setFiles((prev) => [...prev, ...nextFiles]);
      }
    };
    input.click();
  };

  const doSubmit = async () => {
    if (!task || !submitFor) return;
    if (photos.length === 0 && files.length === 0 && !note.trim()) return;
    setBusy(true);
    try {
      const updated = await api.post(`/tasks/${task.id}/assignments/${submitFor.id}/submit`, { photos, files, note });
      setTask(updated);
      setSubmitFor(null);
      setPhotos([]);
      setFiles([]);
      setNote("");
      setSubmitError("");
    } catch {
      setSubmitError("Submit failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const startAssignment = async (assignment) => {
    if (!task) return;
    setBusy(true);
    try {
      setTask(await api.post(`/tasks/${task.id}/assignments/${assignment.id}/status`, { status: "in_progress" }));
    } catch {
    } finally {
      setBusy(false);
    }
  };

  const doReview = async () => {
    if (!task || !reviewFor) return;
    setBusy(true);
    try {
      const updated = await api.post(`/tasks/${task.id}/assignments/${reviewFor.id}/review`, { decision, rating, feedback });
      setTask(updated);
      setReviewFor(null);
    } catch {
    } finally {
      setBusy(false);
    }
  };

  const deleteTask = async () => {
    if (!task) return;
    setBusy(true);
    try {
      await api.del(`/tasks/${task.id}`);
      navigate(-1);
    } catch {
      setBusy(false);
    }
  };

  if (loading) return <Page testId="task-detail-page"><Spinner /></Page>;
  if (!task) return <Page testId="task-detail-page"><EmptyState icon={<FileText size={26} />} title="Task not found" message="This task may have been removed or is no longer available." /></Page>;

  return (
    <Page testId="task-detail-page">
      <div className="flex items-start justify-between gap-3 mb-6 md:mb-8">
        <div className="flex items-start gap-3 min-w-0">
          <IconButton icon={<ChevronLeft size={20} />} variant="outline" onClick={() => navigate(-1)} label="Back" testId="task-detail-back" />
          <div className="min-w-0">
            {task.project_name ? (
              <button
                data-testid="task-project-link"
                type="button"
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
              {task.is_recurring ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10.5px] font-bold tracking-[1px]" style={{ backgroundColor: "rgba(212,175,55,0.15)", borderColor: colors.border.medium, color: colors.brand.goldDeep }}>
                  <Repeat size={11} /> {task.recurrence?.toUpperCase()}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {canManage ? (
          <IconButton icon={<Trash2 size={18} />} variant="outline" onClick={deleteTask} label="Delete task" testId="task-delete" />
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        <div className="lg:col-span-2 flex flex-col gap-4 md:gap-5">
          {task.description ? (
            <SectionCard title="Description">
              <p className="text-[14.5px] leading-relaxed" style={{ color: colors.text.primary }}>{task.description}</p>
            </SectionCard>
          ) : null}

          <SectionCard title={`Assignments (${task.assignments.length})`}>
            <div className="flex flex-col gap-4">
              {task.assignments.map((assignment) => {
                const isMine = user?.id === assignment.assignee_id;
                const isReviewer = canManage;
                return (
                  <div key={assignment.id} data-testid={`assignment-${assignment.id}`} className="rounded-2xl border p-4" style={{ backgroundColor: colors.bg.cardMuted, borderColor: colors.border.subtle }}>
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar name={assignment.assignee_name || "?"} role={assignment.assignee_role} size={40} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: colors.text.primary }}>{assignment.assignee_name}{isMine ? " (you)" : ""}</p>
                        <div className="mt-1"><AssignmentStatusPill status={assignment.status} small /></div>
                      </div>
                      {assignment.final_rating != null ? <RatingStars value={assignment.final_rating} size={13} showValue /> : null}
                    </div>

                    {assignment.rounds.map((round, roundIndex) => (
                      <div key={round.id} className="rounded-xl border p-3 mb-2.5 last:mb-0" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.subtle }}>
                        <div className="flex justify-between items-center mb-1.5 flex-wrap gap-1.5">
                          <span className="text-[11.5px] font-bold" style={{ color: colors.brand.maroon }}>
                            Round {roundIndex + 1} · <span style={{ color: colors.text.muted }}>{new Date(round.submitted_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
                          </span>
                          {round.decision ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9.5px] font-bold tracking-[0.6px]"
                              style={{
                                backgroundColor: round.decision === "approve" ? "rgba(9,121,105,0.15)" : "rgba(123,24,30,0.15)",
                                borderColor: round.decision === "approve" ? colors.brand.emerald : colors.brand.maroon,
                                color: round.decision === "approve" ? colors.brand.emerald : colors.brand.maroon,
                              }}
                            >
                              {round.decision === "approve" ? <CheckCircle size={11} /> : <XCircle size={11} />}
                              {round.decision.toUpperCase()}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold tracking-[0.5px]" style={{ color: colors.brand.gold }}>Awaiting review</span>
                          )}
                        </div>
                        {round.note ? <p className="text-[12.5px] italic mb-1.5" style={{ color: colors.text.secondary }}>&ldquo;{round.note}&rdquo;</p> : null}
                        {round.photos?.length > 0 ? (
                          <div className="flex gap-1.5 overflow-x-auto py-1">
                            {round.photos.map((photo, index) => (
                              <button
                                key={`${round.id}-photo-${index}`}
                                type="button"
                                onClick={() => setViewer({ id: `photo-${round.id}-${index}`, name: `Photo ${index + 1}`, mime: "image/jpeg", size: 0, data_uri: photo })}
                                className="rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                                data-testid={`round-photo-${round.id}-${index}`}
                              >
                                <img src={photo} alt={`Submission photo ${index + 1}`} className="w-[60px] h-[60px] rounded-lg object-cover" />
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {round.files?.length > 0 ? (
                          <div className="flex flex-col gap-1.5 mt-2">
                            {round.files.map((file) => (
                              <FileChip
                                key={file.id}
                                file={file}
                                onOpen={() => setViewer(file)}
                                testId={`round-file-${round.id}-${file.id}`}
                              />
                            ))}
                          </div>
                        ) : null}
                        {round.rating != null ? (
                          <div className="mt-2 pt-2 border-t" style={{ borderColor: colors.border.subtle }}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[11px] font-semibold" style={{ color: colors.text.muted }}>by {round.reviewed_by_name || "—"}</span>
                              <RatingStars value={round.rating} size={12} showValue />
                            </div>
                            {round.feedback ? <p className="text-[12.5px] leading-[17px] mt-1" style={{ color: colors.text.primary }}>{round.feedback}</p> : null}
                          </div>
                        ) : null}
                      </div>
                    ))}

                    <div className="flex gap-2 mt-3 flex-wrap">
                      {isMine && assignment.status === "pending" ? (
                        <button
                          data-testid={`start-${assignment.id}`}
                          type="button"
                          onClick={() => startAssignment(assignment)}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border text-[12.5px] font-bold transition-all hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-[#D4AF37] disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ borderColor: colors.brand.maroon, color: colors.brand.maroon, backgroundColor: colors.bg.card }}
                        >
                          Start
                        </button>
                      ) : null}
                      {isMine && ["pending", "in_progress", "rejected"].includes(assignment.status) ? (
                        <button
                          data-testid={`submit-${assignment.id}`}
                          type="button"
                          onClick={() => { setSubmitFor(assignment); setNote(""); setPhotos([]); setFiles([]); setSubmitError(""); }}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-[12.5px] font-bold transition-all hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-[#D4AF37] disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ backgroundColor: colors.brand.maroon, color: colors.text.inverse, border: `1px solid ${colors.brand.maroon}` }}
                        >
                          <Send size={13} />{assignment.status === "rejected" ? "Resubmit" : "Submit"}
                        </button>
                      ) : null}
                      {isReviewer && assignment.status === "submitted" ? (
                        <>
                          <button
                            data-testid={`reject-${assignment.id}`}
                            type="button"
                            onClick={() => { setReviewFor(assignment); setDecision("reject"); setRating(3); setFeedback(""); }}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border text-[12.5px] font-bold transition-all hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-[#D4AF37] disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ borderColor: colors.brand.maroon, color: colors.brand.maroon, backgroundColor: colors.bg.card }}
                          >
                            <XCircle size={13} />Reject
                          </button>
                          <button
                            data-testid={`approve-${assignment.id}`}
                            type="button"
                            onClick={() => { setReviewFor(assignment); setDecision("approve"); setRating(5); setFeedback(""); }}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-[12.5px] font-bold transition-all hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-[#D4AF37] disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ backgroundColor: colors.brand.emerald, color: colors.text.inverse, border: `1px solid ${colors.brand.emerald}` }}
                          >
                            <CheckCircle size={13} />Approve
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>

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

      {submitFor && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ backgroundColor: "rgba(26,18,16,0.65)" }}>
          <div className="w-full max-w-[460px] max-h-[calc(100vh-40px)] rounded-2xl border overflow-hidden flex flex-col" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.medium }} data-testid="submit-modal">
            <div className="shrink-0 px-5 pt-5 pb-3 border-b" style={{ borderColor: colors.border.subtle }}>
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="w-8 h-8 rounded-full border flex items-center justify-center" style={{ borderColor: colors.brand.gold, backgroundColor: "rgba(212,175,55,0.15)" }}><Send size={15} style={{ color: colors.brand.gold }} /></div>
                <h3 className="flex-1 font-display text-[17px] font-bold" style={{ color: colors.brand.maroon }}>Submit for Review</h3>
                <button data-testid="submit-modal-close" type="button" onClick={() => setSubmitFor(null)} className="p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ color: colors.text.muted }} aria-label="Close submit dialog"><X size={18} /></button>
              </div>
              <p className="text-[12.5px]" style={{ color: colors.text.secondary }}>Add photos, files, or a short note describing what you completed.</p>
              <p className="text-[11px] font-semibold mt-1" style={{ color: colors.text.muted }}>{FILE_HELP_TEXT}</p>
            </div>
            <div className="min-h-0 overflow-y-auto px-5 py-4">
              <textarea
                data-testid="submit-note-input"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Notes (optional)..."
                className="w-full rounded-xl border p-3 text-sm min-h-[80px] outline-none focus:ring-2 focus:ring-[#D4AF37] resize-none"
                style={{ backgroundColor: colors.bg.cardMuted, borderColor: colors.border.subtle, color: colors.text.primary }}
              />
              <div className="flex flex-wrap gap-2 mt-2.5">
                {photos.map((photo, index) => (
                  <div key={`${photo}-${index}`} className="relative">
                    <img src={photo} alt={`Selected submission ${index + 1}`} className="w-[60px] h-[60px] rounded-lg object-cover" />
                    <button data-testid={`remove-photo-${index}`} type="button" onClick={() => setPhotos((prev) => prev.filter((_, current) => current !== index))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: colors.brand.maroon, color: colors.text.inverse }} aria-label={`Remove photo ${index + 1}`}><X size={11} /></button>
                  </div>
                ))}
                <button data-testid="pick-photo" type="button" onClick={pickPhoto} className="w-[60px] h-[60px] rounded-lg border-[1.5px] border-dashed flex flex-col items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ borderColor: colors.brand.gold, backgroundColor: "rgba(212,175,55,0.10)" }}>
                  <Image size={20} style={{ color: colors.brand.gold }} />
                  <span className="text-[9px] font-bold mt-0.5" style={{ color: colors.brand.gold }}>Photo</span>
                </button>
                <button data-testid="pick-file" type="button" onClick={pickFile} className="w-[60px] h-[60px] rounded-lg border-[1.5px] border-dashed flex flex-col items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ borderColor: colors.brand.gold, backgroundColor: "rgba(212,175,55,0.10)" }}>
                  <Paperclip size={20} style={{ color: colors.brand.gold }} />
                  <span className="text-[9px] font-bold mt-0.5" style={{ color: colors.brand.gold }}>File</span>
                </button>
              </div>
              {files.length > 0 ? (
                <div className="flex flex-col gap-2 mt-2.5">
                  {files.map((file, index) => (
                    <FileChip
                      key={file.id}
                      file={file}
                      onRemove={() => setFiles((prev) => prev.filter((_, current) => current !== index))}
                      testId={`file-chip-${index}`}
                      removeTestId={`remove-file-${index}`}
                    />
                  ))}
                </div>
              ) : null}
              {submitError ? <p className="mt-2 text-[12px] font-semibold" style={{ color: colors.brand.maroon }}>{submitError}</p> : null}
            </div>
            <div className="shrink-0 px-5 pb-5 pt-3 border-t" style={{ borderColor: colors.border.subtle }}>
              <button
                data-testid="confirm-submit"
                type="button"
                disabled={busy || (photos.length === 0 && files.length === 0 && !note.trim())}
                onClick={doSubmit}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-bold transition-opacity focus:outline-none focus:ring-2 focus:ring-[#D4AF37] disabled:cursor-not-allowed"
                style={{ backgroundColor: colors.brand.maroon, color: colors.text.inverse, opacity: busy || (photos.length === 0 && files.length === 0 && !note.trim()) ? 0.5 : 1 }}
              >
                {busy ? <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <><Send size={16} />Send for Review</>}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {reviewFor && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ backgroundColor: "rgba(26,18,16,0.65)" }}>
          <div className="w-full max-w-[460px] rounded-2xl border p-5" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.medium }} data-testid="review-modal">
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-8 h-8 rounded-full border flex items-center justify-center" style={{ borderColor: colors.brand.gold, backgroundColor: "rgba(212,175,55,0.15)" }}>{decision === "approve" ? <CheckCircle size={16} style={{ color: colors.brand.emerald }} /> : <XCircle size={16} style={{ color: colors.brand.maroon }} />}</div>
              <h3 className="flex-1 font-display text-[17px] font-bold" style={{ color: colors.brand.maroon }}>{decision === "approve" ? "Approve & Rate" : "Reject & Rate"}</h3>
              <button data-testid="review-modal-close" type="button" onClick={() => setReviewFor(null)} className="p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ color: colors.text.muted }} aria-label="Close review dialog"><X size={18} /></button>
            </div>
            <p className="text-[12.5px] mb-3" style={{ color: colors.text.secondary }}>{decision === "approve" ? "Rate this submission." : "Rate this attempt and give feedback."}</p>
            <div className="flex justify-center gap-1 my-3">
              {[1, 2, 3, 4, 5].map((value) => (
                <button key={value} type="button" data-testid={`rating-star-${value}`} onClick={() => setRating(value)} className="text-[32px] mx-1 focus:outline-none transition-transform hover:scale-110" style={{ color: value <= rating ? colors.brand.gold : "rgba(212,175,55,0.35)" }}>★</button>
              ))}
            </div>
            <textarea
              data-testid="review-feedback"
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              placeholder={decision === "reject" ? "What needs to be improved?" : "Optional feedback..."}
              className="w-full rounded-xl border p-3 text-sm min-h-[80px] outline-none focus:ring-2 focus:ring-[#D4AF37] resize-none"
              style={{ backgroundColor: colors.bg.cardMuted, borderColor: colors.border.subtle, color: colors.text.primary }}
            />
            <button
              data-testid="confirm-review"
              type="button"
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

      {viewer && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ backgroundColor: "rgba(26,18,16,0.72)" }}>
          <div className="w-full max-w-[900px] max-h-[90vh] rounded-2xl border overflow-hidden flex flex-col" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.medium }} data-testid="attachment-viewer">
            <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: colors.border.subtle }}>
              {React.createElement(fileIconFor(viewer.mime), { size: 18, style: { color: colors.brand.gold } })}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: colors.text.primary }}>{viewer.name}</p>
                <p className="text-[11px] font-semibold truncate" style={{ color: colors.text.muted }}>{[readableSize(viewer.size), viewer.mime].filter(Boolean).join(" · ")}</p>
              </div>
              <a href={viewer.data_uri} download={viewer.name} className="w-9 h-9 rounded-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ color: colors.brand.maroon, border: `1px solid ${colors.border.medium}` }} aria-label={`Download ${viewer.name}`} title="Download">
                <Download size={16} />
              </a>
              <button type="button" data-testid="attachment-close" onClick={() => setViewer(null)} className="w-9 h-9 rounded-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ color: colors.brand.maroon, border: `1px solid ${colors.border.medium}` }} aria-label="Close attachment preview" title="Close">
                <X size={16} />
              </button>
            </div>
            <div className="min-h-[280px] max-h-[calc(90vh-68px)] overflow-auto flex items-center justify-center" style={{ backgroundColor: colors.bg.cardMuted }}>
              {isImageMime(viewer.mime) ? (
                <img src={viewer.data_uri} alt={viewer.name} className="max-w-full max-h-[calc(90vh-96px)] object-contain" data-testid="attachment-image" />
              ) : isPdfMime(viewer.mime) ? (
                <iframe src={viewer.data_uri} title={viewer.name} sandbox="" className="w-full h-[70vh] border-0" data-testid="attachment-pdf" />
              ) : (
                <div className="flex flex-col items-center text-center p-8">
                  {React.createElement(fileIconFor(viewer.mime), { size: 44, style: { color: colors.brand.gold } })}
                  <p className="font-display text-lg font-bold mt-3" style={{ color: colors.brand.maroon }}>{viewer.name}</p>
                  <p className="text-sm mt-1 max-w-sm" style={{ color: colors.text.secondary }}>Preview is not available for this file type. Download the file to view it.</p>
                </div>
              )}
            </div>
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
