import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Library, Users } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { api } from "@/apiClient";
import { colors } from "@/theme/colors";
import { RatingStars } from "@/components/Pills";

const STATUS_META = {
  active: { label: "Active", color: "#000080" },
  closure_proposed: { label: "Closure Proposed", color: "#D4770A" },
  closed: { label: "Closed", color: "#097969" },
};

function projectProgress(project) {
  if (!project.task_count) return 0;
  return Math.round((project.completed_task_count / project.task_count) * 100);
}

function teamSummary(project) {
  const managerCount = project.managers?.length || 0;
  const taskerCount = project.taskers?.length || 0;
  return `${managerCount} mgr · ${taskerCount} ${taskerCount === 1 ? "tasker" : "taskers"}`;
}

function ProjectRow({ project }) {
  const meta = STATUS_META[project.status] || STATUS_META.active;
  const progress = projectProgress(project);

  return (
    <Link
      to={`/projects/${project.id}`}
      data-testid={`project-card-${project.id}`}
      className="group grid w-full gap-3 border-b px-4 py-3.5 text-left no-underline transition-colors last:border-b-0 hover:bg-[#FAF6ED] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#D4AF37] lg:grid-cols-[minmax(0,2fr)_minmax(112px,1fr)_minmax(130px,1fr)_minmax(112px,1fr)_minmax(84px,0.7fr)] lg:items-center"
      style={{ borderColor: colors.border.subtle }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
          <h3 className="truncate text-[14px] font-bold" style={{ color: colors.text.primary }}>
            {project.name}
          </h3>
        </div>
        {project.description ? (
          <p className="mt-1 line-clamp-1 text-[12px]" style={{ color: colors.text.secondary }}>
            {project.description}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 lg:block">
        <span className="text-[10px] font-bold uppercase tracking-[1.2px] lg:hidden" style={{ color: colors.text.muted }}>
          Status
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-bold tracking-[0.4px]"
          style={{ borderColor: meta.color, backgroundColor: `${meta.color}18`, color: meta.color }}
        >
          <span className="h-[5px] w-[5px] rounded-full" style={{ backgroundColor: meta.color }} />
          {meta.label}
        </span>
      </div>

      <div className="min-w-0">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[1.2px]" style={{ color: colors.text.muted }}>
            Progress
          </span>
          <span className="text-[11px] font-bold" style={{ color: colors.text.primary }}>
            {progress}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: colors.bg.tertiary }}>
          <div className="h-full rounded-full" style={{ backgroundColor: colors.brand.gold, width: `${progress}%` }} />
        </div>
        <p className="mt-1 text-[11px] font-semibold" style={{ color: colors.text.muted }}>
          {project.completed_task_count}/{project.task_count} tasks
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 lg:block">
        <span className="text-[10px] font-bold uppercase tracking-[1.2px] lg:hidden" style={{ color: colors.text.muted }}>
          Team
        </span>
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: colors.text.secondary }}>
          <Users size={13} style={{ color: colors.brand.gold }} />
          {teamSummary(project)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 lg:block">
        <span className="text-[10px] font-bold uppercase tracking-[1.2px] lg:hidden" style={{ color: colors.text.muted }}>
          Rating
        </span>
        {project.final_rating != null ? (
          <RatingStars value={project.final_rating} size={12} showValue />
        ) : (
          <span className="text-[12px] font-semibold" style={{ color: colors.text.muted }}>
            --
          </span>
        )}
      </div>
    </Link>
  );
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setProjects(await api.get("/projects"));
    } catch {
    }
  }, []);

  useEffect(() => {
    load().then(() => setLoading(false));
  }, [load]);

  const isAdmin = user?.role === "admin";

  return (
    <div className="p-5 pb-24">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1.5 text-[10.5px] font-bold tracking-[3px]" style={{ color: colors.brand.gold }}>
            ESTATE INITIATIVES
          </p>
          <h1 className="text-[30px] font-bold tracking-tight" style={{ color: colors.brand.maroon }} data-testid="projects-title">
            Projects
          </h1>
        </div>
        {isAdmin ? (
          <button
            data-testid="projects-new-button"
            type="button"
            onClick={() => navigate("/projects/new")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            style={{ backgroundColor: colors.brand.maroon }}
            aria-label="Create project"
            title="Create project"
          >
            <Plus size={20} style={{ color: colors.text.inverse }} />
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <span className="h-8 w-8 animate-spin rounded-full border-[3px]" style={{ borderColor: colors.brand.maroon, borderTopColor: "transparent" }} />
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16" data-testid="projects-empty">
          <Library size={44} style={{ color: colors.brand.gold }} />
          <p className="mt-2 text-lg font-bold" style={{ color: colors.brand.maroon }}>
            {isAdmin ? "No projects yet" : "No projects assigned"}
          </p>
          <p className="px-8 text-center text-[13px]" style={{ color: colors.text.secondary }}>
            {isAdmin ? "Start your first initiative." : "You'll see projects here once assigned to one."}
          </p>
          {isAdmin ? (
            <button
              data-testid="empty-new-project"
              type="button"
              onClick={() => navigate("/projects/new")}
              className="mt-4 rounded-xl px-6 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              style={{ backgroundColor: colors.brand.maroon, color: colors.text.inverse }}
            >
              Start Project
            </button>
          ) : null}
        </div>
      ) : (
        <section
          aria-label="Projects list"
          className="overflow-hidden rounded-2xl border shadow-sm"
          style={{ backgroundColor: colors.bg.card, borderColor: colors.border.subtle }}
          data-testid="projects-list-view"
        >
          <div
            className="hidden border-b px-4 py-2.5 text-[10px] font-bold uppercase tracking-[1.4px] lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(112px,1fr)_minmax(130px,1fr)_minmax(112px,1fr)_minmax(84px,0.7fr)]"
            style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle, color: colors.text.muted }}
          >
            <span>Project</span>
            <span>Status</span>
            <span>Progress</span>
            <span>Team</span>
            <span>Rating</span>
          </div>
          {projects.map((project) => (
            <ProjectRow key={project.id} project={project} />
          ))}
        </section>
      )}
    </div>
  );
}
