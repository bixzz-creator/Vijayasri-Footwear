import React, { useEffect, useState } from "react";
import { useSEO } from "../hooks/useSEO";

export function NotFoundPage({ onGoHome }: { onGoHome: () => void }) {
  useSEO({ is404: true });
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { onGoHome(); clearInterval(interval); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onGoHome]);

  return (
    <main
      role="main"
      aria-label="Page not found"
      style={{
        minHeight: "80vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "2rem",
        gap: "1.5rem"
      }}
    >
      <div style={{ fontSize: "5rem", lineHeight: 1 }}>👟</div>
      <h1 style={{ fontSize: "clamp(2rem, 6vw, 3.5rem)", fontWeight: 800, margin: 0, color: "#DC2626" }}>
        404
      </h1>
      <h2 style={{ fontSize: "clamp(1.1rem, 3vw, 1.5rem)", fontWeight: 600, margin: 0 }}>
        This Page Walked Off
      </h2>
      <p style={{ color: "hsl(var(--muted-foreground))", maxWidth: "400px", lineHeight: 1.6 }}>
        The product or page you are looking for does not exist. We&apos;ll take you back to our
        showroom in <strong>{countdown}s</strong>.
      </p>
      <button
        onClick={onGoHome}
        style={{
          background: "#DC2626",
          color: "#fff",
          border: "none",
          borderRadius: "0.75rem",
          padding: "0.8rem 2rem",
          fontSize: "0.95rem",
          fontWeight: 700,
          cursor: "pointer",
          letterSpacing: "0.02em"
        }}
      >
        Browse Our Collection
      </button>
    </main>
  );
}
