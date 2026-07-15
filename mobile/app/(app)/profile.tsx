import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/auth/AuthContext";
import { colors, GOLD_PATTERN } from "@/src/theme/colors";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();

  const onLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const roleLabel =
    user?.role === "admin"
      ? "Administrator"
      : user?.role === "manager"
      ? "Household Manager"
      : "Household Staff";

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      showsVerticalScrollIndicator={false}
    >
      <ImageBackground
        source={{ uri: GOLD_PATTERN }}
        style={[styles.hero, { paddingTop: insets.top + 24 }]}
        imageStyle={{ opacity: 0.09 }}
      >
        <LinearGradient
          colors={[colors.brand.maroonDeep, colors.brand.maroon]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.avatarBig}>
          <Text style={styles.avatarText}>{initials(user?.name || "")}</Text>
        </View>
        <Text style={styles.name} testID="profile-name">
          {user?.name}
        </Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.roleChip}>
          <Ionicons name="ribbon" size={12} color={colors.brand.gold} />
          <Text style={styles.roleText}>{roleLabel}</Text>
        </View>
      </ImageBackground>

      <View style={styles.body}>
        <SectionHeader label="Account" />
        <Row
          icon="mail-outline"
          label="Email"
          value={user?.email || ""}
          testID="profile-email-row"
        />
        {user?.phone ? (
          <Row
            icon="call-outline"
            label="Phone"
            value={user.phone}
            testID="profile-phone-row"
          />
        ) : null}
        <Row
          icon="shield-checkmark-outline"
          label="Role"
          value={roleLabel}
          testID="profile-role-row"
        />

        <SectionHeader label="About" />
        <Row
          icon="business-outline"
          label="Household"
          value="Scindia Royal Estate"
        />
        <Row
          icon="sparkles-outline"
          label="Version"
          value="1.0.0 · Est. 1731"
        />

        <TouchableOpacity
          testID="profile-logout"
          onPress={onLogout}
          activeOpacity={0.85}
          style={styles.logoutBtn}
        >
          <Ionicons
            name="log-out-outline"
            size={18}
            color={colors.brand.maroon}
          />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          Serving the household with discretion &amp; precision.
        </Text>
      </View>
    </ScrollView>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() || "")
    .join("");
}

function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionHeader}>{label.toUpperCase()}</Text>;
}

function Row({
  icon,
  label,
  value,
  testID,
}: {
  icon: any;
  label: string;
  value: string;
  testID?: string;
}) {
  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={16} color={colors.brand.maroon} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  hero: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 32,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
  },
  avatarBig: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "rgba(212,175,55,0.15)",
    borderWidth: 1.5,
    borderColor: colors.brand.gold,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  avatarText: {
    color: colors.brand.gold,
    fontSize: 32,
    fontWeight: "600",
    letterSpacing: 1,
  },
  name: {
    color: colors.text.inverse,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  email: {
    color: "rgba(253,251,247,0.75)",
    fontSize: 13,
    marginBottom: 12,
  },
  roleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border.medium,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,0.15)",
  },
  roleText: {
    color: colors.brand.gold,
    fontSize: 11.5,
    letterSpacing: 1.4,
    fontWeight: "700",
  },
  body: {
    padding: 20,
  },
  sectionHeader: {
    fontSize: 10.5,
    color: colors.text.secondary,
    letterSpacing: 2.5,
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(212,175,55,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    fontSize: 10.5,
    color: colors.text.muted,
    letterSpacing: 1.4,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  rowValue: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: "600",
  },
  logoutBtn: {
    marginTop: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.brand.maroon,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "rgba(123,24,30,0.05)",
  },
  logoutText: {
    color: colors.brand.maroon,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  footer: {
    marginTop: 32,
    textAlign: "center",
    fontSize: 11,
    color: colors.text.muted,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    fontWeight: "600",
  },
});
