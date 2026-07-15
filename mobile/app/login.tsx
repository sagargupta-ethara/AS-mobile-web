import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/auth/AuthContext";
import { useToast } from "@/src/ui/toast";
import { colors, AUTH_BG } from "@/src/theme/colors";

const QUICK_ACCOUNTS: {
  key: string;
  label: string;
  hint: string;
  role: string;
  email: string;
  password: string;
  color: string;
}[] = [
  {
    key: "admin",
    label: "Maharaja",
    hint: "Administrator",
    role: "ADMIN",
    email: "admin" + String.fromCharCode(64) + "scindia.royal",
    password: "Royal" + String.fromCharCode(64) + "2026",
    color: "#7B181E",
  },
  {
    key: "manager",
    label: "Manager Rao",
    hint: "Household Manager",
    role: "MANAGER",
    email: "manager" + String.fromCharCode(64) + "scindia.royal",
    password: "test1234",
    color: "#000080",
  },
  {
    key: "tasker",
    label: "Tasker Krishna",
    hint: "Household Tasker",
    role: "TASKER",
    email: "tasker" + String.fromCharCode(64) + "scindia.royal",
    password: "test1234",
    color: "#097969",
  },
];

export default function LoginScreen() {
  const { login } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Responsive scale for small screens (< 360w or < 700h)
  const compact = height < 700 || width < 360;
  const large = width >= 500;
  const brandSize = compact ? 34 : large ? 52 : 44;
  const crestSize = compact ? 60 : large ? 88 : 78;
  const cardPadding = compact ? 18 : 24;
  const cardMaxWidth = large ? 460 : "100%";

  const doLogin = async (em: string, pw: string, label?: string) => {
    if (!em.trim() || !pw.trim()) {
      toast.show("Please enter email and password", "error");
      return;
    }
    setLoading(true);
    try {
      const u = await login(em, pw);
      toast.show(label ? `${label} — welcome!` : `Welcome, ${u.name}`, "success");
      router.replace("/(app)");
    } catch (e: any) {
      toast.show(e?.message || "Login failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = () => doLogin(email, password);
  const onQuickLogin = (em: string, pw: string, label: string) =>
    doLogin(em, pw, label);

  return (
    <ImageBackground
      source={{ uri: AUTH_BG }}
      style={styles.bg}
      resizeMode="cover"
    >
      <LinearGradient
        colors={["rgba(26,18,16,0.55)", "rgba(92,16,21,0.92)", "#1A1210"]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + (compact ? 20 : 40),
            paddingBottom: insets.bottom + 24,
            minHeight: height,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.centerWrap}>
          <View style={[styles.crest, { alignItems: "center" }]}>
            <View
              style={[
                styles.crestOuter,
                {
                  width: crestSize,
                  height: crestSize,
                  borderRadius: crestSize / 2,
                  marginBottom: compact ? 10 : 16,
                },
              ]}
            >
              <View
                style={[
                  styles.crestInner,
                  {
                    width: crestSize * 0.77,
                    height: crestSize * 0.77,
                    borderRadius: (crestSize * 0.77) / 2,
                  },
                ]}
              >
                <Ionicons
                  name="ribbon"
                  size={crestSize * 0.36}
                  color={colors.brand.gold}
                />
              </View>
            </View>
            <Text style={styles.overline} testID="login-overline">
              E S T. 1731
            </Text>
            <Text
              style={[styles.brand, { fontSize: brandSize }]}
              testID="login-brand-title"
            >
              Scindia
            </Text>
            <Text
              style={[
                styles.subtitle,
                { fontSize: compact ? 11.5 : 13 },
              ]}
              testID="login-brand-subtitle"
            >
              Household &amp; Estate Management
            </Text>
          </View>

          <View
            style={[
              styles.card,
              {
                padding: cardPadding,
                maxWidth: cardMaxWidth as any,
                alignSelf: "center",
                width: "100%",
                marginTop: compact ? 20 : 32,
              },
            ]}
          >
            <Text style={styles.cardTitle}>Welcome back</Text>
            <Text style={styles.cardSubtitle}>
              Sign in to continue managing your estate.
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrap}>
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={colors.text.muted}
                  style={styles.leftIcon}
                />
                <TextInput
                  testID="login-email-input"
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="[email protected]"
                  placeholderTextColor={colors.text.muted}
                  value={email}
                  onChangeText={setEmail}
                  onSubmitEditing={onSubmit}
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={colors.text.muted}
                  style={styles.leftIcon}
                />
                <TextInput
                  testID="login-password-input"
                  style={[styles.input, styles.inputWithRightIcon]}
                  secureTextEntry={!showPassword}
                  placeholder="Your password"
                  placeholderTextColor={colors.text.muted}
                  value={password}
                  onChangeText={setPassword}
                  onSubmitEditing={onSubmit}
                  returnKeyType="go"
                />
                <TouchableOpacity
                  testID="login-toggle-password"
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={10}
                  style={styles.rightIconBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showPassword ? "eye-off" : "eye"}
                    size={18}
                    color={colors.brand.maroon}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              testID="login-submit-button"
              style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
              onPress={onSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={colors.text.inverse} />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>Enter Estate</Text>
                  <Ionicons
                    name="arrow-forward"
                    size={18}
                    color={colors.text.inverse}
                  />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.hintRow}>
              <View style={styles.divider} />
              <Text style={styles.hintText}>Quick access · Demo accounts</Text>
              <View style={styles.divider} />
            </View>

            {QUICK_ACCOUNTS.map((q) => (
              <TouchableOpacity
                key={q.key}
                testID={`quick-login-${q.key}`}
                style={styles.quickBtn}
                onPress={() => onQuickLogin(q.email, q.password, q.label)}
                disabled={loading}
                activeOpacity={0.85}
              >
                <View style={[styles.quickIcon, { backgroundColor: q.color }]}>
                  <Ionicons name="ribbon" size={13} color={colors.brand.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.quickTitle}>{q.label}</Text>
                  <Text style={styles.quickSubtitle}>{q.hint}</Text>
                </View>
                <View
                  style={[styles.quickRolePill, { borderColor: q.color }]}
                >
                  <Text style={[styles.quickRoleText, { color: q.color }]}>
                    {q.role}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {!compact ? (
            <Text style={styles.footer}>
              Serving the Scindia household with discretion &amp; precision.
            </Text>
          ) : null}
        </View>
      </KeyboardAwareScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: colors.bg.dark,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  centerWrap: {
    width: "100%",
  },
  crest: {
    alignItems: "center",
    marginBottom: 8,
  },
  crestOuter: {
    borderWidth: 1.5,
    borderColor: colors.brand.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  crestInner: {
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  overline: {
    color: colors.brand.gold,
    fontSize: 11,
    letterSpacing: 5,
    fontWeight: "700",
    marginBottom: 6,
  },
  brand: {
    color: colors.text.inverse,
    fontWeight: "400",
    letterSpacing: 1,
    marginBottom: 4,
    textAlign: "center",
  },
  subtitle: {
    color: "rgba(253,251,247,0.75)",
    letterSpacing: 1.4,
    fontWeight: "500",
    textTransform: "uppercase",
    textAlign: "center",
  },
  card: {
    backgroundColor: colors.bg.primary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border.medium,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  cardTitle: {
    fontSize: 24,
    color: colors.brand.maroon,
    fontWeight: "600",
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 20,
    lineHeight: 19,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    fontSize: 11,
    color: colors.text.secondary,
    letterSpacing: 2,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: 12,
    paddingLeft: 14,
    paddingRight: 4,
    minHeight: 52,
  },
  leftIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text.primary,
  },
  inputWithRightIcon: {
    paddingRight: 40,
  },
  rightIconBtn: {
    position: "absolute",
    right: 4,
    top: 4,
    bottom: 4,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: colors.brand.maroon,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: colors.brand.maroon,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnText: {
    color: colors.text.inverse,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  hintRow: {
    marginTop: 20,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.subtle,
  },
  hintText: {
    fontSize: 10.5,
    color: colors.text.muted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  quickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(212,175,55,0.08)",
    borderWidth: 1,
    borderColor: colors.brand.gold,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  quickIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brand.maroon,
    alignItems: "center",
    justifyContent: "center",
  },
  quickTitle: {
    color: colors.brand.maroon,
    fontSize: 13.5,
    fontWeight: "700",
  },
  quickSubtitle: {
    color: colors.text.muted,
    fontSize: 11,
    marginTop: 2,
  },
  quickRolePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  quickRoleText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  footer: {
    color: "rgba(253,251,247,0.55)",
    fontSize: 11,
    textAlign: "center",
    letterSpacing: 1.4,
    marginTop: 24,
    textTransform: "uppercase",
  },
});
