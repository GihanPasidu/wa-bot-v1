// Add crypto polyfill for GitHub Actions environment
global.crypto = require('crypto');

require('dotenv').config();
const WhatsAppBot = require('./src/bot');

async function startBot() {
    const bot = new WhatsAppBot();
    await bot.connect();
}

startBot().catch(console.error);
