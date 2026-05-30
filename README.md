# 🛠️ API Stack Installation Guide
## Linux + Nginx + MySQL + Node.js

This guide sets up a full backend stack including:
- MySQL database
- Node.js API server
- PM2 process manager
- Vite frontend client

---

# 🗄️ 1. MySQL Installation

    sudo apt update
    sudo apt install mysql-server -y

    sudo systemctl enable mysql
    sudo systemctl start mysql
    sudo systemctl status mysql

---

## 🔐 Secure MySQL Setup

    sudo mysql_secure_installation

Recommended answers:

- Set root password → YES  
- Remove anonymous users → YES  
- Disable remote root login → YES  
- Remove test database → YES  

---

# 🧱 2. Create Database & User

Login as root:

    sudo mysql

### Create database:

    CREATE DATABASE default_database;

---

### Create admin user:

    CREATE USER 'admin'@'localhost' IDENTIFIED BY 'YOUR_PASSWORD_HERE';

---

### Grant permissions:

    GRANT ALL PRIVILEGES ON default_database.* TO 'admin'@'localhost';
    FLUSH PRIVILEGES;
    EXIT;

---

# 📊 3. Create Users Table

Login as admin:

    mysql -u admin -p

Then run:

    USE default_database;

    CREATE TABLE users (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        verified TINYINT(1) DEFAULT 0,
        verification_token VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

---

# 🔐 4. Generate JWT Secret

    openssl rand -hex 32

Copy output into .env:

    JWT_SECRET=your_generated_secret_here

---

# 🚀 5. Install PM2 (Process Manager)

    npm install -g pm2

Start server:

    pm2 start server.js --name moss-api

Save process:

    pm2 save

Enable startup on reboot:

    pm2 startup

---

# 🌐 6. Frontend Client Setup (Vite + React)

    npm create vite@latest api-client
    cd api-client
    npm install
    npm install axios
    npm run dev

---

# ⚡ 7. Recommended Environment Variables

Create .env in backend:

    PORT=3001

    DB_HOST=localhost
    DB_USER=admin
    DB_PASSWORD=YOUR_PASSWORD_HERE
    DB_NAME=default_database

    JWT_SECRET=your_secret_here

    SMTP_USER=your_email@gmail.com
    SMTP_PASS=your_app_password

    FRONTEND_URL=http://localhost:5173

---

# 🔥 Done

Your stack is now running:

- MySQL database
- Node.js API backend (PM2)
- React frontend (Vite)
- JWT authentication system
