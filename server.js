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
app.use(helmet());

const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  message: { error: 'Too many requests, please try again later.' }
});

const allowedOrigins = [
  'https://flumpy.ca',
  'https://www.flumpy.ca',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://192.168.68.56:5173',
  'http://192.168.68.56:3000'
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

// --- Gmail SMTP Transporter ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER, // Gmail address
    pass: process.env.SMTP_PASS  // Gmail App Password
  }
});

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

    const verifyLink = `${process.env.FRONTEND_URL}/verify/${verificationToken}`;
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

    res.json({ message: 'User updated' });
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
});


//Delete user (admin only)
app.delete('/api/users/:id', async (req, res) => {
  try {
    verifyAdmin(req);

    const { id } = req.params;

    await pool.execute(
      `DELETE FROM users WHERE user_id = ?`,
      [id]
    );

    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
});





// --- Start server ---
app.listen(PORT, () => {
  console.log(`Auth server running on port ${PORT}`);
});