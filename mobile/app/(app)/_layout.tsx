import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth/AuthContext";
import { colors } from "@/src/theme/colors";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export default function AppLayout() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const isManager = user?.role === "admin" || user?.role === "manager";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand.maroon,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 0.3,
          textTransform: "uppercase",
          marginTop: 2,
        },
        tabBarStyle: {
          backgroundColor: colors.bg.primary,
          borderTopColor: colors.border.subtle,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 4,
        },
        tabBarItemStyle: {
          paddingHorizontal: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Estate",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home" color={color} focused={focused} />
          ),
          tabBarButtonTestID: "tab-dashboard",
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: "Projects",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="library" color={color} focused={focused} />
          ),
          tabBarButtonTestID: "tab-projects",
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: "Tasks",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="clipboard" color={color} focused={focused} />
          ),
          tabBarButtonTestID: "tab-tasks",
        }}
      />
      <Tabs.Screen
        name="staff"
        options={{
          title: "Team",
          href: isManager ? "/staff" : null,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="people" color={color} focused={focused} />
          ),
          tabBarButtonTestID: "tab-team",
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="archive" color={color} focused={focused} />
          ),
          tabBarButtonTestID: "tab-history",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="person" color={color} focused={focused} />
          ),
          tabBarButtonTestID: "tab-profile",
        }}
      />
      <Tabs.Screen name="concierge" options={{ href: null }} />
      <Tabs.Screen name="team" options={{ href: null }} />
      <Tabs.Screen name="reviews" options={{ href: null }} />
    </Tabs>
  );
}

function TabIcon({
  name,
  color,
  focused,
}: {
  name: IconName;
  color: string;
  focused: boolean;
}) {
  return (
    <View style={styles.iconWrap}>
      <Ionicons
        name={focused ? name : (`${name}-outline` as IconName)}
        size={22}
        color={color}
      />
      {focused ? <View style={styles.dot} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 26,
  },
  dot: {
    position: "absolute",
    bottom: -3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.brand.gold,
  },
});
