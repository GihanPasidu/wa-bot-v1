const { createSticker } = require('./stickerHandler');
const ControlPanel = require('./controlPanel');

class MessageHandler {
    constructor(sock) {
        this.sock = sock;
        this.controlPanel = new ControlPanel(sock);
    }

    async handleMessage(message) {
        const msg = message.messages[0];
        if(!msg || !msg.message) return;

        // Add sock to msg object for sticker creation
        msg.sock = this.sock;
        
        const sender = msg.key.remoteJid;
        const messageContent = msg.message.conversation || 
                             msg.message.extendedTextMessage?.text || '';

        // Check if this is a control command from yourself
        if (msg.key.fromMe && this.controlPanel.isControlCommand(messageContent)) {
            await this.controlPanel.handleControlCommand(messageContent, sender);
            return;
        }

        const config = this.controlPanel.getConfig();

        // Auto read message if enabled
        if (config.autoRead) {
            await this.sock.readMessages([msg.key]);
        }

        // Anti-link protection if enabled
        if (config.antiLink && (messageContent.includes('http'))) {
            await this.handleAntiLink(msg);
            return;
        }

        // Sticker creation
        if(msg.message?.imageMessage && msg.message?.imageMessage?.caption === '!sticker') {
            await createSticker(msg);
            return;
        }
    }

    async handleAntiLink(msg) {
        await this.sock.sendMessage(msg.key.remoteJid, { text: '❌ Links are not allowed!' });
        await this.sock.deleteMessage(msg.key.remoteJid, msg.key);
    }
}

module.exports = MessageHandler;
