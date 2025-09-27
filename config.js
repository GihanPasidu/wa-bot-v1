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
    }
};
