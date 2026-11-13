/**
 * A Secure Courier DM on its way, drawn the same everywhere: who it went to,
 * the phrase it is marked with, what they do in their own app, and the one
 * button that collects the approval. Collecting is a deliberate tap: the
 * Operator hands the approval over once, so the page never asks on a timer.
 */

import { CheckCircle2, Copy, Send, Smartphone } from "lucide-react";
import type { ReactNode } from "react";

export function CourierWait({ to, phrase, note, busy, problem, collectLabel, onCollect, onCancel }: {
  /** "you", or the person's name. */
  to: ReactNode;
  phrase: string;
  /** A message to copy and send to them, when the DM is someone else's to approve. */
  note?: string;
  busy: boolean;
  problem: string;
  collectLabel: string;
  onCollect: () => void;
  onCancel: () => void;
}) {
  const self = to === "you";
  return (
    <div className="courier" role="status" aria-live="polite">
      <ol className="courier-steps">
        <li><Send size={14} aria-hidden /> A DM went to {to}</li>
        <li><Smartphone size={14} aria-hidden /> {self ? "Open Pricing Studio or your Nostr app" : "They open their Nostr app"}</li>
        <li><CheckCircle2 size={14} aria-hidden /> Approve the one marked <span className="phrase">{phrase}</span></li>
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="chip chip-accent" disabled={busy} onClick={onCollect}>
          {busy ? "Looking…" : collectLabel}
        </button>
        {note && (
          <button type="button" className="chip" onClick={() => void navigator.clipboard?.writeText(note)} title="Copy a note to send them">
            <Copy size={14} aria-hidden /> Note for them
          </button>
        )}
        <button type="button" className="chip" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
      {problem && <p className="error text-xs">{problem}</p>}
    </div>
  );
}
