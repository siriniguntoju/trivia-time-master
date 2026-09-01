import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Plus, Trash2, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { createThread, deleteThread, listThreads } from "@/lib/threads";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  activeThreadId,
}: {
  children: ReactNode;
  activeThreadId?: string;
}) {
  const { user } = useAuthSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: threads = [] } = useQuery({
    queryKey: ["threads", user?.id],
    queryFn: listThreads,
    enabled: !!user,
  });

  async function newGame() {
    if (!user) return;
    try {
      const thread = await createThread(user.id);
      await queryClient.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: thread.id } });
    } catch {
      toast.error("Couldn't start a new game.");
    }
  }

  async function removeGame(id: string) {
    try {
      await deleteThread(id);
      await queryClient.invalidateQueries({ queryKey: ["threads"] });
      if (id === activeThreadId) navigate({ to: "/" });
    } catch {
      toast.error("Couldn't delete that game.");
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <Trophy className="size-5 text-primary" />
          <span className="text-2xl text-stage-title">QUIZZO</span>
        </div>

        <div className="px-4">
          <button
            onClick={newGame}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-spotlight"
          >
            <Plus className="size-4" /> New game
          </button>
        </div>

        <nav className="mt-5 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {threads.map((thread) => (
            <div
              key={thread.id}
              className={cn(
                "group flex items-center gap-1 rounded-lg px-2 transition-colors",
                thread.id === activeThreadId
                  ? "bg-sidebar-accent"
                  : "hover:bg-sidebar-accent/60",
              )}
            >
              <Link
                to="/chat/$threadId"
                params={{ threadId: thread.id }}
                className="flex-1 truncate py-2 text-sm text-sidebar-foreground"
              >
                {thread.title}
              </Link>
              <button
                onClick={() => removeGame(thread.id)}
                aria-label={`Delete ${thread.title}`}
                className="opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
          {threads.length === 0 && (
            <p className="px-2 py-3 text-xs text-muted-foreground">No games yet.</p>
          )}
        </nav>

        <div className="border-t border-sidebar-border px-4 py-3">
          <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
            className="mt-2 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
          <span className="text-xl text-stage-title">QUIZZO</span>
          <button
            onClick={newGame}
            className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            New game
          </button>
        </header>
        {children}
      </main>
    </div>
  );
}
