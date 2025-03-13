const ControlPanel = require('./controlPanel');
const { createSticker } = require('./stickerHandler');

class MessageHandler {
    constructor(sock) {
        this.sock = sock;
        this.controlPanel = new ControlPanel(sock);
    }

    async handleMessage({ messages, sock }) {
        const msg = messages?.[0];
        if (!msg || !msg.message) return;

        // Update sock reference
        this.sock = sock;
        this.controlPanel.updateSocket(sock);

        // Add sock reference to msg object for handlers
        msg.sock = sock;

        const sender = msg.key.remoteJid;
        console.log(`[MSG] New message from ${sender}`);

        const messageContent = msg.message.conversation || 
                             msg.message.extendedTextMessage?.text || '';

        const isStatus = sender === 'status@broadcast';
        const config = this.controlPanel.getConfig();

        if (config.autoRead && isStatus) {
            console.log('[STATUS] Auto-reading status message');
            await this.sock.readMessages([msg.key]);
        }

        if (msg.key.fromMe && this.controlPanel.isControlCommand(messageContent)) {
            console.log('[CONTROL] Processing control command:', messageContent);
            await this.controlPanel.handleControlCommand(messageContent, sender, sock);
            return;
        }

        if(msg.message?.imageMessage && msg.message?.imageMessage?.caption === '.sticker') {
            console.log('[STICKER] Creating sticker from image');
            await createSticker(msg);
            return;
        }
    }
}

module.exports = MessageHandler;
