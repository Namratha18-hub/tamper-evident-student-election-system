import { useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../App.jsx";
import PasswordInput from "../components/PasswordInput.jsx";

// forced = the person logged in with a temporary password and must choose a new one before anything else.
export default function ChangePassword({ forced }) {
  const { setUser } = useAuth();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSaved(false);
    if (form.next !== form.confirm) {
      setError("The two new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const user = await api("/auth/change-password", { method: "POST", body: { currentPassword: form.current, newPassword: form.next } });
      setForm({ current: "", next: "", confirm: "" });
      setSaved(true);
      setUser(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="narrow">
      <h1>{forced ? "Set a new password" : "Change password"}</h1>
      <p className="muted">
        {forced
          ? "You signed in with a temporary password. Choose a new one to continue. Use the temporary password as the current password."
          : "Enter your current password, then choose a new one."}
      </p>
      {saved && !forced && <p className="success" role="status">Your password was changed.</p>}
      <form onSubmit={submit} className="card stack">
        <PasswordInput label={forced ? "Temporary password" : "Current password"} value={form.current} onChange={set("current")} required autoComplete="current-password" />
        <PasswordInput label="New password" value={form.next} onChange={set("next")} required minLength={6} autoComplete="new-password" />
        <PasswordInput label="Confirm new password" value={form.confirm} onChange={set("confirm")} required minLength={6} autoComplete="new-password" />
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>Save new password</button>
      </form>
    </div>
  );
}