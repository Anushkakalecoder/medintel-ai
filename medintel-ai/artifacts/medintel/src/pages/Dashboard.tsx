import { useGetAnalytics, useListQueries, useListDocuments } from "@workspace/api-client-react";
import { FileText, MessageSquare, Clock, CheckCircle2, TrendingUp, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <div
      data-testid={`metric-${label.toLowerCase().replace(/\s/g, "-")}`}
      className="bg-card border border-border rounded p-5 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground uppercase tracking-widest font-medium">{label}</span>
        <div className={cn("p-1.5 rounded", accent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <div className="text-2xl font-bold text-foreground font-mono">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    value >= 0.8
      ? "text-green-400 bg-green-400/10"
      : value >= 0.5
      ? "text-yellow-400 bg-yellow-400/10"
      : "text-red-400 bg-red-400/10";
  return (
    <span className={cn("text-xs font-mono px-1.5 py-0.5 rounded", color)}>
      {pct}%
    </span>
  );
}

function IntentBadge({ intent }: { intent: string }) {
  const colors: Record<string, string> = {
    search: "text-primary bg-primary/10",
    compare: "text-blue-400 bg-blue-400/10",
    summarize: "text-purple-400 bg-purple-400/10",
    compliance: "text-orange-400 bg-orange-400/10",
  };
  return (
    <span className={cn("text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium", colors[intent] ?? "text-muted-foreground bg-muted")}>
      {intent}
    </span>
  );
}

export default function Dashboard() {
  const { data: analytics, isLoading: loadingAnalytics } = useGetAnalytics();
  const { data: queries, isLoading: loadingQueries } = useListQueries();
  const { data: documents } = useListDocuments();

  const readyDocs = documents?.filter((d) => d.status === "ready").length ?? 0;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Multi-Agent Clinical Intelligence Overview
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Documents"
          value={loadingAnalytics ? "—" : (analytics?.total_documents ?? 0)}
          sub={`${readyDocs} ready for queries`}
          icon={FileText}
          accent
        />
        <MetricCard
          label="Total Queries"
          value={loadingAnalytics ? "—" : (analytics?.total_queries ?? 0)}
          sub="across all documents"
          icon={MessageSquare}
        />
        <MetricCard
          label="Avg Latency"
          value={loadingAnalytics ? "—" : `${(analytics?.avg_latency_ms ?? 0).toFixed(0)}ms`}
          sub="pipeline response time"
          icon={Clock}
        />
        <MetricCard
          label="Success Rate"
          value={loadingAnalytics ? "—" : `${(analytics?.success_rate ?? 0).toFixed(0)}%`}
          sub={`avg confidence ${((analytics?.avg_confidence ?? 0) * 100).toFixed(0)}%`}
          icon={CheckCircle2}
          accent
        />
      </div>

      {/* Recent queries */}
      <div className="bg-card border border-border rounded">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Recent Queries</span>
          </div>
          <span className="text-xs text-muted-foreground">{queries?.length ?? 0} total</span>
        </div>

        {loadingQueries ? (
          <div className="p-6 text-sm text-muted-foreground text-center">Loading query history...</div>
        ) : !queries?.length ? (
          <div className="p-12 text-center">
            <TrendingUp className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <div className="text-sm text-muted-foreground">No queries yet.</div>
            <div className="text-xs text-muted-foreground mt-1">Upload documents and start a chat session.</div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {queries.slice(0, 10).map((q) => (
              <div key={q.id} data-testid={`query-row-${q.id}`} className="px-5 py-3 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground truncate">{q.question}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">{q.answer_preview}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <IntentBadge intent={q.intent} />
                  <ConfidenceBadge value={q.confidence} />
                  <span className="text-xs text-muted-foreground font-mono">{q.latency_ms.toFixed(0)}ms</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
