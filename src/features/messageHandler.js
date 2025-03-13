const ControlPanel = require('./controlPanel');

class MessageHandler {
    constructor(sock) {
        this.sock = sock;
        this.controlPanel = new ControlPanel(sock);
    }

    async handleMessage(message) {
        const msg = message.messages[0];
        if(!msg || !msg.message) return;

        msg.sock = this.sock;
        
        const sender = msg.key.remoteJid;
        const messageContent = msg.message.conversation || 
                             msg.message.extendedTextMessage?.text || '';

        const isStatus = sender === 'status@broadcast';
        const config = this.controlPanel.getConfig();

        // Only auto read if it's a status message
        if (config.autoRead && isStatus) {
            await this.sock.readMessages([msg.key]);
        }

        // Check if this is a control command from yourself
        if (msg.key.fromMe && this.controlPanel.isControlCommand(messageContent)) {
            await this.controlPanel.handleControlCommand(messageContent, sender);
            return;
        }

        // Anti-link protection if enabled
        if (config.antiLink && (messageContent.includes('http'))) {
            await this.handleAntiLink(msg);
            return;
        }

        // Sticker creation
        if(msg.message?.imageMessage && msg.message?.imageMessage?.caption === '.sticker') {
            await createSticker(msg);
            return;
        }
    }

    async handleAntiLink(msg) {
        await this.sock.sendMessage(msg.key.remoteJid, { text: '❌ Links are not allowed!' });
        // Use sendMessage with delete flag instead of deleteMessage
        await this.sock.sendMessage(msg.key.remoteJid, { 
            delete: msg.key 
        });
    }
}

module.exports = MessageHandler;
