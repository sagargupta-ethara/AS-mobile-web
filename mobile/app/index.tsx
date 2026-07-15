// Index just bounces to login/home via the AuthGate in _layout.
import { Redirect } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";

export default function Index(): React.ReactElement | null {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Redirect href={user ? "/home" : "/login"} />;
}
