import { useEffect, useMemo, useState } from "react";
import { Realtime, Channel, ID, Query } from "appwrite";
import { client, tablesDB, ensureSession, DATABASE_ID, TABLES } from "./config";

const SEVERITIES = ["low", "medium", "high", "critical"];

function IncidentExtras({ incident, fixes, busy, onAdd, onResolve }) {
  const [note, setNote] = useState("");
  const [type, setType] = useState("update");
  const [fixId, setFixId] = useState("");
  const events = [...(incident.timeline_events ?? [])].sort(
    (a, b) => new Date(a.occurred_at) - new Date(b.occurred_at)
  );
  const isOpen = incident.status !== "resolved";
  return (
    <>
      <details className="timeline" open={isOpen}>
        <summary>Timeline ({events.length})</summary>
        {events.map((ev) => (
          <p key={ev.$id} className="event">
            <span className="meta">{new Date(ev.occurred_at).toLocaleTimeString()} · {ev.event_type}</span>
            <br />
            {ev.note}
          </p>
        ))}
      </details>
      {isOpen && (
        <div className="actions">
          <div className="searchbar">
            <input placeholder="Add a timeline update..." value={note} onChange={(e) => setNote(e.target.value)} />
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {["update", "action", "escalation"].map((t) => <option key={t}>{t}</option>)}
            </select>
            <button type="button" className="primary" disabled={busy || !note.trim()}
              onClick={() => { onAdd(incident, note, type); setNote(""); }}>Add</button>
          </div>
          <div className="searchbar">
            <select value={fixId} onChange={(e) => setFixId(e.target.value)}>
              <option value="">Fix applied...</option>
              {fixes.map((f) => <option key={f.$id} value={f.$id}>{f.title}</option>)}
            </select>
            <button type="button" className="primary" disabled={busy || !fixId}
              onClick={() => onResolve(incident, fixId)}>Resolve incident</button>
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  const [incidents, setIncidents] = useState([]);
  const [services, setServices] = useState([]);
  const [symptoms, setSymptoms] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ title: "", summary: "", severity: "medium", service: "" });
  const [picked, setPicked] = useState([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState(null); // null = no search active
  const [fixes, setFixes] = useState([]);
  const [busy, setBusy] = useState(false);

  const list = (tableId, queries = []) =>
    tablesDB.listRows({ databaseId: DATABASE_ID, tableId, queries }).then((r) => r.rows);

  const loadIncidents = () =>
    list(TABLES.incidents, [
      Query.select(["*", "services.*", "symptoms.*", "fixes.*", "timeline_events.*"]),
      Query.orderDesc("started_at"),
      Query.limit(50),
    ]).then(setIncidents);

  useEffect(() => {
    ensureSession()
      .then(() =>
        Promise.all([
          loadIncidents(),
          list(TABLES.services, [Query.orderAsc("name")]).then(setServices),
          list(TABLES.symptoms, [Query.orderAsc("label"), Query.limit(100)]).then(setSymptoms),
          list(TABLES.fixes, [Query.orderAsc("title")]).then(setFixes),
        ])
      )
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Task 6: Realtime. Any change to incidents or timeline events refreshes the list.
  useEffect(() => {
    let sub;
    let stop = false;
    ensureSession()
      .then(() =>
        new Realtime(client).subscribe(
          [
            Channel.tablesdb(DATABASE_ID).table(TABLES.timeline_events).row(),
            Channel.tablesdb(DATABASE_ID).table(TABLES.incidents).row(),
          ],
          () => loadIncidents()
        )
      )
      .then((s) => (stop ? s.close() : (sub = s)))
      .catch((e) => console.error("Realtime failed", e));
    return () => {
      stop = true;
      sub?.close();
    };
  }, []);

  const toggle = (id) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  // Rank resolved incidents by how many symptoms they share with the ones picked.
  const matches = useMemo(() => {
    if (picked.length === 0) return [];
    return incidents
      .filter((i) => i.status === "resolved")
      .map((i) => {
        const all = i.symptoms ?? [];
        const shared = all.filter((s) => picked.includes(s.$id));
        const union = new Set([...all.map((s) => s.$id), ...picked]).size;
        return { incident: i, shared, score: shared.length / union };
      })
      .filter((m) => m.shared.length > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [incidents, picked]);

  const minutesToResolve = (i) =>
    Math.round((new Date(i.resolved_at) - new Date(i.started_at)) / 60000);

  async function addUpdate(incident, note, type) {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await tablesDB.createRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.timeline_events,
        rowId: ID.unique(),
        data: { note: note.trim(), event_type: type, occurred_at: new Date().toISOString(), incidents: incident.$id },
      });
      await loadIncidents();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Task 7: one atomic transaction. Either everything below is saved, or nothing is.
  async function resolveIncident(incident, fixId) {
    setBusy(true);
    setError("");
    try {
      const now = new Date().toISOString();
      const fixTitle = fixes.find((f) => f.$id === fixId)?.title ?? "a fix";
      const tx = await tablesDB.createTransaction();
      await tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.incidents,
        rowId: incident.$id,
        data: {
          status: "resolved",
          resolved_at: now,
          fixes: [...new Set([...(incident.fixes ?? []).map((f) => f.$id), fixId])],
        },
        transactionId: tx.$id,
      });
      await tablesDB.createRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.timeline_events,
        rowId: ID.unique(),
        data: { note: `Resolved. Fix applied: ${fixTitle}`, event_type: "resolution", occurred_at: now, incidents: incident.$id },
        transactionId: tx.$id,
      });
      await tablesDB.updateTransaction({ transactionId: tx.$id, commit: true });
      await loadIncidents();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function runSearch(e) {
    e.preventDefault();
    const q = search.trim();
    if (!q) return setResults(null);
    try {
      const rows = await list(TABLES.incidents, [
        Query.select(["*", "services.*", "symptoms.*", "fixes.*", "timeline_events.*"]),
        Query.or([Query.search("title", q), Query.search("summary", q)]),
        Query.orderDesc("started_at"),
        Query.limit(50),
      ]);
      setResults(rows);
    } catch (err) {
      setError(err.message);
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.service || picked.length === 0) {
      setError("Please add a title, a service, and at least one symptom.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await tablesDB.createRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.incidents,
        rowId: ID.unique(),
        data: {
          title: form.title.trim(),
          summary: form.summary.trim(),
          severity: form.severity,
          started_at: new Date().toISOString(),
          services: form.service,
          symptoms: picked,
        },
      });
      setForm({ title: "", summary: "", severity: "medium", service: "" });
      setPicked([]);
      await loadIncidents();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <h1>Incident Memory</h1>
      <p className="sub">Log an incident, and see past ones like it.</p>

      <form className="card form" onSubmit={submit}>
        <h2>Report a new incident</h2>
        <input placeholder="Title" value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea placeholder="What is happening? (optional)" value={form.summary}
          onChange={(e) => setForm({ ...form, summary: e.target.value })} />
        <div className="two">
          <select value={form.severity}
            onChange={(e) => setForm({ ...form, severity: e.target.value })}>
            {SEVERITIES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select value={form.service}
            onChange={(e) => setForm({ ...form, service: e.target.value })}>
            <option value="">Service...</option>
            {services.map((s) => <option key={s.$id} value={s.$id}>{s.name}</option>)}
          </select>
        </div>
        <p className="meta">Symptoms you are seeing:</p>
        <div className="chips">
          {symptoms.map((s) => (
            <button type="button" key={s.$id}
              className={`chip ${picked.includes(s.$id) ? "on" : ""}`}
              onClick={() => toggle(s.$id)}>
              {s.label}
            </button>
          ))}
        </div>
        {matches.length > 0 && (
          <div className="matches">
            <h3>You have seen this before</h3>
            {matches.map(({ incident: m, shared }) => (
              <div key={m.$id} className="match">
                <strong>{m.title}</strong>
                <p className="meta">
                  Matched because it shares {shared.length} symptom{shared.length > 1 ? "s" : ""}:{" "}
                  {shared.map((s) => s.label).join(", ")}
                </p>
                <p>
                  Fixed by:{" "}
                  {(m.fixes ?? []).map((f) => f.title).join(", ") || "no fix recorded"}
                </p>
                <p className="meta">
                  {m.services?.name} · resolved in {minutesToResolve(m)} min
                </p>
              </div>
            ))}
          </div>
        )}
        <button className="primary" disabled={saving}>
          {saving ? "Saving..." : "Report incident"}
        </button>
      </form>

      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}

      <form className="searchbar" onSubmit={runSearch}>
        <input placeholder="Search past incidents by word..." value={search}
          onChange={(e) => setSearch(e.target.value)} />
        <button className="primary">Search</button>
        {results && (
          <button type="button" className="chip"
            onClick={() => { setResults(null); setSearch(""); }}>Clear</button>
        )}
      </form>
      {results && <p className="meta">{results.length} result(s)</p>}

      <ul className="list">
        {(results ?? incidents).map((i) => (
          <li key={i.$id} className="card">
            <div className="row">
              <span className={`badge ${i.severity}`}>{i.severity}</span>
              <span className="status">{i.status}</span>
            </div>
            <h2>{i.title}</h2>
            <p>{i.summary}</p>
            <div className="chips">
              {(i.symptoms ?? []).map((s) => <span key={s.$id} className="chip static">{s.label}</span>)}
            </div>
            <IncidentExtras incident={i} fixes={fixes} busy={busy} onAdd={addUpdate} onResolve={resolveIncident} />
            <p className="meta">
              {i.services?.name ?? "unknown service"} · {new Date(i.started_at).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
