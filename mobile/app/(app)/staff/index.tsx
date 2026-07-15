import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";

import { api, User } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { useToast } from "@/src/ui/toast";
import { colors } from "@/src/theme/colors";

type RoleFilter = "all" | "tasker" | "manager";

const FILTERS: { key: RoleFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "manager", label: "Managers" },
  { key: "tasker", label: "Taskers" },
];

export default function StaffList() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState<RoleFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<User[]>("/users");
      setUsers(data);
    } catch (e: any) {
      toast.show(e?.message || "Failed to load", "error");
    }
  }, [toast]);

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

  const filtered = users.filter((u) => {
    if (u.role === "admin") return false;
    if (filter === "all") return true;
    return u.role === filter;
  });

  const removeUser = async (u: User) => {
    try {
      await api.del(`/users/${u.id}`);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      toast.show(`${u.name} removed`, "success");
    } catch (e: any) {
      toast.show(e?.message || "Failed to remove", "error");
    }
  };

  const canRemove = user?.role === "admin";

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.overline}>HOUSEHOLD DIRECTORY</Text>
          <Text style={styles.title}>Team</Text>
        </View>
        <TouchableOpacity
          testID="staff-new-button"
          style={styles.newBtn}
          onPress={() => router.push("/(app)/staff/new")}
          activeOpacity={0.85}
        >
          <Ionicons name="person-add" size={18} color={colors.text.inverse} />
        </TouchableOpacity>
      </View>

      <View style={styles.chipsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                testID={`staff-filter-${f.key}`}
                onPress={() => setFilter(f.key)}
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
            <TouchableOpacity
              onPress={() => router.push(`/(app)/team/${item.id}`)}
              activeOpacity={0.85}
              style={styles.card}
              testID={`staff-card-${item.id}`}
            >
              <View
                style={[
                  styles.avatar,
                  item.role === "manager" && {
                    backgroundColor: colors.brand.navy,
                  },
                ]}
              >
                <Text style={styles.avatarText}>{initials(item.name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.email} numberOfLines={1}>
                  {item.email}
                </Text>
                <View style={styles.metaRow}>
                  <View
                    style={[
                      styles.roleTag,
                      item.role === "manager" && {
                        backgroundColor: "rgba(0,0,128,0.08)",
                        borderColor: colors.brand.navy,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleTagText,
                        item.role === "manager" && { color: colors.brand.navy },
                      ]}
                    >
                      {item.role.toUpperCase()}
                    </Text>
                  </View>
                  {item.avg_rating > 0 ? (
                    <View style={styles.ratingRow}>
                      <Text style={styles.ratingStar}>★</Text>
                      <Text style={styles.ratingText}>
                        {item.avg_rating.toFixed(1)} ({item.ratings_count})
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              {canRemove || (user?.role === "manager" && item.role === "tasker") ? (
                <TouchableOpacity
                  testID={`staff-remove-${item.id}`}
                  onPress={(e) => {
                    e.stopPropagation();
                    removeUser(item);
                  }}
                  style={styles.removeBtn}
                  hitSlop={10}
                >
                  <Ionicons
                    name="close-circle"
                    size={22}
                    color={colors.brand.maroon}
                  />
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
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
            <View style={styles.empty} testID="staff-empty">
              <Ionicons
                name="people-outline"
                size={44}
                color={colors.brand.gold}
              />
              <Text style={styles.emptyTitle}>No one here yet</Text>
              <Text style={styles.emptySubtitle}>
                Add your first staff member to get started.
              </Text>
              <TouchableOpacity
                testID="empty-add-staff"
                onPress={() => router.push("/(app)/staff/new")}
                style={styles.emptyBtn}
              >
                <Text style={styles.emptyBtnText}>Add Staff</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
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
    shadowColor: colors.brand.maroon,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
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
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.bg.primary,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: 10,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand.maroon,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.text.inverse,
    fontWeight: "700",
    fontSize: 15,
  },
  name: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 2,
  },
  email: {
    fontSize: 12.5,
    color: colors.text.muted,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  roleTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,0.15)",
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  roleTagText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: colors.brand.goldDeep,
    letterSpacing: 1.2,
  },
  phone: {
    fontSize: 11.5,
    color: colors.text.muted,
    fontWeight: "600",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  ratingStar: {
    color: colors.brand.gold,
    fontSize: 13,
  },
  ratingText: {
    color: colors.text.primary,
    fontWeight: "700",
    fontSize: 11,
  },
  removeBtn: {
    padding: 4,
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
