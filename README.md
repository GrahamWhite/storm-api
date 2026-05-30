# storm-api
An API Configuration for Linux, Nginx, SQL, NodeJS Stack



SQL Database Installation:

sudo apt install mysql-server -y
sudo systemctl enable mysql
sudo systemctl start mysql
sudo systemctl status mysql

sudo mysql_secure_installation

Recommended:

Set root password → YES
Remove anonymous users → YES
Disable remote root login → YES
Remove test database → YES



sudo mysql

Create Database with Root:

mysql -u root -p


CREATE DATABASE default_database;

CREATE USER 'admin'@'localhost' IDENTIFIED BY 'YOUR_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON moss.* TO 'admin'@'localhost';
FLUSH PRIVILEGES;
EXIT;

Create Tables with Admin User:

mysql -u admin -p <YOUR_PASSWORD_HERE>

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    verified TINYINT(1) DEFAULT 0,
    verification_token VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

<!-- CREATE TABLE meeting (
    meeting_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    start_time DATETIME NOT NULL,
    info TEXT,
    location VARCHAR(255),
    picture_url TEXT,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_meeting (
    user_id INT NOT NULL,
    meeting_id INT NOT NULL,
    PRIMARY KEY (user_id, meeting_id),
    FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE,
    FOREIGN KEY (meeting_id) REFERENCES meeting(meeting_id) ON DELETE CASCADE
); -->



Generate Strong JWT Secret
openssl rand -hex 32

Set up auto-restart
npm install -g pm2
pm2 start server.js --name moss-api
pm2 save
pm2 startup