import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ClipboardList } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { api } from "@/apiClient";
import { colors } from "@/theme/colors";
import TaskCard from "@/components/TaskCard";

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
    <div className="p-5 pb-24">
      <div className="flex justify-between items-center mb-2">
        <div>
          <p className="text-[10.5px] tracking-[3px] font-bold mb-1.5" style={{ color: colors.brand.gold }}>ESTATE OPERATIONS</p>
          <h1 className="text-[30px] font-bold tracking-tight" style={{ color: colors.brand.maroon }} data-testid="tasks-title">Tasks</h1>
        </div>
        {isManager && (
          <button data-testid="tasks-new-button" onClick={() => navigate("/tasks/new")} className="w-11 h-11 rounded-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.brand.maroon }}>
            <Plus size={20} style={{ color: colors.text.inverse }} />
          </button>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto py-3.5 border-b mb-4 scrollbar-hide" style={{ borderColor: colors.border.subtle }}>
        {visibleFilters.map((f) => (
          <button key={f.key} data-testid={`filter-chip-${f.key}`} onClick={() => setFilter(f.key)} className="shrink-0 h-9 px-4 rounded-full text-[12.5px] font-semibold border transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: filter === f.key ? colors.brand.maroon : colors.bg.secondary, borderColor: filter === f.key ? colors.brand.maroon : colors.border.subtle, color: filter === f.key ? colors.text.inverse : colors.text.secondary }}>
            {f.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center py-10"><span className="animate-spin w-8 h-8 border-3 rounded-full" style={{ borderColor: colors.brand.maroon, borderTopColor: "transparent" }} /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-2" data-testid="tasks-empty">
          <ClipboardList size={44} style={{ color: colors.brand.gold }} />
          <p className="text-lg font-bold mt-2" style={{ color: colors.brand.maroon }}>No tasks here</p>
          <p className="text-[13px] text-center" style={{ color: colors.text.secondary }}>{isManager ? "Create a new task or change the filter." : "Nothing in this filter."}</p>
        </div>
      ) : (
        filtered.map((t) => <TaskCard key={t.id} task={t} showAssignees={isManager} />)
      )}
    </div>
  );
}
