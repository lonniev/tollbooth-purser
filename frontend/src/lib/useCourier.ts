/**
 * One Secure Courier exchange at one Operator: send the DM, remember its
 * phrase on this device, collect the approval once, forget it.
 */

import { useCallback, useState } from "react";
import { forgetPending, pendingFor, rememberPending, type Pending, type PendingKind } from "./pending";

export function useCourier(kind: PendingKind, operator: string, npub: string) {
  const [pending, setPending] = useState<Pending | null>(() => pendingFor(kind, operator, npub));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  const run = useCallback(async (step: () => Promise<void>) => {
    setBusy(true);
    setProblem("");
    try {
      await step();
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  /** `start` sends the DM and answers its phrase. */
  const send = (start: () => Promise<string>) => run(async () => {
    const nonce = await start();
    if (!nonce) throw new Error("The Operator sent no DM.");
    const p = { kind, operator, npub, nonce, sentAt: Date.now() };
    rememberPending(p);
    setPending(p);
  });

  /** `finish` collects the approval for the phrase; it throws while there is none. */
  const collect = (finish: (nonce: string) => Promise<void>) => run(async () => {
    if (!pending) return;
    await finish(pending.nonce);
    forgetPending(kind, operator, npub);
    setPending(null);
  });

  const cancel = () => {
    forgetPending(kind, operator, npub);
    setPending(null);
    setProblem("");
  };

  return { pending, busy, problem, send, collect, cancel };
}
