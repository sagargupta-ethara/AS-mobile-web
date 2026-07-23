import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ClipboardList, Sparkles, Repeat } from "lucide-react";
import { api } from "@/apiClient";
import { colors } from "@/theme/colors";
import { Page, PageHeader, Card, IconButton, Spinner } from "@/components/ui-kit";
import AiTaskAssistant from "@/components/AiTaskAssistant";

const PRIORITIES = ["low", "medium", "high", "urgent"];
const UNIT_OPTIONS = [{ key: "day", label: "Day" }, { key: "week", label: "Week" }, { key: "month", label: "Month" }];
const WEEKDAYS = [
  { key: 0, label: "M" }, { key: 1, label: "T" }, { key: 2, label: "W" },
  { key: 3, label: "T" }, { key: 4, label: "F" }, { key: 5, label: "S" }, { key: 6, label: "S" },
];
const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const isoDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

function initials(name) { return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase() || "").join(""); }

function summarizeRecurrence(rec) {
  if (!rec.enabled) return null;
  const noun = rec.interval_unit + (rec.interval_value > 1 ? "s" : "");
  let base = `Every ${rec.interval_value} ${noun}`;
  if (rec.interval_unit === "week" && rec.weekdays.length > 0) {
    base += " on " + rec.weekdays.slice().sort().map((d) => WEEKDAY_NAMES[d]).join(", ");
  }
  if (rec.interval_unit === "month" && rec.day_of_month) {
    base += ` on day ${rec.day_of_month}`;
  }
  if (rec.start_date) base += `, starting ${rec.start_date}`;
  if (rec.end_date) base += `, until ${rec.end_date}`;
  return base + ".";
}

export default function NewTaskPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const paramProjectId = searchParams.get("project_id");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeIds, setAssigneeIds] = useState([]);
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [projectId, setProjectId] = useState(paramProjectId || null);
  const today = isoDate(new Date());
  const [recurrence, setRecurrence] = useState({
    enabled: false,
    interval_value: 1,
    interval_unit: "day",
    weekdays: [],
    day_of_month: null,
    start_date: today,
    end_date: null,
  });
  const [showAi, setShowAi] = useState(false);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [u, p] = await Promise.all([api.get("/users"), api.get("/projects")]);
      setUsers(u); setProjects(p.filter((x) => x.status !== "closed"));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const eligibleAssignees = useMemo(() => users, [users]);
  const toggleAssignee = (id) => setAssigneeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleWeekday = (w) => setRecurrence((r) => ({ ...r, weekdays: r.weekdays.includes(w) ? r.weekdays.filter((x) => x !== w) : [...r.weekdays, w].sort() }));
  const canSubmit = title.trim().length > 0 && assigneeIds.length > 0 && (!recurrence.enabled || !!recurrence.start_date);

  const applyAiResult = (parsed) => {
    if (parsed.title) setTitle(parsed.title);
    if (parsed.description) setDescription(parsed.description);
    if (parsed.priority) setPriority(parsed.priority);
    if (parsed.due_date_iso) {
      const d = new Date(parsed.due_date_iso);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setDueDate(local);
    }
    setShowAi(false);
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        project_id: projectId,
        assignee_ids: assigneeIds,
        priority,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
      };
      if (recurrence.enabled) payload.recurrence = recurrence;
      await api.post("/tasks", payload);
      navigate(-1);
    } catch { /* silent */ } finally { setSaving(false); }
  };

  if (loading) return <Spinner />;

  const summary = summarizeRecurrence(recurrence);

  return (
    <Page width="narrow" testId="new-task-page">
      <div className="mb-4">
        <IconButton icon={<ChevronLeft size={20} />} variant="outline" onClick={() => navigate(-1)} label="Back" testId="new-task-back" />
      </div>
      <PageHeader
        overline="New Assignment"
        title="Create Task"
        icon={<ClipboardList size={20} />}
        actions={
          <button
            data-testid="ai-parse-button"
            onClick={() => setShowAi(true)}
            className="flex items-center gap-1.5 px-4 h-10 rounded-full text-[12.5px] font-bold transition-all hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            style={{ background: `linear-gradient(135deg, ${colors.brand.maroon}, ${colors.brand.maroonDeep})`, color: colors.text.inverse, border: `1px solid ${colors.brand.gold}` }}
          >
            <Sparkles size={14} style={{ color: colors.brand.gold }} /> AI Parse
          </button>
        }
      />
      <Card className="p-6 md:p-7">
        <div className="space-y-4">
          <Field label="Title">
            <input data-testid="task-title-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Prepare drawing room for evening guests" className="w-full rounded-xl border px-3.5 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.medium, color: colors.text.primary }} />
          </Field>
          <Field label="Description">
            <textarea data-testid="task-description-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add specific instructions or context…" className="w-full rounded-xl border px-3.5 py-2.5 text-[15px] min-h-[96px] outline-none focus:ring-2 focus:ring-[#D4AF37] resize-none" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.medium, color: colors.text.primary }} />
          </Field>
          <Field label={`Project ${projectId ? "· selected" : "(optional)"}`}>
            {paramProjectId ? (
              <div className="flex items-center gap-2 px-3.5 py-3 rounded-xl border" style={{ borderColor: colors.brand.gold, backgroundColor: "rgba(212,175,55,0.10)" }} data-testid="project-locked">
                <span className="flex-1 text-sm font-bold" style={{ color: colors.brand.maroon }}>{projects.find((p) => p.id === projectId)?.name || "This project"}</span>
              </div>
            ) : (
              <div className="flex gap-2 overflow-x-auto py-1">
                <button data-testid="project-none" onClick={() => setProjectId(null)} className="shrink-0 h-9 px-3.5 rounded-full text-[12.5px] font-semibold border transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: projectId === null ? colors.brand.maroon : colors.bg.card, borderColor: projectId === null ? colors.brand.maroon : colors.border.medium, color: projectId === null ? colors.text.inverse : colors.text.secondary }}>Standalone</button>
                {projects.map((p) => <button key={p.id} data-testid={`project-${p.id}`} onClick={() => setProjectId(p.id)} className="shrink-0 h-9 px-3.5 rounded-full text-[12.5px] font-semibold border transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: projectId === p.id ? colors.brand.maroon : colors.bg.card, borderColor: projectId === p.id ? colors.brand.maroon : colors.border.medium, color: projectId === p.id ? colors.text.inverse : colors.text.secondary }}>{p.name}</button>)}
              </div>
            )}
          </Field>
          <Field label={`Assign to (${assigneeIds.length})`}>
            <div className="flex gap-2 overflow-x-auto py-1">
              {eligibleAssignees.length === 0 ? <p className="text-[13px] py-3" style={{ color: colors.text.muted }}>No eligible members yet.</p> : eligibleAssignees.map((s) => {
                const active = assigneeIds.includes(s.id);
                return (
                  <button key={s.id} data-testid={`assignee-${s.id}`} onClick={() => toggleAssignee(s.id)} className="shrink-0 flex items-center gap-2.5 h-14 px-3 pr-4 rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: active ? colors.brand.maroon : colors.bg.card, borderColor: active ? colors.brand.maroon : colors.border.medium }}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold" style={{ backgroundColor: active ? colors.brand.gold : (s.role === "manager" ? colors.brand.navy : colors.brand.maroon), color: active ? colors.brand.maroon : colors.text.inverse }}>{initials(s.name)}</div>
                    <div><p className="text-[13.5px] font-bold" style={{ color: active ? colors.text.inverse : colors.text.primary }}>{s.name}</p><p className="text-[10px] tracking-[1px] font-semibold mt-0.5" style={{ color: active ? "rgba(253,251,247,0.75)" : colors.text.muted }}>{s.role.toUpperCase()}</p></div>
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Priority">
            <div className="flex gap-2 flex-wrap">
              {PRIORITIES.map((p) => <button key={p} data-testid={`priority-${p}`} onClick={() => setPriority(p)} className="flex-1 h-9 rounded-full text-[11.5px] font-bold tracking-[1px] uppercase border transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: priority === p ? colors.priority[p] : colors.bg.card, borderColor: priority === p ? colors.priority[p] : colors.border.medium, color: priority === p ? colors.text.inverse : colors.text.secondary }}>{p}</button>)}
            </div>
          </Field>
          <Field label="Due date">
            <input data-testid="task-due-picker" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full rounded-xl border px-3.5 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.medium, color: dueDate ? colors.text.primary : colors.text.muted }} />
            {dueDate && <button data-testid="clear-due-date" onClick={() => setDueDate("")} className="text-xs font-bold mt-1.5 focus:outline-none" style={{ color: colors.brand.gold }}>Clear</button>}
          </Field>

          <div className="rounded-xl p-4 border" data-testid="recurrence-section" style={{ backgroundColor: colors.bg.cardMuted, borderColor: colors.border.subtle }}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Repeat size={14} style={{ color: colors.brand.emerald }} />
                <div>
                  <p className="text-sm font-bold" style={{ color: colors.text.primary }}>Recurring task</p>
                  <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>Automatically create the next occurrence when this one completes.</p>
                </div>
              </div>
              <button data-testid="toggle-recurring" onClick={() => setRecurrence((r) => ({ ...r, enabled: !r.enabled }))} className="w-12 h-7 rounded-full p-[3px] transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: recurrence.enabled ? colors.brand.emerald : colors.bg.tertiary }}>
                <div className="w-[22px] h-[22px] rounded-full transition-transform" style={{ backgroundColor: colors.bg.primary, transform: recurrence.enabled ? "translateX(20px)" : "translateX(0)" }} />
              </button>
            </div>

            {recurrence.enabled && (
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-[13px] font-semibold" style={{ color: colors.text.secondary }}>Repeat every</span>
                  <input
                    type="number"
                    data-testid="recurrence-interval"
                    min={1}
                    max={30}
                    value={recurrence.interval_value}
                    onChange={(e) => setRecurrence((r) => ({ ...r, interval_value: Math.max(1, parseInt(e.target.value || "1", 10)) }))}
                    className="w-16 rounded-lg border px-2 py-1.5 text-[14px] outline-none text-center focus:ring-2 focus:ring-[#D4AF37]"
                    style={{ backgroundColor: colors.bg.card, borderColor: colors.border.medium, color: colors.text.primary }}
                  />
                  <div className="flex gap-1.5">
                    {UNIT_OPTIONS.map((u) => (
                      <button
                        key={u.key}
                        data-testid={`recurrence-unit-${u.key}`}
                        onClick={() => setRecurrence((r) => ({ ...r, interval_unit: u.key, weekdays: [] }))}
                        className="h-8 px-3 rounded-full text-[12px] font-semibold border transition-colors"
                        style={{
                          backgroundColor: recurrence.interval_unit === u.key ? colors.brand.emerald : colors.bg.card,
                          borderColor: recurrence.interval_unit === u.key ? colors.brand.emerald : colors.border.medium,
                          color: recurrence.interval_unit === u.key ? colors.text.inverse : colors.text.secondary,
                        }}
                      >{u.label}</button>
                    ))}
                  </div>
                </div>

                {recurrence.interval_unit === "week" && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: colors.text.muted }}>On</p>
                    <div className="flex gap-1.5">
                      {WEEKDAYS.map((w) => {
                        const active = recurrence.weekdays.includes(w.key);
                        return (
                          <button
                            key={w.key}
                            data-testid={`recurrence-weekday-${w.key}`}
                            onClick={() => toggleWeekday(w.key)}
                            className="w-9 h-9 rounded-full text-[13px] font-bold border transition-colors"
                            style={{
                              backgroundColor: active ? colors.brand.emerald : colors.bg.card,
                              borderColor: active ? colors.brand.emerald : colors.border.medium,
                              color: active ? colors.text.inverse : colors.text.secondary,
                            }}
                          >{w.label}</button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {recurrence.interval_unit === "month" && (
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold" style={{ color: colors.text.secondary }}>On day of month</span>
                    <input
                      type="number"
                      data-testid="recurrence-dom"
                      min={1}
                      max={31}
                      value={recurrence.day_of_month || ""}
                      onChange={(e) => {
                        const v = e.target.value === "" ? null : Math.max(1, Math.min(31, parseInt(e.target.value, 10)));
                        setRecurrence((r) => ({ ...r, day_of_month: v }));
                      }}
                      placeholder="same as start"
                      className="w-24 rounded-lg border px-2 py-1.5 text-[14px] outline-none text-center focus:ring-2 focus:ring-[#D4AF37]"
                      style={{ backgroundColor: colors.bg.card, borderColor: colors.border.medium, color: colors.text.primary }}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: colors.text.muted }}>Starts on</p>
                    <input
                      type="date"
                      data-testid="recurrence-start"
                      value={recurrence.start_date || today}
                      onChange={(e) => setRecurrence((r) => ({ ...r, start_date: e.target.value }))}
                      className="w-full rounded-lg border px-2.5 py-2 text-[14px] outline-none focus:ring-2 focus:ring-[#D4AF37]"
                      style={{ backgroundColor: colors.bg.card, borderColor: colors.border.medium, color: colors.text.primary }}
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: colors.text.muted }}>Ends on (optional)</p>
                    <input
                      type="date"
                      data-testid="recurrence-end"
                      value={recurrence.end_date || ""}
                      onChange={(e) => setRecurrence((r) => ({ ...r, end_date: e.target.value || null }))}
                      className="w-full rounded-lg border px-2.5 py-2 text-[14px] outline-none focus:ring-2 focus:ring-[#D4AF37]"
                      style={{ backgroundColor: colors.bg.card, borderColor: colors.border.medium, color: recurrence.end_date ? colors.text.primary : colors.text.muted }}
                    />
                  </div>
                </div>

                {summary && (
                  <div className="text-[12.5px] px-3 py-2 rounded-lg" data-testid="recurrence-summary" style={{ backgroundColor: "rgba(9,121,105,0.08)", color: colors.brand.emerald, fontWeight: 600 }}>
                    {summary}
                  </div>
                )}
              </div>
            )}
          </div>

          <button data-testid="task-submit" disabled={!canSubmit || saving} onClick={submit} className="w-full flex items-center justify-center gap-2 h-12 rounded-xl text-[15px] font-bold tracking-[0.4px] transition-opacity focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.brand.maroon, color: colors.text.inverse, opacity: !canSubmit || saving ? 0.55 : 1 }}>
            {saving ? <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <>{assigneeIds.length > 1 ? `Assign to ${assigneeIds.length}` : "Assign Task"}</>}
          </button>
        </div>
      </Card>
      <AiTaskAssistant visible={showAi} onClose={() => setShowAi(false)} onApply={applyAiResult} />
    </Page>
  );
}

function Field({ label, children }) {
  return <div><p className="text-[12px] font-bold uppercase tracking-wide mb-2" style={{ color: colors.text.muted }}>{label}</p>{children}</div>;
}
