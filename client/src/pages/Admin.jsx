import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

const LABEL = { not_started: "Not started", open: "Open", closed: "Closed" };
const DECISION = { approved: "Approved, waiting for the student", completed: "Approved, password reset", denied: "Denied" };

export default function Admin() {
  const [election, setElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [pending, setPending] = useState([]);
  const [recent, setRecent] = useState([]);
  const [eligible, setEligible] = useState({ total: 0 });
  const [eligibleText, setEligibleText] = useState("");
  const [eligibleMsg, setEligibleMsg] = useState("");
  const [form, setForm] = useState({ name: "", position: "Student Council President", manifesto: "" });
  const [nextTitle, setNextTitle] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(false);

  async function load() {
    setElection(await api("/election"));
    setCandidates(await api("/candidates"));
    const resets = await api("/admin/resets");
    setPending(resets.pending);
    setRecent(resets.recent);
    setEligible(await api("/admin/eligible"));
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
    const t = setInterval(() => load().catch(() => {}), 8000); // pick up new password requests
    return () => clearInterval(t);
  }, []);

  async function run(fn) {
    setError("");
    setNotice(false);
    try { await fn(); await load(); } catch (err) { setError(err.message); }
  }

  const setStatus = (status) => run(() => api("/election/status", { method: "POST", body: { status } }));
  const addCandidate = (e) => {
    e.preventDefault();
    run(async () => {
      await api("/candidates", { method: "POST", body: form });
      setForm({ ...form, name: "", manifesto: "" });
    });
  };
  const removeCandidate = (id) => run(() => api("/candidates/" + id, { method: "DELETE" }));

  const archiveAndReset = () => {
    if (!window.confirm(`Archive “${election.title}” and start a new election? The winner and chain are saved under Past elections. Candidates are cleared and every student can vote again.`)) return;
    run(async () => {
      await api("/archives", { method: "POST", body: { nextTitle } });
      setNextTitle("");
      setNotice(true);
    });
  };

  async function pickFile(e) {
    const file = e.target.files[0];
    if (file) setEligibleText(await file.text());
  }
  const addEligible = () => run(async () => {
    const r = await api("/admin/eligible", { method: "POST", body: { text: eligibleText } });
    setEligibleText("");
    setEligibleMsg(`Read ${r.found} IDs: ${r.added} added, ${r.found - r.added} were already on the list. The list now has ${r.total} IDs.`);
  });
  const clearEligible = () => {
    if (!window.confirm(`Remove all ${eligible.total} IDs from the list? Anyone will be able to register again.`)) return;
    run(async () => {
      await api("/admin/eligible", { method: "DELETE" });
      setEligibleMsg("");
    });
  };

  const approve = (r) => {
    if (!window.confirm(`Approve the request from ${r.name} (${r.studentId})? They will be able to set a new password right away.`)) return;
    run(() => api(`/admin/resets/${r._id}/approve`, { method: "POST" }));
  };
  const deny = (r) => run(() => api(`/admin/resets/${r._id}/deny`, { method: "POST" }));

  if (!election) return <p className="muted">Loading…</p>;
  const locked = election.status !== "not_started";

  return (
    <div className="narrow">
      <h1>Admin panel</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && (
        <p className="success" role="status">
          Election archived. <Link to="/past">See it under Past elections</Link>, then add candidates for the next one.
        </p>
      )}

      <section className="card stack">
        <div className="row"><strong>{election.title}</strong><span className={"pill " + election.status}>{LABEL[election.status]}</span></div>
        <p className="muted">{election.voteCount} of {election.totalVoters} registered voters have voted.</p>
        <div className="row-gap">
          <button onClick={() => setStatus("open")} disabled={election.status !== "not_started"}>Open voting</button>
          <button onClick={() => { if (window.confirm("Close the election? Voting will stop and results become public.")) setStatus("closed"); }} disabled={election.status !== "open"}>Close voting</button>
        </div>
      </section>

      {election.status === "closed" && (
        <section className="card stack archive-box">
          <h2 className="section-title small"><i className="fa-solid fa-box-archive" aria-hidden="true" />Finish this election</h2>
          <p className="muted">Saves the winner, results and vote chain to Past elections. Then candidates are cleared and every student can vote again.</p>
          <label>Name of the next election
            <input value={nextTitle} onChange={(e) => setNextTitle(e.target.value)} placeholder="Student Council 2026, Round 2" />
          </label>
          <button className="primary" onClick={archiveAndReset}>
            <i className="fa-solid fa-forward" aria-hidden="true" />Archive and start new election
          </button>
        </section>
      )}

      <section className="card stack">
        <h2 className="section-title small"><i className="fa-solid fa-id-card" aria-hidden="true" />Eligible voters</h2>
        {eligible.total === 0 ? (
          <p className="warn">No list uploaded yet, so any student ID can register. Upload your list to allow only your students.</p>
        ) : (
          <p className="muted">{eligible.total} student IDs are allowed to register. Anyone else is turned away. Accounts that already exist are not affected.</p>
        )}
        <label>Upload a CSV or text file
          <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={pickFile} />
        </label>
        <label>Or paste IDs here
          <textarea rows={4} value={eligibleText} onChange={(e) => setEligibleText(e.target.value)} placeholder={"24B91A05T1\n24B91A05T2"} />
        </label>
        <p className="muted">One ID per line, or separated by commas. Column headers and names are ignored. New IDs are added and nothing is removed.</p>
        {eligibleMsg && <p className="success" role="status">{eligibleMsg}</p>}
        <div className="row-gap">
          <button className="primary" onClick={addEligible} disabled={!eligibleText.trim()}>Add to list</button>
          <button onClick={clearEligible} disabled={eligible.total === 0}>Clear list</button>
        </div>
      </section>

      <section className="card stack">
        <h2 className="section-title small"><i className="fa-solid fa-key" aria-hidden="true" />Password reset requests</h2>

        {pending.length === 0 ? (
          <p className="muted">No pending requests. Students who forgot their password appear here.</p>
        ) : (
          pending.map((r) => (
            <div key={r._id} className="reset-row">
              <div className="row">
                <span>
                  <strong>{r.name}</strong> ({r.studentId})
                  <span className="muted block">Asked at {new Date(r.createdAt).toLocaleTimeString()}</span>
                </span>
                <span className="code-chip" title="Verification code">{r.code}</span>
              </div>
              <p className="muted">Check that the student’s screen shows this same code, and check their ID card, before you approve.</p>
              <div className="row-gap">
                <button className="primary" onClick={() => approve(r)}>Approve</button>
                <button onClick={() => deny(r)}>Deny</button>
              </div>
            </div>
          ))
        )}

        {recent.length > 0 && (
          <>
            <h3 className="label">Recent decisions</h3>
            <div>
              {recent.map((r) => (
                <div key={r._id} className="decision-row">
                  <span><strong>{r.name}</strong> ({r.studentId})</span>
                  <span className="muted">{DECISION[r.status]}, by {r.decidedBy} at {new Date(r.decidedAt).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <h2>Candidates</h2>
      <div className="stack">
        {candidates.length === 0 && <p className="muted">No candidates yet. Add at least two to open voting.</p>}
        {candidates.map((c) => (
          <div key={c._id} className="card row">
            <span><strong>{c.name}</strong><span className="muted block">{c.position}</span></span>
            <button onClick={() => removeCandidate(c._id)} disabled={locked}>Remove</button>
          </div>
        ))}
      </div>

      {!locked && (
        <form onSubmit={addCandidate} className="card stack">
          <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label>Position<input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></label>
          <label>Manifesto<textarea rows={2} value={form.manifesto} onChange={(e) => setForm({ ...form, manifesto: e.target.value })} /></label>
          <button className="primary">Add candidate</button>
        </form>
      )}
    </div>
  );
}