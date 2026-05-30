import { useState } from "react";
import { useEffect } from "react";
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

  const [user, setUser] = useState(null);

  const [forums, setForums] = useState([]);
  const [topics, setTopics] = useState([]);
  const [posts, setPosts] = useState([]);
  const [postImage, setPostImage] = useState(null);

  const [selectedForum, setSelectedForum] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);

  const [topicTitle, setTopicTitle] = useState("");
  const [postMessage, setPostMessage] = useState("");

  const [gallery, setGallery] = useState([]);
  const [activePage, setActivePage] = useState("home");


  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    if (token) getMe();
    
    }, [token]);

  useEffect(() => {
    if (token) {
      loadForums();
    }
  }, [token]);

  useEffect(() => {
    if (activePage === "admin" && user?.role === "admin") {
      getUsers();
    }
  }, [activePage, user]);


  const login = async () => {
    try {
      const res = await axios.post(`${API}/api/auth/login`, {
        username: email,
        password,
      });

      setToken(res.data.token);
      localStorage.setItem("token", res.data.token);

      await getMe();
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

  const getMe = async () => {
  try {
    const res = await axios.get(
      `${API}/api/me`,
      authHeaders()
    );

    setUser(res.data);
  } catch {
    logout();
  }
};


// ---------- FORUM FUNCTIONS ----------

// Load forums on component mount
const loadForums = async () => {

  const res = await axios.get(
    `${API}/api/forums`
  );

  setForums(res.data);
};

// Load topics for a forum
const loadTopics = async (forumId) => {
  console.log("Loading topics for forum:", forumId);

  const res = await axios.get(
    `${API}/api/forums/${forumId}/topics`
  );

  console.log("topics response:", res.data);

  setTopics(res.data);
};

//  Create topic for a forum
const createTopic = async () => {

  
  console.log(user);


  if (!selectedForum) {
    alert("Select a forum first");
    return;
  }

  if (!topicTitle.trim()) {
    alert("Topic title cannot be empty");
    return;
  }

  try {
    await axios.post(
      `${API}/api/topics`,
      {
        forum_id: selectedForum,
        title: topicTitle.trim(),
      },
      authHeaders()
    );

    setTopicTitle("");
    loadTopics(selectedForum);
  } catch (err) {
    console.log("CREATE TOPIC ERROR:", err.response?.data || err.message);
    alert("Failed to create topic");
  }
};

const deleteTopic = async (topicId) => {
  try {
    await axios.delete(
      `${API}/api/topics/${topicId}`,
      authHeaders()
    );

    // refresh list
    loadTopics(selectedForum);

    // if you deleted the active topic, clear posts
    if (selectedTopic === topicId) {
      setSelectedTopic(null);
      setPosts([]);
    }

  } catch (err) {
    console.log("DELETE TOPIC ERROR:", err.response?.data || err.message);
    alert("Failed to delete topic");
  }
};

// Load posts for a forum
const loadPosts = async (topicId) => {

  const res = await axios.get(
    `${API}/api/topics/${topicId}/posts`
  );

  setSelectedTopic(topicId);
  setPosts(res.data);
};


//Create new post in topic (requires valid JWT)
const createPost = async () => {
  try {
    if (!selectedTopic) {
      alert("Select a topic first");
      return;
    }

    const formData = new FormData();
    formData.append("topic_id", selectedTopic);
    formData.append("message", postMessage);

    if (postImage) {
      formData.append("images", postImage); // backend expects "images"
    }

    await axios.post(
      `${API}/api/posts/upload`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "multipart/form-data",
        },
      }
    );

    setPostMessage("");
    setPostImage(null);
    loadPosts(selectedTopic);

  } catch (err) {
    console.log("CREATE POST ERROR:", err.response?.data || err.message);
    alert("Failed to create post");
  }
};



//Delete a post (If created by the user or if user is admin)
const deletePost = async (postId) => {
  try {
    await axios.delete(
      `${API}/api/posts/${postId}`,
      authHeaders()
    );

    // refresh posts
    loadPosts(selectedTopic);

  } catch (err) {
    console.log("DELETE POST ERROR:", err.response?.data || err.message);
    alert("Failed to delete post");
  }
};






const loadGallery = async () => {

  const res = await axios.get(
    `${API}/api/gallery`
  );

  setGallery(res.data);
};

const uploadImage = async (file) => {

  const formData = new FormData();

  formData.append(
    "image",
    file
  );

  await axios.post(
    `${API}/api/upload`,
    formData,
    {
      headers: {
        Authorization:
          `Bearer ${localStorage.getItem("token")}`,
        "Content-Type":
          "multipart/form-data"
      }
    }
  );

  loadGallery();
};



//Image Gallery component that displays up to 4 images in a grid, and if more than 4 images exist, show a +X overlay on the 4th image indicating how many more images there are. Clicking on an image opens it in a new tab.
const ImageGallery = ({ images, onImageClick }) => {
  if (!images || images.length === 0) return null;

  const count = images.length;

  return (
    <div style={galleryWrapper(count)}>
      {images.slice(0, 4).map((img, i) => (
        <div key={i} style={galleryItem(count, i)}>
          <img
            src={`${API}/uploads/forum/${img.filename}`}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: 8,
              cursor: "pointer"
            }}
            onClick={() => onImageClick(img.filename)}
          />

          {i === 3 && count > 4 && (
            <div style={moreOverlay}>
              +{count - 4}
            </div>
          )}
        </div>
      ))}
    </div>
  );
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

  const galleryWrapper = (count) => ({
  display: "grid",
  gap: 6,
  marginTop: 10,
  borderRadius: 10,
  overflow: "hidden",

  gridTemplateColumns:
    count === 1 ? "1fr" :
    count === 2 ? "1fr 1fr" :
    count === 3 ? "2fr 1fr" :
    "1fr 1fr",
  });

  const galleryItem = (count, index) => ({
    position: "relative",
    height:
      count === 1 ? 300 :
      count <= 4 ? 150 : 120,
  });

  const moreOverlay = {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
    fontWeight: "bold",
    borderRadius: 8,
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
      <h1 style={{ marginBottom: 30 }}>⚡ API Auth Panel</h1>

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

          <button
            style={button}
            onClick={() => setActivePage("forums")}
          >
            Forums
          </button>

          <button
            style={button}
            onClick={() => {
              setActivePage("gallery");
              loadGallery();
            }}
          >
            Gallery
          </button>

          <button
            style={button}
            onClick={() => setActivePage("solunar")}
          >
            Solunar
          </button>

          {user?.role === "admin" && (
            <button
              style={button}
              onClick={() => setActivePage("admin")}
            >
              Admin
            </button>
          )}

          <button
            style={dangerBtn}
            onClick={logout}
          >
            Logout
          </button>

        </div>

      
          {activePage === "forums" && (
  <div style={{ display: "flex", height: "80vh", gap: 10 }}>
    
    {/* LEFT: Forums */}
    <div style={card}>
      
      <h2>Forums</h2>

      {forums.map(f => (
        <div
          key={f.id}
          style={{
            padding: 10,
            marginTop: 10,
            background: selectedForum === f.id ? "#1f2937" : "#0b1220",
            cursor: "pointer",
            borderRadius: 8
          }}
          onClick={() => {
            setSelectedForum(f.id);
            setSelectedTopic(null);
            setPosts([]);
            loadTopics(f.id);
          }}
        >
          <h3>{f.title}</h3>
          <p>{f.description}</p>
        </div>
      ))}
    </div>

    {/* MIDDLE: Topics */}
    <div style={{ width: 250, background: "#0f172a", borderRadius: 10, padding: 10 }}>
      <h3>Topics</h3>

      {selectedForum && (
        <div style={{ marginBottom: 10 }}>
          <input
            style={input}
            placeholder="New topic title..."
            value={topicTitle}
            onChange={(e) => setTopicTitle(e.target.value)}
          />

          <button style={button} onClick={createTopic}>
            + Create Topic
          </button>
        </div>
      )}

      {!selectedForum && (
        <p style={{ opacity: 0.6 }}>Select a forum</p>
      )}

      {topics.map(t => (
        <div
          key={t.id}
          style={{
            padding: 10,
            marginTop: 8,
            background: selectedTopic === t.id ? "#22c55e" : "#0b1220",
            borderRadius: 8,
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between"
          }}
        >
          <div
            onClick={() => {
              setSelectedTopic(t.id);
              setPosts([]);
              loadPosts(t.id);
            }}
          >
            # {t.title}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteTopic(t.id);
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "#ef4444",
              cursor: "pointer"
            }}
          >
            🗑
          </button>
        </div>
      ))}
    </div>

    {/* RIGHT: Posts */}
    <div style={{ flex: 1, background: "#111827", borderRadius: 10, padding: 10 }}>
      <h3>Posts</h3>

      {selectedTopic && (
        <div style={{ marginBottom: 10 }}>
          <textarea
            style={{ ...input, height: 80 }}
            value={postMessage}
            onChange={(e) => setPostMessage(e.target.value)}
          />

          <input
            type="file"
            accept="image/*"
            style={{ marginTop: 10, marginBottom: 10 }}
            onChange={(e) => setPostImage(e.target.files[0])}
          />

          <button style={button} onClick={createPost}>
            Send Post
          </button>
        </div>
      )}

      {!selectedTopic && (
        <p style={{ opacity: 0.6 }}>Select a topic</p>
      )}

      <div style={{ overflowY: "auto", flex: 1 }}>
        {posts.map(p => (
  <div
    key={p.id}
    style={{
      marginBottom: 10,
      padding: 10,
      background: "#0b1220",
      borderRadius: 10,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }}
  >
    {/* LEFT: message */}
    <div>
      <div style={{ fontSize: 12, opacity: 0.7 }}>
        {p.email}
      </div>

      <div>{p.message}</div>

      <ImageGallery
        images={p.images}
        onImageClick={(filename) => setLightbox(filename)}
      />
    </div>

    {/* RIGHT: delete button */}
    {(user?.role === "admin" || user?.email === p.email) && (
      <button
        onClick={() => deletePost(p.id)}
        style={{
          background: "transparent",
          border: "none",
          color: "#ef4444",
          cursor: "pointer",
          fontSize: 16
        }}
        title="Delete post"
      >
        🗑
      </button>
    )}
  </div>
))}
      </div>
    </div>

  </div>
)}

{lightbox && (
  <div
    onClick={() => setLightbox(null)}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.9)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center"
    }}
  >
    <img
      src={`${API}/uploads/forum/${lightbox}`}
      style={{ maxHeight: "90%", maxWidth: "90%" }}
    />
  </div>
)}

{activePage === "gallery" && (

<div style={card}>

  <h2>Gallery</h2>

  <input
    type="file"
    onChange={(e) =>
      uploadImage(
        e.target.files[0]
      )
    }
  />

  <div>

    {gallery.map(img => (

      <img
        key={img.id}
        src={`${API}/uploads/forum/${img.filename}`}
        alt=""
        width={200}
        style={{
          margin:10
        }}
      />

    ))}

  </div>

</div>

)}

{activePage === "solunar" && (

<div style={card}>

  <h2>Solunar Forecast</h2>

  <h3>Next Major Feeding Time</h3>

  <p>4:15 PM - 6:15 PM</p>

  <h3>Countdown</h3>

  <p>01:12:34</p>

</div>

)}

{activePage === "admin" && user?.role === "admin" && (

<div style={card}>

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


</div>

)}
          
        </>
      )}
    </div>
  );
}