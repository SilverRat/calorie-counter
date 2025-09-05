"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import styles from "./quickadd.module.scss";

function toLocalInput(dtIso: string) {
  const d = new Date(dtIso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function QuickAdd() {
  const qc = useQueryClient();
  const [occurredAt, setOccurredAt] = useState<string>(() => toLocalInput(new Date().toISOString()));
  const [mealType, setMealType] = useState<'breakfast'|'lunch'|'dinner'|'snack'>("lunch");
  const [itemName, setItemName] = useState("");
  const [calories, setCalories] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: async () => {
      setBusy(true); setError(null);
      const body = {
        occurred_at: new Date(occurredAt).toISOString(),
        meal_type: mealType,
        item_name: itemName.trim(),
        calories: Number(calories)
      };
      const res = await fetch("/api/entries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to create entry");
      return data;
    },
    onSuccess: () => {
      setItemName(""); setCalories(""); setOccurredAt(toLocalInput(new Date().toISOString()));
      qc.invalidateQueries({ queryKey: ["dashboardSummary"] });
    },
    onError: (e: any) => setError(e.message || String(e)),
    onSettled: () => setBusy(false)
  });

  const canSubmit = itemName.trim().length > 0 && calories !== "";

  return (
    <div className={styles.card}>
      <h2>Quick Add</h2>
      <div className={styles.row}>
        <label htmlFor="qa_when">When</label>
        <input id="qa_when" type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
      </div>
      <div className={styles.row}>
        <label htmlFor="qa_meal">Meal</label>
        <select id="qa_meal" value={mealType} onChange={(e) => setMealType(e.target.value as any)}>
          <option value="breakfast">breakfast</option>
          <option value="lunch">lunch</option>
          <option value="dinner">dinner</option>
          <option value="snack">snack</option>
        </select>
      </div>
      <div className={styles.row}>
        <label htmlFor="qa_item">Item</label>
        <input id="qa_item" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="e.g., Chicken salad" />
      </div>
      <div className={styles.row}>
        <label htmlFor="qa_cal">Calories</label>
        <input id="qa_cal" type="number" value={calories} onChange={(e) => setCalories(e.target.value === "" ? "" : Number(e.target.value))} />
      </div>
      <div className={styles.actions}>
        <button onClick={() => createMut.mutate()} disabled={!canSubmit || busy}>Add</button>
      </div>
      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
}

