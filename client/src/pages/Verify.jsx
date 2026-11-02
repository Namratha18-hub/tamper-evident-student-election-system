import { useEffect, useState } from "react";
import { api } from "../api.js";

const short = (h) => h.slice(0, 8) + "…" + h.slice(-4);

// One line of the "find my vote" result: a tick or a cross, always with words
function Check({ ok, children }) {
  return (
    <li>
      <i className={"fa-solid " + (ok ? "fa-circle-check" : "fa-circle-xmark")} aria-hidden="true" />
      {children}
    </li>
  );
}

export default function Verify() {
  const [ledger, setLedger] = useState([]);
  const [result, setResult] = useState(null);
  const [auto, setAuto] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [receipt, setReceipt] = useState("");
  const [found, setFound] = useState(null);
  const [findError, setFindError] = useState("");
  const [finding, setFinding] = useState(false);

  const loadLedger = () => api("/ledger").then(setLedger).catch((e) => setError(e.message));
  useEffect(() => {
    loadLedger();
    api("/public/integrity").then(setAuto).catch(() => {});
  }, []);

  async function verify() {
    setBusy(true);
    setError("");
    try {
      setResult(await api("/verify"));
      await loadLedger();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function findVote(e) {
    e.preventDefault();
    setFindError("");
    setFound(null);
    setFinding(true);
    try {
      setFound(await api("/receipt/" + encodeURIComponent(receipt.trim())));
    } catch (err) {
      setFindError(err.message);
    } finally {
      setFinding(false);
    }
  }

  return (
    <div>
      <h1>Verify the vote chain</h1>
      <p className="muted">Verification recomputes every hash from the first vote onward. If anyone edits, inserts or deletes a vote in the database, the chain breaks at that point.</p>

      {auto && auto.checkedAt && (
        <p className={"auto-check " + (auto.ok ? "ok" : "bad")} role="status">
          <i className={"fa-solid " + (auto.ok ? "fa-shield-halved" : "fa-triangle-exclamation")} aria-hidden="true" />
          <strong>Automatic check:</strong> {auto.reason} Checked at {new Date(auto.checkedAt).toLocaleTimeString()}, repeated every minute.
        </p>
      )}

      <section className="section-card find-card">
        <h2 className="section-title small"><i className="fa-solid fa-magnifying-glass" aria-hidden="true" />Find my vote</h2>
        <p className="muted">Paste the receipt you got after voting. You will see where your vote sits in the chain and whether its links hold.</p>
        <form onSubmit={findVote} className="find-row">
          <label>Receipt
            <input value={receipt} onChange={(e) => setReceipt(e.target.value)} placeholder="32 letters and digits" required autoComplete="off" spellCheck="false" />
          </label>
          <button className="primary" disabled={finding}>{finding ? "Searching…" : "Find my vote"}</button>
        </form>
        {findError && <p className="error" role="alert">{findError}</p>}

        {found && (
          <div className={"verdict card " + (found.ok ? "ok" : "bad")} role="status">
            <strong>
              {found.ok ? "Your vote is in the chain" : "Problem found with this vote"}: position #{found.index} of {found.total}
            </strong>
            <span>{found.election}{found.archived ? " (a past election)" : ""}. Recorded for <strong>{found.candidate}</strong> on {new Date(found.timestamp).toLocaleString()}.</span>
            <ul className="check-list">
              <Check ok={found.checks.hashMatches}>Its hash matches its contents</Check>
              <Check ok={found.checks.linksToPrevious}>It links to the vote before it</Check>
              {found.checks.nextLinksToThis === null
                ? <li><i className="fa-solid fa-circle-info" aria-hidden="true" />This is the latest vote, so nothing links to it yet</li>
                : <Check ok={found.checks.nextLinksToThis}>The next vote links to it</Check>}
            </ul>
            <div className="hashline"><span>previous</span><code>{short(found.prevHash)}</code></div>
            <div className="hashline"><span>this vote</span><code>{short(found.hash)}</code></div>
          </div>
        )}
      </section>

      <button className="primary" onClick={verify} disabled={busy}>{busy ? "Checking…" : "Verify chain"}</button>
      {error && <p className="error" role="alert">{error}</p>}

      {result && (
        <div className={"verdict card " + (result.valid ? "ok" : "bad")} role="status">
          <strong>{result.valid ? "Chain intact" : "Tampering detected"}</strong>
          <span>{result.reason}</span>
          <span className="muted">Checked {result.checked} vote(s) at {new Date(result.checkedAt).toLocaleTimeString()}</span>
        </div>
      )}

      <h2>Ledger</h2>
      {ledger.length === 0 ? (
        <p className="muted">No votes yet. Votes appear here as they are cast.</p>
      ) : (
        <div className="chain">
          {ledger.map((v) => {
            const broken = result && !result.valid && result.brokenAt === v.index;
            const after = result && !result.valid && v.index > result.brokenAt;
            return (
              <div key={v.index} className={"block" + (broken ? " broken" : after ? " after" : "")}>
                <div className="row"><strong>Vote #{v.index}</strong><span className="muted">{new Date(v.timestamp).toLocaleString()}</span></div>
                <div>Candidate: {v.candidate}</div>
                <div className="muted">Receipt: {v.voterToken.slice(0, 10)}…</div>
                <div className="hashline"><span>previous</span><code>{short(v.prevHash)}</code></div>
                <div className="hashline"><span>this vote</span><code>{short(v.hash)}</code></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}