


# BrightLoop Subscriptions — Platform Credentials & Demo Services Guide

This document provides all administrative and user credentials, demo accounts, and integration keys for external services utilizing the BrightLoop platform.

---

## 1. Highest Admin Credentials (Super Admin)
*Full administrative control: catalog, plans, currencies, tax rules, discount codes, staff accounts, gateway configurations, dry runs, and audit logs.*

- **Role:** `admin` (Super Admin)
- **Email:** `admin@brightloop.io`
- **Password:** `AdminPassword@2026!`
- **Access Level:** Unrestricted platform-wide access
- **Key Capabilities:**
  - Create and configure products, variants (including brand add-ons like Odoo brand +₹560)
  - Configure multi-currency pricing across 10 currencies (INR base, USD, EUR, GBP, AED, SGD, AUD, CAD, JPY, CHF)
  - Set up regional tax rules (India CGST/SGST, IGST, EU VAT, US tax rules)
  - Manage payment gateways (Sandbox, Razorpay, Stripe) and secret keys
  - Review and approve dry runs before live billing invoice dispatch
  - Inspect append-only audit trail and AI billing assistant settings

---

## 2. Internal Staff / Finance Lead Credentials
*Operational management: quotations, subscriptions lifecycle, recording manual payments, running billing dry runs, and team reporting.*

- **Role:** `staff` (Finance & Operations Lead)
- **Email:** `staff@brightloop.io`
- **Password:** `StaffPassword@2026!`
- **Access Level:** Operational console access
- **Key Capabilities:**
  - Create quotation templates and generate branded online acceptance links
  - Transition subscriptions across lifecycle (`Draft` → `Quotation` → `Confirmed` → `Active` → `Paused` → `Closed`)
  - Execute billing dry runs and review automated anomaly flags
  - Confirm, cancel, print, and download invoices; manually record payments

---

## 3. Normal User Accounts (Customers with Pre-Loaded Demo Data)

All customer accounts meet AUTH-1 and AUTH-2 criteria (unique email, 9+ characters with uppercase, lowercase, and special character). Each account has loaded demo data reflecting different real-world subscription stages:

### A. Acme Corp — Active Indian Enterprise Customer
- **Contact:** Priya Sharma
- **Email:** `priya@acmecorp.com`
- **Password:** `CustomerPass@2026!`
- **Country & Currency:** India (`INR` ₹) | **GSTIN:** `29AABCU9603R1ZM`
- **Demo Data Loaded:**
  - **Subscription `SUB-2026-101`:** Enterprise Scale Plan + Odoo Integrated Brand Edition (₹35,559/mo), Status: `Active`
  - **Live Usage Meter:** 8,420 / 10,000 API units consumed with real-time spend cap set at ₹1,00,000
  - **Invoices:**
    - `INV-2026-001` (₹41,959.62) — **Paid** via Sandbox UPI QR
    - `INV-2026-008` (₹34,847.82) — **Paid** with `LAUNCH20` (-20%) discount via Sandbox Corporate Card
    - `INV-2026-015` (₹41,959.62) — **Confirmed** (Due for payment)
  - **Customer Portal Features:** Instant PDF download, one-click payment checkout, plan proration change preview.

---

### B. Nova Global Ltd — US Customer with Dunning Sequence
- **Contact:** David Miller
- **Email:** `david@novaglobal.com`
- **Password:** `CustomerPass@2026!`
- **Country & Currency:** United States (`USD` $) | **Tax ID:** `US-EIN-98-7654321`
- **Demo Data Loaded:**
  - **Subscription `SUB-2026-102`:** Growth Pro Plan ($149/mo), Status: `Active (At-Risk)`
  - **Health Score:** `48` ("At risk: Invoice INV-2026-012 payment failed 3 days ago. Dunning reminder 1 sent.")
  - **Invoices:**
    - `INV-2026-004` ($149.00) — **Paid** via Sandbox Stripe Visa
    - `INV-2026-012` ($149.00) — **Payment Failed** (Flagged with Dunning Reminder #1)
  - **Customer Portal Features:** Self-service retry card payment flow, proration downgrade calculator.

---

### C. Apex Dynamics — European Customer with Idle Notice (NEW-1)
- **Contact:** Elena Rostova
- **Email:** `elena@apexdynamics.eu`
- **Password:** `CustomerPass@2026!`
- **Country & Currency:** Germany (`EUR` €) | **VAT ID:** `DE987654321`
- **Demo Data Loaded:**
  - **Subscription `SUB-2026-103`:** Growth Pro Plan (€139/mo + 19% EU VAT = €165.41), Status: `Idle Warning`
  - **Health Score:** `25` ("Idle auto-end trigger. Zero API requests in past 32 days.")
  - **Idle Policy Trigger:** 30 days without API usage. Customer portal displays active warning banner with 3 choices:
    1. **Keep it** (Restarts idle timer)
    2. **Pause subscription** (Suspends billing immediately with proration credit)
    3. **Cancel subscription** (Closes cleanly with reason `idle auto-end`)
  - **Invoices:**
    - `INV-2026-009` (€165.41) — **Paid** via SEPA Direct Debit

---

## 4. Admin Credentials for External Services Using Our Platform
*These external service clients authenticate using Scoped REST API Keys and communicate with BrightLoop via idempotent endpoints and HMAC-SHA256 signed webhooks.*

### Service 1: BrightCloud Compute & Storage Service
- **Service Name:** BrightCloud Infrastructure Engine
- **Service ID:** `srv_compute_engine_01`
- **Admin API Key:** `bk_live_compute_9f82a17c4b6e821d3e`
- **Webhook Secret:** `whsec_compute_b8a3e72c8194`
- **Authorized Scopes:** `["usage:write", "subscriptions:read", "customers:read"]`
- **Webhook Endpoint:** `https://compute.brightcloud.internal/webhooks/billing`
- **Integration Role:** Transmits hourly compute hours and storage consumption via `POST /api/v1/usage-events` with idempotency keys. Reached 85% spend-cap threshold triggering automated customer notifications.

---

### Service 2: BrightDesk Support & CRM Platform
- **Service Name:** BrightDesk CRM & Helpdesk Suite
- **Service ID:** `srv_desk_crm_02`
- **Admin API Key:** `bk_live_crm_718a93bc28d115e4`
- **Webhook Secret:** `whsec_crm_55f1a942bc30`
- **Authorized Scopes:** `["subscriptions:write", "customers:write", "invoices:read", "usage:write"]`
- **Webhook Endpoint:** `https://desk.brightloop.internal/api/webhooks/billing`
- **Integration Role:** Automatically provisions customer subscriptions and agent seat licenses upon signed customer quotation acceptance.

---

### Service 3: BrightMetrics Data & Telemetry Platform
- **Service Name:** BrightMetrics Analytics Pipeline
- **Service ID:** `srv_metrics_engine_03`
- **Admin API Key:** `bk_live_analytics_44e991fa8c02`
- **Webhook Secret:** `whsec_analytics_812c33ba0981`
- **Authorized Scopes:** `["reports:read", "invoices:read", "usage:write"]`
- **Webhook Endpoint:** `https://metrics.brightloop.internal/hooks`
- **Integration Role:** Queries real-time subscription statuses, MRR cohorts, and pushes daily transaction telemetry.

---

## 5. Webhook Events Supported
External services receive HMAC-SHA256 signed payloads on state changes:
- `subscription.activated` — Triggered when quotation is accepted or subscription goes live
- `subscription.idle_warning` — Triggered when 30 days without activity is reached
- `subscription.closed` — Triggered upon expiration or idle closure
- `invoice.confirmed` — Triggered upon billing cycle generation
- `invoice.paid` — Triggered upon successful gateway or manual payment
- `invoice.overdue` — Triggered after invoice grace period
- `payment.failed` — Triggered on card/debit decline
- `usage.cap_reached` — Triggered when metered events reach 80% and 100% of defined spend caps

---

## 6. How to Run the Application
Start the full-stack system with a single command (no external database or build steps required):

```bash
node server.js
```

Then open your browser at:
`http://localhost:3000`

Use the **Quick Demo Switcher Bar** at the top of the interface to jump instantly between **Super Admin**, **Staff**, **Acme Corp**, **Nova Global**, **Apex Dynamics**, and the **External Services API Playground** without retyping credentials.

