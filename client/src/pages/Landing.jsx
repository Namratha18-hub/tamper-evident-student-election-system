import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

// Sample chain for the trust panel. Each vote's "previous" matches the vote before it.
const CHAIN = [
  { n: 1, prev: "00000000", hash: "9f3ac71b" },
  { n: 2, prev: "9f3ac71b", hash: "41d8e05a" },
  { n: 3, prev: "41d8e05a", hash: "c27b96f3" },
];

const STATUS = {
  not_started: { text: "Voting has not started", badge: "badge-heritage", icon: "fa-hourglass-start" },
  open: { text: "Voting is open", badge: "badge-live", icon: "fa-circle-dot" },
  closed: { text: "Voting is closed", badge: "badge-closed", icon: "fa-lock" },
};

export default function Landing() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    api("/public/status").then(setInfo).catch(() => setInfo(null));
  }, []);

  const s = info ? STATUS[info.status] : null;

  return (
    <>
      <section className="hero-card">
        <div>
          {s && <span className={"badge " + s.badge}><i className={"fa-solid " + s.icon} aria-hidden="true" />{s.text}</span>}
          <h1 className="hero-title">Every vote is locked to the one before it.</h1>
          <p className="hero-subtitle">
            A student election where the ballot box proves itself. Change one stored vote and the chain breaks, in plain sight.
          </p>
          <div className="hero-actions">
            <Link to="/student/login" className="btn primary"><i className="fa-solid fa-fingerprint" aria-hidden="true" />Student login</Link>
            <Link to="/admin/login" className="btn secondary"><i className="fa-solid fa-user-shield" aria-hidden="true" />Officer login</Link>
          </div>
        </div>

        <div className="status-box" role="status">
          <div className="status-label">Votes sealed so far</div>
          <div className="status-number">{info ? info.voteCount : "–"}</div>
          <div className="status-label">Latest chain hash</div>
          <code className="status-hash">{info && info.headHash ? info.headHash.slice(0, 16) + "…" : "No votes yet"}</code>
          {info && info.latest && (
            <>
              <div className="status-label latest-label">Latest winner</div>
              <div className="latest-winner">{info.latest.winners.length ? info.latest.winners.join(", ") : "No votes were cast"}</div>
              <div className="status-label">{info.latest.title}</div>
            </>
          )}
        </div>
      </section>

      <div className="voting-steps">
        <div className="step-card" data-step="01">
          <h4>Register</h4>
          <p>Sign up once with your student ID.</p>
        </div>
        <div className="step-card" data-step="02">
          <h4>Vote</h4>
          <p>Choose one candidate. You can vote one time.</p>
        </div>
        <div className="step-card" data-step="03">
          <h4>Verify</h4>
          <p>Recompute the chain and watch it hold, or break.</p>
        </div>
      </div>

      <div className="main-grid">
        <div className="section-card">
          <div className="section-header">
            <h2 className="section-title"><i className="fa-solid fa-right-to-bracket" aria-hidden="true" />Choose how to sign in</h2>
          </div>
          <div className="candidate-list">
            <Link to="/student/login" className="role-option">
              <div className="candidate-info">
                <div className="party-symbol"><i className="fa-solid fa-user-graduate" aria-hidden="true" /></div>
                <div className="candidate-details">
                  <h4>I’m a student</h4>
                  <p>Register with your student ID, cast one vote, and check that it was counted.</p>
                </div>
              </div>
              <i className="fa-solid fa-chevron-right role-arrow" aria-hidden="true" />
            </Link>
            <Link to="/admin/login" className="role-option">
              <div className="candidate-info">
                <div className="party-symbol"><i className="fa-solid fa-user-shield" aria-hidden="true" /></div>
                <div className="candidate-details">
                  <h4>I’m the election officer</h4>
                  <p>Add candidates, open and close voting, and follow the live count.</p>
                </div>
              </div>
              <i className="fa-solid fa-chevron-right role-arrow" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="section-card">
          <h3 className="section-title small"><i className="fa-solid fa-lock" aria-hidden="true" />Trust and security</h3>
          <p className="muted">Each vote carries the hash of the vote before it. The highlighted hashes below are the same value, which is what links the chain.</p>
          <div className="mini-chain" role="img" aria-label="Three votes, each carrying the hash of the vote before it">
            {CHAIN.map((b, i) => (
              <Fragment key={b.n}>
                {i > 0 && <span className="conn" aria-hidden="true" style={{ "--i": i }} />}
                <div className="vslip" style={{ "--i": i }}>
                  <strong>Vote #{b.n}</strong>
                  <div className="hashline"><span>previous</span><code className={i > 0 ? "shared" : ""}>{b.prev}…</code></div>
                  <div className="hashline"><span>this vote</span><code className={i < CHAIN.length - 1 ? "shared" : ""}>{b.hash}…</code></div>
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}