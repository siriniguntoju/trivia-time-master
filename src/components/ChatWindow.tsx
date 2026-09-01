import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { renameThread } from "@/lib/threads";
import { cn } from "@/lib/utils";

const STARTERS = ["80s movies", "World capitals", "Python programming", "Surprise me!"];

function messageText(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

export function ChatWindow({
  threadId,
  initialMessages,
  onTitle,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  onTitle: (title: string) => void;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const titled = useRef(initialMessages.length > 0);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: async ({ messages, body }) => {
          const { data } = await supabase.auth.getSession();
          return {
            headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
            body: { ...body, messages, threadId },
          };
        },
      }),
    [threadId],
  );

  const { messages, sendMessage, status } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (error) => toast.error(error.message || "The host tripped over a cable."),
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy, threadId]);

  async function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    if (!titled.current) {
      titled.current = true;
      const title = trimmed.length > 42 ? `${trimmed.slice(0, 42)}…` : trimmed;
      onTitle(title);
      renameThread(threadId, title).catch(() => undefined);
    }
    await sendMessage({ text: trimmed });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-8">
        {messages.length === 0 && (
          <div className="mx-auto max-w-lg pt-10 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-gold shadow-spotlight">
              <Sparkles className="size-7 text-primary-foreground" />
            </div>
            <h2 className="mt-5 text-4xl text-stage-title">Welcome to Quizzo!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Name your topic and the questions start flying.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="rounded-full border border-border bg-card px-4 py-2 text-sm text-card-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => {
          const text = messageText(message);
          if (!text) return null;
          const isUser = message.role === "user";
          return (
            <div key={message.id} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-panel sm:max-w-[70%]",
                  isUser
                    ? "rounded-br-sm bg-accent text-accent-foreground"
                    : "rounded-bl-sm border border-border bg-card text-card-foreground",
                )}
              >
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    strong: ({ children }) => (
                      <strong className={cn(!isUser && "text-primary")}>{children}</strong>
                    ),
                  }}
                >
                  {text}
                </ReactMarkdown>
              </div>
            </div>
          );
        })}

        {status === "submitted" && (
          <div className="flex justify-start">
            <div className="flex gap-1.5 rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-4">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-2 animate-quizzo-dot rounded-full bg-primary"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(input);
        }}
        className="border-t border-border bg-card/60 px-4 py-4 backdrop-blur sm:px-8"
      >
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            rows={1}
            autoFocus
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit(input);
              }
            }}
            placeholder="Type your answer…"
            className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="flex size-11 items-center justify-center rounded-xl bg-gold text-primary-foreground transition-opacity disabled:opacity-40"
            aria-label="Send answer"
          >
            <Send className="size-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
