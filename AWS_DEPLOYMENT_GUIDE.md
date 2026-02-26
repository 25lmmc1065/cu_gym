# AWS EC2 Deployment Guide (CU Hostel Gym Portal)

This guide will help you deploy your Node.js + React + SQLite project to a free AWS EC2 instance.

## Step 1: Create an AWS EC2 Instance
1. Go to your **AWS Console** and search for **EC2**.
2. Click **Launch Instance**.
3. **Name:** `cu-gym-portal`
4. **OS Image (AMI):** Select **Ubuntu 24.04 LTS** (Free tier eligible).
5. **Instance Type:** `t2.micro`.
6. **Key Pair:** Create a new key pair (e.g., `gym-key.pem`) and download it. You need this to connect!
7. **Network Settings:** 
   - Check **Allow SSH traffic**
   - Check **Allow HTTP traffic from the internet**
   - Check **Allow HTTPS traffic from the internet**
8. Click **Launch Instance**.

## Step 2: Connect to your Instance
1. In the EC2 Dashboard, select your running instance and click **Connect**.
2. Unke "EC2 Instance Connect" tab pe click karke seedha browser se terminal open kar lijiye.

## Step 3: Install Node.js, PM2 & Nginx
Terminal mein yeh commands ek-ek karke run karein:

```bash
# Update server
sudo apt update && sudo apt upgrade -y

# Install Node.js (v20)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-install -y nodejs

# Install PM2 (to keep server running in background)
sudo npm install -g pm2

# Install Nginx (Web Server)
sudo apt install -y nginx
```

## Step 4: Get Your Code on the Server
Aap apne code ko Github pe push karke server pe clone kar sakte hain:

```bash
# Install git
sudo apt install git -y

# Clone your project (Replace URL with your github repository link)
git clone https://github.com/YOUR_USERNAME/cu-hostel-gym-portal.git

# Go inside the folder
cd cu-hostel-gym-portal
```

## Step 5: Install Dependencies & Build
```bash
# Install NPM packages
npm install

# Build the React Frontend (This creates the 'dist' folder)
npm run build
```

## Step 6: Start the Server with PM2
Since your server uses TypeScript (`server.ts`), we will run it via `tsx`:

```bash
# Start server
pm2 start "npm run start" --name "gym-portal"

# Setup PM2 to restart automatically if server reboots
pm2 startup
# (Run the command that PM2 output gives you)
pm2 save
```

## Step 7: Configure Nginx to route Traffic
Ab hum Nginx ko configure karenge taaki port `80` (Standard Website) ka traffic port `3000` (Aapka Node Server) par chala jaye.

```bash
sudo nano /etc/nginx/sites-available/default
```

File ke andar ka sab kuch delete karke yeh paste karein (uske liye Ctrl+K dabaye rakhne se lines delete ho jayngi):

```nginx
server {
    listen 80;
    server_name YOUR_SERVER_PUBLIC_IP_OR_DOMAIN; # Yahan EC2 ka public IP dalein

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Save karne ke liye: `Ctrl + X`, phir `Y`, phir `Enter`.

Ab Nginx ko restart karein:
```bash
sudo systemctl restart nginx
```

## 🎉 Step 8: Test Your Website
Go to your browser and paste your **EC2 Instance Public IP Address** (e.g., `http://13.234.xx.xx`). Aapka CU Hostel Gym Portal live ho jayega!

---
**Note about SQLite Database:**
Kyunki hum SQLite use kar rahe hain, aapka data `hostel_gym.db` file mein EC2 ke hard drive par save hoga. Agar aap kabhi apna code dobara git se pull/update karein, dhyan rakhein ki aap is file ko delete/overwrite na karein!
