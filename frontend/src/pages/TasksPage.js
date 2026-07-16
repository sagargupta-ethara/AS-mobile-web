import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ClipboardList } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { api } from "@/apiClient";
import TaskCard from "@/components/TaskCard";
import { Page, PageHeader, Button, Spinner, EmptyState, FilterChips } from "@/components/ui-kit";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "mine", label: "Mine" },
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "in_review", label: "In Review" },
  { key: "completed", label: "Completed" },
  { key: "overdue", label: "Overdue" },
];

export default function TasksPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setTasks(await api.get("/tasks")); } catch { /* silent */ }
  }, []);

  useEffect(() => { load().then(() => setLoading(false)); }, [load]);

  const isManager = user?.role === "admin" || user?.role === "manager";
  const visibleFilters = user?.role === "tasker" ? FILTERS.filter((f) => f.key !== "mine") : FILTERS;

  const filtered = useMemo(() => {
    let list = tasks;
    if (filter === "mine" && user) list = list.filter((t) => t.assignments.some((a) => a.assignee_id === user.id));
    else if (filter === "overdue") list = list.filter((t) => t.overall_status !== "completed" && t.due_date && new Date(t.due_date).getTime() < Date.now());
    else if (["pending", "in_progress", "in_review", "completed"].includes(filter)) list = list.filter((t) => t.overall_status === filter);
    return list;
  }, [tasks, filter, user]);

  return (
    <Page testId="tasks-page">
      <PageHeader
        overline="Estate Operations"
        title="Tasks"
        testId="tasks-title"
        subtitle={loading ? undefined : `${filtered.length} ${filtered.length === 1 ? "task" : "tasks"} in view`}
        icon={<ClipboardList size={20} />}
        actions={
          isManager && (
            <Button testId="tasks-new-button" icon={<Plus size={17} />} onClick={() => navigate("/tasks/new")}>
              New Task
            </Button>
          )
        }
      />

      <div className="mb-5">
        <FilterChips items={visibleFilters} value={filter} onChange={setFilter} testIdPrefix="filter-chip" />
      </div>

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          testId="tasks-empty"
          icon={<ClipboardList size={30} />}
          title="No tasks here"
          message={isManager ? "Create a new task or change the filter." : "Nothing in this filter."}
          action={
            isManager && (
              <Button icon={<Plus size={17} />} onClick={() => navigate("/tasks/new")}>New Task</Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <TaskCard key={t.id} task={t} showAssignees={isManager} />
          ))}
        </div>
      )}
    </Page>
  );
}
