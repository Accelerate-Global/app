"use client";

import {
  AlertCircle,
  Bot,
  Database,
  Loader2,
  RotateCcw,
  Send,
  Square,
  User,
} from "lucide-react";
import { FormEvent, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  PrivateDataChatStage,
  PrivateDataChatStreamEvent,
} from "@/lib/private-data-chat/events";
import { cn } from "@/lib/utils";

type TranscriptMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  facts?: string[];
};

const stageLabels: Record<PrivateDataChatStage, string> = {
  interpreting: "Interpreting your question",
  validating: "Validating the analytical plan",
  querying: "Querying approved data",
  explaining: "Preparing a grounded answer",
};

const exampleQuestions = [
  "How many people groups are in the current primary dataset?",
  "Show total population by country, largest first.",
  "List people IDs and names for people groups in Antarctica.",
] as const;

function parseEventBlock(block: string) {
  const data = block
    .split("\n")
    .find((line) => line.startsWith("data: "))
    ?.slice(6);

  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data) as PrivateDataChatStreamEvent;
  } catch {
    return null;
  }
}

function createTranscriptId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export function PrivateDataChatClient({ available }: { available: boolean }) {
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [input, setInput] = useState("");
  const [stage, setStage] = useState<PrivateDataChatStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const requestMessages = useMemo(
    () => messages.map(({ role, content }) => ({ role, content })),
    [messages],
  );

  function applyStreamEvent(event: PrivateDataChatStreamEvent) {
    if (event.type === "status") {
      setStage(event.stage);
      return;
    }

    if (event.type === "message") {
      setMessages((current) => [
        ...current,
        {
          id: createTranscriptId(),
          role: "assistant",
          content: event.message.content,
          facts: event.message.facts,
        },
      ]);
      setStage(null);
      return;
    }

    if (event.type === "error") {
      setError(event.message);
      setStage(null);
    }
  }

  async function submitQuestion(question: string) {
    const normalized = question.trim();
    if (!normalized || !available || isRunning) {
      return;
    }

    const userMessage: TranscriptMessage = {
      id: createTranscriptId(),
      role: "user",
      content: normalized,
    };
    const nextRequestMessages = [
      ...requestMessages,
      { role: "user" as const, content: normalized },
    ];
    const controller = new AbortController();
    abortRef.current = controller;
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError(null);
    setStage("interpreting");
    setIsRunning(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextRequestMessages }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error || "Private data chat is unavailable.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const event = parseEventBlock(block);
          if (event) {
            applyStreamEvent(event);
          }
        }

        if (done) {
          const finalEvent = parseEventBlock(buffer);
          if (finalEvent) {
            applyStreamEvent(finalEvent);
          }
          break;
        }
      }
    } catch (requestError) {
      if (controller.signal.aborted) {
        setError("The request was cancelled.");
      } else {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Private data chat is unavailable.",
        );
      }
      setStage(null);
    } finally {
      abortRef.current = null;
      setIsRunning(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitQuestion(input);
  }

  function resetConversation() {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
    setError(null);
    setStage(null);
    setIsRunning(false);
  }

  if (!available) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Private data chat is not configured</CardTitle>
          <CardDescription>
            The feature remains disabled until the analytical database and private
            Qwen gateway pass their deployment checks.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card className="min-h-[36rem] overflow-hidden">
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bot className="size-5" aria-hidden="true" />
                Qwen data conversation
              </CardTitle>
              <CardDescription className="mt-2 max-w-2xl">
                Answers use the approved current people-groups projection. Qwen
                cannot change data or execute SQL.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetConversation}
              disabled={messages.length === 0 && !isRunning}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              New chat
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-[28rem] flex-col gap-5 p-5 sm:p-6">
          <div
            className="flex flex-1 flex-col gap-4"
            aria-label="Conversation"
            aria-live="polite"
          >
            {messages.length === 0 ? (
              <div className="my-auto space-y-4 text-center">
                <Database
                  className="mx-auto size-9 text-primary"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-medium">Ask a bounded data question</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Start with a count, population summary, country grouping, or
                    approved engagement field.
                  </p>
                </div>
              </div>
            ) : null}

            {messages.map((message) => (
              <article
                key={message.id}
                className={cn(
                  "max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-6",
                  message.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "mr-auto border bg-muted/40 text-foreground",
                )}
              >
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide opacity-75">
                  {message.role === "user" ? (
                    <User className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Bot className="size-3.5" aria-hidden="true" />
                  )}
                  {message.role === "user" ? "You" : "Qwen"}
                </div>
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.facts && message.facts.length > 0 ? (
                  <ul className="mt-3 list-disc space-y-1 pl-5">
                    {message.facts.map((fact) => (
                      <li key={fact}>{fact}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}

            {stage ? (
              <div className="mr-auto flex items-center gap-2 rounded-full border px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                {stageLabels[stage]}
              </div>
            ) : null}

            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {error}
              </div>
            ) : null}
          </div>

          <form className="space-y-3 border-t pt-5" onSubmit={handleSubmit}>
            <label htmlFor="private-data-chat-question" className="sr-only">
              Question for Qwen
            </label>
            <textarea
              id="private-data-chat-question"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={isRunning}
              rows={3}
              maxLength={4_000}
              className="flex w-full resize-y rounded-xl border bg-background px-3 py-3 text-sm shadow-sm outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="For example: Show total population by country."
            />
            <div className="flex flex-wrap justify-end gap-2">
              {isRunning ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => abortRef.current?.abort()}
                >
                  <Square className="size-4" aria-hidden="true" />
                  Cancel
                </Button>
              ) : null}
              <Button
                type="submit"
                disabled={isRunning || !input.trim()}
              >
                <Send className="size-4" aria-hidden="true" />
                Ask Qwen
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <aside className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Try a supported question</CardTitle>
            <CardDescription>
              These examples stay inside the evaluated pilot catalog.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {exampleQuestions.map((question) => (
              <Button
                key={question}
                type="button"
                variant="outline"
                className="h-auto justify-start whitespace-normal py-3 text-left"
                onClick={() => void submitQuestion(question)}
                disabled={isRunning}
              >
                {question}
              </Button>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pilot boundaries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Read-only approved people-groups data.</p>
            <p>No publication, deletion, export, or account actions.</p>
            <p>Conversation history is cleared when you start a new chat.</p>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
