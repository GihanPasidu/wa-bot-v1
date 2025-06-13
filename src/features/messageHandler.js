const ControlPanel = require('./controlPanel');
const { createSticker } = require('./stickerHandler');
const logger = require('../utils/logger');

class MessageHandler {
    constructor(sock) {
        this.sock = sock;
        this.controlPanel = new ControlPanel(sock);
        this.stickerHandler = require('./stickerHandler');
        
        // Add tracking maps
        this.processedMessages = new Set();
        this.replyCooldowns = new Map();
        this.replyHistory = new Map();
        this.cooldownTime = 10000; // Reduced from 30000ms to 10000ms
        this.maxHistoryAge = 120000; // Reduced from 300000ms to 120000ms
        
        // Add message queue for better handling
        this.messageQueue = [];
        this.isProcessing = false;
    }

    updateSocket(sock) {
        this.sock = sock;
        this.controlPanel.updateSocket(sock);
    }

    async handleMessage({ messages, sock }) {
        try {
            // Early exit conditions
            if (!messages?.[0] || (!sock && !this.sock)) return;

            const msg = messages[0];
            
            // Skip processing system messages
            if (msg.messageStubType) return;

            // Add to queue instead of processing immediately
            this.messageQueue.push({ msg, sock });
            
            // Process queue if not already processing
            if (!this.isProcessing) {
                await this.processMessageQueue();
            }

        } catch (error) {
            logger.error('Error handling message', { error: error.message });
        }
    }

    async processMessageQueue() {
        if (this.isProcessing || this.messageQueue.length === 0) return;

        this.isProcessing = true;
        
        while (this.messageQueue.length > 0) {
            const { msg, sock } = this.messageQueue.shift();
            await this.processMessage(msg, sock);
        }

        this.isProcessing = false;
    }

    async processMessage(msg, sock) {
        const currentSock = sock || this.sock;
        const messageId = msg.key.id;
        const sender = msg.key.remoteJid;

        // Skip if already processed
        if (this.processedMessages.has(messageId)) return;
        this.processedMessages.add(messageId);

        const currentTime = Date.now();

        // Clean up old tracking data
        this.cleanupTracking(currentTime);

        // Limit Set size to prevent memory growth
        if (this.processedMessages.size > 100) {
            this.processedMessages.clear();
        }
        
        // Enhanced status detection
        const isStatus = msg.key?.remoteJid === 'status@broadcast';
        const isStatusUpdate = isStatus && (
            msg.message?.imageMessage ||
            msg.message?.videoMessage ||
            msg.message?.extendedTextMessage
        );
        
        // Handle status messages if auto-read is enabled
        if (isStatusUpdate && this.controlPanel.getConfig().autoRead) {
            try {
                logger.status('Auto-viewing status update', {
                    from: msg.key.participant || msg.key.remoteJid,
                    type: Object.keys(msg.message)[0]
                });

                await currentSock.readMessages([msg.key]);
                return;
            } catch (err) {
                logger.error('Failed to read status', { error: err.message });
                return;
            }
        }

        // Skip further processing for status messages
        if (isStatus) return;
        
        // Check if message is valid and has content
        if (!msg.message && !msg.messageStubType) {
            return;
        }

        const messageContent = msg.message?.conversation || 
                             msg.message?.extendedTextMessage?.text ||
                             msg.message?.imageMessage?.caption || '';

        // Check if this is a group or private chat
        const isGroupChat = sender.endsWith('@g.us');
        const isPrivateChat = sender.endsWith('@s.whatsapp.net');

        logger.message('New message received', {
            from: sender.split('@')[0],
            type: isGroupChat ? 'Group' : 'Private',
            content: messageContent ? messageContent.substring(0, 50) + '...' : 'No text'
        });

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
            await this.controlPanel.handleControlCommand(messageContent, sender, currentSock);
            return;
        }

        // Check for sticker command
        if (msg.message?.imageMessage && 
            (messageContent.toLowerCase() === '.sticker' || 
             messageContent.toLowerCase().startsWith('.s'))) {
            console.log('[COMMAND] Processing sticker command');
            await createSticker(msg, currentSock);
            return;
        }

        // Check cooldown for sender
        const lastReplyTime = this.replyCooldowns.get(sender);
        if (lastReplyTime && (currentTime - lastReplyTime) < this.cooldownTime) {
            console.log('[AUTO-REPLY] Cooldown active for:', sender);
            return;
        }

        // Check for auto-reply after command handling
        if (messageContent && !this.controlPanel.isControlCommand(messageContent)) {
            if (this.controlPanel.config.autoReply) {
                const autoReply = this.controlPanel.autoReply.getReply(messageContent);
                if (autoReply) {
                    // Check reply history to prevent loops
                    const recentReplies = this.replyHistory.get(sender) || [];
                    if (recentReplies.includes(autoReply)) {
                        console.log('[AUTO-REPLY] Preventing duplicate reply:', {
                            sender,
                            reply: autoReply
                        });
                        return;
                    }

                    // Update tracking
                    this.replyCooldowns.set(sender, currentTime);
                    recentReplies.push(autoReply);
                    this.replyHistory.set(sender, recentReplies);

                    console.log('[AUTO-REPLY] Sending response:', {
                        sender,
                        reply: autoReply
                    });

                    await currentSock.sendMessage(sender, {
                        text: autoReply
                    });
                    return;
                }
            }
        }
    }

    cleanupTracking(currentTime) {
        // Clear old cooldowns
        for (const [sender, timestamp] of this.replyCooldowns.entries()) {
            if (currentTime - timestamp > this.cooldownTime) {
                this.replyCooldowns.delete(sender);
            }
        }

        // Clear old reply history
        for (const [sender, replies] of this.replyHistory.entries()) {
            if (currentTime - replies[0]?.timestamp > this.maxHistoryAge) {
                this.replyHistory.delete(sender);
            }
        }
    }

    // Add safe message sending with retry logic
    async safeSendMessage(sock, jid, message, retries = 2) {
        for (let i = 0; i <= retries; i++) {
            try {
                await sock.sendMessage(jid, message);
                return true;
            } catch (error) {
                logger.error(`Send attempt ${i + 1} failed`, { error: error.message });
                
                if (i === retries) {
                    logger.error('Max retries reached, message send failed');
                    return false;
                }
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
        return false;
    }
}

module.exports = MessageHandler;
