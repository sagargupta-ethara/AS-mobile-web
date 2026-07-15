import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Library, Users, ClipboardList } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { api } from "@/apiClient";
import { colors } from "@/theme/colors";
import { RatingStars } from "@/components/Pills";

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
    <div className="p-5 pb-24">
      <div className="flex justify-between items-center mb-4">
        <div><p className="text-[10.5px] tracking-[3px] font-bold mb-1.5" style={{ color: colors.brand.gold }}>ESTATE INITIATIVES</p><h1 className="text-[30px] font-bold tracking-tight" style={{ color: colors.brand.maroon }} data-testid="projects-title">Projects</h1></div>
        {isAdmin && <button data-testid="projects-new-button" onClick={() => navigate("/projects/new")} className="w-11 h-11 rounded-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.brand.maroon }}><Plus size={20} style={{ color: colors.text.inverse }} /></button>}
      </div>
      {loading ? (
        <div className="flex justify-center py-10"><span className="animate-spin w-8 h-8 border-3 rounded-full" style={{ borderColor: colors.brand.maroon, borderTopColor: "transparent" }} /></div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-2" data-testid="projects-empty">
          <Library size={44} style={{ color: colors.brand.gold }} />
          <p className="text-lg font-bold mt-2" style={{ color: colors.brand.maroon }}>{isAdmin ? "No projects yet" : "No projects assigned"}</p>
          <p className="text-[13px] text-center px-8" style={{ color: colors.text.secondary }}>{isAdmin ? "Start your first initiative." : "You'll see projects here once assigned to one."}</p>
          {isAdmin && <button data-testid="empty-new-project" onClick={() => navigate("/projects/new")} className="mt-4 px-6 py-3 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.brand.maroon, color: colors.text.inverse }}>Start Project</button>}
        </div>
      ) : projects.map((p) => {
        const meta = STATUS_META[p.status] || STATUS_META.active;
        const pct = p.task_count > 0 ? Math.round((p.completed_task_count / p.task_count) * 100) : 0;
        return (
          <button key={p.id} data-testid={`project-card-${p.id}`} onClick={() => navigate(`/projects/${p.id}`)} className="w-full text-left rounded-2xl border mb-3.5 overflow-hidden transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ borderColor: colors.border.subtle, backgroundColor: colors.bg.primary }}>
            <div className="p-4">
              <div className="flex gap-3 items-start mb-3">
                <div className="flex-1"><h3 className="text-[17px] font-bold tracking-tight mb-1" style={{ color: colors.text.primary }}>{p.name}</h3>{p.description && <p className="text-[12.5px] leading-[18px] line-clamp-2" style={{ color: colors.text.secondary }}>{p.description}</p>}</div>
                <span className="shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-bold tracking-[0.4px]" style={{ borderColor: meta.color, backgroundColor: `${meta.color}18`, color: meta.color }}><span className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: meta.color }} />{meta.label}</span>
              </div>
              <div className="flex items-center flex-wrap gap-3 mb-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: colors.text.secondary }}><Users size={13} style={{ color: colors.brand.gold }} />{p.managers.length} mgr · {p.taskers.length} tsk</span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: colors.text.secondary }}><ClipboardList size={13} style={{ color: colors.brand.gold }} />{p.completed_task_count}/{p.task_count} done</span>
                {p.final_rating != null && <RatingStars value={p.final_rating} size={12} showValue />}
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: colors.bg.tertiary }}><div className="h-full rounded-full" style={{ backgroundColor: colors.brand.gold, width: `${pct}%` }} /></div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
