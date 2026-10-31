# BrightLoop Subscriptions v2 — End-to-End Recurring Billing Platform

A modern subscription billing platform built according to the **BrightLoop Subscriptions Product Requirements Document (v2)**.

Runs a subscription business end to end: products and plans, multi-currency billing, pluggable payment layer with a built-in sandbox, billing dry runs with anomaly flags, AI billing assistant, dunning workflows, idle auto-end policies, proration calculators, PDF invoices, and scoped REST APIs for external services.

---

## Quick Start

Start the full stack with a single command (pure native Node.js — zero external npm installs or databases needed):

```bash
npm start
```
Or:
```bash
node server.js
```

Then visit: **`http://localhost:3000`** in your browser.

---

## Demo Personas & Credentials Quick Reference

| Persona / Service | Role | Login / API Key | Password / Secret | Loaded Demo Data |
| :--- | :--- | :--- | :--- | :--- |
| **Highest Admin** | Super Admin | `admin@brightloop.io` | `AdminPassword@2026!` | Unrestricted platform control, catalog, currencies, tax, dry runs, gateway keys. |
| **Internal Staff** | Finance Lead | `staff@brightloop.io` | `StaffPassword@2026!` | Quotations, subscriptions, manual payments, dry runs, and team reporting. |
| **Acme Corp (India)** | Customer | `priya@acmecorp.com` | `CustomerPass@2026!` | Active Enterprise Plan + Odoo Variant (₹35,559/mo), 3 invoices (all paid), UPI & card sandbox payments. |
| **Nova Global (US)** | Customer | `david@novaglobal.com` | `CustomerPass@2026!` | Growth Pro Tier ($149/mo), recent invoice failed, Dunning Reminder #1 sent. |
| **Apex Dynamics (EU)** | Customer | `elena@apexdynamics.eu` | `CustomerPass@2026!` | Growth Pro Tier (€139/mo), flagged **Idle Warning (NEW-1)** with interactive Keep, Pause, or Cancel banner. |
| **BrightCloud Compute** | External Service | `bk_live_compute_9f82a17c4b6e821d3e` | `whsec_compute_b8a3e72c8194` | Reports compute hours and storage usage via `POST /api/v1/usage-events`. |
| **BrightDesk CRM** | External Service | `bk_live_crm_718a93bc28d115e4` | `whsec_crm_55f1a942bc30` | Provisions seat licenses and quotation acceptances. |
| **BrightMetrics** | External Service | `bk_live_analytics_44e991fa8c02` | `whsec_analytics_812c33ba0981` | Ingests telemetry and queries MRR cohorts. |

*For complete details, see [CREDENTIALS.md](CREDENTIALS.md).*

---

## Key Features Implemented

1. **Brand & Visual Language (Section 9)**: Cream `#FFFBF5` background, `#000000` black pills, `#4F46E5` interactive indigo, Space Grotesk 700 headings, Inter body, TT continuous loop brand mark, dark mode toggle.
2. **One-Click Persona Switcher**: Instant switching between Super Admin, Staff, and Customers to explore their unique portal views and data.
3. **Multi-Currency & Minor Units (CUR-1 to CUR-8)**: 10 currencies (INR base, USD, EUR, GBP, AED, SGD, AUD, CAD, JPY, CHF) with explicit pricing and locked exchange rates.
4. **Billing Dry Run Engine (NEW-8)**: Staff preview table highlighting anomaly flags (idle accounts, unpaid invoices, unusual jumps) with approve/hold actions.
5. **Proration Calculator (NEW-2)**: Real-time credit and charge preview for immediate upgrades or scheduled downgrades (`credit = old price × unused days ÷ 30`).
6. **Idle Auto-End (NEW-1)**: Detects inactivity; customer portal presents Keep, Pause, or Cancel choices.
7. **Dunning Sequence (NEW-3)**: Multi-stage overdue payment reminder tracking.
8. **AI Billing Assistant (NEW-7)**: In-app drawer (`Ctrl+K`) answering questions from real subscription data with permission safety and action cards.
9. **Interactive API & Webhooks Playground**: Test external service integration directly from the browser with simulated HMAC-SHA256 signatures.
10. **Printable / PDF Invoice Layout (Section 9.8)**: Pixel-precise invoice rendering matching PRD specs.
