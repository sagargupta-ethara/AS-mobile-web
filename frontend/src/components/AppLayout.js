import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Home, Library, ClipboardList, Users, Archive, User, Sparkles } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { colors } from "@/theme/colors";

const NAV_ITEMS = [
  { to: "/", icon: Home, label: "Estate", testId: "nav-dashboard" },
  { to: "/projects", icon: Library, label: "Projects", testId: "nav-projects" },
  { to: "/tasks", icon: ClipboardList, label: "Tasks", testId: "nav-tasks" },
  { to: "/staff", icon: Users, label: "Team", testId: "nav-team", managerOnly: true },
  { to: "/history", icon: Archive, label: "History", testId: "nav-history" },
  { to: "/profile", icon: User, label: "Profile", testId: "nav-profile" },
];

export default function AppLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isManager = user?.role === "admin" || user?.role === "manager";

  return (
    <div className="flex h-screen" style={{ backgroundColor: colors.bg.primary }}>
      <aside className="hidden md:flex flex-col w-[220px] border-r py-6 px-3 shrink-0" style={{ borderColor: colors.border.subtle, backgroundColor: colors.bg.secondary }}>
        <div className="flex items-center gap-2.5 px-3 mb-8">
          <div className="w-9 h-9 rounded-full border flex items-center justify-center" style={{ borderColor: colors.brand.gold }}>
            <Home size={16} style={{ color: colors.brand.gold }} />
          </div>
          <div>
            <h1 className="text-[15px] font-bold tracking-[0.5px]" style={{ color: colors.brand.maroon }}>Scindia</h1>
            <p className="text-[9px] tracking-[2px] font-bold uppercase" style={{ color: colors.brand.gold }}>EST. 1731</p>
          </div>
        </div>
        <nav className="flex-1 flex flex-col gap-1">
          {NAV_ITEMS.filter((item) => !item.managerOnly || isManager).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              data-testid={item.testId}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37] ${
                  isActive
                    ? "text-white"
                    : "hover:bg-[#EBE3D5]"
                }`
              }
              style={({ isActive }) => ({
                backgroundColor: isActive ? colors.brand.maroon : undefined,
                color: isActive ? colors.text.inverse : colors.text.secondary,
              })}
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          data-testid="nav-concierge"
          onClick={() => navigate("/concierge")}
          className="flex items-center justify-center gap-2 mt-4 py-3 rounded-xl text-[13px] font-bold transition-all hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
          style={{ backgroundColor: colors.brand.maroon, color: colors.text.inverse, border: `1px solid ${colors.brand.gold}` }}
        >
          <Sparkles size={16} style={{ color: colors.brand.gold }} />
          Concierge
        </button>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: colors.border.subtle, backgroundColor: colors.bg.secondary }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full border flex items-center justify-center" style={{ borderColor: colors.brand.gold }}>
              <Home size={12} style={{ color: colors.brand.gold }} />
            </div>
            <span className="text-sm font-bold" style={{ color: colors.brand.maroon }}>Scindia</span>
          </div>
        </div>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
        <nav className="md:hidden flex border-t" style={{ borderColor: colors.border.subtle, backgroundColor: colors.bg.primary }}>
          {NAV_ITEMS.filter((item) => !item.managerOnly || isManager).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              data-testid={`${item.testId}-mobile`}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center py-2 text-[10px] font-bold uppercase tracking-[0.3px] transition-colors ${
                  isActive ? "" : ""
                }`
              }
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
