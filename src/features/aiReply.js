const logger = require('../utils/logger');
const config = require('../../config');

class AIReply {
    constructor(sock) {
        this.sock = sock;
        this.enabled = process.env.AI_REPLY_ENABLED === 'true' || config.ai.enabled || true; // Default to enabled
        this.metaAiNumber = process.env.META_AI_NUMBER || config.ai.metaAiNumber;
        this.timeout = config.ai.timeout || 30000;
        this.cooldown = config.ai.cooldown || 60000;
        this.maxLength = config.ai.maxLength || 500;
        
        // Track AI conversations
        this.pendingRequests = new Map(); // user -> { timestamp, messageId }
        this.aiCooldowns = new Map(); // user -> timestamp
        this.aiResponses = new Map(); // messageId -> { originalSender, timestamp }
        
        console.log('[AI-REPLY] Initialized with ChatGPT number:', this.metaAiNumber);
        console.log('[AI-REPLY] Status:', this.enabled ? 'Enabled' : 'Disabled');
    }

    updateSocket(sock) {
        this.sock = sock;
    }

    enable() {
        this.enabled = true;
        console.log('[AI-REPLY] AI Reply system enabled');
        return true;
    }

    disable() {
        this.enabled = false;
        console.log('[AI-REPLY] AI Reply system disabled');
        return true;
    }

    isEnabled() {
        return this.enabled;
    }

    // Check if user is on cooldown
    isOnCooldown(sender) {
        const lastRequest = this.aiCooldowns.get(sender);
        if (!lastRequest) return false;
        
        const timeSinceLastRequest = Date.now() - lastRequest;
        return timeSinceLastRequest < this.cooldown;
    }

    // Get remaining cooldown time
    getCooldownTime(sender) {
        const lastRequest = this.aiCooldowns.get(sender);
        if (!lastRequest) return 0;
        
        const timeSinceLastRequest = Date.now() - lastRequest;
        const remainingTime = this.cooldown - timeSinceLastRequest;
        return remainingTime > 0 ? Math.ceil(remainingTime / 1000) : 0;
    }

    // Check if message should be sent to AI
    shouldSendToAI(message, sender, controlPanelEnabled = true) {
        console.log('[AI-REPLY] Checking shouldSendToAI:', {
            enabled: this.enabled,
            controlPanel: controlPanelEnabled,
            sender: sender,
            messageLength: message ? message.length : 0
        });

        if (!this.enabled || !controlPanelEnabled) {
            console.log('[AI-REPLY] AI replies disabled', { enabled: this.enabled, controlPanel: controlPanelEnabled });
            return false;
        }

        if (!message || message.trim().length === 0) {
            console.log('[AI-REPLY] Empty message, skipping AI');
            return false;
        }

        if (message.length > this.maxLength) {
            console.log('[AI-REPLY] Message too long for AI processing');
            return false;
        }

        // Skip if it's a command
        if (message.startsWith('.')) {
            console.log('[AI-REPLY] Command detected, skipping AI');
            return false;
        }

        // Check cooldown
        if (this.isOnCooldown(sender)) {
            console.log('[AI-REPLY] User on cooldown:', sender);
            return false;
        }

        // Only process private chats - check for various private chat formats
        const isPrivateChat = sender.endsWith('@s.whatsapp.net') || 
                             sender.endsWith('@lid') || 
                             (!sender.endsWith('@g.us') && !sender.includes('status@broadcast'));
        
        if (!isPrivateChat) {
            console.log('[AI-REPLY] Only private chats supported for AI replies, sender:', sender);
            return false;
        }

        console.log('[AI-REPLY] Message approved for AI processing');
        return true;
    }

    // Forward message to ChatGPT
    async forwardToAI(message, originalSender) {
        try {
            if (!this.sock) {
                throw new Error('Socket not available');
            }

            console.log('[AI-REPLY] Forwarding to ChatGPT:', {
                message: message.substring(0, 50) + '...',
                sender: originalSender,
                chatgpt: this.metaAiNumber
            });

            // Clean up any existing request from this sender first
            if (this.pendingRequests.has(originalSender)) {
                console.log('[AI-REPLY] Cleaning up previous request from:', originalSender);
                this.pendingRequests.delete(originalSender);
            }

            // Send message to ChatGPT
            const aiMessage = await this.sock.sendMessage(this.metaAiNumber, {
                text: message
            });

            // Track this request
            const timestamp = Date.now();
            this.pendingRequests.set(originalSender, {
                timestamp,
                messageId: aiMessage.key.id,
                originalMessage: message
            });

            console.log('[AI-REPLY] Request tracked for:', originalSender);
            console.log('[AI-REPLY] Total pending requests:', this.pendingRequests.size);
            console.log('[AI-REPLY] Pending requests map:', Array.from(this.pendingRequests.keys()));

            // Set cooldown
            this.aiCooldowns.set(originalSender, timestamp);

            // Set timeout to clean up if no response
            setTimeout(() => {
                if (this.pendingRequests.has(originalSender)) {
                    console.log('[AI-REPLY] AI response timeout for:', originalSender);
                    this.pendingRequests.delete(originalSender);
                }
            }, this.timeout);

            return true;
        } catch (error) {
            console.error('[AI-REPLY] Error forwarding to AI:', error.message);
            return false;
        }
    }

    // Handle potential ChatGPT response
    async handleAIResponse(message, sender) {
        try {
            // Check if this is from ChatGPT
            if (sender !== this.metaAiNumber) {
                return false;
            }

            console.log('[AI-REPLY] Received response from ChatGPT');

            // Get message content first
            const messageContent = message.message?.conversation || 
                                 message.message?.extendedTextMessage?.text || '';

            if (!messageContent) {
                console.log('[AI-REPLY] No text content in ChatGPT response');
                return false;
            }

            // Skip ChatGPT's automatic messages and repetitive responses
            const automaticPhrases = [
                'Your message has been sent to AI',
                '🤖 *ChatGPT Response:*',
                '🤖 Your message has been sent to AI',
                'Ready when you are!',
                'Just tell me what',
                'We\'re stuck on',
                'Looks like you repeated',
                'Still not clear on',
                'no worries! just',
                'drop any python task',
                'what do you want?'
            ];
            
            const isAutomaticMessage = automaticPhrases.some(phrase => 
                messageContent.toLowerCase().includes(phrase.toLowerCase())
            );
            
            if (isAutomaticMessage) {
                console.log('[AI-REPLY] Skipping ChatGPT automatic message');
                return false;
            }

            console.log('[AI-REPLY] ChatGPT response content:', messageContent.substring(0, 100) + '...');
            console.log('[AI-REPLY] Current pending requests:', Array.from(this.pendingRequests.keys()));

            // Find the original user who made the request
            let originalSender = null;
            let requestData = null;

            // Get the oldest valid request (FIFO - first in, first out)
            for (const [user, data] of this.pendingRequests.entries()) {
                if (Date.now() - data.timestamp < this.timeout) {
                    if (!originalSender || data.timestamp < requestData.timestamp) {
                        originalSender = user;
                        requestData = data;
                    }
                }
            }

            if (!originalSender) {
                console.log('[AI-REPLY] No pending request found for ChatGPT response');
                // If no pending request, this is likely a stray ChatGPT message, ignore it
                return false;
            }

            console.log('[AI-REPLY] Forwarding ChatGPT response to:', originalSender);

            // Forward ChatGPT response to original sender
            await this.sock.sendMessage(originalSender, {
                text: `🤖 *ChatGPT Response:*\n\n${messageContent}`
            });

            // Clean up this specific request
            this.pendingRequests.delete(originalSender);
            console.log('[AI-REPLY] Cleaned up request for:', originalSender);

            logger.info('ChatGPT response forwarded', {
                to: originalSender,
                responseLength: messageContent.length
            });

            return true;
        } catch (error) {
            console.error('[AI-REPLY] Error handling ChatGPT response:', error.message);
            return false;
        }
    }

    // Clean up old requests and cooldowns
    cleanup() {
        const now = Date.now();
        
        // Clean up old pending requests
        for (const [sender, data] of this.pendingRequests.entries()) {
            if (now - data.timestamp > this.timeout) {
                this.pendingRequests.delete(sender);
            }
        }

        // Clean up old cooldowns
        for (const [sender, timestamp] of this.aiCooldowns.entries()) {
            if (now - timestamp > this.cooldown) {
                this.aiCooldowns.delete(sender);
            }
        }
    }

    // Get status info
    getStatus() {
        return {
            enabled: this.enabled,
            metaAiNumber: this.metaAiNumber,
            pendingRequests: this.pendingRequests.size,
            cooldowns: this.aiCooldowns.size,
            timeout: this.timeout,
            cooldown: this.cooldown,
            maxLength: this.maxLength
        };
    }
}

module.exports = AIReply;