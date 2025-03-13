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

        // Check if this is a control command (either from yourself in any chat or in self chat)
        const isSelfChat = sender === 'status@broadcast';
        const isFromMe = msg.key.fromMe;
        
        if (isFromMe || isSelfChat) {
            // Handle control commands
            if (this.controlPanel.isControlCommand(messageContent)) {
                await this.controlPanel.handleControlCommand(messageContent, sender);
                return;
            }

            // Handle clear/restart commands
            if (messageContent === '.clear') {
                const { clearAuthState } = require('../auth/authState');
                await clearAuthState();
                await this.sock.sendMessage(sender, { text: 'All sessions cleared! Bot will restart...' });
                process.exit(0);
                return;
            }
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
