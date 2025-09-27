/**
 * Bot Configuration
 */
module.exports = {
    // Connection settings
    reconnectAttempts: 5,
    reconnectDelay: 5000,
    reconnectDelayOnAuthReset: 3000,
    reconnectDelayOnStreamError: 10000,
    
    // Commands
    commands: {
        prefix: '.'
    },
    
    // AI Reply settings
    ai: {
        enabled: true, // AI reply enabled by default
        metaAiNumber: '18002428478@s.whatsapp.net', // Official ChatGPT WhatsApp number
        timeout: 30000, // 30 seconds timeout for AI responses
        cooldown: 60000, // 1 minute cooldown between AI requests per user
        maxLength: 500 // Maximum message length to send to AI
    }
};
