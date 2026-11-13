// Purser's decoration on the shared top-up tiles: from one coin to the ship's strongbox.

import { Banknote, Coins, HandCoins, ScrollText, Vault } from "lucide-react";
import type { DecorateTile } from "@tollbooth-dpyc/web/react";

const LOOKS: Record<number, { name: string; Mark: typeof Coins }> = {
  100: { name: "Doubloon", Mark: Coins },
  500: { name: "Purse", Mark: HandCoins },
  1_000: { name: "Wages", Mark: Banknote },
  5_000: { name: "Payroll", Mark: ScrollText },
  25_000: { name: "Strongbox", Mark: Vault },
};

export const decorateTile: DecorateTile = (sats) => {
  const look = LOOKS[sats];
  return look && { name: look.name, mark: <look.Mark size={18} aria-hidden /> };
};
