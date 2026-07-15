import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  ImageBackground,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";

import { api, Priority } from "@/src/api/client";
import { colors, GOLD_PATTERN } from "@/src/theme/colors";
import { PriorityPill } from "@/src/ui/pills";

interface PendingReview {
  task_id: string;
  task_title: string;
  project_name: string | null;
  assignment_id: string;
  assignee_name: string;
  assignee_role: string | null;
  round_index: number;
  submitted_at: string;
  priority: Priority;
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() || "")
    .join("");
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / (1000 * 60 * 60));
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function ReviewQueue() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<PendingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<PendingReview[]>("/reviews/pending");
      setItems(data);
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ImageBackground
        source={{ uri: GOLD_PATTERN }}
        style={[styles.hero, { paddingTop: insets.top + 12 }]}
        imageStyle={{ opacity: 0.08 }}
      >
        <LinearGradient
          colors={[colors.brand.maroonDeep, colors.brand.maroon]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.headerRow}>
          <TouchableOpacity
            testID="review-back"
            onPress={() => router.back()}
            hitSlop={10}
            style={styles.iconBtn}
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color={colors.text.inverse}
            />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.overline}>PENDING · YOUR REVIEW</Text>
            <Text style={styles.title}>Review Queue</Text>
          </View>
          <View style={styles.countPill}>
            <Text style={styles.countText}>{items.length}</Text>
          </View>
        </View>
      </ImageBackground>

      {loading ? (
        <ActivityIndicator
          color={colors.brand.maroon}
          size="large"
          style={{ marginTop: 60 }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 20,
            paddingBottom: insets.bottom + 60,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              tintColor={colors.brand.gold}
            />
          }
        >
          {items.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons
                name="checkmark-done-circle"
                size={48}
                color={colors.brand.emerald}
              />
              <Text style={styles.emptyTitle}>All caught up</Text>
              <Text style={styles.emptySubtitle}>
                No submissions awaiting your review right now.
              </Text>
            </View>
          ) : (
            items.map((r) => (
              <TouchableOpacity
                key={`${r.task_id}-${r.assignment_id}`}
                testID={`review-row-${r.assignment_id}`}
                onPress={() => router.push(`/(app)/tasks/${r.task_id}`)}
                activeOpacity={0.85}
                style={styles.card}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {initials(r.assignee_name)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.name}>{r.assignee_name}</Text>
                    <PriorityPill priority={r.priority} />
                  </View>
                  <Text style={styles.taskTitle} numberOfLines={2}>
                    {r.task_title}
                  </Text>
                  <View style={styles.metaRow}>
                    {r.project_name ? (
                      <View style={styles.chip}>
                        <Ionicons
                          name="library"
                          size={11}
                          color={colors.brand.gold}
                        />
                        <Text style={styles.chipText} numberOfLines={1}>
                          {r.project_name}
                        </Text>
                      </View>
                    ) : null}
                    <View style={styles.chip}>
                      <Ionicons
                        name="repeat"
                        size={11}
                        color={colors.brand.gold}
                      />
                      <Text style={styles.chipText}>
                        Round {r.round_index}
                      </Text>
                    </View>
                    <View style={styles.chip}>
                      <Ionicons
                        name="time"
                        size={11}
                        color={colors.brand.gold}
                      />
                      <Text style={styles.chipText}>
                        {timeAgo(r.submitted_at)}
                      </Text>
                    </View>
                  </View>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.text.muted}
                />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(253,251,247,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  overline: {
    color: colors.brand.gold,
    fontSize: 10,
    letterSpacing: 2.2,
    fontWeight: "700",
  },
  title: {
    color: colors.text.inverse,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginTop: 2,
  },
  countPill: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.brand.gold,
    backgroundColor: "rgba(212,175,55,0.20)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  countText: {
    color: colors.brand.gold,
    fontWeight: "800",
    fontSize: 13,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.bg.primary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand.maroon,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.text.inverse,
    fontWeight: "700",
    fontSize: 13,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  name: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.brand.maroon,
  },
  taskTitle: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 19,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    maxWidth: 180,
  },
  chipText: {
    fontSize: 10.5,
    color: colors.text.secondary,
    fontWeight: "600",
  },
  empty: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.brand.emerald,
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: "center",
  },
});
