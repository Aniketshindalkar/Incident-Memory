import { useEffect, useState } from "react";
import { Query } from "appwrite";
import { tablesDB, DATABASE_ID, INCIDENTS_TABLE_ID } from "./config";

export default function App() {
  const [incidents, setIncidents] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tablesDB
      .listRows({
        databaseId: DATABASE_ID,
        tableId: INCIDENTS_TABLE_ID,
        queries: [
          Query.select(["*", "services.*"]),
          Query.orderDesc("started_at"),
          Query.limit(50),
        ],
      })
      .then((res) => setIncidents(res.rows))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="page">
      <h1>Incident Memory</h1>
      <p className="sub">Past incidents, newest first.</p>

      {loading && <p>Loading incidents...</p>}
      {error && <p className="error">Could not load incidents: {error}</p>}

      <ul className="list">
        {incidents.map((i) => (
          <li key={i.$id} className="card">
            <div className="row">
              <span className={`badge ${i.severity}`}>{i.severity}</span>
              <span className="status">{i.status}</span>
            </div>
            <h2>{i.title}</h2>
            <p>{i.summary}</p>
            <p className="meta">
              {i.services?.name ?? "unknown service"} ·{" "}
              {new Date(i.started_at).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
