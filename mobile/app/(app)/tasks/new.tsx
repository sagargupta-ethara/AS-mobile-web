import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { api, Category, Priority, Project, User } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { colors } from "@/src/theme/colors";
import { useToast } from "@/src/ui/toast";
import { AiTaskAssistantModal } from "@/src/ui/ai-task-assistant";
import type { ParsedTask } from "@/src/api/ai";
import { DateTimePickerModal } from "@/src/ui/date-time-picker";

const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];
const RECURRENCE = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
] as const;

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() || "")
    .join("");
}

export default function NewTask() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ project_id?: string }>();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [projectId, setProjectId] = useState<string | null>(
    params.project_id || null
  );
  const projectLocked = !!params.project_id;
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrence, setRecurrence] = useState<"daily" | "weekly" | "monthly">(
    "weekly"
  );
  const [showPicker, setShowPicker] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const isManager = user?.role === "manager";

  const applyAiParsed = (p: ParsedTask) => {
    if (p.title) setTitle(p.title);
    if (p.description) setDescription(p.description);
    setCategory(p.category ?? null);
    setPriority(p.priority);
    if (p.due_date_iso) {
      const d = new Date(p.due_date_iso);
      if (!isNaN(d.getTime())) setDueDate(d);
    }
    setIsRecurring(!!p.is_recurring);
    if (p.recurrence) setRecurrence(p.recurrence);
    setAiOpen(false);
    toast.show("Filled from your description ✦", "success");
  };

  const load = useCallback(async () => {
    try {
      const [u, c, p] = await Promise.all([
        api.get<User[]>("/users"),
        api.get<Category[]>("/categories"),
        api.get<Project[]>("/projects"),
      ]);
      setUsers(u);
      setCategories(c);
      setProjects(p.filter((x) => x.status !== "closed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Managers can only assign to taskers; admins to managers OR taskers
  const eligibleAssignees = useMemo(() => {
    if (user?.role === "admin") {
      return users.filter((u) => u.role === "manager" || u.role === "tasker");
    }
    return users.filter((u) => u.role === "tasker");
  }, [users, user]);

  const canSubmit = title.trim().length > 0 && assigneeIds.length > 0;

  const toggleAssignee = (id: string) => {
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const submit = async () => {
    if (!canSubmit) {
      toast.show("Title and at least one assignee are required", "error");
      return;
    }
    setSaving(true);
    try {
      await api.post("/tasks", {
        title: title.trim(),
        description: description.trim(),
        category,
        project_id: projectId,
        assignee_ids: assigneeIds,
        priority,
        due_date: dueDate ? dueDate.toISOString() : null,
        is_recurring: isRecurring,
        recurrence: isRecurring ? recurrence : null,
      });
      toast.show(
        assigneeIds.length > 1
          ? `Task assigned to ${assigneeIds.length} members`
          : "Task assigned",
        "success"
      );
      router.back();
    } catch (e: any) {
      toast.show(e?.message || "Failed to create task", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          testID="new-task-back"
          onPress={() => router.back()}
          style={styles.iconBtn}
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={22} color={colors.brand.maroon} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.overline}>NEW ASSIGNMENT</Text>
          <Text style={styles.title}>Create Task</Text>
        </View>
        <TouchableOpacity
          testID="ai-assistant-open"
          onPress={() => setAiOpen(true)}
          activeOpacity={0.85}
          style={styles.aiBtn}
        >
          <Ionicons name="sparkles" size={16} color={colors.brand.maroon} />
          <Text style={styles.aiBtnText}>AI</Text>
        </TouchableOpacity>
      </View>

      <AiTaskAssistantModal
        visible={aiOpen}
        onClose={() => setAiOpen(false)}
        onApply={applyAiParsed}
      />

      {loading ? (
        <ActivityIndicator
          color={colors.brand.maroon}
          size="large"
          style={{ marginTop: 60 }}
        />
      ) : (
        <KeyboardAwareScrollView
          bottomOffset={100}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20, paddingBottom: 140 }}
        >
          <Field label="Title">
            <TextInput
              testID="task-title-input"
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Prepare drawing room for evening guests"
              placeholderTextColor={colors.text.muted}
              style={styles.input}
            />
          </Field>

          <Field label="Description">
            <TextInput
              testID="task-description-input"
              value={description}
              onChangeText={setDescription}
              placeholder="Add specific instructions or context…"
              placeholderTextColor={colors.text.muted}
              multiline
              style={[styles.input, styles.textArea]}
              textAlignVertical="top"
            />
          </Field>

          <Field label={`Project ${projectId ? "· selected" : "(optional)"}`}>
            {projectLocked ? (
              <View style={styles.lockedProject} testID="project-locked">
                <Ionicons name="library" size={16} color={colors.brand.gold} />
                <Text style={styles.lockedProjectText}>
                  {projects.find((p) => p.id === projectId)?.name ||
                    "This project"}
                </Text>
                <Ionicons name="lock-closed" size={12} color={colors.text.muted} />
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
              >
                <TouchableOpacity
                  testID="project-none"
                  onPress={() => setProjectId(null)}
                  style={[styles.chip, projectId === null && styles.chipActive]}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.chipText,
                      projectId === null && styles.chipTextActive,
                    ]}
                  >
                    Standalone
                  </Text>
                </TouchableOpacity>
                {projects.map((p) => {
                  const active = projectId === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      testID={`project-${p.id}`}
                      onPress={() => setProjectId(p.id)}
                      style={[styles.chip, active && styles.chipActive]}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          active && styles.chipTextActive,
                        ]}
                      >
                        {p.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </Field>

          <Field
            label={`Assign to (${assigneeIds.length})${
              isManager ? " · taskers only" : ""
            }`}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {eligibleAssignees.length === 0 ? (
                <Text style={styles.muted}>No eligible members yet.</Text>
              ) : (
                eligibleAssignees.map((s) => {
                  const active = assigneeIds.includes(s.id);
                  return (
                    <TouchableOpacity
                      key={s.id}
                      testID={`assignee-${s.id}`}
                      onPress={() => toggleAssignee(s.id)}
                      style={[
                        styles.personChip,
                        active && styles.personChipActive,
                      ]}
                      activeOpacity={0.85}
                    >
                      <View
                        style={[
                          styles.avatar,
                          {
                            backgroundColor: active
                              ? colors.brand.gold
                              : s.role === "manager"
                              ? colors.brand.navy
                              : colors.brand.maroon,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.avatarText,
                            active && { color: colors.brand.maroon },
                          ]}
                        >
                          {initials(s.name)}
                        </Text>
                      </View>
                      <View>
                        <Text
                          style={[
                            styles.personName,
                            active && { color: colors.text.inverse },
                          ]}
                        >
                          {s.name}
                        </Text>
                        <Text
                          style={[
                            styles.personRole,
                            active && { color: "rgba(253,251,247,0.75)" },
                          ]}
                        >
                          {s.role.toUpperCase()}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </Field>

          <Field label="Category">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              <TouchableOpacity
                testID="category-none"
                onPress={() => setCategory(null)}
                style={[styles.chip, category === null && styles.chipActive]}
              >
                <Text
                  style={[
                    styles.chipText,
                    category === null && styles.chipTextActive,
                  ]}
                >
                  None
                </Text>
              </TouchableOpacity>
              {categories.map((c) => {
                const active = category === c.name;
                return (
                  <TouchableOpacity
                    key={c.id}
                    testID={`category-${c.id}`}
                    onPress={() => setCategory(c.name)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                      ]}
                    >
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Field>

          <Field label="Priority">
            <View style={styles.priorityRow}>
              {PRIORITIES.map((p) => {
                const active = priority === p;
                return (
                  <TouchableOpacity
                    key={p}
                    testID={`priority-${p}`}
                    onPress={() => setPriority(p)}
                    style={[
                      styles.priorityChip,
                      active && {
                        backgroundColor: colors.priority[p],
                        borderColor: colors.priority[p],
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.priorityText,
                        active && { color: colors.text.inverse },
                      ]}
                    >
                      {p.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>

          <Field label="Due date">
            <TouchableOpacity
              testID="task-due-picker"
              onPress={() => setShowPicker(true)}
              style={styles.input}
              activeOpacity={0.85}
            >
              <View style={styles.rowBetween}>
                <Text
                  style={{
                    color: dueDate ? colors.text.primary : colors.text.muted,
                    fontSize: 15,
                  }}
                >
                  {dueDate
                    ? dueDate.toLocaleString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "No due date set"}
                </Text>
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={colors.text.muted}
                />
              </View>
            </TouchableOpacity>
            {dueDate ? (
              <TouchableOpacity
                testID="clear-due-date"
                onPress={() => setDueDate(null)}
                style={{ alignSelf: "flex-end", marginTop: 6 }}
              >
                <Text style={styles.link}>Clear</Text>
              </TouchableOpacity>
            ) : null}
            <DateTimePickerModal
              visible={showPicker}
              value={dueDate}
              minDate={new Date()}
              onClose={() => setShowPicker(false)}
              onConfirm={(d) => {
                setDueDate(d);
                setShowPicker(false);
              }}
            />
          </Field>

          <View style={styles.recurringCard}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={styles.recurringTitle}>Recurring task</Text>
                <Text style={styles.recurringSubtitle}>
                  Repeat automatically on a schedule
                </Text>
              </View>
              <TouchableOpacity
                testID="toggle-recurring"
                onPress={() => setIsRecurring((v) => !v)}
                style={[
                  styles.switch,
                  isRecurring && { backgroundColor: colors.brand.emerald },
                ]}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.switchKnob,
                    isRecurring && { alignSelf: "flex-end" },
                  ]}
                />
              </TouchableOpacity>
            </View>
            {isRecurring ? (
              <View style={styles.recurringOptions}>
                {RECURRENCE.map((r) => {
                  const active = recurrence === r.key;
                  return (
                    <TouchableOpacity
                      key={r.key}
                      testID={`recurrence-${r.key}`}
                      onPress={() => setRecurrence(r.key)}
                      style={[
                        styles.chipSmall,
                        active && styles.chipSmallActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          active && styles.chipTextActive,
                        ]}
                      >
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
          </View>
        </KeyboardAwareScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          testID="task-submit"
          disabled={!canSubmit || saving}
          onPress={submit}
          activeOpacity={0.85}
          style={[
            styles.submitBtn,
            (!canSubmit || saving) && { opacity: 0.55 },
          ]}
        >
          {saving ? (
            <ActivityIndicator color={colors.text.inverse} />
          ) : (
            <>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={colors.text.inverse}
              />
              <Text style={styles.submitText}>
                {assigneeIds.length > 1
                  ? `Assign to ${assigneeIds.length}`
                  : "Assign Task"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.primary },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    gap: 8,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
  },
  aiBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,0.15)",
    borderWidth: 1,
    borderColor: colors.brand.gold,
  },
  aiBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand.maroon,
    letterSpacing: 1,
  },
  overline: {
    color: colors.brand.gold,
    fontSize: 10, letterSpacing: 2.5, fontWeight: "700",
  },
  title: {
    fontSize: 22, fontWeight: "700",
    color: colors.brand.maroon,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  label: {
    fontSize: 11, color: colors.text.secondary,
    letterSpacing: 2, fontWeight: "700",
    textTransform: "uppercase", marginBottom: 8,
  },
  input: {
    backgroundColor: colors.bg.secondary,
    borderWidth: 1, borderColor: colors.border.subtle,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, color: colors.text.primary,
  },
  textArea: { minHeight: 96 },
  chipsRow: {
    paddingVertical: 4, gap: 8,
    flexDirection: "row", alignItems: "center",
  },
  chip: {
    height: 36, flexShrink: 0, paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1, borderColor: colors.border.subtle,
    alignItems: "center", justifyContent: "center",
  },
  chipActive: {
    backgroundColor: colors.brand.maroon,
    borderColor: colors.brand.maroon,
  },
  chipText: {
    fontSize: 12.5, color: colors.text.secondary,
    fontWeight: "600",
  },
  chipTextActive: {
    color: colors.text.inverse, fontWeight: "700",
  },
  chipSmall: {
    height: 32, paddingHorizontal: 12, borderRadius: 999,
    backgroundColor: colors.bg.primary,
    borderWidth: 1, borderColor: colors.border.subtle,
    alignItems: "center", justifyContent: "center",
  },
  chipSmallActive: {
    backgroundColor: colors.brand.emerald,
    borderColor: colors.brand.emerald,
  },
  personChip: {
    flexDirection: "row", alignItems: "center", gap: 10,
    height: 56, paddingHorizontal: 12, paddingRight: 16,
    borderRadius: 12,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1, borderColor: colors.border.subtle,
    flexShrink: 0,
  },
  lockedProject: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.brand.gold,
    borderRadius: 12,
    backgroundColor: "rgba(212,175,55,0.10)",
  },
  lockedProjectText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: colors.brand.maroon,
  },
  personChipActive: {
    backgroundColor: colors.brand.maroon,
    borderColor: colors.brand.maroon,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: {
    color: colors.text.inverse,
    fontWeight: "700", fontSize: 13,
  },
  personName: {
    color: colors.text.primary,
    fontWeight: "700", fontSize: 13.5,
  },
  personRole: {
    color: colors.text.muted,
    fontSize: 10, letterSpacing: 1, fontWeight: "600",
    marginTop: 2,
  },
  muted: {
    color: colors.text.muted, fontSize: 13, paddingVertical: 12,
  },
  priorityRow: {
    flexDirection: "row", gap: 8, flexWrap: "wrap",
  },
  priorityChip: {
    height: 36, paddingHorizontal: 14, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border.subtle,
    backgroundColor: colors.bg.secondary,
    alignItems: "center", justifyContent: "center",
    flexGrow: 1,
  },
  priorityText: {
    fontSize: 11.5, fontWeight: "700",
    color: colors.text.secondary, letterSpacing: 1,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  link: {
    color: colors.brand.gold, fontSize: 12, fontWeight: "700",
  },
  recurringCard: {
    borderRadius: 14, padding: 16,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1, borderColor: colors.border.subtle,
    marginTop: 6,
  },
  recurringTitle: {
    fontSize: 14, fontWeight: "700", color: colors.text.primary,
  },
  recurringSubtitle: {
    fontSize: 12, color: colors.text.muted, marginTop: 2,
  },
  switch: {
    width: 48, height: 28, borderRadius: 14,
    backgroundColor: colors.bg.tertiary,
    padding: 3, justifyContent: "center",
  },
  switchKnob: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.bg.primary,
  },
  recurringOptions: {
    flexDirection: "row", gap: 8, marginTop: 12,
  },
  footer: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: colors.bg.primary,
    borderTopWidth: 1, borderTopColor: colors.border.subtle,
  },
  submitBtn: {
    backgroundColor: colors.brand.maroon,
    borderRadius: 12, paddingVertical: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  submitText: {
    color: colors.text.inverse, fontSize: 15, fontWeight: "700", letterSpacing: 0.4,
  },
});
