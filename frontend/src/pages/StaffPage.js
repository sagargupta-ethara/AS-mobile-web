import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Users, XCircle } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { api } from "@/apiClient";
import { colors } from "@/theme/colors";

const FILTERS = [{ key: "all", label: "All" }, { key: "manager", label: "Managers" }, { key: "tasker", label: "Taskers" }];
function initials(name) { return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase() || "").join(""); }

export default function StaffPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { try { setUsers(await api.get("/users")); } catch { /* silent */ } }, []);
  useEffect(() => { load().then(() => setLoading(false)); }, [load]);

  const filtered = users.filter((u) => { if (u.role === "admin") return false; if (filter === "all") return true; return u.role === filter; });
  const canRemove = user?.role === "admin";

  const removeUser = async (u) => {
    try { await api.del(`/users/${u.id}`); setUsers((prev) => prev.filter((x) => x.id !== u.id)); } catch { /* silent */ }
  };

  return (
    <div className="p-5 pb-24">
      <div className="flex justify-between items-center mb-2">
        <div><p className="text-[10.5px] tracking-[3px] font-bold mb-1.5" style={{ color: colors.brand.gold }}>HOUSEHOLD DIRECTORY</p><h1 className="text-[30px] font-bold tracking-tight" style={{ color: colors.brand.maroon }}>Team</h1></div>
        <button data-testid="staff-new-button" onClick={() => navigate("/staff/new")} className="w-11 h-11 rounded-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.brand.maroon }}><Plus size={18} style={{ color: colors.text.inverse }} /></button>
      </div>
      <div className="flex gap-2 py-3.5 border-b mb-4" style={{ borderColor: colors.border.subtle }}>
        {FILTERS.map((f) => <button key={f.key} data-testid={`staff-filter-${f.key}`} onClick={() => setFilter(f.key)} className="h-9 px-4 rounded-full text-[12.5px] font-semibold border transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: filter === f.key ? colors.brand.maroon : colors.bg.secondary, borderColor: filter === f.key ? colors.brand.maroon : colors.border.subtle, color: filter === f.key ? colors.text.inverse : colors.text.secondary }}>{f.label}</button>)}
      </div>
      {loading ? <div className="flex justify-center py-10"><span className="animate-spin w-8 h-8 border-3 rounded-full" style={{ borderColor: colors.brand.maroon, borderTopColor: "transparent" }} /></div> : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-2" data-testid="staff-empty">
          <Users size={44} style={{ color: colors.brand.gold }} />
          <p className="text-lg font-bold mt-2" style={{ color: colors.brand.maroon }}>No one here yet</p>
          <p className="text-[13px] text-center" style={{ color: colors.text.secondary }}>Add your first staff member to get started.</p>
          <button data-testid="empty-add-staff" onClick={() => navigate("/staff/new")} className="mt-4 px-6 py-3 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ backgroundColor: colors.brand.maroon, color: colors.text.inverse }}>Add Staff</button>
        </div>
      ) : filtered.map((item) => (
        <button key={item.id} data-testid={`staff-card-${item.id}`} onClick={() => navigate(`/team/${item.id}`)} className="w-full flex items-center gap-3.5 rounded-[14px] border p-3.5 mb-2.5 text-left transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" style={{ borderColor: colors.border.subtle }}>
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-[15px] font-bold" style={{ backgroundColor: item.role === "manager" ? colors.brand.navy : colors.brand.maroon, color: colors.text.inverse }}>{initials(item.name)}</div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold mb-0.5" style={{ color: colors.text.primary }}>{item.name}</p>
            <p className="text-[12.5px] truncate mb-1.5" style={{ color: colors.text.muted }}>{item.email}</p>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full border text-[9.5px] font-bold tracking-[1.2px]" style={{ backgroundColor: item.role === "manager" ? "rgba(0,0,128,0.08)" : "rgba(212,175,55,0.15)", borderColor: item.role === "manager" ? colors.brand.navy : colors.border.medium, color: item.role === "manager" ? colors.brand.navy : colors.brand.goldDeep }}>{item.role.toUpperCase()}</span>
              {item.avg_rating > 0 && <span className="inline-flex items-center gap-1"><span className="text-[13px]" style={{ color: colors.brand.gold }}>★</span><span className="text-[11px] font-bold" style={{ color: colors.text.primary }}>{item.avg_rating.toFixed(1)} ({item.ratings_count})</span></span>}
            </div>
          </div>
          {(canRemove || (user?.role === "manager" && item.role === "tasker")) && <button data-testid={`staff-remove-${item.id}`} onClick={(e) => { e.stopPropagation(); removeUser(item); }} className="p-1 focus:outline-none"><XCircle size={22} style={{ color: colors.brand.maroon }} /></button>}
        </button>
      ))}
    </div>
  );
}
