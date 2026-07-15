import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { parseTaskFromText, ParsedTask } from "@/src/api/ai";
import { colors } from "@/src/theme/colors";

interface Props {
  visible: boolean;
  onClose: () => void;
  onApply: (t: ParsedTask) => void;
}

const SUGGESTIONS = [
  "Prepare drawing room for tea with 6 guests at 4pm tomorrow",
  "Weekly polish of the silverware every Saturday morning",
  "Urgent — service the Rolls-Royce before Friday",
  "Fresh flowers in all guest suites by 10am every Monday",
];

export function AiTaskAssistantModal({ visible, onClose, onApply }: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Describe the task first");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const parsed = await parseTaskFromText(trimmed);
      onApply(parsed);
      setText("");
    } catch (e: any) {
      setError(e?.message || "AI could not parse this. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    if (loading) return;
    setText("");
    setError(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.center}
        >
          <View style={styles.card} testID="ai-task-assistant-modal">
            <LinearGradient
              colors={[colors.brand.maroon, colors.brand.maroonDeep]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.header}
            >
              <View style={styles.headerRow}>
                <View style={styles.crest}>
                  <Ionicons
                    name="sparkles"
                    size={18}
                    color={colors.brand.gold}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.overline}>ROYAL CONCIERGE ✦ AI</Text>
                  <Text style={styles.title}>Task Assistant</Text>
                </View>
                <TouchableOpacity
                  testID="ai-modal-close"
                  onPress={close}
                  hitSlop={10}
                  style={styles.closeBtn}
                >
                  <Ionicons name="close" size={20} color={colors.text.inverse} />
                </TouchableOpacity>
              </View>
              <Text style={styles.subtitle}>
                Describe the task in plain English. AI will fill in the form.
              </Text>
            </LinearGradient>

            <View style={styles.body}>
              <TextInput
                testID="ai-task-input"
                value={text}
                onChangeText={(t) => {
                  setText(t);
                  if (error) setError(null);
                }}
                placeholder="e.g. Prepare the master suite for guests arriving from Delhi tomorrow at 6pm — urgent"
                placeholderTextColor={colors.text.muted}
                multiline
                style={styles.input}
                textAlignVertical="top"
              />

              {error ? (
                <Text testID="ai-task-error" style={styles.error}>
                  {error}
                </Text>
              ) : (
                <>
                  <Text style={styles.suggestLabel}>OR TRY ONE OF THESE</Text>
                  {SUGGESTIONS.map((s, i) => (
                    <TouchableOpacity
                      key={i}
                      testID={`ai-suggestion-${i}`}
                      onPress={() => setText(s)}
                      activeOpacity={0.85}
                      style={styles.suggestChip}
                    >
                      <Ionicons
                        name="arrow-forward-circle-outline"
                        size={14}
                        color={colors.brand.gold}
                      />
                      <Text style={styles.suggestText} numberOfLines={2}>
                        {s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              <TouchableOpacity
                testID="ai-generate-button"
                onPress={submit}
                disabled={loading}
                activeOpacity={0.85}
                style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
              >
                {loading ? (
                  <>
                    <ActivityIndicator size="small" color={colors.text.inverse} />
                    <Text style={styles.primaryBtnText}>
                      Consulting concierge…
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons
                      name="sparkles"
                      size={16}
                      color={colors.text.inverse}
                    />
                    <Text style={styles.primaryBtnText}>Generate Task</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.footNote}>
                Powered by GPT‑4o · Fields can be edited before saving.
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(26,18,16,0.65)",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: colors.bg.primary,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border.medium,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 20,
  },
  header: {
    padding: 20,
    paddingBottom: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  crest: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.brand.gold,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(212,175,55,0.15)",
  },
  overline: {
    color: colors.brand.gold,
    fontSize: 9.5,
    letterSpacing: 2.5,
    fontWeight: "700",
    marginBottom: 2,
  },
  title: {
    color: colors.text.inverse,
    fontSize: 19,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(253,251,247,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  subtitle: {
    color: "rgba(253,251,247,0.85)",
    fontSize: 12.5,
    marginTop: 10,
    lineHeight: 18,
  },
  body: {
    padding: 20,
  },
  input: {
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: colors.text.primary,
    minHeight: 100,
    marginBottom: 14,
  },
  error: {
    color: colors.brand.maroon,
    fontSize: 12.5,
    fontWeight: "600",
    marginBottom: 8,
  },
  suggestLabel: {
    fontSize: 10,
    color: colors.text.muted,
    letterSpacing: 2,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 2,
  },
  suggestChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: 10,
    marginBottom: 6,
  },
  suggestText: {
    flex: 1,
    fontSize: 12.5,
    color: colors.text.secondary,
    fontWeight: "500",
  },
  primaryBtn: {
    marginTop: 12,
    backgroundColor: colors.brand.maroon,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: colors.brand.maroon,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnText: {
    color: colors.text.inverse,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  footNote: {
    marginTop: 12,
    fontSize: 10.5,
    color: colors.text.muted,
    textAlign: "center",
    letterSpacing: 0.5,
  },
});
