// Purser's decoration on the shared top-up tiles: from one coin to the ship's strongbox.

import { Banknote, Coins, HandCoins, ScrollText, Vault } from "lucide-react";
import type { DecorateTile } from "@tollbooth-dpyc/web/react";
import { tr } from "../i18n/index.ts";
import type { MessageKey } from "../i18n/en.ts";

const LOOKS: Record<number, { name: MessageKey; Mark: typeof Coins }> = {
  100: { name: "lib.tiles.doubloon", Mark: Coins },
  500: { name: "lib.tiles.purse", Mark: HandCoins },
  1_000: { name: "lib.tiles.wages", Mark: Banknote },
  5_000: { name: "lib.tiles.payroll", Mark: ScrollText },
  25_000: { name: "lib.tiles.strongbox", Mark: Vault },
};

export const decorateTile: DecorateTile = (sats) => {
  const look = LOOKS[sats];
  return look && { name: tr(look.name), mark: <look.Mark size={18} aria-hidden /> };
};
