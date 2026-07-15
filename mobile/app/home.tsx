import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { HOME, LOGOUT } from "@/constants/testIds";
import { apiFetch } from "@/src/api/client";
import { useAuth } from "@/src/contexts/AuthContext";

type EchoResponse = { reply: string };

const ROLE_COLORS: Record<string, string> = {
  admin: "#d4a017",
  manager: "#4f9dde",
  tasker: "#63c58d",
};

export default function HomeScreen(): React.ReactElement {
  const { user, logout } = useAuth();
  const [prompt, setPrompt] = useState<string>("");
  const [reply, setReply] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);

  if (!user) {
    // AuthGate will redirect; render nothing in the meantime
    return <View style={styles.root} />;
  }

  const ask = async (): Promise<void> => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError("Please type a prompt first");
      return;
    }
    setBusy(true);
    setError("");
    setReply("");
    try {
      const res = await apiFetch<EchoResponse>("/api/ai/echo", {
        method: "POST",
        body: { prompt: trimmed },
      });
      setReply(res.reply);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI call failed");
    } finally {
      setBusy(false);
    }
  };

  const roleColor = ROLE_COLORS[user.role] ?? "#8a8a8a";

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>Welcome back,</Text>
          <Text style={styles.userName} testID={HOME.userName}>
            {user.full_name}
          </Text>
          <View style={[styles.badge, { borderColor: roleColor }]} testID={HOME.userRoleBadge}>
            <View style={[styles.badgeDot, { backgroundColor: roleColor }]} />
            <Text style={[styles.badgeText, { color: roleColor }]}>{user.role.toUpperCase()}</Text>
          </View>
        </View>
        <Pressable
          testID={LOGOUT.button}
          onPress={() => {
            void logout();
          }}
          style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.logoutLabel}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>AI Concierge Test</Text>
        <Text style={styles.cardSubtitle}>
          Sends your prompt to GPT-4o via the Emergent LLM key. This proves the auth-gated LLM call
          works end-to-end.
        </Text>

        <TextInput
          testID={HOME.aiPromptInput}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Ask something like: Summarise the roles in this app."
          placeholderTextColor="#5a5a5a"
          style={styles.input}
          multiline
          editable={!busy}
        />

        <Pressable
          testID={HOME.aiAskButton}
          onPress={ask}
          disabled={busy}
          style={({ pressed }) => [styles.askBtn, (pressed || busy) && { opacity: 0.6 }]}
        >
          {busy ? <ActivityIndicator color="#0c0c0c" /> : <Text style={styles.askLabel}>Ask GPT-4o</Text>}
        </Pressable>

        {error ? (
          <View style={styles.errorBox} testID={HOME.aiError}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {reply ? (
          <View style={styles.replyBox}>
            <Text style={styles.replyLabel}>REPLY</Text>
            <Text style={styles.replyText} testID={HOME.aiReply}>
              {reply}
            </Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0c0c0c",
  },
  scroll: {
    padding: 24,
    paddingTop: 60,
    gap: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  hello: {
    color: "#7a7a7a",
    fontSize: 13,
  },
  userName: {
    color: "#f5f5f5",
    fontSize: 26,
    fontWeight: "700",
    marginTop: 2,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 10,
    alignSelf: "flex-start",
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  logoutBtn: {
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  logoutLabel: {
    color: "#d0d0d0",
    fontSize: 13,
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#161616",
    borderColor: "#242424",
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
  },
  cardTitle: {
    color: "#f5f5f5",
    fontSize: 20,
    fontWeight: "700",
  },
  cardSubtitle: {
    color: "#8a8a8a",
    fontSize: 13,
    marginTop: 6,
    marginBottom: 18,
    lineHeight: 18,
  },
  input: {
    backgroundColor: "#0c0c0c",
    borderColor: "#2a2a2a",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    color: "#f5f5f5",
    fontSize: 15,
    minHeight: 90,
    textAlignVertical: "top",
  },
  askBtn: {
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },
  askLabel: {
    color: "#0c0c0c",
    fontSize: 15,
    fontWeight: "700",
  },
  errorBox: {
    marginTop: 14,
    borderColor: "#4a1e1e",
    borderWidth: 1,
    backgroundColor: "#1f0e0e",
    padding: 12,
    borderRadius: 10,
  },
  errorText: {
    color: "#f16a6a",
    fontSize: 13,
  },
  replyBox: {
    marginTop: 16,
    borderColor: "#264a35",
    borderWidth: 1,
    backgroundColor: "#0f1a13",
    padding: 14,
    borderRadius: 10,
  },
  replyLabel: {
    color: "#63c58d",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  replyText: {
    color: "#e6e6e6",
    fontSize: 14,
    lineHeight: 20,
  },
});
