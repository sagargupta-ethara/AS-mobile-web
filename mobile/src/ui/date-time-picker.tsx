import React, { useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Calendar } from "react-native-calendars";

import { colors } from "@/src/theme/colors";

interface Props {
  visible: boolean;
  value: Date | null;
  onClose: () => void;
  onConfirm: (d: Date) => void;
  minDate?: Date;
}

const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
const MINUTES = [0, 15, 30, 45];

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function label12(h: number): string {
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${ampm}`;
}

export function DateTimePickerModal({
  visible,
  value,
  onClose,
  onConfirm,
  minDate,
}: Props) {
  const initial = value || new Date();
  const [dateStr, setDateStr] = useState<string>(toISODate(initial));
  const [hour, setHour] = useState<number>(initial.getHours());
  const [minute, setMinute] = useState<number>(
    MINUTES.reduce((prev, curr) =>
      Math.abs(curr - initial.getMinutes()) < Math.abs(prev - initial.getMinutes())
        ? curr
        : prev
    )
  );

  const marked = useMemo(
    () => ({
      [dateStr]: {
        selected: true,
        selectedColor: colors.brand.maroon,
      },
    }),
    [dateStr]
  );

  const confirm = () => {
    const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
    const out = new Date(y, m - 1, d, hour, minute, 0, 0);
    onConfirm(out);
  };

  const minDateStr = minDate ? toISODate(minDate) : toISODate(new Date());

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card} testID="date-picker-modal">
          <View style={styles.header}>
            <View style={styles.crest}>
              <Ionicons name="calendar" size={16} color={colors.brand.gold} />
            </View>
            <Text style={styles.title}>Select Deadline</Text>
            <TouchableOpacity
              testID="date-picker-close"
              onPress={onClose}
              hitSlop={10}
            >
              <Ionicons name="close" size={20} color={colors.text.muted} />
            </TouchableOpacity>
          </View>

          <Calendar
            testID="calendar-widget"
            current={dateStr}
            minDate={minDateStr}
            onDayPress={(day: { dateString: string }) =>
              setDateStr(day.dateString)
            }
            markedDates={marked}
            theme={{
              backgroundColor: colors.bg.primary,
              calendarBackground: colors.bg.primary,
              textSectionTitleColor: colors.brand.maroon,
              selectedDayBackgroundColor: colors.brand.maroon,
              selectedDayTextColor: colors.text.inverse,
              todayTextColor: colors.brand.gold,
              dayTextColor: colors.text.primary,
              textDisabledColor: colors.text.muted,
              arrowColor: colors.brand.maroon,
              monthTextColor: colors.brand.maroon,
              textMonthFontWeight: "700",
              textDayFontWeight: "600",
              textDayHeaderFontWeight: "700",
              textMonthFontSize: 16,
              textDayFontSize: 13,
              textDayHeaderFontSize: 11,
            }}
            style={styles.calendar}
          />

          <Text style={styles.sectionLabel}>TIME</Text>
          <View style={styles.timeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.miniLabel}>Hour</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {HOURS.map((h) => (
                  <TouchableOpacity
                    key={h}
                    testID={`hour-${h}`}
                    onPress={() => setHour(h)}
                    style={[
                      styles.chip,
                      hour === h && styles.chipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        hour === h && styles.chipTextActive,
                      ]}
                    >
                      {label12(h)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
          <View style={styles.minuteRow}>
            <Text style={styles.miniLabel}>Minute</Text>
            <View style={styles.minuteChips}>
              {MINUTES.map((m) => (
                <TouchableOpacity
                  key={m}
                  testID={`minute-${m}`}
                  onPress={() => setMinute(m)}
                  style={[
                    styles.chip,
                    minute === m && styles.chipActive,
                    { minWidth: 54 },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      minute === m && styles.chipTextActive,
                    ]}
                  >
                    :{String(m).padStart(2, "0")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            testID="date-picker-confirm"
            onPress={confirm}
            activeOpacity={0.85}
            style={styles.confirmBtn}
          >
            <Ionicons
              name="checkmark-circle"
              size={16}
              color={colors.text.inverse}
            />
            <Text style={styles.confirmText}>
              Set for{" "}
              {new Date(dateStr).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
              })}{" "}
              at {label12(hour)} :{String(minute).padStart(2, "0")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(26,18,16,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: colors.bg.primary,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  crest: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.brand.gold,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(212,175,55,0.15)",
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: colors.brand.maroon,
    letterSpacing: -0.2,
  },
  calendar: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
  },
  sectionLabel: {
    fontSize: 10.5,
    letterSpacing: 2,
    fontWeight: "700",
    color: colors.text.secondary,
    marginTop: 8,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  timeRow: {
    flexDirection: "row",
  },
  miniLabel: {
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.text.muted,
    fontWeight: "700",
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  chipRow: {
    gap: 6,
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  minuteRow: {
    marginTop: 10,
  },
  minuteChips: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    paddingHorizontal: 2,
  },
  chip: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
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
  confirmBtn: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brand.maroon,
    paddingVertical: 14,
    borderRadius: 12,
  },
  confirmText: {
    color: colors.text.inverse,
    fontWeight: "700",
    fontSize: 13.5,
    letterSpacing: 0.3,
  },
});
