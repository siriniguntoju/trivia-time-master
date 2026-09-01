import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Sparkles } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { useAuthSession } from "@/hooks/useAuthSession";
import { createThread, listThreads } from "@/lib/threads";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Quizzo — AI Trivia Game Show Host" },
      {
        name: "description",
        content:
          "Pick any topic and Quizzo, your energetic AI game show host, fires off trivia questions and keeps score round after round.",
      },
      { property: "og:title", content: "Quizzo — AI Trivia Game Show Host" },
      {
        property: "og:description",
        content: "Pick a topic, answer trivia, and keep score with your AI game show host.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { session, user, loading } = useAuthSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  const { data: threads } = useQuery({
    queryKey: ["threads", user?.id],
    queryFn: listThreads,
    enabled: !!user,
  });

  useEffect(() => {
    if (!user || !threads) return;
    const first = threads[0];
    if (first) {
      navigate({ to: "/chat/$threadId", params: { threadId: first.id } });
      return;
    }
    createThread(user.id)
      .then((thread) =>
        navigate({ to: "/chat/$threadId", params: { threadId: thread.id } }),
      )
      .catch(() => undefined);
  }, [user, threads, navigate]);

  return (
    <AppShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <Sparkles className="size-8 text-primary" />
        <h1 className="text-4xl text-stage-title">QUIZZO</h1>
        <p className="text-sm text-muted-foreground">Rolling out the red carpet…</p>
      </div>
    </AppShell>
  );
}
