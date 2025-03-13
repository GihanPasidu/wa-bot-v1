# CloudNextra WhatsApp Bot


## Features
- 🤖 Auto status reader
- 🚫 Anti-call protection
- 🖼️ Sticker creation
- ⚙️ Control panel

## Deployment on Render

1. Fork this repository
2. Create a Render account at https://render.com
3. Create a new Web Service in Render:
   - Connect your GitHub repository
   - Choose "Web Service"
   - Set Environment: Node
   - Set Build Command: `npm install`
   - Set Start Command: `npm start`
   - Choose Instance Type: Free

### Environment Variables

Add these to your Render dashboard:
```env
AUTO_READ_STATUS=true
ANTI_CALL=true
WELCOME_MESSAGE=Welcome to the group! 👋
GOODBYE_MESSAGE=Goodbye! 👋
```

### GitHub Actions Setup

1. Go to your GitHub repository settings
2. Add these secrets:
   - `RENDER_API_KEY`: Your Render API key
   - `RENDER_SERVICE_ID`: Your Render service ID

## Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with required variables
4. Start the bot:
   ```bash
   npm run dev
   ```

