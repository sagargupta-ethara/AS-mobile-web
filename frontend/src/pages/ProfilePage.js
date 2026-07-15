import React from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Phone, Shield, Building2, Sparkles, LogOut, Award } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { colors } from "@/theme/colors";

function initials(name) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase() || "").join("");
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const roleLabel =
    user?.role === "admin" ? "Administrator" : user?.role === "manager" ? "Household Manager" : "Household Staff";

  return (
    <div className="pb-24 overflow-y-auto">
      <div
        className="flex flex-col items-center px-5 pt-10 pb-8 rounded-b-[28px] overflow-hidden relative"
        style={{ background: `linear-gradient(135deg, ${colors.brand.maroonDeep}, ${colors.brand.maroon})` }}
      >
        <div
          className="w-[92px] h-[92px] rounded-full border-[1.5px] flex items-center justify-center mb-3.5"
          style={{ borderColor: colors.brand.gold, backgroundColor: "rgba(212,175,55,0.15)" }}
        >
          <span className="text-[32px] font-semibold tracking-[1px]" style={{ color: colors.brand.gold }}>
            {initials(user?.name || "")}
          </span>
        </div>
        <h1
          className="text-[22px] font-bold tracking-tight mb-1"
          style={{ color: colors.text.inverse }}
          data-testid="profile-name"
        >
          {user?.name}
        </h1>
        <p className="text-[13px] mb-3" style={{ color: "rgba(253,251,247,0.75)" }}>
          {user?.email}
        </p>
        <span
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-[11.5px] tracking-[1.4px] font-bold"
          style={{ borderColor: colors.border.medium, backgroundColor: "rgba(212,175,55,0.15)", color: colors.brand.gold }}
        >
          <Award size={12} />
          {roleLabel}
        </span>
      </div>

      <div className="p-5">
        <SectionHeader label="Account" />
        <Row icon={<Mail size={16} style={{ color: colors.brand.maroon }} />} label="Email" value={user?.email || ""} testId="profile-email-row" />
        {user?.phone && (
          <Row icon={<Phone size={16} style={{ color: colors.brand.maroon }} />} label="Phone" value={user.phone} testId="profile-phone-row" />
        )}
        <Row icon={<Shield size={16} style={{ color: colors.brand.maroon }} />} label="Role" value={roleLabel} testId="profile-role-row" />

        <SectionHeader label="About" />
        <Row icon={<Building2 size={16} style={{ color: colors.brand.maroon }} />} label="Household" value="Scindia Royal Estate" />
        <Row icon={<Sparkles size={16} style={{ color: colors.brand.maroon }} />} label="Version" value="1.0.0 · Est. 1731" />

        <button
          data-testid="profile-logout"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 mt-7 py-3.5 rounded-xl border-[1.5px] text-sm font-bold transition-colors hover:bg-[rgba(123,24,30,0.05)] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
          style={{ borderColor: colors.brand.maroon, color: colors.brand.maroon }}
        >
          <LogOut size={18} />
          Sign Out
        </button>

        <p
          className="text-center mt-8 text-[11px] tracking-[1.4px] uppercase font-semibold"
          style={{ color: colors.text.muted }}
        >
          Serving the household with discretion &amp; precision.
        </p>
      </div>
    </div>
  );
}

function SectionHeader({ label }) {
  return (
    <p
      className="text-[10.5px] tracking-[2.5px] font-bold uppercase mt-5 mb-2.5"
      style={{ color: colors.text.secondary }}
    >
      {label}
    </p>
  );
}

function Row({ icon, label, value, testId }) {
  return (
    <div
      data-testid={testId}
      className="flex items-center gap-3 p-3.5 rounded-xl border mb-2"
      style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }}
    >
      <div
        className="w-[34px] h-[34px] rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: "rgba(212,175,55,0.15)" }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10.5px] tracking-[1.4px] font-bold uppercase mb-0.5" style={{ color: colors.text.muted }}>
          {label}
        </p>
        <p className="text-sm font-semibold truncate" style={{ color: colors.text.primary }}>
          {value}
        </p>
      </div>
    </div>
  );
}
