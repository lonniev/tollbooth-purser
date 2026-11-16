import { tr } from "../i18n/index.ts";

/** What the owner sends their people, so each asks the owner's npub to sponsor them. Said once. */
export const inviteText = (ownerNpub: string) => tr("lib.invite.text", { npub: ownerNpub });
