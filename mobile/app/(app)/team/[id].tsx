import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  ImageBackground,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import { api, UserProfile } from "@/src/api/client";
import { colors, GOLD_PATTERN } from "@/src/theme/colors";
import { RatingStars } from "@/src/ui/pills";
import { useToast } from "@/src/ui/toast";

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() || "")
    .join("");
}

function formatAction(action: string) {
  return action
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

export default function TeamMemberProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const p = await api.get<UserProfile>(`/users/${id}/profile`);
      setProfile(p);
    } catch (e: any) {
      toast.show(e?.message || "Failed to load profile", "error");
    }
  }, [id, toast]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        await load();
        setLoading(false);
      })();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.brand.maroon} size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Profile not found.</Text>
      </View>
    );
  }

  const roleLabel =
    profile.user.role === "admin"
      ? "Administrator"
      : profile.user.role === "manager"
      ? "Household Manager"
      : "Household Floor Manager";

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <ImageBackground
          source={{ uri: GOLD_PATTERN }}
          style={[styles.hero, { paddingTop: insets.top + 12 }]}
          imageStyle={{ opacity: 0.09 }}
        >
          <LinearGradient
            colors={[colors.brand.maroonDeep, colors.brand.maroon]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.headerRow}>
            <TouchableOpacity
              testID="team-back"
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
            <Text style={styles.overline}>MEMBER DOSSIER</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.avatarBig}>
            <Text style={styles.avatarText}>{initials(profile.user.name)}</Text>
          </View>
          <Text style={styles.name} testID="profile-name">
            {profile.user.name}
          </Text>
          <Text style={styles.email}>{profile.user.email}</Text>

          <View style={styles.roleChip}>
            <Ionicons name="ribbon" size={12} color={colors.brand.gold} />
            <Text style={styles.roleText}>{roleLabel}</Text>
          </View>

          {profile.user.ratings_count > 0 ? (
            <View style={styles.ratingBadge}>
              <RatingStars value={profile.user.avg_rating} size={18} showValue />
              <Text style={styles.ratingCount}>
                across {profile.user.ratings_count} tasks
              </Text>
            </View>
          ) : (
            <Text style={styles.noRating}>No completed tasks yet</Text>
          )}
        </ImageBackground>

        <View style={styles.body}>
          <View style={styles.statsRow}>
            <StatTile
              label="Active"
              value={profile.active_assignments}
              accent={colors.brand.navy}
            />
            <StatTile
              label="Completed"
              value={profile.completed_assignments}
              accent={colors.brand.emerald}
            />
            <StatTile
              label="Rejections"
              value={profile.rejection_count}
              accent={colors.brand.maroon}
            />
          </View>

          <SectionHeader label="Recent Reviews" />
          {profile.recent_reviews.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons
                name="star-outline"
                size={30}
                color={colors.brand.gold}
              />
              <Text style={styles.emptyText}>No reviews yet</Text>
            </View>
          ) : (
            profile.recent_reviews.map((r, idx) => (
              <View
                key={idx}
                style={styles.reviewCard}
                testID={`review-row-${idx}`}
              >
                <View style={styles.reviewTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewTask} numberOfLines={1}>
                      {r.task_title}
                    </Text>
                    <View style={styles.reviewMeta}>
                      <View
                        style={[
                          styles.miniPill,
                          {
                            borderColor:
                              r.decision === "approve"
                                ? colors.brand.emerald
                                : colors.brand.maroon,
                            backgroundColor:
                              r.decision === "approve"
                                ? "rgba(9,121,105,0.12)"
                                : "rgba(123,24,30,0.12)",
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 9.5,
                            fontWeight: "700",
                            letterSpacing: 0.5,
                            color:
                              r.decision === "approve"
                                ? colors.brand.emerald
                                : colors.brand.maroon,
                          }}
                        >
                          {r.decision.toUpperCase()}
                        </Text>
                      </View>
                      {r.reviewed_at ? (
                        <Text style={styles.reviewDate}>
                          {new Date(r.reviewed_at).toLocaleDateString(
                            undefined,
                            { day: "numeric", month: "short", year: "numeric" }
                          )}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <RatingStars value={r.rating} size={13} showValue />
                </View>
                {r.feedback ? (
                  <Text style={styles.reviewFeedback}>{r.feedback}</Text>
                ) : null}
              </View>
            ))
          )}

          <SectionHeader label="Activity Log" />
          {profile.logs.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons
                name="time-outline"
                size={28}
                color={colors.brand.gold}
              />
              <Text style={styles.emptyText}>No activity yet</Text>
            </View>
          ) : (
            profile.logs.slice(0, 20).map((l) => (
              <View key={l.id} style={styles.logRow}>
                <View style={styles.logDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.logAction}>
                    {formatAction(l.action)}
                    <Text style={styles.logEntity}> · {l.entity_type}</Text>
                  </Text>
                  <Text style={styles.logDate}>
                    {new Date(l.created_at).toLocaleString(undefined, {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionHeader}>{label.toUpperCase()}</Text>;
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <View style={styles.statTile}>
      <View style={[styles.statBar, { backgroundColor: accent }]} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg.primary,
  },
  errorText: { color: colors.text.secondary },
  hero: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 26,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    width: "100%",
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(253,251,247,0.12)",
  },
  overline: {
    color: colors.brand.gold,
    fontSize: 10.5, letterSpacing: 2.5, fontWeight: "700",
  },
  avatarBig: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: "rgba(212,175,55,0.15)",
    borderWidth: 1.5, borderColor: colors.brand.gold,
    alignItems: "center", justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: {
    color: colors.brand.gold, fontSize: 28, fontWeight: "600",
  },
  name: {
    color: colors.text.inverse,
    fontSize: 22, fontWeight: "700",
    letterSpacing: -0.3,
  },
  email: {
    color: "rgba(253,251,247,0.75)",
    fontSize: 12.5, marginTop: 4, marginBottom: 12,
  },
  roleChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderColor: colors.border.medium,
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,0.15)",
    marginBottom: 10,
  },
  roleText: {
    color: colors.brand.gold,
    fontSize: 11, letterSpacing: 1.4, fontWeight: "700",
  },
  ratingBadge: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginTop: 8,
  },
  ratingCount: {
    color: "rgba(253,251,247,0.85)",
    fontSize: 12, fontWeight: "600",
  },
  noRating: {
    color: "rgba(253,251,247,0.55)",
    fontSize: 12, marginTop: 8,
  },
  body: { padding: 20 },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 4,
  },
  statTile: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    overflow: "hidden",
  },
  statBar: {
    position: "absolute", top: 0, left: 0, bottom: 0, width: 3,
  },
  statValue: {
    fontSize: 22, fontWeight: "700",
    color: colors.brand.maroon,
    marginLeft: 4,
  },
  statLabel: {
    fontSize: 10, letterSpacing: 1.2,
    fontWeight: "700", color: colors.text.secondary,
    textTransform: "uppercase", marginTop: 2,
    marginLeft: 4,
  },
  sectionHeader: {
    fontSize: 11,
    letterSpacing: 2.5,
    fontWeight: "700",
    color: colors.text.secondary,
    marginTop: 24,
    marginBottom: 12,
  },
  reviewCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: 8,
  },
  reviewTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  reviewTask: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.text.primary,
  },
  reviewMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  miniPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  reviewDate: {
    fontSize: 10.5,
    color: colors.text.muted,
    fontWeight: "600",
  },
  reviewFeedback: {
    marginTop: 8,
    fontSize: 12.5,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  empty: {
    alignItems: "center",
    padding: 20,
    gap: 6,
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: 12,
    marginTop: 2,
  },
  logRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  logDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.brand.gold,
    marginTop: 6,
  },
  logAction: {
    fontSize: 13,
    color: colors.text.primary,
    fontWeight: "700",
  },
  logEntity: {
    fontWeight: "500",
    color: colors.text.muted,
  },
  logDate: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
  },
});
