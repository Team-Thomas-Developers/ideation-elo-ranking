import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";

// Replace this with your actual Supabase user ID
const HOST_USER_ID = "5f1e9c86-d564-4238-bc1b-5b9c7a93deeb"; // I'm the host lol. aka Zane

export default function Lobby() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data.user);
    });

    // Load existing users in lobby
    supabase.from("users").select("*").then(({ data }) => {
      if (data) setUsers(data);
    });

    // Listen for new users joining
    const channel = supabase
      .channel("lobby")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "users" }, (payload) => {
        setUsers((prev) => [...prev, payload.new]);
      })
      // Listen for host starting the session (round inserted)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "rounds" }, () => {
        navigate("/round/1");
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [navigate]);

  const isHost = currentUser?.id === HOST_USER_ID;

  async function startSession() {
    setLoading(true);
    // Create round 1
    const { error } = await supabase
      .from("rounds")
      .insert({ round_num: 1, status: true });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    // Generate a matchup for every user
    const { data: ideas } = await supabase.from("ideas").select("id");
    if (!ideas || ideas.length < 2) {
      alert("Need at least 2 ideas loaded before starting.");
      setLoading(false);
      return;
    }

    const { data: round } = await supabase
      .from("rounds")
      .select("id")
      .eq("round_num", 1)
      .single();

    const matchups = users.map((user) => {
      const shuffled = [...ideas].sort(() => Math.random() - 0.5);
      return {
        round_id: round.id,
        user_id: user.id,
        idea_a: shuffled[0].id,
        idea_b: shuffled[1].id,
        status: false,
      };
    });

    await supabase.from("matchups").insert(matchups);
    navigate("/round/1");
  }

  return (
    <div style={{ maxWidth: 480, margin: "60px auto", padding: "0 24px" }}>
      <h1>Lobby</h1>
      <p style={{ color: "var(--color-text-secondary)" }}>
        {isHost ? "You are the host. Start when everyone is in." : "Waiting for the host to start..."}
      </p>

      <div style={{ margin: "32px 0" }}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>
          Participants ({users.length})
        </h2>
        {users.map((u) => (
          <div
            key={u.id}
            style={{
              padding: "10px 14px",
              marginBottom: 8,
              borderRadius: "var(--border-radius-md)",
              background: "var(--color-background-secondary)",
              color: "var(--color-text-primary)",
            }}
          >
            {u.name || u.email}
          </div>
        ))}
      </div>

      {isHost && (
        <button
          onClick={startSession}
          disabled={loading || users.length < 2}
          style={{
            padding: "12px 24px",
            borderRadius: "var(--border-radius-md)",
            background: "var(--color-background-info)",
            color: "var(--color-text-info)",
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 500,
            fontSize: 15,
          }}
        >
          {loading ? "Starting..." : "Start session"}
        </button>
      )}
    </div>
  );
}