# 🤖 CloudNextra Bot v1.0.0

<div align="center">

![CloudNextra Bot](https://img.shields.io/badge/CloudNextra-Bot%20v1.0.0-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Baileys](https://img.shields.io/badge/Baileys-6.6.0-blue?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

**🚀 Streamlined WhatsApp Bot with Core Features**

*Built using the powerful Baileys library*

</div>

---

## ✨ Key Features

### ️ **Security & Access Control**

- 🔒 **Owner-Only Mode** — Bot responds only to the account that scanned the QR code
- 🎯 **Auto-Detection** — Automatically identifies and restricts access to QR scanner
- 📊 **Zero Configuration** — No manual admin setup or number configuration required
- 📞 **Call Rejection** — Automatic call blocking functionality
- 💾 **Secure Auth** — Authentication data protection (excluded from git)
- 🔄 **Persistent Login** — Auth data survives deployments

### 🎛️ **Smart Role-Based Interface**

#### 👑 **Bot Owner**
- Full access to all commands
- Bot management and configuration
- Advanced debugging information
- Owner-specific error messages

#### 🚫 **Non-Owners**
- No access to any commands
- Bot only responds to QR scanner account
- Automatic access denial with clear messaging

### 🎛️ **Bot Management** *(Bot Owner Only)*

- 🔧 **Control Panel** — Comprehensive command dashboard
- 📖 **Auto-Read** — Toggle automatic message reading
-  **Anti-Call** — Block unwanted voice/video calls
- ⚡ **Toggle Bot** — Enable/disable bot functionality instantly

---

## 🚀 Quick Start

### 📋 **Prerequisites**

- 🟢 **Node.js 20+** *(Required for Baileys compatibility)*
- 📦 **npm 9+** *(Package manager)*
- 📱 **WhatsApp Account** *(For authentication)*

### ⚡ **Installation**

1. **📥 Clone Repository**

   ```bash
   git clone https://github.com/GihanPasidu/wa-bot-v1.git
   cd wa-bot-v1
   ```

2. **📦 Install Dependencies**

   ```bash
   npm install
   ```

3. **⚙️ Configure Bot**
   
   Copy `.env.example` to `.env` and configure:

   ```env
   NODE_ENV=development
   PORT=10000
   AUTO_READ=false
   ANTI_CALL=true
   BOT_ENABLED=true
   ```

4. **🚀 Start Bot**

   ```bash
   npm start
   ```

5. **📱 Authenticate**

   - **🌐 Web Interface**: Visit `http://localhost:10000`
   - **💻 Terminal**: Scan QR code in console

---

## 🌐 Cloud Deployment

### 🚀 **Deploy to Render** *(Recommended)*


<div align="center">

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com)

</div>

#### **📋 Deployment Steps:**

1. **🔗 Connect Repository**
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Select your `wa-bot-v1` repository

2. **⚙️ Configure Service**
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free` *(Recommended for testing)*

3. **🔧 Set Environment Variables**
   ```
   NODE_ENV=production
   PORT=10000
   RENDER_EXTERNAL_URL=https://your-service.onrender.com
   ```

4. **🚀 Deploy & Authenticate**
   - Visit your Render URL to scan QR code
   - Bot will auto-configure for production

---

## 📚 Available Commands

### 👑 **Owner Commands**

- `.panel` — Interactive admin control panel
- `.status` — Bot status and system information
- `.backuptest` — Authentication backup verification

### 🔧 **Bot Settings** *(Owner Only)*

- `.autoread on/off` — Toggle automatic message reading
- `.anticall on/off` — Enable/disable call blocking
- `.bot on/off` — Enable/disable bot functionality

---

## 🔧 Configuration

### 📄 **Environment Variables**

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `10000` |
| `AUTO_READ` | Auto-read messages | `false` |
| `ANTI_CALL` | Block calls | `true` |
| `BOT_ENABLED` | Bot functionality | `true` |

### 🔐 **Authentication**

- **Persistent Storage**: Auth data survives deployments
- **Multiple Backups**: Local, temporary, and environment-based
- **Auto-Expiry**: Backups expire after 7 days
- **Throttled**: 30-second cooldown between backups

---

## 🛠️ Technical Details

### 📦 **Dependencies**

- **@whiskeysockets/baileys**: WhatsApp Web API
- **axios**: HTTP client for self-ping
- **pino**: Logging framework
- **qrcode**: QR code generation for web interface
- **qrcode-terminal**: Terminal QR code display

### 🏗️ **Architecture**

- **Node.js 20+**: Modern JavaScript runtime
- **Baileys v6.6.0**: Latest WhatsApp library
- **Persistent Auth**: Survives deployments and restarts
- **Health Monitoring**: Built-in health checks
- **Self-Ping**: Prevents service sleep on free tiers

### 🔒 **Security Features**

- **Owner-Only**: Automatic access restriction
- **Secure Auth**: Protected authentication data
- **Call Blocking**: Automatic call rejection
- **Error Handling**: Context-aware error messages

---

## 🤝 Contributing

We welcome contributions! Please feel free to submit a Pull Request.

### 📋 **Development Setup**

```bash
git clone https://github.com/GihanPasidu/wa-bot-v1.git
cd wa-bot-v1
npm install
npm run dev  # Uses nodemon for development
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/GihanPasidu/wa-bot-v1/issues)
- **Documentation**: This README
- **Contact**: contact@cloudnextra.dev

---

<div align="center">

**Made by CloudNextra Solutions**

*Powering modern WhatsApp automation*

</div>
