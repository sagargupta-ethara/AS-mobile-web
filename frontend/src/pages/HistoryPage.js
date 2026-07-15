import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Archive, CheckCheck, Library, ChevronRight, Calendar, Users, FolderOpen } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { api } from "@/apiClient";
import { colors } from "@/theme/colors";
import { RatingStars } from "@/components/Pills";

export default function HistoryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState("tasks");
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [t, p] = await Promise.all([api.get("/tasks"), api.get("/projects")]);
      setTasks(t);
      setProjects(p);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { load().then(() => setLoading(false)); }, [load]);

  const completedTasks = useMemo(() =>
    tasks
      .filter((t) => t.overall_status === "completed")
      .sort((a, b) => {
        const at = a.assignments.find((x) => x.approved_at)?.approved_at || a.updated_at;
        const bt = b.assignments.find((x) => x.approved_at)?.approved_at || b.updated_at;
        return new Date(bt).getTime() - new Date(at).getTime();
      }),
    [tasks]
  );

  const closedProjects = useMemo(() =>
    projects
      .filter((p) => p.status === "closed")
      .sort((a, b) => new Date(b.closed_at || b.created_at).getTime() - new Date(a.closed_at || a.created_at).getTime()),
    [projects]
  );

  const isManager = user?.role === "admin" || user?.role === "manager";

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg.primary }}>
      <div
        className="relative px-4 pt-5 pb-4 rounded-b-[22px] overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${colors.brand.maroonDeep}, ${colors.brand.maroon})` }}
      >
        <div className="flex items-center gap-2.5 mb-3">
          <button
            data-testid="history-back"
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            style={{ backgroundColor: "rgba(253,251,247,0.12)" }}
          >
            <ChevronLeft size={22} style={{ color: colors.text.inverse }} />
          </button>
          <div className="flex-1">
            <p className="text-[10px] tracking-[2.2px] font-bold" style={{ color: colors.brand.gold }}>ROYAL ARCHIVES</p>
            <h1 className="text-[22px] font-bold tracking-tight mt-0.5" style={{ color: colors.text.inverse }}>History</h1>
          </div>
          <div
            className="w-10 h-10 rounded-full border flex items-center justify-center"
            style={{ borderColor: colors.brand.gold, backgroundColor: "rgba(212,175,55,0.15)" }}
          >
            <Archive size={17} style={{ color: colors.brand.gold }} />
          </div>
        </div>

        <div
          className="flex gap-1 p-1 rounded-full border"
          style={{ backgroundColor: "rgba(0,0,0,0.25)", borderColor: "rgba(212,175,55,0.35)" }}
        >
          <ToggleBtn label="Tasks" count={completedTasks.length} active={mode === "tasks"} onClick={() => setMode("tasks")} testId="history-toggle-tasks" />
          <ToggleBtn label="Projects" count={closedProjects.length} active={mode === "projects"} onClick={() => setMode("projects")} testId="history-toggle-projects" />
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <span className="animate-spin w-8 h-8 border-3 rounded-full" style={{ borderColor: colors.brand.maroon, borderTopColor: "transparent" }} />
          </div>
        ) : mode === "tasks" ? (
          completedTasks.length === 0 ? (
            <EmptyState icon={<CheckCheck size={30} style={{ color: colors.brand.gold }} />} title="No completed tasks yet" sub={isManager ? "Approved tasks will appear here once your team completes them." : "Once your submissions are approved, they show up here."} />
          ) : (
            completedTasks.map((t) => <TaskHistoryRow key={t.id} task={t} onClick={() => navigate(`/tasks/${t.id}`)} />)
          )
        ) : (
          closedProjects.length === 0 ? (
            <EmptyState icon={<Library size={30} style={{ color: colors.brand.gold }} />} title="No closed projects yet" sub="Closed projects with final ratings will be archived here." />
          ) : (
            closedProjects.map((p) => <ProjectHistoryRow key={p.id} project={p} onClick={() => navigate(`/projects/${p.id}`)} />)
          )
        )}
      </div>
    </div>
  );
}

function ToggleBtn({ label, count, active, onClick, testId }) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full text-xs font-bold tracking-[1px] uppercase transition-colors focus:outline-none"
      style={{ backgroundColor: active ? colors.text.inverse : "transparent", color: active ? colors.brand.maroon : "rgba(253,251,247,0.75)" }}
    >
      {label}
      <span
        className="inline-flex items-center justify-center min-w-[22px] h-[18px] px-1.5 rounded-full text-[10px] font-extrabold"
        style={{ backgroundColor: active ? colors.brand.gold : "rgba(212,175,55,0.28)", color: active ? colors.brand.maroonDeep : colors.brand.gold }}
      >
        {count}
      </span>
    </button>
  );
}

function TaskHistoryRow({ task, onClick }) {
  const avgRating = useMemo(() => {
    const rated = task.assignments.map((a) => a.final_rating).filter((r) => typeof r === "number");
    if (!rated.length) return null;
    return rated.reduce((s, r) => s + r, 0) / rated.length;
  }, [task]);
  const approvedAt = task.assignments.find((a) => a.approved_at)?.approved_at || task.updated_at;

  return (
    <button
      data-testid={`history-task-${task.id}`}
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3.5 rounded-[14px] border mb-2.5 text-left transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
      style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }}
    >
      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(9,121,105,0.15)" }}>
        <CheckCheck size={18} style={{ color: colors.brand.emerald }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14.5px] font-bold truncate" style={{ color: colors.text.primary }}>{task.title}</p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {task.project_name && (
            <>
              <FolderOpen size={11} style={{ color: colors.text.muted }} />
              <span className="text-[11.5px] font-semibold truncate max-w-[120px]" style={{ color: colors.text.muted }}>{task.project_name}</span>
              <span className="text-[11px] mx-0.5" style={{ color: colors.text.muted }}>·</span>
            </>
          )}
          <Users size={11} style={{ color: colors.text.muted }} />
          <span className="text-[11.5px] font-semibold" style={{ color: colors.text.muted }}>
            {task.assignments.length} {task.assignments.length === 1 ? "assignee" : "assignees"}
          </span>
          <span className="text-[11px] mx-0.5" style={{ color: colors.text.muted }}>·</span>
          <span className="text-[11.5px] font-semibold" style={{ color: colors.text.muted }}>
            {new Date(approvedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </div>
      </div>
      {avgRating != null ? (
        <RatingStars value={avgRating} size={12} showValue />
      ) : (
        <ChevronRight size={16} style={{ color: colors.text.muted }} />
      )}
    </button>
  );
}

function ProjectHistoryRow({ project, onClick }) {
  return (
    <button
      data-testid={`history-project-${project.id}`}
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3.5 rounded-[14px] border mb-2.5 text-left transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
      style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }}
    >
      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(212,175,55,0.15)" }}>
        <Library size={18} style={{ color: colors.brand.gold }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14.5px] font-bold truncate" style={{ color: colors.text.primary }}>{project.name}</p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <CheckCheck size={11} style={{ color: colors.brand.emerald }} />
          <span className="text-[11.5px] font-semibold" style={{ color: colors.text.muted }}>
            {project.completed_task_count}/{project.task_count} tasks
          </span>
          <span className="text-[11px] mx-0.5" style={{ color: colors.text.muted }}>·</span>
          <Calendar size={11} style={{ color: colors.text.muted }} />
          <span className="text-[11.5px] font-semibold" style={{ color: colors.text.muted }}>
            Closed {project.closed_at ? new Date(project.closed_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—"}
          </span>
        </div>
      </div>
      {project.final_rating != null ? (
        <RatingStars value={project.final_rating} size={12} showValue />
      ) : (
        <ChevronRight size={16} style={{ color: colors.text.muted }} />
      )}
    </button>
  );
}

function EmptyState({ icon, title, sub }) {
  return (
    <div className="flex flex-col items-center py-10 mt-10 gap-2">
      <div className="w-[68px] h-[68px] rounded-full flex items-center justify-center mb-1.5" style={{ backgroundColor: "rgba(212,175,55,0.15)" }}>
        {icon}
      </div>
      <p className="text-base font-bold" style={{ color: colors.text.primary }}>{title}</p>
      <p className="text-[13px] text-center leading-[19px] px-5" style={{ color: colors.text.muted }}>{sub}</p>
    </div>
  );
}
