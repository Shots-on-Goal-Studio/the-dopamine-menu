import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getUsageStats, getHourlyVisits, getUsersLastVisit } from "@/lib/analytics.functions";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";

export const Route = createFileRoute("/_authenticated/admin/usage")({
  head: () => ({ meta: [{ title: "Usage — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminUsagePage,
});

const CAT_COLORS: Record<string, string> = {
  quick: "#08D9D6",
  medium: "#FFCB47",
  big: "#FF2E63",
};

function AdminUsagePage() {
  const { isAdmin, isLoading: roleLoading } = useIsAdmin();
  const [days, setDays] = useState(30);
  const fetchStats = useServerFn(getUsageStats);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-usage", days],
    queryFn: () => fetchStats({ data: { days } }),
    enabled: isAdmin,
  });

  const pieData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.categories).map(([name, value]) => ({ name, value }));
  }, [data]);

  if (roleLoading) {
    return <div className="mx-auto max-w-[1100px] px-5 pt-10 opacity-60">Checking access…</div>;
  }
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-[1100px] px-5 pt-10">
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32 }}>Not authorized</h1>
        <p className="mt-2 opacity-70">You don't have access to this page.</p>
        <Link to="/menu" className="text-xs uppercase underline mt-4 inline-block" style={{ letterSpacing: "0.16em" }}>
          ← Back to menu
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] px-5 pt-6 pb-20" style={{ fontFamily: "var(--font-body)" }}>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
        <div>
          <div className="text-[11px] uppercase mb-2" style={{ letterSpacing: "0.4em", color: "var(--pink)" }}>
            — Admin —
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 44, lineHeight: 1, textShadow: "4px 4px 0 var(--yellow)" }}>
            Usage
          </h1>
        </div>
        <Link to="/menu" className="text-xs uppercase underline" style={{ letterSpacing: "0.16em" }}>
          ← Back to menu
        </Link>
      </div>

      <div className="flex gap-2 mb-8">
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className="px-4 py-2 text-xs uppercase"
            style={{
              letterSpacing: "0.16em",
              border: "2px solid var(--ink)",
              background: days === d ? "var(--ink)" : "transparent",
              color: days === d ? "var(--yellow)" : "var(--ink)",
            }}
          >
            {d}d
          </button>
        ))}
      </div>

      {isLoading && <p className="opacity-60">Loading…</p>}
      {error && <p style={{ color: "var(--pink)" }}>Error: {(error as Error).message}</p>}

      {data && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            <Kpi label="Total users" value={data.kpis.totalUsers} />
            <Kpi label="DAU today (UTC)" value={data.kpis.dauToday} />
            <Kpi label="WAU (7d)" value={data.kpis.wau} />
            <Kpi label={`Hits logged (${data.rangeDays}d)`} value={data.kpis.totalHits} />
          </div>

          {/* Daily activity chart */}
          <Card title="Daily activity">
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={data.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,26,46,0.1)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ border: "2px solid #1A1A2E", borderRadius: 0, background: "#FFF4E0" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="activeUsers" name="Active users (logged hit)" fill="#FF2E63" />
                  <Bar dataKey="rollers" name="Rollers (clicked dice)" fill="#08D9D6" />
                  <Bar dataKey="hits" name="Total hits" fill="#FFCB47" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Funnel */}
          <Card title="Engagement funnel">
            <div className="grid grid-cols-3 gap-4 text-center">
              <FunnelStep label="Rolls" value={data.funnel.rolls} />
              <FunnelStep
                label="Item clicks"
                value={data.funnel.itemClicks}
                rate={data.funnel.rolls > 0 ? data.funnel.itemClicks / data.funnel.rolls : null}
              />
              <FunnelStep
                label="Hits logged"
                value={data.funnel.hits}
                rate={data.funnel.rolls > 0 ? data.funnel.hits / data.funnel.rolls : null}
              />
            </div>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Top items */}
            <Card title={`Top items (${data.rangeDays}d)`}>
              {data.topItems.length === 0 ? (
                <p className="opacity-60 text-sm">No hits logged yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left" style={{ borderBottom: "2px solid var(--ink)" }}>
                      <th className="py-2">Item</th>
                      <th>Cat</th>
                      <th>Custom</th>
                      <th className="text-right">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topItems.map((it, i) => (
                      <tr key={i} style={{ borderBottom: "1px dashed rgba(26,26,46,0.15)" }}>
                        <td className="py-1.5 pr-2">{it.name}</td>
                        <td>
                          <span
                            className="inline-block px-1.5 text-[10px] uppercase"
                            style={{ background: CAT_COLORS[it.category], letterSpacing: "0.12em" }}
                          >
                            {it.category}
                          </span>
                        </td>
                        <td className="text-xs opacity-70">{it.isCustom ? "yes" : "—"}</td>
                        <td className="text-right font-bold">{it.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            {/* Category breakdown */}
            <Card title="Category mix">
              {pieData.every((p) => p.value === 0) ? (
                <p className="opacity-60 text-sm">No data yet.</p>
              ) : (
                <div style={{ width: "100%", height: 260 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label>
                        {pieData.map((p) => (
                          <Cell key={p.name} fill={CAT_COLORS[p.name] ?? "#1A1A2E"} stroke="#1A1A2E" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ border: "2px solid #1A1A2E", borderRadius: 0, background: "#FFF4E0" }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>

          <p className="text-xs opacity-60 mt-6">
            Days are bucketed in UTC. Roll/click tracking starts now — historical data only includes hit logs.
          </p>
        </>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="relative my-6 p-6" style={{ background: "var(--cream)", border: "3px solid var(--ink)" }}>
      <span className="absolute -top-3 left-5 px-2" style={{ background: "var(--cream)", fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: "0.06em" }}>
        — {title.toUpperCase()} —
      </span>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-4" style={{ background: "var(--cream)", border: "3px solid var(--ink)" }}>
      <div className="text-[10px] uppercase opacity-60" style={{ letterSpacing: "0.2em" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 36, lineHeight: 1, marginTop: 6, color: "var(--ink)" }}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function FunnelStep({ label, value, rate }: { label: string; value: number; rate?: number | null }) {
  return (
    <div>
      <div className="text-[10px] uppercase opacity-60" style={{ letterSpacing: "0.2em" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 32, color: "var(--ink)" }}>{value.toLocaleString()}</div>
      {rate !== undefined && rate !== null && (
        <div className="text-xs opacity-70 mt-1">{(rate * 100).toFixed(1)}% of rolls</div>
      )}
    </div>
  );
}
