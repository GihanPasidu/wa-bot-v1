# CloudNextra WhatsApp Bot

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

A WhatsApp bot built with Baileys that can be deployed to Render.

## Features
- Auto status reading
- Anti-call protection
- Sticker creation
- Easy control panel

## Deploy to Render
1. Fork this repository
2. Click the "Deploy to Render" button
3. Create a new Web Service
4. Configure Environment Variables in Render:
   - `AUTO_READ_STATUS`: true/false
   - `ANTI_CALL`: true/false
   - `WELCOME_MESSAGE`: Your welcome message
   - `GOODBYE_MESSAGE`: Your goodbye message

## Local Development
1. Clone the repository
2. Install dependencies: `npm install`
3. Create `.env` file with required variables
4. Run: `npm start`

## Connecting Your WhatsApp
Fork and Deploy WhatsApp Bot Guide
1. Fork the Repository
Go to the repository on GitHub
Click the "Fork" button in the top-right corner
Select your account to create the fork

2. Configure Environment Variables
In your forked repository:
Go to "Settings" > "Secrets and variables" > "Actions"
Click "New repository secret"
Add these secrets:
AUTO_READ_STATUS=true
ANTI_CALL=true

3. Create GitHub Actions Workflow
Create a new file at .github/workflows/bot.yml:

name: Run WhatsApp Bot

on:
  workflow_dispatch:
  schedule:
    - cron: '0 0 * * *'  # Run daily at midnight UTC

jobs:
  run-bot:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          
      - name: Install dependencies
        run: |
          npm ci
          npm run build
          
      - name: Start bot and display QR
        env:
          AUTO_READ_STATUS: ${{ secrets.AUTO_READ_STATUS }}
          ANTI_CALL: ${{ secrets.ANTI_CALL }}
          CI: true
        run: |
          node index.js &
          sleep 30
          
      - name: Keep alive
        run: |
          while true; do
            sleep 300
            echo "Bot is running..."
          done

4. Deploy the Bot
Go to your forked repository
Click on "Actions" tab
Click on "Run WhatsApp Bot" workflow
Click "Run workflow" button
Wait for the workflow to start
When QR code appears in the logs:
Open WhatsApp on your phone
Go to Settings > Linked Devices
Tap "Link a Device"
Scan the QR code from the workflow logs

5. Monitor the Bot
The bot will run continuously in the GitHub Action
Check the workflow logs for any errors or status updates
The bot will automatically:
Convert images to stickers with .sticker caption
Auto-read status updates (if enabled)
Block calls (if enabled)
Respond to control commands:
.panel - Show control panel
.autoread - Toggle status auto-read
.anticall - Toggle call blocking
.sticker - Show sticker creation help
Important Notes
The workflow runs for 6 hours before timing out (GitHub's limit)
You'll need to manually restart it or use the scheduled cron job
Your WhatsApp session persists between runs in the repository
Keep your fork private to protect your WhatsApp session data
Monitor your GitHub Actions minutes usage
Troubleshooting
If the bot disconnects:

Stop the current workflow
Delete the auth_info folder in your repository if it exists
Start a new workflow run
Scan the new QR code
For security, never share your auth_info folder or QR codes with others.

## Important Notes
- For security, never share your auth_info folder or QR codes with others
- First run will require QR code scan
- Auth session is persisted in Render disk