/**
 * A Secure Courier DM on its way, drawn the same everywhere: who it went to,
 * the phrase it is marked with, what they do in their own app, and the one
 * button that collects the approval. Collecting is a deliberate tap: the
 * Operator hands the approval over once, so the page never asks on a timer.
 */

import { CheckCircle2, Copy, Send, Smartphone } from "lucide-react";
import { Tx } from "@tollbooth-dpyc/web/react";
import { useT, WORDS } from "../i18n";

export function CourierWait({ to, phrase, note, busy, problem, collectLabel, onCollect, onCancel }: {
  /** The person's name; none when the DM went to you. */
  to?: string;
  phrase: string;
  /** A message to copy and send to them, when the DM is someone else's to approve. */
  note?: string;
  busy: boolean;
  problem: string;
  collectLabel: string;
  onCollect: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const self = to === undefined;
  return (
    <div className="courier" role="status" aria-live="polite">
      <ol className="courier-steps">
        <li><Send size={14} aria-hidden /> {self ? t("ui.courier.wentToYou") : t("ui.courier.wentTo", { name: to })}</li>
        <li><Smartphone size={14} aria-hidden /> {self ? t("ui.courier.openSelf") : t("ui.courier.openThey")}</li>
        <li><CheckCircle2 size={14} aria-hidden /> <Tx ns={WORDS} k="ui.courier.approve" components={{ phrase: <span className="phrase">{phrase}</span> }} /></li>
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="chip chip-accent" disabled={busy} onClick={onCollect}>
          {busy ? t("ui.courier.looking") : collectLabel}
        </button>
        {note && (
          <button type="button" className="chip" onClick={() => void navigator.clipboard?.writeText(note)} title={t("ui.courier.noteTitle")}>
            <Copy size={14} aria-hidden /> {t("ui.courier.note")}
          </button>
        )}
        <button type="button" className="chip" disabled={busy} onClick={onCancel}>{t("ui.courier.cancel")}</button>
      </div>
      {problem && <p className="error text-xs">{problem}</p>}
    </div>
  );
}
