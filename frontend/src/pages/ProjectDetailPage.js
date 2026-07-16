import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Plus, Star, Hourglass, Award, Users, CheckCircle, Flag } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { api } from "@/apiClient";
import { colors } from "@/theme/colors";
import { RatingStars } from "@/components/Pills";
import TaskCard from "@/components/TaskCard";
import { Page, Card, SectionCard, Button, IconButton, Spinner, EmptyState, Avatar, StatTile } from "@/components/ui-kit";

const STATUS_META = {
  active: { label: "Active", color: colors.brand.navy },
  closure_proposed: { label: "Closure Proposed", color: "#D4770A" },
  closed: { label: "Closed", color: colors.brand.emerald },
};

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [stats, setStats] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showClose, setShowClose] = useState(false);
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [closing, setClosing] = useState(false);
  const [addRole, setAddRole] = useState(null);
  const [savingMembers, setSavingMembers] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, s, ts, us] = await Promise.all([api.get(`/projects/${id}`), api.get(`/stats/projects/${id}`), api.get(`/tasks?project_id=${id}`), api.get("/users")]);
      setProject(p); setStats(s); setTasks(ts); setAllUsers(us);
    } catch { /* silent */ }
  }, [id]);
  useEffect(() => { load().then(() => setLoading(false)); }, [load]);

  const addMember = async (userId) => {
    if (!project || !addRole) return;
    setSavingMembers(true);
    try {
      const body = {};
      if (addRole === "manager") body.manager_ids = [...project.managers.map((m) => m.id), userId];
      else body.tasker_ids = [...project.taskers.map((t) => t.id), userId];
      await api.put(`/projects/${project.id}/members`, body);
      setAddRole(null); await load();
    } catch { /* silent */ } finally { setSavingMembers(false); }
  };

  const confirmClose = async () => {
    setClosing(true);
    try { await api.post(`/projects/${project.id}/close`, { rating, feedback: feedback.trim() }); setShowClose(false); await load(); } catch { /* silent */ } finally { setClosing(false); }
  };

  const proposeClose = async () => {
    setClosing(true);
    try { await api.post(`/projects/${project.id}/propose-close`, { note: "" }); await load(); } catch { /* silent */ } finally { setClosing(false); }
  };

  if (loading) return <Page testId="project-detail-page"><Spinner /></Page>;
  if (!project) return <Page testId="project-detail-page"><p style={{ color: colors.text.secondary }}>Project not found.</p></Page>;

  const isAdmin = user?.role === "admin";
  const isProjectMgr = user ? project.managers.some((m) => m.id === user.id) : false;
  const canClose = (isAdmin || isProjectMgr) && project.status !== "closed";
  const canPropose = user?.role === "manager" && isProjectMgr && project.status === "active";
  const canCreateTask = (isAdmin || isProjectMgr) && project.status !== "closed";
  const pct = project.task_count > 0 ? Math.round((project.completed_task_count / project.task_count) * 100) : 0;
  const statusMeta = STATUS_META[project.status] || STATUS_META.active;

  return (
    <Page testId="project-detail-page">
      {/* Top row */}
      <div className="flex items-start gap-3 mb-6 md:mb-8">
        <IconButton icon={<ChevronLeft size={20} />} variant="outline" onClick={() => navigate(-1)} label="Back" testId="project-back" />
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] tracking-[3px] font-bold uppercase mb-1" style={{ color: colors.brand.gold }}>Project Dossier</p>
          <div className="flex items-center flex-wrap gap-2.5">
            <h1 className="font-display text-2xl md:text-[28px] font-bold leading-none" style={{ color: colors.brand.maroon }} data-testid="project-name">
              {project.name}
            </h1>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10.5px] font-bold tracking-[0.8px]"
              style={{ borderColor: statusMeta.color, backgroundColor: `${statusMeta.color}18`, color: statusMeta.color }}
            >
              <span className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: statusMeta.color }} />
              {statusMeta.label.toUpperCase()}
            </span>
            {project.final_rating != null && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border" style={{ borderColor: colors.border.medium, backgroundColor: "rgba(212,175,55,0.10)" }}>
                <RatingStars value={project.final_rating} size={12} showValue />
              </span>
            )}
          </div>
          {project.description && (
            <p className="text-[13.5px] leading-5 mt-2 max-w-2xl" style={{ color: colors.text.secondary }}>{project.description}</p>
          )}
        </div>
      </div>

      {/* Overview: progress + stats */}
      <Card className="p-5 mb-5 md:mb-6">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] tracking-[1.5px] font-bold uppercase" style={{ color: colors.text.muted }}>Progress</span>
          <span className="text-sm font-bold" style={{ color: colors.brand.goldDeep }}>{pct}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.bg.tertiary }}>
          <div className="h-full rounded-full transition-all" style={{ backgroundColor: colors.brand.gold, width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-[12px] font-semibold" style={{ color: colors.text.muted }}>{project.completed_task_count} of {project.task_count} tasks completed</p>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <StatTile label="Avg Rating" value={stats.avg_task_rating > 0 ? stats.avg_task_rating.toFixed(1) : "—"} icon={<Star size={16} />} accent={colors.brand.gold} />
            <StatTile label="In Review" value={stats.tasks_by_status.in_review || 0} icon={<Hourglass size={16} />} accent="#D4770A" />
            <StatTile label="Managers" value={project.managers.length} icon={<Users size={16} />} accent={colors.brand.navy} />
            <StatTile label="Taskers" value={project.taskers.length} icon={<Users size={16} />} accent={colors.brand.maroon} />
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        {/* Main column: tasks */}
        <div className="lg:col-span-2 flex flex-col gap-4 md:gap-5">
          <SectionCard
            title="Tasks"
            action={canCreateTask && (
              <Button testId="project-new-task" variant="secondary" icon={<Plus size={16} />} onClick={() => navigate(`/tasks/new?project_id=${project.id}`)}>
                Add Task
              </Button>
            )}
          >
            {tasks.length === 0 ? (
              <EmptyState icon={<CheckCircle size={28} />} title="No tasks yet" message="Tasks created for this project will appear here." />
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {tasks.map((t) => <TaskCard key={t.id} task={t} />)}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Side rail: members, leaderboard, closure */}
        <div className="flex flex-col gap-4 md:gap-5">
          <SectionCard
            title="Managers"
            action={isAdmin && project.status !== "closed" && (
              <Button testId="add-manager-btn" variant="secondary" icon={<Plus size={16} />} onClick={() => setAddRole("manager")}>Add</Button>
            )}
          >
            <div className="flex flex-wrap gap-2">
              {project.managers.length === 0 ? (
                <p className="text-[13px]" style={{ color: colors.text.muted }}>No managers assigned</p>
              ) : (
                project.managers.map((m) => <MemberChip key={m.id} member={m} role="manager" onClick={() => navigate(`/team/${m.id}`)} />)
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Taskers"
            action={(isAdmin || isProjectMgr) && project.status !== "closed" && (
              <Button testId="add-tasker-btn" variant="secondary" icon={<Plus size={16} />} onClick={() => setAddRole("tasker")}>Add</Button>
            )}
          >
            <div className="flex flex-wrap gap-2">
              {project.taskers.length === 0 ? (
                <p className="text-[13px]" style={{ color: colors.text.muted }}>No taskers assigned</p>
              ) : (
                project.taskers.map((t) => <MemberChip key={t.id} member={t} role="tasker" onClick={() => navigate(`/team/${t.id}`)} />)
              )}
            </div>
          </SectionCard>

          {stats && stats.tasker_leaderboard?.length > 0 && (
            <SectionCard title="Top Performers">
              <div className="flex flex-col gap-2">
                {stats.tasker_leaderboard.map((row, idx) => (
                  <div
                    key={row.id}
                    data-testid={`leaderboard-${row.id}`}
                    className="flex items-center gap-3 p-2.5 rounded-xl border"
                    style={{ backgroundColor: colors.bg.cardMuted, borderColor: colors.border.subtle }}
                  >
                    <span className="text-sm font-extrabold w-5 text-center" style={{ color: colors.brand.gold }}>#{idx + 1}</span>
                    <Avatar name={row.name} size={32} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-bold truncate" style={{ color: colors.text.primary }}>{row.name}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: colors.text.muted }}>{row.completed} completed</p>
                    </div>
                    <RatingStars value={row.avg_rating} size={12} showValue />
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {(project.status === "closure_proposed" || canClose || canPropose) && (
            <Card className="p-4 flex flex-col gap-3">
              {project.status === "closure_proposed" && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl border" style={{ backgroundColor: "rgba(212,175,55,0.15)", borderColor: colors.brand.gold }}>
                  <Flag size={18} style={{ color: colors.brand.gold }} />
                  <p className="flex-1 text-[12.5px] font-semibold leading-[17px]" style={{ color: colors.brand.maroon }}>Closure has been proposed. Awaiting admin confirmation.</p>
                </div>
              )}
              {canClose && (
                <button
                  data-testid="close-project"
                  onClick={() => setShowClose(true)}
                  className="w-full inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl text-[13.5px] font-bold transition-all hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                  style={{ backgroundColor: colors.brand.emerald, color: colors.text.inverse, border: `1px solid ${colors.brand.emerald}` }}
                >
                  <CheckCircle size={18} />Close Project &amp; Rate
                </button>
              )}
              {canPropose && !canClose && (
                <button
                  data-testid="propose-close-project"
                  onClick={proposeClose}
                  disabled={closing}
                  className="w-full inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl text-[13.5px] font-bold transition-all hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-[#D4AF37] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: colors.bg.card, color: colors.brand.maroon, border: `1px solid ${colors.border.medium}` }}
                >
                  <Flag size={16} />Propose Closure to Admin
                </button>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Close & rate modal */}
      {showClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ backgroundColor: "rgba(26,18,16,0.65)" }}>
          <div className="w-full max-w-[460px] rounded-2xl border p-5" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.medium }} data-testid="close-project-modal">
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-8 h-8 rounded-full border flex items-center justify-center" style={{ borderColor: colors.brand.gold, backgroundColor: "rgba(212,175,55,0.15)" }}><Award size={16} style={{ color: colors.brand.gold }} /></div>
              <h3 className="flex-1 font-display text-[17px] font-bold" style={{ color: colors.brand.maroon }}>Close &amp; Rate Project</h3>
              <button data-testid="close-modal-x" onClick={() => setShowClose(false)} className="text-lg focus:outline-none" style={{ color: colors.text.muted }}>✕</button>
            </div>
            <p className="text-[12.5px] mb-3" style={{ color: colors.text.secondary }}>Final rating for this initiative.</p>
            <div className="flex justify-center gap-1 my-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} data-testid={`project-star-${n}`} onClick={() => setRating(n)} className="text-[32px] mx-1 focus:outline-none transition-transform hover:scale-110" style={{ color: n <= rating ? colors.brand.gold : "rgba(212,175,55,0.35)" }}>★</button>
              ))}
            </div>
            <p className="text-[10.5px] tracking-[2px] font-bold uppercase mt-1.5 mb-1.5" style={{ color: colors.text.secondary }}>Feedback (optional)</p>
            <textarea
              data-testid="project-feedback-input"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Notes on how the project went…"
              className="w-full rounded-xl border p-3 text-sm min-h-[80px] outline-none focus:ring-2 focus:ring-[#D4AF37] resize-none"
              style={{ backgroundColor: colors.bg.cardMuted, borderColor: colors.border.subtle, color: colors.text.primary }}
            />
            <button
              data-testid="confirm-close-project"
              onClick={confirmClose}
              disabled={closing}
              className="w-full flex items-center justify-center gap-2 mt-3.5 h-11 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#D4AF37] disabled:cursor-not-allowed"
              style={{ backgroundColor: colors.brand.maroon, color: colors.text.inverse, opacity: closing ? 0.6 : 1 }}
            >
              {closing ? <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <><CheckCircle size={18} />Close Project</>}
            </button>
          </div>
        </div>
      )}

      {/* Add member modal */}
      {addRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ backgroundColor: "rgba(26,18,16,0.65)" }}>
          <div className="w-full max-w-[460px] rounded-2xl border p-5 max-h-[80vh] overflow-y-auto" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.medium }} data-testid="add-member-modal">
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-8 h-8 rounded-full border flex items-center justify-center" style={{ borderColor: colors.brand.gold, backgroundColor: "rgba(212,175,55,0.15)" }}><Users size={15} style={{ color: colors.brand.gold }} /></div>
              <h3 className="flex-1 font-display text-[17px] font-bold" style={{ color: colors.brand.maroon }}>Add {addRole === "manager" ? "Manager" : "Tasker"}</h3>
              <button data-testid="add-member-close" onClick={() => setAddRole(null)} className="focus:outline-none" style={{ color: colors.text.muted }}>✕</button>
            </div>
            <p className="text-[12.5px] mb-3" style={{ color: colors.text.secondary }}>Pick a household member to add to this project.</p>
            {(() => {
              const existingIds = addRole === "manager" ? project.managers.map((m) => m.id) : project.taskers.map((t) => t.id);
              const eligible = allUsers.filter((u) => u.role === addRole && !existingIds.includes(u.id));
              if (eligible.length === 0) return <p className="text-center py-6 text-xs" style={{ color: colors.text.muted }}>No available {addRole}s.</p>;
              return eligible.map((u) => (
                <button
                  key={u.id}
                  data-testid={`pick-member-${u.id}`}
                  onClick={() => addMember(u.id)}
                  disabled={savingMembers}
                  className="w-full flex items-center gap-3 py-2.5 px-1 border-b text-left transition-colors hover:bg-[rgba(212,175,55,0.05)] focus:outline-none focus:ring-1 focus:ring-[#D4AF37] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ borderColor: colors.border.subtle }}
                >
                  <Avatar name={u.name} role={addRole} size={32} />
                  <div className="flex-1">
                    <p className="text-sm font-bold" style={{ color: colors.text.primary }}>{u.name}</p>
                    <p className="text-[11.5px] mt-0.5" style={{ color: colors.text.muted }}>{u.email}</p>
                  </div>
                  {u.avg_rating > 0 && <RatingStars value={u.avg_rating} size={11} showValue />}
                </button>
              ));
            })()}
          </div>
        </div>
      )}
    </Page>
  );
}

function MemberChip({ member, role, onClick }) {
  return (
    <button
      onClick={onClick}
      data-testid={`member-${member.id}`}
      className="inline-flex items-center gap-2.5 pl-2 pr-3.5 py-1.5 rounded-full border transition-all hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
      style={{ backgroundColor: colors.bg.cardMuted, borderColor: colors.border.subtle }}
    >
      <Avatar name={member.name} role={role} size={30} />
      <div className="text-left">
        <p className="text-[12.5px] font-bold" style={{ color: colors.text.primary }}>{member.name}</p>
        <RatingStars value={member.avg_rating} size={10} />
      </div>
    </button>
  );
}
