import type { UIMessage } from "ai";

import { supabase } from "@/integrations/supabase/client";

export type QuizThread = {
  id: string;
  title: string;
  topic: string | null;
  updated_at: string;
};

export async function listThreads(): Promise<QuizThread[]> {
  const { data, error } = await supabase
    .from("quiz_threads")
    .select("id, title, topic, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createThread(userId: string): Promise<QuizThread> {
  const { data, error } = await supabase
    .from("quiz_threads")
    .insert({ user_id: userId, title: "New game" })
    .select("id, title, topic, updated_at")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteThread(id: string) {
  const { error } = await supabase.from("quiz_threads").delete().eq("id", id);
  if (error) throw error;
}

export async function renameThread(id: string, title: string) {
  const { error } = await supabase
    .from("quiz_threads")
    .update({ title: title.slice(0, 60) })
    .eq("id", id);
  if (error) throw error;
}

export async function loadThreadMessages(threadId: string): Promise<UIMessage[]> {
  const { data, error } = await supabase
    .from("quiz_messages")
    .select("id, role, parts, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id as string,
    role: row.role as UIMessage["role"],
    parts: (row.parts ?? []) as UIMessage["parts"],
  }));
}

export async function getThread(id: string): Promise<QuizThread | null> {
  const { data, error } = await supabase
    .from("quiz_threads")
    .select("id, title, topic, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
