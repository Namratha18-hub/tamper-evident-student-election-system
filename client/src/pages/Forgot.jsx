import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import PasswordInput from "../components/PasswordInput.jsx";

const KEY = "resetTicket"; // the secret ticket lives only in this browser tab

// ---------- Student: ask the officer, wait for approval, then set a new password ----------
function StudentForgot() {
  const [ticket, setTicket] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(KEY)); } catch { return null; }
  });
  const [state, setState] = useState(ticket ? "pending" : "form"); // form | pending | approved | done | denied | expired
  const [form, setForm] = useState({ id: "", name: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // While waiting, ask the server every few seconds whether the officer has answered.
  useEffect(() => {
    if (!ticket || (state !== "pending" && state !== "approved")) return;
    let alive = true;
    const poll = async () => {
      try {
        const r = await api("/auth/forgot/status", { method: "POST", body: { ticket: ticket.ticket } });
        if (alive) setState(r.state === "completed" ? "done" : r.state);
      } catch { /* try again on the next tick */ }
    };
    poll();
    const timer = setInterval(poll, 3000);
    return () => { alive = false; clearInterval(timer); };
  }, [ticket, state]);

  function startOver() {
    sessionStorage.removeItem(KEY);
    setTicket(null);
    setState("form");
    setError("");
    setForm({ id: "", name: "", password: "", confirm: "" });
  }

  async function sendRequest(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r = await api("/auth/forgot", { method: "POST", body: { studentId: form.id, name: form.name } });
      const t = { ticket: r.ticket, code: r.code };
      sessionStorage.setItem(KEY, JSON.stringify(t));
      setTicket(t);
      setState("pending");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function setNewPassword(e) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await api("/auth/forgot/complete", { method: "POST", body: { ticket: ticket.ticket, newPassword: form.password } });
      sessionStorage.removeItem(KEY);
      setState("done");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {state === "form" && (
        <>
          <p className="muted">Enter your student ID and full name exactly as you registered. The election officer approves your request, and then you can set a new password right here.</p>
          <form onSubmit={sendRequest} className="card stack">
            <label>Student ID
              <input value={form.id} onChange={set("id")} required autoComplete="username" />
            </label>
            <label>Full name
              <input value={form.name} onChange={set("name")} required />
            </label>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="primary" disabled={busy}>Send request to the officer</button>
          </form>
        </>
      )}

      {state === "pending" && ticket && (
        <div className="ticket-card" role="status">
          <p>Your request was sent to the election officer.</p>
          <p className="label">Your verification code</p>
          <div className="verify-code">{ticket.code}</div>
          <p className="muted">Show this code to the officer. They check that it matches before they approve. This page updates by itself, so keep it open.</p>
          <p className="muted waiting"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />Waiting for approval</p>
          <button onClick={startOver}>Cancel request</button>
        </div>
      )}

      {state === "approved" && (
        <>
          <p className="success" role="status">The officer approved your request. Choose a new password now. This is open for 10 minutes.</p>
          <form onSubmit={setNewPassword} className="card stack">
            <PasswordInput label="New password" value={form.password} onChange={set("password")} required minLength={6} autoComplete="new-password" />
            <PasswordInput label="Confirm new password" value={form.confirm} onChange={set("confirm")} required minLength={6} autoComplete="new-password" />
            {error && <p className="error" role="alert">{error}</p>}
            <button className="primary" disabled={busy}>Save new password</button>
          </form>
        </>
      )}

      {state === "done" && (
        <div className="success" role="status">
          <p>Your password was updated. You can log in with the new password now.</p>
          <p><Link to="/student/login">Go to login</Link></p>
        </div>
      )}

      {state === "denied" && (
        <div className="ticket-card" role="status">
          <p>The election officer declined this request. Please meet the officer in person if you still need access.</p>
          <button onClick={startOver}>Start again</button>
        </div>
      )}

      {state === "expired" && (
        <div className="ticket-card" role="status">
          <p>This request has expired. If you entered your details correctly, send a new request. Otherwise check your student ID and full name.</p>
          <button onClick={startOver}>Start again</button>
        </div>
      )}
    </>
  );
}

// ---------- Officer: reset with the recovery key from the server's .env file ----------
function AdminForgot() {
  const [form, setForm] = useState({ id: "", key: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await api("/auth/forgot-admin", { method: "POST", body: { officerId: form.id, recoveryKey: form.key, newPassword: form.password } });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="success" role="status">
        <p>Your password was updated. You can log in with the new password now.</p>
        <p><Link to="/admin/login">Go to login</Link></p>
      </div>
    );
  }

  return (
    <>
      <p className="muted">Enter your officer ID, the recovery key from the server’s .env file, and a new password.</p>
      <form onSubmit={submit} className="card stack">
        <label>Officer ID
          <input value={form.id} onChange={set("id")} required autoComplete="username" />
        </label>
        <PasswordInput label="Recovery key" value={form.key} onChange={set("key")} required autoComplete="off" />
        <PasswordInput label="New password" value={form.password} onChange={set("password")} required minLength={6} autoComplete="new-password" />
        <PasswordInput label="Confirm new password" value={form.confirm} onChange={set("confirm")} required minLength={6} autoComplete="new-password" />
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>Reset password</button>
      </form>
    </>
  );
}

export default function Forgot({ role }) {
  const isAdmin = role === "admin";
  return (
    <div className="narrow">
      <Link to={isAdmin ? "/admin/login" : "/student/login"} className="back">Back to login</Link>
      <p><span className="badge">{isAdmin ? "Election officer" : "Student"}</span></p>
      <h1>Forgot your password?</h1>
      {isAdmin ? <AdminForgot /> : <StudentForgot />}
    </div>
  );
}