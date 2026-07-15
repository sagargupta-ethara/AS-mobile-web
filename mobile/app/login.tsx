import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { LOGIN } from "@/constants/testIds";
import { useAuth } from "@/src/contexts/AuthContext";

type DemoAccount = {
  label: string;
  email: string;
  password: string;
  accent: string;
  testId: string;
};

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    label: "Login as Maharaja",
    email: "maharaja@scindia.local",
    password: "Maharaja@123",
    accent: "#d4a017",
    testId: "login-demo-admin",
  },
  {
    label: "Login as Manager",
    email: "manager@scindia.local",
    password: "Manager@123",
    accent: "#4f9dde",
    testId: "login-demo-manager",
  },
  {
    label: "Login as Tasker",
    email: "tasker@scindia.local",
    password: "Tasker@123",
    accent: "#63c58d",
    testId: "login-demo-tasker",
  },
];

export default function LoginScreen(): React.ReactElement {
  const { login } = useAuth();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);

  const submit = async (e?: string, p?: string): Promise<void> => {
    const emailToUse = (e ?? email).trim();
    const passwordToUse = p ?? password;
    if (!emailToUse || !passwordToUse) {
      setError("Email and password are required");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await login(emailToUse, passwordToUse);
      // AuthGate will redirect on user change
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const useDemo = async (acct: DemoAccount): Promise<void> => {
    setEmail(acct.email);
    setPassword(acct.password);
    await submit(acct.email, acct.password);
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>AS-Task</Text>
          <Text style={styles.subtitle}>Sign in to your workspace</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              testID={LOGIN.emailInput}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              placeholder="you@example.com"
              placeholderTextColor="#5a5a5a"
              style={styles.input}
              editable={!busy}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              testID={LOGIN.passwordInput}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor="#5a5a5a"
              style={styles.input}
              editable={!busy}
            />
          </View>

          {error ? (
            <Text style={styles.error} testID="login-error">
              {error}
            </Text>
          ) : null}

          <Pressable
            testID={LOGIN.submitButton}
            onPress={() => submit()}
            disabled={busy}
            style={({ pressed }) => [styles.primaryBtn, (pressed || busy) && styles.btnDim]}
          >
            {busy ? <ActivityIndicator color="#0c0c0c" /> : <Text style={styles.primaryBtnLabel}>Sign in</Text>}
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Or use a demo account</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.demoStack}>
            {DEMO_ACCOUNTS.map((acct) => (
              <Pressable
                key={acct.email}
                testID={acct.testId}
                onPress={() => useDemo(acct)}
                disabled={busy}
                style={({ pressed }) => [
                  styles.demoBtn,
                  { borderColor: acct.accent },
                  (pressed || busy) && styles.btnDim,
                ]}
              >
                <View style={[styles.demoDot, { backgroundColor: acct.accent }]} />
                <Text style={styles.demoLabel}>{acct.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0c0c0c",
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#161616",
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: "#242424",
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    color: "#f5f5f5",
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: "#8a8a8a",
    fontSize: 14,
    marginTop: 4,
    marginBottom: 28,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    color: "#c9c9c9",
    fontSize: 13,
    marginBottom: 8,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#0c0c0c",
    borderColor: "#2a2a2a",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#f5f5f5",
    fontSize: 15,
  },
  error: {
    color: "#f16a6a",
    fontSize: 13,
    marginBottom: 12,
  },
  primaryBtn: {
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  btnDim: {
    opacity: 0.6,
  },
  primaryBtnLabel: {
    color: "#0c0c0c",
    fontWeight: "700",
    fontSize: 15,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#242424",
  },
  dividerText: {
    color: "#7a7a7a",
    fontSize: 12,
    marginHorizontal: 10,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  demoStack: {
    gap: 10,
  },
  demoBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#161616",
  },
  demoDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  demoLabel: {
    color: "#e6e6e6",
    fontSize: 14,
    fontWeight: "600",
  },
});
