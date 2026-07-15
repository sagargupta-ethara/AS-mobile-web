import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, Sparkles } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { api } from "@/apiClient";
import { colors } from "@/theme/colors";
import AiTaskAssistant from "@/components/AiTaskAssistant";

const PRIORITIES = ["low", "medium", "high", "urgent"];
const RECURRENCE = [{ key: "daily", label: "Daily" }, { key: "weekly", label: "Weekly" }, { key: "monthly", label: "Monthly" }];

function initials(name) { return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase() || "").join(""); }

export default function NewTaskPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const paramProjectId = searchParams.get("project_id");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(null);
  const [assigneeIds, setAssigneeIds] = useState([]);
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [projectId, setProjectId] = useState(paramProjectId || null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrence, setRecurrence] = useState("weekly");
  const [showAi, setShowAi] = useState(false);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [u, c, p] = await Promise.all([api.get("/users"), api.get("/categories"), api.get("/projects")]);
      setUsers(u); setCategories(c); setProjects(p.filter((x) => x.status !== "closed"));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const eligibleAssignees = useMemo(() => {
    if (user?.role === "admin") return users.filter((u) => u.role === "manager" || u.role === "tasker");
    return users.filter((u) => u.role === "tasker");
  }, [users, user]);

  const toggleAssignee = (id) => setAssigneeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const canSubmit = title.trim().length > 0 && assigneeIds.length > 0;

  const applyAiResult = (parsed) => {
    if (parsed.title) setTitle(parsed.title);
    if (parsed.description) setDescription(parsed.description);
    if (parsed.category) setCategory(parsed.category);
    if (parsed.priority) setPriority(parsed.priority);
    if (parsed.due_date_iso) {
      const d = new Date(parsed.due_date_iso);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setDueDate(local);
    }
    if (parsed.is_recurring) { setIsRecurring(true); if (parsed.recurrence) setRecurrence(parsed.recurrence); }
    setShowAi(false);
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await api.post("/tasks", { title: title.trim(), description: description.trim(), category, project_id: projectId, assignee_ids: assigneeIds, priority, due_date: dueDate ? new Date(dueDate).toISOString() : null, is_recurring: isRecurring, recurrence: isRecurring ? recurrence : null });
      navigate(-1);
    } catch { /* silent */ } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><span className="animate-spin w-8 h-8 border-3 rounded-full" style={{ borderColor: colors.brand.maroon, borderTopColor: "transparent" }} /></div>;

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: colors.bg.primary }}>
      <div className="flex items-center gap-2 px-4 pt-3 pb-3 border-b" style={{ borderColor: colors.border.subtle }}>
        <button data-testid="new-task-back" onClick={() => navigate(-1)} className="w-10 h-10 rounded-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"><ChevronLeft size={22} style={{ color: colors.brand.maroon }} /></button>
        <div className="flex-1"><p className="text-[10px] tracking-[2.5px] font-bold" style={{ color: colors.brand.gold }}>NEW ASSIGNMENT</p><p className="text-[22px] font-bold tracking-tight mt-0.5" style={{ color: colors.brand.maroon }}>Create Task</p></div>
        <button data-testid="ai-parse-button" onClick={() => setShowAi(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-bold transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ background: `linear-gradient(135deg, ${colors.brand.maroon}, ${colors.brand.maroonDeep})`, color: colors.text.inverse, border: `1px solid ${colors.brand.gold}` }}>
          <Sparkles size={14} style={{ color: colors.brand.gold }} /> AI Parse
        </button>
      </div>
      <div className="p-5 pb-32 max-w-2xl">
        <Field label="Title"><input data-testid="task-title-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Prepare drawing room for evening guests" className="w-full rounded-xl border px-3.5 py-3.5 text-[15px] outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle, color: colors.text.primary }} /></Field>
        <Field label="Description"><textarea data-testid="task-description-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add specific instructions or context…" className="w-full rounded-xl border px-3.5 py-3.5 text-[15px] min-h-[96px] outline-none focus:ring-2 focus:ring-[#D4AF37] resize-none" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle, color: colors.text.primary }} /></Field>
        <Field label={`Project ${projectId ? "· selected" : "(optional)"}`}>
          {paramProjectId ? (
            <div className="flex items-center gap-2 px-3.5 py-3.5 rounded-xl border" style={{ borderColor: colors.brand.gold, backgroundColor: "rgba(212,175,55,0.10)" }} data-testid="project-locked">
              <span className="flex-1 text-sm font-bold" style={{ color: colors.brand.maroon }}>{projects.find((p) => p.id === projectId)?.name || "This project"}</span>
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto py-1">
              <button data-testid="project-none" onClick={() => setProjectId(null)} className="shrink-0 h-9 px-3.5 rounded-full text-[12.5px] font-semibold border transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: projectId === null ? colors.brand.maroon : colors.bg.secondary, borderColor: projectId === null ? colors.brand.maroon : colors.border.subtle, color: projectId === null ? colors.text.inverse : colors.text.secondary }}>Standalone</button>
              {projects.map((p) => <button key={p.id} data-testid={`project-${p.id}`} onClick={() => setProjectId(p.id)} className="shrink-0 h-9 px-3.5 rounded-full text-[12.5px] font-semibold border transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: projectId === p.id ? colors.brand.maroon : colors.bg.secondary, borderColor: projectId === p.id ? colors.brand.maroon : colors.border.subtle, color: projectId === p.id ? colors.text.inverse : colors.text.secondary }}>{p.name}</button>)}
            </div>
          )}
        </Field>
        <Field label={`Assign to (${assigneeIds.length})`}>
          <div className="flex gap-2 overflow-x-auto py-1">
            {eligibleAssignees.length === 0 ? <p className="text-[13px] py-3" style={{ color: colors.text.muted }}>No eligible members yet.</p> : eligibleAssignees.map((s) => {
              const active = assigneeIds.includes(s.id);
              return (
                <button key={s.id} data-testid={`assignee-${s.id}`} onClick={() => toggleAssignee(s.id)} className="shrink-0 flex items-center gap-2.5 h-14 px-3 pr-4 rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: active ? colors.brand.maroon : colors.bg.secondary, borderColor: active ? colors.brand.maroon : colors.border.subtle }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold" style={{ backgroundColor: active ? colors.brand.gold : (s.role === "manager" ? colors.brand.navy : colors.brand.maroon), color: active ? colors.brand.maroon : colors.text.inverse }}>{initials(s.name)}</div>
                  <div><p className="text-[13.5px] font-bold" style={{ color: active ? colors.text.inverse : colors.text.primary }}>{s.name}</p><p className="text-[10px] tracking-[1px] font-semibold mt-0.5" style={{ color: active ? "rgba(253,251,247,0.75)" : colors.text.muted }}>{s.role.toUpperCase()}</p></div>
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Category">
          <div className="flex gap-2 overflow-x-auto py-1">
            <button data-testid="category-none" onClick={() => setCategory(null)} className="shrink-0 h-9 px-3.5 rounded-full text-[12.5px] font-semibold border transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: category === null ? colors.brand.maroon : colors.bg.secondary, borderColor: category === null ? colors.brand.maroon : colors.border.subtle, color: category === null ? colors.text.inverse : colors.text.secondary }}>None</button>
            {categories.map((c) => <button key={c.id} data-testid={`category-${c.id}`} onClick={() => setCategory(c.name)} className="shrink-0 h-9 px-3.5 rounded-full text-[12.5px] font-semibold border transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: category === c.name ? colors.brand.maroon : colors.bg.secondary, borderColor: category === c.name ? colors.brand.maroon : colors.border.subtle, color: category === c.name ? colors.text.inverse : colors.text.secondary }}>{c.name}</button>)}
          </div>
        </Field>
        <Field label="Priority">
          <div className="flex gap-2 flex-wrap">
            {PRIORITIES.map((p) => <button key={p} data-testid={`priority-${p}`} onClick={() => setPriority(p)} className="flex-1 h-9 rounded-full text-[11.5px] font-bold tracking-[1px] uppercase border transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: priority === p ? colors.priority[p] : colors.bg.secondary, borderColor: priority === p ? colors.priority[p] : colors.border.subtle, color: priority === p ? colors.text.inverse : colors.text.secondary }}>{p}</button>)}
          </div>
        </Field>
        <Field label="Due date">
          <input data-testid="task-due-picker" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full rounded-xl border px-3.5 py-3.5 text-[15px] outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle, color: dueDate ? colors.text.primary : colors.text.muted }} />
          {dueDate && <button data-testid="clear-due-date" onClick={() => setDueDate("")} className="text-xs font-bold mt-1.5 self-end focus:outline-none" style={{ color: colors.brand.gold }}>Clear</button>}
        </Field>
        <div className="rounded-[14px] p-4 border mt-1.5" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }}>
          <div className="flex justify-between items-center">
            <div><p className="text-sm font-bold" style={{ color: colors.text.primary }}>Recurring task</p><p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>Repeat automatically on a schedule</p></div>
            <button data-testid="toggle-recurring" onClick={() => setIsRecurring((v) => !v)} className="w-12 h-7 rounded-full p-[3px] transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: isRecurring ? colors.brand.emerald : colors.bg.tertiary }}>
              <div className="w-[22px] h-[22px] rounded-full transition-transform" style={{ backgroundColor: colors.bg.primary, transform: isRecurring ? "translateX(20px)" : "translateX(0)" }} />
            </button>
          </div>
          {isRecurring && <div className="flex gap-2 mt-3">{RECURRENCE.map((r) => <button key={r.key} data-testid={`recurrence-${r.key}`} onClick={() => setRecurrence(r.key)} className="h-8 px-3 rounded-full text-[12.5px] font-semibold border transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: recurrence === r.key ? colors.brand.emerald : colors.bg.primary, borderColor: recurrence === r.key ? colors.brand.emerald : colors.border.subtle, color: recurrence === r.key ? colors.text.inverse : colors.text.secondary }}>{r.label}</button>)}</div>}
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 md:left-[220px] px-5 pt-3 pb-5 border-t z-40" style={{ backgroundColor: colors.bg.primary, borderColor: colors.border.subtle }}>
        <button data-testid="task-submit" disabled={!canSubmit || saving} onClick={submit} className="w-full max-w-2xl mx-auto flex items-center justify-center gap-2 py-4 rounded-xl text-[15px] font-bold tracking-[0.4px] transition-opacity focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.brand.maroon, color: colors.text.inverse, opacity: !canSubmit || saving ? 0.55 : 1 }}>
          {saving ? <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <>{assigneeIds.length > 1 ? `Assign to ${assigneeIds.length}` : "Assign Task"}</>}
        </button>
      </div>
      <AiTaskAssistant visible={showAi} onClose={() => setShowAi(false)} onApply={applyAiResult} />
    </div>
  );
}

function Field({ label, children }) {
  return <div className="mb-4"><p className="text-[11px] tracking-[2px] font-bold uppercase mb-2" style={{ color: colors.text.secondary }}>{label}</p>{children}</div>;
}
