"use client";
import styles from "./page.module.scss";
import { ensureChartRegistered } from "@/lib/chart";
import { Line, Doughnut } from "react-chartjs-2";
import { useQuery } from "@tanstack/react-query";

type Totals = { calories: number; protein: number; carbs: number; fat: number };
type SeriesPoint = { date: string; calories: number };
type DashboardSummary = {
  today?: { totals?: Totals };
  last7d?: SeriesPoint[];
  last30d?: SeriesPoint[];
};

export default function DashboardPage() {
  ensureChartRegistered();

  const { data, refetch } = useQuery<DashboardSummary>({
    queryKey: ["dashboardSummary"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/summary?window=all");
      if (!res.ok) throw new Error("Failed to load summary");
      return res.json();
    }
  });

  const todayTotal = data?.today?.totals?.calories ?? null;
  const todayMacros = data?.today?.totals
    ? {
        protein: data.today.totals.protein || 0,
        carbs: data.today.totals.carbs || 0,
        fat: data.today.totals.fat || 0
      }
    : null;
  const last7 = data?.last7d ?? null;
  const last30 = data?.last30d ?? null;

  return (
    <section className={styles.grid}>
      <div className={styles.card}>
        <h2>Today</h2>
        <p className={styles.big}>{todayTotal ?? "--"} kcal</p>
        <div className={styles.chartBox}>
          {todayMacros && (todayMacros.protein + todayMacros.carbs + todayMacros.fat > 0) ? (
            <Doughnut
              data={{
                labels: ["Protein", "Carbs", "Fat"],
                datasets: [
                  {
                    data: [todayMacros.protein, todayMacros.carbs, todayMacros.fat],
                    backgroundColor: ["#10b981", "#3b82f6", "#f59e0b"],
                    borderColor: "transparent"
                  }
                ]
              }}
              options={{
                maintainAspectRatio: false,
                plugins: { legend: { position: "bottom" } }
              }}
            />
          ) : (
            <p className={styles.muted}>No macros yet today.</p>
          )}
        </div>
      </div>
      <div className={styles.card}>
        <h2>Last 7 Days</h2>
        <p className={styles.big}>
          {last7 ? `${last7.reduce((sum: number, p: SeriesPoint) => sum + (p.calories || 0), 0)}` : "--"} kcal
        </p>
        <p className={styles.muted}>{last7 ? `${last7.length} days` : ""}</p>
        <div className={styles.chartBox}>
          {last7 && last7.length ? (
            <Line
              data={{
                labels: last7.map((p: SeriesPoint) => new Date(p.date).toLocaleDateString()),
                datasets: [
                  {
                    label: "Calories",
                    data: last7.map((p: SeriesPoint) => p.calories),
                    fill: true,
                    borderColor: "#2563eb",
                    backgroundColor: "rgba(37, 99, 235, 0.15)",
                    tension: 0.25,
                    pointRadius: 2
                  }
                ]
              }}
              options={{
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { grid: { display: false } }, y: { grid: { color: "rgba(0,0,0,0.08)" } } }
              }}
            />
          ) : (
            <p className={styles.muted}>No data</p>
          )}
        </div>
      </div>
      <div className={styles.card}>
        <h2>Last 30 Days</h2>
        <p className={styles.big}>
          {last30 ? `${last30.reduce((sum: number, p: SeriesPoint) => sum + (p.calories || 0), 0)}` : "--"} kcal
        </p>
        <p className={styles.muted}>{last30 ? `${last30.length} days` : ""}</p>
        <div className={styles.chartBox}>
          {last30 && last30.length ? (
            <Line
              data={{
                labels: last30.map((p: SeriesPoint) => new Date(p.date).toLocaleDateString()),
                datasets: [
                  {
                    label: "Calories",
                    data: last30.map((p: SeriesPoint) => p.calories),
                    fill: true,
                    borderColor: "#16a34a",
                    backgroundColor: "rgba(22, 163, 74, 0.15)",
                    tension: 0.25,
                    pointRadius: 0
                  }
                ]
              }}
              options={{
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { grid: { display: false } }, y: { grid: { color: "rgba(0,0,0,0.08)" } } }
              }}
            />
          ) : (
            <p className={styles.muted}>No data</p>
          )}
        </div>
      </div>
    </section>
  );
}
