import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Award } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { colors, AUTH_BG } from "@/theme/colors";

const QUICK_ACCOUNT_GROUPS = [
  {
    heading: "Admin",
    color: "#7B181E",
    role: "ADMIN",
    accounts: [
      { key: "admin", label: "Maharaja Scindia", hint: "Administrator", email: "admin@scindia.royal", password: "password123" },
    ],
  },
  {
    heading: "Managers",
    color: "#000080",
    role: "MANAGER",
    accounts: [
      { key: "her-highness",   label: "Her Highness",   hint: "Manager", email: "her-highness@scindia.royal",   password: "password123" },
      { key: "mayank",         label: "Mayank",         hint: "Manager", email: "mayank@scindia.royal",         password: "password123" },
      { key: "yuvraj-maharaj", label: "Yuvraj Maharaj", hint: "Manager", email: "yuvraj-maharaj@scindia.royal", password: "password123" },
    ],
  },
  {
    heading: "Floor Managers",
    color: "#097969",
    role: "FLOOR",
    accounts: [
      { key: "tanya",    label: "Tanya",    hint: "Floor Manager", email: "tanya@scindia.royal",    password: "password123" },
      { key: "desh",     label: "Desh",     hint: "Floor Manager", email: "desh@scindia.royal",     password: "password123" },
      { key: "priyanka", label: "Priyanka", hint: "Floor Manager", email: "priyanka@scindia.royal", password: "password123" },
      { key: "satish",   label: "Satish",   hint: "Floor Manager", email: "satish@scindia.royal",   password: "password123" },
      { key: "brajhari", label: "Brajhari", hint: "Floor Manager", email: "brajhari@scindia.royal", password: "password123" },
      { key: "rajinder", label: "Rajinder", hint: "Floor Manager", email: "rajinder@scindia.royal", password: "password123" },
      { key: "bhushan",  label: "Bhushan",  hint: "Floor Manager", email: "bhushan@scindia.royal",  password: "password123" },
    ],
  },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const doLogin = async (em, pw, label) => {
    if (!em.trim() || !pw.trim()) { setError("Please enter email and password"); return; }
    setLoading(true);
    setError("");
    try {
      const u = await login(em, pw);
      navigate("/", { replace: true });
    } catch (e) {
      setError(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e) => { e.preventDefault(); doLogin(email, password); };

  return (
    <div className="min-h-screen flex items-center justify-center p-5 relative" style={{ backgroundColor: colors.bg.dark }}>
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${AUTH_BG})`, opacity: 0.3 }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(26,18,16,0.55), rgba(92,16,21,0.92), #1A1210)" }} />

      <div className="relative z-10 w-full max-w-[460px]">
        <div className="text-center mb-8">
          <div className="w-[78px] h-[78px] rounded-full border-[1.5px] mx-auto mb-4 flex items-center justify-center" style={{ borderColor: colors.brand.gold }}>
            <div className="w-[60px] h-[60px] rounded-full border flex items-center justify-center" style={{ borderColor: "rgba(212,175,55,0.55)" }}>
              <Award size={28} style={{ color: colors.brand.gold }} />
            </div>
          </div>
          <p className="text-[11px] tracking-[5px] font-bold mb-1.5" style={{ color: colors.brand.gold }} data-testid="login-overline">E S T. 1731</p>
          <h1 className="text-[44px] font-light tracking-[1px] mb-1" style={{ color: colors.text.inverse }} data-testid="login-brand-title">Scindia</h1>
          <p className="text-[13px] tracking-[1.4px] font-medium uppercase" style={{ color: "rgba(253,251,247,0.75)" }} data-testid="login-brand-subtitle">Household &amp; Estate Management</p>
        </div>

        <div className="rounded-[20px] border p-6" style={{ backgroundColor: colors.bg.primary, borderColor: colors.border.medium, boxShadow: "0 12px 24px rgba(0,0,0,0.35)" }}>
          <h2 className="text-2xl font-semibold mb-1" style={{ color: colors.brand.maroon }}>Welcome back</h2>
          <p className="text-[13px] mb-5" style={{ color: colors.text.secondary }}>Sign in to continue managing your estate.</p>

          {error && <div className="mb-4 p-3 rounded-xl text-sm font-semibold" style={{ backgroundColor: "rgba(123,24,30,0.08)", color: colors.brand.maroon }} data-testid="login-error">{error}</div>}

          <form onSubmit={onSubmit}>
            <div className="mb-3.5">
              <label htmlFor="login-email" className="block text-[11px] tracking-[2px] font-bold uppercase mb-2" style={{ color: colors.text.secondary }}>Email</label>
              <div className="flex items-center rounded-xl border px-3.5 min-h-[52px]" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }}>
                <Mail size={18} style={{ color: colors.text.muted }} className="mr-2.5 shrink-0" />
                <input
                  id="login-email"
                  data-testid="login-email-input"
                  type="email"
                  autoComplete="email"
                  placeholder="name@scindia.royal"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-[15px] py-3.5"
                  style={{ color: colors.text.primary }}
                />
              </div>
            </div>
            <div className="mb-3.5">
              <label htmlFor="login-password" className="block text-[11px] tracking-[2px] font-bold uppercase mb-2" style={{ color: colors.text.secondary }}>Password</label>
              <div className="flex items-center rounded-xl border px-3.5 min-h-[52px] relative" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }}>
                <Lock size={18} style={{ color: colors.text.muted }} className="mr-2.5 shrink-0" />
                <input
                  id="login-password"
                  data-testid="login-password-input"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-[15px] py-3.5 pr-10"
                  style={{ color: colors.text.primary }}
                />
                <button
                  type="button"
                  data-testid="login-toggle-password"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-1 top-1 bottom-1 w-10 flex items-center justify-center rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                >
                  {showPassword ? <EyeOff size={18} style={{ color: colors.brand.maroon }} /> : <Eye size={18} style={{ color: colors.brand.maroon }} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              data-testid="login-submit-button"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 rounded-xl py-4 mt-2 text-[15px] font-bold tracking-[0.5px] transition-opacity focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              style={{ backgroundColor: colors.brand.maroon, color: colors.text.inverse, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <><span>Enter Estate</span><ArrowRight size={18} /></>}
            </button>
          </form>

          <div className="flex items-center gap-2.5 mt-5 mb-3">
            <div className="flex-1 h-px" style={{ backgroundColor: colors.border.subtle }} />
            <span className="text-[10.5px] tracking-[1.2px] uppercase font-semibold" style={{ color: colors.text.muted }}>Quick access · Demo accounts</span>
            <div className="flex-1 h-px" style={{ backgroundColor: colors.border.subtle }} />
          </div>

          {QUICK_ACCOUNT_GROUPS.map((group) => (
            <div key={group.heading} className="mb-3" data-testid={`quick-group-${group.heading.toLowerCase().replace(/\s+/g,'-')}`}>
              <p className="text-[10px] tracking-[1.5px] uppercase font-bold mb-1.5" style={{ color: group.color }}>{group.heading}</p>
              {group.accounts.map((q) => (
                <button
                  key={q.key}
                  data-testid={`quick-login-${q.key}`}
                  onClick={() => doLogin(q.email, q.password, q.label)}
                  disabled={loading}
                  className="w-full flex items-center gap-3 rounded-xl border py-2 px-3 mb-1.5 transition-colors hover:bg-[rgba(212,175,55,0.12)] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                  style={{ borderColor: colors.brand.gold, backgroundColor: "rgba(212,175,55,0.08)" }}
                >
                  <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: group.color }}>
                    <Award size={12} style={{ color: colors.brand.gold }} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-[13px] font-bold" style={{ color: colors.brand.maroon }}>{q.label}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: colors.text.muted }}>{q.hint}</p>
                  </div>
                  <span className="rounded-full border px-2 py-0.5 text-[9px] font-extrabold tracking-[1px]" style={{ borderColor: group.color, color: group.color }}>{group.role}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        <p className="text-center mt-6 text-[11px] tracking-[1.4px] uppercase" style={{ color: "rgba(253,251,247,0.55)" }}>
          Serving the Scindia household with discretion &amp; precision.
        </p>
      </div>
    </div>
  );
}
