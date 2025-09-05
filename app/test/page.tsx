"use client";
import styles from "./page.module.scss";
import { useEffect, useMemo, useState } from "react";

type Entry = {
  id: string;
  occurred_at: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  item_name: string;
  calories: number;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  notes?: string | null;
};


function toLocalInput(dtIso: string) {
  // Convert ISO to value suitable for <input type="datetime-local">
  const d = new Date(dtIso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function TestPage() {
  const [occurredAt, setOccurredAt] = useState<string>(() => toLocalInput(new Date().toISOString()));
  const [mealType, setMealType] = useState<Entry["meal_type"]>("lunch");
  const [itemName, setItemName] = useState("Chicken salad");
  const [calories, setCalories] = useState<number>(420);
  const [protein, setProtein] = useState<number | "">(32);
  const [carbs, setCarbs] = useState<number | "">(18);
  const [fat, setFat] = useState<number | "">(22);
  const [notes, setNotes] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [authed, setAuthed] = useState<boolean>(false)

  const fromIso = useMemo(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), []);
  const toIso = useMemo(() => new Date().toISOString(), []);

  const loadEntries = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/entries?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to fetch entries");
      setEntries(data.entries || []);
    } catch (e: any) {
      setMsg({ kind: "error", text: e.message || String(e) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // quick check: try to get entries; if 401, prompt sign in
    (async () => {
      const res = await fetch(`/api/entries?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`)
      if (res.status === 401) {
        setAuthed(false)
        return
      }
      setAuthed(true)
      const data = await res.json().catch(() => ({}))
      setEntries(data.entries || [])
    })()
  }, [fromIso, toIso])

  const handleNow = () => setOccurredAt(toLocalInput(new Date().toISOString()));

  const handleCreate = async () => {
    setMsg(null);
    try {
      const local = new Date(occurredAt);
      const body = {
        occurred_at: local.toISOString(),
        meal_type: mealType,
        item_name: itemName,
        calories: Number(calories),
        protein: protein === "" ? undefined : Number(protein),
        carbs: carbs === "" ? undefined : Number(carbs),
        fat: fat === "" ? undefined : Number(fat),
        notes: notes || undefined
      };
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create");
      setMsg({ kind: "success", text: `Created entry ${data.id}` });
      await loadEntries();
    } catch (e: any) {
      setMsg({ kind: "error", text: e.message || String(e) });
    }
  };

  const handleDelete = async (id: string) => {
    setMsg(null);
    try {
      const res = await fetch(`/api/entries/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Failed to delete ${id}`);
      }
      setMsg({ kind: "success", text: `Deleted ${id}` });
      await loadEntries();
    } catch (e: any) {
      setMsg({ kind: "error", text: e.message || String(e) });
    }
  };

  return (
    <section className={styles.wrap}>
      <h1>Test Utilities</h1>
      <p className={styles.muted}>Temporary page to exercise the API without curl. Sign in first if you see 401s.</p>

      {!authed && (
        <p className={styles.error}>You are not signed in. Please <a href="/login">sign in</a> to create and view entries.</p>
      )}

      <div className={styles.grid}>
        <div className={styles.card}>
          <h2>Create Entry</h2>
          <div className={styles.row}>
            <label htmlFor="occurred_at">Occurred At</label>
            <div>
              <input id="occurred_at" type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
              <div className={styles.actions}>
                <button type="button" onClick={handleNow}>Now</button>
              </div>
            </div>
          </div>
          <div className={styles.row}>
            <label htmlFor="meal_type">Meal Type</label>
            <select id="meal_type" value={mealType} onChange={(e) => setMealType(e.target.value as Entry["meal_type"]) }>
              <option value="breakfast">breakfast</option>
              <option value="lunch">lunch</option>
              <option value="dinner">dinner</option>
              <option value="snack">snack</option>
            </select>
          </div>
          <div className={styles.row}>
            <label htmlFor="item_name">Item Name</label>
            <input id="item_name" value={itemName} onChange={(e) => setItemName(e.target.value)} />
          </div>
          <div className={styles.row}>
            <label htmlFor="calories">Calories</label>
            <input id="calories" type="number" value={calories} onChange={(e) => setCalories(Number(e.target.value))} />
          </div>
          <div className={styles.row}>
            <label htmlFor="protein">Protein (g)</label>
            <input id="protein" type="number" value={protein} onChange={(e) => setProtein(e.target.value === "" ? "" : Number(e.target.value))} />
          </div>
          <div className={styles.row}>
            <label htmlFor="carbs">Carbs (g)</label>
            <input id="carbs" type="number" value={carbs} onChange={(e) => setCarbs(e.target.value === "" ? "" : Number(e.target.value))} />
          </div>
          <div className={styles.row}>
            <label htmlFor="fat">Fat (g)</label>
            <input id="fat" type="number" value={fat} onChange={(e) => setFat(e.target.value === "" ? "" : Number(e.target.value))} />
          </div>
          <div className={styles.row}>
            <label htmlFor="notes">Notes</label>
            <textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className={styles.actions}>
            <button type="button" onClick={handleCreate} disabled={loading}>Create</button>
          </div>
          {msg && <div className={msg.kind === 'error' ? styles.error : styles.success}>{msg.text}</div>}
        </div>

        <div className={styles.card}>
          <h2>Recent Entries (30d)</h2>
          <div className={styles.actions}>
            <button type="button" onClick={loadEntries} disabled={loading}>Refresh</button>
          </div>
          <div className={styles.list}>
            {entries.length === 0 && <div className={styles.muted}>No entries yet.</div>}
            {entries.map((e) => (
              <div key={e.id} className={styles.item}>
                <div>
                  <div className={styles.itemTitle}>{e.item_name} — {e.calories} kcal</div>
                  <div className={styles.muted}>{new Date(e.occurred_at).toLocaleString()} • {e.meal_type}</div>
                </div>
                <div>
                  <button onClick={() => handleDelete(e.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
