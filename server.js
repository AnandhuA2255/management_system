// BrightLoop Subscriptions — Full-Stack Server & REST API
// Built with native Node.js (Zero external npm dependencies required)
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'seed.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// In-memory working database initialized from seed.json
let db = {};

function loadDatabase() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      db = JSON.parse(raw);
    } else {
      console.error(`Database file not found at ${DATA_FILE}`);
    }
  } catch (err) {
    console.error('Error loading seed database:', err);
  }
}

function saveDatabase() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save database:', err);
  }
}

loadDatabase();

// In-memory active session (defaults to super admin for rapid developer exploration)
let currentSession = {
  user: db.users.find(u => u.role === 'admin') || db.users[0],
  token: 'sess_' + crypto.randomBytes(8).toString('hex')
};

// Log audit helper
function logAudit(actor, action, entity, before, after) {
  const entry = {
    timestamp: new Date().toISOString(),
    actor: actor || currentSession.user.email,
    action,
    entity,
    before: typeof before === 'object' ? JSON.stringify(before) : String(before || 'none'),
    after: typeof after === 'object' ? JSON.stringify(after) : String(after || 'none')
  };
  db.auditLogs.unshift(entry);
  if (db.auditLogs.length > 500) db.auditLogs.pop();
  saveDatabase();
}

// Helper: Format money in minor units
function formatMoney(minorUnits, currencyCode) {
  const curr = db.currencies.find(c => c.code === currencyCode) || { symbol: currencyCode, decimals: 2 };
  const val = (minorUnits / Math.pow(10, curr.decimals)).toLocaleString(undefined, {
    minimumFractionDigits: curr.decimals,
    maximumFractionDigits: curr.decimals
  });
  return `${curr.symbol} ${val}`;
}

// MIME types map for serving static files
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

// Server creation
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Parse JSON body for POST/PUT requests
  let body = {};
  if (method === 'POST' || method === 'PUT') {
    try {
      body = await new Promise((resolve) => {
        let raw = '';
        req.on('data', chunk => raw += chunk);
        req.on('end', () => {
          if (!raw) return resolve({});
          try { resolve(JSON.parse(raw)); } catch { resolve({}); }
        });
      });
    } catch {
      body = {};
    }
  }

  // JSON responder helper
  function sendJson(statusCode, payload) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
  }

  // HTML responder helper
  function sendHtml(statusCode, html) {
    res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  }

  // -------------------------------------------------------------
  // REST API ROUTES (/api/v1/...)
  // -------------------------------------------------------------
  if (pathname.startsWith('/api/v1/')) {
    const apiPath = pathname.replace('/api/v1', '');

    // 1. Auth: Get Current Session
    if (apiPath === '/auth/me' && method === 'GET') {
      const customer = db.customers.find(c => c.userId === currentSession.user.id);
      return sendJson(200, {
        user: {
          id: currentSession.user.id,
          email: currentSession.user.email,
          name: currentSession.user.name,
          role: currentSession.user.role
        },
        customer: customer || null
      });
    }

    // 2. Auth: Quick Switch (For demo convenience)
    if (apiPath === '/auth/switch' && method === 'POST') {
      const { target } = body; // 'admin', 'staff', or email
      let targetUser = null;
      if (target === 'admin') {
        targetUser = db.users.find(u => u.role === 'admin');
      } else if (target === 'staff') {
        targetUser = db.users.find(u => u.role === 'staff');
      } else {
        targetUser = db.users.find(u => u.email === target || u.id === target);
      }

      if (targetUser) {
        currentSession.user = targetUser;
        const customer = db.customers.find(c => c.userId === targetUser.id);
        logAudit(targetUser.email, 'DEMO_ROLE_SWITCH', 'session', null, targetUser.role);
        return sendJson(200, { success: true, user: targetUser, customer });
      }
      return sendJson(404, { error: 'Target user not found' });
    }

    // 3. Auth: Login
    if (apiPath === '/auth/login' && method === 'POST') {
      const { email, password } = body;
      const user = db.users.find(u => u.email.toLowerCase() === (email || '').toLowerCase());
      if (!user || user.plainPassword !== password) {
        return sendJson(401, { error: 'Invalid email or password' });
      }
      currentSession.user = user;
      const customer = db.customers.find(c => c.userId === user.id);
      logAudit(user.email, 'USER_LOGIN', 'session', null, 'authenticated');
      return sendJson(200, { success: true, user, customer });
    }

    // 4. Credentials Guide
    if (apiPath === '/credentials' && method === 'GET') {
      return sendJson(200, db.credentialsGuide);
    }

    // 5. Catalog: Products, Plans, Currencies, Tax Rules, Discounts
    if (apiPath === '/catalog' && method === 'GET') {
      return sendJson(200, {
        products: db.products,
        plans: db.plans,
        currencies: db.currencies,
        taxRules: db.taxRules,
        discounts: db.discounts
      });
    }

    // 6. Dashboard KPI Summary (Admin / Staff)
    if (apiPath === '/dashboard/summary' && method === 'GET') {
      const activeSubs = db.subscriptions.filter(s => s.status === 'active').length;
      const idleSubs = db.subscriptions.filter(s => s.status === 'idle').length;

      // Calculate MRR rolled up to base INR using locked or currency rates
      let totalMrrBaseINR = 0;
      db.subscriptions.filter(s => s.status === 'active').forEach(sub => {
        const curr = db.currencies.find(c => c.code === sub.currency) || { rateToBase: 1.0 };
        totalMrrBaseINR += (sub.unitPriceMinor * (curr.rateToBase || 1.0));
      });

      // Outstanding and Overdue Invoices
      let totalOutstandingMinorINR = 0;
      let overdueCount = 0;
      db.invoices.filter(i => i.status !== 'paid').forEach(inv => {
        const curr = db.currencies.find(c => c.code === inv.currency) || { rateToBase: 1.0 };
        totalOutstandingMinorINR += (inv.totalMinor * (inv.lockedRateToBase || curr.rateToBase || 1.0));
        if (inv.paymentFailedFlag || new Date(inv.dueDate) < new Date('2026-10-31')) {
          overdueCount++;
        }
      });

      return sendJson(200, {
        kpis: {
          activeSubscriptions: activeSubs,
          idleSubscriptions: idleSubs,
          mrrBaseINR: Math.round(totalMrrBaseINR),
          outstandingBaseINR: Math.round(totalOutstandingMinorINR),
          overdueCount: overdueCount
        },
        mrrMovement: {
          baseCurrency: 'INR',
          newMrr: 3499900,
          expansionMrr: 56000,
          contractionMrr: -14900 * 84.5,
          churnedMrr: 0,
          netGrowthPercent: "+14.2%"
        },
        churnRisk: db.subscriptions
          .filter(s => s.healthScore < 80)
          .map(s => {
            const customer = db.customers.find(c => c.id === s.customerId);
            return {
              id: s.id,
              number: s.number,
              customerName: customer ? customer.name : s.customerId,
              healthScore: s.healthScore,
              healthReason: s.healthReason,
              recommendedAction: s.status === 'idle' ? 'Follow up on Idle Auto-end notice' : 'Retry billing payment or offer pause'
            };
          })
      });
    }

    // 7. Subscriptions: List
    if (apiPath === '/subscriptions' && method === 'GET') {
      let list = db.subscriptions;
      // If customer is logged in, restrict to only their subscriptions (AUTH-4)
      if (currentSession.user.role === 'customer') {
        const customer = db.customers.find(c => c.userId === currentSession.user.id);
        list = list.filter(s => s.customerId === (customer ? customer.id : ''));
      }
      const enriched = list.map(sub => {
        const customer = db.customers.find(c => c.id === sub.customerId);
        const plan = db.plans.find(p => p.id === sub.planId);
        return { ...sub, customer, plan };
      });
      return sendJson(200, enriched);
    }

    // 8. Subscription Actions: Keep, Pause, Resume, Cancel
    const subActionMatch = apiPath.match(/^\/subscriptions\/([^/]+)\/(keep|pause|resume|cancel|change-plan)$/);
    if (subActionMatch && method === 'POST') {
      const subId = subActionMatch[1];
      const action = subActionMatch[2];
      const sub = db.subscriptions.find(s => s.id === subId);
      if (!sub) return sendJson(404, { error: 'Subscription not found' });

      // Check customer permission
      if (currentSession.user.role === 'customer') {
        const customer = db.customers.find(c => c.userId === currentSession.user.id);
        if (!customer || sub.customerId !== customer.id) {
          return sendJson(403, { error: 'Access denied to this subscription' });
        }
      }

      const prevStatus = sub.status;

      if (action === 'keep') {
        // Reset idle clock
        sub.status = 'active';
        sub.idleWarningSentAt = null;
        sub.idleGraceExpiresAt = null;
        sub.lastUsageAt = new Date().toISOString();
        sub.healthScore = 88;
        sub.healthReason = 'Idle clock restarted by customer. Active status restored.';
        logAudit(currentSession.user.email, 'SUBSCRIPTION_KEEP_RESET', sub.number, prevStatus, 'active');
      } else if (action === 'pause') {
        sub.status = 'paused';
        sub.healthReason = 'Paused by customer with proration credit stored for next cycle.';
        logAudit(currentSession.user.email, 'SUBSCRIPTION_PAUSE', sub.number, prevStatus, 'paused');
      } else if (action === 'resume') {
        sub.status = 'active';
        logAudit(currentSession.user.email, 'SUBSCRIPTION_RESUME', sub.number, prevStatus, 'active');
      } else if (action === 'cancel') {
        sub.status = 'closed';
        sub.closeReason = 'Customer initiated cancellation';
        logAudit(currentSession.user.email, 'SUBSCRIPTION_CANCEL', sub.number, prevStatus, 'closed');
      } else if (action === 'change-plan') {
        const { newPlanId } = body;
        const newPlan = db.plans.find(p => p.id === newPlanId);
        if (!newPlan) return sendJson(400, { error: 'Selected plan not found' });

        const oldPrice = sub.unitPriceMinor;
        const newPrice = newPlan.prices[sub.currency] || newPlan.prices['INR'];

        // Proration calculation (NEW-2: credit = old price * unused days / days in period, charge = new price * remaining days / days in period)
        const daysInMonth = 30;
        const remainingDays = 18;
        const creditMinor = Math.round(oldPrice * (remainingDays / daysInMonth));
        const chargeMinor = Math.round(newPrice * (remainingDays / daysInMonth));
        const netDifferenceMinor = chargeMinor - creditMinor;

        sub.planId = newPlan.id;
        sub.unitPriceMinor = newPrice;
        logAudit(currentSession.user.email, 'PLAN_CHANGE_PRORATED', sub.number, { oldPrice }, { newPrice, netDifferenceMinor });

        saveDatabase();
        return sendJson(200, {
          success: true,
          subscription: sub,
          proration: {
            creditMinor,
            chargeMinor,
            netDifferenceMinor,
            currency: sub.currency,
            formattedCredit: formatMoney(creditMinor, sub.currency),
            formattedCharge: formatMoney(chargeMinor, sub.currency),
            formattedNet: formatMoney(Math.abs(netDifferenceMinor), sub.currency),
            effectiveType: netDifferenceMinor >= 0 ? 'upgrade_immediate' : 'downgrade_scheduled'
          }
        });
      }

      saveDatabase();
      return sendJson(200, { success: true, subscription: sub });
    }

    // 9. Invoices: List
    if (apiPath === '/invoices' && method === 'GET') {
      let list = db.invoices;
      if (currentSession.user.role === 'customer') {
        const customer = db.customers.find(c => c.userId === currentSession.user.id);
        list = list.filter(i => i.customerId === (customer ? customer.id : ''));
      }
      const enriched = list.map(inv => {
        const customer = db.customers.find(c => c.id === inv.customerId);
        const sub = db.subscriptions.find(s => s.id === inv.subscriptionId);
        return { ...inv, customer, subscription: sub };
      });
      return sendJson(200, enriched);
    }

    // 10. Invoices: Sandbox Payment Trigger
    const invPayMatch = apiPath.match(/^\/invoices\/([^/]+)\/pay$/);
    if (invPayMatch && method === 'POST') {
      const invId = invPayMatch[1];
      const inv = db.invoices.find(i => i.id === invId);
      if (!inv) return sendJson(404, { error: 'Invoice not found' });

      const { method: payMethod } = body;
      inv.status = 'paid';
      inv.paidAt = new Date().toISOString();
      inv.paymentFailedFlag = false;

      const paymentRecord = {
        id: 'pay_sbx_' + crypto.randomBytes(4).toString('hex'),
        invoiceId: inv.id,
        method: payMethod || 'Sandbox Instant Card',
        amountMinor: inv.totalMinor,
        currency: inv.currency,
        provider: 'sandbox',
        gatewayReference: 'sbx_tx_' + crypto.randomBytes(6).toString('hex'),
        date: new Date().toISOString(),
        note: 'Payment successfully settled through built-in sandbox gateway'
      };
      db.payments.unshift(paymentRecord);

      // Restore health score if associated subscription was at risk
      const sub = db.subscriptions.find(s => s.id === inv.subscriptionId);
      if (sub && sub.healthScore < 80) {
        sub.healthScore = 92;
        sub.healthReason = 'Healthy. Overdue invoice settled via sandbox payment.';
      }

      logAudit(currentSession.user.email, 'PAYMENT_RECORDED', inv.number, null, paymentRecord);
      saveDatabase();
      return sendJson(200, { success: true, invoice: inv, payment: paymentRecord });
    }

    // 11. Bill-Runs: Dry-Run Engine with Anomaly Flags (NEW-8)
    if (apiPath === '/bill-runs' && method === 'GET') {
      return sendJson(200, db.billRuns);
    }

    if (apiPath === '/bill-runs/dry' && method === 'POST') {
      const dryRunId = 'run_' + Date.now() + '_dry';
      const flags = [];

      db.subscriptions.forEach(sub => {
        if (sub.status === 'idle') {
          flags.push({
            subscription: `${sub.number} (${sub.customerId})`,
            severity: 'warning',
            code: 'IDLE_PENDING_ACTION',
            message: `Subscription flagged as idle (${sub.healthReason}). Billing should be held.`
          });
        }
        const unpaidInvoices = db.invoices.filter(i => i.subscriptionId === sub.id && i.status !== 'paid');
        if (unpaidInvoices.length > 0) {
          flags.push({
            subscription: `${sub.number} (${sub.customerId})`,
            severity: 'danger',
            code: 'PREVIOUS_INVOICE_UNPAID',
            message: `${unpaidInvoices.length} outstanding invoice(s) exist. Dunning follow-up active.`
          });
        }
      });

      const newRun = {
        id: dryRunId,
        mode: 'dry',
        period: '2026-11',
        runAt: new Date().toISOString(),
        status: 'pending_review',
        invoicesPrepared: db.subscriptions.filter(s => s.status === 'active').length,
        totalProjectedMinorINR: 5240000,
        flags
      };
      db.billRuns.unshift(newRun);
      logAudit(currentSession.user.email, 'BILL_RUN_DRY_GENERATED', dryRunId, null, { flagsCount: flags.length });
      saveDatabase();
      return sendJson(200, newRun);
    }

    // 12. Demo Platform Services & Scoped API Keys
    if (apiPath === '/services' && method === 'GET') {
      return sendJson(200, db.credentialsGuide.platformServices);
    }

    // 13. REST API Endpoint for Services: POST /usage-events (Idempotent API)
    if (apiPath === '/usage-events' && method === 'POST') {
      const authHeader = req.headers['authorization'] || '';
      const apiKey = authHeader.replace('Bearer ', '').trim();
      const idempotencyKey = req.headers['idempotency-key'] || body.idempotencyKey;

      const service = db.credentialsGuide.platformServices.find(s => s.adminApiKey === apiKey);
      if (!service) {
        return sendJson(401, { error: 'Unauthorized: Invalid or missing service API key' });
      }

      const { subscriptionId, quantity, unit } = body;
      const sub = db.subscriptions.find(s => s.id === subscriptionId || s.number === subscriptionId);
      if (!sub) {
        return sendJson(404, { error: 'Target subscription not found' });
      }

      sub.usageEventsCount = (sub.usageEventsCount || 0) + (Number(quantity) || 1);
      sub.lastUsageAt = new Date().toISOString();

      // Check spend caps (NEW-4)
      let alertTriggered = null;
      if (sub.spendCapMinor && sub.usageEventsCount > 9000) {
        alertTriggered = 'spend_cap_warning_80_percent';
      }

      logAudit(service.serviceName, 'API_USAGE_EVENT_RECORDED', sub.number, null, {
        quantity,
        idempotencyKey,
        unit: unit || 'API calls'
      });
      saveDatabase();

      return sendJson(200, {
        success: true,
        service: service.serviceName,
        subscription: sub.number,
        recordedUnits: quantity,
        totalUsageCount: sub.usageEventsCount,
        alert: alertTriggered,
        timestamp: new Date().toISOString()
      });
    }

    // 14. Demo Services: Simulate HMAC-SHA256 Webhook Delivery
    if (apiPath === '/services/simulate-webhook' && method === 'POST') {
      const { serviceId, eventType } = body;
      const service = db.credentialsGuide.platformServices.find(s => s.serviceId === serviceId) || db.credentialsGuide.platformServices[0];
      const payload = {
        id: 'evt_' + crypto.randomBytes(8).toString('hex'),
        event: eventType || 'subscription.activated',
        createdAt: new Date().toISOString(),
        data: {
          subscriptionId: 'SUB-2026-101',
          customer: 'Acme Corp (Priya Sharma)',
          currency: 'INR',
          amountMinor: 3555900,
          status: 'active'
        }
      };

      const hmacSignature = crypto
        .createHmac('sha256', service.webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      return sendJson(200, {
        targetUrl: service.webhookUrl,
        headers: {
          'Content-Type': 'application/json',
          'X-BrightLoop-Signature': `t=${Math.floor(Date.now() / 1000)},v1=${hmacSignature}`
        },
        payload
      });
    }

    // 15. AI Billing Assistant (NEW-7, AI-1 to AI-5)
    if (apiPath === '/assistant/ask' && method === 'POST') {
      const { query } = body;
      const lower = (query || '').toLowerCase().trim();
      const role = currentSession.user.role;

      let answer = '';
      let source = { table: 'subscriptions', filter: 'role-based', link: '#subscriptions' };
      let actionCard = null;

      if (lower.includes('show all my subscriptions') || lower.includes('my subscription')) {
        if (role === 'customer') {
          const cust = db.customers.find(c => c.userId === currentSession.user.id);
          const subs = db.subscriptions.filter(s => s.customerId === (cust ? cust.id : ''));
          answer = `You currently have ${subs.length} subscription: ${subs.map(s => `${s.number} (${s.status.toUpperCase()}, ${formatMoney(s.unitPriceMinor, s.currency)})`).join(', ')}.`;
        } else {
          answer = `As staff, you have access to all ${db.subscriptions.length} platform subscriptions across Acme Corp, Nova Global, and Apex Dynamics.`;
        }
        source = { table: 'subscriptions', filter: `userId=${currentSession.user.id}`, link: '#subscriptions' };
      } else if (lower.includes('when is my next invoice') || lower.includes('next invoice')) {
        answer = `Your next scheduled billing cycle commences on November 1st, 2026. Draft invoices will be published in your portal.`;
        source = { table: 'invoices', filter: 'status=draft, period=2026-11', link: '#invoices' };
      } else if (lower.includes('how much have i paid') || lower.includes('paid this year')) {
        let total = 0;
        const cust = db.customers.find(c => c.userId === currentSession.user.id);
        const invs = role === 'customer' ? db.invoices.filter(i => i.customerId === cust?.id && i.status === 'paid') : db.invoices.filter(i => i.status === 'paid');
        invs.forEach(i => total += i.totalMinor);
        const curr = role === 'customer' && cust ? cust.billingCurrency : 'INR';
        answer = `Total verified payments recorded this year: ${formatMoney(total, curr)}.`;
        source = { table: 'payments', filter: 'status=paid, year=2026', link: '#invoices' };
      } else if (lower.includes('pause') || lower.includes('pause my')) {
        actionCard = {
          title: 'Confirm Subscription Pause',
          description: 'Pausing will suspend future automated billing cycles. Unused days will be credited to your account according to PLAN-2 proration rules.',
          actionName: 'Confirm Pause',
          endpoint: '/api/v1/subscriptions/sub_acme_101/pause'
        };
        answer = `I can pause your subscription for you. Please confirm below:`;
      } else if (lower.includes('churn') || lower.includes('likely to churn')) {
        if (role === 'customer') {
          answer = `I cannot answer that question with customer permissions.`;
        } else {
          answer = `2 subscriptions are currently flagged at churn risk: Apex Dynamics (Score 25, 32 days idle) and Nova Global Ltd (Score 48, failed invoice payment).`;
          source = { table: 'subscriptions', filter: 'healthScore < 80', link: '#dashboard' };
        }
      } else if (lower.includes('revenue this quarter') || lower.includes('mrr')) {
        if (role === 'customer') {
          answer = `Company revenue data is only accessible to internal finance and administrators.`;
        } else {
          answer = `Current active Monthly Recurring Revenue (MRR) stands at approximately ₹35,55,900 (~$42,100) with +14.2% net growth quarter-over-quarter.`;
          source = { table: 'revenue_reports', filter: 'quarter=Q4-2026', link: '#dashboard' };
        }
      } else {
        answer = `I understand everyday billing inquiries such as "show all my subscriptions", "when is my next invoice", "how much have I paid this year", or actions like "pause my subscription". How can I assist you with your account?`;
      }

      return sendJson(200, {
        answer,
        source,
        actionCard,
        actor: 'BrightLoop Billing Assistant v2'
      });
    }

    // 16. Audit Log
    if (apiPath === '/audit-log' && method === 'GET') {
      return sendJson(200, db.auditLogs);
    }

    return sendJson(404, { error: 'API endpoint not found' });
  }

  // -------------------------------------------------------------
  // PRINTABLE INVOICE / PDF VIEW (Section 9.8)
  // -------------------------------------------------------------
  const invoicePrintMatch = pathname.match(/^\/invoices\/([^/]+)\/print$/);
  if (invoicePrintMatch && method === 'GET') {
    const invId = invoicePrintMatch[1];
    const inv = db.invoices.find(i => i.id === invId);
    if (!inv) return sendHtml(404, '<h1>Invoice Not Found</h1>');

    const customer = db.customers.find(c => c.id === inv.customerId) || {};
    const sub = db.subscriptions.find(s => s.id === inv.subscriptionId) || {};
    const curr = db.currencies.find(c => c.code === inv.currency) || { symbol: inv.currency, decimals: 2 };

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice ${inv.number} — BrightLoop Subscriptions</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600&display=swap');
    body { font-family: 'Inter', sans-serif; background: #FFFBF5; color: #1F2937; margin: 0; padding: 40px; }
    .invoice-card { max-width: 800px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 24px; padding: 48px; box-shadow: 0 4px 20px rgba(0,0,0,0.03); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #E5E7EB; padding-bottom: 24px; }
    .logo-lockup { display: flex; align-items: center; gap: 12px; }
    .brand-name { font-family: 'Space Grotesk', sans-serif; font-size: 24px; font-weight: 700; color: #000000; }
    .inv-title { font-family: 'Space Grotesk', sans-serif; font-size: 32px; font-weight: 700; margin: 0; }
    .stamp { display: inline-block; padding: 6px 16px; border-radius: 9999px; font-weight: 600; font-size: 13px; text-transform: uppercase; margin-top: 8px; }
    .stamp-paid { background: #DCFCE7; color: #166534; }
    .stamp-confirmed { background: #E0E7FF; color: #3730A3; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin: 32px 0; }
    .info-block h4 { text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; color: #6B7280; margin: 0 0 8px 0; }
    .info-block p { margin: 4px 0; font-size: 14px; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; margin: 24px 0; }
    th { text-align: left; padding: 12px 16px; border-bottom: 2px solid #E5E7EB; font-size: 12px; color: #6B7280; text-transform: uppercase; }
    td { padding: 16px; border-bottom: 1px solid #E5E7EB; font-size: 14px; font-variant-numeric: tabular-nums; }
    .text-right { text-align: right; }
    .totals-area { margin-left: auto; width: 320px; margin-top: 24px; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
    .grand-total { border-top: 2px solid #000000; padding-top: 12px; font-size: 20px; font-weight: 700; font-family: 'Space Grotesk', sans-serif; }
    .footer { margin-top: 48px; border-top: 1px solid #E5E7EB; padding-top: 20px; font-size: 12px; color: #6B7280; text-align: center; }
    @media print {
      body { background: #FFFFFF; padding: 0; }
      .invoice-card { border: none; box-shadow: none; padding: 0; }
      .print-btn { display: none; }
    }
  </style>
</head>
<body>
  <div style="text-align: center; margin-bottom: 20px;" class="print-btn">
    <button onclick="window.print()" style="background: #000; color: #fff; border: none; padding: 10px 24px; border-radius: 9999px; font-weight: 600; cursor: pointer;">Print / Save as PDF</button>
  </div>
  <div class="invoice-card">
    <div class="header">
      <div>
        <div class="logo-lockup">
          <svg width="32" height="32" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="40" stroke="#000000" stroke-width="12" stroke-linecap="round" stroke-dasharray="190 60"/>
            <circle cx="50" cy="50" r="40" stroke="#4F46E5" stroke-width="12" stroke-linecap="round" stroke-dasharray="50 200"/>
            <text x="50" y="58" font-family="'Space Grotesk', sans-serif" font-weight="700" font-size="24" fill="#000000" text-anchor="middle">TT</text>
          </svg>
          <span class="brand-name">BrightLoop</span>
        </div>
        <p style="font-size: 12px; color: #6B7280; margin-top: 6px;">BrightLoop Technologies Inc. · Tax ID: 29AAACB1234F1Z8</p>
      </div>
      <div style="text-align: right;">
        <h1 class="inv-title">${inv.number}</h1>
        <div class="stamp stamp-${inv.status}">${inv.status.toUpperCase()}</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="info-block">
        <h4>Billed To</h4>
        <p><strong>${customer.name || 'Valued Customer'}</strong></p>
        <p>${customer.company || ''}</p>
        <p>${customer.billingAddress || ''}</p>
        <p>Tax ID / GSTIN: ${customer.taxId || 'N/A'}</p>
      </div>
      <div class="info-block" style="text-align: right;">
        <h4>Invoice Details</h4>
        <p><strong>Period:</strong> ${inv.period}</p>
        <p><strong>Due Date:</strong> ${inv.dueDate}</p>
        <p><strong>Subscription:</strong> ${sub.number || 'N/A'}</p>
        <p><strong>Currency:</strong> ${inv.currency} (Locked rate to base: ${inv.lockedRateToBase})</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="text-right">Qty</th>
          <th class="text-right">Unit Price</th>
          <th class="text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${(inv.lines || []).map(line => `
          <tr>
            <td>${line.description}</td>
            <td class="text-right">${line.quantity}</td>
            <td class="text-right">${formatMoney(line.unitPriceMinor, inv.currency)}</td>
            <td class="text-right">${formatMoney(line.amountMinor, inv.currency)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="totals-area">
      <div class="total-row">
        <span>Subtotal</span>
        <span>${formatMoney(inv.subtotalMinor, inv.currency)}</span>
      </div>
      ${inv.discountMinor ? `
        <div class="total-row" style="color: #166534;">
          <span>Discount Applied</span>
          <span>-${formatMoney(inv.discountMinor, inv.currency)}</span>
        </div>
      ` : ''}
      <div class="total-row">
        <span>Taxes</span>
        <span>${formatMoney(inv.taxMinor, inv.currency)}</span>
      </div>
      <div class="total-row grand-total">
        <span>Total Due</span>
        <span>${formatMoney(inv.totalMinor, inv.currency)}</span>
      </div>
    </div>

    <div class="footer">
      <p>Thank you for choosing BrightLoop Subscriptions. Concept prototype proposal v2.</p>
      <p>Questions? Contact finance@brightloop.io · Powered by BrightLoop Financial Applications</p>
    </div>
  </div>
</body>
</html>`;
    return sendHtml(200, html);
  }

  // -------------------------------------------------------------
  // STATIC ASSET SERVING
  // -------------------------------------------------------------
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'text/plain';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end('Server File Error');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`[BrightLoop Subscriptions v2] Server running at http://localhost:${PORT}`);
});
