import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Library } from "lucide-react";
import { api } from "@/apiClient";
import { colors } from "@/theme/colors";
import { Page, PageHeader, Card, IconButton, Spinner } from "@/components/ui-kit";

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

  if (loading) return <Spinner />;

  return (
    <Page width="narrow" testId="new-project-page">
      <div className="mb-4">
        <IconButton icon={<ChevronLeft size={20} />} variant="outline" onClick={() => navigate(-1)} label="Back" testId="new-project-back" />
      </div>
      <PageHeader overline="New Initiative" title="Create Project" icon={<Library size={20} />} />
      <Card className="p-6 md:p-7">
        <div className="space-y-4">
          <Field label="Project Name">
            <input data-testid="project-name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Winter Diwali Preparations 2026" className="w-full rounded-xl border px-3.5 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.medium, color: colors.text.primary }} />
          </Field>
          <Field label="Description">
            <textarea data-testid="project-desc-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this initiative about?" className="w-full rounded-xl border px-3.5 py-2.5 text-[15px] min-h-[90px] outline-none focus:ring-2 focus:ring-[#D4AF37] resize-none" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.medium, color: colors.text.primary }} />
          </Field>
          <Field label={`Managers (${managerIds.length})`}>
            <div className="flex gap-2 overflow-x-auto py-1">
              {managers.length === 0 ? <p className="text-[13px] py-2" style={{ color: colors.text.muted }}>Add managers from Team first.</p> : managers.map((m) => {
                const active = managerIds.includes(m.id);
                return (
                  <button key={m.id} data-testid={`select-manager-${m.id}`} onClick={() => toggle(managerIds, m.id, setManagerIds)} className="shrink-0 inline-flex items-center gap-2 px-2.5 py-2 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: active ? colors.brand.maroon : colors.bg.card, borderColor: active ? colors.brand.maroon : colors.border.medium }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: active ? colors.brand.gold : colors.brand.navy, color: active ? colors.brand.maroon : colors.text.inverse }}>{initials(m.name)}</div>
                    <span className="text-[12.5px] font-bold" style={{ color: active ? colors.text.inverse : colors.text.primary }}>{m.name}</span>
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label={`Taskers (${taskerIds.length})`}>
            <div className="flex gap-2 overflow-x-auto py-1">
              {taskers.length === 0 ? <p className="text-[13px] py-2" style={{ color: colors.text.muted }}>Add taskers from Team first.</p> : taskers.map((t) => {
                const active = taskerIds.includes(t.id);
                return (
                  <button key={t.id} data-testid={`select-tasker-${t.id}`} onClick={() => toggle(taskerIds, t.id, setTaskerIds)} className="shrink-0 inline-flex items-center gap-2 px-2.5 py-2 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: active ? colors.brand.maroon : colors.bg.card, borderColor: active ? colors.brand.maroon : colors.border.medium }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: active ? colors.brand.gold : colors.brand.maroon, color: active ? colors.brand.maroon : colors.text.inverse }}>{initials(t.name)}</div>
                    <span className="text-[12.5px] font-bold" style={{ color: active ? colors.text.inverse : colors.text.primary }}>{t.name}</span>
                  </button>
                );
              })}
            </div>
          </Field>
          <button data-testid="project-submit" disabled={saving} onClick={submit} className="w-full flex items-center justify-center gap-2 h-12 rounded-xl text-[15px] font-bold tracking-[0.4px] transition-opacity focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.brand.maroon, color: colors.text.inverse, opacity: saving ? 0.6 : 1 }}>
            {saving ? <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <><Library size={18} />Create Project</>}
          </button>
        </div>
      </Card>
    </Page>
  );
}

function Field({ label, children }) {
  return <div><p className="text-[12px] font-bold uppercase tracking-wide mb-2" style={{ color: colors.text.muted }}>{label}</p>{children}</div>;
}
