import React from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Phone, Shield, Building2, Sparkles, LogOut, Award, User } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { colors } from "@/theme/colors";
import { Page, PageHeader, Card, SectionCard, Avatar } from "@/components/ui-kit";

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
    <Page width="narrow" testId="profile-page">
      <PageHeader overline="My Account" title="Profile" icon={<User size={20} />} />

      <Card className="flex flex-col items-center text-center p-8 mb-5">
        <Avatar name={user?.name || ""} role={user?.role} size={84} className="mb-4" />
        <h2 className="font-display text-xl font-bold" style={{ color: colors.brand.maroon }} data-testid="profile-name">
          {user?.name}
        </h2>
        <p className="text-[13px] mt-1" style={{ color: colors.text.muted }}>{user?.email}</p>
        <span
          className="inline-flex items-center gap-1.5 mt-3.5 px-3.5 py-1.5 rounded-full border text-[11.5px] tracking-[1.4px] font-bold"
          style={{ borderColor: colors.border.medium, backgroundColor: "rgba(212,175,55,0.15)", color: colors.brand.goldDeep }}
        >
          <Award size={12} />
          {roleLabel}
        </span>
      </Card>

      <SectionCard title="Account" className="mb-5">
        <div className="flex flex-col gap-2">
          <Row icon={<Mail size={16} />} label="Email" value={user?.email || ""} testId="profile-email-row" />
          {user?.phone && <Row icon={<Phone size={16} />} label="Phone" value={user.phone} testId="profile-phone-row" />}
          <Row icon={<Shield size={16} />} label="Role" value={roleLabel} testId="profile-role-row" />
        </div>
      </SectionCard>

      <SectionCard title="About" className="mb-6">
        <div className="flex flex-col gap-2">
          <Row icon={<Building2 size={16} />} label="Household" value="Scindia Royal Estate" />
          <Row icon={<Sparkles size={16} />} label="Version" value="1.0.0 · Est. 1731" />
        </div>
      </SectionCard>

      <Card className="p-4">
        <button
          data-testid="profile-logout"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border-[1.5px] text-sm font-bold transition-colors hover:bg-[rgba(123,24,30,0.05)] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
          style={{ borderColor: colors.brand.maroon, color: colors.brand.maroon }}
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </Card>

      <p className="text-center mt-8 text-[11px] tracking-[1.4px] uppercase font-semibold" style={{ color: colors.text.muted }}>
        Serving the household with discretion &amp; precision.
      </p>
    </Page>
  );
}

function Row({ icon, label, value, testId }) {
  return (
    <div data-testid={testId} className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: colors.bg.cardMuted }}>
      <span
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: "rgba(123,24,30,0.06)", color: colors.brand.maroon }}
      >
        {icon}
      </span>
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
