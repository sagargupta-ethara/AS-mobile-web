import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Hourglass, RefreshCw, AlertTriangle, Plus, UserPlus, Archive, Clock,
  Sparkles, Coffee, ClipboardList, Library, Users, CheckCircle2, ArrowRight, ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { useAuth } from "@/auth/AuthContext";
import { api } from "@/apiClient";
import { colors } from "@/theme/colors";
import TaskCard from "@/components/TaskCard";
import { Page, Card, StatTile, SectionCard, Spinner, Button, Avatar } from "@/components/ui-kit";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const STATUS_META = {
  pending: { label: "Pending", color: colors.brand.goldDeep },
  in_progress: { label: "In Progress", color: colors.brand.navy },
  in_review: { label: "In Review", color: colors.brand.gold },
  completed: { label: "Completed", color: colors.brand.emerald },
};

const PRIORITY_META = {
  low: { label: "Low", color: colors.priority.low },
  medium: { label: "Medium", color: colors.priority.medium },
  high: { label: "High", color: colors.priority.high },
  urgent: { label: "Urgent", color: colors.priority.urgent },
};

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
      setTasks(t);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    load().then(() => setLoading(false));
  }, [load]);

  const isManager = user?.role === "admin" || user?.role === "manager";
  const recent = useMemo(() => tasks.slice(0, 6), [tasks]);

  const statusData = useMemo(() => {
    const counts = { pending: 0, in_progress: 0, in_review: 0, completed: 0 };
    tasks.forEach((t) => {
      if (counts[t.overall_status] != null) counts[t.overall_status] += 1;
    });
    return Object.entries(STATUS_META)
      .map(([key, meta]) => ({ name: meta.label, value: counts[key], color: meta.color }))
      .filter((d) => d.value > 0);
  }, [tasks]);

  const priorityData = useMemo(() => {
    const counts = { low: 0, medium: 0, high: 0, urgent: 0 };
    tasks.forEach((t) => {
      if (counts[t.priority] != null) counts[t.priority] += 1;
    });
    return Object.entries(PRIORITY_META).map(([key, meta]) => ({
      name: meta.label,
      count: counts[key],
      color: meta.color,
    }));
  }, [tasks]);

  const kpis = isManager
    ? [
        { label: "Pending", value: stats?.active_tasks ?? 0, icon: <Hourglass size={17} />, accent: colors.brand.goldDeep, testId: "stat-pending" },
        { label: "In Review", value: stats?.in_review ?? 0, icon: <RefreshCw size={17} />, accent: colors.brand.navy, testId: "stat-in-progress" },
        { label: "Overdue", value: stats?.overdue ?? 0, icon: <AlertTriangle size={17} />, accent: colors.brand.maroon, testId: "stat-overdue" },
        { label: "Completed", value: stats?.completed_tasks ?? 0, icon: <CheckCircle2 size={17} />, accent: colors.brand.emerald, testId: "summary-completed" },
        { label: "Total Tasks", value: stats?.total_tasks ?? 0, icon: <ClipboardList size={17} />, accent: colors.brand.maroon, testId: "summary-total-tasks" },
        { label: "Active Projects", value: stats?.active_projects ?? 0, icon: <Library size={17} />, accent: colors.brand.gold, testId: "summary-projects" },
        { label: "Taskers", value: stats?.total_taskers ?? 0, icon: <Users size={17} />, accent: colors.brand.navy, testId: "summary-taskers" },
        { label: "Managers", value: stats?.total_managers ?? 0, icon: <Users size={17} />, accent: colors.brand.emerald, testId: "summary-managers" },
      ]
    : [
        { label: "Pending", value: stats?.active_tasks ?? 0, icon: <Hourglass size={17} />, accent: colors.brand.goldDeep, testId: "stat-pending" },
        { label: "In Review", value: stats?.in_review ?? 0, icon: <RefreshCw size={17} />, accent: colors.brand.navy, testId: "stat-in-progress" },
        { label: "Completed", value: stats?.completed_tasks ?? 0, icon: <CheckCircle2 size={17} />, accent: colors.brand.emerald, testId: "summary-completed" },
        { label: "Overdue", value: stats?.overdue ?? 0, icon: <AlertTriangle size={17} />, accent: colors.brand.maroon, testId: "stat-overdue" },
      ];

  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <Page testId="dashboard-page">
      {/* Header banner */}
      <Card
        className="relative overflow-hidden mb-7 px-6 py-6 md:px-8 md:py-7"
        style={{ background: `linear-gradient(120deg, ${colors.brand.maroonDeep}, ${colors.brand.maroon} 70%)`, borderColor: colors.brand.maroon }}
      >
        <div
          className="absolute -right-16 -top-16 w-64 h-64 rounded-full opacity-[0.08]"
          style={{ background: `radial-gradient(circle, ${colors.brand.gold}, transparent 70%)` }}
        />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[10.5px] tracking-[3px] font-bold uppercase mb-2" style={{ color: colors.brand.gold }} data-testid="dashboard-overline">
              {getGreeting()} · {today}
            </p>
            <h1 className="font-display text-[28px] md:text-[36px] font-bold leading-none" style={{ color: colors.text.inverse }} data-testid="dashboard-user-name">
              {user?.name}
            </h1>
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide mt-3"
              style={{ backgroundColor: "rgba(212,175,55,0.16)", color: colors.brand.gold, border: `1px solid ${colors.border.medium}` }}
            >
              <Sparkles size={11} />
              {user?.role}
            </span>
          </div>
          {isManager && (
            <div className="flex items-center gap-2.5">
              <button
                data-testid="quick-new-task"
                onClick={() => navigate("/tasks/new")}
                className="inline-flex items-center gap-2 h-11 px-4 rounded-xl text-[13.5px] font-bold transition-all hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                style={{ backgroundColor: colors.bg.card, color: colors.brand.maroon }}
              >
                <Plus size={17} /> New Task
              </button>
              <button
                data-testid="quick-add-staff"
                onClick={() => navigate("/staff/new")}
                className="inline-flex items-center gap-2 h-11 px-4 rounded-xl text-[13.5px] font-bold transition-all hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                style={{ backgroundColor: "rgba(253,251,247,0.12)", color: colors.text.inverse, border: `1px solid ${colors.border.medium}` }}
              >
                <UserPlus size={17} /> Add Member
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 md:gap-4 mb-7">
        {kpis.map((k) => (
          <StatTile key={k.testId} {...k} />
        ))}
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5 mb-7">
        <SectionCard title="Task Status" className="lg:col-span-1" testId="chart-status">
          {statusData.length === 0 ? (
            <ChartEmpty label="No tasks yet" />
          ) : (
            <div className="relative">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={56} outerRadius={82} paddingAngle={2} stroke="none">
                    {statusData.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="font-display text-[28px] font-bold leading-none" style={{ color: colors.brand.maroon }}>
                  {tasks.length}
                </span>
                <span className="text-[10px] tracking-[1px] font-bold uppercase" style={{ color: colors.text.muted }}>
                  Tasks
                </span>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4">
            {statusData.map((d) => (
              <span key={d.name} className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold" style={{ color: colors.text.secondary }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                {d.name} · {d.value}
              </span>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Tasks by Priority" className="lg:col-span-2" testId="chart-priority">
          <ResponsiveContainer width="100%" height={244}>
            <BarChart data={priorityData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(123,24,30,0.08)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: colors.text.muted, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: colors.text.muted }} axisLine={false} tickLine={false} width={38} />
              <Tooltip cursor={{ fill: "rgba(212,175,55,0.08)" }} contentStyle={tooltipStyle} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={64}>
                {priorityData.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* Main split: recent tasks + side rail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="font-display text-[18px] font-bold" style={{ color: colors.brand.maroon }}>
              Recent Tasks
            </h2>
            <button
              data-testid="see-all-tasks"
              onClick={() => navigate("/tasks")}
              className="inline-flex items-center gap-1 text-[12.5px] font-bold focus:outline-none"
              style={{ color: colors.brand.goldDeep }}
            >
              View all <ArrowRight size={14} />
            </button>
          </div>
          {loading ? (
            <Spinner className="py-14" />
          ) : recent.length === 0 ? (
            <Card className="flex flex-col items-center py-14 gap-2">
              <Coffee size={40} style={{ color: colors.brand.gold }} />
              <p className="font-display text-lg font-bold" style={{ color: colors.brand.maroon }}>
                All clear
              </p>
              <p className="text-[13px]" style={{ color: colors.text.secondary }}>
                No tasks to show right now.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {recent.map((t) => (
                <TaskCard key={t.id} task={t} showAssignees={isManager} />
              ))}
            </div>
          )}
        </div>

        {/* Side rail */}
        <div className="flex flex-col gap-4 md:gap-5">
          {user?.role === "admin" && stats?.top_taskers?.length > 0 && (
            <SectionCard title="Top Performers" testId="top-performers">
              <div className="flex flex-col gap-1">
                {stats.top_taskers.slice(0, 5).map((t, idx) => (
                  <button
                    key={t.id}
                    data-testid={`top-tasker-${t.id}`}
                    onClick={() => navigate(`/team/${t.id}`)}
                    className="flex items-center gap-3 py-2 px-1.5 -mx-1.5 rounded-xl text-left transition-colors hover:bg-[rgba(212,175,55,0.08)] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                  >
                    <span className="w-5 font-display text-[15px] font-bold text-center" style={{ color: colors.brand.gold }}>
                      {idx + 1}
                    </span>
                    <Avatar name={t.name} role={t.role} size={34} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold truncate" style={{ color: colors.text.primary }}>
                        {t.name}
                      </p>
                      <p className="text-[11px]" style={{ color: colors.text.muted }}>
                        {t.completed} completed
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[13px] font-bold" style={{ color: colors.text.primary }}>
                      <span style={{ color: colors.brand.gold }}>★</span>
                      {t.avg_rating.toFixed(1)}
                    </span>
                  </button>
                ))}
              </div>
            </SectionCard>
          )}

          <SectionCard title="Quick Access" bodyClassName="p-3">
            <QuickLink
              testId="open-review-queue"
              icon={<Hourglass size={18} />}
              tint="rgba(212,119,10,0.14)"
              iconColor={colors.priority.high}
              label="Review Queue"
              hint="Submissions awaiting your review"
              onClick={() => navigate("/reviews")}
            />
            <QuickLink
              testId="open-history"
              icon={<Archive size={18} />}
              tint="rgba(0,0,128,0.12)"
              iconColor={colors.brand.navy}
              label="History"
              hint="Completed tasks & projects"
              onClick={() => navigate("/history")}
            />
            <QuickLink
              testId="open-concierge"
              icon={<Sparkles size={18} />}
              tint="rgba(123,24,30,0.10)"
              iconColor={colors.brand.maroon}
              label="AI Concierge"
              hint="Ask about the estate"
              onClick={() => navigate("/concierge")}
            />
          </SectionCard>
        </div>
      </div>

      {/* Mobile-only concierge FAB (kept for small screens) */}
      <button
        data-testid="concierge-fab"
        onClick={() => navigate("/concierge")}
        className="fixed bottom-20 right-5 md:hidden flex items-center gap-1.5 px-4 py-3 rounded-full shadow-lg transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] z-50"
        style={{ background: `linear-gradient(135deg, ${colors.brand.maroon}, ${colors.brand.maroonDeep})`, border: `1px solid ${colors.brand.gold}` }}
      >
        <Sparkles size={16} style={{ color: colors.brand.gold }} />
        <span className="text-[13px] font-bold" style={{ color: colors.text.inverse }}>Concierge</span>
      </button>
    </Page>
  );
}

const tooltipStyle = {
  borderRadius: 12,
  border: `1px solid ${colors.border.subtle}`,
  fontSize: 12,
  fontWeight: 600,
  boxShadow: "0 6px 16px -6px rgba(123,24,30,0.2)",
};

function ChartEmpty({ label }) {
  return (
    <div className="flex items-center justify-center h-[200px] text-[13px] font-semibold" style={{ color: colors.text.muted }}>
      {label}
    </div>
  );
}

function QuickLink({ icon, tint, iconColor, label, hint, onClick, testId }) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors hover:bg-[rgba(212,175,55,0.08)] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
    >
      <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: tint, color: iconColor }}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-bold" style={{ color: colors.text.primary }}>
          {label}
        </p>
        <p className="text-[11.5px] truncate" style={{ color: colors.text.muted }}>
          {hint}
        </p>
      </div>
      <ChevronRight size={16} style={{ color: colors.text.muted }} />
    </button>
  );
}
