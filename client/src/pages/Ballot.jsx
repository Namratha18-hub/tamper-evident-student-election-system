import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../App.jsx";

// A simple boxed message used for the non-voting states
function Notice({ icon, title, children }) {
  return (
    <div className="section-card notice">
      <h2 className="section-title"><i className={"fa-solid " + icon} aria-hidden="true" />{title}</h2>
      <p className="muted">{children}</p>
    </div>
  );
}

export default function Ballot() {
  const { user, setUser } = useAuth();
  const [election, setElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [choice, setChoice] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/auth/me").then(setUser).catch(() => {}); // refresh "hasVoted" after a new election starts
    api("/election").then(setElection).catch((e) => setError(e.message));
    api("/candidates").then(setCandidates).catch((e) => setError(e.message));
  }, []);

  const chosen = candidates.find((c) => c._id === choice);

  async function cast() {
    if (!window.confirm(`Cast your vote for ${chosen.name}? This cannot be changed.`)) return;
    setBusy(true);
    setError("");
    try {
      const r = await api("/vote", { method: "POST", body: { candidateId: choice } });
      setReceipt({ ...r, name: chosen.name, time: new Date().toLocaleTimeString() });
      setUser({ ...user, hasVoted: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!election) return <p className="muted">Loading ballot…</p>;

  if (receipt) {
    return (
      <div className="page-wide">
        <div className="section-card">
          <div className="receipt-card">
            <div className="row">
              <h2 className="receipt-title"><i className="fa-solid fa-circle-check" aria-hidden="true" />Vote sealed in the chain</h2>
              <span className="badge badge-block">Vote #{receipt.index}</span>
            </div>
            <p>Your vote for <strong>{receipt.name}</strong> was added to the chain. Keep the receipt below to find your vote in the ledger. It is not linked to your name.</p>
            <p className="label">Receipt</p>
            <div className="hash-code">{receipt.receipt}</div>
            <p className="label">Chain hash</p>
            <div className="hash-code">{receipt.hash}</div>
            <p className="label">Recorded at {receipt.time}. Status: confirmed.</p>
          </div>
        </div>
      </div>
    );
  }

  if (user.hasVoted) return <div className="page-wide"><Notice icon="fa-lock" title="You have already voted">Each student can vote once per election. You can check the chain on the Verify page.</Notice></div>;
  if (election.status === "not_started") return <div className="page-wide"><Notice icon="fa-hourglass-start" title="Voting has not started">The election officer will open voting soon. Earlier results are under Past elections.</Notice></div>;
  if (election.status === "closed") return <div className="page-wide"><Notice icon="fa-flag-checkered" title="Voting is closed">See the Results page for the outcome.</Notice></div>;

  return (
    <div className="page-wide">
      <div className="section-card">
        <div className="section-header">
          <h2 className="section-title"><i className="fa-solid fa-box-archive" aria-hidden="true" />Official ballot slip</h2>
          <span className="badge badge-heritage"><i className="fa-solid fa-landmark" aria-hidden="true" />{election.title}</span>
        </div>
        <p className="muted ballot-help">Select <strong>one</strong> candidate. Your vote is stored without your name.</p>

        <div className="candidate-list" role="radiogroup" aria-label="Candidates">
          {candidates.map((c) => (
            <label key={c._id} className={"candidate-option" + (choice === c._id ? " selected" : "")}>
              <input type="radio" className="sr-only" name="candidate" value={c._id} checked={choice === c._id} onChange={() => setChoice(c._id)} />
              <div className="candidate-info">
                <div className="party-symbol"><i className="fa-solid fa-user" aria-hidden="true" /></div>
                <div className="candidate-details">
                  <h4>{c.name}</h4>
                  <p>{c.position}</p>
                  {c.manifesto && <p>{c.manifesto}</p>}
                </div>
              </div>
              <span className="radio-indicator" aria-hidden="true" />
            </label>
          ))}
        </div>

        {error && <p className="error" role="alert">{error}</p>}

        <div className="action-bar">
          <span className="muted">{chosen ? <>Selected: <strong className="chosen">{chosen.name}</strong></> : "No candidate selected yet."}</span>
          <button className="btn primary" disabled={!choice || busy} onClick={cast}>
            <i className="fa-solid fa-paper-plane" aria-hidden="true" />Cast vote and seal
          </button>
        </div>
      </div>
    </div>
  );
}