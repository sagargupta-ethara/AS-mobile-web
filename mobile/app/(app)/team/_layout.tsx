import React from "react";
import { Stack } from "expo-router";

export default function TeamStack() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
