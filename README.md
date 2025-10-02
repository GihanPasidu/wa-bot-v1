# 🤖 CloudNextra Bot v2.0.0

<div align="center">

![C### 🛡️ **Security & Access Control**
- 🔒 **Owner-Only Mode** — Bot responds only to the account that scanned the QR code
- 🎯 **Auto-Detecti### 👑 **Bot Owner**
- Full access to all commands
- Bot management and configuration
- Advanced debugging information
- Owner-specific error messages

### 🚫 **Non-Owners**
- No access to any commands
- Bot only responds to QR scanner account
- Automatic access denial with clear messagingomatically identifies and restricts access to QR scanner
- 📊 **Zero Configuration** — No manual admin setup or number configuration required
- 📞 **Call Rejection** — Automatic call blocking functionality
- 💾 **Secure Auth** — Authentication data protection (excluded from git)
- 🔄 **Persistent Login** — Auth data survives deploymentsxtra Bot](https://img.shields.io/badge/CloudNextra-Bot%20v2.0.0-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)
![Node.js](### 🆕 **Version 2.0.0** - *Latest*
- 🎬 **Advanced Media Support** — Full MP4 to animated WebP sticker conversion with size optimization
- 🔧 **Improved Help System** — Role-based help documentation with clear permission indicators
- 🛠️ **Smart Role Detection** — Context-aware error messages and feature access
- 📱 **Web QR Interface** — Beautiful web-based QR code scanning at deployment URL
- 🚀 **Production Ready** — Enhanced Render deployment with persistent authentication
- 🎨 **Media Processing** — Hybrid FFmpeg + Sharp pipeline for optimal sticker quality
- 📏 **File Size Optimization** — Intelligent compression with 500KB WhatsApp limit complianceimg.shields.io/badge/Node.js-20%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Baileys](https://img.shields.io/badge/Baileys-6.6.0-blue?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

**🚀 Advanced WhatsApp Bot with Enterprise-Grade Features**

*Built using the powerful Baileys library*

</div>

---

## ✨ Key Features

### 🎛️ **Smart Role-Based Interface**
- 👑 **Owner-Only Access** — Bot restricted to QR scanner account for maximum security
- � **Context-Aware Messages** — Personalized responses for the bot owner
- � **Auto-Detection** — Automatically detects and restricts access to QR scanner
- � **Zero Configuration** — No manual admin setup required

### 🎛️ **Bot Management** *(Bot Owner Only)*
- 🔧 **Control Panel** — Comprehensive command dashboard  
- 📖 **Auto-Read** — Toggle automatic message reading
- 📞 **Anti-Call** — Block unwanted voice/video calls
- ⚡ **Toggle Bot** — Enable/disable bot functionality instantly

### 🎨 **Advanced Media Processing**
- 🏷️ **Smart Sticker Creator** — Convert images and MP4 videos to WhatsApp stickers
- 🎬 **Animated Sticker Support** — Full MP4 to animated WebP conversion with size optimization
- 🖼️ **Image Converter** — Transform stickers back to images with high quality
- 📱 **Quote Support** — Works with quoted messages and direct media uploads
- 🎭 **Professional Quality** — Hybrid FFmpeg + Sharp pipeline for optimal results
- 📏 **Size Optimization** — Intelligent compression ensuring 500KB WhatsApp compliance

### 🛠️ **Advanced Utilities**
- 🔗 **URL Shortener** — Powered by TinyURL API integration
- 🌈 **Color Lookup** — Complete color codes (HEX, RGB, HSL)
- ⏰ **Time & Uptime** — Current time, timezone, and bot statistics
- 🔐 **Password Generator** — Cryptographically secure passwords

### 👥 **User Features** *(Available to All Users)*
- ⏰ **Time & Info** — Current time, timezone, and bot statistics
- � **URL Shortener** — Powered by TinyURL API integration
- 🌈 **Color Lookup** — Complete color codes (HEX, RGB, HSL)
- � **Password Generator** — Cryptographically secure passwords

### ️ **Security & Moderation**
- 🔐 **Role-Based Access** — Smart permission system with separate interfaces for admins and users
- 📊 **Context-Aware Messaging** — Error messages and help content tailored to user privileges
- 📞 **Call Rejection** — Automatic call blocking functionality
- 💾 **Secure Auth** — Authentication data protection (excluded from git)
- 🔄 **Persistent Login** — Auth data survives deployments

---

## 🚀 Quick Start

### 📋 **Prerequisites**
- 🟢 **Node.js 20+** *(Required for Baileys compatibility)*
- 📦 **npm 9+** *(Package manager)*
- 📱 **WhatsApp Account** *(For authentication)*

### ⚡ **Installation**

1. **📥 Clone Repository**
   ```bash
   git clone https://github.com/GihanPasidu/wa-bot-v2.git
   cd wa-bot-v2
   ```

2. **📦 Install Dependencies**
   ```bash
   npm install
   ```

3. **⚙️ Configure Bot**
   
   No configuration needed! The bot automatically restricts access to the account that scans the QR code.
   
   Optional: Edit `bot.js` to customize settings:
   ```javascript
   const config = {
       autoRead: false,  // Auto-read messages
       antiCall: true,   // Block calls
       botEnabled: true  // Bot status
   };
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
   - Select your `wa-bot-v2` repository

2. **⚙️ Configure Service**
   ```yaml
   Name: cloudnextra-bot
   Environment: Node
   Build Command: npm install
   Start Command: npm start
   Instance Type: Free (or paid for better performance)
   ```

3. **🌍 Environment Variables**
   ```bash
   NODE_ENV=production
   PORT=10000
   RENDER_EXTERNAL_URL=https://your-app-name.onrender.com
   ADMIN_JIDS=your-number@s.whatsapp.net
   ```

4. **🎉 Deploy & Authenticate**
   - Click "Create Web Service"
   - Visit your deployed URL for QR authentication
   - Bot automatically handles persistence across updates!

### 🔒 **Authentication Persistence**
- ✅ **Zero Downtime** — Auth data survives all deployments
- ✅ **No Re-scanning** — QR codes only needed once per week
- ✅ **Auto-Backup** — Intelligent auth data management
- ✅ **Security Compliant** — 7-day rotation policy

---

## 📚 Command Reference

### 🎛️ **Bot Management** *(Bot Admin Only)*
| Command | Description | Usage |
|---------|-------------|-------|
| `.panel` | Admin control dashboard | `.panel` |
| `.toggle autoread` | Toggle auto-read messages | `.toggle autoread` |
| `.toggle anticall` | Toggle call blocking | `.toggle anticall` |
| `.toggle bot` | Enable/disable bot | `.toggle bot` |

### 🎨 **Media Processing** *(All Users)*
| Command | Description | Usage |
|---------|-------------|-------|
| `.sticker` | Convert image to sticker | Send/quote image + `.sticker` |
| `.toimg` | Convert sticker to image | Send/quote sticker + `.toimg` |

### 🛠️ **Utilities** *(All Users)*
| Command | Description | Usage |
|---------|-------------|-------|
| `.short <url>` | Shorten URL | `.short https://example.com` |
| `.color <color>` | Get color codes | `.color red` or `.color #ff0000` |
| `.time` | Current time & uptime | `.time` |
| `.pass <length>` | Generate password | `.pass 12` |

### 👥 **User Features** *(All Users)*
| Command | Description | Usage |
|---------|-------------|-------|
| `.time` | Current time & uptime | `.time` |
| `.pass <length>` | Generate password | `.pass 12` |

###  **Help Commands** *(All Users)*
| Command | Description | Usage |
|---------|-------------|-------|
| `.help` | Main help menu | `.help` |

---

## 🔐 Permission System

### 👑 **Bot Administrators**
- Full access to all commands
- Bot management and configuration
- Advanced debugging information
- Admin-specific error messages

###  **Regular Users**
- Media processing tools
- Basic utility commands
- User-friendly help system

---

## 📝 Recent Updates

### 🆕 **Version 2.0.0** - *Latest*
- 🎬 **Advanced Media Support** — Full MP4 to animated WebP sticker conversion with size optimization
- 🔧 **Improved Help System** — Role-based help documentation with clear permission indicators
- 🛠️ **Smart Role Detection** — Context-aware error messages and feature access
- 📱 **Web QR Interface** — Beautiful web-based QR code scanning at deployment URL
- 🚀 **Production Ready** — Enhanced Render deployment with persistent authentication
- 🎨 **Media Processing** — Hybrid FFmpeg + Sharp pipeline for optimal sticker quality
- 📏 **File Size Optimization** — Intelligent compression with 500KB WhatsApp limit compliance

---

## 🤝 Contributing

We welcome contributions! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## � Acknowledgments

- **Baileys** — Excellent WhatsApp Web API library
- **Sharp** — High-performance image processing
- **FFmpeg** — Video processing capabilities
- **Render** — Reliable cloud hosting platform

---

<div align="center">

**🌟 Star this repository if you find it helpful!**

Made with ❤️ by CloudNextra Solutions

</div>
