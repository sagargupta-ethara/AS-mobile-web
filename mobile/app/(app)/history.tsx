import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  ImageBackground,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";

import { api, Project, Task } from "@/src/api/client";
import { colors, GOLD_PATTERN } from "@/src/theme/colors";
import { useAuth } from "@/src/auth/AuthContext";
import { RatingStars } from "@/src/ui/pills";

type Mode = "tasks" | "projects";

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [mode, setMode] = useState<Mode>("tasks");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [t, p] = await Promise.all([
        api.get<Task[]>("/tasks"),
        api.get<Project[]>("/projects"),
      ]);
      setTasks(t);
      setProjects(p);
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

  // "History" = completed tasks & closed projects
  const completedTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.overall_status === "completed")
        .sort((a, b) => {
          const at =
            a.assignments.find((x) => x.approved_at)?.approved_at ||
            a.updated_at;
          const bt =
            b.assignments.find((x) => x.approved_at)?.approved_at ||
            b.updated_at;
          return new Date(bt).getTime() - new Date(at).getTime();
        }),
    [tasks]
  );

  const closedProjects = useMemo(
    () =>
      projects
        .filter((p) => p.status === "closed")
        .sort(
          (a, b) =>
            new Date(b.closed_at || b.created_at).getTime() -
            new Date(a.closed_at || a.created_at).getTime()
        ),
    [projects]
  );

  const isManager = user?.role === "admin" || user?.role === "manager";

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ImageBackground
        source={{ uri: GOLD_PATTERN }}
        style={[styles.hero, { paddingTop: insets.top + 14 }]}
        imageStyle={{ opacity: 0.08 }}
      >
        <LinearGradient
          colors={[colors.brand.maroonDeep, colors.brand.maroon]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.headerRow}>
          <TouchableOpacity
            testID="history-back"
            onPress={() => router.back()}
            hitSlop={10}
            style={styles.iconBtn}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text.inverse} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.overline}>ROYAL ARCHIVES</Text>
            <Text style={styles.title}>History</Text>
          </View>
          <View style={styles.crest}>
            <Ionicons name="archive" size={17} color={colors.brand.gold} />
          </View>
        </View>

        <View style={styles.toggle}>
          <ToggleBtn
            label="Tasks"
            active={mode === "tasks"}
            count={completedTasks.length}
            onPress={() => setMode("tasks")}
            testID="history-toggle-tasks"
          />
          <ToggleBtn
            label="Projects"
            active={mode === "projects"}
            count={closedProjects.length}
            onPress={() => setMode("projects")}
            testID="history-toggle-projects"
          />
        </View>
      </ImageBackground>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand.maroon} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 100,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand.gold}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {mode === "tasks" ? (
            completedTasks.length === 0 ? (
              <EmptyState
                icon="clipboard-outline"
                title="No completed tasks yet"
                sub={
                  isManager
                    ? "Approved tasks will appear here once your team completes them."
                    : "Once your submissions are approved, they show up here."
                }
              />
            ) : (
              completedTasks.map((t) => (
                <TaskHistoryRow
                  key={t.id}
                  task={t}
                  onPress={() => router.push(`/(app)/tasks/${t.id}`)}
                />
              ))
            )
          ) : closedProjects.length === 0 ? (
            <EmptyState
              icon="library-outline"
              title="No closed projects yet"
              sub="Closed projects with final ratings will be archived here."
            />
          ) : (
            closedProjects.map((p) => (
              <ProjectHistoryRow
                key={p.id}
                project={p}
                onPress={() => router.push(`/(app)/projects/${p.id}`)}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function ToggleBtn({
  label,
  active,
  count,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  count: number;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.toggleBtn, active && styles.toggleBtnActive]}
    >
      <Text
        style={[styles.toggleText, active && styles.toggleTextActive]}
      >
        {label}
      </Text>
      <View
        style={[
          styles.toggleBadge,
          active && { backgroundColor: colors.brand.gold },
        ]}
      >
        <Text
          style={[
            styles.toggleBadgeText,
            active && { color: colors.brand.maroonDeep },
          ]}
        >
          {count}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function TaskHistoryRow({
  task,
  onPress,
}: {
  task: Task;
  onPress: () => void;
}) {
  const avgRating = useMemo(() => {
    const rated = task.assignments
      .map((a) => a.final_rating)
      .filter((r): r is number => typeof r === "number");
    if (!rated.length) return null;
    return rated.reduce((s, r) => s + r, 0) / rated.length;
  }, [task]);

  const approvedAt =
    task.assignments.find((a) => a.approved_at)?.approved_at || task.updated_at;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={styles.row}
      testID={`history-task-${task.id}`}
    >
      <View style={styles.rowIcon}>
        <Ionicons
          name="checkmark-done"
          size={18}
          color={colors.brand.emerald}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {task.title}
        </Text>
        <View style={styles.rowMetaLine}>
          {task.project_name ? (
            <>
              <Ionicons name="folder-open" size={11} color={colors.text.muted} />
              <Text style={styles.rowMeta} numberOfLines={1}>
                {task.project_name}
              </Text>
              <Text style={styles.dot}>·</Text>
            </>
          ) : null}
          <Ionicons name="people" size={11} color={colors.text.muted} />
          <Text style={styles.rowMeta}>
            {task.assignments.length}{" "}
            {task.assignments.length === 1 ? "assignee" : "assignees"}
          </Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.rowMeta}>
            {new Date(approvedAt).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </Text>
        </View>
      </View>
      {avgRating != null ? (
        <RatingStars value={avgRating} size={12} showValue />
      ) : (
        <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
      )}
    </TouchableOpacity>
  );
}

function ProjectHistoryRow({
  project,
  onPress,
}: {
  project: Project;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={styles.row}
      testID={`history-project-${project.id}`}
    >
      <View style={[styles.rowIcon, { backgroundColor: "rgba(212,175,55,0.15)" }]}>
        <Ionicons name="library" size={18} color={colors.brand.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {project.name}
        </Text>
        <View style={styles.rowMetaLine}>
          <Ionicons name="checkmark-circle" size={11} color={colors.brand.emerald} />
          <Text style={styles.rowMeta}>
            {project.completed_task_count}/{project.task_count} tasks
          </Text>
          <Text style={styles.dot}>·</Text>
          <Ionicons name="calendar" size={11} color={colors.text.muted} />
          <Text style={styles.rowMeta}>
            Closed{" "}
            {project.closed_at
              ? new Date(project.closed_at).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "—"}
          </Text>
        </View>
      </View>
      {project.final_rating != null ? (
        <RatingStars value={project.final_rating} size={12} showValue />
      ) : (
        <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
      )}
    </TouchableOpacity>
  );
}

function EmptyState({
  icon,
  title,
  sub,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  sub: string;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={colors.brand.gold} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    overflow: "hidden",
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(253,251,247,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  overline: {
    color: colors.brand.gold,
    fontSize: 10,
    letterSpacing: 2.2,
    fontWeight: "700",
  },
  title: {
    color: colors.text.inverse,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginTop: 2,
  },
  crest: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.brand.gold,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(212,175,55,0.15)",
  },
  toggle: {
    marginTop: 14,
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.25)",
    borderRadius: 999,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  toggleBtnActive: { backgroundColor: colors.text.inverse },
  toggleText: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(253,251,247,0.75)",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  toggleTextActive: { color: colors.brand.maroon },
  toggleBadge: {
    minWidth: 22,
    height: 18,
    paddingHorizontal: 6,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(212,175,55,0.28)",
  },
  toggleBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.brand.gold,
  },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: 14,
    marginBottom: 10,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(9,121,105,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontSize: 14.5, fontWeight: "700", color: colors.text.primary },
  rowMetaLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
    flexWrap: "wrap",
  },
  rowMeta: { fontSize: 11.5, color: colors.text.muted, fontWeight: "600" },
  dot: { color: colors.text.muted, fontSize: 11, marginHorizontal: 1 },
  empty: {
    alignItems: "center",
    padding: 32,
    marginTop: 40,
    gap: 8,
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(212,175,55,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.text.primary },
  emptySub: {
    fontSize: 13,
    color: colors.text.muted,
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 20,
  },
});
