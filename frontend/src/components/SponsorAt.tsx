/**
 * Offer to sponsor a person at one Operator: the Operator DMs them, they
 * approve in their own app, and the owner collects the sponsorship here.
 * Whichever side asks first, both consent.
 */

import { afterApproval, afterAsk, askSides, operatorClient, type PeerGrantResult } from "@tollbooth-dpyc/web";
import { useAppShell } from "@tollbooth-dpyc/web/react";
import { useCourier } from "../lib/useCourier";
import { CourierWait } from "./Courier";

export default function SponsorAt({ operator, operatorLabel, staff, name, onGranted }: {
  operator: string; operatorLabel: string; staff: string; name: string; onGranted: () => void;
}) {
  const { session } = useAppShell();
  const op = operatorClient(operator);
  const courier = useCourier("sponsor", operator, staff);
  const sides = askSides(session.npub, staff, true);
  const pair = { patron_npub: sides.patron, peer_npub: sides.peer };

  if (courier.pending) {
    const sent = { kind: "sent" as const, ...sides, other: staff, nonce: courier.pending.nonce };
    return (
      <CourierWait to={name} phrase={sent.nonce} busy={courier.busy} problem={courier.problem}
        note={`I asked to sponsor your account at ${operatorLabel}. Please approve the DM marked "${sent.nonce}" in your Nostr app.`}
        collectLabel="They approved" onCancel={courier.cancel}
        onCollect={() => void courier.collect(async () => {
          const r = await op.callTool<PeerGrantResult>("receive_peer_grant", { ...pair, nonce: sent.nonce }, { bestEffort: true });
          const step = afterApproval(sent, r);
          if (!step.granted) throw new Error(step.problem);
          onGranted();
        })} />
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="muted text-xs">Not sponsored here yet</span>
      <button type="button" className="chip" disabled={courier.busy}
        onClick={() => void courier.send(async () => {
          const r = await op.callTool<PeerGrantResult>("request_peer_grant", pair, { bestEffort: true });
          const step = afterAsk(sides, staff, r);
          if (step.phase.kind !== "sent") throw new Error(step.problem);
          return step.phase.nonce;
        })}>
        Offer to sponsor
      </button>
      {courier.problem && <span className="error w-full text-xs">{courier.problem}</span>}
    </span>
  );
}
