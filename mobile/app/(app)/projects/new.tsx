import React, { useEffect, useState } from "react";
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
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { api, User } from "@/src/api/client";
import { colors } from "@/src/theme/colors";
import { useToast } from "@/src/ui/toast";

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() || "")
    .join("");
}

export default function NewProject() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [managerIds, setManagerIds] = useState<string[]>([]);
  const [floorManagerIds, setFloorManagerIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<User[]>("/users");
        setUsers(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const managers = users.filter((u) => u.role === "manager" || u.role === "admin");
  const floor_managers = users.filter((u) => u.role === "floor_manager");

  const toggle = (arr: string[], id: string, setter: (v: string[]) => void) => {
    setter(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  };

  const submit = async () => {
    if (!name.trim()) {
      toast.show("Project name is required", "error");
      return;
    }
    setSaving(true);
    try {
      await api.post("/projects", {
        name: name.trim(),
        description: description.trim(),
        manager_ids: managerIds,
        floor_manager_ids: floorManagerIds,
      });
      toast.show("Project created", "success");
      router.back();
    } catch (e: any) {
      toast.show(e?.message || "Failed to create project", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          testID="new-project-back"
          onPress={() => router.back()}
          style={styles.iconBtn}
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={22} color={colors.brand.maroon} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.overline}>NEW INITIATIVE</Text>
          <Text style={styles.title}>Create Project</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator
          color={colors.brand.maroon}
          size="large"
          style={{ marginTop: 60 }}
        />
      ) : (
        <KeyboardAwareScrollView
          bottomOffset={100}
          contentContainerStyle={{ padding: 20, paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
        >
          <Field label="Project Name">
            <TextInput
              testID="project-name-input"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Winter Diwali Preparations 2026"
              placeholderTextColor={colors.text.muted}
              style={styles.input}
            />
          </Field>
          <Field label="Description">
            <TextInput
              testID="project-desc-input"
              value={description}
              onChangeText={setDescription}
              placeholder="What is this initiative about?"
              placeholderTextColor={colors.text.muted}
              multiline
              style={[styles.input, styles.textArea]}
              textAlignVertical="top"
            />
          </Field>
          <Field label={`Managers (${managerIds.length})`}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {managers.length === 0 ? (
                <Text style={styles.muted}>Add managers from Team first.</Text>
              ) : (
                managers.map((m) => {
                  const active = managerIds.includes(m.id);
                  return (
                    <TouchableOpacity
                      key={m.id}
                      testID={`select-manager-${m.id}`}
                      onPress={() => toggle(managerIds, m.id, setManagerIds)}
                      activeOpacity={0.85}
                      style={[
                        styles.personChip,
                        active && styles.personChipActive,
                      ]}
                    >
                      <View
                        style={[
                          styles.avatar,
                          {
                            backgroundColor: active
                              ? colors.brand.gold
                              : colors.brand.navy,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.avatarText,
                            active && { color: colors.brand.maroon },
                          ]}
                        >
                          {initials(m.name)}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.personName,
                          active && { color: colors.text.inverse },
                        ]}
                      >
                        {m.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </Field>
          <Field label={`Floor Managers (${floorManagerIds.length})`}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {floor_managers.length === 0 ? (
                <Text style={styles.muted}>Add floor_managers from Team first.</Text>
              ) : (
                floor_managers.map((t) => {
                  const active = floorManagerIds.includes(t.id);
                  return (
                    <TouchableOpacity
                      key={t.id}
                      testID={`select-floor_manager-${t.id}`}
                      onPress={() => toggle(floorManagerIds, t.id, setFloorManagerIds)}
                      activeOpacity={0.85}
                      style={[
                        styles.personChip,
                        active && styles.personChipActive,
                      ]}
                    >
                      <View
                        style={[
                          styles.avatar,
                          {
                            backgroundColor: active
                              ? colors.brand.gold
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
                          {initials(t.name)}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.personName,
                          active && { color: colors.text.inverse },
                        ]}
                      >
                        {t.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </Field>
        </KeyboardAwareScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          testID="project-submit"
          disabled={saving}
          onPress={submit}
          activeOpacity={0.85}
          style={[styles.submitBtn, saving && { opacity: 0.6 }]}
        >
          {saving ? (
            <ActivityIndicator color={colors.text.inverse} />
          ) : (
            <>
              <Ionicons name="library" size={18} color={colors.text.inverse} />
              <Text style={styles.submitText}>Create Project</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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
  overline: {
    color: colors.brand.gold,
    fontSize: 10, letterSpacing: 2.5, fontWeight: "700",
  },
  title: {
    fontSize: 22, fontWeight: "700",
    color: colors.brand.maroon, letterSpacing: -0.3, marginTop: 2,
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
  textArea: { minHeight: 90 },
  chipsRow: {
    paddingVertical: 4, gap: 8,
    flexDirection: "row", alignItems: "center",
  },
  personChip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1, borderColor: colors.border.subtle,
    flexShrink: 0,
  },
  personChipActive: {
    backgroundColor: colors.brand.maroon,
    borderColor: colors.brand.maroon,
  },
  avatar: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: {
    color: colors.text.inverse,
    fontWeight: "700", fontSize: 10,
  },
  personName: {
    color: colors.text.primary,
    fontWeight: "700", fontSize: 12.5,
  },
  muted: { color: colors.text.muted, fontSize: 13, paddingVertical: 8 },
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
