"use client";

// Last-resort boundary when the root layout itself fails: plain HTML, no app chrome or styles to depend on.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Arial, sans-serif", background: "#f5f7f9", color: "#102031", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <main style={{ maxWidth: 520, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 28 }}>azentio.ai is having trouble right now.</h1>
          <p style={{ color: "#607080" }}>Please try again in a moment.{error.digest ? ` Reference: ${error.digest}` : ""}</p>
          <button onClick={reset} style={{ marginTop: 16, background: "#69D393", color: "#171b3a", border: 0, borderRadius: 5, padding: "12px 20px", fontWeight: 700, cursor: "pointer" }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
