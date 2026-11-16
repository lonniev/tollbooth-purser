/**
 * Choose some of many: the chosen as chips, and a search that offers the rest.
 * A short list is offered whole; a long one only as it is searched, so a page
 * of hundreds stays a page.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, X } from "lucide-react";
import { searchMatcher } from "@tollbooth-dpyc/web";
import { useT } from "../i18n";

export interface Pickable {
  id: string;
  label: string;
  /** More words the search reads, such as an npub. */
  also?: string;
}

const OFFER_ALL = 12;
const OFFER_SOME = 8;

export default function PickMany({ items, chosen, onToggle, label, busy = false, href }: {
  items: Pickable[];
  chosen: ReadonlySet<string>;
  onToggle: (id: string, on: boolean) => void;
  label: string;
  busy?: boolean;
  /** Where a chosen item's page is, so its chip opens it. */
  href?: (id: string) => string;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const on = items.filter((i) => chosen.has(i.id));
  const hit = searchMatcher(query.trim());
  const rest = items.filter((i) => !chosen.has(i.id) && hit(`${i.label} ${i.also ?? ""}`));
  const offered = query.trim() || items.length <= OFFER_ALL ? rest.slice(0, OFFER_SOME) : [];

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-1.5">
        {on.length === 0 && <span className="muted text-sm">{t("ui.pickMany.none")}</span>}
        {on.map((i) => href ? (
          <span key={i.id} className="chip chip-on chip-split">
            <Link to={href(i.id)} className="chip-link">{i.label}</Link>
            <button type="button" className="chip-x" disabled={busy} onClick={() => onToggle(i.id, false)}
              aria-label={t("ui.pickMany.takeOff", { name: i.label })} title={t("ui.pickMany.takeOff", { name: i.label })}>
              <X size={13} aria-hidden />
            </button>
          </span>
        ) : (
          <button key={i.id} type="button" className="chip chip-on" disabled={busy} onClick={() => onToggle(i.id, false)} aria-label={t("ui.pickMany.takeOff", { name: i.label })}>
            {i.label} <X size={12} aria-hidden />
          </button>
        ))}
      </div>
      {on.length < items.length && (
        <input className="field" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={label} aria-label={label} spellCheck={false} autoCapitalize="off" />
      )}
      {offered.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {offered.map((i) => (
            <button key={i.id} type="button" className="chip" disabled={busy} onClick={() => { onToggle(i.id, true); setQuery(""); }}>
              <Plus size={12} aria-hidden /> {i.label}
            </button>
          ))}
          {rest.length > offered.length && <span className="muted self-center text-xs">{t("ui.pickMany.more", { count: rest.length - offered.length })}</span>}
        </div>
      )}
    </div>
  );
}
