# 🤖 CloudNextra WhatsApp Bot

A professional Wha## 📥 Status Download Feature

The bot now includes a **contact-specific** status download feature:

- ✅ **Tracks:** All incoming status posts from contacts
- 📱 **Downloads:** Images, videos, and text status posts
- 👥 **Contact-Specific:** Download from specific contacts only
- 💾 **Storage:** Saves to `downloads/status/` folder
- 🎯 **Selective:** Only downloads when you request it
- 🔄 **Management:** Auto-cleans old status posts after 24 hours

### How to Use:
1. **View Available Contacts:** Use `.contacts` to see all contacts with status posts
2. **List Contact's Status:** Use `.statuslist ContactName` to see specific contact's posts
3. **Download from Contact:** Use `.download ContactName` to download from specific person
4. **Download Specific Amount:** Use `.download ContactName 3` to download 3 posts from contact
5. **Download from All:** Use `.download 5` to download 5 posts from all contacts

### Command Examples:
```
.contacts                    # Show all contacts with status posts
.statuslist John            # List John's available status posts
.download John              # Download 5 latest posts from John
.download John 3            # Download 3 latest posts from John
.download 10                # Download 10 posts from all contacts
```

## 📺 YouTube Video Download Feature

The bot includes a powerful **YouTube video download** feature with **zero bot storage**:

- 🎬 **Downloads:** YouTube videos in MP4 format
- ⏱️ **Time Limit:** Maximum 10 minutes duration
- 📁 **Size Limit:** Maximum 64MB for WhatsApp compatibility
- 🚀 **Fast:** Direct streaming to WhatsApp (no bot storage)
- 🛡️ **Safe:** Uses temporary files only during transfer
- 🔗 **Flexible:** Supports both full and short YouTube URLs
- 💾 **Zero Storage:** Videos are sent directly to your WhatsApp without storing on bot server

### How to Use:
1. **Download Video:** Use `.youtube [URL]` or `.yt [URL]` with any YouTube video URL
2. **URL Formats:** Supports both `youtube.com/watch?v=` and `youtu.be/` formats
3. **Automatic Processing:** Bot validates URL, downloads, and sends the video immediately
4. **Direct Transfer:** Video is streamed directly to your WhatsApp mobile app

### YouTube Command Examples:
```
.youtube https://www.youtube.com/watch?v=dQw4w9WgXcQ
.yt https://youtu.be/dQw4w9WgXcQ
.youtube https://www.youtube.com/watch?v=example
```

### YouTube Download Limits:
- **Duration:** Maximum 10 minutes (600 seconds)
- **File Size:** Maximum 64MB (WhatsApp limit)
- **Format:** MP4 with audio and video
- **Quality:** Best available quality within size limits
- **Storage:** Zero storage on bot - direct transfer to WhatsApp

🔥 **No Bot Storage:** Videos are downloaded to temporary system folder and immediately deleted after sending to WhatsApp! bot built with Baileys library, featuring **QR code web interface** and **status auto-read** functionality.

## ✨ Features

- 🔐 Multi-device WhatsApp connection
- 📱 **QR code web interface** - No need to check terminal!
- 📊 **Auto-read status updates** - Only reads status, not messages
- 📥 **On-demand status download** - Download status posts with commands
- 🌐 Beautiful web dashboard with real-time status
- ⚡ Fast and reliable message handling
- 🔄 Auto-reconnection with retry logic
- 🐳 Docker containerization
- ☁️ Render deployment ready

## 🚀 Quick Start

### Local Development

1. **Clone and install**
   ```bash
   git clone https://github.com/yourusername/WA-BOT.git
   cd WA-BOT
   npm install
   ```

2. **Start the bot**
   ```bash
   npm start
   ```

3. **Connect WhatsApp via Web Interface**
   - Open http://localhost:10000 in your browser
   - The QR code will automatically appear when disconnected
   - Scan with WhatsApp: Settings → Linked Devices → Link a Device
   - No need to check terminal!

## 🎮 Bot Commands

| Command | Description |
|---------|-------------|
| `.info` | Show bot information and statistics |
| `.autoview` | Toggle auto-view for status updates |
| `.download [ContactName] [number]` | Download status posts from specific contact or all |
| `.statuslist [ContactName]` | List available status posts (all or from specific contact) |
| `.contacts` | Show all contacts with available status posts |
| `.clearstatus` | Clear the status download queue |
| `.online` | Set presence to online |
| `.offline` | Set presence to offline |

## � Status Download Feature

The bot now includes an on-demand status download feature:

- ✅ **Tracks:** All incoming status posts from contacts
- 📱 **Downloads:** Images, videos, and text status posts
- 💾 **Storage:** Saves to `downloads/status/` folder
- 🎯 **Selective:** Only downloads when you request it
- 🔄 **Management:** Auto-cleans old status posts after 24 hours

### How to Use:
1. **View Available Status:** Use `.statuslist` to see available posts
2. **Download Status:** Use `.download` to download up to 5 posts, or `.download 10` for specific amount
3. **Clear Queue:** Use `.clearstatus` to clear the status list

📁 **Download Location:** `downloads/status/`

## �📊 Auto-View Feature

The auto-view feature is designed to **only view status updates**, not regular messages:

- ✅ **Views:** WhatsApp status updates automatically
- ❌ **Doesn't view:** Regular chat messages  
- 🔧 **Toggle:** Use `.autoview` command to enable/disable

This ensures your privacy while keeping up with status updates from contacts.

## 📡 API Endpoints

- `GET /` - Web dashboard with QR code interface
- `GET /qr` - QR code API endpoint
- `GET /status` - Bot connection status
- `GET /health` - Health check
- `GET /ping` - Keep-alive ping

## 🔧 QR Code Troubleshooting

If the QR code doesn't appear:

1. **Check the console logs** for QR generation messages
2. **Refresh the page** - the QR updates automatically
3. **Clear auth_info folder** if you're having session issues
4. **Check browser console** for JavaScript errors

The QR code will only appear when:
- The bot is disconnected from WhatsApp
- A new session needs to be established
- The previous session has expired

---

Made with ❤️ by [CloudNextra](https://cloudnextra.com)
- Reconnection attempts
- Command prefix
- Keep-alive settings
- Logging levels

## 📡 API Endpoints

- `GET /` - Web dashboard with QR code
- `GET /health` - Health check
- `GET /ping` - Keep-alive ping
- `GET /qr` - QR code API
- `GET /status` - Bot status
- `GET /keep-alive-stats` - Keep-alive statistics

## 🔧 Development

### Project Structure

```
WA-BOT/
├── index.js          # Main bot file
├── config.js         # Configuration
├── polyfill.js       # Node.js polyfills
├── keep-alive.js     # Keep-alive service
├── package.json      # Dependencies
├── Dockerfile        # Container config
├── render.yaml       # Render deployment
└── auth_info/        # WhatsApp session data
```

### Scripts

```bash
npm start          # Start the bot
npm run dev        # Development mode
npm run docker:build  # Build Docker image
npm run docker:run    # Run Docker container
```

## 🛡️ Security

- Commands only work in self-chat
- Session data is encrypted
- No sensitive data in logs
- Secure Docker container

## 📝 License

Apache License 2.0 - see [LICENSE](LICENSE) file

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📞 Support

- 🐛 [Report bugs](https://github.com/yourusername/WA-BOT/issues)
- 💬 [Discussions](https://github.com/yourusername/WA-BOT/discussions)
- 📧 Contact: contact@cloudnextra.dev

---

Made by [CloudNextra](https://cloudnextra.dev)
