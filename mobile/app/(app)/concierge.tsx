import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  ImageBackground,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  KeyboardStickyView,
  KeyboardAwareScrollView,
} from "react-native-keyboard-controller";

import { colors, GOLD_PATTERN } from "@/src/theme/colors";
import {
  ChatMessage,
  clearConciergeHistory,
  getConciergeHistory,
  sendConciergeMessage,
} from "@/src/api/ai";
import { storage } from "@/src/utils/storage";
import { useToast } from "@/src/ui/toast";

const SESSION_KEY = "concierge_session_id";
const STARTERS = [
  "Draft a memo asking the housekeeping team to deep-clean the west wing this week.",
  "Suggest a 6-item checklist for hosting a state dinner tomorrow.",
  "Help me plan the wardrobe rotation for the upcoming Diwali celebrations.",
  "What routine tasks should the chauffeur handle daily?",
];

export default function Concierge() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const load = useCallback(async () => {
    const stored = await storage.getItem<string>(SESSION_KEY, "");
    if (stored) {
      setSessionId(stored);
      try {
        const history = await getConciergeHistory(stored);
        setMessages(history);
      } catch {
        // ignore
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const scrollToBottom = () => {
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 60);
  };

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);

    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      session_id: sessionId || "",
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    scrollToBottom();

    try {
      const resp = await sendConciergeMessage(sessionId, text);
      if (!sessionId) {
        setSessionId(resp.session_id);
        await storage.setItem(SESSION_KEY, resp.session_id);
      }
      setMessages((prev) => [...prev, resp.reply]);
      scrollToBottom();
    } catch (e: any) {
      toast.show(e?.message || "Concierge could not reply", "error");
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  };

  const clearChat = async () => {
    if (!sessionId) {
      setMessages([]);
      return;
    }
    try {
      await clearConciergeHistory(sessionId);
      await storage.removeItem(SESSION_KEY);
      setMessages([]);
      setSessionId(null);
      toast.show("Conversation cleared", "success");
    } catch (e: any) {
      toast.show(e?.message || "Could not clear", "error");
    }
  };

  const showStarters = messages.length === 0 && !loading;

  return (
    <View style={styles.root}>
      <ImageBackground
        source={{ uri: GOLD_PATTERN }}
        imageStyle={{ opacity: 0.08 }}
        style={[styles.header, { paddingTop: insets.top + 14 }]}
      >
        <LinearGradient
          colors={[colors.brand.maroonDeep, colors.brand.maroon]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.headerRow}>
          <TouchableOpacity
            testID="concierge-back"
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
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.overline}>ROYAL CONCIERGE ✦ AI</Text>
            <Text style={styles.title}>Estate Concierge</Text>
          </View>
          <TouchableOpacity
            testID="concierge-clear"
            onPress={clearChat}
            hitSlop={10}
            style={styles.iconBtn}
          >
            <Ionicons
              name="refresh"
              size={20}
              color={colors.text.inverse}
            />
          </TouchableOpacity>
        </View>
      </ImageBackground>

      {loading ? (
        <ActivityIndicator
          color={colors.brand.maroon}
          size="large"
          style={{ marginTop: 60 }}
        />
      ) : (
        <KeyboardAwareScrollView
          ScrollViewComponent={FlatList as any}
          {...({
            ref: listRef,
            data: messages,
            keyExtractor: (m: ChatMessage) => m.id,
            renderItem: ({ item }: { item: ChatMessage }) => (
              <Bubble msg={item} />
            ),
            contentContainerStyle: {
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: 24,
            },
            onContentSizeChange: scrollToBottom,
            showsVerticalScrollIndicator: false,
            ListHeaderComponent: showStarters ? (
              <WelcomeCard onPick={(t) => send(t)} />
            ) : null,
            ListFooterComponent: sending ? <TypingBubble /> : null,
          } as any)}
          bottomOffset={70}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
        <View
          style={[
            styles.inputBar,
            { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 },
          ]}
        >
          <View style={styles.inputWrap}>
            <TextInput
              testID="concierge-input"
              value={input}
              onChangeText={setInput}
              placeholder="Ask the concierge…"
              placeholderTextColor={colors.text.muted}
              style={styles.input}
              multiline
              editable={!sending}
              onSubmitEditing={() => send()}
            />
            <TouchableOpacity
              testID="concierge-send"
              onPress={() => send()}
              disabled={sending || !input.trim()}
              activeOpacity={0.85}
              style={[
                styles.sendBtn,
                (sending || !input.trim()) && { opacity: 0.5 },
              ]}
            >
              {sending ? (
                <ActivityIndicator size="small" color={colors.text.inverse} />
              ) : (
                <Ionicons name="send" size={16} color={colors.text.inverse} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardStickyView>
    </View>
  );
}

function WelcomeCard({ onPick }: { onPick: (t: string) => void }) {
  return (
    <View style={styles.welcome} testID="concierge-welcome">
      <View style={styles.welcomeCrest}>
        <Ionicons name="sparkles" size={24} color={colors.brand.gold} />
      </View>
      <Text style={styles.welcomeTitle}>At your service.</Text>
      <Text style={styles.welcomeSub}>
        I can draft memos, suggest checklists, plan events, or answer questions
        about household operations.
      </Text>
      <Text style={styles.welcomeLabel}>SUGGESTED ENQUIRIES</Text>
      {STARTERS.map((s, i) => (
        <TouchableOpacity
          key={i}
          testID={`concierge-starter-${i}`}
          onPress={() => onPick(s)}
          activeOpacity={0.85}
          style={styles.starterCard}
        >
          <Ionicons
            name="chatbubble-ellipses"
            size={14}
            color={colors.brand.gold}
          />
          <Text style={styles.starterText}>{s}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Bubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <View
      style={[
        styles.bubbleRow,
        { justifyContent: isUser ? "flex-end" : "flex-start" },
      ]}
      testID={`msg-${msg.role}`}
    >
      {!isUser ? (
        <View style={styles.avatar}>
          <Ionicons name="sparkles" size={12} color={colors.brand.gold} />
        </View>
      ) : null}
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
        ]}
      >
        <Text style={isUser ? styles.bubbleTextUser : styles.bubbleText}>
          {msg.content}
        </Text>
      </View>
    </View>
  );
}

function TypingBubble() {
  return (
    <View style={[styles.bubbleRow, { justifyContent: "flex-start" }]}>
      <View style={styles.avatar}>
        <Ionicons name="sparkles" size={12} color={colors.brand.gold} />
      </View>
      <View style={[styles.bubble, styles.bubbleAssistant]}>
        <View style={styles.typingDots}>
          <View style={styles.dot} />
          <View style={[styles.dot, { opacity: 0.6 }]} />
          <View style={[styles.dot, { opacity: 0.35 }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(253,251,247,0.12)",
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
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  welcome: {
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 24,
    paddingBottom: 8,
  },
  welcomeCrest: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: colors.brand.gold,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(212,175,55,0.12)",
    marginBottom: 14,
  },
  welcomeTitle: {
    fontSize: 22,
    color: colors.brand.maroon,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  welcomeSub: {
    fontSize: 13.5,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  welcomeLabel: {
    fontSize: 10.5,
    color: colors.text.muted,
    letterSpacing: 2,
    fontWeight: "700",
    marginBottom: 10,
    alignSelf: "flex-start",
  },
  starterCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  starterText: {
    flex: 1,
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 10,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brand.maroon,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  bubble: {
    maxWidth: "78%",
    padding: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  bubbleUser: {
    backgroundColor: colors.brand.maroon,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    color: colors.text.primary,
    fontSize: 14.5,
    lineHeight: 21,
  },
  bubbleTextUser: {
    color: colors.text.inverse,
    fontSize: 14.5,
    lineHeight: 21,
  },
  typingDots: {
    flexDirection: "row",
    gap: 4,
    paddingVertical: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand.maroon,
  },
  inputBar: {
    backgroundColor: colors.bg.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: 22,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 15,
    maxHeight: 120,
    paddingVertical: 8,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand.maroon,
    alignItems: "center",
    justifyContent: "center",
  },
});
