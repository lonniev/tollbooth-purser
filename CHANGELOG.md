# Changelog

Changes not yet released live in `changelog.d/`, one file per change — see the README there for why, and `scripts/changelog.py` for what folds them in at release time.

## [0.1.8] — 2026-11-26

### Changed

- Runs on tollbooth-dpyc 0.131.1: patrons can sign in with a NIP-05 address (name@domain), and a mistyped one says which part to check.

## [0.1.7] — 2026-11-26

### Fixed

- Sign-in takes a NIP-05 address (name@domain) as well as an npub or nsec (@tollbooth-dpyc/web 4.2.2).

## [0.1.6] — 2026-11-25

### Changed

- Refreshed dependencies (Renovate lock-file maintenance and package updates).

## [0.1.5] — 2026-11-22

### Changed

- Runs on tollbooth-dpyc 0.129.0, which lets an operator ask its own human by Nostr DM to fund an outside account that ran dry.

## [0.1.4] — 2026-11-21

### Changed

- llms.txt opens with what to tell an owner about Purser, and leaves tool names to the server's tool list.

## [0.1.3] — 2026-11-20

### Changed

- The Profile page now sits in folding groups — You, Money, This site, Operator, About — with its panels side by side in a grid.
- Language and the tutorial switch are under You, you as a sponsor under Money, and where you are authenticated under This site.

## [0.1.2] — 2026-11-19

### Changed

- Hindi addresses the reader informally (तुम), like Spanish, Chinese and French; quotations keep their own words.

- The MCP Registry listing carries a title (Purser) and a link to https://purser.tollbooth-dpyc.com.

## [0.1.1] — 2026-11-18

### Fixed

- The MCP Registry listing publishes: its description now fits the registry's 100 characters.

## [0.1.0] — 2026-11-18

### Added

- The Ledger lists **Paid, not booked**: settled purchases at your Operators that no Project names yet, such as a top-up paid after its panel closed. **Book** names its Project, at the time it settled. `purser_record_funding` takes `paid_at` for this (at most a year back, never ahead).
- Calls by tool names each tool without its Operator's prefix, and with the Operator beside it when there are several; long names no longer clip.

- Console pages hold hundreds of people and dozens of Projects: search with the round magnifier, sort, page, and open a row in place. Each add form sits behind a round **+**.
- A person's balances are read only when their row opens, and the Overview reads accounts six at a time.
- Secure Courier DMs look the same everywhere: who got the DM, the phrase it is marked with, and one button to collect the approval. This device remembers a DM it is waiting on across reloads, and People shows who still has to approve. Offering to sponsor someone gives you a note to send them.
- A **Guide** page explains how Purser works, has a searchable list of terms, and offers walks of each page. Words on the pages show their meaning when tapped.
- Every page has a guided tour, which the **?** button replays and a Live tutorial switch turns on or off.
- The Profile adds "You as a sponsor" (your npub and the invitation to copy), "Where you are proven" (Prove me here at each Operator), and the tutorial switch.

- The web console at purser.tollbooth-dpyc.com. Overview: funded, used, calls, sats per call and runway, each against the prior period; top people and Operators; usage by Operator by day; calls by tool; credited and used running totals; expired by person; Project budgets this period. People: each member's balance at each Operator, a top-up from the owner's wallet booked to a Project, and an offer to sponsor where none is granted yet. Projects, Ledger with CSV export, and Setup for the Organization and its Operators from the Oracle.

- Every Project, person and Operator named on the Ledger, Overview and a person's Balance at Operators is a link that opens it; an Operator opens on Setup, outlined.

- Adding a person on People takes an npub field: checked as typed, shown as a chiclet with their Nostr name, picture and NIP-05.

- A link to the site previews with a share image: the dashboard for a sample organization over the ship at payday (`og:image`, 1200×630).

- Organizations has its own page, left of Projects: a table of every Organization (with its count) whose people, Projects and Operators are links; a row opens it to rename, show it, and choose its Operators. Setup and the header's gear are gone; the Organization's name sits at the top left.
- "Prove yourself" is now "Authenticate" ("Authenticate here", "Authenticated").

- Overview links every entity it names: Project budgets open their Project, Calls by tool opens the tool's Operator, and Expired opens the person; their labels and bars both link.

- The site wears "Payday on the Ship" as its backdrop, washed so cards and headings stay legible in both themes; the home page introduces Purser on a card over it.

- A Project may say why it exists, in a sentence or two (`save_project` takes an optional `purpose`).
- Projects: the count stands apart as "(12)", "Projects" carries an (i) definition that links to its place in the Terms, and Funded says since when it counts.
- A top-up made from People books itself to its Project on the Ledger, even when the wallet took the page away before it settled.
- The Organization's name sits at the right of every console page, with a switcher when there are several and a link to its settings.
- Numbers and their headers are right-aligned, and tables read at full size.
- People: a person's Projects are links (two shown, the rest as "+N"), and Projects link back to their people; `?open=` opens a Project or person on any page.
- An open person reads as sections: their npub with Copy, "Balance at Operators" with each Operator's last top-up and an amber Top up, their Projects, and "Remove from <Organization>" that says what it does and what stays.
- The invitation is a ✉ copy button on People and a "Invite your people" topic in the Guide.

- Purser, an Operator where an Organization sponsors its people's use of Tollbooth DPYC Operators. The owner's npub owns an Organization: its members, Projects with budgets, the Operators its people use, and a ledger of every funding it paid. Names, budgets and fundings are stored encrypted.

- Purser reads in English, French, Spanish, Japanese, Chinese and Hindi. A guest starts in their country's language; the chooser is on Profile. The shared web package does the translating; Purser supplies only its words.

- Wallet top-up tiles are dressed as a purser's coin: Doubloon, Purse, Wages, Payroll and Strongbox, brass rising tile to tile; the balance sits to the right.
- Waits show quotations on paying people, working, and building your own, while the Organization, the Ledger and the Overview load.

### Changed

- Ledger says "Assign to Project" and "Top-ups Purchased" in place of "To book" and "Fundings"; the button is Assign.

- Setup finds Operators instead of listing them all: search by name or words, or paste an Operator's npub, and add the ones your people use. At each, **Prove me here** proves your npub once by DM, so the console can read and fund your people there without your key in the browser (tollbooth-web 3.6.0). People sends you to Setup for an Operator you have not proven yourself at.

- Each page loads on first visit, so the console opens faster; Overview's charts arrive with Overview.

### Fixed

- Pages use the width the screen gives them: the page grows to 90rem (it stopped at 72rem), and the home card and the sign-in card no longer stop partway across.

- The Setup page lists the Operators again: the Oracle was refusing the call because the web package added an npub to it (tollbooth-web 3.5.2).
