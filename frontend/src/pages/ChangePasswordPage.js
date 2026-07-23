import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, ShieldCheck, LogOut } from "lucide-react";
import { api } from "@/apiClient";
import { useAuth } from "@/auth/AuthContext";
import { colors, AUTH_BG } from "@/theme/colors";

export default function ChangePasswordPage() {
  const { user, logout, refresh } = useAuth();
  const navigate = useNavigate();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!currentPw) { setError("Enter your current password."); return; }
    if (newPw.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (newPw !== confirmPw) { setError("Passwords do not match."); return; }
    setSaving(true);
    try {
      await api.post("/auth/change-password", {
        current_password: currentPw,
        new_password: newPw,
      });
      await refresh();
      navigate("/", { replace: true });
    } catch (err) {
      setError(err?.message || "Could not update password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5 relative" style={{ backgroundColor: colors.bg.dark }} data-testid="change-password-page">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${AUTH_BG})`, opacity: 0.25 }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(26,18,16,0.55), rgba(92,16,21,0.92), #1A1210)" }} />
      <div className="relative z-10 w-full max-w-[460px]">
        <div className="rounded-[20px] border p-7" style={{ backgroundColor: colors.bg.primary, borderColor: colors.border.medium, boxShadow: "0 12px 24px rgba(0,0,0,0.35)" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ backgroundColor: colors.brand.maroon }}>
              <ShieldCheck size={22} style={{ color: colors.brand.gold }} />
            </div>
            <div>
              <h1 className="text-[20px] font-semibold" style={{ color: colors.brand.maroon }}>Set your password</h1>
              <p className="text-[12px]" style={{ color: colors.text.secondary }}>
                Welcome{user?.name ? `, ${user.name}` : ""}. Please replace the default password before continuing.
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl text-sm font-semibold" data-testid="change-password-error"
                 style={{ backgroundColor: "rgba(123,24,30,0.08)", color: colors.brand.maroon }}>
              {error}
            </div>
          )}

          <form onSubmit={submit}>
            <div className="mb-3">
              <label className="block text-[11px] tracking-[2px] font-bold uppercase mb-1.5" style={{ color: colors.text.secondary }}>Current password</label>
              <div className="flex items-center rounded-xl border px-3.5 min-h-[48px]" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }}>
                <Lock size={16} style={{ color: colors.text.muted }} className="mr-2.5" />
                <input type="password" autoComplete="current-password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)}
                       className="flex-1 bg-transparent outline-none text-[15px] py-3" style={{ color: colors.text.primary }}
                       placeholder="Enter your current password" data-testid="change-password-current" />
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-[11px] tracking-[2px] font-bold uppercase mb-1.5" style={{ color: colors.text.secondary }}>New password</label>
              <div className="flex items-center rounded-xl border px-3.5 min-h-[48px]" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }}>
                <Lock size={16} style={{ color: colors.text.muted }} className="mr-2.5" />
                <input type="password" autoFocus autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
                       className="flex-1 bg-transparent outline-none text-[15px] py-3" style={{ color: colors.text.primary }}
                       placeholder="At least 8 characters" data-testid="change-password-new" />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-[11px] tracking-[2px] font-bold uppercase mb-1.5" style={{ color: colors.text.secondary }}>Confirm new password</label>
              <div className="flex items-center rounded-xl border px-3.5 min-h-[48px]" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }}>
                <Lock size={16} style={{ color: colors.text.muted }} className="mr-2.5" />
                <input type="password" autoComplete="new-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
                       className="flex-1 bg-transparent outline-none text-[15px] py-3" style={{ color: colors.text.primary }}
                       placeholder="Retype to confirm" data-testid="change-password-confirm" />
              </div>
            </div>
            <button type="submit" data-testid="change-password-submit" disabled={saving}
                    className="w-full rounded-xl py-3.5 text-[15px] font-bold tracking-[0.5px] transition-opacity focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                    style={{ backgroundColor: colors.brand.maroon, color: colors.text.inverse, opacity: saving ? 0.7 : 1 }}>
              {saving ? "Updating..." : "Set new password"}
            </button>
          </form>

          <button type="button" onClick={() => { logout(); navigate("/login", { replace: true }); }}
                  data-testid="change-password-logout"
                  className="w-full mt-3 flex items-center justify-center gap-2 rounded-xl border py-2 text-[12px] font-semibold tracking-[1px] uppercase hover:bg-[rgba(212,175,55,0.08)]"
                  style={{ borderColor: colors.border.medium, color: colors.text.secondary }}>
            <LogOut size={14} /> Log out instead
          </button>
        </div>
      </div>
    </div>
  );
}
