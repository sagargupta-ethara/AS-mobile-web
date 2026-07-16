import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Library, Users, ClipboardList } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { api } from "@/apiClient";
import { colors } from "@/theme/colors";
import { RatingStars } from "@/components/Pills";
import { Page, PageHeader, Card, Button, Spinner, EmptyState } from "@/components/ui-kit";

const STATUS_META = {
  active: { label: "Active", color: "#000080" },
  closure_proposed: { label: "Closure Proposed", color: "#D4770A" },
  closed: { label: "Closed", color: "#097969" },
};

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { try { setProjects(await api.get("/projects")); } catch { /* silent */ } }, []);
  useEffect(() => { load().then(() => setLoading(false)); }, [load]);

  const isAdmin = user?.role === "admin";

  return (
    <Page testId="projects-page">
      <PageHeader
        overline="Estate Initiatives"
        title="Projects"
        testId="projects-title"
        subtitle={loading ? undefined : `${projects.length} ${projects.length === 1 ? "initiative" : "initiatives"}`}
        icon={<Library size={20} />}
        actions={
          isAdmin && (
            <Button testId="projects-new-button" icon={<Plus size={17} />} onClick={() => navigate("/projects/new")}>
              New Project
            </Button>
          )
        }
      />

      {loading ? (
        <Spinner />
      ) : projects.length === 0 ? (
        <EmptyState
          testId="projects-empty"
          icon={<Library size={30} />}
          title={isAdmin ? "No projects yet" : "No projects assigned"}
          message={isAdmin ? "Start your first estate initiative." : "You'll see projects here once you're assigned to one."}
          action={
            isAdmin && (
              <Button testId="empty-new-project" icon={<Plus size={17} />} onClick={() => navigate("/projects/new")}>
                Start Project
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => {
            const meta = STATUS_META[p.status] || STATUS_META.active;
            const pct = p.task_count > 0 ? Math.round((p.completed_task_count / p.task_count) * 100) : 0;
            return (
              <Card
                key={p.id}
                testId={`project-card-${p.id}`}
                onClick={() => navigate(`/projects/${p.id}`)}
                className="p-5 flex flex-col h-full"
              >
                <div className="flex gap-3 items-start mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-[18px] font-bold tracking-tight mb-1 truncate" style={{ color: colors.text.primary }}>{p.name}</h3>
                    {p.description && <p className="text-[12.5px] leading-[18px] line-clamp-2" style={{ color: colors.text.secondary }}>{p.description}</p>}
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-bold tracking-[0.4px]" style={{ borderColor: meta.color, backgroundColor: `${meta.color}18`, color: meta.color }}>
                    <span className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: meta.color }} />{meta.label}
                  </span>
                </div>
                <div className="flex items-center flex-wrap gap-x-4 gap-y-2 mb-4 mt-auto">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: colors.text.secondary }}>
                    <Users size={13} style={{ color: colors.brand.gold }} />{p.managers.length} mgr · {p.taskers.length} tsk
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: colors.text.secondary }}>
                    <ClipboardList size={13} style={{ color: colors.brand.gold }} />{p.completed_task_count}/{p.task_count} done
                  </span>
                  {p.final_rating != null && <RatingStars value={p.final_rating} size={12} showValue />}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10.5px] tracking-[1px] font-bold uppercase" style={{ color: colors.text.muted }}>Progress</span>
                    <span className="text-[11px] font-bold" style={{ color: colors.brand.goldDeep }}>{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: colors.bg.tertiary }}>
                    <div className="h-full rounded-full transition-all" style={{ backgroundColor: colors.brand.gold, width: `${pct}%` }} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Page>
  );
}
