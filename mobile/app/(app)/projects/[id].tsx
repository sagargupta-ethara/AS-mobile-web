import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  ImageBackground,
  Modal,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import { api, Project, ProjectStats, Task, User } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { colors, GOLD_PATTERN } from "@/src/theme/colors";
import { RatingStars } from "@/src/ui/pills";
import { TaskCard } from "@/src/ui/task-card";
import { useToast } from "@/src/ui/toast";

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() || "")
    .join("");
}

export default function ProjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");

  // Add-member modal state
  const [addRole, setAddRole] = useState<"manager" | "floor_manager" | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [savingMembers, setSavingMembers] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [p, s, ts, us] = await Promise.all([
        api.get<Project>(`/projects/${id}`),
        api.get<ProjectStats>(`/stats/projects/${id}`),
        api.get<Task[]>(`/tasks?project_id=${id}`),
        api.get<User[]>(`/users`),
      ]);
      setProject(p);
      setStats(s);
      setTasks(ts);
      setAllUsers(us);
    } catch (e: any) {
      toast.show(e?.message || "Failed to load project", "error");
    }
  }, [id, toast]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        await load();
        setLoading(false);
      })();
    }, [load])
  );

  const addMember = async (userId: string) => {
    if (!project || !addRole) return;
    setSavingMembers(true);
    try {
      const body: any = {};
      if (addRole === "manager") {
        body.manager_ids = [...project.managers.map((m) => m.id), userId];
      } else {
        body.floor_manager_ids = [...project.floor_managers.map((t) => t.id), userId];
      }
      await api.put<Project>(`/projects/${project.id}/members`, body);
      toast.show(`Member added`, "success");
      setAddRole(null);
      await load();
    } catch (e: any) {
      toast.show(e?.message || "Failed to add", "error");
    } finally {
      setSavingMembers(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.brand.maroon} size="large" />
      </View>
    );
  }

  if (!project) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Project not found.</Text>
      </View>
    );
  }

  const isAdmin = user?.role === "admin";
  const isProjectMgr = user
    ? project.managers.some((m) => m.id === user.id)
    : false;
  const canClose = (isAdmin || isProjectMgr) && project.status !== "closed";
  const canPropose =
    user?.role === "manager" &&
    isProjectMgr &&
    project.status === "active";
  const canCreateTask = (isAdmin || isProjectMgr) && project.status !== "closed";

  const proposeClose = async () => {
    setClosing(true);
    try {
      await api.post(`/projects/${project.id}/propose-close`, { note: "" });
      toast.show("Closure proposed to admin", "success");
      await load();
    } catch (e: any) {
      toast.show(e?.message || "Failed", "error");
    } finally {
      setClosing(false);
    }
  };

  const confirmClose = async () => {
    setClosing(true);
    try {
      await api.post(`/projects/${project.id}/close`, {
        rating,
        feedback: feedback.trim(),
      });
      setShowClose(false);
      toast.show("Project closed with final rating", "success");
      await load();
    } catch (e: any) {
      toast.show(e?.message || "Failed to close", "error");
    } finally {
      setClosing(false);
    }
  };

  const pct =
    project.task_count > 0
      ? Math.round((project.completed_task_count / project.task_count) * 100)
      : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <ImageBackground
          source={{ uri: GOLD_PATTERN }}
          style={[styles.hero, { paddingTop: insets.top + 12 }]}
          imageStyle={{ opacity: 0.08 }}
        >
          <LinearGradient
            colors={[colors.brand.maroonDeep, colors.brand.maroon]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.headerRow}>
            <TouchableOpacity
              testID="project-back"
              onPress={() => router.back()}
              hitSlop={10}
              style={styles.iconBtn}
            >
              <Ionicons
                name="chevron-back"
                size={22}
                color={colors.text.inverse}
              />
            </TouchableOpacity>
            <Text style={styles.overline}>PROJECT DOSSIER</Text>
            <View style={{ width: 40 }} />
          </View>

          <Text style={styles.projectName} testID="project-name">
            {project.name}
          </Text>
          {project.description ? (
            <Text style={styles.projectDesc}>{project.description}</Text>
          ) : null}
          <View style={styles.heroPills}>
            <View style={styles.heroPill}>
              <Ionicons name="pulse" size={12} color={colors.brand.gold} />
              <Text style={styles.heroPillText}>
                {project.status.toUpperCase().replace("_", " ")}
              </Text>
            </View>
            {project.final_rating != null ? (
              <View style={styles.heroPill}>
                <RatingStars value={project.final_rating} size={11} showValue />
              </View>
            ) : null}
          </View>

          <View style={styles.progressCard}>
            <View style={styles.progressTop}>
              <Text style={styles.progressLabel}>Progress</Text>
              <Text style={styles.progressVal}>{pct}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.progressCaption}>
              {project.completed_task_count} of {project.task_count} tasks completed
            </Text>
          </View>
        </ImageBackground>

        <View style={styles.body}>
          {/* Stat tiles */}
          {stats ? (
            <View style={styles.statsRow}>
              <StatTile
                label="Avg Rating"
                value={
                  stats.avg_task_rating > 0
                    ? stats.avg_task_rating.toFixed(1)
                    : "—"
                }
                icon="star"
                accent={colors.brand.gold}
              />
              <StatTile
                label="In Review"
                value={String(stats.tasks_by_status.in_review || 0)}
                icon="hourglass"
                accent="#D4770A"
              />
              <StatTile
                label="Managers"
                value={String(project.managers.length)}
                icon="ribbon"
                accent={colors.brand.navy}
              />
              <StatTile
                label="Floor Managers"
                value={String(project.floor_managers.length)}
                icon="people"
                accent={colors.brand.maroon}
              />
            </View>
          ) : null}

          {/* Members */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Managers</Text>
            {isAdmin && project.status !== "closed" ? (
              <TouchableOpacity
                testID="add-manager-btn"
                onPress={() => setAddRole("manager")}
                activeOpacity={0.85}
                style={styles.smallBtn}
              >
                <Ionicons name="add" size={14} color={colors.text.inverse} />
                <Text style={styles.smallBtnText}>Add</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.membersRow}>
            {project.managers.length === 0 ? (
              <Text style={styles.muted}>No managers assigned</Text>
            ) : (
              project.managers.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => router.push(`/(app)/team/${m.id}`)}
                  activeOpacity={0.85}
                  testID={`member-${m.id}`}
                  style={styles.memberChip}
                >
                  <View style={[styles.memberAvatar, { backgroundColor: colors.brand.navy }]}>
                    <Text style={styles.memberInitials}>{initials(m.name)}</Text>
                  </View>
                  <View>
                    <Text style={styles.memberName}>{m.name}</Text>
                    <RatingStars value={m.avg_rating} size={10} />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>

          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Floor Managers</Text>
            {(isAdmin || isProjectMgr) && project.status !== "closed" ? (
              <TouchableOpacity
                testID="add-floor_manager-btn"
                onPress={() => setAddRole("floor_manager")}
                activeOpacity={0.85}
                style={styles.smallBtn}
              >
                <Ionicons name="add" size={14} color={colors.text.inverse} />
                <Text style={styles.smallBtnText}>Add</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.membersRow}>
            {project.floor_managers.length === 0 ? (
              <Text style={styles.muted}>No floor_managers assigned</Text>
            ) : (
              project.floor_managers.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => router.push(`/(app)/team/${t.id}`)}
                  activeOpacity={0.85}
                  testID={`member-${t.id}`}
                  style={styles.memberChip}
                >
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberInitials}>{initials(t.name)}</Text>
                  </View>
                  <View>
                    <Text style={styles.memberName}>{t.name}</Text>
                    <RatingStars value={t.avg_rating} size={10} />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Tasks */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Tasks</Text>
            {canCreateTask ? (
              <TouchableOpacity
                testID="project-new-task"
                onPress={() =>
                  router.push({
                    pathname: "/(app)/tasks/new",
                    params: { project_id: project.id },
                  })
                }
                activeOpacity={0.85}
                style={styles.smallBtn}
              >
                <Ionicons name="add" size={14} color={colors.text.inverse} />
                <Text style={styles.smallBtnText}>Task</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {tasks.length === 0 ? (
            <View style={styles.emptyTasks}>
              <Ionicons
                name="clipboard-outline"
                size={30}
                color={colors.brand.gold}
              />
              <Text style={styles.emptyTasksText}>No tasks yet</Text>
            </View>
          ) : (
            tasks.map((t) => <TaskCard key={t.id} task={t} />)
          )}

          {/* Leaderboard */}
          {stats && stats.floor_manager_leaderboard.length > 0 ? (
            <>
              <SectionHeader label="Top Performers" />
              {stats.floor_manager_leaderboard.map((row, idx) => (
                <View
                  key={row.id}
                  style={styles.lbRow}
                  testID={`leaderboard-${row.id}`}
                >
                  <Text style={styles.lbRank}>#{idx + 1}</Text>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberInitials}>{initials(row.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>{row.name}</Text>
                    <Text style={styles.lbSub}>
                      {row.completed} completed
                    </Text>
                  </View>
                  <RatingStars value={row.avg_rating} size={12} showValue />
                </View>
              ))}
            </>
          ) : null}

          {/* Closure actions */}
          {project.status === "closure_proposed" ? (
            <View style={styles.proposedCard}>
              <Ionicons name="alert-circle" size={18} color={colors.brand.gold} />
              <Text style={styles.proposedText}>
                Closure has been proposed. Awaiting admin confirmation.
              </Text>
            </View>
          ) : null}

          {canClose ? (
            <TouchableOpacity
              testID="close-project"
              onPress={() => setShowClose(true)}
              activeOpacity={0.85}
              style={styles.closeBtn}
            >
              <Ionicons name="checkmark-done" size={18} color={colors.text.inverse} />
              <Text style={styles.closeBtnText}>Close Project &amp; Rate</Text>
            </TouchableOpacity>
          ) : canPropose ? (
            <TouchableOpacity
              testID="propose-close-project"
              onPress={proposeClose}
              disabled={closing}
              activeOpacity={0.85}
              style={styles.proposeBtn}
            >
              <Ionicons name="flag" size={16} color={colors.brand.maroon} />
              <Text style={styles.proposeBtnText}>
                Propose Closure to Admin
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>

      {/* Close-project modal */}
      <Modal
        visible={showClose}
        transparent
        animationType="fade"
        onRequestClose={() => setShowClose(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.modalCard} testID="close-project-modal">
            <View style={styles.modalHeader}>
              <View style={styles.modalCrest}>
                <Ionicons name="ribbon" size={16} color={colors.brand.gold} />
              </View>
              <Text style={styles.modalTitle}>Close &amp; Rate Project</Text>
              <TouchableOpacity
                testID="close-modal-x"
                onPress={() => setShowClose(false)}
                hitSlop={10}
              >
                <Ionicons name="close" size={20} color={colors.text.muted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>Final rating for this initiative.</Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity
                  key={n}
                  testID={`project-star-${n}`}
                  onPress={() => setRating(n)}
                  hitSlop={8}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      fontSize: 32,
                      color:
                        n <= rating
                          ? colors.brand.gold
                          : "rgba(212,175,55,0.35)",
                      marginHorizontal: 4,
                    }}
                  >
                    ★
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.modalLabel}>Feedback (optional)</Text>
            <TextInput
              testID="project-feedback-input"
              value={feedback}
              onChangeText={setFeedback}
              multiline
              placeholder="Notes on how the project went…"
              placeholderTextColor={colors.text.muted}
              style={styles.modalInput}
              textAlignVertical="top"
            />
            <TouchableOpacity
              testID="confirm-close-project"
              onPress={confirmClose}
              disabled={closing}
              activeOpacity={0.85}
              style={[styles.confirmBtn, closing && { opacity: 0.6 }]}
            >
              {closing ? (
                <ActivityIndicator color={colors.text.inverse} />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={colors.text.inverse}
                  />
                  <Text style={styles.confirmBtnText}>Close Project</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add-Member Modal */}
      <Modal
        visible={!!addRole}
        transparent
        animationType="fade"
        onRequestClose={() => setAddRole(null)}
      >
        <View style={styles.backdrop}>
          <View style={styles.modalCard} testID="add-member-modal">
            <View style={styles.modalHeader}>
              <View style={styles.modalCrest}>
                <Ionicons name="person-add" size={15} color={colors.brand.gold} />
              </View>
              <Text style={styles.modalTitle}>
                Add {addRole === "manager" ? "Manager" : "Floor Manager"}
              </Text>
              <TouchableOpacity
                testID="add-member-close"
                onPress={() => setAddRole(null)}
                hitSlop={10}
              >
                <Ionicons name="close" size={20} color={colors.text.muted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>
              Pick a household member to add to this project.
            </Text>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {(() => {
                if (!project) return null;
                const existingIds =
                  addRole === "manager"
                    ? project.managers.map((m) => m.id)
                    : project.floor_managers.map((t) => t.id);
                const eligible = allUsers.filter(
                  (u) => u.role === addRole && !existingIds.includes(u.id)
                );
                if (eligible.length === 0) {
                  return (
                    <View style={styles.emptyTasks}>
                      <Ionicons
                        name="people-outline"
                        size={28}
                        color={colors.brand.gold}
                      />
                      <Text style={styles.emptyTasksText}>
                        No available {addRole}s. Add one from the Team tab first.
                      </Text>
                    </View>
                  );
                }
                return eligible.map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    testID={`pick-member-${u.id}`}
                    onPress={() => addMember(u.id)}
                    disabled={savingMembers}
                    activeOpacity={0.85}
                    style={styles.pickRow}
                  >
                    <View
                      style={[
                        styles.memberAvatar,
                        addRole === "manager" && { backgroundColor: colors.brand.navy },
                      ]}
                    >
                      <Text style={styles.memberInitials}>{initials(u.name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.pickTopRow}>
                        <Text style={styles.pickName}>{u.name}</Text>
                        <Text style={styles.pickRoleTag}>
                          {u.role.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.pickEmail} numberOfLines={1}>
                        {u.email}
                      </Text>
                    </View>
                    {u.avg_rating > 0 ? (
                      <RatingStars value={u.avg_rating} size={11} showValue />
                    ) : null}
                    <Ionicons
                      name="add-circle"
                      size={22}
                      color={colors.brand.emerald}
                    />
                  </TouchableOpacity>
                ));
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionHeader}>{label.toUpperCase()}</Text>;
}

function StatTile({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: any;
  accent: string;
}) {
  return (
    <View style={styles.statTile}>
      <View style={[styles.statAccent, { backgroundColor: accent }]} />
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={14} color={accent} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg.primary,
  },
  errorText: { color: colors.text.secondary },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(253,251,247,0.12)",
  },
  overline: {
    color: colors.brand.gold,
    fontSize: 10.5, letterSpacing: 2.5, fontWeight: "700",
  },
  projectName: {
    color: colors.text.inverse,
    fontSize: 26, fontWeight: "700",
    letterSpacing: -0.4, marginBottom: 8,
  },
  projectDesc: {
    color: "rgba(253,251,247,0.85)",
    fontSize: 13.5, lineHeight: 20, marginBottom: 14,
  },
  heroPills: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.55)",
    backgroundColor: "rgba(212,175,55,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  heroPillText: {
    color: colors.brand.gold,
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  progressCard: {
    backgroundColor: "rgba(253,251,247,0.08)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
    borderRadius: 14,
    padding: 14,
  },
  progressTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressLabel: {
    color: "rgba(253,251,247,0.75)",
    fontSize: 11, letterSpacing: 1.5, fontWeight: "700",
  },
  progressVal: {
    color: colors.brand.gold, fontSize: 14, fontWeight: "700",
  },
  progressBar: {
    height: 6, backgroundColor: "rgba(212,175,55,0.20)",
    borderRadius: 3, overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.brand.gold,
  },
  progressCaption: {
    marginTop: 8,
    color: "rgba(253,251,247,0.65)",
    fontSize: 11.5,
    fontWeight: "600",
  },
  body: { padding: 20 },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 8,
  },
  statTile: {
    flexBasis: "48%",
    flexGrow: 1,
    backgroundColor: colors.bg.secondary,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    overflow: "hidden",
    gap: 6,
  },
  statAccent: {
    position: "absolute",
    top: 0, left: 0, bottom: 0, width: 3,
  },
  statIcon: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "rgba(212,175,55,0.12)",
    alignItems: "center", justifyContent: "center",
    marginLeft: 4,
  },
  statValue: {
    fontSize: 22, fontWeight: "700",
    color: colors.brand.maroon,
    marginLeft: 4,
  },
  statLabel: {
    fontSize: 10.5, letterSpacing: 1.2,
    fontWeight: "700", color: colors.text.secondary,
    textTransform: "uppercase",
    marginLeft: 4,
  },
  sectionHeader: {
    fontSize: 11,
    letterSpacing: 2.5,
    fontWeight: "700",
    color: colors.text.secondary,
    marginTop: 20,
    marginBottom: 12,
  },
  membersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  memberChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1, borderColor: colors.border.subtle,
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 999,
  },
  memberAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.brand.maroon,
    alignItems: "center", justifyContent: "center",
  },
  memberInitials: {
    color: colors.text.inverse,
    fontWeight: "700",
    fontSize: 11,
  },
  memberName: {
    color: colors.text.primary,
    fontWeight: "700",
    fontSize: 12.5,
  },
  muted: { color: colors.text.muted, fontSize: 13 },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.brand.maroon,
    letterSpacing: -0.3,
  },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brand.maroon,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999,
  },
  smallBtnText: {
    color: colors.text.inverse,
    fontWeight: "700", fontSize: 12,
  },
  emptyTasks: {
    alignItems: "center",
    padding: 24,
    gap: 6,
    backgroundColor: colors.bg.secondary,
    borderRadius: 14,
    borderWidth: 1, borderColor: colors.border.subtle,
    borderStyle: "dashed",
  },
  emptyTasksText: {
    color: colors.text.muted, fontSize: 12,
  },
  lbRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.bg.secondary,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  lbRank: {
    color: colors.brand.gold,
    fontWeight: "800",
    fontSize: 14,
    width: 26,
  },
  lbSub: {
    color: colors.text.muted,
    fontSize: 11,
    marginTop: 2,
  },
  proposedCard: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "rgba(212,175,55,0.15)",
    borderWidth: 1,
    borderColor: colors.brand.gold,
    marginTop: 20,
  },
  proposedText: {
    flex: 1,
    color: colors.brand.maroon,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  closeBtn: {
    marginTop: 24,
    backgroundColor: colors.brand.emerald,
    borderRadius: 12,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  closeBtnText: {
    color: colors.text.inverse,
    fontSize: 14, fontWeight: "700",
    letterSpacing: 0.4,
  },
  proposeBtn: {
    marginTop: 24,
    borderWidth: 1.5,
    borderColor: colors.brand.maroon,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  proposeBtnText: {
    color: colors.brand.maroon,
    fontSize: 13.5,
    fontWeight: "700",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(26,18,16,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: colors.bg.primary,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  modalCrest: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1, borderColor: colors.brand.gold,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(212,175,55,0.15)",
  },
  modalTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: colors.brand.maroon,
  },
  modalSub: {
    fontSize: 12.5,
    color: colors.text.secondary,
    marginBottom: 12,
  },
  starRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 8,
  },
  modalLabel: {
    fontSize: 10.5,
    letterSpacing: 2,
    fontWeight: "700",
    color: colors.text.secondary,
    marginTop: 6,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  modalInput: {
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    color: colors.text.primary,
    fontSize: 14,
  },
  confirmBtn: {
    marginTop: 14,
    backgroundColor: colors.brand.maroon,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  confirmBtnText: {
    color: colors.text.inverse,
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: 0.4,
  },
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  pickName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text.primary,
  },
  pickTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pickRoleTag: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.brand.gold,
    letterSpacing: 1,
    backgroundColor: "rgba(212,175,55,0.15)",
    borderWidth: 1,
    borderColor: colors.brand.gold,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
  },
  pickEmail: {
    fontSize: 11.5,
    color: colors.text.muted,
    marginTop: 2,
  },
});
