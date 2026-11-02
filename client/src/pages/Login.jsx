import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../App.jsx";
import PasswordInput from "../components/PasswordInput.jsx";

// role="voter"  -> student login (with registration)
// role="admin"  -> election officer login (no registration)
export default function Login({ role }) {
  const { setUser } = useAuth();
  const isAdmin = role === "admin";
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ studentId: "", name: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const registering = !isAdmin && mode === "register";

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const path = registering ? "/auth/register" : "/auth/login";
      const user = await api(path, { method: "POST", body: { ...form, role } });
      setUser(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="narrow">
      <Link to="/" className="back">Back to home</Link>
      <p><span className="badge">{isAdmin ? "Election officer" : "Student"}</span></p>
      <h1>{isAdmin ? "Officer login" : registering ? "Register as a voter" : "Log in to vote"}</h1>
      <p className="muted">
        {isAdmin
          ? "Manage candidates, open and close voting, and follow the live count."
          : "Use your student ID. You get one vote, and it is sealed into the chain."}
      </p>
      <form onSubmit={submit} className="card stack">
        <label>{isAdmin ? "Officer ID" : "Student ID"}
          <input value={form.studentId} onChange={set("studentId")} required autoComplete="username" />
        </label>
        {registering && (
          <label>Full name
            <input value={form.name} onChange={set("name")} required />
          </label>
        )}
        <PasswordInput
          label="Password"
          value={form.password}
          onChange={set("password")}
          required
          minLength={registering ? 6 : undefined}
          autoComplete={registering ? "new-password" : "current-password"}
        />
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{registering ? "Create account" : "Log in"}</button>
      </form>

      {!registering && (
        <p className="forgot-row"><Link to={isAdmin ? "/admin/forgot" : "/student/forgot"}>Forgot password?</Link></p>
      )}

      {isAdmin ? (
        <p className="muted">Student? <Link to="/student/login">Go to student login</Link></p>
      ) : (
        <p>
          {mode === "login" ? "New here?" : "Already registered?"}{" "}
          <button className="link" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
            {mode === "login" ? "Register as a voter" : "Log in instead"}
          </button>
        </p>
      )}
    </div>
  );
}