"""Purser — an Organization sponsors its people's use of Tollbooth DPYC Operators.

Standard DPYC tools (check_balance, purchase_credits, Secure Courier, Oracle,
pricing, peer grants) come from ``register_standard_tools`` in the
tollbooth-dpyc wheel. Only the Organization's books are defined here.

The sponsoring itself happens at each Operator: a member asks the owner's npub
to sponsor them there (``request_peer_grant``), or the owner offers. The owner
then reads each member's account and pays their top-up invoices at that
Operator, from Purser's web console, as their own npub. Purser keeps what that
leaves out: who is in the Organization, what each Project may spend, and which
Project paid each invoice.

Run locally:
    python -m purser_mcp.server
"""

from __future__ import annotations

import logging
import time
from typing import Any
from urllib.parse import urlparse

from fastmcp import FastMCP
from mcp.types import Icon
from tollbooth.credential_templates import CredentialTemplate, FieldSpec
from tollbooth.credential_validators import validate_btcpay_creds
from tollbooth.params import PatronNpub
from tollbooth.runtime import OperatorRuntime, register_standard_tools
from tollbooth.tool_identity import (
    DELETES,
    READS,
    STANDARD_IDENTITIES,
    WRITES,
    ToolIdentity,
)

from purser_mcp import __version__
from purser_mcp.store import NotYours, PurserStore

logger = logging.getLogger(__name__)

SITE_URL = "purser.tollbooth-dpyc.com"

mcp = FastMCP(
    "purser-mcp",
    version=__version__,
    website_url=f"https://{SITE_URL}",
    icons=[Icon(src="https://tollbooth-dpyc.com/dpyc-logo.png", mimeType="image/png")],
    instructions=(
        "Purser — an Organization sponsors its people's use of Tollbooth DPYC "
        "Operators. Monetized via Tollbooth DPYC Bitcoin Lightning micropayments.\n\n"
        "## How it works\n"
        "The owner's npub owns an Organization. Its members are the people it "
        "sponsors. At each Operator a member uses, the member asks the owner's "
        "npub to sponsor them (request_peer_grant at that Operator), or the owner "
        "offers; the other approves a Nostr DM. A sponsor sees the member's "
        "account there and pays their top-ups. It never spends their balance.\n\n"
        "## Tools\n"
        "purser_save_organization creates or renames an Organization; "
        "purser_list_organizations lists the caller's. purser_get_organization "
        "returns one whole: members, Projects and Operators. purser_save_member, "
        "purser_remove_member, purser_save_project and purser_assign_member "
        "keep its people and budgets. purser_set_operators names the Operators "
        "its people use. purser_record_funding records an invoice the owner paid "
        "against a Project; purser_funding_ledger lists them.\n\n"
        "Every tool acts for the Organization's owner, and the connection must "
        "prove that npub. The web console at https://purser.tollbooth-dpyc.com "
        "does all of this, and reads each member's statement at each Operator "
        "for the analytics.\n\n"
        "## Pricing\n"
        "Tool prices are set by the operator's pricing model. Use "
        "`purser_check_price` to preview and `purser_check_balance` to see your balance."
    ),
)

# ---------------------------------------------------------------------------
# Tool registry
# ---------------------------------------------------------------------------

# Frozen UUIDs — minted once at tool birth and never changed.
SAVE_ORG_UUID = "10a481ff-3af6-44bc-aaa5-ffc414e8c0c5"
LIST_ORGS_UUID = "93ae72a8-3f87-4db0-b235-94b5c1c8bb97"
GET_ORG_UUID = "9fb9d9c0-009d-4348-a857-899b45b23e7b"
SAVE_MEMBER_UUID = "fd76d94b-769e-4737-b251-6d8a561f2e61"
REMOVE_MEMBER_UUID = "0ad5420b-b1b8-4991-9e28-4ffe8a5b47c3"
SAVE_PROJECT_UUID = "5a244ed7-9ece-450c-b2af-4eb7c7db9268"
ASSIGN_MEMBER_UUID = "99da56a5-2bd6-4090-b1e0-c3fc6c13e623"
SET_OPERATORS_UUID = "0ab23606-d337-43fd-872e-2521201982fe"
RECORD_FUNDING_UUID = "deb63ef1-2ac7-45d8-b980-7e1c3ba0ebae"
FUNDING_LEDGER_UUID = "ae490ab4-fe23-4420-a209-8cf6d96a56fc"

_DOMAIN_TOOLS = [
    ToolIdentity(tool_id=SAVE_ORG_UUID, capability="save_organization", category="write",
                 title="Save an Organization", behavior=WRITES,
                 intent="Create an Organization the caller owns, or rename one"),
    ToolIdentity(tool_id=LIST_ORGS_UUID, capability="list_organizations", category="read",
                 title="List Organizations", behavior=READS,
                 intent="List the Organizations the caller owns"),
    ToolIdentity(tool_id=GET_ORG_UUID, capability="get_organization", category="read",
                 title="Get an Organization", behavior=READS,
                 intent="One Organization whole: members, Projects and Operators"),
    ToolIdentity(tool_id=SAVE_MEMBER_UUID, capability="save_member", category="write",
                 title="Save a member", behavior=WRITES,
                 intent="Add a person the Organization sponsors, or relabel them"),
    ToolIdentity(tool_id=REMOVE_MEMBER_UUID, capability="remove_member", category="write",
                 title="Remove a member", behavior=DELETES,
                 intent="Take a person out of the Organization and its Projects"),
    ToolIdentity(tool_id=SAVE_PROJECT_UUID, capability="save_project", category="write",
                 title="Save a Project", behavior=WRITES,
                 intent="Create or change a Project and its budget"),
    ToolIdentity(tool_id=ASSIGN_MEMBER_UUID, capability="assign_member", category="write",
                 title="Assign a member", behavior=WRITES,
                 intent="Put a member on a Project, or take them off"),
    ToolIdentity(tool_id=SET_OPERATORS_UUID, capability="set_operators", category="write",
                 title="Set Operators", behavior=WRITES,
                 intent="Name the Operators the Organization's people use"),
    ToolIdentity(tool_id=RECORD_FUNDING_UUID, capability="record_funding", category="write",
                 title="Record a funding", behavior=WRITES,
                 intent="Record an invoice the owner paid against a Project"),
    ToolIdentity(tool_id=FUNDING_LEDGER_UUID, capability="funding_ledger", category="read",
                 title="Funding ledger", behavior=READS,
                 intent="Every funding the Organization paid in a period"),
]

TOOL_REGISTRY: dict[str, ToolIdentity] = {ti.tool_id: ti for ti in _DOMAIN_TOOLS}

runtime = OperatorRuntime(
    tool_registry={**STANDARD_IDENTITIES, **TOOL_REGISTRY},
    operator_credential_template=CredentialTemplate(
        service="purser-operator",
        version=1,
        description="Operator credentials for BTCPay Lightning payments",
        fields={
            "btcpay_host": FieldSpec(
                required=True, sensitive=True,
                description="The URL of your BTCPay Server instance (e.g. https://btcpay.example.com).",
            ),
            "btcpay_api_key": FieldSpec(
                required=True, sensitive=True,
                description="Your BTCPay Server API key. Generate one under Account > Manage Account > API Keys.",
            ),
            "btcpay_store_id": FieldSpec(
                required=True, sensitive=True,
                description="Your BTCPay Store ID. Find it under Stores > Settings > General.",
            ),
        },
    ),
    operator_credential_greeting=(
        "Hi — I'm Purser, an MCP service where an Organization sponsors its "
        "people's use of Tollbooth DPYC Operators. You (or your AI agent) "
        "requested a credential channel."
    ),
    service_name="Purser",
    credential_validator=validate_btcpay_creds,
    holder_auth_url="https://purser-mcp.fastmcp.app",
)

tool = register_standard_tools(
    mcp,
    "purser",
    runtime,
    service_name="purser",
    service_version=__version__,
)

_STORE: PurserStore | None = None


async def store() -> PurserStore:
    global _STORE
    if _STORE is None:
        created = PurserStore(await runtime.vault())
        await created.ensure_schema()
        _STORE = created
    return _STORE


# ---------------------------------------------------------------------------
# Input checks — every argument is adversarial
# ---------------------------------------------------------------------------

MAX_TEXT = 80
PERIODS = ("month", "quarter", "year", "none")
#: One funding is one Lightning top-up; more than this is a typo, not a purchase.
MAX_FUNDING_SATS = 10_000_000


def _text(value: str, what: str) -> str:
    cleaned = " ".join(str(value).split())
    if not cleaned:
        raise ValueError(f"{what} is required.")
    if len(cleaned) > MAX_TEXT:
        raise ValueError(f"{what} is at most {MAX_TEXT} characters.")
    return cleaned


def _npub(value: str, what: str) -> str:
    err = runtime.npub_validation_error(value, param=what)
    if err is not None:
        raise ValueError(err.get("error") or f"{what} is not an npub.")
    return runtime.resolve_npub(value)


def _sats(value: int, what: str, *, ceiling: int | None = None) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError(f"{what} is a whole number of sats, 0 or more.")
    if ceiling is not None and value > ceiling:
        raise ValueError(f"{what} is at most {ceiling:,} sats.")
    return value


def _operator_url(value: str) -> str:
    url = str(value).strip()
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.netloc or not parsed.path.endswith("/mcp"):
        raise ValueError("An Operator is its MCP endpoint: https://…/mcp.")
    return url


#: How far back a settled invoice may be booked: a year of books.
MAX_BOOKING_AGE = 366 * 86_400


def _paid_at(value: int) -> int:
    now = int(time.time())
    if not value:
        return now
    when = _sats(value, "paid_at")
    if when > now + 300 or when < now - MAX_BOOKING_AGE:
        raise ValueError("paid_at is when it settled: not in the future, and within the past year.")
    return when


async def _owned(npub: str, org_id: str) -> PurserStore:
    """The store, once the caller is shown to own *org_id*. A refusal raises, so the fare is refunded."""
    db = await store()
    try:
        await db.owned(npub, str(org_id))
    except NotYours as exc:
        raise ValueError(str(exc)) from None
    return db


async def _store_call(coro: Any) -> Any:
    try:
        return await coro
    except NotYours as exc:
        raise ValueError(str(exc)) from None


# ---------------------------------------------------------------------------
# Organizations
# ---------------------------------------------------------------------------


@tool
@runtime.paid_tool(SAVE_ORG_UUID)
async def save_organization(name: str, org_id: str = "", npub: PatronNpub = "") -> dict[str, Any]:
    """Create an Organization you own, or rename one of yours.

    Args:
        name: What to call it, e.g. "Acme Field Team".
        org_id: An Organization of yours to rename. Omit to create a new one.
    """
    db = await store()
    saved = await _store_call(db.save_org(npub, _text(name, "name"), str(org_id)))
    return {"ok": True, "org_id": saved}


@tool
@runtime.paid_tool(LIST_ORGS_UUID)
async def list_organizations(npub: PatronNpub = "") -> dict[str, Any]:
    """List the Organizations you own."""
    return {"ok": True, "organizations": await (await store()).orgs_of(npub)}


@tool
@runtime.paid_tool(GET_ORG_UUID)
async def get_organization(org_id: str, npub: PatronNpub = "") -> dict[str, Any]:
    """One of your Organizations whole: its members, Projects and Operators.

    Args:
        org_id: The Organization.
    """
    db = await _owned(npub, org_id)
    return {
        "ok": True,
        "organization": await db.owned(npub, org_id),
        "members": await db.members(npub, org_id),
        "projects": await db.projects(npub, org_id),
        "operators": await db.operators(npub, org_id),
    }


# ---------------------------------------------------------------------------
# Members and Projects
# ---------------------------------------------------------------------------


@tool
@runtime.paid_tool(SAVE_MEMBER_UUID)
async def save_member(org_id: str, staff_npub: str, label: str, npub: PatronNpub = "") -> dict[str, Any]:
    """Add a person your Organization sponsors, or change their label.

    Adding them here keeps your books. To see and fund their account at an
    Operator, they ask your npub to sponsor them there (or you offer).

    Args:
        org_id: The Organization.
        staff_npub: Their npub.
        label: What to call them, e.g. "Sam (field)".
    """
    staff = _npub(staff_npub, "staff_npub")
    if staff == runtime.resolve_npub(npub):
        raise ValueError("You own this Organization; you need not sponsor yourself.")
    db = await _owned(npub, org_id)
    await db.save_member(npub, org_id, staff, _text(label, "label"))
    return {"ok": True, "staff_npub": staff}


@tool
@runtime.paid_tool(REMOVE_MEMBER_UUID)
async def remove_member(org_id: str, staff_npub: str, npub: PatronNpub = "") -> dict[str, Any]:
    """Take a person out of your Organization and off its Projects.

    Their past fundings stay in the ledger. Their sponsorship at each Operator
    is separate: end it there with revoke_peer_grant.

    Args:
        org_id: The Organization.
        staff_npub: Their npub.
    """
    staff = _npub(staff_npub, "staff_npub")
    db = await _owned(npub, org_id)
    return {"ok": True, "removed": await db.remove_member(npub, org_id, staff)}


@tool
@runtime.paid_tool(SAVE_PROJECT_UUID)
async def save_project(
    org_id: str, name: str, budget_sats: int, period: str = "month",
    project_id: str = "", npub: PatronNpub = "",
) -> dict[str, Any]:
    """Create a Project with a budget, or change one.

    Args:
        org_id: The Organization.
        name: What to call it.
        budget_sats: What it may spend each period, in sats.
        period: "month", "quarter", "year", or "none" for one budget in all.
        project_id: A Project to change. Omit to create a new one.
    """
    if period not in PERIODS:
        raise ValueError(f"period is one of {', '.join(PERIODS)}.")
    db = await _owned(npub, org_id)
    saved = await _store_call(db.save_project(
        npub, org_id, name=_text(name, "name"), budget_sats=_sats(budget_sats, "budget_sats"),
        period=period, project_id=str(project_id),
    ))
    return {"ok": True, "project_id": saved}


@tool
@runtime.paid_tool(ASSIGN_MEMBER_UUID)
async def assign_member(
    org_id: str, project_id: str, staff_npub: str, assigned: bool = True, npub: PatronNpub = "",
) -> dict[str, Any]:
    """Put a member on a Project, or take them off.

    Args:
        org_id: The Organization.
        project_id: The Project.
        staff_npub: The member's npub.
        assigned: True to put them on, False to take them off.
    """
    staff = _npub(staff_npub, "staff_npub")
    db = await _owned(npub, org_id)
    on_project = await _store_call(db.assign(npub, org_id, str(project_id), staff, bool(assigned)))
    return {"ok": True, "staff": on_project}


@tool
@runtime.paid_tool(SET_OPERATORS_UUID)
async def set_operators(org_id: str, operators: list[dict[str, str]], npub: PatronNpub = "") -> dict[str, Any]:
    """Name the Operators your Organization's people use. Replaces the list.

    Args:
        org_id: The Organization.
        operators: Each {"url": "https://…/mcp", "name": "Good Earth"}, as the
            Oracle's list_services names them.
    """
    if not isinstance(operators, list):
        raise ValueError("operators is a list of {url, name}.")  # noqa: TRY004 — a refusal raises ValueError so the fare is refunded
    cleaned: dict[str, dict[str, str]] = {}
    for op in operators:
        if not isinstance(op, dict):
            raise ValueError("operators is a list of {url, name}.")  # noqa: TRY004 — refund on refusal
        url = _operator_url(op.get("url", ""))
        cleaned[url] = {"url": url, "name": _text(op.get("name", ""), "name")}
    db = await _owned(npub, org_id)
    await db.set_operators(npub, org_id, list(cleaned.values()))
    return {"ok": True, "operators": len(cleaned)}


# ---------------------------------------------------------------------------
# Fundings
# ---------------------------------------------------------------------------


@tool
@runtime.paid_tool(RECORD_FUNDING_UUID)
async def record_funding(
    org_id: str, project_id: str, staff_npub: str, operator_url: str,
    invoice_id: str, sats: int, paid_at: int = 0, npub: PatronNpub = "",
) -> dict[str, Any]:
    """Record a top-up you paid for a member, against a Project.

    Purser's console calls this once check_payment at the Operator says the
    invoice settled, or when it books a settled invoice it finds in the
    member's statement there. Recording the same invoice again changes nothing.

    Args:
        org_id: The Organization.
        project_id: The Project that pays for it.
        staff_npub: The member whose account it credited.
        operator_url: The Operator's MCP endpoint, https://…/mcp.
        invoice_id: The invoice id the Operator gave.
        sats: What you paid, in sats.
        paid_at: When it settled, in unix seconds, as the Operator's statement
            says. Omit for now. It may not be in the future or more than a
            year past.
    """
    staff = _npub(staff_npub, "staff_npub")
    funding = {
        "project_id": str(project_id),
        "staff_npub": staff,
        "operator_url": _operator_url(operator_url),
        "invoice_id": _text(invoice_id, "invoice_id"),
        "sats": _sats(sats, "sats", ceiling=MAX_FUNDING_SATS),
        "paid_at": _paid_at(paid_at),
    }
    db = await _owned(npub, org_id)
    if staff not in {m["staff_npub"] for m in await db.members(npub, org_id)}:
        raise ValueError("They are not a member of this Organization.")
    funding_id = await _store_call(db.record_funding(npub, org_id, funding))
    return {"ok": True, "funding_id": funding_id}


@tool
@runtime.paid_tool(FUNDING_LEDGER_UUID)
async def funding_ledger(org_id: str, since: int = 0, until: int = 0, npub: PatronNpub = "") -> dict[str, Any]:
    """Every funding your Organization paid in a period, newest first.

    Args:
        org_id: The Organization.
        since: Unix seconds; omit for the beginning.
        until: Unix seconds; omit for now.
    """
    db = await _owned(npub, org_id)
    rows = await db.fundings(npub, org_id, _sats(since, "since"), _sats(until, "until") or 2**62)
    return {"ok": True, "fundings": rows, "total_sats": sum(int(r.get("sats", 0)) for r in rows)}


if __name__ == "__main__":
    mcp.run()
