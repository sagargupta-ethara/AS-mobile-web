import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "@/src/theme/colors";
import type {
  AssignmentStatus,
  OverallStatus,
  Priority,
} from "@/src/api/client";

const ASSIGN_LABEL: Record<AssignmentStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  submitted: "Awaiting Review",
  rejected: "Rejected — Retry",
  approved: "Approved",
};

const ASSIGN_COLOR: Record<AssignmentStatus, string> = {
  pending: "#B38B22",
  in_progress: "#000080",
  submitted: "#D4770A",
  rejected: "#7B181E",
  approved: "#097969",
};

const OVERALL_LABEL: Record<OverallStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  in_review: "In Review",
  completed: "Completed",
};

const OVERALL_COLOR: Record<OverallStatus, string> = {
  pending: "#B38B22",
  in_progress: "#000080",
  in_review: "#D4770A",
  completed: "#097969",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

function PillBase({
  color,
  label,
  size = "md",
  testID,
}: {
  color: string;
  label: string;
  size?: "sm" | "md";
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      style={[
        styles.pill,
        size === "sm" && styles.pillSm,
        { borderColor: color, backgroundColor: `${color}15` },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.pillText, size === "sm" && { fontSize: 10 }, { color }]}>
        {label}
      </Text>
    </View>
  );
}

export function OverallStatusPill({ status }: { status: OverallStatus }) {
  return (
    <PillBase
      color={OVERALL_COLOR[status] || colors.text.muted}
      label={OVERALL_LABEL[status] || status}
      testID={`status-pill-${status}`}
    />
  );
}

export function AssignmentStatusPill({
  status,
  size = "md",
}: {
  status: AssignmentStatus;
  size?: "sm" | "md";
}) {
  return (
    <PillBase
      color={ASSIGN_COLOR[status] || colors.text.muted}
      label={ASSIGN_LABEL[status] || status}
      size={size}
      testID={`assign-pill-${status}`}
    />
  );
}

export function PriorityPill({ priority }: { priority: Priority }) {
  const color = colors.priority[priority] || colors.text.muted;
  return (
    <View style={[styles.pill, { borderColor: color, backgroundColor: `${color}15` }]}>
      <Text style={[styles.pillText, { color, letterSpacing: 1.2 }]}>
        {PRIORITY_LABEL[priority].toUpperCase()}
      </Text>
    </View>
  );
}

export function RatingStars({
  value,
  size = 14,
  showValue = false,
}: {
  value: number;
  size?: number;
  showValue?: boolean;
}) {
  const filled = Math.round(value);
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Text
          key={i}
          style={{
            color: i <= filled ? colors.brand.gold : "rgba(212,175,55,0.30)",
            fontSize: size,
            marginRight: 1,
          }}
        >
          ★
        </Text>
      ))}
      {showValue ? (
        <Text style={styles.starsValue}>
          {value > 0 ? value.toFixed(1) : "—"}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  pillSm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  stars: {
    flexDirection: "row",
    alignItems: "center",
  },
  starsValue: {
    marginLeft: 6,
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: "700",
  },
});
