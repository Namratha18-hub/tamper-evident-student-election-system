import { useEffect, useState, createContext, useContext } from "react";
import { Routes, Route, NavLink, Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "./api.js";
import "./archive.css";
import "./auth.css";
import "./trust.css";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Forgot from "./pages/Forgot.jsx";
import ChangePassword from "./pages/ChangePassword.jsx";
import Ballot from "./pages/Ballot.jsx";
import Results from "./pages/Results.jsx";
import Past from "./pages/Past.jsx";
import Verify from "./pages/Verify.jsx";
import Admin from "./pages/Admin.jsx";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // On first load, ask the server whether a session cookie is still valid.
  useEffect(() => {
    api("/auth/me").then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  // The server checks the vote chain every minute. If it ever breaks, everyone sees a red banner.
  const [integrity, setIntegrity] = useState(null);
  useEffect(() => {
    const load = () => api("/public/integrity").then(setIntegrity).catch(() => {});
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    setUser(null);
    navigate("/");
  }

  if (loading) return <p className="center muted">Loading…</p>;

  // Where a logged-in person lands
  const home = user ? (user.role === "admin" ? "/admin" : "/ballot") : "/";
  // Someone who signed in with a temporary password can only set a new one
  const forced = !!(user && user.mustChangePassword);

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {integrity && integrity.ok === false && (
        <div className="integrity-alert" role="alert">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
          <span><strong>Integrity alert:</strong> {integrity.reason} Do not trust the results until the election officer has investigated.</span>
        </div>
      )}
      <div className="top-banner">
        <i className="fa-solid fa-check-to-slot" aria-hidden="true" />
        <span>Student Council Election 2026. Every vote is hash-chained and can be verified.</span>
      </div>

      <header className="header">
        <div className="header-container">
          <Link to="/" className="brand">
            <span className="emblem-mark" aria-hidden="true"><i className="fa-solid fa-stamp" /></span>
            <span>
              <span className="brand-name">Student Election</span>
              <span className="brand-sub">Tamper-evident voting portal</span>
            </span>
          </Link>
          {user && (
            <nav>
              {!forced && user.role === "voter" && <NavLink to="/ballot"><i className="fa-solid fa-check-to-slot" aria-hidden="true" />Ballot</NavLink>}
              {!forced && <NavLink to="/results"><i className="fa-solid fa-chart-pie" aria-hidden="true" />Results</NavLink>}
              {!forced && <NavLink to="/past"><i className="fa-solid fa-trophy" aria-hidden="true" />Past elections</NavLink>}
              {!forced && <NavLink to="/verify"><i className="fa-solid fa-shield-halved" aria-hidden="true" />Verify chain</NavLink>}
              {!forced && user.role === "admin" && <NavLink to="/admin"><i className="fa-solid fa-user-shield" aria-hidden="true" />Admin</NavLink>}
              {!forced && <NavLink to="/change-password"><i className="fa-solid fa-key" aria-hidden="true" />Password</NavLink>}
              <button className="link" onClick={logout}>Log out ({user.studentId})</button>
            </nav>
          )}
        </div>
      </header>

      <main className="container">
        {forced ? (
          <ChangePassword forced />
        ) : (
          <Routes>
            <Route path="/" element={user ? <Navigate to={home} /> : <Landing />} />
            <Route path="/student/login" element={user ? <Navigate to={home} /> : <Login role="voter" />} />
            <Route path="/admin/login" element={user ? <Navigate to={home} /> : <Login role="admin" />} />
            <Route path="/student/forgot" element={user ? <Navigate to={home} /> : <Forgot role="voter" />} />
            <Route path="/admin/forgot" element={user ? <Navigate to={home} /> : <Forgot role="admin" />} />
            <Route path="/change-password" element={user ? <ChangePassword /> : <Navigate to="/" />} />
            <Route path="/ballot" element={user ? <Ballot /> : <Navigate to="/student/login" />} />
            <Route path="/results" element={user ? <Results /> : <Navigate to="/" />} />
            <Route path="/past" element={user ? <Past /> : <Navigate to="/" />} />
            <Route path="/verify" element={user ? <Verify /> : <Navigate to="/" />} />
            <Route path="/admin" element={user?.role === "admin" ? <Admin /> : <Navigate to={user ? home : "/admin/login"} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        )}
      </main>

      <footer className="footer">
        <div className="footer-content">
          <div>
            <h4>Student Election</h4>
            <p>A college project where every stored vote is linked to the one before it, so changes cannot stay hidden.</p>
          </div>
          <div>
            <h4>Sign in</h4>
            <p><Link to="/student/login">Student login</Link></p>
            <p><Link to="/admin/login">Election officer login</Link></p>
          </div>
          <div>
            <h4>Built with</h4>
            <p>Node.js, Express, React and MongoDB</p>
          </div>
        </div>
        <div className="footer-sub">Votes are stored without names. The list of who has voted is kept separately.</div>
      </footer>
    </AuthContext.Provider>
  );
}