"use client";
import styles from "./page.module.scss";
import { useEffect, useState } from "react";
import { ensureChartRegistered } from "@/lib/chart";
import { Line, Doughnut } from "react-chartjs-2";
import { useQuery } from "@tanstack/react-query";
import QuickAdd from "./QuickAdd";

type SeriesPoint = { date: string; calories: number };

export default function DashboardPage() {
  ensureChartRegistered();
  const [todayTotal, setTodayTotal] = useState<number | null>(null);
  const [todayMacros, setTodayMacros] = useState<{ protein: number; carbs: number; fat: number } | null>(null);
  const [last7, setLast7] = useState<SeriesPoint[] | null>(null);
  const [last30, setLast30] = useState<SeriesPoint[] | null>(null);

  const { data, refetch } = useQuery({
    queryKey: ["dashboardSummary"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/summary?window=all");
      if (!res.ok) throw new Error("Failed to load summary");
      return res.json();
    }
  });

  useEffect(() => {
    if (!data) return;
    setTodayTotal(data?.today?.totals?.calories ?? null);
    if (data?.today?.totals) {
      setTodayMacros({
        protein: data.today.totals.protein || 0,
        carbs: data.today.totals.carbs || 0,
        fat: data.today.totals.fat || 0
      });
    }
    setLast7(data?.last7d ?? null);
    setLast30(data?.last30d ?? null);
  }, [data]);

  return (
    <section className={styles.grid}>
      <div className={styles.card}>
        <h2>Today</h2>
        <p className={styles.big}>{todayTotal ?? "—"} kcal</p>
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
      <QuickAdd />
      <div className={styles.card}>
        <h2>Last 7 Days</h2>
        <p className={styles.big}>
          {last7 ? `${last7.reduce((sum, p) => sum + (p.calories || 0), 0)}` : "—"} kcal
        </p>
        <p className={styles.muted}>{last7 ? `${last7.length} days` : ""}</p>
        <div className={styles.chartBox}>
          {last7 && last7.length ? (
            <Line
              data={{
                labels: last7.map(p => new Date(p.date).toLocaleDateString()),
                datasets: [
                  {
                    label: "Calories",
                    data: last7.map(p => p.calories),
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
          {last30 ? `${last30.reduce((sum, p) => sum + (p.calories || 0), 0)}` : "—"} kcal
        </p>
        <p className={styles.muted}>{last30 ? `${last30.length} days` : ""}</p>
        <div className={styles.chartBox}>
          {last30 && last30.length ? (
            <Line
              data={{
                labels: last30.map(p => new Date(p.date).toLocaleDateString()),
                datasets: [
                  {
                    label: "Calories",
                    data: last30.map(p => p.calories),
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
