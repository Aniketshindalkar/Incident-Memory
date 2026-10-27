import { useEffect, useMemo, useState } from "react";
import { ID, Query } from "appwrite";
import { tablesDB, ensureSession, DATABASE_ID, TABLES } from "./config";

const SEVERITIES = ["low", "medium", "high", "critical"];

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

  const list = (tableId, queries = []) =>
    tablesDB.listRows({ databaseId: DATABASE_ID, tableId, queries }).then((r) => r.rows);

  const loadIncidents = () =>
    list(TABLES.incidents, [
      Query.select(["*", "services.*", "symptoms.*", "fixes.*"]),
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
        ])
      )
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
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

  async function runSearch(e) {
    e.preventDefault();
    const q = search.trim();
    if (!q) return setResults(null);
    try {
      const rows = await list(TABLES.incidents, [
        Query.select(["*", "services.*", "symptoms.*", "fixes.*"]),
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
            <p className="meta">
              {i.services?.name ?? "unknown service"} · {new Date(i.started_at).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
