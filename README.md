# CloudNextra WhatsApp Bot

![Deploy Status](https://github.com/GihanPasidu/whatsapp/actions/workflows/node.js.yml/badge.svg)

## Deployment

The bot is automatically deployed to Render when changes are pushed to the main branch.

### Environment Variables

Required environment variables:
- `RENDER_API_KEY`: Your Render API key
- `AUTO_READ_STATUS`: Set to "true" to auto-read status
- `ANTI_CALL`: Set to "true" to reject calls
- `WELCOME_MESSAGE`: Custom welcome message
- `GOODBYE_MESSAGE`: Custom goodbye message

### Development

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

