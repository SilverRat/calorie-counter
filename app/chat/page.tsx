"use client";
import styles from "./page.module.scss";
import { useCallback, useMemo, useRef, useState } from "react";

type Msg = { id?: string; role: "user" | "assistant" | "tool" | "system"; content: string; name?: string; kind?: "tool_call" | "tool_result" | "error" };

function useSSE() {
  const parse = useCallback(async (res: Response, onEvent: (ev: { event: string; data: any }) => void) => {
    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const lines = block.split("\n");
        let event = "message";
        const dataLines: string[] = [];
        for (const ln of lines) {
          if (ln.startsWith("event:")) event = ln.slice(6).trim();
          else if (ln.startsWith("data:")) dataLines.push(ln.slice(5).trim());
        }
        const dataStr = dataLines.join("\n");
        let data: any = null;
        try { data = dataStr ? JSON.parse(dataStr) : null } catch { data = dataStr }
        onEvent({ event, data });
      }
    }
  }, []);
  return { parse };
}

export default function ChatPage() {
  const { parse } = useSSE();
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [liveAssistant, setLiveAssistant] = useState<string>("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = Array.from(e.target.files ?? []).slice(0, 2);
    setFiles(f);
  };

  const resetChat = () => {
    setSessionId(null);
    setMessages([]);
    setLiveAssistant("");
  };

  const onSend = async () => {
    if (streaming) return;
    if (!message && files.length === 0) return;
    setStreaming(true);
    // Push user message locally
    if (message) setMessages((m) => [...m, { role: "user", content: message }]);

    const form = new FormData();
    form.append("payload", JSON.stringify({
      session_id: sessionId ?? undefined,
      message: { content: message },
      context: { timezone, units: "metric" }
    }));
    files.forEach((file, idx) => form.append(`file${idx + 1}`, file));

    try {
      const res = await fetch("/api/chat/stream", { method: "POST", body: form });
      if (!res.ok || !res.body) {
        setMessages((m) => [...m, { role: "system", content: `Request failed: ${res.status}`, kind: "error" }]);
        setStreaming(false);
        return;
      }
      setMessage("");
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";

      await parse(res, ({ event, data }) => {
        if (event === "token") {
          setLiveAssistant((t) => t + (data?.content || ""));
        } else if (event === "tool_call") {
          setMessages((m) => [...m, { role: "tool", kind: "tool_call", name: data?.name, content: JSON.stringify(data?.arguments, null, 2) }]);
        } else if (event === "tool_result") {
          setMessages((m) => [...m, { role: "tool", kind: "tool_result", name: data?.name, content: JSON.stringify(data?.result, null, 2) }]);
        } else if (event === "message") {
          setSessionId(data?.session_id || sessionId);
          setMessages((m) => [...m, { id: data?.id, role: "assistant", content: data?.content || "" }]);
          setLiveAssistant("");
        } else if (event === "error") {
          setMessages((m) => [...m, { role: "system", content: data?.message || "Error", kind: "error" }]);
        } else if (event === "done") {
          // no-op; handled by finally
        }
      });
    } catch (e: any) {
      setMessages((m) => [...m, { role: "system", content: e?.message || String(e), kind: "error" }]);
    } finally {
      setStreaming(false);
    }
  };

  return (
    <section className={styles.wrap}>
      <div className={styles.thread}>
        {messages.length === 0 && !liveAssistant && (
          <div className={styles.empty}>Attach a photo or type what you ate. I’ll log it for you.</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? styles.bubbleUser : m.role === 'assistant' ? styles.bubbleAssistant : styles.toolCard}>
            {m.name && <div className={styles.toolName}>{m.kind === 'tool_call' ? 'Tool call' : m.kind === 'tool_result' ? 'Tool result' : 'System'}: {m.name}</div>}
            {m.kind?.startsWith('tool') ? (
              <pre className={styles.pre}>{m.content}</pre>
            ) : (
              <div>{m.content}</div>
            )}
          </div>
        ))}
        {liveAssistant && (
          <div className={styles.bubbleAssistant}>{liveAssistant}</div>
        )}
      </div>
      <div className={styles.composer}>
        <div className={styles.attachRow}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={onSelectFiles}
            disabled={streaming}
          />
          {files.length > 0 && <div className={styles.muted}>{files.length} file(s) attached</div>}
          <button onClick={resetChat} disabled={streaming}>New chat</button>
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message or attach an image"
          disabled={streaming}
        />
        <button onClick={onSend} disabled={streaming || (!message && files.length === 0)}>Send</button>
      </div>
    </section>
  );
}
