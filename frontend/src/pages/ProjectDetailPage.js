import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Plus, Star, Hourglass, Award, Users, CheckCircle, Flag } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { api } from "@/apiClient";
import { colors } from "@/theme/colors";
import { RatingStars } from "@/components/Pills";
import TaskCard from "@/components/TaskCard";

function initials(name) { return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase() || "").join(""); }

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

  if (loading) return <div className="flex justify-center py-20"><span className="animate-spin w-8 h-8 border-3 rounded-full" style={{ borderColor: colors.brand.maroon, borderTopColor: "transparent" }} /></div>;
  if (!project) return <div className="p-5" style={{ color: colors.text.secondary }}>Project not found.</div>;

  const isAdmin = user?.role === "admin";
  const isProjectMgr = user ? project.managers.some((m) => m.id === user.id) : false;
  const canClose = (isAdmin || isProjectMgr) && project.status !== "closed";
  const canPropose = user?.role === "manager" && isProjectMgr && project.status === "active";
  const canCreateTask = (isAdmin || isProjectMgr) && project.status !== "closed";
  const pct = project.task_count > 0 ? Math.round((project.completed_task_count / project.task_count) * 100) : 0;

  return (
    <div className="pb-10">
      <div className="relative px-5 pt-5 pb-6 rounded-b-3xl overflow-hidden" style={{ background: `linear-gradient(135deg, ${colors.brand.maroonDeep}, ${colors.brand.maroon})` }}>
        <div className="flex items-center justify-between mb-5">
          <button data-testid="project-back" onClick={() => navigate(-1)} className="w-10 h-10 rounded-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: "rgba(253,251,247,0.12)" }}><ChevronLeft size={22} style={{ color: colors.text.inverse }} /></button>
          <span className="text-[10.5px] tracking-[2.5px] font-bold" style={{ color: colors.brand.gold }}>PROJECT DOSSIER</span>
          <div className="w-10" />
        </div>
        <h1 className="text-[26px] font-bold tracking-tight mb-2" style={{ color: colors.text.inverse }} data-testid="project-name">{project.name}</h1>
        {project.description && <p className="text-[13.5px] leading-5 mb-3.5" style={{ color: "rgba(253,251,247,0.85)" }}>{project.description}</p>}
        <div className="flex gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10.5px] font-bold tracking-[1.2px]" style={{ borderColor: "rgba(212,175,55,0.55)", backgroundColor: "rgba(212,175,55,0.12)", color: colors.brand.gold }}>{project.status.toUpperCase().replace("_", " ")}</span>
          {project.final_rating != null && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border" style={{ borderColor: "rgba(212,175,55,0.55)", backgroundColor: "rgba(212,175,55,0.12)" }}><RatingStars value={project.final_rating} size={11} showValue /></span>}
        </div>
        <div className="rounded-[14px] border p-3.5" style={{ backgroundColor: "rgba(253,251,247,0.08)", borderColor: "rgba(212,175,55,0.35)" }}>
          <div className="flex justify-between mb-2"><span className="text-[11px] tracking-[1.5px] font-bold" style={{ color: "rgba(253,251,247,0.75)" }}>Progress</span><span className="text-sm font-bold" style={{ color: colors.brand.gold }}>{pct}%</span></div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(212,175,55,0.20)" }}><div className="h-full rounded-full" style={{ backgroundColor: colors.brand.gold, width: `${pct}%` }} /></div>
          <p className="mt-2 text-[11.5px] font-semibold" style={{ color: "rgba(253,251,247,0.65)" }}>{project.completed_task_count} of {project.task_count} tasks completed</p>
        </div>
      </div>

      <div className="p-5">
        {stats && <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-2">{[{ l: "Avg Rating", v: stats.avg_task_rating > 0 ? stats.avg_task_rating.toFixed(1) : "—", a: colors.brand.gold }, { l: "In Review", v: stats.tasks_by_status.in_review || 0, a: "#D4770A" }, { l: "Managers", v: project.managers.length, a: colors.brand.navy }, { l: "Taskers", v: project.taskers.length, a: colors.brand.maroon }].map((s, i) => <div key={i} className="relative rounded-xl p-3.5 border overflow-hidden" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }}><div className="absolute top-0 left-0 bottom-0 w-[3px]" style={{ backgroundColor: s.a }} /><p className="text-[22px] font-bold mb-0.5 ml-1" style={{ color: colors.brand.maroon }}>{s.v}</p><p className="text-[10.5px] tracking-[1.2px] font-bold uppercase ml-1" style={{ color: colors.text.secondary }}>{s.l}</p></div>)}</div>}

        <SectionRow title="Managers" action={isAdmin && project.status !== "closed" ? () => setAddRole("manager") : null} actionTestId="add-manager-btn" />
        <div className="flex flex-wrap gap-2 mb-2">{project.managers.length === 0 ? <p className="text-[13px]" style={{ color: colors.text.muted }}>No managers assigned</p> : project.managers.map((m) => <MemberChip key={m.id} member={m} bg={colors.brand.navy} onClick={() => navigate(`/team/${m.id}`)} />)}</div>

        <SectionRow title="Taskers" action={(isAdmin || isProjectMgr) && project.status !== "closed" ? () => setAddRole("tasker") : null} actionTestId="add-tasker-btn" />
        <div className="flex flex-wrap gap-2 mb-2">{project.taskers.length === 0 ? <p className="text-[13px]" style={{ color: colors.text.muted }}>No taskers assigned</p> : project.taskers.map((t) => <MemberChip key={t.id} member={t} onClick={() => navigate(`/team/${t.id}`)} />)}</div>

        <SectionRow title="Tasks" action={canCreateTask ? () => navigate(`/tasks/new?project_id=${project.id}`) : null} actionTestId="project-new-task" />
        {tasks.length === 0 ? <div className="flex flex-col items-center py-6 gap-1.5 rounded-[14px] border border-dashed" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }}><p className="text-xs" style={{ color: colors.text.muted }}>No tasks yet</p></div> : tasks.map((t) => <TaskCard key={t.id} task={t} />)}

        {stats && stats.tasker_leaderboard?.length > 0 && <>
          <p className="text-[11px] tracking-[2.5px] font-bold uppercase mt-5 mb-3" style={{ color: colors.text.secondary }}>TOP PERFORMERS</p>
          {stats.tasker_leaderboard.map((row, idx) => <div key={row.id} data-testid={`leaderboard-${row.id}`} className="flex items-center gap-3 p-3 rounded-xl border mb-2" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }}><span className="text-sm font-extrabold w-6" style={{ color: colors.brand.gold }}>#{idx + 1}</span><div className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[11px] font-bold" style={{ backgroundColor: colors.brand.maroon, color: colors.text.inverse }}>{initials(row.name)}</div><div className="flex-1 min-w-0"><p className="text-[12.5px] font-bold truncate" style={{ color: colors.text.primary }}>{row.name}</p><p className="text-[11px] mt-0.5" style={{ color: colors.text.muted }}>{row.completed} completed</p></div><RatingStars value={row.avg_rating} size={12} showValue /></div>)}
        </>}

        {project.status === "closure_proposed" && <div className="flex items-center gap-2.5 p-3.5 rounded-xl border mt-5" style={{ backgroundColor: "rgba(212,175,55,0.15)", borderColor: colors.brand.gold }}><Flag size={18} style={{ color: colors.brand.gold }} /><p className="flex-1 text-[13px] font-semibold leading-[18px]" style={{ color: colors.brand.maroon }}>Closure has been proposed. Awaiting admin confirmation.</p></div>}
        {canClose && <button data-testid="close-project" onClick={() => setShowClose(true)} className="w-full flex items-center justify-center gap-2 mt-6 py-4 rounded-xl text-sm font-bold transition-opacity focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.brand.emerald, color: colors.text.inverse }}><CheckCircle size={18} />Close Project &amp; Rate</button>}
        {canPropose && !canClose && <button data-testid="propose-close-project" onClick={proposeClose} disabled={closing} className="w-full flex items-center justify-center gap-2 mt-6 py-3.5 rounded-xl border-[1.5px] text-[13.5px] font-bold transition-opacity focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ borderColor: colors.brand.maroon, color: colors.brand.maroon }}><Flag size={16} />Propose Closure to Admin</button>}
      </div>

      {showClose && <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ backgroundColor: "rgba(26,18,16,0.65)" }}><div className="w-full max-w-[460px] rounded-[20px] border p-5" style={{ backgroundColor: colors.bg.primary, borderColor: colors.border.medium }} data-testid="close-project-modal"><div className="flex items-center gap-2.5 mb-1.5"><div className="w-8 h-8 rounded-full border flex items-center justify-center" style={{ borderColor: colors.brand.gold, backgroundColor: "rgba(212,175,55,0.15)" }}><Award size={16} style={{ color: colors.brand.gold }} /></div><h3 className="flex-1 text-[17px] font-bold" style={{ color: colors.brand.maroon }}>Close &amp; Rate Project</h3><button data-testid="close-modal-x" onClick={() => setShowClose(false)} className="focus:outline-none" style={{ color: colors.text.muted }}>✕</button></div><p className="text-[12.5px] mb-3" style={{ color: colors.text.secondary }}>Final rating for this initiative.</p><div className="flex justify-center gap-1 my-3">{[1,2,3,4,5].map((n) => <button key={n} data-testid={`project-star-${n}`} onClick={() => setRating(n)} className="text-[32px] mx-1 focus:outline-none transition-transform hover:scale-110" style={{ color: n <= rating ? colors.brand.gold : "rgba(212,175,55,0.35)" }}>★</button>)}</div><p className="text-[10.5px] tracking-[2px] font-bold uppercase mt-1.5 mb-1.5" style={{ color: colors.text.secondary }}>Feedback (optional)</p><textarea data-testid="project-feedback-input" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Notes on how the project went…" className="w-full rounded-xl border p-3 text-sm min-h-[80px] outline-none focus:ring-2 focus:ring-[#D4AF37] resize-none" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle, color: colors.text.primary }} /><button data-testid="confirm-close-project" onClick={confirmClose} disabled={closing} className="w-full flex items-center justify-center gap-2 mt-3.5 py-3.5 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.brand.maroon, color: colors.text.inverse, opacity: closing ? 0.6 : 1 }}>{closing ? <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <><CheckCircle size={18} />Close Project</>}</button></div></div>}

      {addRole && <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ backgroundColor: "rgba(26,18,16,0.65)" }}><div className="w-full max-w-[460px] rounded-[20px] border p-5 max-h-[80vh] overflow-y-auto" style={{ backgroundColor: colors.bg.primary, borderColor: colors.border.medium }} data-testid="add-member-modal"><div className="flex items-center gap-2.5 mb-1.5"><div className="w-8 h-8 rounded-full border flex items-center justify-center" style={{ borderColor: colors.brand.gold, backgroundColor: "rgba(212,175,55,0.15)" }}><Users size={15} style={{ color: colors.brand.gold }} /></div><h3 className="flex-1 text-[17px] font-bold" style={{ color: colors.brand.maroon }}>Add {addRole === "manager" ? "Manager" : "Tasker"}</h3><button data-testid="add-member-close" onClick={() => setAddRole(null)} className="focus:outline-none" style={{ color: colors.text.muted }}>✕</button></div><p className="text-[12.5px] mb-3" style={{ color: colors.text.secondary }}>Pick a household member to add to this project.</p>{(() => { const existingIds = addRole === "manager" ? project.managers.map((m) => m.id) : project.taskers.map((t) => t.id); const eligible = allUsers.filter((u) => u.role === addRole && !existingIds.includes(u.id)); if (eligible.length === 0) return <p className="text-center py-6 text-xs" style={{ color: colors.text.muted }}>No available {addRole}s.</p>; return eligible.map((u) => <button key={u.id} data-testid={`pick-member-${u.id}`} onClick={() => addMember(u.id)} disabled={savingMembers} className="w-full flex items-center gap-3 py-2.5 px-1 border-b text-left transition-colors hover:bg-[rgba(212,175,55,0.05)] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]" style={{ borderColor: colors.border.subtle }}><div className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[11px] font-bold" style={{ backgroundColor: addRole === "manager" ? colors.brand.navy : colors.brand.maroon, color: colors.text.inverse }}>{initials(u.name)}</div><div className="flex-1"><p className="text-sm font-bold" style={{ color: colors.text.primary }}>{u.name}</p><p className="text-[11.5px] mt-0.5" style={{ color: colors.text.muted }}>{u.email}</p></div>{u.avg_rating > 0 && <RatingStars value={u.avg_rating} size={11} showValue />}</button>); })()}</div></div>}
    </div>
  );
}

function SectionRow({ title, action, actionTestId }) {
  return (
    <div className="flex justify-between items-center mt-5 mb-3">
      <h2 className="text-xl font-bold" style={{ color: colors.brand.maroon }}>{title}</h2>
      {action && <button data-testid={actionTestId} onClick={action} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.brand.maroon, color: colors.text.inverse }}><Plus size={14} />Add</button>}
    </div>
  );
}

function MemberChip({ member, bg, onClick }) {
  return (
    <button onClick={onClick} data-testid={`member-${member.id}`} className="inline-flex items-center gap-2.5 px-2.5 py-2 rounded-full border transition-colors hover:bg-[rgba(212,175,55,0.08)] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }}>
      <div className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[11px] font-bold" style={{ backgroundColor: bg || colors.brand.maroon, color: colors.text.inverse }}>{initials(member.name)}</div>
      <div><p className="text-[12.5px] font-bold" style={{ color: colors.text.primary }}>{member.name}</p><RatingStars value={member.avg_rating} size={10} /></div>
    </button>
  );
}
