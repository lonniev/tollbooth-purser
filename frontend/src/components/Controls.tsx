/**
 * The controls every list page shares: a round search button that opens into
 * a field, the "Show me on the page" button, and the round + that opens the
 * page's add form. One row, the same place on every page.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CircleHelp, Plus, Search, X } from "lucide-react";
import { PageControls, tourTarget, useLanguageLocale, useTourReplay } from "@tollbooth-dpyc/web/react";
import { useT } from "../i18n";

export function AddButton({ open, onToggle, label }: { open: boolean; onToggle: () => void; label: string }) {
  const t = useT();
  return (
    <button type="button" className={open ? "fab fab-open" : "fab"} aria-expanded={open} aria-label={open ? t("ui.controls.close") : label}
      title={open ? t("ui.controls.close") : label} onClick={onToggle} {...tourTarget("page.add")}>
      {open ? <X size={20} aria-hidden /> : <Plus size={22} aria-hidden />}
    </button>
  );
}

/** A magnifier until tapped; then a field, which closes empty on Escape or ✕. */
export function SearchButton({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const t = useT();
  const [open, setOpen] = useState(Boolean(value));
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) field.current?.focus();
  }, [open]);
  const close = () => {
    onChange("");
    setOpen(false);
  };
  if (!open) {
    return (
      <button type="button" className="icon-btn" aria-label={label} title={label} onClick={() => setOpen(true)} {...tourTarget("page.search")}>
        <Search size={18} aria-hidden />
      </button>
    );
  }
  return (
    <span className="search-open" {...tourTarget("page.search")}>
      <Search size={16} aria-hidden className="muted" />
      <input ref={field} className="search-field" value={value} placeholder={label} aria-label={label}
        spellCheck={false} autoCapitalize="off" onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && close()} />
      <button type="button" className="icon-btn icon-btn-sm" aria-label={t("ui.controls.closeSearch")} onClick={close}>
        <X size={14} aria-hidden />
      </button>
    </span>
  );
}

export function HelpButton({ page }: { page: string }) {
  const t = useT();
  const replay = useTourReplay();
  return (
    <button type="button" className="icon-btn" aria-label={t("ui.controls.showMe")} title={t("ui.controls.showMe")} onClick={() => replay(page)}>
      <CircleHelp size={18} aria-hidden />
    </button>
  );
}

/** A list page's head: its title and count, then search, help and add, right-aligned. */
export function Toolbar({ title, count, children }: { title: ReactNode; count?: number; children?: ReactNode }) {
  const locale = useLanguageLocale();
  return (
    <div className="toolbar">
      <h2 className="panel-title">
        {title}
        {count !== undefined && <span className="muted num ml-3 font-normal">({count.toLocaleString(locale)})</span>}
      </h2>
      <div className="toolbar-actions">{children}</div>
    </div>
  );
}

const PAGING = { root: "paging", chip: "chip", label: "muted text-xs" };

export function Paging(p: { page: number; pageSize: number; total: number; onPage: (n: number) => void }) {
  return <PageControls {...p} hideSinglePage classNames={PAGING} />;
}
