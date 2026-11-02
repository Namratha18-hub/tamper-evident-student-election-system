import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

export default function Results() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = () => api("/results").then(setData).catch((e) => setError(e.message));
    load();
    const t = setInterval(load, 5000); // refresh so the admin sees live counts
    return () => clearInterval(t);
  }, []);

  if (error) {
    return (
      <div className="narrow">
        <h1>Results</h1>
        <p className="muted">{error}</p>
        <p><Link to="/past">See past elections</Link></p>
      </div>
    );
  }
  if (!data) return <p className="muted">Loading…</p>;

  const closed = data.status === "closed";
  const top = Math.max(0, ...data.results.map((r) => r.votes));
  const winners = closed && top > 0 ? data.results.filter((r) => r.votes === top) : [];

  return (
    <div className="narrow">
      <h1>Results</h1>
      <p className="muted">
        {data.title}. {closed ? "Final result." : "Live count, visible to the admin only until the election closes."} {data.total} vote(s) cast.
      </p>

      {closed && (
        <div className={"winner-banner" + (winners.length ? "" : " none")}>
          <i className="fa-solid fa-crown crown" aria-hidden="true" />
          <span>
            {winners.length === 0 && "No votes were cast."}
            {winners.length === 1 && <>Winner: <strong>{winners[0].name}</strong> with {top} vote{top === 1 ? "" : "s"}</>}
            {winners.length > 1 && <>Tie between <strong>{winners.map((w) => w.name).join(", ")}</strong>, {top} vote{top === 1 ? "" : "s"} each</>}
          </span>
        </div>
      )}

      <div className="card stack">
        {data.results.length === 0 && <p className="muted">No candidates yet.</p>}
        {data.results.map((r) => {
          const isWinner = winners.some((w) => w.id === r.id);
          return (
            <div key={r.id} className={"result-row" + (isWinner ? " winner" : "")}>
              <div className="row">
                <span className="who"><strong>{r.name}</strong>{isWinner && <span className="tag-winner">Winner</span>}</span>
                <span>{r.votes}</span>
              </div>
              <div className="bar"><div style={{ width: `${(r.votes / Math.max(1, top)) * 100}%` }} /></div>
            </div>
          );
        })}
      </div>
      <p className="muted">Looking for an earlier election? <Link to="/past">Past elections</Link></p>
    </div>
  );
}