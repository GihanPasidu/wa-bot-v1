# CloudNextra WhatsApp Bot

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

A feature-rich WhatsApp bot built with Baileys, designed for seamless deployment on Render.

## Features
- 🚀 Auto status view
- 📵 Call blocking protection
- 🖼️ Sticker creation
- ⚙️ Easy control panel
- 🔄 Auto-reconnect
- 💾 Session persistence

## Deploy to Render
1. Fork this repository
2. Click the "Deploy to Render" button
3. Connect your GitHub account
4. Configure environment variables:
   ```env
   AUTO_READ_STATUS=true
   ANTI_CALL=true
   WELCOME_MESSAGE=Welcome! 👋
   GOODBYE_MESSAGE=Goodbye! 👋
   ```
5. Deploy and watch the logs for QR code
6. Scan QR with WhatsApp mobile app
7. If bot gets stuck in connection loop, visit `/clear-auth` endpoint to reset

## Troubleshooting
- **Connection Loop**: Bot tries existing auth 3 times, then auto-generates new QR code
- **Manual Reset**: Visit `https://your-app.onrender.com/clear-auth` to force clear auth state
- **QR Code**: Visit `https://your-app.onrender.com/qr` to see QR code in browser
- **Bot Status**: Visit `https://your-app.onrender.com/status` to check connection status
- **No QR Code**: Check logs for errors, may need to clear auth state first

## Available Endpoints
- `/health` - Health check for Render
- `/ping` - Ping endpoint  
- `/qr` - View QR code in browser
- `/clear-auth` - Manually clear authentication state
- `/status` - Check bot status and connection attempts

## Bot Commands
- `.panel` - Show control panel menu
- `.autoread` - Toggle auto status view
- `.anticall` - Toggle call blocking
- `.sticker` - Create sticker from image

## Local Development
1. Clone the repository
```bash
git clone https://github.com/yourusername/whatsapp.git
cd whatsapp
```

2. Install dependencies
```bash
npm install
```

3. Create `.env` file with required variables
4. Start the bot
```bash
npm start
```

## Important Notes
- For security, never share your auth_info folder or QR codes
- First run requires QR code scan
- Session is persisted in Render disk storage
- Bot stays active using health checks

## Support
- Report issues on GitHub
- Contribute via pull requests
- Contact: cloudnextra@gmail.com
- Whatsapp: https://wa.me/94767219661

## License
MIT License - feel free to use and modify