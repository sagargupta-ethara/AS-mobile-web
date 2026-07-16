import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Home, Library, ClipboardList, Users, Archive, User, Sparkles, Inbox, LogOut, Crown } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { colors } from "@/theme/colors";
import { Avatar } from "@/components/ui-kit";

// Grouped desktop navigation. Every item keeps its original route + testId.
const NAV_SECTIONS = [
  {
    label: "Overview",
    items: [{ to: "/", icon: Home, label: "Estate", testId: "nav-dashboard" }],
  },
  {
    label: "Operations",
    items: [
      { to: "/projects", icon: Library, label: "Projects", testId: "nav-projects" },
      { to: "/tasks", icon: ClipboardList, label: "Tasks", testId: "nav-tasks" },
      { to: "/reviews", icon: Inbox, label: "Reviews", testId: "nav-reviews", managerOnly: true },
    ],
  },
  {
    label: "Household",
    items: [
      { to: "/staff", icon: Users, label: "Team", testId: "nav-team", managerOnly: true },
      { to: "/history", icon: Archive, label: "History", testId: "nav-history" },
    ],
  },
];

// Flat list drives the mobile bottom bar (kept compact, unchanged behavior).
const MOBILE_NAV = [
  { to: "/", icon: Home, label: "Estate", testId: "nav-dashboard" },
  { to: "/projects", icon: Library, label: "Projects", testId: "nav-projects" },
  { to: "/tasks", icon: ClipboardList, label: "Tasks", testId: "nav-tasks" },
  { to: "/staff", icon: Users, label: "Team", testId: "nav-team", managerOnly: true },
  { to: "/reviews", icon: Inbox, label: "Reviews", testId: "nav-reviews", managerOnly: true },
  { to: "/history", icon: Archive, label: "History", testId: "nav-history" },
  { to: "/profile", icon: User, label: "Profile", testId: "nav-profile" },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isManager = user?.role === "admin" || user?.role === "manager";

  return (
    <div className="flex h-screen" style={{ backgroundColor: colors.bg.canvas }}>
      {/* ---------------- Desktop sidebar ---------------- */}
      <aside
        className="hidden md:flex flex-col w-[250px] shrink-0 border-r"
        style={{ borderColor: colors.border.subtle, backgroundColor: colors.bg.sidebar }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 h-[76px] border-b" style={{ borderColor: colors.border.subtle }}>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `linear-gradient(135deg, ${colors.brand.maroon}, ${colors.brand.maroonDeep})` }}
          >
            <Crown size={18} style={{ color: colors.brand.gold }} />
          </div>
          <div className="leading-tight">
            <h1 className="font-display text-[18px] font-bold" style={{ color: colors.brand.maroon }}>
              Scindia
            </h1>
            <p className="text-[8.5px] tracking-[2.5px] font-bold uppercase" style={{ color: colors.brand.gold }}>
              Household · Est. 1731
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto scrollbar-hide px-3 py-4 flex flex-col gap-5">
          {NAV_SECTIONS.map((section) => {
            const items = section.items.filter((i) => !i.managerOnly || isManager);
            if (items.length === 0) return null;
            return (
              <div key={section.label}>
                <p
                  className="px-3 mb-1.5 text-[9.5px] tracking-[1.8px] font-bold uppercase"
                  style={{ color: colors.text.muted }}
                >
                  {section.label}
                </p>
                <div className="flex flex-col gap-0.5">
                  {items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/"}
                      data-testid={item.testId}
                      className="group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                      style={({ isActive }) => ({
                        backgroundColor: isActive ? colors.brand.maroon : "transparent",
                        color: isActive ? colors.text.inverse : colors.text.secondary,
                      })}
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span
                              className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full"
                              style={{ backgroundColor: colors.brand.gold }}
                            />
                          )}
                          <item.icon
                            size={18}
                            style={{ color: isActive ? colors.brand.gold : colors.text.muted }}
                          />
                          {item.label}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Concierge CTA */}
        <div className="px-3 pb-3">
          <button
            data-testid="nav-concierge"
            onClick={() => navigate("/concierge")}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-bold transition-all hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            style={{
              background: `linear-gradient(135deg, ${colors.brand.maroon}, ${colors.brand.maroonDeep})`,
              color: colors.text.inverse,
              border: `1px solid ${colors.brand.gold}`,
            }}
          >
            <Sparkles size={15} style={{ color: colors.brand.gold }} />
            AI Concierge
          </button>
        </div>

        {/* User footer */}
        <div className="border-t px-3 py-3 flex items-center gap-2.5" style={{ borderColor: colors.border.subtle }}>
          <button
            data-testid="nav-profile"
            onClick={() => navigate("/profile")}
            className="flex items-center gap-2.5 flex-1 min-w-0 rounded-xl p-1.5 -m-1.5 transition-colors hover:bg-[rgba(212,175,55,0.10)] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
          >
            <Avatar name={user?.name || "?"} role={user?.role} size={38} />
            <div className="min-w-0 text-left">
              <p className="text-[13px] font-bold truncate" style={{ color: colors.text.primary }}>
                {user?.name}
              </p>
              <p className="text-[10px] tracking-[1px] font-bold uppercase" style={{ color: colors.brand.gold }}>
                {user?.role}
              </p>
            </div>
          </button>
          <button
            data-testid="nav-logout"
            onClick={logout}
            aria-label="Sign out"
            title="Sign out"
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors hover:bg-[rgba(123,24,30,0.08)] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            style={{ color: colors.brand.maroon }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      {/* ---------------- Main column ---------------- */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar (unchanged) */}
        <div
          className="md:hidden flex items-center justify-between px-4 py-2.5 border-b"
          style={{ borderColor: colors.border.subtle, backgroundColor: colors.bg.card }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${colors.brand.maroon}, ${colors.brand.maroonDeep})` }}
            >
              <Crown size={14} style={{ color: colors.brand.gold }} />
            </div>
            <span className="font-display text-[16px] font-bold" style={{ color: colors.brand.maroon }}>
              Scindia
            </span>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto scroll-elegant">
          <Outlet />
        </main>

        {/* Mobile bottom nav (unchanged) */}
        <nav
          className="md:hidden flex border-t"
          style={{ borderColor: colors.border.subtle, backgroundColor: colors.bg.card }}
        >
          {MOBILE_NAV.filter((item) => !item.managerOnly || isManager).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              data-testid={`${item.testId}-mobile`}
              className="flex-1 flex flex-col items-center py-2 text-[10px] font-bold uppercase tracking-[0.3px] transition-colors"
              style={({ isActive }) => ({
                color: isActive ? colors.brand.maroon : colors.text.muted,
              })}
            >
              <item.icon size={20} />
              <span className="mt-0.5">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
