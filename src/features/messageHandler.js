const ControlPanel = require('./controlPanel');
const { createSticker } = require('./stickerHandler');

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
            console.error('[MSG] Error handling message:', error);
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
        this.processedMessages.add(messageId); // Fixed missing parenthesis

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
                console.log('[STATUS] Auto-viewing status update:', {
                    from: msg.key.participant || msg.key.remoteJid,
                    type: Object.keys(msg.message)[0]
                });

                // Use readMessages for marking as read
                await currentSock.readMessages([msg.key]);
                
                // For statuses, no need to send separate read receipt
                // The readMessages call above is sufficient
                
                return;
            } catch (err) {
                console.error('[STATUS] Failed to read status:', err);
                return;
            }
        }

        // Skip further processing for status messages
        if (isStatus) return;
        
        // Check if message is valid and has content
        if (!msg.message && !msg.messageStubType) {
            return; // Ignore empty or invalid messages
        }

        const messageContent = msg.message?.conversation || 
                             msg.message?.extendedTextMessage?.text ||
                             msg.message?.imageMessage?.caption || '';

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
}

module.exports = MessageHandler;
