import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send, Shuffle, Sparkles, Timer } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { renameThread } from "@/lib/threads";
import { cn } from "@/lib/utils";

const STARTERS = ["80s movies", "World capitals", "Python programming", "Surprise me!"];

const FORMATS = [
  { id: "direct" as const, label: "Direct answers", hint: "Answer in your own words" },
  { id: "mcq" as const, label: "Multiple choice", hint: "Pick A, B, C or D" },
];

const DIFFICULTIES = [
  { id: "easy" as const, label: "Easy", hint: "Warm-up round" },
  { id: "medium" as const, label: "Medium", hint: "Solid challenge" },
  { id: "hard" as const, label: "Hard", hint: "Brutal brain-benders" },
  { id: "mixed" as const, label: "Mixed", hint: "Easy → hard climb" },
];

type Format = "direct" | "mcq";
type Difficulty = "easy" | "medium" | "hard" | "mixed";

const TIMEOUT_TEXT = "[TIME'S UP - no answer given]";
const QUESTION_SECONDS = 30;

function startPrompt(topic: string, format: Format, difficulty: Difficulty) {
  const style =
    format === "mcq"
      ? "with multiple-choice questions (A, B, C, D options)"
      : "with direct questions I answer in my own words";
  const level =
    difficulty === "mixed" ? "a mixed difficulty climb" : `${difficulty} difficulty`;
  return topic === "Surprise me!"
    ? `Surprise me with a topic, ${style}, at ${level}.`
    : `Quiz me on ${topic}, ${style}, at ${level}.`;
}

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
  const [format, setFormat] = useState<Format>("direct");
  const [difficulty, setDifficulty] = useState<Difficulty>("mixed");
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
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

  const submit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      setInput("");
      setSecondsLeft(null);
      if (!titled.current) {
        titled.current = true;
        const title = trimmed.length > 42 ? `${trimmed.slice(0, 42)}…` : trimmed;
        onTitle(title);
        renameThread(threadId, title).catch(() => undefined);
      }
      await sendMessage({ text: trimmed });
    },
    [busy, onTitle, sendMessage, threadId],
  );

  // Countdown: runs while the host's latest message is an unanswered question.
  const last = messages[messages.length - 1];
  const awaitingAnswer =
    !busy && !!last && last.role === "assistant" && messageText(last).includes("?");

  useEffect(() => {
    if (!awaitingAnswer) {
      setSecondsLeft(null);
      return;
    }
    setSecondsLeft(QUESTION_SECONDS);
    const started = Date.now();
    const id = setInterval(() => {
      const left = QUESTION_SECONDS - Math.floor((Date.now() - started) / 1000);
      setSecondsLeft(left > 0 ? left : 0);
      if (left <= 0) {
        clearInterval(id);
        void submit(TIMEOUT_TEXT);
      }
    }, 250);
    return () => clearInterval(id);
  }, [awaitingAnswer, last?.id, submit]);

  function switchTopic() {
    const topic = window.prompt("New topic — what should Quizzo grill you on next?");
    if (topic?.trim()) void submit(`Switch to a brand new topic right now: ${topic.trim()}`);
  }

  const urgent = secondsLeft !== null && secondsLeft <= 10;

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
              Pick a style, a difficulty and a topic — 10 questions, 30 seconds each!
            </p>

            <div className="mt-6 grid grid-cols-2 gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={cn(
                    "rounded-xl border px-4 py-3 text-left transition-colors",
                    format === f.id
                      ? "border-primary bg-secondary"
                      : "border-border bg-card hover:border-primary/60",
                  )}
                >
                  <span
                    className={cn(
                      "block text-sm font-semibold",
                      format === f.id ? "text-primary" : "text-card-foreground",
                    )}
                  >
                    {f.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">{f.hint}</span>
                </button>
              ))}
            </div>

            <p className="mt-6 text-xs uppercase tracking-widest text-muted-foreground">
              Difficulty mix
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDifficulty(d.id)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-center transition-colors",
                    difficulty === d.id
                      ? "border-primary bg-secondary"
                      : "border-border bg-card hover:border-primary/60",
                  )}
                >
                  <span
                    className={cn(
                      "block text-sm font-semibold",
                      difficulty === d.id ? "text-primary" : "text-card-foreground",
                    )}
                  >
                    {d.label}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">{d.hint}</span>
                </button>
              ))}
            </div>

            <p className="mt-6 text-xs uppercase tracking-widest text-muted-foreground">
              Choose a topic
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(startPrompt(s, format, difficulty))}
                  className="rounded-full border border-border bg-card px-4 py-2 text-sm text-card-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => {
          const raw = messageText(message);
          if (!raw) return null;
          const isUser = message.role === "user";
          const text = raw === TIMEOUT_TEXT ? "⏰ Time's up — no answer!" : raw;
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
                    ul: ({ children }) => (
                      <ul className="mb-2 space-y-1 last:mb-0">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="mb-2 space-y-1 last:mb-0">{children}</ol>
                    ),
                    li: ({ children }) => <li>{children}</li>,
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
        <div className="mx-auto max-w-3xl">
          {messages.length > 0 && (
            <div className="mb-2 flex items-center justify-between gap-3">
              {secondsLeft !== null ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
                    urgent
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-border bg-card text-muted-foreground",
                  )}
                >
                  <Timer className="size-3.5" />
                  {secondsLeft}s to answer!
                </span>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={switchTopic}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-card-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
              >
                <Shuffle className="size-3.5" /> New topic
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
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
        </div>
      </form>
    </div>
  );
}
