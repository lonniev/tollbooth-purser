/**
 * Whether this page acts as the owner at one Operator, and the DM that makes
 * it so. Proven once, Purser reads and pays for the owner's people there.
 */

import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound } from "lucide-react";
import { operatorClient } from "@tollbooth-dpyc/web";
import { useAppShell } from "@tollbooth-dpyc/web/react";
import { useCourier } from "../lib/useCourier";
import { CourierWait } from "./Courier";

export default function ProveAt({ operator, onProven }: { operator: string; onProven?: () => void }) {
  const { session } = useAppShell();
  const client = operatorClient(operator);
  const courier = useCourier("prove", operator, session.npub);
  const [proven, setProven] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    client.proves(session.npub).then((p) => live && setProven(p), () => live && setProven(false));
    return () => {
      live = false;
    };
  }, [client, session.npub]);

  if (proven === null) return <span className="muted text-xs">…</span>;
  if (proven) {
    return (
      <span className="flex items-center gap-1 text-xs" style={{ color: "var(--tb-ok)" }}>
        <CheckCircle2 size={14} aria-hidden /> Authenticated
      </span>
    );
  }
  if (courier.pending) {
    return (
      <CourierWait to="you" phrase={courier.pending.nonce} busy={courier.busy} problem={courier.problem}
        collectLabel="I approved" onCancel={courier.cancel}
        onCollect={() => void courier.collect(async (nonce) => {
          await client.proveFinish(session.npub, nonce);
          setProven(true);
          onProven?.();
        })} />
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      <button type="button" className="chip chip-accent" disabled={courier.busy}
        onClick={() => void courier.send(() => client.proveStart(session.npub, "Purser reads and funds your people here"))}>
        <KeyRound size={14} aria-hidden /> Authenticate here
      </button>
      {courier.problem && <span className="error w-full text-xs">{courier.problem}</span>}
    </span>
  );
}
