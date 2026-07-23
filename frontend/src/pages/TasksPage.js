import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, Clock, ClipboardList, Plus, Repeat, Users } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { api } from "@/apiClient";
import { colors } from "@/theme/colors";
import { OverallStatusPill, PriorityPill, RatingStars } from "@/components/Pills";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "mine", label: "Mine" },
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "in_review", label: "In Review" },
  { key: "completed", label: "Completed" },
  { key: "overdue", label: "Overdue" },
];

function formatDue(dueDate) {
  if (!dueDate) return { text: "No due date", overdue: false };
  const due = new Date(dueDate);
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

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function taskRating(task) {
  const rated = task.assignments.filter((assignment) => assignment.final_rating != null);
  if (!rated.length) return 0;
  return rated.reduce((total, assignment) => total + (assignment.final_rating || 0), 0) / rated.length;
}

function assigneeLabel(task, isManager) {
  if (!isManager) return "Assigned to you";
  if (task.assignments.length === 1) return task.assignments[0].assignee_name || "Unassigned";
  return `${task.assignments.length} assignees`;
}

function TaskRow({ task, showAssignees }) {
  const due = formatDue(task.due_date);
  const rating = taskRating(task);

  return (
    <Link
      to={`/tasks/${task.id}`}
      data-testid={`task-card-${task.id}`}
      className="group grid w-full gap-3 border-b px-4 py-3.5 text-left no-underline transition-colors last:border-b-0 hover:bg-[#FAF6ED] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#D4AF37] lg:grid-cols-[minmax(0,2fr)_minmax(110px,0.9fr)_minmax(88px,0.75fr)_minmax(108px,0.9fr)_minmax(118px,1fr)_minmax(86px,0.7fr)] lg:items-center"
      style={{ borderColor: colors.border.subtle }}
    >
      <div className="min-w-0">
        <div className="mb-1 flex min-w-0 items-center gap-2">
          {task.is_recurring ? (
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5"
              style={{ backgroundColor: "rgba(212,175,55,0.15)" }}
              title={`Repeats ${task.recurrence || ""}`}
            >
              <Repeat size={11} style={{ color: colors.brand.gold }} />
              <span className="text-[9px] font-bold tracking-[0.5px]" style={{ color: colors.brand.goldDeep }}>
                {task.recurrence?.toUpperCase() || "REPEAT"}
              </span>
            </span>
          ) : null}
          <h3 className="truncate text-[14px] font-bold" style={{ color: colors.text.primary }}>
            {task.title}
          </h3>
        </div>
        <div className="flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-[11px] font-semibold" style={{ color: colors.text.muted }}>
          {task.project_name ? <span className="truncate">{task.project_name}</span> : null}
          {task.category ? <span className="truncate" style={{ color: colors.brand.maroon }}>{task.category}</span> : null}
        </div>
        {task.description ? (
          <p className="mt-1 line-clamp-1 text-[12px]" style={{ color: colors.text.secondary }}>
            {task.description}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 lg:block">
        <span className="text-[10px] font-bold uppercase tracking-[1.2px] lg:hidden" style={{ color: colors.text.muted }}>
          Status
        </span>
        <OverallStatusPill status={task.overall_status} />
      </div>

      <div className="flex items-center justify-between gap-3 lg:block">
        <span className="text-[10px] font-bold uppercase tracking-[1.2px] lg:hidden" style={{ color: colors.text.muted }}>
          Priority
        </span>
        <PriorityPill priority={task.priority} />
      </div>

      <div className="flex items-center justify-between gap-3 lg:block">
        <span className="text-[10px] font-bold uppercase tracking-[1.2px] lg:hidden" style={{ color: colors.text.muted }}>
          Due
        </span>
        <span
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold"
          style={{ color: due.overdue ? colors.brand.maroon : colors.text.secondary }}
        >
          {due.overdue ? <AlertCircle size={13} /> : <Clock size={13} />}
          <span className={due.overdue ? "font-bold" : ""}>{due.text}</span>
        </span>
      </div>

      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3 lg:justify-start">
          <span className="text-[10px] font-bold uppercase tracking-[1.2px] lg:hidden" style={{ color: colors.text.muted }}>
            Assignee
          </span>
          {showAssignees && task.assignments.length > 0 ? (
            <span className="inline-flex min-w-0 items-center gap-2">
              <span className="flex -space-x-2">
                {task.assignments.slice(0, 3).map((assignment) => (
                  <span
                    key={assignment.id}
                    className="flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] text-[9px] font-bold"
                    style={{
                      backgroundColor: assignment.assignee_role === "manager" ? colors.brand.navy : colors.brand.maroon,
                      borderColor: colors.bg.card,
                      color: colors.text.inverse,
                    }}
                  >
                    {initials(assignment.assignee_name || "?")}
                  </span>
                ))}
              </span>
              <span className="truncate text-[12px] font-semibold" style={{ color: colors.text.secondary }}>
                {assigneeLabel(task, showAssignees)}
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: colors.text.secondary }}>
              <Users size={13} style={{ color: colors.brand.gold }} />
              {assigneeLabel(task, showAssignees)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 lg:block">
        <span className="text-[10px] font-bold uppercase tracking-[1.2px] lg:hidden" style={{ color: colors.text.muted }}>
          Rating
        </span>
        {rating > 0 ? (
          <RatingStars value={rating} size={12} showValue />
        ) : (
          <span className="text-[12px] font-semibold" style={{ color: colors.text.muted }}>
            --
          </span>
        )}
      </div>
    </Link>
  );
}

export default function TasksPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setTasks(await api.get("/tasks"));
    } catch {
    }
  }, []);

  useEffect(() => {
    load().then(() => setLoading(false));
  }, [load]);

  const isManager = user?.role === "admin" || user?.role === "manager";
  const visibleFilters = user?.role === "floor_manager" ? FILTERS.filter((filterItem) => filterItem.key !== "mine") : FILTERS;

  const filtered = useMemo(() => {
    let list = tasks;
    if (filter === "mine" && user) {
      list = list.filter((task) => task.assignments.some((assignment) => assignment.assignee_id === user.id));
    } else if (filter === "overdue") {
      list = list.filter((task) => task.overall_status !== "completed" && task.due_date && new Date(task.due_date).getTime() < Date.now());
    } else if (["pending", "in_progress", "in_review", "completed"].includes(filter)) {
      list = list.filter((task) => task.overall_status === filter);
    }
    return list;
  }, [tasks, filter, user]);

  return (
    <div className="p-5 pb-24">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1.5 text-[10.5px] font-bold tracking-[3px]" style={{ color: colors.brand.gold }}>
            ESTATE OPERATIONS
          </p>
          <h1 className="text-[30px] font-bold tracking-tight" style={{ color: colors.brand.maroon }} data-testid="tasks-title">
            Tasks
          </h1>
        </div>
        {isManager ? (
          <button
            data-testid="tasks-new-button"
            type="button"
            onClick={() => navigate("/tasks/new")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            style={{ backgroundColor: colors.brand.maroon }}
            aria-label="Create task"
            title="Create task"
          >
            <Plus size={20} style={{ color: colors.text.inverse }} />
          </button>
        ) : null}
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto border-b py-3.5 scrollbar-hide" style={{ borderColor: colors.border.subtle }}>
        {visibleFilters.map((filterItem) => (
          <button
            key={filterItem.key}
            data-testid={`filter-chip-${filterItem.key}`}
            type="button"
            onClick={() => setFilter(filterItem.key)}
            className="h-9 shrink-0 rounded-full border px-4 text-[12.5px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            style={{
              backgroundColor: filter === filterItem.key ? colors.brand.maroon : colors.bg.secondary,
              borderColor: filter === filterItem.key ? colors.brand.maroon : colors.border.subtle,
              color: filter === filterItem.key ? colors.text.inverse : colors.text.secondary,
            }}
          >
            {filterItem.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <span className="h-8 w-8 animate-spin rounded-full border-[3px]" style={{ borderColor: colors.brand.maroon, borderTopColor: "transparent" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16" data-testid="tasks-empty">
          <ClipboardList size={44} style={{ color: colors.brand.gold }} />
          <p className="mt-2 text-lg font-bold" style={{ color: colors.brand.maroon }}>
            No tasks here
          </p>
          <p className="text-center text-[13px]" style={{ color: colors.text.secondary }}>
            {isManager ? "Create a new task or change the filter." : "Nothing in this filter."}
          </p>
        </div>
      ) : (
        <section
          aria-label="Tasks list"
          className="overflow-hidden rounded-2xl border shadow-sm"
          style={{ backgroundColor: colors.bg.card, borderColor: colors.border.subtle }}
          data-testid="tasks-list-view"
        >
          <div
            className="hidden border-b px-4 py-2.5 text-[10px] font-bold uppercase tracking-[1.4px] lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(110px,0.9fr)_minmax(88px,0.75fr)_minmax(108px,0.9fr)_minmax(118px,1fr)_minmax(86px,0.7fr)]"
            style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle, color: colors.text.muted }}
          >
            <span>Task</span>
            <span>Status</span>
            <span>Priority</span>
            <span>Due</span>
            <span>Assignee</span>
            <span>Rating</span>
          </div>
          {filtered.map((task) => (
            <TaskRow key={task.id} task={task} showAssignees={isManager} />
          ))}
        </section>
      )}
    </div>
  );
}
