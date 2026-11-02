import { useEffect, useState } from "react";
import { api } from "../api.js";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function Past() {
  const [list, setList] = useState(null);
  const [checks, setChecks] = useState({}); // archive id -> verification result
  const [error, setError] = useState("");

  useEffect(() => {
    api("/archives").then(setList).catch((e) => setError(e.message));
  }, []);

  async function verify(id) {
    setChecks((c) => ({ ...c, [id]: { busy: true } }));
    try {
      const r = await api(`/archives/${id}/verify`);
      setChecks((c) => ({ ...c, [id]: r }));
    } catch (err) {
      setChecks((c) => ({ ...c, [id]: { error: err.message } }));
    }
  }

  if (error) return <div className="narrow"><h1>Past elections</h1><p className="error">{error}</p></div>;
  if (!list) return <p className="muted">Loading…</p>;

  return (
    <div className="page-wide">
      <h1>Past elections</h1>
      <p className="muted">Finished elections are saved here with their winner, final count and vote chain.</p>

      {list.length === 0 && (
        <div className="section-card notice">
          <h2 className="section-title"><i className="fa-solid fa-box-archive" aria-hidden="true" />Nothing here yet</h2>
          <p className="muted">When the election officer archives a closed election, its winner appears on this page.</p>
        </div>
      )}

      {list.map((a) => {
        const check = checks[a._id];
        return (
          <article key={a._id} className="section-card past-card">
            <div className="section-header">
              <h2 className="section-title"><i className="fa-solid fa-trophy" aria-hidden="true" />{a.title}</h2>
              <span className="badge badge-heritage"><i className="fa-solid fa-calendar-check" aria-hidden="true" />{new Date(a.closedAt).toLocaleDateString()}</span>
            </div>

            <div className={"winner-banner" + (a.winners.length ? "" : " none")}>
              <i className="fa-solid fa-crown crown" aria-hidden="true" />
              <span>
                {a.winners.length === 0 && "No votes were cast in this election."}
                {a.winners.length === 1 && <>Winner: <strong>{a.winners[0]}</strong> with {plural(a.topVotes, "vote")}</>}
                {a.winners.length > 1 && <>Tie between <strong>{a.winners.join(", ")}</strong>, {plural(a.topVotes, "vote")} each</>}
              </span>
            </div>

            {a.candidates.map((c) => {
              const isWinner = a.winners.includes(c.name);
              return (
                <div key={String(c.candidateId)} className={"result-row" + (isWinner ? " winner" : "")}>
                  <div className="row">
                    <span className="who"><strong>{c.name}</strong>{isWinner && <span className="tag-winner">Winner</span>}</span>
                    <span>{c.votes}</span>
                  </div>
                  <div className="bar"><div style={{ width: `${(c.votes / Math.max(1, a.topVotes)) * 100}%` }} /></div>
                </div>
              );
            })}

            <p className="muted meta">{plural(a.totalVotes, "vote")} cast in total.</p>
            <p className="label">Final chain hash</p>
            <div className="hash-code">{a.headHash || "No votes were cast"}</div>

            <div className="past-actions">
              <button onClick={() => verify(a._id)} disabled={check && check.busy}>
                <i className="fa-solid fa-shield-halved" aria-hidden="true" />{check && check.busy ? "Checking…" : "Verify this election’s chain"}
              </button>
            </div>
            {check && check.error && <p className="error" role="alert">{check.error}</p>}
            {check && check.reason && (
              <div className={"verdict card " + (check.valid ? "ok" : "bad")} role="status">
                <strong>{check.valid ? "Chain intact" : "Tampering detected"}</strong>
                <span>{check.reason}</span>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}