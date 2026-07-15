import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, UserPlus, Check } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { api } from "@/apiClient";
import { colors } from "@/theme/colors";

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
    <div className="relative min-h-screen" style={{ backgroundColor: colors.bg.primary }}>
      <div className="flex items-center gap-2 px-4 pt-3 pb-3 border-b" style={{ borderColor: colors.border.subtle }}>
        <button data-testid="new-staff-back" onClick={() => navigate(-1)} className="w-10 h-10 rounded-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"><ChevronLeft size={22} style={{ color: colors.brand.maroon }} /></button>
        <div className="flex-1"><p className="text-[10px] tracking-[2.5px] font-bold" style={{ color: colors.brand.gold }}>ADD TO HOUSEHOLD</p><p className="text-[22px] font-bold tracking-tight mt-0.5" style={{ color: colors.brand.maroon }}>New Member</p></div>
      </div>
      <div className="p-5 pb-32 max-w-2xl">
        {error && <div className="mb-4 p-3 rounded-xl text-sm font-semibold" style={{ backgroundColor: "rgba(123,24,30,0.08)", color: colors.brand.maroon }}>{error}</div>}
        <Field label="Full Name"><input data-testid="staff-name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ramesh Kumar" className="w-full rounded-xl border px-3.5 py-3.5 text-[15px] outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle, color: colors.text.primary }} /></Field>
        <Field label="Email"><input data-testid="staff-email-input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="e.g. ramesh@household" className="w-full rounded-xl border px-3.5 py-3.5 text-[15px] outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle, color: colors.text.primary }} /></Field>
        <Field label="Phone (optional)"><input data-testid="staff-phone-input" value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="+91 …" className="w-full rounded-xl border px-3.5 py-3.5 text-[15px] outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle, color: colors.text.primary }} /></Field>
        <Field label="Temporary Password"><input data-testid="staff-password-input" value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" placeholder="Share with them privately" className="w-full rounded-xl border px-3.5 py-3.5 text-[15px] outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle, color: colors.text.primary }} /></Field>
        <Field label="Role">
          <div className="flex flex-col gap-2.5">{ROLES.map((r) => { const active = role === r.key; return (
            <button key={r.key} data-testid={`role-${r.key}`} onClick={() => setRole(r.key)} className="flex items-center gap-3 p-4 rounded-[14px] border transition-colors text-left focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: active ? colors.brand.maroon : colors.bg.secondary, borderColor: active ? colors.brand.maroon : colors.border.subtle }}>
              <div className="w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center" style={{ borderColor: active ? colors.brand.gold : colors.border.medium, backgroundColor: active ? colors.brand.gold : "transparent" }}>{active && <Check size={12} style={{ color: colors.brand.maroon }} />}</div>
              <div><p className="text-[15px] font-bold" style={{ color: active ? colors.text.inverse : colors.text.primary }}>{r.label}</p><p className="text-xs mt-0.5" style={{ color: active ? "rgba(253,251,247,0.75)" : colors.text.muted }}>{r.hint}</p></div>
            </button>
          ); })}</div>
        </Field>
      </div>
      <div className="fixed bottom-0 left-0 right-0 md:left-[220px] px-5 pt-3 pb-5 border-t z-40" style={{ backgroundColor: colors.bg.primary, borderColor: colors.border.subtle }}>
        <button data-testid="staff-submit" disabled={saving} onClick={submit} className="w-full max-w-2xl mx-auto flex items-center justify-center gap-2 py-4 rounded-xl text-[15px] font-bold tracking-[0.4px] transition-opacity focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.brand.maroon, color: colors.text.inverse, opacity: saving ? 0.6 : 1 }}>
          {saving ? <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <><UserPlus size={18} />Add to Household</>}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <div className="mb-4"><p className="text-[11px] tracking-[2px] font-bold uppercase mb-2" style={{ color: colors.text.secondary }}>{label}</p>{children}</div>;
}
