import { useEffect, useRef, useState, type ReactNode } from "react";

// Swipe a row left (touch only) to show an action behind it; a long swipe runs it straight away.
// Plain pointer events: `touch-action: pan-y` leaves up-and-down scrolling to the browser and
// sends sideways moves here. A mouse never swipes (the action is elsewhere on the row too).

const OPEN = 96; // how far the row slides to show the action
const DECIDE = 10; // px before a move counts as sideways or as a scroll

export function SwipeRow({ children, label, onAction, disabled }: { children: ReactNode; label: string; onAction: () => void; disabled?: boolean }) {
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const g = useRef<{ id: number; x0: number; y0: number; from: number; sideways: boolean | null } | null>(null);
  const swiped = useRef(false);

  // Open, a tap anywhere else closes it.
  useEffect(() => {
    if (x === 0 || dragging) return;
    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setX(0);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [x, dragging]);

  useEffect(() => {
    if (disabled) setX(0);
  }, [disabled]);

  const run = () => {
    const width = box.current?.offsetWidth ?? 400;
    setLeaving(true);
    setX(-width);
    // Let the slide finish, then do it (the row leaves the list).
    setTimeout(() => {
      onAction();
      setLeaving(false);
      setX(0);
    }, 180);
  };

  return (
    <div
      ref={box}
      className={`swipe ${x !== 0 ? "swipe-open" : ""}`}
      onPointerDown={(e) => {
        if (disabled || e.pointerType === "mouse" || leaving) return;
        g.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, from: x, sideways: null };
        swiped.current = false;
      }}
      onPointerMove={(e) => {
        const s = g.current;
        if (!s || s.id !== e.pointerId) return;
        const dx = e.clientX - s.x0;
        const dy = e.clientY - s.y0;
        if (s.sideways === null) {
          if (Math.abs(dx) < DECIDE && Math.abs(dy) < DECIDE) return;
          s.sideways = Math.abs(dx) > Math.abs(dy);
          if (!s.sideways) return void (g.current = null); // a scroll: not ours
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          swiped.current = true;
        }
        // Left only; a little give past the right edge.
        const next = s.from + dx;
        setX(next > 0 ? next / 4 : next);
      }}
      onPointerUp={(e) => {
        const s = g.current;
        g.current = null;
        if (!s?.sideways) return;
        setDragging(false);
        const width = e.currentTarget.offsetWidth;
        if (x < -width * 0.55) run();
        else setX(x < -OPEN / 2 ? -OPEN : 0);
      }}
      onPointerCancel={() => {
        g.current = null;
        setDragging(false);
        setX(0);
      }}
      // The finger lifting after a swipe isn't a tap on what's under it.
      onClickCapture={(e) => {
        if (swiped.current) {
          e.preventDefault();
          e.stopPropagation();
          swiped.current = false;
        }
      }}
    >
      <button className="swipe-action" tabIndex={-1} aria-hidden={x === 0} onClick={run} style={{ width: Math.max(OPEN, -x) }}>
        {label}
      </button>
      <div className={`swipe-front ${dragging ? "" : "swipe-settle"}`} style={x ? { transform: `translateX(${x}px)` } : undefined}>
        {children}
      </div>
    </div>
  );
}
