import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, UserPlus, Check } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { api } from "@/apiClient";
import { colors } from "@/theme/colors";
import { Page, PageHeader, Card, IconButton } from "@/components/ui-kit";

export default function NewStaffPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("tasker");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canCreateManager = user?.role === "admin";
  const ROLES = [{ key: "tasker", label: "Tasker", hint: "Receives and completes tasks" }, ...(canCreateManager ? [{ key: "manager", label: "Manager", hint: "Can assign tasks to taskers, manage projects" }] : [])];

  const submit = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) { setError("Name, email and password are required"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setSaving(true); setError("");
    try { await api.post("/users", { name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim() || null, password, role }); navigate(-1); } catch (e) { setError(e?.message || "Failed to add"); } finally { setSaving(false); }
  };

  return (
    <Page width="narrow" testId="new-staff-page">
      <div className="mb-4">
        <IconButton icon={<ChevronLeft size={20} />} variant="outline" onClick={() => navigate(-1)} label="Back" testId="new-staff-back" />
      </div>
      <PageHeader overline="Add to Household" title="New Member" icon={<UserPlus size={20} />} />
      <Card className="p-6 md:p-7">
        <div className="space-y-4">
          {error && <div className="p-3 rounded-xl text-sm font-semibold" style={{ backgroundColor: "rgba(123,24,30,0.08)", color: colors.brand.maroon }}>{error}</div>}
          <Field label="Full Name"><input data-testid="staff-name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ramesh Kumar" className="w-full rounded-xl border px-3.5 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.medium, color: colors.text.primary }} /></Field>
          <Field label="Email"><input data-testid="staff-email-input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="e.g. ramesh@household" className="w-full rounded-xl border px-3.5 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.medium, color: colors.text.primary }} /></Field>
          <Field label="Phone (optional)"><input data-testid="staff-phone-input" value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="+91 …" className="w-full rounded-xl border px-3.5 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.medium, color: colors.text.primary }} /></Field>
          <Field label="Temporary Password"><input data-testid="staff-password-input" value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" placeholder="Share with them privately" className="w-full rounded-xl border px-3.5 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.medium, color: colors.text.primary }} /></Field>
          <Field label="Role">
            <div className="flex flex-col gap-2.5">{ROLES.map((r) => { const active = role === r.key; return (
              <button key={r.key} data-testid={`role-${r.key}`} onClick={() => setRole(r.key)} className="flex items-center gap-3 p-4 rounded-xl border transition-colors text-left focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: active ? colors.brand.maroon : colors.bg.card, borderColor: active ? colors.brand.maroon : colors.border.medium }}>
                <div className="w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: active ? colors.brand.gold : colors.border.medium, backgroundColor: active ? colors.brand.gold : "transparent" }}>{active && <Check size={12} style={{ color: colors.brand.maroon }} />}</div>
                <div><p className="text-[15px] font-bold" style={{ color: active ? colors.text.inverse : colors.text.primary }}>{r.label}</p><p className="text-xs mt-0.5" style={{ color: active ? "rgba(253,251,247,0.75)" : colors.text.muted }}>{r.hint}</p></div>
              </button>
            ); })}</div>
          </Field>
          <button data-testid="staff-submit" disabled={saving} onClick={submit} className="w-full flex items-center justify-center gap-2 h-12 rounded-xl text-[15px] font-bold tracking-[0.4px] transition-opacity focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.brand.maroon, color: colors.text.inverse, opacity: saving ? 0.6 : 1 }}>
            {saving ? <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <><UserPlus size={18} />Add to Household</>}
          </button>
        </div>
      </Card>
    </Page>
  );
}

function Field({ label, children }) {
  return <div><p className="text-[12px] font-bold uppercase tracking-wide mb-2" style={{ color: colors.text.muted }}>{label}</p>{children}</div>;
}
