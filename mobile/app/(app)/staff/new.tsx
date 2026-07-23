import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { api, Role } from "@/src/api/client";
import { colors } from "@/src/theme/colors";
import { useAuth } from "@/src/auth/AuthContext";
import { useToast } from "@/src/ui/toast";

export default function NewStaff() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("floor_manager");
  const [saving, setSaving] = useState(false);

  const canCreateManager = user?.role === "admin";
  const ROLE_OPTIONS: { key: Role; label: string; hint: string }[] = [
    {
      key: "floor_manager",
      label: "Floor Manager",
      hint: "Receives and completes tasks",
    },
    ...(canCreateManager
      ? [
          {
            key: "manager" as Role,
            label: "Manager",
            hint: "Can assign tasks to floor_managers, manage projects",
          },
        ]
      : []),
  ];

  const submit = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      toast.show("Name, email and password are required", "error");
      return;
    }
    if (password.length < 6) {
      toast.show("Password must be at least 6 characters", "error");
      return;
    }
    setSaving(true);
    try {
      await api.post("/users", {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
        password,
        role,
      });
      toast.show(`${name} added to household`, "success");
      router.back();
    } catch (e: any) {
      toast.show(e?.message || "Failed to add", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          testID="new-staff-back"
          onPress={() => router.back()}
          style={styles.iconBtn}
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={22} color={colors.brand.maroon} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.overline}>ADD TO HOUSEHOLD</Text>
          <Text style={styles.title}>New Member</Text>
        </View>
      </View>

      <KeyboardAwareScrollView
        bottomOffset={100}
        contentContainerStyle={{
          padding: 20,
          paddingBottom: 140,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Field label="Full Name">
          <TextInput
            testID="staff-name-input"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Ramesh Kumar"
            placeholderTextColor={colors.text.muted}
            style={styles.input}
          />
        </Field>

        <Field label="Email">
          <TextInput
            testID="staff-email-input"
            value={email}
            onChangeText={setEmail}
            placeholder="e.g. ramesh@household"
            placeholderTextColor={colors.text.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />
        </Field>

        <Field label="Phone (optional)">
          <TextInput
            testID="staff-phone-input"
            value={phone}
            onChangeText={setPhone}
            placeholder="+91 …"
            placeholderTextColor={colors.text.muted}
            keyboardType="phone-pad"
            style={styles.input}
          />
        </Field>

        <Field label="Temporary Password">
          <TextInput
            testID="staff-password-input"
            value={password}
            onChangeText={setPassword}
            placeholder="Share with them privately"
            placeholderTextColor={colors.text.muted}
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
          />
        </Field>

        <Field label="Role">
          <View style={styles.roleList}>
            {ROLE_OPTIONS.map((r) => {
              const active = role === r.key;
              return (
                <TouchableOpacity
                  key={r.key}
                  testID={`role-${r.key}`}
                  onPress={() => setRole(r.key)}
                  activeOpacity={0.85}
                  style={[styles.roleCard, active && styles.roleCardActive]}
                >
                  <View style={styles.roleLeft}>
                    <View
                      style={[
                        styles.radio,
                        active && {
                          borderColor: colors.brand.gold,
                          backgroundColor: colors.brand.gold,
                        },
                      ]}
                    >
                      {active ? (
                        <Ionicons
                          name="checkmark"
                          size={12}
                          color={colors.brand.maroon}
                        />
                      ) : null}
                    </View>
                    <View>
                      <Text
                        style={[
                          styles.roleTitle,
                          active && { color: colors.text.inverse },
                        ]}
                      >
                        {r.label}
                      </Text>
                      <Text
                        style={[
                          styles.roleHint,
                          active && { color: "rgba(253,251,247,0.75)" },
                        ]}
                      >
                        {r.hint}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Field>
      </KeyboardAwareScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          testID="staff-submit"
          disabled={saving}
          onPress={submit}
          activeOpacity={0.85}
          style={[styles.submitBtn, saving && { opacity: 0.6 }]}
        >
          {saving ? (
            <ActivityIndicator color={colors.text.inverse} />
          ) : (
            <>
              <Ionicons
                name="person-add"
                size={18}
                color={colors.text.inverse}
              />
              <Text style={styles.submitText}>Add to Household</Text>
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  overline: {
    color: colors.brand.gold,
    fontSize: 10,
    letterSpacing: 2.5,
    fontWeight: "700",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.brand.maroon,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  label: {
    fontSize: 11,
    color: colors.text.secondary,
    letterSpacing: 2,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text.primary,
  },
  roleList: {
    gap: 10,
  },
  roleCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  roleCardActive: {
    backgroundColor: colors.brand.maroon,
    borderColor: colors.brand.maroon,
  },
  roleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border.medium,
    alignItems: "center",
    justifyContent: "center",
  },
  roleTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text.primary,
  },
  roleHint: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.bg.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  submitBtn: {
    backgroundColor: colors.brand.maroon,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitText: {
    color: colors.text.inverse,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
});
