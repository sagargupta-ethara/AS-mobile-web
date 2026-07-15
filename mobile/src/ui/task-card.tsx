import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors } from "@/src/theme/colors";
import {
  OverallStatusPill,
  PriorityPill,
  RatingStars,
} from "@/src/ui/pills";
import type { Task } from "@/src/api/client";

function formatDue(d?: string | null): { text: string; overdue: boolean } {
  if (!d) return { text: "No due date", overdue: false };
  const due = new Date(d);
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

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() || "")
    .join("");
}

export function TaskCard({
  task,
  showAssignees = true,
}: {
  task: Task;
  showAssignees?: boolean;
}) {
  const router = useRouter();
  const due = formatDue(task.due_date);

  // aggregate rating across finalized assignments
  const rated = task.assignments.filter((a) => a.final_rating != null);
  const avg =
    rated.length > 0
      ? rated.reduce((s, a) => s + (a.final_rating || 0), 0) / rated.length
      : 0;

  return (
    <TouchableOpacity
      testID={`task-card-${task.id}`}
      activeOpacity={0.85}
      onPress={() => router.push(`/(app)/tasks/${task.id}`)}
      style={styles.card}
    >
      <View
        style={[
          styles.accent,
          { backgroundColor: colors.priority[task.priority] },
        ]}
      />
      <View style={styles.top}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          {task.project_name ? (
            <Text style={styles.project} numberOfLines={1}>
              {task.project_name}
            </Text>
          ) : task.category ? (
            <Text style={styles.category} numberOfLines={1}>
              {task.category}
            </Text>
          ) : null}
          <Text style={styles.title} numberOfLines={2}>
            {task.title}
          </Text>
        </View>
        <PriorityPill priority={task.priority} />
      </View>

      {task.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {task.description}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <OverallStatusPill status={task.overall_status} />
        <View style={styles.metaRight}>
          {avg > 0 ? <RatingStars value={avg} size={11} /> : null}
          <View style={styles.metaChip}>
            <Ionicons
              name={due.overdue ? "alert-circle" : "time-outline"}
              size={12}
              color={due.overdue ? colors.brand.maroon : colors.text.secondary}
            />
            <Text
              style={[
                styles.metaText,
                due.overdue && { color: colors.brand.maroon, fontWeight: "700" },
              ]}
            >
              {due.text}
            </Text>
          </View>
        </View>
      </View>

      {showAssignees && task.assignments.length > 0 ? (
        <View style={styles.assigneeStrip}>
          <View style={styles.avatarStack}>
            {task.assignments.slice(0, 3).map((a, idx) => (
              <View
                key={a.id}
                style={[
                  styles.miniAvatar,
                  {
                    marginLeft: idx === 0 ? 0 : -8,
                    zIndex: 3 - idx,
                    backgroundColor:
                      a.assignee_role === "manager"
                        ? colors.brand.navy
                        : colors.brand.maroon,
                  },
                ]}
              >
                <Text style={styles.miniAvatarText}>
                  {initials(a.assignee_name || "?")}
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.assigneeText} numberOfLines={1}>
            {task.assignments.length === 1
              ? task.assignments[0].assignee_name
              : `${task.assignments.length} assignees`}
          </Text>
        </View>
      ) : null}

      {task.is_recurring ? (
        <View style={styles.recurring}>
          <Ionicons name="repeat" size={11} color={colors.brand.gold} />
          <Text style={styles.recurringText}>
            {task.recurrence?.toUpperCase()}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.primary,
    borderRadius: 14,
    padding: 16,
    paddingLeft: 20,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    overflow: "hidden",
  },
  accent: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
  },
  top: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 10,
  },
  project: {
    fontSize: 10.5,
    color: colors.brand.gold,
    letterSpacing: 1.5,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  category: {
    fontSize: 10.5,
    color: colors.brand.maroon,
    letterSpacing: 1.5,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  description: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 19,
    marginBottom: 12,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  metaRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  assigneeStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  avatarStack: {
    flexDirection: "row",
  },
  miniAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.bg.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  miniAvatarText: {
    color: colors.text.inverse,
    fontWeight: "700",
    fontSize: 9,
  },
  assigneeText: {
    flex: 1,
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: "600",
  },
  recurring: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(212,175,55,0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recurringText: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.brand.goldDeep,
    letterSpacing: 0.5,
  },
});
