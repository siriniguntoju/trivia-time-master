import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { AppShell } from "@/components/AppShell";
import { ChatWindow } from "@/components/ChatWindow";
import { useAuthSession } from "@/hooks/useAuthSession";
import { getThread, loadThreadMessages } from "@/lib/threads";

export const Route = createFileRoute("/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "Trivia round | Quizzo AI Game Show Host" },
      {
        name: "description",
        content:
          "Play a live trivia round with Quizzo, your AI game show host, on any topic you pick.",
      },
      { property: "og:title", content: "Trivia round | Quizzo AI Game Show Host" },
      {
        property: "og:description",
        content: "Play a live trivia round with your AI game show host.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { threadId } = useParams({ from: "/chat/$threadId" });
  const { session, loading } = useAuthSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["thread", threadId],
    queryFn: async () => {
      const [thread, messages] = await Promise.all([
        getThread(threadId),
        loadThreadMessages(threadId),
      ]);
      return { thread, messages };
    },
    enabled: !!session,
    staleTime: Infinity,
  });

  return (
    <AppShell activeThreadId={threadId}>
      {isLoading || !data ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Warming up the stage lights…
        </div>
      ) : !data.thread ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          That game doesn't exist anymore.
        </div>
      ) : (
        <ChatWindow
          key={threadId}
          threadId={threadId}
          initialMessages={data.messages}
          onTitle={() => queryClient.invalidateQueries({ queryKey: ["threads"] })}
        />
      )}
    </AppShell>
  );
}
