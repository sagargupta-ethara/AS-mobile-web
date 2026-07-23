import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ImageBackground,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";

import { useAuth } from "@/src/auth/AuthContext";
import { api, DashboardStats, Task } from "@/src/api/client";
import { colors, GOLD_PATTERN } from "@/src/theme/colors";
import { TaskCard } from "@/src/ui/task-card";

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, t] = await Promise.all([
        api.get<DashboardStats>("/stats/dashboard"),
        api.get<Task[]>("/tasks"),
      ]);
      setStats(s);
      setTasks(t.slice(0, 6));
    } catch {
      // silent
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        await load();
        setLoading(false);
      })();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const isManager = user?.role === "admin" || user?.role === "manager";
  const greeting = getGreeting();

  return (
    <View style={{ flex: 1 }}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.brand.gold}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <ImageBackground
        source={{ uri: GOLD_PATTERN }}
        style={[styles.hero, { paddingTop: insets.top + 20 }]}
        imageStyle={{ opacity: 0.08 }}
      >
        <LinearGradient
          colors={[colors.brand.maroonDeep, colors.brand.maroon]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroContent}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.overline} testID="dashboard-overline">
                {greeting}
              </Text>
              <Text style={styles.heroTitle} testID="dashboard-user-name">
                {user?.name}
              </Text>
              <View style={styles.roleChip}>
                <Ionicons name="ribbon" size={11} color={colors.brand.gold} />
                <Text style={styles.roleText}>
                  {(user?.role || "").toUpperCase()}
                </Text>
              </View>
            </View>
            <View style={styles.crestSmall}>
              <Ionicons name="home" size={22} color={colors.brand.gold} />
            </View>
          </View>

          <View style={styles.statsRow}>
            <StatCard
              label="Pending"
              value={stats?.active_tasks ?? 0}
              icon="hourglass"
              testID="stat-pending"
            />
            <StatCard
              label="In Review"
              value={stats?.in_review ?? 0}
              icon="sync-circle"
              testID="stat-in-progress"
            />
            <StatCard
              label="Overdue"
              value={stats?.overdue ?? 0}
              icon="warning"
              highlight
              testID="stat-overdue"
            />
          </View>
        </View>
      </ImageBackground>

      <View style={styles.body}>
        {isManager ? (
          <View style={styles.summaryGrid}>
            <SummaryTile
              label="Total Tasks"
              value={stats?.total_tasks ?? 0}
              accent={colors.brand.navy}
              testID="summary-total-tasks"
            />
            <SummaryTile
              label="Completed"
              value={stats?.completed_tasks ?? 0}
              accent={colors.brand.emerald}
              testID="summary-completed"
            />
            <SummaryTile
              label="Active Projects"
              value={stats?.active_projects ?? 0}
              accent={colors.brand.gold}
              testID="summary-projects"
            />
            <SummaryTile
              label="Floor Managers"
              value={stats?.total_floor_managers ?? 0}
              accent={colors.brand.maroon}
              testID="summary-floor_managers"
            />
          </View>
        ) : null}

        {isManager && user?.role === "admin" && stats && stats.top_floor_managers.length > 0 ? (
          <View style={styles.topFloorManagersCard}>
            <Text style={styles.topLabel}>TOP PERFORMERS</Text>
            {stats.top_floor_managers.slice(0, 3).map((t, idx) => (
              <TouchableOpacity
                key={t.id}
                onPress={() => router.push(`/(app)/team/${t.id}`)}
                testID={`top-floor_manager-${t.id}`}
                activeOpacity={0.85}
                style={styles.topRow}
              >
                <Text style={styles.topRank}>#{idx + 1}</Text>
                <View style={styles.topAvatar}>
                  <Text style={styles.topInitials}>
                    {t.name.split(" ").slice(0,2).map(n => n[0]).join("")}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.topName}>{t.name}</Text>
                  <Text style={styles.topSub}>{t.completed} completed</Text>
                </View>
                <View style={styles.topRatingRow}>
                  <Text style={styles.topRatingStar}>★</Text>
                  <Text style={styles.topRating}>{t.avg_rating.toFixed(1)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {isManager ? (
          <View style={styles.quickRow}>
            <TouchableOpacity
              testID="quick-new-task"
              style={styles.quickBtn}
              onPress={() => router.push("/(app)/tasks/new")}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle" size={18} color={colors.text.inverse} />
              <Text style={styles.quickBtnText}>New Task</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="quick-add-staff"
              style={styles.quickBtnSecondary}
              onPress={() => router.push("/(app)/staff/new")}
              activeOpacity={0.85}
            >
              <Ionicons
                name="person-add"
                size={18}
                color={colors.brand.maroon}
              />
              <Text style={styles.quickBtnSecondaryText}>Add Member</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {isManager ? (
          <View style={styles.actionRow}>
            <TouchableOpacity
              testID="open-review-queue"
              onPress={() => router.push("/(app)/reviews")}
              activeOpacity={0.85}
              style={styles.actionCard}
            >
              <View style={[styles.actionIcon, { backgroundColor: "rgba(212,119,10,0.15)" }]}>
                <Ionicons name="hourglass" size={20} color="#D4770A" />
              </View>
              <Text style={styles.actionTitle}>Review Queue</Text>
              <Text style={styles.actionSub}>
                {stats?.in_review ?? 0} awaiting
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="open-history"
              onPress={() => router.push("/(app)/history")}
              activeOpacity={0.85}
              style={styles.actionCard}
            >
              <View style={[styles.actionIcon, { backgroundColor: "rgba(30,58,95,0.15)" }]}>
                <Ionicons name="archive" size={20} color={colors.brand.navy} />
              </View>
              <Text style={styles.actionTitle}>History</Text>
              <Text style={styles.actionSub}>Tasks & Projects</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Tasks</Text>
          <TouchableOpacity
            testID="see-all-tasks"
            onPress={() => router.push("/(app)/tasks")}
          >
            <Text style={styles.seeAll}>See all →</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.brand.maroon} style={{ marginTop: 24 }} />
        ) : tasks.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="cafe-outline" size={40} color={colors.brand.gold} />
            <Text style={styles.emptyTitle}>All caught up</Text>
            <Text style={styles.emptySubtitle}>
              {isManager
                ? "Create your first task to get started."
                : "No tasks assigned to you yet."}
            </Text>
          </View>
        ) : (
          tasks.map((t) => <TaskCard key={t.id} task={t} showAssignees={isManager} />)
        )}
      </View>
    </ScrollView>

    <TouchableOpacity
      testID="concierge-fab"
      onPress={() => router.push("/(app)/concierge")}
      activeOpacity={0.85}
      style={[styles.fab, { bottom: 14 }]}
    >
      <LinearGradient
        colors={[colors.brand.maroon, colors.brand.maroonDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.fabInner}>
        <Ionicons name="sparkles" size={18} color={colors.brand.gold} />
        <Text style={styles.fabText}>Concierge</Text>
      </View>
    </TouchableOpacity>
    </View>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "GOOD MORNING";
  if (h < 17) return "GOOD AFTERNOON";
  return "GOOD EVENING";
}

function StatCard({
  label,
  value,
  icon,
  highlight,
  testID,
}: {
  label: string;
  value: number;
  icon: any;
  highlight?: boolean;
  testID: string;
}) {
  return (
    <View
      testID={testID}
      style={[
        styles.statCard,
        highlight && {
          borderColor: colors.brand.gold,
          backgroundColor: "rgba(212,175,55,0.12)",
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={16}
        color={highlight ? colors.brand.gold : "rgba(253,251,247,0.85)"}
      />
      <Text style={styles.statValue}>{value}</Text>
      <Text
        style={styles.statLabel}
        numberOfLines={1}
        adjustsFontSizeToFit
        allowFontScaling={false}
      >
        {label}
      </Text>
    </View>
  );
}

function SummaryTile({
  label,
  value,
  accent,
  testID,
}: {
  label: string;
  value: number;
  accent: string;
  testID: string;
}) {
  return (
    <View testID={testID} style={styles.summaryTile}>
      <View style={[styles.summaryBar, { backgroundColor: accent }]} />
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    overflow: "hidden",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroContent: {
    zIndex: 1,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  overline: {
    color: colors.brand.gold,
    fontSize: 10.5,
    letterSpacing: 3,
    fontWeight: "700",
    marginBottom: 8,
  },
  heroTitle: {
    color: colors.text.inverse,
    fontSize: 26,
    fontWeight: "600",
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  roleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border.medium,
    backgroundColor: "rgba(212,175,55,0.15)",
  },
  roleText: {
    color: colors.brand.gold,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "700",
  },
  crestSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.brand.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: "rgba(253,251,247,0.08)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
    padding: 12,
    gap: 4,
    minWidth: 0,
  },
  statValue: {
    color: colors.text.inverse,
    fontSize: 22,
    fontWeight: "700",
    marginTop: 6,
  },
  statLabel: {
    color: "rgba(253,251,247,0.75)",
    fontSize: 9.5,
    letterSpacing: 0.4,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  body: {
    padding: 20,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  summaryTile: {
    flexBasis: "48%",
    flexGrow: 1,
    backgroundColor: colors.bg.secondary,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    overflow: "hidden",
    position: "relative",
  },
  summaryBar: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: 3,
  },
  summaryValue: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.brand.maroon,
    marginBottom: 2,
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.text.secondary,
    letterSpacing: 1.2,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  quickRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 22,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: colors.brand.maroon,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  quickBtnText: {
    color: colors.text.inverse,
    fontWeight: "700",
    fontSize: 14,
  },
  quickBtnSecondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.brand.gold,
    backgroundColor: colors.bg.primary,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  quickBtnSecondaryText: {
    color: colors.brand.maroon,
    fontWeight: "700",
    fontSize: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.brand.maroon,
    letterSpacing: -0.2,
  },
  seeAll: {
    fontSize: 12,
    color: colors.brand.gold,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.brand.maroon,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    right: 20,
    borderRadius: 999,
    overflow: "hidden",
    shadowColor: colors.brand.maroon,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 10,
    borderWidth: 1,
    borderColor: colors.brand.gold,
  },
  fabInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fabText: {
    color: colors.text.inverse,
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  topFloorManagersCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: 22,
  },
  topLabel: {
    fontSize: 10.5,
    color: colors.text.secondary,
    letterSpacing: 2.5,
    fontWeight: "700",
    marginBottom: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  topRank: {
    color: colors.brand.gold,
    fontWeight: "800",
    fontSize: 14,
    width: 24,
  },
  topAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brand.maroon,
    alignItems: "center",
    justifyContent: "center",
  },
  topInitials: {
    color: colors.text.inverse,
    fontWeight: "700",
    fontSize: 12,
  },
  topName: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.text.primary,
  },
  topSub: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
  },
  topRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  topRatingStar: {
    color: colors.brand.gold,
    fontSize: 14,
  },
  topRating: {
    color: colors.text.primary,
    fontWeight: "700",
    fontSize: 13,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 22,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.brand.maroon,
    letterSpacing: -0.1,
  },
  actionSub: {
    fontSize: 11.5,
    color: colors.text.secondary,
    fontWeight: "600",
  },
});
