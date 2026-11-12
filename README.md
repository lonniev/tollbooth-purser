# Purser

A Tollbooth DPYC™ Operator where an Organization sponsors its people's use of other Operators.

The owner's npub owns an Organization. Its members are the people it sponsors.
At each Operator a member uses, the member asks the owner's npub to sponsor them (`request_peer_grant` there), or the owner offers, and the other approves a Nostr DM.
A sponsor sees the member's account at that Operator and pays their top-ups. It never spends their balance.

Purser keeps what that leaves out: who is in the Organization, what each Project may spend, and which Project paid each invoice.
Its web console reads each member's statement at each Operator for the analytics.

## Tools

| Tool | What it does |
|---|---|
| `purser_save_organization` | Create an Organization you own, or rename it |
| `purser_list_organizations` | Your Organizations |
| `purser_get_organization` | One Organization: members, Projects, Operators |
| `purser_save_member` / `purser_remove_member` | The people it sponsors |
| `purser_save_project` / `purser_assign_member` | Projects, budgets and who is on them |
| `purser_set_operators` | The Operators its people use |
| `purser_record_funding` / `purser_funding_ledger` | Every invoice paid, by Project |

Every tool acts for the Organization's owner, and the connection must prove that npub.
Names, budgets and fundings are stored encrypted with the vault's cipher.

## Run locally

```
uv sync
TOLLBOOTH_NOSTR_OPERATOR_NSEC=… uv run python -m purser_mcp.server
```
