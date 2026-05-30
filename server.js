require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss');
const validator = require('validator');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 4000;

// --- MySQL connection pool ---
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'default_database',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool;
async function initDB() {
  pool = await mysql.createPool(dbConfig);
}
initDB();

// --- Security Middleware ---
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);


app.use("/uploads", express.static("uploads"));

const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  message: { error: 'Too many requests, please try again later.' }
});

const allowedOrigins = [
  'http://shackntheback.ca:80',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://192.168.68.56:5173',
  'http://192.168.68.56:3000',
  'http://192.168.68.56:80'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy violation'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

app.use(express.json({ limit: '10kb' }));

function validateCredentials(email, password) {
  if (!email || !password) return false;
  if (!validator.isEmail(email)) return false;
  if (password.length < 8 || password.length > 64) return false;
  return true;
}


//Upload Configuration for forum attachments (admin only)

const fs = require("fs");

if (!fs.existsSync("./uploads")) {
  fs.mkdirSync("./uploads");
}

if (!fs.existsSync("./uploads/forum")) {
  fs.mkdirSync("./uploads/forum");
}



const multer = require("multer");

const storage = multer.diskStorage({
  destination: "./uploads/forum",
  filename: (req,file,cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});




// --- Gmail SMTP Transporter ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER, // Gmail address
    pass: process.env.SMTP_PASS  // Gmail App Password
  }
});


const upload = multer({ storage });

function verifyAdmin(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.split(' ')[1];

  if (!token) throw new Error('No token provided');

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new Error('Invalid token');
  }

  if (decoded.role !== 'admin') {
    throw new Error('Not admin');
  }

  return decoded;
}


function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// --- REGISTER (with email verification) ---
app.post('/api/register', authLimiter, async (req, res) => {
  let { username, password } = req.body;

  //For debugging purposes only, remove in production
  console.log(req.body);

  username = validator.normalizeEmail(username || '');
  password = xss(password || '');

  if (!validateCredentials(username, password)) {
    return res.status(400).json({ error: 'Invalid email or password format' });
  }

  try {
    const [rows] = await pool.execute('SELECT email FROM users WHERE email = ?', [username]);
    if (rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const saltRounds = parseInt(process.env.SALT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const verificationToken = crypto.randomBytes(32).toString('hex');

    await pool.execute(
      'INSERT INTO users (email, password_hash, verification_token, verified) VALUES (?, ?, ?, 0)',
      [username, hashedPassword, verificationToken]
    );

    const verifyLink = `${process.env.FRONTEND_URL}:${process.env.PORT}/api/verify/${verificationToken}`;
    await transporter.sendMail({
      from: `"API Email Verification" <${process.env.SMTP_USER}>`,
      to: username,
      subject: 'Verify your email - Shack N\' The Back Development Studios',
      html: `<p>Please click the link below to verify your email:</p>
             <a href="${verifyLink}">${verifyLink}</a>`
    });

    res.json({ message: 'Registration successful, please check your email to verify your account' });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- LOGIN (only if verified = 1) ---
app.post('/api/auth/login', authLimiter, async (req, res) => {
  let { username, password } = req.body;

  username = validator.normalizeEmail(username || '');
  password = xss(password || '');

  if (!validateCredentials(username, password)) {
    return res.status(400).json({ error: 'Invalid email or password format' });
  }

  try {
    const [rows] = await pool.execute(
      'SELECT email, password_hash, role, verified FROM users WHERE email = ?',
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (rows[0].verified !== 1) {
      return res.status(403).json({ error: 'Please verify your email before logging in.' });
    }

    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const userRole = rows[0].role || 'user';

    const token = jwt.sign(
      { email: username, role: userRole },
      process.env.JWT_SECRET,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    res.json({ message: 'Login successful', token, role: userRole });

    console.log(`User logged in: ${username} with role ${userRole}. JWT: ${token}`);
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- VERIFY EMAIL ---
app.get('/api/verify/:token', async (req, res) => {
  const token = req.params.token;

  try {
    const [rows] = await pool.execute(
      'SELECT email FROM users WHERE verification_token = ?',
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    await pool.execute(
      'UPDATE users SET verified = 1, verification_token = NULL WHERE verification_token = ?',
      [token]
    );

    console.log(`Email verified for: ${rows[0].email}`);

    res.json({ message: 'Email verified successfully, you can now log in.' });
  } catch (err) {
    console.error('Verification error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Protected route ---
app.get('/api/protected', (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.split(' ')[1];

  if (!token) return res.status(403).json({ error: 'No token provided' });

  jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid or expired token' });

    res.json({ message: 'Protected content accessed', user: decoded });
  });
});

// --- GET ALL USERS (admin only) ---
app.get('/api/users', async (req, res) => {
  try {
    const decoded = verifyAdmin(req);

    const [rows] = await pool.execute(
      'SELECT user_id, email, role, verified FROM users'
    );

    res.json(rows);
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
});

//Update user role and verification status (admin only)
app.put('/api/users/:id', async (req, res) => {
  try {
    verifyAdmin(req);

    const { id } = req.params;
    const { role, verified } = req.body;

    await pool.execute(
      `UPDATE users SET role = ?, verified = ? WHERE user_id = ?`,
      [role, verified, id]
    );

    console.log(`User updated: ID ${id}, Role: ${role}, Verified: ${verified}`);

    res.json({ message: 'User updated' });
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
});


//Delete user (admin only)
app.delete('/api/users/:id', async (req, res) => {
  try {
    verifyAdmin(req);

    const { id,username } = req.params;

    await pool.execute(
      `DELETE FROM users WHERE user_id = ?`,
      [id]
    );

    console.log(`User deleted: ID ${id}, Username: ${username}`);

    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
});

//Get current user info (requires valid JWT)
app.get("/api/me", verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT user_id,email,role,verified
       FROM users
       WHERE email = ?`,
      [req.user.email]
    );

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.get(
  "/api/dashboard",
  verifyToken,
  async (req,res) => {

    const [forums] =
      await pool.execute(
        "SELECT COUNT(*) count FROM forum_topics"
      );

    const [photos] =
      await pool.execute(
        "SELECT COUNT(*) count FROM uploads"
      );

    const [notifications] =
      await pool.execute(
        `
        SELECT COUNT(*) count
        FROM notifications
        WHERE user_id =
        (
          SELECT user_id
          FROM users
          WHERE email=?
        )
        `,
        [req.user.email]
      );

    res.json({
      topics: forums[0].count,
      photos: photos[0].count,
      notifications:
        notifications[0].count
    });
  }
);




//Forum Endpoints (protected, requires valid JWT)
app.get("/api/forums", async (req, res) => {
  const [rows] = await pool.execute(
    "SELECT * FROM forums ORDER BY title"
  );

  res.json(rows);
});


//Create new forum (admin only)
app.post("/api/forums", async (req, res) => {
  try {
    verifyAdmin(req);

    const { title, description } = req.body;

    await pool.execute(
      `INSERT INTO forums(title,description)
       VALUES (?,?)`,
      [title, description]
    );

    res.json({ message: "Forum created" });
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
});

//Create new topic in forum (requires valid JWT)
app.post("/api/topics", verifyToken, async (req, res) => {
  try {
    const { forum_id, title } = req.body;

    // ✅ NEVER call it "user" if you're unsure
    const authUser = req.user;

    console.log("AUTH USER:", authUser);

    const [rows] = await pool.execute(
      "SELECT user_id FROM users WHERE email = ?",
      [authUser.email]
    );

    const userId = rows[0].user_id;

    await pool.execute(
      `
      INSERT INTO forum_topics (forum_id, user_id, title)
      VALUES (?, ?, ?)
      `,
      [forum_id, userId, title]
    );

    res.json({ message: "Topic created" });

  } catch (err) {
    console.error("TOPIC ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});


//Get all topics in forum (requires valid JWT)
app.get("/api/forums/:id/topics", async (req, res) => {
  const [rows] = await pool.execute(
    `
    SELECT
      t.*,
      u.email
    FROM forum_topics t
    LEFT JOIN users u ON t.user_id = u.user_id
    WHERE t.forum_id = ?
    ORDER BY t.pinned DESC, t.created_at DESC
    `,
    [req.params.id]
  );

  res.json(rows);
});


app.get("/api/topics/:id", async (req,res) => {

  const [rows] = await pool.execute(
    `
    SELECT
      t.*,
      u.email
    FROM forum_topics t
    JOIN users u
      ON u.user_id = t.user_id
    WHERE t.id = ?
    `,
    [req.params.id]
  );

  if (!rows.length) {
    return res.status(404).json({
      error: "Topic not found"
    });
  }

  res.json(rows[0]);
});




//Upload image for forum post (requires valid JWT)
app.post(
  "/api/posts/upload",
  verifyToken,
  upload.array("images", 10), // 👈 MULTIPLE FILES (max 10)
  async (req, res) => {
    try {
      const { topic_id, message } = req.body;

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const [userRows] = await pool.execute(
        "SELECT user_id FROM users WHERE email=?",
        [req.user.email]
      );

      const userId = userRows[0].user_id;

      // 1. create post
      const [result] = await pool.execute(
        `INSERT INTO forum_posts (topic_id, user_id, message)
         VALUES (?, ?, ?)`,
        [topic_id, userId, xss(message)]
      );

      const postId = result.insertId;

      // 2. insert ALL images
      for (const file of req.files) {
        await pool.execute(
          `INSERT INTO forum_post_images (post_id, filename)
           VALUES (?, ?)`,
          [postId, file.filename]
        );
      }

      res.json({ message: "Post created with images" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }
);

app.delete("/api/posts/:id", verifyToken, async (req, res) => {
  try {
    const [userRows] = await pool.execute(
      "SELECT user_id, role FROM users WHERE email=?",
      [req.user.email]
    );

    if (!userRows.length) {
      return res.status(401).json({ error: "User not found" });
    }

    const user = userRows[0];

    const [postRows] = await pool.execute(
      "SELECT user_id FROM forum_posts WHERE id=?",
      [req.params.id]
    );

    if (!postRows.length) {
      return res.status(404).json({ error: "Post not found" });
    }

    const postOwnerId = postRows[0].user_id;

    const isOwner = postOwnerId === user.user_id;
    const isAdmin = user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Not allowed" });
    }

    await pool.execute(
      "DELETE FROM forum_posts WHERE id=?",
      [req.params.id]
    );

    res.json({ message: "Post deleted" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload images for a post
app.post(
  "/api/posts/:id/images",
  verifyToken,
  upload.array("images", 10),
  async (req, res) => {
    const postId = req.params.id;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No images uploaded" });
    }

    const values = req.files.map(f => [
      postId,
      f.filename
    ]);

    await pool.query(
      `
      INSERT INTO forum_post_images (post_id, filename)
      VALUES ?
      `,
      [values]
    );

    res.json({ message: "Images uploaded" });
  }
);


//Get all posts in topic (requires valid JWT)
app.get("/api/topics/:id/posts", async (req, res) => {
  const [posts] = await pool.execute(
    `
    SELECT p.*, u.email
    FROM forum_posts p
    LEFT JOIN users u ON p.user_id = u.user_id
    WHERE p.topic_id = ?
    ORDER BY p.created_at ASC
    `,
    [req.params.id]
  );

  for (let post of posts) {
    const [images] = await pool.execute(
      `SELECT filename FROM forum_post_images WHERE post_id = ?`,
      [post.id]
    );

    post.images = images;
  }

  res.json(posts);
});

//Delete topic and all its posts (admin only)
app.delete("/api/topics/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // 🔐 get user from JWT middleware
    const authUser = req.user;

    // 🔎 fetch user role from DB
    const [rows] = await pool.execute(
      "SELECT role FROM users WHERE email = ?",
      [authUser.email]
    );

    if (!rows.length) {
      return res.status(401).json({ error: "User not found" });
    }

    const role = rows[0].role;

    // 🚫 block non-admins
    if (role !== "admin") {
      return res.status(403).json({ error: "Admin only action" });
    }

    // delete posts first
    await pool.execute(
      "DELETE FROM forum_posts WHERE topic_id = ?",
      [id]
    );

    // delete topic
    await pool.execute(
      "DELETE FROM forum_topics WHERE id = ?",
      [id]
    );

    res.json({ message: "Topic deleted" });

  } catch (err) {
    console.error("DELETE TOPIC ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

//Upload image for forum post (requires valid JWT)
app.post(
  "/api/upload",
  verifyToken,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const [userRows] = await pool.execute(
        "SELECT user_id FROM users WHERE email=?",
        [req.user.email]
      );

      if (!userRows.length) {
        return res.status(401).json({ error: "User not found" });
      }

      await pool.execute(
        `
        INSERT INTO uploads (user_id, filename)
        VALUES (?, ?)
        `,
        [userRows[0].user_id, req.file.filename]
      );

      res.json({ filename: req.file.filename });

    } catch (err) {
      console.error("UPLOAD ERROR:", err);
      res.status(500).json({ error: err.message });
    }
  }
);
//get all uploaded images 
app.get("/api/gallery", async (req,res) => {

  const [rows] = await pool.execute(
    `
    SELECT *
    FROM uploads
    ORDER BY uploaded_at DESC
    `
  );

  res.json(rows);
});


app.get(
  "/api/notifications",
  verifyToken,
  async (req,res) => {

    if (!user.length) {
      return res.status(401).json({ error: "User not found" });
    }

    const [user] = await pool.execute(
      "SELECT user_id FROM users WHERE email=?",
      [req.user.email]
    );

    const [rows] = await pool.execute(
      `
      SELECT *
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      `,
      [user[0].user_id]
    );

    res.json(rows);
  }
);



// --- Start server ---
app.listen(PORT, () => {
  console.log(`Auth server running on port ${PORT}`);
});