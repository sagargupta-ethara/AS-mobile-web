import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Hourglass, RefreshCw, AlertTriangle, Plus, UserPlus, Archive, Clock, Sparkles, Coffee, Home } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { api } from "@/apiClient";
import { colors } from "@/theme/colors";
import TaskCard from "@/components/TaskCard";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "GOOD MORNING";
  if (h < 17) return "GOOD AFTERNOON";
  return "GOOD EVENING";
}

function initials(name) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase() || "").join("");
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, t] = await Promise.all([api.get("/stats/dashboard"), api.get("/tasks")]);
      setStats(s);
      setTasks(t.slice(0, 6));
    } catch { /* silent */ }
  }, []);

  useEffect(() => { load().then(() => setLoading(false)); }, [load]);

  const isManager = user?.role === "admin" || user?.role === "manager";

  return (
    <div className="pb-24">
      {/* Hero */}
      <div className="relative px-5 pt-8 pb-5 rounded-b-3xl overflow-hidden" style={{ background: `linear-gradient(135deg, ${colors.brand.maroonDeep}, ${colors.brand.maroon})` }}>
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-[10.5px] tracking-[3px] font-bold mb-2" style={{ color: colors.brand.gold }} data-testid="dashboard-overline">{getGreeting()}</p>
              <h1 className="text-[26px] font-semibold tracking-tight mb-2" style={{ color: colors.text.inverse }} data-testid="dashboard-user-name">{user?.name}</h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] tracking-[1.5px] font-bold" style={{ borderColor: colors.border.medium, backgroundColor: "rgba(212,175,55,0.15)", color: colors.brand.gold }}>
                <Sparkles size={11} />
                {(user?.role || "").toUpperCase()}
              </span>
            </div>
            <div className="w-11 h-11 rounded-full border flex items-center justify-center" style={{ borderColor: colors.brand.gold }}>
              <Home size={20} style={{ color: colors.brand.gold }} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <StatCard label="Pending" value={stats?.active_tasks ?? 0} icon={<Hourglass size={16} />} testId="stat-pending" />
            <StatCard label="In Review" value={stats?.in_review ?? 0} icon={<RefreshCw size={16} />} testId="stat-in-progress" />
            <StatCard label="Overdue" value={stats?.overdue ?? 0} icon={<AlertTriangle size={16} />} highlight testId="stat-overdue" />
          </div>
        </div>
      </div>

      <div className="px-5 pt-5">
        {isManager && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
              <SummaryTile label="Total Tasks" value={stats?.total_tasks ?? 0} accent={colors.brand.navy} testId="summary-total-tasks" />
              <SummaryTile label="Completed" value={stats?.completed_tasks ?? 0} accent={colors.brand.emerald} testId="summary-completed" />
              <SummaryTile label="Active Projects" value={stats?.active_projects ?? 0} accent={colors.brand.gold} testId="summary-projects" />
              <SummaryTile label="Taskers" value={stats?.total_taskers ?? 0} accent={colors.brand.maroon} testId="summary-taskers" />
            </div>

            {user?.role === "admin" && stats && stats.top_taskers?.length > 0 && (
              <div className="rounded-[14px] p-3.5 border mb-5" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }}>
                <p className="text-[10.5px] tracking-[2.5px] font-bold mb-3" style={{ color: colors.text.secondary }}>TOP PERFORMERS</p>
                {stats.top_taskers.slice(0, 3).map((t, idx) => (
                  <button
                    key={t.id}
                    data-testid={`top-tasker-${t.id}`}
                    onClick={() => navigate(`/team/${t.id}`)}
                    className="w-full flex items-center gap-2.5 py-2 text-left hover:bg-[rgba(212,175,55,0.08)] rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  >
                    <span className="text-sm font-extrabold w-6" style={{ color: colors.brand.gold }}>#{idx + 1}</span>
                    <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: colors.brand.maroon, color: colors.text.inverse }}>
                      {initials(t.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-bold truncate" style={{ color: colors.text.primary }}>{t.name}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: colors.text.muted }}>{t.completed} completed</p>
                    </div>
                    <span className="flex items-center gap-1">
                      <span className="text-sm" style={{ color: colors.brand.gold }}>★</span>
                      <span className="text-[13px] font-bold" style={{ color: colors.text.primary }}>{t.avg_rating.toFixed(1)}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2.5 mb-5">
              <button data-testid="quick-new-task" onClick={() => navigate("/tasks/new")} className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.brand.maroon, color: colors.text.inverse }}>
                <Plus size={18} /> New Task
              </button>
              <button data-testid="quick-add-staff" onClick={() => navigate("/staff/new")} className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl border text-sm font-bold transition-colors hover:bg-[rgba(212,175,55,0.08)] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ borderColor: colors.brand.gold, color: colors.brand.maroon }}>
                <UserPlus size={18} /> Add Member
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mb-5">
              <button data-testid="open-review-queue" onClick={() => navigate("/reviews")} className="text-left p-3.5 rounded-[14px] border transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: "rgba(212,119,10,0.15)" }}>
                  <Hourglass size={18} style={{ color: "#D4770A" }} />
                </div>
                <p className="text-sm font-bold" style={{ color: colors.brand.maroon }}>Review Queue</p>
                <p className="text-[11.5px] font-semibold" style={{ color: colors.text.secondary }}>{stats?.in_review ?? 0} awaiting</p>
              </button>
              <button data-testid="open-history" onClick={() => navigate("/history")} className="text-left p-3.5 rounded-[14px] border transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: "rgba(30,58,95,0.15)" }}>
                  <Archive size={18} style={{ color: colors.brand.navy }} />
                </div>
                <p className="text-sm font-bold" style={{ color: colors.brand.maroon }}>History</p>
                <p className="text-[11.5px] font-semibold" style={{ color: colors.text.secondary }}>Tasks & Projects</p>
              </button>
            </div>
          </>
        )}

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold" style={{ color: colors.brand.maroon }}>Recent Tasks</h2>
          <button data-testid="see-all-tasks" onClick={() => navigate("/tasks")} className="text-xs font-bold tracking-[0.5px] focus:outline-none hover:underline" style={{ color: colors.brand.gold }}>See all →</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><span className="animate-spin w-8 h-8 border-3 rounded-full" style={{ borderColor: colors.brand.maroon, borderTopColor: "transparent" }} /></div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center py-10 gap-2">
            <Coffee size={40} style={{ color: colors.brand.gold }} />
            <p className="text-[17px] font-bold mt-2" style={{ color: colors.brand.maroon }}>All caught up</p>
            <p className="text-[13px] text-center" style={{ color: colors.text.secondary }}>
              {isManager ? "Create your first task to get started." : "No tasks assigned to you yet."}
            </p>
          </div>
        ) : (
          tasks.map((t) => <TaskCard key={t.id} task={t} showAssignees={isManager} />)
        )}
      </div>

      <button
        data-testid="concierge-fab"
        onClick={() => navigate("/concierge")}
        className="fixed bottom-5 right-5 md:hidden flex items-center gap-1.5 px-4 py-3 rounded-full shadow-lg transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] z-50"
        style={{ background: `linear-gradient(135deg, ${colors.brand.maroon}, ${colors.brand.maroonDeep})`, border: `1px solid ${colors.brand.gold}` }}
      >
        <Sparkles size={16} style={{ color: colors.brand.gold }} />
        <span className="text-[13px] font-bold tracking-[0.5px]" style={{ color: colors.text.inverse }}>Concierge</span>
      </button>
    </div>
  );
}

function StatCard({ label, value, icon, highlight, testId }) {
  return (
    <div
      data-testid={testId}
      className="rounded-[14px] border p-3 flex flex-col gap-1"
      style={{
        backgroundColor: highlight ? "rgba(212,175,55,0.12)" : "rgba(253,251,247,0.08)",
        borderColor: highlight ? colors.brand.gold : "rgba(212,175,55,0.35)",
      }}
    >
      <span style={{ color: highlight ? colors.brand.gold : "rgba(253,251,247,0.85)" }}>{icon}</span>
      <span className="text-[22px] font-bold mt-1" style={{ color: colors.text.inverse }}>{value}</span>
      <span className="text-[9.5px] tracking-[0.4px] font-bold uppercase" style={{ color: "rgba(253,251,247,0.75)" }}>{label}</span>
    </div>
  );
}

function SummaryTile({ label, value, accent, testId }) {
  return (
    <div data-testid={testId} className="relative rounded-xl p-3.5 border overflow-hidden" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }}>
      <div className="absolute top-0 left-0 bottom-0 w-[3px]" style={{ backgroundColor: accent }} />
      <p className="text-[26px] font-bold mb-0.5" style={{ color: colors.brand.maroon }}>{value}</p>
      <p className="text-[11px] tracking-[1.2px] font-bold uppercase" style={{ color: colors.text.secondary }}>{label}</p>
    </div>
  );
}
