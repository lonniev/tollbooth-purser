## What Purser is for

An Organization sponsors its people's use of other Tollbooth DPYC Operators.
The owner's npub owns the Organization; its members are the people it sponsors.

## Sponsorship lives at each Operator

At every Operator a member uses, the member asks the owner's npub to sponsor them with that Operator's `request_peer_grant`, or the owner offers, and the other approves a Nostr DM.
A sponsor may read the member's balance and statement there and pay their top-ups. It never spends their balance.

## Purser's own tools

`purser_save_organization`, `purser_get_organization`, `purser_save_member`, `purser_save_project`, `purser_assign_member`, `purser_set_operators`, `purser_record_funding` and `purser_funding_ledger` keep the Organization's books.
Every tool acts for the owner and needs the connection to prove that npub.
