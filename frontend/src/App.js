import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";

import { AuthProvider, useAuth } from "@/auth/AuthContext";
import AppLayout from "@/components/AppLayout";

import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import TasksPage from "@/pages/TasksPage";
import TaskDetailPage from "@/pages/TaskDetailPage";
import NewTaskPage from "@/pages/NewTaskPage";
import ProjectsPage from "@/pages/ProjectsPage";
import ProjectDetailPage from "@/pages/ProjectDetailPage";
import NewProjectPage from "@/pages/NewProjectPage";
import StaffPage from "@/pages/StaffPage";
import NewStaffPage from "@/pages/NewStaffPage";
import ProfilePage from "@/pages/ProfilePage";
import HistoryPage from "@/pages/HistoryPage";
import ConciergePage from "@/pages/ConciergePage";
import ReviewsPage from "@/pages/ReviewsPage";
import TeamMemberPage from "@/pages/TeamMemberPage";

function AuthGate() {
  const { isAuthed, loading } = useAuth();

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        data-testid="splash-loading"
        style={{ backgroundColor: "#FDFBF7" }}
      >
        <span
          className="animate-spin w-10 h-10 border-4 rounded-full"
          style={{ borderColor: "#7B181E", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  if (!isAuthed) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function GuestOnly() {
  const { isAuthed, loading } = useAuth();
  if (loading) return null;
  if (isAuthed) return <Navigate to="/" replace />;
  return <Outlet />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Guest routes */}
          <Route element={<GuestOnly />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          {/* Protected routes with layout */}
          <Route element={<AuthGate />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="tasks/new" element={<NewTaskPage />} />
              <Route path="tasks/:id" element={<TaskDetailPage />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="projects/new" element={<NewProjectPage />} />
              <Route path="projects/:id" element={<ProjectDetailPage />} />
              <Route path="staff" element={<StaffPage />} />
              <Route path="staff/new" element={<NewStaffPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="reviews" element={<ReviewsPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="team/:id" element={<TeamMemberPage />} />
            </Route>
            {/* Concierge uses full screen without sidebar */}
            <Route path="concierge" element={<ConciergePage />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
