"""An Organization's books, on the operator's Neon schema.

An Organization belongs to one owner npub: the sponsor. It names the people it
sponsors (members), the Projects it budgets, the Operators its people use, and
every funding it paid. The sponsoring itself happens at each Operator (a peer
grant from each member to the owner); this store keeps only what Purser adds:
who is in the Organization, what each Project may spend, and which Project
paid each invoice.

Names, labels, budgets and fundings are financial data, so each row keeps
them in one ``data_enc`` column, encrypted with the vault's cipher. The plain
columns are ids, npubs and times: what a query must match on, nothing more.
"""

from __future__ import annotations

import json
import secrets
import time
from typing import Any


class StoreUnavailable(Exception):
    """The store cannot answer; the caller should retry, never assume."""


class NotYours(LookupError):
    """No Organization with that id belongs to the caller."""


def new_id() -> str:
    return secrets.token_hex(8)


class PurserStore:
    """Neon-backed Organizations. Every read and write names the owner."""

    def __init__(self, neon_vault: Any) -> None:
        cipher = getattr(neon_vault, "_cipher", None)
        if cipher is None:
            raise StoreUnavailable("the vault has no cipher; the books would be stored in the clear")
        self._neon = neon_vault
        self._cipher = cipher

    # -- plumbing ------------------------------------------------------------

    def _t(self, table: str) -> str:
        return self._neon._t(table)

    async def _rows(self, sql: str, params: list[Any]) -> list[dict[str, Any]]:
        result = await self._neon._execute(sql, params)
        return list(result.get("rows") or [])

    def _seal(self, data: dict[str, Any]) -> str:
        return self._cipher.encrypt(json.dumps(data, separators=(",", ":")))

    def _open(self, sealed: str) -> dict[str, Any]:
        opened = json.loads(self._cipher.decrypt(sealed))
        return opened if isinstance(opened, dict) else {}

    async def ensure_schema(self) -> None:
        for sql in (
            (f"CREATE TABLE IF NOT EXISTS {self._t('purser_orgs')} ("
             "org_id TEXT PRIMARY KEY, owner_npub TEXT NOT NULL, data_enc TEXT NOT NULL, created_at BIGINT NOT NULL)"),
            f"CREATE INDEX IF NOT EXISTS idx_purser_orgs_owner ON {self._t('purser_orgs')}(owner_npub)",
            (f"CREATE TABLE IF NOT EXISTS {self._t('purser_members')} ("
             "org_id TEXT NOT NULL, staff_npub TEXT NOT NULL, data_enc TEXT NOT NULL, "
             "PRIMARY KEY (org_id, staff_npub))"),
            (f"CREATE TABLE IF NOT EXISTS {self._t('purser_projects')} ("
             "org_id TEXT NOT NULL, project_id TEXT NOT NULL, data_enc TEXT NOT NULL, "
             "PRIMARY KEY (org_id, project_id))"),
            (f"CREATE TABLE IF NOT EXISTS {self._t('purser_operators')} ("
             "org_id TEXT NOT NULL, url TEXT NOT NULL, data_enc TEXT NOT NULL, PRIMARY KEY (org_id, url))"),
            (f"CREATE TABLE IF NOT EXISTS {self._t('purser_fundings')} ("
             "org_id TEXT NOT NULL, funding_id TEXT NOT NULL, paid_at BIGINT NOT NULL, data_enc TEXT NOT NULL, "
             "PRIMARY KEY (org_id, funding_id))"),
            f"CREATE INDEX IF NOT EXISTS idx_purser_fundings_paid ON {self._t('purser_fundings')}(org_id, paid_at)",
        ):
            await self._neon._execute(sql, [])

    # -- Organizations -------------------------------------------------------

    async def owned(self, owner: str, org_id: str) -> dict[str, Any]:
        """The owner's Organization, or NotYours. Every other call goes through this."""
        rows = await self._rows(
            f"SELECT org_id, data_enc, created_at FROM {self._t('purser_orgs')} "
            "WHERE org_id = $1 AND owner_npub = $2",
            [org_id, owner],
        )
        if not rows:
            raise NotYours(f"No Organization {org_id!r} is yours.")
        return {"org_id": rows[0]["org_id"], "created_at": int(rows[0]["created_at"]),
                **self._open(rows[0]["data_enc"])}

    async def save_org(self, owner: str, name: str, org_id: str = "") -> str:
        if org_id:
            await self.owned(owner, org_id)
            await self._neon._execute(
                f"UPDATE {self._t('purser_orgs')} SET data_enc = $1 WHERE org_id = $2 AND owner_npub = $3",
                [self._seal({"name": name}), org_id, owner],
            )
            return org_id
        org_id = new_id()
        await self._neon._execute(
            f"INSERT INTO {self._t('purser_orgs')} (org_id, owner_npub, data_enc, created_at) "
            "VALUES ($1, $2, $3, $4)",
            [org_id, owner, self._seal({"name": name}), int(time.time())],
        )
        return org_id

    async def orgs_of(self, owner: str) -> list[dict[str, Any]]:
        rows = await self._rows(
            f"SELECT org_id, data_enc, created_at FROM {self._t('purser_orgs')} "
            "WHERE owner_npub = $1 ORDER BY created_at",
            [owner],
        )
        return [{"org_id": r["org_id"], "created_at": int(r["created_at"]), **self._open(r["data_enc"])}
                for r in rows]

    # -- Members -------------------------------------------------------------

    async def save_member(self, owner: str, org_id: str, staff_npub: str, label: str) -> None:
        await self.owned(owner, org_id)
        await self._neon._execute(
            f"INSERT INTO {self._t('purser_members')} (org_id, staff_npub, data_enc) VALUES ($1, $2, $3) "
            "ON CONFLICT (org_id, staff_npub) DO UPDATE SET data_enc = EXCLUDED.data_enc",
            [org_id, staff_npub, self._seal({"label": label})],
        )

    async def remove_member(self, owner: str, org_id: str, staff_npub: str) -> bool:
        """Remove a member, and their place on every Project. Fundings stay: they are history."""
        await self.owned(owner, org_id)
        rows = await self._rows(
            f"DELETE FROM {self._t('purser_members')} WHERE org_id = $1 AND staff_npub = $2 RETURNING staff_npub",
            [org_id, staff_npub],
        )
        for project in await self._projects(org_id):
            if staff_npub in project["staff"]:
                project["staff"] = [s for s in project["staff"] if s != staff_npub]
                await self._put_project(org_id, project)
        return bool(rows)

    async def members(self, owner: str, org_id: str) -> list[dict[str, Any]]:
        await self.owned(owner, org_id)
        rows = await self._rows(
            f"SELECT staff_npub, data_enc FROM {self._t('purser_members')} WHERE org_id = $1 ORDER BY staff_npub",
            [org_id],
        )
        return [{"staff_npub": r["staff_npub"], **self._open(r["data_enc"])} for r in rows]

    # -- Projects ------------------------------------------------------------

    async def _projects(self, org_id: str) -> list[dict[str, Any]]:
        rows = await self._rows(
            f"SELECT project_id, data_enc FROM {self._t('purser_projects')} WHERE org_id = $1 ORDER BY project_id",
            [org_id],
        )
        return [{"project_id": r["project_id"], **self._open(r["data_enc"])} for r in rows]

    async def _put_project(self, org_id: str, project: dict[str, Any]) -> None:
        data = {k: v for k, v in project.items() if k != "project_id"}
        await self._neon._execute(
            f"INSERT INTO {self._t('purser_projects')} (org_id, project_id, data_enc) VALUES ($1, $2, $3) "
            "ON CONFLICT (org_id, project_id) DO UPDATE SET data_enc = EXCLUDED.data_enc",
            [org_id, project["project_id"], self._seal(data)],
        )

    async def save_project(
        self, owner: str, org_id: str, *, name: str, budget_sats: int, period: str, project_id: str = "",
        purpose: str = "",
    ) -> str:
        await self.owned(owner, org_id)
        current = {p["project_id"]: p for p in await self._projects(org_id)}
        if project_id and project_id not in current:
            raise NotYours(f"No Project {project_id!r} in this Organization.")
        project = current.get(project_id) or {"project_id": new_id(), "staff": []}
        project |= {"name": name, "budget_sats": budget_sats, "period": period, "purpose": purpose}
        await self._put_project(org_id, project)
        return project["project_id"]

    async def assign(self, owner: str, org_id: str, project_id: str, staff_npub: str, on: bool) -> list[str]:
        """Put a member on a Project, or take them off. Returns the Project's staff."""
        members = {m["staff_npub"] for m in await self.members(owner, org_id)}
        if on and staff_npub not in members:
            raise NotYours("Add them as a member first.")
        project = next((p for p in await self._projects(org_id) if p["project_id"] == project_id), None)
        if project is None:
            raise NotYours(f"No Project {project_id!r} in this Organization.")
        staff = [s for s in project.get("staff", []) if s != staff_npub]
        project["staff"] = sorted([*staff, staff_npub] if on else staff)
        await self._put_project(org_id, project)
        return project["staff"]

    async def projects(self, owner: str, org_id: str) -> list[dict[str, Any]]:
        await self.owned(owner, org_id)
        return await self._projects(org_id)

    # -- Operators -----------------------------------------------------------

    async def set_operators(self, owner: str, org_id: str, operators: list[dict[str, str]]) -> None:
        """Replace the Organization's Operators with *operators* ({url, name})."""
        await self.owned(owner, org_id)
        await self._neon._execute(f"DELETE FROM {self._t('purser_operators')} WHERE org_id = $1", [org_id])
        for op in operators:
            await self._neon._execute(
                f"INSERT INTO {self._t('purser_operators')} (org_id, url, data_enc) VALUES ($1, $2, $3)",
                [org_id, op["url"], self._seal({"name": op["name"]})],
            )

    async def operators(self, owner: str, org_id: str) -> list[dict[str, Any]]:
        await self.owned(owner, org_id)
        rows = await self._rows(
            f"SELECT url, data_enc FROM {self._t('purser_operators')} WHERE org_id = $1 ORDER BY url", [org_id],
        )
        return [{"url": r["url"], **self._open(r["data_enc"])} for r in rows]

    # -- Fundings ------------------------------------------------------------

    async def record_funding(self, owner: str, org_id: str, funding: dict[str, Any]) -> str:
        """Record one paid invoice against a Project. The same invoice is recorded once."""
        await self.owned(owner, org_id)
        if not any(p["project_id"] == funding["project_id"] for p in await self._projects(org_id)):
            raise NotYours(f"No Project {funding['project_id']!r} in this Organization.")
        for known in await self.fundings(owner, org_id):
            if known["invoice_id"] == funding["invoice_id"] and known["operator_url"] == funding["operator_url"]:
                return known["funding_id"]
        funding_id = new_id()
        await self._neon._execute(
            f"INSERT INTO {self._t('purser_fundings')} (org_id, funding_id, paid_at, data_enc) VALUES ($1, $2, $3, $4)",
            [org_id, funding_id, int(funding["paid_at"]), self._seal({k: v for k, v in funding.items() if k != "paid_at"})],
        )
        return funding_id

    async def fundings(self, owner: str, org_id: str, since: int = 0, until: int = 2**62) -> list[dict[str, Any]]:
        """Every funding paid in [since, until), newest first."""
        await self.owned(owner, org_id)
        rows = await self._rows(
            f"SELECT funding_id, paid_at, data_enc FROM {self._t('purser_fundings')} "
            "WHERE org_id = $1 AND paid_at >= $2 AND paid_at < $3 ORDER BY paid_at DESC",
            [org_id, int(since), int(until)],
        )
        return [{"funding_id": r["funding_id"], "paid_at": int(r["paid_at"]), **self._open(r["data_enc"])}
                for r in rows]
