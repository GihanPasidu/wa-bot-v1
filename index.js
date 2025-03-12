require('dotenv').config();
const WhatsAppBot = require('./src/bot');

async function startBot() {
    const bot = new WhatsAppBot();
    await bot.connect();
}

startBot().catch(console.error);
