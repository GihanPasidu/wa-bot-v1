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