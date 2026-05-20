import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyData, commitHit } from "@/lib/dopamine.functions";
import { getBalloonPopsTotal } from "@/lib/popper.functions";
import { computeStreak, localDateKey, todayKey } from "@/lib/streak";
import { burstConfetti } from "@/lib/confetti";
import { playChime } from "@/lib/chime";
import { Userbar } from "@/components/Userbar";
import { track } from "@/lib/analytics";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/popper/balloon")({
  head: () => ({
    meta: [
      { title: "Pop a Balloon — Dopamine Menu" },
      { name: "description", content: "Tap. Pop. Smile." },
    ],
  }),
  component: BalloonPopper,
});

const MILESTONES = new Set([3, 7, 14, 30, 60, 100]);
const COLORS = ["var(--pink)", "var(--yellow)", "var(--teal)"];

type Balloon = { id: number; color: string; xPct: number; size: number };

function randomBalloon(id: number): Balloon {
  return {
    id,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    xPct: 15 + Math.random() * 70,
    size: 140 + Math.random() * 80,
  };
}

function popSound() {
  if (typeof window === "undefined") return;
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // ignore
  }
}

function BalloonPopper() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchData = useServerFn(getMyData);
  const fetchTotal = useServerFn(getBalloonPopsTotal);
  const commitFn = useServerFn(commitHit);
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

  const { data: myData } = useQuery({
    queryKey: ["dopamine", "data"],
    queryFn: () => fetchData(),
  });
  const { data: totalData, isLoading: totalLoading } = useQuery({
    queryKey: ["popper", "balloon", "total"],
    queryFn: () => fetchTotal(),
  });

  const logs = myData?.logs ?? [];
  const streak = useMemo(
    () => (myData ? computeStreak(logs, tz) : undefined),
    [myData, logs, tz],
  );
  const todayLogged = useMemo(() => {
    if (!myData) return false;
    const tk = todayKey(tz);
    return logs.some((l) => localDateKey(l.logged_at, tz) === tk);
  }, [myData, logs, tz]);

  const nextId = useRef(1);
  const [balloon, setBalloon] = useState<Balloon>(() => randomBalloon(0));
  const [sessionPops, setSessionPops] = useState(0);
  const [milestone, setMilestone] = useState<number | null>(null);

  const pop = () => {
    popSound();
    burstConfetti(8);
    setSessionPops((n) => n + 1);
    const id = nextId.current++;
    setBalloon(randomBalloon(id));
  };

  const commitMut = useMutation({
    mutationFn: async () => {
      track("menu_item_logged", { name: "Pop a Balloon", category: "quick", is_custom: false });
      return commitFn({
        data: { itemName: "Pop a Balloon", category: "quick", isCustom: false, timeZone: tz },
      });
    },
    onSuccess: ({ streak: newStreak }) => {
      const wasFirstToday = !todayLogged;
      qc.invalidateQueries({ queryKey: ["dopamine", "data"] });
      qc.invalidateQueries({ queryKey: ["popper", "balloon", "total"] });
      playChime(MILESTONES.has(newStreak));
      if (MILESTONES.has(newStreak)) {
        burstConfetti(80);
        setMilestone(newStreak);
        setTimeout(() => {
          setMilestone(null);
          navigate({ to: "/menu" });
        }, 2800);
      } else {
        burstConfetti(wasFirstToday ? 24 : 18);
        setTimeout(() => navigate({ to: "/menu" }), 900);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = totalData?.total;
  const totalLabel = totalLoading || total === undefined ? "—" : total.toLocaleString();

  return (
    <div className="mx-auto max-w-[880px] px-5 pt-6 pb-20">
      <Userbar streak={streak} />

      <header className="text-center mt-10 mb-6">
        <div className="mb-3 text-[11px] uppercase" style={{ letterSpacing: "0.4em", color: "var(--pink)", fontFamily: "var(--font-body)" }}>
          — Tap to Pop —
        </div>
        <h1 style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(40px, 8vw, 72px)",
          lineHeight: 0.95,
          textShadow: "5px 5px 0 var(--yellow)",
          color: "var(--ink)",
          letterSpacing: "0.01em",
        }}>Pop a Balloon</h1>
        <p className="mt-4" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 18 }}>
          Tap the balloon. Tap again. Stop when you feel a little lighter.
        </p>
      </header>

      <div
        className="relative mx-auto my-8 flex items-end justify-center overflow-hidden"
        style={{
          height: 380,
          background: "var(--ink)",
          border: "3px solid var(--ink)",
        }}
      >
        <button
          key={balloon.id}
          type="button"
          onClick={pop}
          aria-label="Pop the balloon"
          className="absolute"
          style={{
            left: `${balloon.xPct}%`,
            bottom: 24,
            transform: "translateX(-50%)",
            width: balloon.size,
            height: balloon.size * 1.18,
            border: "none",
            background: "transparent",
            padding: 0,
            cursor: "pointer",
            animation: "dopamine-bounce 0.45s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          <div
            style={{
              width: "100%",
              height: `${100 / 1.18}%`,
              background: balloon.color,
              borderRadius: "50% 50% 48% 48% / 55% 55% 45% 45%",
              boxShadow: "inset -12px -16px 28px oklch(0 0 0 / 0.18), 4px 4px 0 oklch(0 0 0 / 0.25)",
              border: "3px solid var(--ink)",
            }}
          />
          <div
            aria-hidden
            style={{
              margin: "0 auto",
              width: 2,
              height: "12%",
              background: "var(--cream)",
              opacity: 0.7,
            }}
          />
        </button>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-4 max-w-[540px] mx-auto" style={{ fontFamily: "var(--font-body)", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>
        <div>This session: <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 20, color: "var(--pink)", fontVariantNumeric: "tabular-nums" }}>{sessionPops}</span></div>
        <div>All time: <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 20, color: "var(--pink)", fontVariantNumeric: "tabular-nums" }}>{totalLabel}</span></div>
      </div>

      <div className="flex gap-3 justify-center flex-wrap mt-10">
        <Link
          to="/menu"
          className="px-5 py-3 transition-transform hover:-translate-y-0.5"
          style={{ fontFamily: "var(--font-body)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.18em", border: "2px solid var(--ink)", background: "transparent", color: "var(--ink)" }}
        >
          Back
        </Link>
        <button
          onClick={() => commitMut.mutate()}
          disabled={commitMut.isPending}
          className="px-5 py-3 transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          style={{ fontFamily: "var(--font-body)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.18em", background: "var(--yellow)", color: "var(--ink)", border: "2px solid var(--yellow)" }}
        >
          Done ✓
        </button>
      </div>

      {milestone !== null && <MilestoneOverlay n={milestone} />}
    </div>
  );
}

function MilestoneOverlay({ n }: { n: number }) {
  const text: Record<number, string> = {
    3: "Three days in. The habit's forming.",
    7: "Seven days running. Keep going.",
    14: "Two weeks. This is who you are now.",
    30: "Thirty days. The brain has rewired.",
    60: "Sixty. You've built something real.",
    100: "One hundred. Extraordinary.",
  };
  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center"
      style={{ pointerEvents: "none", animation: "dopamine-fadein 0.3s ease" }}
    >
      <div
        className="text-center px-14 py-12"
        style={{
          background: "var(--ink)",
          color: "var(--cream)",
          border: "4px solid var(--yellow)",
          boxShadow: "12px 12px 0 var(--pink)",
          animation: "dopamine-bounce 0.6s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        <div style={{ fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: "0.36em", color: "var(--yellow)", marginBottom: 14 }}>— MILESTONE —</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 96, lineHeight: 1, color: "var(--yellow)", textShadow: "5px 5px 0 var(--pink)" }}>{n}</div>
        <div className="mt-4" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 22 }}>{text[n] ?? "Milestone day."}</div>
      </div>
    </div>
  );
}
