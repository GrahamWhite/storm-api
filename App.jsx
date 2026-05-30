import { useState } from "react";
import axios from "axios";

const API = "http://192.168.68.56:3001";

const authHeaders = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  },
});

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [users, setUsers] = useState([]);
  const [mode, setMode] = useState("login");

  const login = async () => {
    try {
      const res = await axios.post(`${API}/api/auth/login`, {
        username: email,
        password,
      });

      setToken(res.data.token);
      localStorage.setItem("token", res.data.token);
    } catch (err) {
      alert(err.response?.data?.error || "Login failed");
    }
  };

  const register = async () => {
    try {
      const res = await axios.post(`${API}/api/register`, {
        username: email,
        password,
      });

      alert(res.data.message);
      setMode("login");
    } catch (err) {
      alert(err.response?.data?.error || "Register failed");
    }
  };

  const createUser = async () => {
  try {
    const res = await axios.post(`${API}/api/register`, {
      username: newEmail,
      password: newPassword,
    });

    alert(res.data.message);

    setNewEmail("");
    setNewPassword("");

    getUsers();
  } catch (err) {
    alert(err.response?.data?.error || "Create user failed");
  }
};

  const getUsers = async () => {
    try {
      const res = await axios.get(`${API}/api/users`, authHeaders());
      setUsers(res.data);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to load users");
    }
  };

  const updateUser = async (id, role, verified) => {
    await axios.put(
      `${API}/api/users/${id}`,
      { role, verified },
      authHeaders()
    );
    getUsers();
  };

  const deleteUser = async (id) => {
    await axios.delete(`${API}/api/users/${id}`, authHeaders());
    getUsers();
  };

  const logout = () => {
    setToken("");
    localStorage.removeItem("token");
    setUsers([]);
  };

  // ---------------- STYLES ----------------
  const page = {
    minHeight: "100vh",
    background: "#0f172a",
    color: "#e2e8f0",
    fontFamily: "Arial",
    padding: 30,
  };

  const card = {
    background: "#111827",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
  };

  const input = {
    width: "100%",
    padding: 10,
    marginTop: 8,
    marginBottom: 10,
    borderRadius: 8,
    border: "1px solid #334155",
    background: "#0b1220",
    color: "white",
  };

  const button = {
    padding: "10px 14px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    marginRight: 10,
    background: "#3b82f6",
    color: "white",
  };

  const dangerBtn = {
    ...button,
    background: "#ef4444",
  };

  const select = {
    padding: 8,
    borderRadius: 8,
    background: "#0b1220",
    color: "white",
    border: "1px solid #334155",
  };

  return (
    <div style={page}>
      <h1 style={{ marginBottom: 20 }}>⚡ API Auth Panel</h1>

      {/* LOGIN / REGISTER */}
      {!token && (
        <div style={card}>
          <h2>{mode === "login" ? "Login" : "Register"}</h2>

          <input
            style={input}
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            style={input}
            placeholder="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button style={button} onClick={mode === "login" ? login : register}>
            {mode === "login" ? "Login" : "Create Account"}
          </button>

          <button
            style={{ ...button, background: "#64748b" }}
            onClick={() =>
              setMode(mode === "login" ? "register" : "login")
            }
          >
            Switch
          </button>
        </div>
      )}

      {/* DASHBOARD */}
      {token && (
        <>
          <div style={card}>
            <h2>Dashboard</h2>

            {/* CREATE USER (ADMIN) */}
            <div style={card}>
              <h3>Create User</h3>

              <input
                style={input}
                placeholder="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />

              <input
                style={input}
                placeholder="password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />

              <button style={button} onClick={createUser}>
                Create User
              </button>
            </div>

            <button style={button} onClick={getUsers}>
              Load Users
            </button>

            <button style={dangerBtn} onClick={logout}>
              Logout
            </button>
          </div>

          {/* USERS */}
          <div style={card}>
            <h3>Users</h3>

            {users.length === 0 && (
              <p style={{ opacity: 0.7 }}>No users loaded</p>
            )}

            {users.map((u) => (
              <div
                key={u.user_id}
                style={{
                  padding: 15,
                  marginBottom: 12,
                  borderRadius: 10,
                  background: "#0b1220",
                  border: "1px solid #1f2937",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                {/* LEFT */}
                <div>
                  <div style={{ fontWeight: "bold" }}>{u.email}</div>

                  <div style={{ marginTop: 6 }}>
                    <select
                      style={select}
                      value={u.role}
                      onChange={(e) =>
                        updateUser(u.user_id, e.target.value, u.verified)
                      }
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>

                    <label style={{ marginLeft: 10 }}>
                      <input
                        type="checkbox"
                        checked={u.verified === 1}
                        onChange={(e) =>
                          updateUser(
                            u.user_id,
                            u.role,
                            e.target.checked ? 1 : 0
                          )
                        }
                      />{" "}
                      verified
                    </label>
                  </div>
                </div>

                {/* RIGHT */}
                <button
                  style={dangerBtn}
                  onClick={() => deleteUser(u.user_id)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>

          
        </>
      )}
    </div>
  );
}