import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import AuthScreen from "./AuthScreen";
import Tracker from "./Tracker";

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0A0F1E", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#475569", fontFamily: "sans-serif", fontSize: 14 }}>Loading…</div>
    </div>
  );

  return session ? <Tracker session={session} /> : <AuthScreen />;
}
