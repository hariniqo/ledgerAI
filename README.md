<div align="center">
<h1>🧾 LedgerTrue</h1>
<p><b>A real-time financial state & reconciliation engine that turns conflicting, duplicate, and out-of-order payment events into one provably-consistent, explainable balance.</b></p>
<p><i>💡 Banks think balance is subtraction. We treat it as a replayable proof.</i></p>

🔗 **Live demo:** [https://ledgertrue.onrender.com](https://ledgertrue.onrender.com) &nbsp;·&nbsp; 📽️ **Video walkthrough:** _add link_
</div>

---

This contains everything you need to run LedgerTrue locally.

## 👻 What it does

Behind every "balance" number, multiple independent systems — bank core, payment gateway, UPI switch, merchant, card network — update asynchronously. When two payments race against a balance that hasn't caught up yet, both can look successful, until reconciliation later reveals the truth. That's the **Ghost Balance** problem.

LedgerTrue never mutates a balance field. Every transaction event is appended to an immutable event log, moves through an explicit state machine (`INITIATED → PROCESSING → SUCCESS/FAILED/UNKNOWN → SETTLED/RECONCILE → REVERSED/VERIFIED`), and the current balance is always **derived**, not stored — a fold/replay over the log producing both a booked balance and a real-time available balance.

Feed it 10,000 chaotic, duplicate, out-of-order events, and it returns one consistent, reproducible, explainable final state. ✅

## 🧱 Tech Stack

- 🎨 **Frontend:** React + Socket.io
- ⚙️ **Backend:** Node.js / Express (ingestion API + reconciliation worker)
- 🗄️ **Database:** MongoDB (immutable event store + double-entry ledger)
- 📨 **Queue:** Redis Streams
- 🤖 **AI (explainability only):** Claude API — generates plain-English audit notes; never decides which transactions are honored

## 🚀 Run Locally

**Prerequisites:** Node.js, MongoDB, Redis

1. Install dependencies:
   `npm install`

2. Set the following in [.env.local](.env.local):
   - `MONGODB_URI` — your MongoDB connection string
   - `REDIS_URL` — your Redis connection string
   - `CLAUDE_API_KEY` — your Claude API key
   - `JWT_SECRET` — any secret string for the operator dashboard

3. Run the app:
   `npm run dev`

4. Run the invariant-check test suite (proves sum of debits = sum of credits):
   `npm run test:invariant` 🔍

5. Trigger a demo scenario (duplicates, out-of-order events, the 10,000-event chaos batch):
   `npm run inject:chaos` 🌀

## 🎯 Demo Scenario

Priya's account shows ₹20,000. Three payment apps each get a `SUCCESS` response for ₹15,000, ₹10,000, and ₹8,000 — ₹33,000 total against a ₹20,000 balance. LedgerTrue settles the first to lock in ✅ and rejects the other two ❌ with an explicit `INSUFFICIENT_AVAILABLE_BALANCE` reason — no silent overdraft, fully reproducible on replay.

## 📜 License

MIT

