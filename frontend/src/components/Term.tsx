/**
 * A word the page uses, and what it means, on demand: tap it for the sentence,
 * tap away or press Escape to close. It acts as the finger lifts, because the
 * iPad can drop the click.
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Info } from "lucide-react";
import { define } from "../lib/glossary";

export default function Term({ of, label }: { of: string; label?: string }) {
  const entry = define(of);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const lifted = useRef(false);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (!entry) return <>{label}</>;
  return (
    <span ref={box} className="relative inline-block">
      <button type="button" aria-expanded={open} className="term"
        onPointerUp={() => { lifted.current = true; setOpen((o) => !o); }}
        onClick={() => { if (!lifted.current) setOpen((o) => !o); lifted.current = false; }}>
        {label ?? entry.term}
        <Info size={13} aria-hidden className="term-i" />
      </button>
      {open && (
        <span role="note" className="site-menu left-0 block w-72 p-3 text-left text-sm font-normal">
          {entry.said}
          <Link to={`/guide?term=${encodeURIComponent(entry.key)}`} className="mt-2 block text-xs underline" onClick={() => setOpen(false)}>
            All the terms ›
          </Link>
        </span>
      )}
    </span>
  );
}
