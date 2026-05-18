export function AuthLoading() {
  return (
    <div
      className="mx-auto max-w-[880px] px-5 py-24 text-center"
      style={{ fontFamily: "var(--font-body)", color: "var(--ink)" }}
    >
      <div
        className="mb-3 text-[11px] uppercase"
        style={{ letterSpacing: "0.4em", color: "var(--pink)" }}
      >
        — One sec —
      </div>
      <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 20 }}>
        Warming up the menu…
      </div>
    </div>
  );
}
