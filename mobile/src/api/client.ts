import { storage } from "@/src/utils/storage";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = "scindia_token";

async function getToken(): Promise<string | null> {
  return await storage.secureGet(TOKEN_KEY, "");
}

export async function saveToken(token: string) {
  await storage.secureSet(TOKEN_KEY, token);
}

export async function clearToken() {
  await storage.secureRemove(TOKEN_KEY);
}

export type ApiError = { status: number; message: string };

async function request<T>(
  method: string,
  path: string,
  body?: any,
  auth: boolean = true
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const resp = await fetch(`${BACKEND}/api${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (resp.status === 204) return undefined as unknown as T;
  const text = await resp.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!resp.ok) {
    const msg =
      (data && (data.detail || data.message)) ||
      `Request failed (${resp.status})`;
    throw { status: resp.status, message: typeof msg === "string" ? msg : JSON.stringify(msg) } as ApiError;
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: any, auth: boolean = true) =>
    request<T>("POST", path, body, auth),
  put: <T>(path: string, body?: any) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: any) => request<T>("PATCH", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
};

// ------ Types ------
export type Role = "admin" | "manager" | "tasker";
export type Priority = "low" | "medium" | "high" | "urgent";
export type ProjectStatus = "active" | "closure_proposed" | "closed";
export type AssignmentStatus =
  | "pending"
  | "in_progress"
  | "submitted"
  | "rejected"
  | "approved";
export type OverallStatus =
  | "pending"
  | "in_progress"
  | "in_review"
  | "completed";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  avatar?: string | null;
  avg_rating: number;
  ratings_count: number;
  created_at: string;
}

export interface UserRef {
  id: string;
  name: string;
  role: Role;
  avg_rating: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  created_at: string;
}

export interface Attachment {
  id: string;
  name: string;
  mime: string;
  size: number;
  data_uri: string;
}

export interface ReviewRound {
  id: string;
  submitted_at: string;
  photos: string[];
  files: Attachment[];
  note: string;
  decision: "approve" | "reject" | null;
  rating: number | null;
  feedback: string | null;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
}

export interface TaskAssignment {
  id: string;
  assignee_id: string;
  assignee_name: string | null;
  assignee_role: Role | null;
  status: AssignmentStatus;
  rounds: ReviewRound[];
  final_rating: number | null;
  approved_at: string | null;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  category?: string | null;
  project_id?: string | null;
  project_name?: string | null;
  priority: Priority;
  due_date?: string | null;
  is_recurring: boolean;
  recurrence?: string | null;
  assignments: TaskAssignment[];
  created_by: string;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
  overall_status: OverallStatus;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  created_by: string;
  created_by_name?: string | null;
  managers: UserRef[];
  taskers: UserRef[];
  task_count: number;
  completed_task_count: number;
  final_rating?: number | null;
  final_feedback?: string | null;
  closure_proposed_by?: string | null;
  closure_proposed_note?: string | null;
  created_at: string;
  closed_at?: string | null;
}

export interface DashboardStats {
  total_tasks: number;
  active_tasks: number;
  in_review: number;
  completed_tasks: number;
  overdue: number;
  total_projects: number;
  active_projects: number;
  total_taskers: number;
  total_managers: number;
  top_taskers: {
    id: string;
    name: string;
    role: Role;
    avg_rating: number;
    completed: number;
  }[];
}

export interface ProjectStats {
  project: Project;
  tasks_by_status: Record<OverallStatus, number>;
  tasks_by_priority: Record<Priority, number>;
  avg_task_rating: number;
  tasker_leaderboard: {
    id: string;
    name: string;
    avg_rating: number;
    completed: number;
  }[];
}

export interface ActivityLog {
  id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  meta: Record<string, any>;
  created_at: string;
}

export interface UserProfile {
  user: User;
  active_assignments: number;
  completed_assignments: number;
  rejection_count: number;
  recent_reviews: {
    task_id: string;
    task_title: string;
    decision: "approve" | "reject";
    rating: number;
    feedback: string | null;
    reviewed_at: string | null;
  }[];
  logs: ActivityLog[];
}
