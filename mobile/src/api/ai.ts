import { api } from "@/src/api/client";
import type { Priority } from "@/src/api/client";

export interface ParsedTask {
  title: string;
  description: string;
  category: string | null;
  priority: Priority;
  due_date_iso: string | null;
  is_recurring: boolean;
  recurrence: "daily" | "weekly" | "monthly" | null;
}

export function parseTaskFromText(text: string) {
  return api.post<ParsedTask>("/ai/task-parse", { text });
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export function sendConciergeMessage(sessionId: string | null, message: string) {
  return api.post<{ session_id: string; reply: ChatMessage }>(
    "/ai/chat/send",
    { session_id: sessionId, message }
  );
}

export function getConciergeHistory(sessionId: string) {
  return api.get<ChatMessage[]>(
    `/ai/chat/history?session_id=${encodeURIComponent(sessionId)}`
  );
}

export function clearConciergeHistory(sessionId: string) {
  return api.del(
    `/ai/chat/history?session_id=${encodeURIComponent(sessionId)}`
  );
}
