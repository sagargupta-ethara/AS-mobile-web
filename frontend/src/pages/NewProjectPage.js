import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Library } from "lucide-react";
import { api } from "@/apiClient";
import { colors } from "@/theme/colors";

function initials(name) { return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase() || "").join(""); }

export default function NewProjectPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [managerIds, setManagerIds] = useState([]);
  const [taskerIds, setTaskerIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => { try { setUsers(await api.get("/users")); } finally { setLoading(false); } })(); }, []);

  const managers = users.filter((u) => u.role === "manager");
  const taskers = users.filter((u) => u.role === "tasker");
  const toggle = (arr, id, setter) => setter(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try { await api.post("/projects", { name: name.trim(), description: description.trim(), manager_ids: managerIds, tasker_ids: taskerIds }); navigate(-1); } catch { /* silent */ } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><span className="animate-spin w-8 h-8 border-3 rounded-full" style={{ borderColor: colors.brand.maroon, borderTopColor: "transparent" }} /></div>;

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: colors.bg.primary }}>
      <div className="flex items-center gap-2 px-4 pt-3 pb-3 border-b" style={{ borderColor: colors.border.subtle }}>
        <button data-testid="new-project-back" onClick={() => navigate(-1)} className="w-10 h-10 rounded-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"><ChevronLeft size={22} style={{ color: colors.brand.maroon }} /></button>
        <div className="flex-1"><p className="text-[10px] tracking-[2.5px] font-bold" style={{ color: colors.brand.gold }}>NEW INITIATIVE</p><p className="text-[22px] font-bold tracking-tight mt-0.5" style={{ color: colors.brand.maroon }}>Create Project</p></div>
      </div>
      <div className="p-5 pb-32 max-w-2xl">
        <Field label="Project Name"><input data-testid="project-name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Winter Diwali Preparations 2026" className="w-full rounded-xl border px-3.5 py-3.5 text-[15px] outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle, color: colors.text.primary }} /></Field>
        <Field label="Description"><textarea data-testid="project-desc-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this initiative about?" className="w-full rounded-xl border px-3.5 py-3.5 text-[15px] min-h-[90px] outline-none focus:ring-2 focus:ring-[#D4AF37] resize-none" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle, color: colors.text.primary }} /></Field>
        <Field label={`Managers (${managerIds.length})`}>
          <div className="flex gap-2 overflow-x-auto py-1">{managers.length === 0 ? <p className="text-[13px] py-2" style={{ color: colors.text.muted }}>Add managers from Team first.</p> : managers.map((m) => { const active = managerIds.includes(m.id); return <button key={m.id} data-testid={`select-manager-${m.id}`} onClick={() => toggle(managerIds, m.id, setManagerIds)} className="shrink-0 inline-flex items-center gap-2 px-2.5 py-2 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: active ? colors.brand.maroon : colors.bg.secondary, borderColor: active ? colors.brand.maroon : colors.border.subtle }}><div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: active ? colors.brand.gold : colors.brand.navy, color: active ? colors.brand.maroon : colors.text.inverse }}>{initials(m.name)}</div><span className="text-[12.5px] font-bold" style={{ color: active ? colors.text.inverse : colors.text.primary }}>{m.name}</span></button>; })}</div>
        </Field>
        <Field label={`Taskers (${taskerIds.length})`}>
          <div className="flex gap-2 overflow-x-auto py-1">{taskers.length === 0 ? <p className="text-[13px] py-2" style={{ color: colors.text.muted }}>Add taskers from Team first.</p> : taskers.map((t) => { const active = taskerIds.includes(t.id); return <button key={t.id} data-testid={`select-tasker-${t.id}`} onClick={() => toggle(taskerIds, t.id, setTaskerIds)} className="shrink-0 inline-flex items-center gap-2 px-2.5 py-2 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: active ? colors.brand.maroon : colors.bg.secondary, borderColor: active ? colors.brand.maroon : colors.border.subtle }}><div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: active ? colors.brand.gold : colors.brand.maroon, color: active ? colors.brand.maroon : colors.text.inverse }}>{initials(t.name)}</div><span className="text-[12.5px] font-bold" style={{ color: active ? colors.text.inverse : colors.text.primary }}>{t.name}</span></button>; })}</div>
        </Field>
      </div>
      <div className="fixed bottom-0 left-0 right-0 md:left-[220px] px-5 pt-3 pb-5 border-t z-40" style={{ backgroundColor: colors.bg.primary, borderColor: colors.border.subtle }}>
        <button data-testid="project-submit" disabled={saving} onClick={submit} className="w-full max-w-2xl mx-auto flex items-center justify-center gap-2 py-4 rounded-xl text-[15px] font-bold tracking-[0.4px] transition-opacity focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.brand.maroon, color: colors.text.inverse, opacity: saving ? 0.6 : 1 }}>
          {saving ? <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <><Library size={18} />Create Project</>}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <div className="mb-4"><p className="text-[11px] tracking-[2px] font-bold uppercase mb-2" style={{ color: colors.text.secondary }}>{label}</p>{children}</div>;
}
