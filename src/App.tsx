import { useEffect, useState } from "react";
import type { ReactElement } from "react";

const githubUrl = "https://github.com/ahmedsaturki/ORBIT-MARKETING-OS";

export default function App(): ReactElement {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "48px 24px",
        fontFamily: "system-ui, sans-serif",
        background: "#020617",
        color: "#e2e8f0",
      }}
    >
      <section
        style={{
          maxWidth: 900,
          margin: "0 auto",
          border: "1px solid #1e293b",
          borderRadius: 24,
          padding: 32,
          background: "#0f172a",
        }}
      >
        <div
          style={{
            fontSize: 12,
            letterSpacing: "0.16em",
            color: "#34d399",
            fontWeight: 800,
          }}
        >
          ORBIT MARKETING OS
        </div>
        <h1 style={{ fontSize: 42, lineHeight: 1.1, margin: "14px 0" }}>
          Compatibility shell — production interfaces live in the monorepo
          packages.
        </h1>
        <p style={{ color: "#94a3b8", fontSize: 18, lineHeight: 1.7 }}>
          هذا الجذر متعمد أن يكون آمنًا وغير تشغيلي للتكاملات الخارجية. السطح
          الإنتاجي هو
          <code style={{ marginInline: 6 }}>packages/web</code> للويب و
          <code style={{ marginInline: 6 }}>packages/desktop</code> للتشغيل
          المحلي. لا يتم عرض الـlegacy demo هنا ولا تُنفذ أي إجراءات على منصات
          خارجية.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
            marginTop: 24,
          }}
        >
          <div
            style={{
              border: "1px solid #1e293b",
              borderRadius: 18,
              padding: 18,
              background: "#0b1220",
            }}
          >
            <strong>Web</strong>
            <p style={{ color: "#94a3b8", marginBottom: 0 }}>
              Next.js static product / pricing / legal surface.
            </p>
          </div>
          <div
            style={{
              border: "1px solid #1e293b",
              borderRadius: 18,
              padding: 18,
              background: "#0b1220",
            }}
          >
            <strong>Desktop</strong>
            <p style={{ color: "#94a3b8", marginBottom: 0 }}>
              Tauri local runtime, SQLite, vault, queue and governed execution.
            </p>
          </div>
          <div
            style={{
              border: "1px solid #1e293b",
              borderRadius: 18,
              padding: 18,
              background: "#0b1220",
            }}
          >
            <strong>Safety</strong>
            <p style={{ color: "#94a3b8", marginBottom: 0 }}>
              User authorization, approvals, limits and human-intervention
              gates.
            </p>
          </div>
        </div>

        <div
          style={{
            marginTop: 24,
            padding: 16,
            borderRadius: 16,
            border: "1px solid #1e293b",
            background: "#020617",
            color: online ? "#34d399" : "#fbbf24",
          }}
        >
          Browser network state: {online ? "online" : "offline"}
        </div>

        <a
          href={githubUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-flex",
            marginTop: 22,
            padding: "12px 18px",
            borderRadius: 12,
            background: "#10b981",
            color: "#052e1d",
            fontWeight: 800,
          }}
        >
          Repository
        </a>
      </section>
    </main>
  );
}
