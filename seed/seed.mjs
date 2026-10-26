// Seeds the incident-tables database with demo data.
// Safe to re-run: rows that already exist are skipped.
import { Client, TablesDB } from "node-appwrite";

const { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY } = process.env;
if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
  console.error("Missing values. Fill in APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID and APPWRITE_API_KEY in seed/.env");
  process.exit(1);
}

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);
const tablesDB = new TablesDB(client);

// Find the database and tables by name, so no IDs need to be copied by hand.
const { databases } = await tablesDB.list({});
const db = databases.find((d) => d.name === "incident-tables");
if (!db) throw new Error('Database "incident-tables" not found');
const { tables } = await tablesDB.listTables({ databaseId: db.$id });
const tableId = (name) => {
  const t = tables.find((x) => x.name === name);
  if (!t) throw new Error(`Table "${name}" not found`);
  return t.$id;
};

const counts = {};
async function put(table, rowId, data) {
  try {
    await tablesDB.createRow({ databaseId: db.$id, tableId: tableId(table), rowId, data });
    counts[table] = (counts[table] || 0) + 1;
  } catch (e) {
    if (e.code === 409) return; // already exists
    throw new Error(`${table}/${rowId}: ${e.message}`);
  }
}

// ---------- data ----------
const services = [
  ["payments-api", "Payments"], ["auth-service", "Platform"], ["checkout-web", "Storefront"],
  ["search-service", "Discovery"], ["notifications", "Platform"], ["orders-db", "Data"],
  ["inventory-api", "Supply"], ["cdn-edge", "Infrastructure"],
];

const symptoms = [
  ["502", "502 errors"], ["latency", "High latency"], ["redis", "Redis timeout"],
  ["db-conn", "DB connection pool exhausted"], ["oom", "Out-of-memory kills"], ["cpu", "CPU spike"],
  ["disk", "Disk full"], ["cert", "TLS certificate expired"], ["dns", "DNS resolution failures"],
  ["queue", "Queue backlog"], ["login", "Login failures"], ["deploy", "Started right after a deploy"],
  ["429", "429 rate limiting"], ["cache-miss", "Cache miss storm"],
];

const fixes = [
  ["restart-pool", "Restart the connection pool", "1. Drain traffic from one node.\n2. Restart the app's connection pool.\n3. Watch error rate for 10 minutes."],
  ["rollback", "Roll back the release", "1. Identify the last good release.\n2. Redeploy it.\n3. Confirm error rate returns to normal."],
  ["scale-out", "Scale out instances", "Add instances behind the load balancer until latency recovers."],
  ["renew-cert", "Renew the TLS certificate", "Issue a new certificate, deploy it, and verify the full chain."],
  ["clear-disk", "Clear logs and expand disk", "Rotate and delete old logs, then expand the volume."],
  ["warm-cache", "Warm the cache before traffic", "Pre-load hot keys, then send traffic back gradually."],
  ["raise-limits", "Raise memory limits", "Increase the memory limit and add an alert at 80% usage."],
  ["purge-queue", "Drain and replay the queue", "Restart the stuck consumer, then replay unprocessed messages."],
  ["dns-failover", "Fail over DNS", "Point DNS at the healthy origin and lower the TTL."],
  ["add-index", "Add the missing database index", "Create the index concurrently, then re-check slow queries."],
  ["block-crawler", "Block abusive crawler traffic", "Add a rule for the offending user agent or IP range."],
];

// [id, title, summary, severity, daysAgo, outcome (minutes to resolve, or "open"/"investigating"), service, symptoms, fixes]
const incidents = [
  ["01", "Payments API returning 502s during peak", "Checkout payments failed intermittently with 502 errors after traffic doubled.", "critical", 40, 95, "payments-api", ["502", "latency", "redis"], ["restart-pool", "scale-out"]],
  ["02", "Redis timeouts slow down session lookups", "Session reads hit timeouts and pages loaded slowly for logged-in users.", "high", 38, 60, "auth-service", ["redis", "latency"], ["restart-pool"]],
  ["03", "Checkout page 502 after Friday release", "Customers saw 502 errors right after the evening deploy.", "critical", 35, 25, "checkout-web", ["502", "deploy"], ["rollback"]],
  ["04", "Orders database connection pool exhausted", "New orders failed because the app could not get database connections.", "critical", 33, 70, "orders-db", ["db-conn", "latency"], ["restart-pool", "add-index"]],
  ["05", "TLS certificate expired on the CDN edge", "Browsers showed security warnings on the main site.", "critical", 30, 45, "cdn-edge", ["cert"], ["renew-cert"]],
  ["06", "Search service out-of-memory restarts", "Pods restarted repeatedly and search results were slow.", "high", 28, 120, "search-service", ["oom", "latency"], ["raise-limits", "scale-out"]],
  ["07", "Notification queue backlog delays emails", "Order confirmation emails arrived hours late.", "medium", 27, 180, "notifications", ["queue"], ["purge-queue", "scale-out"]],
  ["08", "Login failures after auth deploy", "Users could not sign in after a config change shipped.", "high", 25, 35, "auth-service", ["login", "deploy"], ["rollback"]],
  ["09", "Disk full on the inventory API host", "Writes failed once logs filled the disk.", "high", 24, 50, "inventory-api", ["disk"], ["clear-disk"]],
  ["10", "DNS resolution failures for the CDN origin", "The CDN intermittently could not resolve its origin.", "critical", 22, 85, "cdn-edge", ["dns", "502"], ["dns-failover"]],
  ["11", "Cache miss storm overloads product search", "A cache flush sent every request straight to the database.", "high", 21, 55, "search-service", ["cache-miss", "latency", "cpu"], ["warm-cache"]],
  ["12", "Payments Redis timeouts at month end", "Billing jobs saturated Redis and checkout slowed down.", "high", 20, 75, "payments-api", ["redis", "latency", "queue"], ["restart-pool", "purge-queue"]],
  ["13", "Rate limiting blocks legitimate traffic", "A tightened limit returned 429s to normal users.", "medium", 19, 40, "checkout-web", ["429", "deploy"], ["rollback"]],
  ["14", "CPU spike on search nodes", "A runaway query pegged CPU and slowed all searches.", "high", 18, 65, "search-service", ["cpu", "latency"], ["add-index", "scale-out"]],
  ["15", "Orders DB connections leak after release", "Connection count climbed until new orders failed.", "critical", 17, 90, "orders-db", ["db-conn", "deploy", "502"], ["rollback", "restart-pool"]],
  ["16", "Auth service 502 behind the load balancer", "The load balancer returned 502 while pods restarted.", "high", 16, 30, "auth-service", ["502", "oom"], ["raise-limits"]],
  ["17", "Slow checkout from a cache stampede", "Cache expiry at midnight caused a burst of slow requests.", "medium", 15, 40, "checkout-web", ["cache-miss", "latency"], ["warm-cache"]],
  ["18", "Notification worker out-of-memory kills", "The worker was killed repeatedly while processing large batches.", "medium", 14, 55, "notifications", ["oom", "queue"], ["raise-limits", "purge-queue"]],
  ["19", "Inventory latency after an index was dropped", "A migration removed an index and stock lookups crawled.", "high", 13, 100, "inventory-api", ["latency", "cpu"], ["add-index"]],
  ["20", "Expired certificate on the payments webhook", "Partner webhooks failed TLS validation.", "high", 12, 30, "payments-api", ["cert", "502"], ["renew-cert"]],
  ["21", "CDN origin DNS misconfiguration", "A record change pointed the CDN at a dead origin.", "critical", 11, 40, "cdn-edge", ["dns", "502"], ["dns-failover", "rollback"]],
  ["22", "Login failures from an expired signing certificate", "Tokens failed validation after a key rotation.", "high", 10, 50, "auth-service", ["login", "cert"], ["renew-cert"]],
  ["23", "Orders database disk nearly full", "Write latency climbed as storage filled up.", "medium", 9, 70, "orders-db", ["disk", "latency"], ["clear-disk"]],
  ["24", "Search latency after a traffic surge", "A marketing email doubled traffic and searches slowed.", "medium", 8, 45, "search-service", ["latency", "cpu"], ["scale-out"]],
  ["25", "Redis timeouts after a cache failover", "A failover left clients holding dead connections.", "high", 6, 55, "checkout-web", ["redis", "502", "latency"], ["restart-pool"]],
  ["26", "Queue backlog from a stuck consumer", "One consumer hung and messages piled up.", "medium", 5, 90, "notifications", ["queue", "cpu"], ["purge-queue"]],
  ["27", "Inventory sync fails after deploy", "Stock updates errored after a schema change.", "high", 4, 40, "inventory-api", ["deploy", "502"], ["rollback"]],
  ["28", "Payments API intermittent timeouts", "Some payments are timing out; investigation is under way.", "high", 0.08, "investigating", "payments-api", ["latency", "redis", "502"], []],
  ["29", "Checkout errors after the morning deploy", "Error rate is rising after today's release.", "critical", 0.04, "open", "checkout-web", ["502", "deploy"], []],
  ["30", "Rate limiting on the search API", "Heavy crawler traffic triggered 429s for real users.", "low", 2, 20, "search-service", ["429"], ["block-crawler"]],
];

// [incident, minutes after start, type, note]
const timeline = [
  ["01", 5, "update", "Alerts fired for elevated 502s on payments-api."],
  ["01", 20, "escalation", "Paged the on-call database engineer."],
  ["01", 55, "action", "Restarted the connection pool; error rate dropping."],
  ["01", 85, "action", "Scaled out to 6 instances."],
  ["01", 95, "resolution", "Error rate back to normal. Monitoring."],
  ["03", 4, "update", "502s reported on checkout right after the release."],
  ["03", 10, "action", "Confirmed the release as the trigger; starting rollback."],
  ["03", 25, "resolution", "Rollback complete; checkout healthy."],
  ["05", 3, "update", "Security warnings reported on the main site."],
  ["05", 15, "action", "Found the expired certificate on the CDN edge."],
  ["05", 45, "resolution", "New certificate deployed and verified."],
  ["15", 5, "update", "Order failures rising; database connection count is climbing."],
  ["15", 30, "action", "Linked the leak to the latest release; rolling back."],
  ["15", 60, "action", "Restarted the connection pool after rollback."],
  ["15", 90, "resolution", "Connections stable; orders flowing."],
  ["25", 4, "update", "Redis timeouts on checkout after the cache failover."],
  ["25", 20, "action", "Clients still hold dead connections; restarting the pool."],
  ["25", 55, "resolution", "Latency and 502s back to normal."],
  ["28", 5, "update", "Alert: payment timeouts above threshold."],
  ["28", 20, "escalation", "Paged the payments on-call engineer."],
  ["28", 45, "update", "Redis latency looks elevated; checking connections."],
  ["29", 3, "update", "Error rate rising on checkout after the release."],
  ["29", 15, "escalation", "Paged the storefront on-call engineer."],
  ["29", 40, "update", "Evaluating a rollback."],
];

// ---------- insert ----------
const NOW = Date.now();
const MIN = 60_000;
const DAY = 86_400_000;
const iso = (ms) => new Date(ms).toISOString();

for (const [k, team] of services) await put("services", `svc-${k}`, { name: k, team });
for (const [k, label] of symptoms) await put("symptoms", `sym-${k}`, { label });
for (const [k, title, steps] of fixes) await put("fixes", `fix-${k}`, { title, steps });

const startOf = {};
for (const [n, title, summary, severity, daysAgo, outcome, svc, syms, fxs] of incidents) {
  const start = NOW - daysAgo * DAY;
  startOf[n] = start;
  const resolved = typeof outcome === "number";
  const data = {
    title, summary, severity,
    status: resolved ? "resolved" : outcome,
    started_at: iso(start),
    services: `svc-${svc}`,
    symptoms: syms.map((s) => `sym-${s}`),
    fixes: fxs.map((f) => `fix-${f}`),
  };
  if (resolved) data.resolved_at = iso(start + outcome * MIN);
  await put("incidents", `inc-${n}`, data);
}

const perIncident = {};
for (const [n, mins, type, note] of timeline) {
  perIncident[n] = (perIncident[n] || 0) + 1;
  await put("timeline_events", `evt-inc-${n}-${perIncident[n]}`, {
    note, event_type: type,
    occurred_at: iso(startOf[n] + mins * MIN),
    incidents: `inc-${n}`,
  });
}

console.log("Done. Rows created this run:", counts);
