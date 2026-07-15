import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/src/theme/colors";

type ToastVariant = "success" | "error" | "info";

interface ToastCtx {
  show: (message: string, variant?: ToastVariant) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string>("");
  const [variant, setVariant] = useState<ToastVariant>("info");
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const show = useCallback(
    (m: string, v: ToastVariant = "info") => {
      setMsg(m);
      setVariant(v);
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.delay(2200),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [opacity]
  );

  const value = useMemo(() => ({ show }), [show]);
  const bg =
    variant === "success"
      ? colors.brand.emerald
      : variant === "error"
      ? colors.brand.maroon
      : colors.brand.navy;

  return (
    <Ctx.Provider value={value}>
      {children}
      <Animated.View
        style={[
          styles.wrap,
          { top: insets.top + 12, opacity, backgroundColor: bg, pointerEvents: "none" },
        ]}
      >
        <Text style={styles.text} testID="toast-message">
          {msg}
        </Text>
      </Animated.View>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    alignSelf: "center",
    left: 16,
    right: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 9999,
  },
  text: {
    color: colors.text.inverse,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});
