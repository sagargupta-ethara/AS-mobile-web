import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";

import { api, Project } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { colors } from "@/src/theme/colors";
import { RatingStars } from "@/src/ui/pills";

const STATUS_META: Record<
  Project["status"],
  { label: string; color: string }
> = {
  active: { label: "Active", color: "#000080" },
  closure_proposed: { label: "Closure Proposed", color: "#D4770A" },
  closed: { label: "Closed", color: "#097969" },
};

export default function ProjectsList() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<Project[]>("/projects");
      setProjects(data);
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

  const isAdmin = user?.role === "admin";

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.overline}>ESTATE INITIATIVES</Text>
          <Text style={styles.title} testID="projects-title">
            Projects
          </Text>
        </View>
        {isAdmin ? (
          <TouchableOpacity
            testID="projects-new-button"
            style={styles.newBtn}
            onPress={() => router.push("/(app)/projects/new")}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={20} color={colors.text.inverse} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator
          color={colors.brand.maroon}
          size="large"
          style={{ marginTop: 40 }}
        />
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 90,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand.gold}
            />
          }
          renderItem={({ item }) => (
            <ProjectRow project={item} onPress={() => router.push(`/(app)/projects/${item.id}`)} />
          )}
          ListEmptyComponent={
            <View style={styles.empty} testID="projects-empty">
              <Ionicons
                name="library-outline"
                size={44}
                color={colors.brand.gold}
              />
              <Text style={styles.emptyTitle}>
                {isAdmin ? "No projects yet" : "No projects assigned"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {isAdmin
                  ? "Start your first initiative — a state dinner, seasonal transition, or renovation."
                  : "You'll see projects here once assigned to one."}
              </Text>
              {isAdmin ? (
                <TouchableOpacity
                  testID="empty-new-project"
                  onPress={() => router.push("/(app)/projects/new")}
                  style={styles.emptyBtn}
                >
                  <Text style={styles.emptyBtnText}>Start Project</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}
    </View>
  );
}

function ProjectRow({
  project,
  onPress,
}: {
  project: Project;
  onPress: () => void;
}) {
  const meta = STATUS_META[project.status];
  const pct =
    project.task_count > 0
      ? Math.round((project.completed_task_count / project.task_count) * 100)
      : 0;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      testID={`project-card-${project.id}`}
      style={styles.card}
    >
      <LinearGradient
        colors={
          project.status === "closed"
            ? ["#0979691a", "#0979690a"]
            : project.status === "closure_proposed"
            ? ["#D4770A1a", "#D4770A0a"]
            : ["#7B181E0f", "#7B181E00"]
        }
        style={styles.cardGrad}
      >
        <View style={styles.cardTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.projectName} numberOfLines={2}>
              {project.name}
            </Text>
            {project.description ? (
              <Text style={styles.projectDesc} numberOfLines={2}>
                {project.description}
              </Text>
            ) : null}
          </View>
          <View
            style={[
              styles.statusPill,
              { borderColor: meta.color, backgroundColor: `${meta.color}18` },
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
            <Text style={[styles.statusText, { color: meta.color }]}>
              {meta.label}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="people" size={13} color={colors.brand.gold} />
            <Text style={styles.metaText}>
              {project.managers.length} mgr · {project.taskers.length} tsk
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="clipboard" size={13} color={colors.brand.gold} />
            <Text style={styles.metaText}>
              {project.completed_task_count}/{project.task_count} done
            </Text>
          </View>
          {project.final_rating != null ? (
            <RatingStars value={project.final_rating} size={12} showValue />
          ) : null}
        </View>

        <View style={styles.progressWrap}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.primary },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  overline: {
    color: colors.brand.gold,
    fontSize: 10.5,
    letterSpacing: 3,
    fontWeight: "700",
    marginBottom: 6,
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    color: colors.brand.maroon,
    letterSpacing: -0.5,
  },
  newBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand.maroon,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.bg.primary,
    overflow: "hidden",
  },
  cardGrad: {
    padding: 16,
  },
  cardTopRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 12,
  },
  projectName: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text.primary,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  projectDesc: {
    fontSize: 12.5,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: "600",
  },
  progressWrap: {
    height: 4,
    backgroundColor: colors.bg.tertiary,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.brand.gold,
    borderRadius: 2,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.brand.maroon,
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: "center",
    paddingHorizontal: 30,
  },
  emptyBtn: {
    marginTop: 16,
    backgroundColor: colors.brand.maroon,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBtnText: {
    color: colors.text.inverse,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
