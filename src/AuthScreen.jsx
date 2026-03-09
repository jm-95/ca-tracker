import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function AuthScreen() {
  const [mode, setMode]       = useState("login"); // login | signup
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  const handleSubmit = async () => {
    setError(""); setSuccess(""); setLoading(true);
    if (!email || !password) { setError("Please enter email and password."); setLoading(false); return; }

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setSuccess("Account created! Check your email to confirm, then log in.");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0A0F1E", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: 20 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Libre+Baskerville:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .auth-inp { background: #0A0F1E; border: 1px solid #1E293B; border-radius: 9px; color: #E2E8F0; padding: 11px 14px; font-size: 14px; width: 100%; font-family: 'DM Sans', sans-serif; outline: none; transition: border .18s; }
        .auth-inp:focus { border-color: #2563EB; }
        .auth-btn { background: linear-gradient(135deg, #2563EB, #1D4ED8); color: #fff; border: none; border-radius: 9px; padding: 12px; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 700; cursor: pointer; width: 100%; transition: opacity .18s; letter-spacing: .3px; }
        .auth-btn:hover { opacity: .88; }
        .auth-btn:disabled { opacity: .5; cursor: not-allowed; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ width: 48, height: 48, background: "linear-gradient(135deg,#2563EB,#0EA5E9)", borderRadius: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 14 }}>📋</div>
          <h1 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 24, fontWeight: 700, color: "#F1F5F9", marginBottom: 6 }}>CA Client Tracker</h1>
          <p style={{ fontSize: 13, color: "#475569" }}>Accounting workflow management</p>
        </div>

        {/* Card */}
        <div style={{ background: "#111827", border: "1px solid #1E293B", borderRadius: 16, padding: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#F1F5F9", marginBottom: 22 }}>
            {mode === "login" ? "Sign in to your account" : "Create an account"}
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".8px", textTransform: "uppercase", color: "#475569", marginBottom: 5 }}>Email</div>
              <input className="auth-inp" type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@yourfirm.com" onKeyDown={e => e.key === "Enter" && handleSubmit()} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".8px", textTransform: "uppercase", color: "#475569", marginBottom: 5 }}>Password</div>
              <input className="auth-inp" type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" onKeyDown={e => e.key === "Enter" && handleSubmit()} />
            </div>

            {error   && <div style={{ fontSize: 13, color: "#FCA5A5", background: "#7F1D1D33", border: "1px solid #7F1D1D55", borderRadius: 8, padding: "9px 13px" }}>⚠ {error}</div>}
            {success && <div style={{ fontSize: 13, color: "#86EFAC", background: "#14532D33", border: "1px solid #14532D55", borderRadius: 8, padding: "9px 13px" }}>✓ {success}</div>}

            <button className="auth-btn" onClick={handleSubmit} disabled={loading}>
              {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </div>

          <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#475569" }}>
            {mode === "login" ? (
              <>Don't have an account?{" "}
                <span onClick={() => { setMode("signup"); setError(""); setSuccess(""); }} style={{ color: "#60A5FA", cursor: "pointer", fontWeight: 600 }}>Sign up</span>
              </>
            ) : (
              <>Already have an account?{" "}
                <span onClick={() => { setMode("login"); setError(""); setSuccess(""); }} style={{ color: "#60A5FA", cursor: "pointer", fontWeight: 600 }}>Sign in</span>
              </>
            )}
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: "#1E293B", marginTop: 20 }}>
          Secured by Supabase Auth · Data encrypted at rest
        </p>
      </div>
    </div>
  );
}
