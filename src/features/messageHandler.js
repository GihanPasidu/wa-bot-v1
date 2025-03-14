const ControlPanel = require('./controlPanel');
const { createSticker } = require('./stickerHandler');

class MessageHandler {
    constructor(sock) {
        this.sock = sock;
        this.controlPanel = new ControlPanel(sock);
    }

    async handleMessage({ messages, sock }) {
        try {
            if (!messages || !messages[0]) return;
            
            const msg = messages[0];
            
            // Check if message is valid and has content
            if (!msg.message && !msg.messageStubType) {
                return; // Ignore empty or invalid messages
            }

            const messageContent = msg.message?.conversation || 
                                 msg.message?.extendedTextMessage?.text ||
                                 msg.message?.imageMessage?.caption || '';
            const sender = msg.key.remoteJid;

            console.log('[MSG] New message from', sender);

            // Group message handling with error recovery
            if (sender.endsWith('@g.us')) {
                try {
                    // Skip processing if no message content
                    if (!msg.message) return;
                    
                    // Try to decrypt group message
                    if (msg.message.senderKeyDistributionMessage) {
                        console.log('[MSG] Received new sender key for group');
                        return; // Skip processing this message type
                    }

                } catch (err) {
                    if (err.message.includes('No SenderKeyRecord')) {
                        console.log('[MSG] Group message decryption failed - missing sender key');
                        return;
                    }
                    console.warn('[MSG] Group message error:', err.message);
                    return; // Skip processing on error
                }
            }

            // Handle control commands
            if (messageContent && this.controlPanel.isControlCommand(messageContent)) {
                console.log('[CONTROL] Processing control command:', messageContent);
                await this.controlPanel.handleControlCommand(messageContent, sender, sock);
                return;
            }

            // Handle sticker creation
            if(msg.message?.imageMessage && messageContent === '.sticker') {
                console.log('[STICKER] Creating sticker from image');
                await createSticker(msg);
                return;
            }

        } catch (error) {
            console.error('[MSG] Error handling message:', error);
            // Don't throw the error to prevent crashing
        }
    }
}

module.exports = MessageHandler;
