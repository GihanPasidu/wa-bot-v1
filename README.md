# CloudNextra WhatsApp Bot

A powerful WhatsApp bot with multiple features.

## Features

- Auto-read status
- Anti-call protection
- Sticker creation
- Control panel menu

## Deployment

### Prerequisites

- Node.js 16 or higher
- PM2 (for production)
- SSH access to deployment server

### GitHub Secrets Required

Set these secrets in your GitHub repository:

- `DEPLOY_KEY`: SSH private key for deployment
- `DEPLOY_HOST`: Hostname of deployment server
- `DEPLOY_USER`: SSH username
- `DEPLOY_PATH`: Path to deploy application
- `AUTO_READ_STATUS`: true/false
- `ANTI_CALL`: true/false
- `WELCOME_MESSAGE`: Welcome message text
- `GOODBYE_MESSAGE`: Goodbye message text

### Local Development

1. Clone the repository
```bash
git clone https://github.com/yourusername/whatsapp-bot.git
cd whatsapp-bot
```

2. Install dependencies
```bash
npm install
```

3. Create .env file
```bash
cp .env.example .env
```

4. Run in development mode
```bash
npm run dev
```

### Production Deployment

1. Push to main branch
2. GitHub Actions will automatically deploy
3. Monitor deployment in Actions tab

## License

ISC

