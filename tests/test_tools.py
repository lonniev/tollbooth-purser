"""The tools as a caller meets them, through FastMCP's in-memory client."""

import json

import pytest
from fastmcp import Client
from pynostr.key import PrivateKey
from tollbooth.vault_encryption import VaultCipher

from purser_mcp import server
from purser_mcp.store import PurserStore
from tests.sqlite_neon import SqliteNeon

OWNER = PrivateKey().public_key.bech32()
STAFF = PrivateKey().public_key.bech32()
GE = "https://goodearth-mcp.fastmcp.app/mcp"


@pytest.fixture
def billing(monkeypatch):
    """Stand in for the wheel's debit and rollback; the debit proves the caller."""
    calls = {"debit": 0, "rollback": 0, "proven": {OWNER, STAFF}}

    async def debit_or_deny(tool_id, npub, **kw):
        if npub not in calls["proven"]:
            return {"success": False, "error_code": "proof_required", "error": "prove it"}
        calls["debit"] += 1
        return 1

    async def rollback_debit(tool_id, npub, **kw):
        calls["rollback"] += 1

    async def same(result, npub):
        return result

    monkeypatch.setattr(server.runtime, "debit_or_deny", debit_or_deny)
    monkeypatch.setattr(server.runtime, "rollback_debit", rollback_debit)
    monkeypatch.setattr(server.runtime, "inject_low_balance_warning", same)
    for name in ("fire_and_forget_demand_increment", "fire_and_forget_supply_increment",
                 "fire_and_forget_notarize_if_stale"):
        monkeypatch.setattr(server.runtime, name, lambda *a, **k: None)
    return calls


@pytest.fixture
async def books(monkeypatch):
    db = PurserStore(SqliteNeon(cipher=VaultCipher(nsec_hex=PrivateKey().hex())))
    await db.ensure_schema()

    async def store():
        return db
    monkeypatch.setattr(server, "store", store)
    return db


async def call(tool, **args):
    async with Client(server.mcp) as c:
        result = await c.call_tool(f"purser_{tool}", args, raise_on_error=False)
    return json.loads(result.content[0].text)


async def test_an_owner_builds_an_organization(billing, books):
    org = (await call("save_organization", name="Acme", npub=OWNER))["org_id"]
    assert (await call("save_member", org_id=org, staff_npub=STAFF, label="Sam", npub=OWNER))["ok"]
    project = (await call("save_project", org_id=org, name="Spring", budget_sats=5000, npub=OWNER))["project_id"]
    assert (await call("assign_member", org_id=org, project_id=project, staff_npub=STAFF, npub=OWNER))["staff"] == [STAFF]
    assert (await call("set_operators", org_id=org, operators=[{"url": GE, "name": "Good Earth"}], npub=OWNER))["ok"]
    got = await call("get_organization", org_id=org, npub=OWNER)
    assert got["organization"]["name"] == "Acme"
    assert got["members"] == [{"staff_npub": STAFF, "label": "Sam"}]
    assert got["operators"] == [{"url": GE, "name": "Good Earth"}]
    paid = await call("record_funding", org_id=org, project_id=project, staff_npub=STAFF,
                      operator_url=GE, invoice_id="INV1", sats=1000, npub=OWNER)
    assert paid["ok"]
    ledger = await call("funding_ledger", org_id=org, npub=OWNER)
    assert ledger["total_sats"] == 1000 and ledger["fundings"][0]["invoice_id"] == "INV1"


async def test_someone_elses_organization_is_refused_and_refunded(billing, books):
    org = (await call("save_organization", name="Acme", npub=OWNER))["org_id"]
    before = billing["rollback"]
    r = await call("get_organization", org_id=org, npub=STAFF)
    assert r.get("success") is False or r.get("ok") is not True
    assert "yours" in json.dumps(r)
    assert billing["rollback"] == before + 1, "a refusal keeps no fare"


async def test_a_caller_without_proof_gets_nothing(billing, books):
    r = await call("list_organizations", npub=PrivateKey().public_key.bech32())
    assert r["error_code"] == "proof_required"


@pytest.mark.parametrize(("tool", "args", "why"), [
    ("save_member", {"staff_npub": "npub1nope", "label": "x"}, "npub"),
    ("save_member", {"staff_npub": OWNER, "label": "me"}, "yourself"),
    ("set_operators", {"operators": [{"url": "http://evil.example/mcp", "name": "x"}]}, "https"),
    ("record_funding", {"project_id": "p", "staff_npub": STAFF, "operator_url": GE,
                        "invoice_id": "i", "sats": -5}, "sats"),
    ("save_project", {"name": "P", "budget_sats": 10, "period": "fortnight"}, "period"),
])
async def test_adversarial_arguments_are_refused(billing, books, tool, args, why):
    org = (await call("save_organization", name="Acme", npub=OWNER))["org_id"]
    r = await call(tool, org_id=org, npub=OWNER, **args)
    assert why in json.dumps(r).lower() or why in json.dumps(r)
    assert r.get("ok") is not True


def test_every_domain_tool_has_a_unique_frozen_uuid():
    ids = [ti.tool_id for ti in server._DOMAIN_TOOLS]
    assert len(ids) == len(set(ids)) == 10
