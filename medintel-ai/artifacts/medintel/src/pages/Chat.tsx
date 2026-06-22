import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useChat, useListDocuments, getListQueriesQueryKey, getGetAnalyticsQueryKey } from "@workspace/api-client-react";
import { Send, Bot, User, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{
    document_id: string;
    document_name: string;
    page?: number | null;
    chunk_text: string;
    relevance_score: number;
  }>;
  confidence?: number;
  intent?: string;
  latency_ms?: number;
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const { label, cls } =
    value >= 0.8
      ? { label: "High", cls: "text-green-400 bg-green-400/10 border-green-400/20" }
      : value >= 0.5
      ? { label: "Medium", cls: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" }
      : { label: "Low", cls: "text-red-400 bg-red-400/10 border-red-400/20" };
  return (
    <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase tracking-wider", cls)}>
      {label} · {pct}%
    </span>
  );
}

function SourceCard({ source }: { source: Message["sources"][0] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-muted/40 border border-border rounded p-3 text-xs">
      <div className="flex items-center justify-between mb-1">
        <div className="font-medium text-foreground truncate">{source.document_name}</div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-muted-foreground hover:text-foreground ml-2 shrink-0"
          data-testid="toggle-source"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>
      <div className="text-muted-foreground text-[10px]">
        Score: {(source.relevance_score * 100).toFixed(0)}%
        {source.page != null && ` · Page ${source.page}`}
      </div>
      {expanded && (
        <p className="mt-2 text-muted-foreground leading-relaxed border-t border-border pt-2 whitespace-pre-wrap">
          {source.chunk_text}
        </p>
      )}
    </div>
  );
}

function AssistantMessage({ msg }: { msg: Message }) {
  const [showSources, setShowSources] = useState(false);
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-7 h-7 rounded bg-primary/10 flex items-center justify-center mt-0.5">
        <Bot className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-card border border-border rounded p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
          {msg.content}
        </div>
        {(msg.confidence !== undefined || msg.sources?.length) && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {msg.confidence !== undefined && <ConfidenceBadge value={msg.confidence} />}
            {msg.intent && (
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground border border-border px-1.5 py-0.5 rounded">
                {msg.intent}
              </span>
            )}
            {msg.latency_ms !== undefined && (
              <span className="text-[10px] text-muted-foreground font-mono">{msg.latency_ms.toFixed(0)}ms</span>
            )}
            {msg.sources?.length ? (
              <button
                onClick={() => setShowSources((v) => !v)}
                className="text-[10px] text-primary hover:underline ml-auto"
                data-testid="toggle-sources"
              >
                {showSources ? "Hide" : "Show"} {msg.sources.length} source{msg.sources.length !== 1 ? "s" : ""}
              </button>
            ) : null}
          </div>
        )}
        {showSources && msg.sources?.length && (
          <div className="mt-2 space-y-2">
            {msg.sources.map((s, i) => (
              <SourceCard key={i} source={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Chat() {
  const queryClient = useQueryClient();
  const { data: documents } = useListDocuments();
  const chatMutation = useChat();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const readyDocs = documents?.filter((d) => d.status === "ready") ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatMutation.isPending]);

  const handleSubmit = () => {
    const question = input.trim();
    if (!question || chatMutation.isPending) return;

    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");

    chatMutation.mutate(
      { data: { question } },
      {
        onSuccess: (res) => {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: res.answer,
              sources: res.sources,
              confidence: res.confidence,
              intent: res.intent,
              latency_ms: res.latency_ms,
            },
          ]);
          queryClient.invalidateQueries({ queryKey: getListQueriesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAnalyticsQueryKey() });
        },
        onError: (err: any) => {
          const msg = err?.data?.error ?? err?.message ?? "An error occurred. Please try again.";
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `Error: ${msg}` },
          ]);
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-lg font-bold text-foreground">Clinical Intelligence Chat</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {readyDocs.length
            ? `Querying ${readyDocs.length} document${readyDocs.length !== 1 ? "s" : ""} via hybrid RAG`
            : "Upload documents first to enable queries"}
        </p>
      </div>

      {/* No docs warning */}
      {readyDocs.length === 0 && (
        <div className="mx-6 mt-4 flex items-center gap-2 bg-yellow-400/5 border border-yellow-400/20 rounded px-4 py-3 text-sm text-yellow-400 shrink-0">
          <AlertCircle className="w-4 h-4 shrink-0" />
          No documents indexed yet. Go to Documents to upload clinical PDFs, DOCX, or TXT files.
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="text-center py-16">
            <Bot className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <div className="text-sm text-muted-foreground">Ask a question about your clinical documents</div>
            <div className="text-xs text-muted-foreground mt-1">
              The multi-agent pipeline will retrieve, verify, and cite relevant context
            </div>
          </div>
        )}
        {messages.map((msg, i) =>
          msg.role === "user" ? (
            <div key={i} className="flex gap-3 justify-end">
              <div className="bg-primary text-primary-foreground rounded px-4 py-3 text-sm max-w-xl leading-relaxed">
                {msg.content}
              </div>
              <div className="shrink-0 w-7 h-7 rounded bg-muted flex items-center justify-center mt-0.5">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            </div>
          ) : (
            <AssistantMessage key={i} msg={msg} />
          )
        )}
        {chatMutation.isPending && (
          <div className="flex gap-3">
            <div className="shrink-0 w-7 h-7 rounded bg-primary/10 flex items-center justify-center mt-0.5">
              <Bot className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="bg-card border border-border rounded px-4 py-3 text-sm text-muted-foreground">
              <span className="animate-pulse">Running multi-agent pipeline...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-border shrink-0">
        <div className="flex gap-3 items-end">
          <textarea
            ref={textareaRef}
            data-testid="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your clinical documents... (Enter to send, Shift+Enter for newline)"
            rows={2}
            className="flex-1 resize-none bg-card border border-border rounded px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            data-testid="button-send"
            onClick={handleSubmit}
            disabled={!input.trim() || chatMutation.isPending}
            className="h-10 w-10 rounded bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="text-[10px] text-muted-foreground mt-1.5">
          LangGraph · Query Classification · Hybrid Retrieval · Verification · Citation
        </div>
      </div>
    </div>
  );
}
