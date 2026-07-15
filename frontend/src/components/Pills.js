import React from "react";
import { colors } from "@/theme/colors";

const OVERALL_LABEL = {
  pending: "Pending",
  in_progress: "In Progress",
  in_review: "In Review",
  completed: "Completed",
};
const OVERALL_COLOR = {
  pending: "#B38B22",
  in_progress: "#000080",
  in_review: "#D4770A",
  completed: "#097969",
};
const ASSIGN_LABEL = {
  pending: "Pending",
  in_progress: "In Progress",
  submitted: "Awaiting Review",
  rejected: "Rejected — Retry",
  approved: "Approved",
};
const ASSIGN_COLOR = {
  pending: "#B38B22",
  in_progress: "#000080",
  submitted: "#D4770A",
  rejected: "#7B181E",
  approved: "#097969",
};
const PRIORITY_LABEL = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

function PillBase({ color, label, small, testId }) {
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center gap-1.5 rounded-full border font-bold ${small ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"}`}
      style={{ borderColor: color, backgroundColor: `${color}15`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

export function OverallStatusPill({ status }) {
  return (
    <PillBase
      color={OVERALL_COLOR[status] || colors.text.muted}
      label={OVERALL_LABEL[status] || status}
      testId={`status-pill-${status}`}
    />
  );
}

export function AssignmentStatusPill({ status, small }) {
  return (
    <PillBase
      color={ASSIGN_COLOR[status] || colors.text.muted}
      label={ASSIGN_LABEL[status] || status}
      small={small}
      testId={`assign-pill-${status}`}
    />
  );
}

export function PriorityPill({ priority }) {
  const color = colors.priority[priority] || colors.text.muted;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase"
      style={{ borderColor: color, backgroundColor: `${color}15`, color }}
    >
      {PRIORITY_LABEL[priority] || priority}
    </span>
  );
}

export function RatingStars({ value, size = 14, showValue }) {
  const filled = Math.round(value);
  return (
    <span className="inline-flex items-center">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          style={{
            color: i <= filled ? colors.brand.gold : "rgba(212,175,55,0.30)",
            fontSize: size,
            marginRight: 1,
          }}
        >
          ★
        </span>
      ))}
      {showValue && (
        <span className="ml-1.5 text-[11px] font-bold" style={{ color: colors.text.secondary }}>
          {value > 0 ? value.toFixed(1) : "—"}
        </span>
      )}
    </span>
  );
}
