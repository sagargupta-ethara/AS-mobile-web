import { Redirect } from "expo-router";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAuth } from "@/src/auth/AuthContext";
import { colors } from "@/src/theme/colors";

export default function Index() {
  const { isAuthed, loading, user } = useAuth();

  if (loading) {
    return (
      <View style={styles.container} testID="splash-loading">
        <ActivityIndicator color={colors.brand.maroon} size="large" />
      </View>
    );
  }

  if (!isAuthed) return <Redirect href="/login" />;
  if (user?.must_change_password) return <Redirect href="/change-password" />;
  return <Redirect href="/(app)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg.primary,
  },
});
