import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { colors, AUTH_BG } from "@/src/theme/colors";

export default function ChangePasswordScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, refresh } = useAuth();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!currentPw) { setError("Enter your current password."); return; }
    if (newPw.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (newPw !== confirmPw) { setError("Passwords do not match."); return; }
    setSaving(true);
    try {
      await api.post("/auth/change-password", {
        current_password: currentPw,
        new_password: newPw,
      });
      await refresh();
      router.replace("/(app)");
    } catch (e: any) {
      setError(e?.message || "Could not update password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ImageBackground source={AUTH_BG} style={styles.bg} imageStyle={{ opacity: 0.28 }}>
      <LinearGradient
        colors={["rgba(26,18,16,0.55)", "rgba(92,16,21,0.92)", "#1A1210"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 12 }]} testID="change-password-screen">
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="shield-checkmark" size={22} color={colors.brand.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Set your password</Text>
              <Text style={styles.subtitle}>
                Welcome{user?.name ? `, ${user.name}` : ""}. Please replace the default password before continuing.
              </Text>
            </View>
          </View>

          {!!error && (
            <View style={styles.errorBox} testID="change-password-error">
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.label}>Current password</Text>
          <View style={styles.field}>
            <Ionicons name="lock-closed" size={16} color={colors.text.muted} />
            <TextInput
              value={currentPw} onChangeText={setCurrentPw} secureTextEntry
              placeholder="Enter your current password" placeholderTextColor={colors.text.muted}
              style={styles.input} testID="change-password-current"
            />
          </View>

          <Text style={styles.label}>New password</Text>
          <View style={styles.field}>
            <Ionicons name="lock-closed" size={16} color={colors.text.muted} />
            <TextInput
              value={newPw} onChangeText={setNewPw} secureTextEntry autoFocus
              placeholder="At least 8 characters" placeholderTextColor={colors.text.muted}
              style={styles.input} testID="change-password-new"
            />
          </View>

          <Text style={styles.label}>Confirm new password</Text>
          <View style={styles.field}>
            <Ionicons name="lock-closed" size={16} color={colors.text.muted} />
            <TextInput
              value={confirmPw} onChangeText={setConfirmPw} secureTextEntry
              placeholder="Retype to confirm" placeholderTextColor={colors.text.muted}
              style={styles.input} testID="change-password-confirm"
            />
          </View>

          <TouchableOpacity
            style={[styles.submit, { opacity: saving ? 0.7 : 1 }]}
            onPress={submit}
            disabled={saving}
            testID="change-password-submit"
          >
            {saving ? <ActivityIndicator color={colors.text.inverse} /> : <Text style={styles.submitText}>Set new password</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={async () => { await logout(); router.replace("/login"); }}
            testID="change-password-logout"
          >
            <Ionicons name="log-out-outline" size={14} color={colors.text.secondary} />
            <Text style={styles.logoutText}>Log out instead</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg.dark },
  container: { flex: 1, paddingHorizontal: 20, justifyContent: "center" },
  card: {
    borderRadius: 20, borderWidth: 1,
    borderColor: colors.border.medium, backgroundColor: colors.bg.primary,
    padding: 22,
    shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8,
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.brand.maroon, alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.brand.maroon },
  subtitle: { fontSize: 12, color: colors.text.secondary, marginTop: 3, lineHeight: 17 },
  errorBox: {
    padding: 10, borderRadius: 10, backgroundColor: "rgba(123,24,30,0.08)", marginBottom: 12,
  },
  errorText: { color: colors.brand.maroon, fontSize: 13, fontWeight: "600" },
  label: {
    fontSize: 10, fontWeight: "700", letterSpacing: 1.6,
    textTransform: "uppercase", color: colors.text.secondary, marginTop: 8, marginBottom: 5,
  },
  field: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border.subtle,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.bg.secondary,
  },
  input: { flex: 1, fontSize: 15, color: colors.text.primary, paddingVertical: 4 },
  submit: {
    marginTop: 14, height: 48, borderRadius: 12,
    backgroundColor: colors.brand.maroon, alignItems: "center", justifyContent: "center",
  },
  submitText: {
    color: colors.text.inverse, fontSize: 15, fontWeight: "700", letterSpacing: 0.4,
  },
  logoutBtn: {
    marginTop: 10, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border.medium, borderRadius: 12, paddingVertical: 8,
  },
  logoutText: {
    fontSize: 11, letterSpacing: 1, textTransform: "uppercase", fontWeight: "700",
    color: colors.text.secondary,
  },
});
