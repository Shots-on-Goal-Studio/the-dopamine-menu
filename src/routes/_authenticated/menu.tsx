import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getMyData,
  commitHit,
  addCustomHit,
  deleteCustomHit,
} from "@/lib/dopamine.functions";
import {
  SEED_MENU,
  TIME_LABELS,
  COST_LABELS,
  SECTION_TITLES,
  SECTION_TIMES,
  SECTION_PLACEHOLDERS,
  type Category,
  type ItemKind,
} from "@/data/seedMenu";
import { computeStreak, buildWeekStrip, localDateKey, todayKey } from "@/lib/streak";
import { burstConfetti } from "@/lib/confetti";
import { playChime } from "@/lib/chime";
import { Userbar } from "@/components/Userbar";
import { track } from "@/lib/analytics";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/menu")({
  head: () => ({
    meta: [
      { title: "Your menu — Dopamine Menu" },
      { name: "description", content: "Pick a healthy hit. Or let chance decide." },
    ],
  }),
  component: MenuPage,
});

type CustomHit = { id: string; name: string; detail: string | null; category: Category; created_at: string };
type RolledItem = { name: string; detail: string | null; category: Category; isCustom: boolean; customId?: string; kind?: ItemKind };
const MILESTONES = new Set([3, 7, 14, 30, 60, 100]);

function MenuPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchData = useServerFn(getMyData);
  const commitFn = useServerFn(commitHit);
  const addFn = useServerFn(addCustomHit);
  const deleteFn = useServerFn(deleteCustomHit);
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

  useEffect(() => {
    track("menu_visited");
  }, []);


  const { data, isLoading } = useQuery({
    queryKey: ["dopamine", "data"],
    queryFn: () => fetchData(),
  });

  const logs = data?.logs ?? [];
  const customHits: CustomHit[] = (data?.customHits ?? []) as CustomHit[];

  const streak = useMemo(() => computeStreak(logs, tz), [logs, tz]);
  const week = useMemo(() => buildWeekStrip(logs, tz), [logs, tz]);
  const todayLogged = useMemo(() => {
    const tk = todayKey(tz);
    return logs.some((l) => localDateKey(l.logged_at, tz) === tk);
  }, [logs, tz]);

  const rollPool: RolledItem[] = useMemo(() => {
    const seed: RolledItem[] = SEED_MENU.map((s) => ({ ...s, isCustom: false, kind: s.kind }));
    const custom: RolledItem[] = customHits.map((c) => ({
      name: c.name, detail: c.detail, category: c.category, isCustom: true, customId: c.id,
    }));
    return [...custom, ...seed];
  }, [customHits]);

  const [revealed, setRevealed] = useState<RolledItem | null>(null);
  const [milestone, setMilestone] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);

  const roll = () => {
    if (rollPool.length === 0) return;
    track("roll_clicked");
    setRolling(true);
    setTimeout(() => setRolling(false), 400);
    const pick = rollPool[Math.floor(Math.random() * rollPool.length)];
    setRevealed(pick);
  };

  const handleCommitSuccess = (newStreak: number) => {
    const wasFirstToday = !todayLogged;
    setRevealed(null);
    qc.invalidateQueries({ queryKey: ["dopamine", "data"] });
    playChime(MILESTONES.has(newStreak));
    if (MILESTONES.has(newStreak)) {
      burstConfetti(80);
      setMilestone(newStreak);
      setTimeout(() => setMilestone(null), 2800);
    } else {
      burstConfetti(wasFirstToday ? 24 : 18);
    }
  };

  const commitMut = useMutation({
    mutationFn: async (item: RolledItem) => {
      track("menu_item_logged", { name: item.name, category: item.category, is_custom: item.isCustom });
      return commitFn({ data: { itemName: item.name, category: item.category, isCustom: item.isCustom, timeZone: tz } });
    },
    onSuccess: ({ streak: newStreak }) => handleCommitSuccess(newStreak),
    onError: (e: Error) => toast.error(e.message),
  });

  const handlePick = (name: string, category: Category, isCustom: boolean) => {
    track("menu_item_clicked", { name, category, is_custom: isCustom });
    let detail: string | null = null;
    let customId: string | undefined;
    let kind: ItemKind | undefined;
    if (isCustom) {
      const c = customHits.find((h) => h.name === name && h.category === category);
      detail = c?.detail ?? null;
      customId = c?.id;
    } else {
      const s = SEED_MENU.find((i) => i.name === name && i.category === category);
      detail = s?.detail ?? null;
      kind = s?.kind;
    }
    setRevealed({ name, detail, category, isCustom, customId, kind });
  };

  const revealRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (revealed) {
      requestAnimationFrame(() => {
        revealRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }, [revealed]);

  const addMut = useMutation({
    mutationFn: async (input: { name: string; detail: string; category: Category }) =>
      addFn({ data: { name: input.name, detail: input.detail || null, category: input.category } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dopamine", "data"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dopamine", "data"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const [openForm, setOpenForm] = useState<Category | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CustomHit | null>(null);

  if (isLoading) {
    return <div className="mx-auto max-w-[880px] px-5 py-20 text-center" style={{ fontFamily: "var(--font-body)" }}>Loading your menu…</div>;
  }

  return (
    <div className="mx-auto max-w-[880px] px-5 pt-6 pb-20">
      <Userbar streak={streak} />

      <header className="text-center mt-14 mb-10">
        <div className="mb-4 text-[11px] uppercase" style={{ letterSpacing: "0.4em", color: "var(--pink)", fontFamily: "var(--font-body)" }}>
          — Today's Menu —
        </div>
        <h1 style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(56px, 11vw, 112px)",
          lineHeight: 0.95,
          textShadow: "7px 7px 0 var(--yellow)",
          color: "var(--ink)",
          letterSpacing: "0.01em",
        }}>Dopamine</h1>
        <p className="mt-6 text-[20px]" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
          Pick a healthy hit. Or let <span style={{ color: "var(--pink)" }}>chance</span> decide.
        </p>
      </header>

      <StreakSection streak={streak} week={week} />

      <div className="text-center my-14">
        <button
          onClick={roll}
          className="px-12 py-6 transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            background: "var(--ink)",
            color: "var(--yellow)",
            boxShadow: "8px 8px 0 var(--pink)",
            letterSpacing: "0.04em",
          }}
        >
          <span className="inline-block transition-transform" style={{ transform: rolling ? "rotate(360deg)" : undefined, transitionDuration: "400ms" }}>🎲</span>
          {" "}Give Me One
        </button>
      </div>

      {revealed && (
        <RevealCard
          ref={revealRef}
          item={revealed}
          onReroll={roll}
          onCommit={() => commitMut.mutate(revealed)}
          committing={commitMut.isPending}
        />
      )}

      <Menu
        customHits={customHits}
        openForm={openForm}
        setOpenForm={setOpenForm}
        onAdd={(name, detail, category) => {
          addMut.mutate({ name, detail, category }, { onSuccess: () => setOpenForm(null) });
        }}
        onRequestDelete={setConfirmDelete}
        onPick={handlePick}
      />

      {milestone !== null && <MilestoneOverlay n={milestone} />}

      {confirmDelete && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center px-4" style={{ background: "oklch(0 0 0 / 0.5)" }}>
          <div className="max-w-sm w-full p-8 text-center" style={{ background: "var(--cream)", border: "3px solid var(--ink)" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 22 }}>Delete this hit?</h3>
            <p className="mt-3 text-sm" style={{ fontFamily: "var(--font-body)" }}>Past logs are kept.</p>
            <div className="mt-6 flex gap-3 justify-center">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-xs uppercase"
                style={{ fontFamily: "var(--font-body)", letterSpacing: "0.16em", border: "2px solid var(--ink)", background: "transparent" }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteMut.mutate(confirmDelete.id);
                  setConfirmDelete(null);
                }}
                className="px-4 py-2 text-xs uppercase"
                style={{ fontFamily: "var(--font-body)", letterSpacing: "0.16em", background: "var(--pink)", color: "var(--cream)", border: "2px solid var(--pink)" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function StreakSection({ streak, week }: { streak: number; week: ReturnType<typeof buildWeekStrip> }) {
  return (
    <div className="relative mx-auto max-w-[540px] my-12 px-4 sm:px-8 py-7 grid items-center gap-4 sm:gap-8" style={{ gridTemplateColumns: "auto 1fr", background: "var(--cream)", border: "3px solid var(--ink)" }}>
      <span className="absolute -top-3 left-7 px-3" style={{ background: "var(--cream)", fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: "0.06em" }}>— STREAK —</span>
      <div className="flex flex-col items-center pr-4 sm:pr-7" style={{ borderRight: "2px dashed var(--ink)" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 56, lineHeight: 0.9, color: "var(--pink)" }}>{streak}</div>
        <div className="mt-1.5" style={{ fontFamily: "var(--font-body)", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase" }}>day streak</div>
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {week.map((d) => {
          const bg = d.done ? (d.today ? "var(--yellow)" : "var(--pink)") : "var(--cream)";
          const border = d.today ? "var(--yellow)" : d.done ? "var(--pink)" : "var(--ink)";
          return (
            <div key={d.key} className="flex flex-col items-center gap-2">
              <span style={{ fontFamily: "var(--font-body)", fontSize: 10, letterSpacing: "0.06em", opacity: 0.6 }}>{d.label}</span>
              <div
                className="w-[22px] h-[22px] rounded-full"
                style={{
                  background: bg,
                  border: `${d.today ? 3 : 2}px solid ${border}`,
                  animation: d.today && d.done ? "dopamine-pop 0.5s cubic-bezier(0.34,1.56,0.64,1)" : undefined,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RevealCard({ item, onReroll, onCommit, committing, ref }: { item: RolledItem; onReroll: () => void; onCommit: () => void; committing: boolean; ref?: React.Ref<HTMLDivElement> }) {
  const detailLine = item.detail
    ? `${TIME_LABELS[item.category]} · ${item.detail}`
    : TIME_LABELS[item.category];
  return (
    <div
      ref={ref}
      className="relative mx-auto max-w-[540px] my-12 px-10 pt-13 pb-11 text-center"
      style={{
        background: "var(--ink)",
        color: "var(--cream)",
        animation: "dopamine-reveal 0.5s cubic-bezier(0.34,1.56,0.64,1)",
        padding: "52px 40px 44px",
      }}
    >
      <span aria-hidden className="absolute" style={{ top: 14, left: 18, color: "var(--yellow)", fontSize: 30 }}>★</span>
      <span aria-hidden className="absolute" style={{ bottom: 14, right: 18, color: "var(--yellow)", fontSize: 30 }}>★</span>
      <div style={{ fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: "0.36em", textTransform: "uppercase", color: "var(--yellow)", marginBottom: 18 }}>
        Your Hit
      </div>
      <div style={{ fontFamily: "var(--font-serif)", fontSize: 40, lineHeight: 1.15, marginBottom: 14 }}>{item.name}</div>
      <div style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--teal)", marginBottom: 32, letterSpacing: "0.04em" }}>{detailLine}</div>
      <div className="flex gap-3 justify-center flex-wrap">
        <button
          onClick={onReroll}
          className="px-5 py-3 transition-transform hover:-translate-y-0.5"
          style={{ fontFamily: "var(--font-body)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.18em", border: "2px solid var(--cream)", background: "transparent", color: "var(--cream)" }}
        >
          Just roll
        </button>
        <button
          onClick={onCommit}
          disabled={committing}
          className="px-5 py-3 transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          style={{ fontFamily: "var(--font-body)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.18em", background: "var(--yellow)", color: "var(--ink)", border: "2px solid var(--yellow)" }}
        >
          I did it ✓
        </button>
      </div>
    </div>
  );
}

function Menu({
  customHits,
  openForm,
  setOpenForm,
  onAdd,
  onRequestDelete,
  onPick,
}: {
  customHits: CustomHit[];
  openForm: Category | null;
  setOpenForm: (c: Category | null) => void;
  onAdd: (name: string, detail: string, category: Category) => void;
  onRequestDelete: (h: CustomHit) => void;
  onPick: (name: string, category: Category, isCustom: boolean) => void;
}) {
  return (
    <div className="relative mt-16 px-10 pb-10 pt-12" style={{ background: "var(--cream)", border: "3px solid var(--ink)" }}>
      <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4" style={{ background: "var(--cream)", fontFamily: "var(--font-display)", fontSize: 16, letterSpacing: "0.08em" }}>
        — THE MENU —
      </span>
      {(["quick", "medium", "big"] as Category[]).map((cat) => (
        <Section
          key={cat}
          category={cat}
          customHits={customHits.filter((c) => c.category === cat)}
          isOpen={openForm === cat}
          onOpen={() => setOpenForm(cat)}
          onClose={() => setOpenForm(null)}
          onAdd={(name, detail) => onAdd(name, detail, cat)}
          onRequestDelete={onRequestDelete}
          onPick={(name, isCustom) => onPick(name, cat, isCustom)}
        />
      ))}
    </div>
  );
}

function Section({
  category, customHits, isOpen, onOpen, onClose, onAdd, onRequestDelete, onPick,
}: {
  category: Category;
  customHits: CustomHit[];
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onAdd: (name: string, detail: string) => void;
  onRequestDelete: (h: CustomHit) => void;
  onPick: (name: string, isCustom: boolean) => void;
}) {
  const seedItems = SEED_MENU.filter((i) => i.category === category);
  return (
    <div className="mb-9 last:mb-0">
      <div className="flex items-baseline gap-4 mb-5 pb-3" style={{ borderBottom: "2px dashed var(--ink)" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: "0.02em" }}>{SECTION_TITLES[category]}</div>
        <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--pink)", fontSize: 18 }}>{SECTION_TIMES[category]}</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-9 gap-y-3 mb-3.5">
        {customHits.map((h) => (
          <ItemRow
            key={h.id}
            name={h.name}
            cost={COST_LABELS[category]}
            isCustom
            onDelete={() => onRequestDelete(h)}
            onPick={() => onPick(h.name, true)}
          />
        ))}
        {seedItems.map((s) => (
          <ItemRow
            key={s.name}
            name={s.name}
            cost={COST_LABELS[category]}
            kind={s.kind ?? "standard"}
            onPick={() => onPick(s.name, false)}
          />
        ))}
      </div>
      {!isOpen ? (
        <button
          onClick={onOpen}
          className="px-3.5 py-2 transition-all hover:opacity-100"
          style={{ fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", background: "transparent", border: "1.5px dashed var(--ink)", opacity: 0.6 }}
        >
          + Add your own
        </button>
      ) : (
        <AddForm category={category} onSubmit={onAdd} onCancel={onClose} />
      )}
    </div>
  );
}

function ItemRow({ name, cost, isCustom, kind, onDelete, onPick }: { name: string; cost: string; isCustom?: boolean; kind?: "standard" | "tap"; onDelete?: () => void; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      title="Tap to log this hit"
      className="group flex items-baseline text-left w-full px-2 -mx-2 py-1 transition-colors hover:bg-[color:var(--yellow)]/30 cursor-pointer"
      style={{ fontFamily: "var(--font-body)", fontSize: 14, lineHeight: 1.5, background: "transparent", border: "none" }}
    >
      <span className="flex-1 sm:flex-none">
        {name}
        {isCustom && (
          <span className="ml-2 px-1.5 py-0.5" style={{ fontFamily: "var(--font-body)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", background: "var(--teal)", color: "var(--ink)" }}>
            yours
          </span>
        )}
        {kind === "tap" && (
          <span className="ml-2 px-1.5 py-0.5" style={{ fontFamily: "var(--font-body)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", background: "var(--pink)", color: "var(--cream)" }}>
            tap
          </span>
        )}
      </span>
      <span className="hidden sm:block flex-1 mx-2 mb-1" style={{ borderBottom: "1.5px dotted var(--ink)", opacity: 0.35 }} />
      <span className="hidden sm:inline" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--pink)", fontSize: 14 }}>{cost}</span>
      <span aria-hidden className="sm:hidden ml-2 opacity-40 group-hover:opacity-80 transition-opacity" style={{ fontFamily: "var(--font-body)", fontSize: 18, color: "var(--ink)", lineHeight: 1 }}>›</span>
      {isCustom && onDelete && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onDelete(); } }}
          aria-label="Delete custom hit"
          className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--pink)", cursor: "pointer" }}
        >
          ×
        </span>
      )}
    </button>
  );
}

function AddForm({ category, onSubmit, onCancel }: { category: Category; onSubmit: (name: string, detail: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const submit = () => {
    const n = name.trim();
    if (!n) { onCancel(); return; }
    onSubmit(n, detail.trim());
    setName(""); setDetail("");
  };
  return (
    <div className="flex items-start gap-2.5 flex-wrap">
      <div className="flex-1 min-w-[200px] flex flex-col gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") onCancel(); }}
          placeholder={SECTION_PLACEHOLDERS[category]}
          maxLength={60}
          className="px-3 py-2 outline-none w-full"
          style={{ fontFamily: "var(--font-body)", fontSize: 13, background: "var(--cream)", border: "2px solid var(--ink)", color: "var(--ink)" }}
        />
        <input
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") onCancel(); }}
          placeholder='Optional detail (e.g. "Just five poses")'
          maxLength={60}
          className="px-3 py-2 outline-none w-full"
          style={{ fontFamily: "var(--font-body)", fontSize: 13, background: "var(--cream)", border: "2px solid var(--ink)", color: "var(--ink)" }}
        />
      </div>
      <button onClick={submit} className="px-4 py-2.5" style={{ fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", background: "var(--pink)", color: "var(--cream)", border: "none" }}>Add</button>
      <button onClick={onCancel} className="px-2 py-2.5 opacity-60" style={{ fontFamily: "var(--font-body)", fontSize: 11, background: "none", border: "none" }}>Cancel</button>
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
