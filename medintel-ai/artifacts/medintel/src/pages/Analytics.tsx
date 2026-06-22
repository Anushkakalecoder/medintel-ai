import { useGetAnalytics } from "@workspace/api-client-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";

const COLORS = ["hsl(195,100%,45%)", "hsl(170,80%,50%)", "hsl(150,70%,45%)", "hsl(210,80%,60%)"];

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <div className="text-sm font-semibold text-foreground">{title}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function ChartCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded p-5">
      {children}
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: "hsl(220 30% 6%)",
  border: "1px solid hsl(220 20% 15%)",
  borderRadius: "4px",
  color: "hsl(210 20% 90%)",
  fontSize: "12px",
};

export default function Analytics() {
  const { data: analytics, isLoading } = useGetAnalytics();

  if (isLoading) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <div className="text-sm text-muted-foreground">Loading analytics...</div>
      </div>
    );
  }

  const hasData = (analytics?.total_queries ?? 0) > 0;

  const queryData = (analytics?.queries_per_day ?? []).map((d) => ({
    date: d.date.slice(5), // MM-DD
    queries: d.count,
    latency: Math.round(d.avg_latency_ms),
  }));

  const confidenceData = (analytics?.confidence_trend ?? []).map((d) => ({
    date: d.date.slice(5),
    confidence: Math.round(d.avg_confidence * 100),
    latency: Math.round(d.avg_latency_ms),
  }));

  const intentData = (analytics?.intent_distribution ?? []).map((d) => ({
    name: d.intent.charAt(0).toUpperCase() + d.intent.slice(1),
    value: d.count,
  }));

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Pipeline performance and usage metrics</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
        {[
          { label: "Documents", value: analytics?.total_documents ?? 0 },
          { label: "Queries", value: analytics?.total_queries ?? 0 },
          { label: "Avg Latency", value: `${(analytics?.avg_latency_ms ?? 0).toFixed(0)}ms` },
          { label: "Avg Confidence", value: `${((analytics?.avg_confidence ?? 0) * 100).toFixed(0)}%` },
          { label: "Success Rate", value: `${(analytics?.success_rate ?? 0).toFixed(0)}%` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-card border border-border rounded p-4 text-center">
            <div className="text-xl font-bold font-mono text-primary">{value}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
          </div>
        ))}
      </div>

      {!hasData ? (
        <div className="bg-card border border-border rounded p-16 text-center">
          <div className="text-sm text-muted-foreground">No query data yet.</div>
          <div className="text-xs text-muted-foreground mt-1">Charts will appear after you run your first chat query.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Queries per day */}
          <ChartCard>
            <SectionTitle title="Queries per Day" sub="Last 14 days" />
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={queryData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(210 10% 60%)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(210 10% 60%)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="queries" radius={[2, 2, 0, 0]} fill="hsl(195,100%,45%)" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Confidence trend */}
          <ChartCard>
            <SectionTitle title="Confidence Score Trend" sub="Average per day (%)" />
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={confidenceData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(195,100%,45%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(195,100%,45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(210 10% 60%)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(210 10% 60%)" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="confidence"
                  stroke="hsl(195,100%,45%)"
                  strokeWidth={2}
                  fill="url(#confGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Average latency */}
          <ChartCard>
            <SectionTitle title="Average Response Time" sub="Pipeline latency in ms" />
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={queryData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="latGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(170,80%,50%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(170,80%,50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(210 10% 60%)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(210 10% 60%)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="latency"
                  stroke="hsl(170,80%,50%)"
                  strokeWidth={2}
                  fill="url(#latGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Intent distribution */}
          <ChartCard>
            <SectionTitle title="Query Intent Distribution" sub="Classification breakdown" />
            {intentData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={intentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {intentData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend
                    iconSize={8}
                    wrapperStyle={{ fontSize: "11px", color: "hsl(210 10% 60%)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-xs text-muted-foreground">
                No intent data yet
              </div>
            )}
          </ChartCard>
        </div>
      )}
    </div>
  );
}
