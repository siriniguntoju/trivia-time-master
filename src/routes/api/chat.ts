import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { TRIVIA_SYSTEM_PROMPT } from "@/lib/trivia-prompt";

type ChatRequestBody = { messages?: unknown; threadId?: unknown };

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return json({ error: "Not signed in" }, 401);

        const { messages, threadId } = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages) || typeof threadId !== "string") {
          return json({ error: "messages and threadId are required" }, 400);
        }

        const supabase = createClient(
          import.meta.env["VITE_SUPABASE_URL"] as string,
          import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string,
          {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { Authorization: `Bearer ${token}` } },
          },
        );

        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        const userId = userData?.user?.id;
        if (userError || !userId) return json({ error: "Not signed in" }, 401);

        const { data: thread } = await supabase
          .from("quiz_threads")
          .select("id")
          .eq("id", threadId)
          .maybeSingle();
        if (!thread) return json({ error: "Game not found" }, 404);

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return json({ error: "AI is not configured" }, 500);

        const uiMessages = messages as UIMessage[];
        const lastMessage = uiMessages[uiMessages.length - 1];

        if (lastMessage && lastMessage.role === "user") {
          const { error: insertError } = await supabase.from("quiz_messages").insert({
            thread_id: threadId,
            user_id: userId,
            role: "user",
            client_message_id: lastMessage.id ?? null,
            parts: lastMessage.parts ?? [],
          });
          if (insertError) console.error("Failed to save player message", insertError);
        }

        const gateway = createLovableAiGatewayProvider(key);

        let result;
        try {
          result = streamText({
            model: gateway("google/gemini-3.7-flash"),
            system: TRIVIA_SYSTEM_PROMPT,
            messages: await convertToModelMessages(uiMessages),
          });
        } catch (error) {
          console.error("AI gateway error", error);
          return json({ error: "The host lost their voice. Try again." }, 502);
        }

        return result.toUIMessageStreamResponse({
          originalMessages: uiMessages,
          onFinish: async ({ responseMessage }) => {
            if (!responseMessage) return;
            const { error } = await supabase.from("quiz_messages").insert({
              thread_id: threadId,
              user_id: userId,
              role: "assistant",
              client_message_id: responseMessage.id ?? null,
              parts: responseMessage.parts ?? [],
            });
            if (error) console.error("Failed to save host message", error);
            await supabase
              .from("quiz_threads")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", threadId);
          },
        });
      },
    },
  },
});
