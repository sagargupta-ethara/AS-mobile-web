import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";

import { api, Task } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { colors } from "@/src/theme/colors";
import { TaskCard } from "@/src/ui/task-card";

type FilterKey =
  | "all"
  | "mine"
  | "pending"
  | "in_progress"
  | "in_review"
  | "completed"
  | "overdue";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "mine", label: "Mine" },
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "in_review", label: "In Review" },
  { key: "completed", label: "Completed" },
  { key: "overdue", label: "Overdue" },
];

export default function TasksList() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<Task[]>("/tasks");
      setTasks(data);
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

  const filtered = useMemo(() => {
    let list = tasks;
    if (filter === "mine" && user) {
      list = list.filter((t) =>
        t.assignments.some((a) => a.assignee_id === user.id)
      );
    } else if (filter === "overdue") {
      const now = Date.now();
      list = list.filter(
        (t) =>
          t.overall_status !== "completed" &&
          t.due_date &&
          new Date(t.due_date).getTime() < now
      );
    } else if (
      filter === "pending" ||
      filter === "in_progress" ||
      filter === "in_review" ||
      filter === "completed"
    ) {
      list = list.filter((t) => t.overall_status === filter);
    }
    return list;
  }, [tasks, filter, user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const isManager = user?.role === "admin" || user?.role === "manager";
  const visibleFilters = user?.role === "tasker"
    ? FILTERS.filter((f) => f.key !== "mine")
    : FILTERS;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.overline}>ESTATE OPERATIONS</Text>
          <Text style={styles.title} testID="tasks-title">
            Tasks
          </Text>
        </View>
        {isManager ? (
          <TouchableOpacity
            testID="tasks-new-button"
            style={styles.newBtn}
            onPress={() => router.push("/(app)/tasks/new")}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={20} color={colors.text.inverse} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.chipsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {visibleFilters.map((f) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                testID={`filter-chip-${f.key}`}
                onPress={() => setFilter(f.key)}
                activeOpacity={0.85}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator
          color={colors.brand.maroon}
          size="large"
          style={{ marginTop: 40 }}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TaskCard task={item} showAssignees={isManager} />
          )}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 90,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand.gold}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty} testID="tasks-empty">
              <Ionicons
                name="clipboard-outline"
                size={44}
                color={colors.brand.gold}
              />
              <Text style={styles.emptyTitle}>No tasks here</Text>
              <Text style={styles.emptySubtitle}>
                {isManager
                  ? "Create a new task or change the filter."
                  : "Nothing in this filter."}
              </Text>
            </View>
          }
        />
      )}
    </View>
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
  chipsWrap: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  chipsRow: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 8,
    alignItems: "center",
  },
  chip: {
    height: 36,
    flexShrink: 0,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: {
    backgroundColor: colors.brand.maroon,
    borderColor: colors.brand.maroon,
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  chipTextActive: {
    color: colors.text.inverse,
    fontWeight: "700",
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
  },
});
