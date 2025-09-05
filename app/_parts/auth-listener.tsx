"use client";
import { useEffect } from "react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

export default function AuthListener() {
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        await fetch("/api/auth/state", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ event, session })
        });
      } catch (e) {
        // ignore
      }
    });
    return () => { subscription.subscription.unsubscribe(); };
  }, []);
  return null;
}

