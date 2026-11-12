"""The books as the database is left holding them, on SQLite running the store's real SQL."""

import pytest
from pynostr.key import PrivateKey
from tollbooth.vault_encryption import VaultCipher

from purser_mcp.store import NotYours, PurserStore, StoreUnavailable
from tests.sqlite_neon import SqliteNeon


def _npub() -> str:
    return PrivateKey().public_key.bech32()


@pytest.fixture
async def books():
    neon = SqliteNeon(cipher=VaultCipher(nsec_hex=PrivateKey().hex()))
    db = PurserStore(neon)
    await db.ensure_schema()
    return neon, db


async def test_a_store_without_a_cipher_refuses_to_start():
    with pytest.raises(StoreUnavailable):
        PurserStore(SqliteNeon())


async def test_names_budgets_and_fundings_are_never_stored_in_the_clear(books):
    neon, db = books
    owner, staff = _npub(), _npub()
    org = await db.save_org(owner, "Acme Field Team")
    await db.save_member(owner, org, staff, "Sam Field")
    project = await db.save_project(owner, org, name="Spring survey", budget_sats=50_000, period="month")
    await db.record_funding(owner, org, {
        "project_id": project, "staff_npub": staff, "operator_url": "https://goodearth-mcp.fastmcp.app/mcp",
        "invoice_id": "INV-777", "sats": 1234, "paid_at": 1_700_000_000,
    })
    dump = repr([neon.rows(t) for t in ("purser_orgs", "purser_members", "purser_projects", "purser_fundings")])
    for secret in ("Acme Field Team", "Sam Field", "Spring survey", "50000", "INV-777", "1234"):
        assert secret not in dump, secret
    [funding] = await db.fundings(owner, org)
    assert funding["sats"] == 1234 and funding["invoice_id"] == "INV-777"


async def test_another_owner_can_read_and_change_nothing(books):
    _, db = books
    owner, stranger, staff = _npub(), _npub(), _npub()
    org = await db.save_org(owner, "Acme")
    for call in (
        db.members(stranger, org),
        db.save_member(stranger, org, staff, "x"),
        db.projects(stranger, org),
        db.fundings(stranger, org),
        db.save_org(stranger, "Mine now", org),
    ):
        with pytest.raises(NotYours):
            await call
    assert (await db.owned(owner, org))["name"] == "Acme"


async def test_removing_a_member_takes_them_off_projects_and_keeps_their_fundings(books):
    _, db = books
    owner, staff = _npub(), _npub()
    org = await db.save_org(owner, "Acme")
    await db.save_member(owner, org, staff, "Sam")
    project = await db.save_project(owner, org, name="P", budget_sats=10, period="none")
    assert await db.assign(owner, org, project, staff, True) == [staff]
    await db.record_funding(owner, org, {
        "project_id": project, "staff_npub": staff, "operator_url": "https://a.example/mcp",
        "invoice_id": "i1", "sats": 5, "paid_at": 1,
    })
    assert await db.remove_member(owner, org, staff)
    [p] = await db.projects(owner, org)
    assert p["staff"] == []
    assert len(await db.fundings(owner, org)) == 1


async def test_only_members_go_on_a_project(books):
    _, db = books
    owner = _npub()
    org = await db.save_org(owner, "Acme")
    project = await db.save_project(owner, org, name="P", budget_sats=10, period="none")
    with pytest.raises(NotYours, match="member"):
        await db.assign(owner, org, project, _npub(), True)


async def test_the_same_invoice_is_recorded_once(books):
    _, db = books
    owner, staff = _npub(), _npub()
    org = await db.save_org(owner, "Acme")
    project = await db.save_project(owner, org, name="P", budget_sats=10, period="none")
    funding = {"project_id": project, "staff_npub": staff, "operator_url": "https://a.example/mcp",
               "invoice_id": "i1", "sats": 5, "paid_at": 10}
    first = await db.record_funding(owner, org, funding)
    assert await db.record_funding(owner, org, {**funding, "paid_at": 20}) == first
    assert len(await db.fundings(owner, org)) == 1


async def test_the_ledger_reads_a_period_newest_first(books):
    _, db = books
    owner, staff = _npub(), _npub()
    org = await db.save_org(owner, "Acme")
    project = await db.save_project(owner, org, name="P", budget_sats=10, period="none")
    for i, at in enumerate((100, 200, 300)):
        await db.record_funding(owner, org, {"project_id": project, "staff_npub": staff,
                                             "operator_url": "https://a.example/mcp",
                                             "invoice_id": f"i{i}", "sats": 1, "paid_at": at})
    assert [f["paid_at"] for f in await db.fundings(owner, org, since=150, until=301)] == [300, 200]
