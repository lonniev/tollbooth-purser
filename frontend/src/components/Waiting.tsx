/** A wait worth reading: the status line, then quotations on pay and work. */

import { useMemo } from "react";
import { QuoteScroller } from "@tollbooth-dpyc/web/react";
import { useT } from "../i18n";
import { purserQuotes } from "../lib/quotes";

export default function Waiting({ heading }: { heading: string }) {
  const t = useT();
  // The quotations, read again when the language changes (`t` changes with it).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const quotes = useMemo(() => purserQuotes(), [t]);
  return (
    <QuoteScroller
      quotes={quotes}
      heading={heading}
      spinner
      intervalMs={6000}
      classNames={{
        root: "waiting",
        heading: "waiting-head",
        figure: "waiting-figure",
        text: "waiting-text",
        mark: "waiting-mark",
        author: "waiting-author",
      }}
    />
  );
}
