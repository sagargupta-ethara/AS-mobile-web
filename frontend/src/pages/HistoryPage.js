import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Archive, CheckCheck, Library, ChevronRight, Calendar, Users, FolderOpen } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { api } from "@/apiClient";
import { colors } from "@/theme/colors";
import { RatingStars } from "@/components/Pills";
import { Page, PageHeader, Card, Spinner, EmptyState, FilterChips, IconButton } from "@/components/ui-kit";

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

  const modeOptions = [
    { key: "tasks", label: `Tasks (${completedTasks.length})` },
    { key: "projects", label: `Projects (${closedProjects.length})` },
  ];

  return (
    <Page testId="history-page">
      <PageHeader
        overline="Estate Archive"
        title="History"
        testId="history-title"
        icon={<Archive size={20} />}
        subtitle={
          loading
            ? undefined
            : mode === "tasks"
            ? `${completedTasks.length} completed ${completedTasks.length === 1 ? "task" : "tasks"}`
            : `${closedProjects.length} closed ${closedProjects.length === 1 ? "project" : "projects"}`
        }
        actions={
          <IconButton
            testId="history-back"
            icon={<ChevronLeft size={18} />}
            label="Back"
            variant="outline"
            size={38}
            onClick={() => navigate(-1)}
          />
        }
      />

      <div className="mb-5">
        <FilterChips items={modeOptions} value={mode} onChange={setMode} testIdPrefix="history-toggle" />
      </div>

      {loading ? (
        <Spinner />
      ) : mode === "tasks" ? (
        completedTasks.length === 0 ? (
          <EmptyState
            testId="history-tasks-empty"
            icon={<CheckCheck size={30} />}
            title="No completed tasks yet"
            message={isManager ? "Approved tasks will appear here once your team completes them." : "Once your submissions are approved, they show up here."}
          />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {completedTasks.map((t) => <TaskHistoryRow key={t.id} task={t} onClick={() => navigate(`/tasks/${t.id}`)} />)}
          </div>
        )
      ) : closedProjects.length === 0 ? (
        <EmptyState
          testId="history-projects-empty"
          icon={<Library size={30} />}
          title="No closed projects yet"
          message="Closed projects with final ratings will be archived here."
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {closedProjects.map((p) => <ProjectHistoryRow key={p.id} project={p} onClick={() => navigate(`/projects/${p.id}`)} />)}
        </div>
      )}
    </Page>
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
    <Card testId={`history-task-${task.id}`} onClick={onClick} className="p-4 flex items-center gap-3.5">
      <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(9,121,105,0.12)" }}>
        <CheckCheck size={18} style={{ color: colors.brand.emerald }} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[14.5px] font-bold truncate" style={{ color: colors.text.primary }}>{task.title}</p>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {task.project_name && <Chip icon={<FolderOpen size={11} />} label={task.project_name} />}
          <Chip icon={<Users size={11} />} label={`${task.assignments.length} ${task.assignments.length === 1 ? "assignee" : "assignees"}`} />
          <Chip
            icon={<Calendar size={11} />}
            label={new Date(approvedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
          />
        </div>
      </div>
      {avgRating != null ? (
        <RatingStars value={avgRating} size={12} showValue />
      ) : (
        <ChevronRight size={16} style={{ color: colors.text.muted }} className="shrink-0" />
      )}
    </Card>
  );
}

function ProjectHistoryRow({ project, onClick }) {
  return (
    <Card testId={`history-project-${project.id}`} onClick={onClick} className="p-4 flex items-center gap-3.5">
      <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(212,175,55,0.15)" }}>
        <Library size={18} style={{ color: colors.brand.gold }} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[14.5px] font-bold truncate" style={{ color: colors.text.primary }}>{project.name}</p>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <Chip icon={<CheckCheck size={11} />} label={`${project.completed_task_count}/${project.task_count} tasks`} />
          <Chip
            icon={<Calendar size={11} />}
            label={`Closed ${project.closed_at ? new Date(project.closed_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—"}`}
          />
        </div>
      </div>
      {project.final_rating != null ? (
        <RatingStars value={project.final_rating} size={12} showValue />
      ) : (
        <ChevronRight size={16} style={{ color: colors.text.muted }} className="shrink-0" />
      )}
    </Card>
  );
}

function Chip({ icon, label }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold border max-w-[160px]"
      style={{ backgroundColor: colors.bg.cardMuted, borderColor: colors.border.subtle, color: colors.text.secondary }}
    >
      <span style={{ color: colors.brand.gold }}>{icon}</span>
      <span className="truncate">{label}</span>
    </span>
  );
}
