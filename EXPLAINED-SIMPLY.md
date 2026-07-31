# PayRecon, explained without the jargon

If you're not a developer (or you are, but you'd rather not read code to understand what this project *does*), this page is for you. No prior knowledge needed.

## The problem, in real life

Imagine you run an online store. A customer clicks "Buy," and their payment goes through some payment company (like Razorpay, Stripe, or PayPal) — not directly to you.

A little while later, that payment company sends your store a message: *"Hey, this payment succeeded."* Your store then marks the order as paid and ships it.

Sounds simple. Here's where it gets messy in the real world:

- What if that message gets sent **twice** (a duplicate)? You don't want to accidentally think you got paid twice for one order.
- What if the message **never arrives**, or arrives really late?
- What if the message says "paid ₹500" but your store's order says ₹550? Someone needs to notice that mismatch.
- What if the payment company's own message was wrong, and their **bank statement** (sent a day later) tells a different story?
- At the end of the day, someone needs to be able to answer: *"Exactly how much money did we actually receive, and can we prove it?"*

That whole process — checking that what the payment company *told you* matches what *actually happened*, and keeping an honest paper trail of the money — is called **reconciliation**. Every real payment company and every serious online business has to do this. PayRecon is a working model of that system.

## The story, walked through

1. **A customer places an order.** Your store records it: "order #123, ₹500, not yet paid."
2. **The payment happens somewhere else** (a payment gateway) — PayRecon has a pretend one built in for demo purposes, since we can't hook up a real bank for a portfolio project.
3. **The payment company sends your store a notification** ("webhook") saying what happened: success, failure, or "still processing." This message is *cryptographically signed* so your store can trust it really came from the payment company and wasn't faked by someone else.
4. **Your store double-checks it's not a duplicate message**, then hands it off to be reconciled.
5. **A dedicated checker (a background worker)** compares the notification against your order: same amount? same order? did it arrive suspiciously late? If anything's off, it's flagged as a mismatch instead of silently trusted.
6. **If everything checks out and money actually moved,** your store's books get updated — literally, a proper accounting entry gets written (see "the ledger" below).
7. **A day later, the bank sends a settlement file** — basically a spreadsheet listing everything that *actually* got paid into your account. PayRecon can take that file and cross-check it against everything from step 5. This catches the rare but real case where the payment company said "success" but the money never actually showed up.
8. **A dashboard shows a human** all of this at a glance — how many payments are pending, how many matched, whether anything's mismatched, and whether the books balance.

## What each piece is, in plain terms

| Piece | What it really is |
|---|---|
| **mock-gateway** | A pretend payment company. It randomly acts like a real one would: sometimes instant success, sometimes a delay, sometimes it fails, sometimes it even sends the same notification twice (on purpose, to test that duplicates are handled correctly). |
| **ingestion** | The "front desk." It's the part that takes in new orders and receives notifications from the payment company. It checks the notification is genuinely from the payment company (not faked) and isn't a duplicate before accepting it. |
| **reconciliation-worker** | The accountant. It sits quietly in the background, picks up each notification, and decides: does this match the order? Is anything suspicious? If something goes wrong while it's checking (like a database hiccup), it automatically tries again later instead of giving up. |
| **the ledger** | A proper accounting book. Every time money genuinely moves, two entries get written — one saying "money is owed to us," one saying "we owe this money out to the merchant" — the same way real accountants have always tracked money (called *double-entry bookkeeping*). If the two sides ever stopped matching, that's an "the books don't balance" emergency in real accounting — this project has an entire page dedicated to proving they always do. |
| **settlement file** | The bank's own statement. It's the second, independent check — instead of trusting the payment company's word, this compares against what the bank itself reported actually landed in the account. |
| **the dashboard** | The control room. A visual, point-and-click screen showing all of the above — no need to read raw data or type commands. |

## Why this is harder than it sounds

A junior version of this system would just be: "get notification, mark order paid, done." That breaks the moment:
- two notifications for the same payment arrive (you'd double-count money)
- a notification arrives for an order that technically doesn't exist yet (a timing problem)
- your checker crashes halfway through and needs to safely pick up where it left off, without processing the same payment twice
- thousands of payments are being checked at once, and two checkers accidentally grab the same one simultaneously

PayRecon handles all of these on purpose, not by accident — each one has a specific, tested solution in the code (see the main [README](README.md) if you want the technical detail).

## In one sentence

**PayRecon is a small, working model of the "make sure the money is real" machinery that sits quietly behind every payment button on the internet.**
