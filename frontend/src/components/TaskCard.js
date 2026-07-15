import React from "react";
import { useNavigate } from "react-router-dom";
import { Clock, AlertCircle, Users, Repeat } from "lucide-react";
import { colors } from "@/theme/colors";
import { OverallStatusPill, PriorityPill, RatingStars } from "@/components/Pills";

function formatDue(d) {
  if (!d) return { text: "No due date", overdue: false };
  const due = new Date(d);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffMs < 0) return { text: "Overdue", overdue: true };
  if (diffDays === 0) return { text: "Due today", overdue: false };
  if (diffDays === 1) return { text: "Due tomorrow", overdue: false };
  if (diffDays < 7) return { text: `Due in ${diffDays} days`, overdue: false };
  return {
    text: `Due ${due.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`,
    overdue: false,
  };
}

function initials(name) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase() || "").join("");
}

export default function TaskCard({ task, showAssignees = true }) {
  const navigate = useNavigate();
  const due = formatDue(task.due_date);
  const rated = task.assignments.filter((a) => a.final_rating != null);
  const avg = rated.length > 0 ? rated.reduce((s, a) => s + (a.final_rating || 0), 0) / rated.length : 0;

  return (
    <button
      data-testid={`task-card-${task.id}`}
      onClick={() => navigate(`/tasks/${task.id}`)}
      className="relative w-full text-left rounded-[14px] p-4 pl-5 border mb-3 shadow-sm hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
      style={{ backgroundColor: colors.bg.primary, borderColor: colors.border.subtle }}
    >
      <div className="absolute top-0 bottom-0 left-0 w-1 rounded-l-[14px]" style={{ backgroundColor: colors.priority[task.priority] }} />
      <div className="flex justify-between items-start gap-2 mb-2">
        <div className="flex-1 pr-2">
          {task.project_name ? (
            <p className="text-[10.5px] tracking-[1.5px] font-bold uppercase mb-1" style={{ color: colors.brand.gold }}>{task.project_name}</p>
          ) : task.category ? (
            <p className="text-[10.5px] tracking-[1.5px] font-bold uppercase mb-1" style={{ color: colors.brand.maroon }}>{task.category}</p>
          ) : null}
          <h3 className="text-[15px] font-bold leading-snug" style={{ color: colors.text.primary }}>{task.title}</h3>
        </div>
        <PriorityPill priority={task.priority} />
      </div>
      {task.description && (
        <p className="text-[13px] leading-[19px] mb-3 line-clamp-2" style={{ color: colors.text.secondary }}>{task.description}</p>
      )}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <OverallStatusPill status={task.overall_status} />
        <div className="flex items-center gap-2.5 flex-wrap">
          {avg > 0 && <RatingStars value={avg} size={11} />}
          <span className="inline-flex items-center gap-1 text-xs" style={{ color: due.overdue ? colors.brand.maroon : colors.text.secondary }}>
            {due.overdue ? <AlertCircle size={12} /> : <Clock size={12} />}
            <span className={due.overdue ? "font-bold" : ""}>{due.text}</span>
          </span>
        </div>
      </div>
      {showAssignees && task.assignments.length > 0 && (
        <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t" style={{ borderColor: colors.border.subtle }}>
          <div className="flex -space-x-2">
            {task.assignments.slice(0, 3).map((a) => (
              <div
                key={a.id}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border-[1.5px]"
                style={{
                  backgroundColor: a.assignee_role === "manager" ? colors.brand.navy : colors.brand.maroon,
                  borderColor: colors.bg.primary,
                  color: colors.text.inverse,
                  zIndex: 1,
                }}
              >
                {initials(a.assignee_name || "?")}
              </div>
            ))}
          </div>
          <span className="text-xs font-semibold truncate" style={{ color: colors.text.secondary }}>
            {task.assignments.length === 1 ? task.assignments[0].assignee_name : `${task.assignments.length} assignees`}
          </span>
        </div>
      )}
      {task.is_recurring && (
        <div className="absolute top-3 right-3 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md" style={{ backgroundColor: "rgba(212,175,55,0.15)" }}>
          <Repeat size={11} style={{ color: colors.brand.gold }} />
          <span className="text-[9px] font-bold tracking-[0.5px]" style={{ color: colors.brand.goldDeep }}>{task.recurrence?.toUpperCase()}</span>
        </div>
      )}
    </button>
  );
}
