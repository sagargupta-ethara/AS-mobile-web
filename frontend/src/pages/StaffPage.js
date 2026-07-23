import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Users, XCircle } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { api } from "@/apiClient";
import { colors } from "@/theme/colors";
import { Page, PageHeader, Card, Button, Spinner, EmptyState, FilterChips, Avatar } from "@/components/ui-kit";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "manager", label: "Managers" },
  { key: "floor_manager", label: "Floor Managers" },
];

export default function StaffPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { try { setUsers(await api.get("/users")); } catch { /* silent */ } }, []);
  useEffect(() => { load().then(() => setLoading(false)); }, [load]);

  const filtered = users.filter((u) => {
    if (u.role === "admin") return false;
    if (filter === "all") return true;
    return u.role === filter;
  });
  const canRemove = user?.role === "admin";

  const removeUser = async (u) => {
    try {
      await api.del(`/users/${u.id}`);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch { /* silent */ }
  };

  return (
    <Page testId="staff-page">
      <PageHeader
        overline="Household Directory"
        title="Team"
        icon={<Users size={20} />}
        subtitle={loading ? undefined : `${filtered.length} ${filtered.length === 1 ? "member" : "members"}`}
        actions={
          canRemove && (
            <Button testId="staff-new-button" icon={<Plus size={17} />} onClick={() => navigate("/staff/new")}>
              Add Member
            </Button>
          )
        }
      />

      <div className="mb-5">
        <FilterChips items={FILTERS} value={filter} onChange={setFilter} testIdPrefix="staff-filter" />
      </div>

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          testId="staff-empty"
          icon={<Users size={30} />}
          title="No one here yet"
          message="Add your first staff member to get started."
          action={
            canRemove && (
              <Button testId="empty-add-staff" icon={<Plus size={17} />} onClick={() => navigate("/staff/new")}>Add Staff</Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <Card key={item.id} testId={`staff-card-${item.id}`} onClick={() => navigate(`/team/${item.id}`)} className="p-4 flex items-center gap-3.5">
              <Avatar name={item.name} role={item.role} size={48} />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold mb-0.5 truncate" style={{ color: colors.text.primary }}>{item.name}</p>
                <p className="text-[12px] mb-1.5 truncate" style={{ color: colors.text.muted }}>{item.email}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-[0.4px] border"
                    style={{
                      backgroundColor: item.role === "manager" ? "rgba(0,0,128,0.08)" : "rgba(212,175,55,0.15)",
                      borderColor: item.role === "manager" ? "rgba(0,0,128,0.25)" : colors.border.medium,
                      color: item.role === "manager" ? colors.brand.navy : colors.brand.goldDeep,
                    }}
                  >
                    {item.role.toUpperCase()}
                  </span>
                  {item.avg_rating > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs">
                      <span style={{ color: colors.brand.gold }}>★</span>
                      <span className="font-bold" style={{ color: colors.text.primary }}>{item.avg_rating.toFixed(1)} ({item.ratings_count})</span>
                    </span>
                  )}
                </div>
              </div>
              {canRemove && item.role !== "admin" && (
                <button
                  data-testid={`staff-remove-${item.id}`}
                  onClick={(e) => { e.stopPropagation(); removeUser(item); }}
                  className="p-1.5 rounded-lg shrink-0 transition-colors hover:bg-[rgba(123,24,30,0.08)] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                  aria-label={`Remove ${item.name}`}
                >
                  <XCircle size={20} style={{ color: colors.brand.maroon }} />
                </button>
              )}
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}
