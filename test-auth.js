// Simple test script to check auth state behavior
const { getAuthState, clearAuthState, getConnectionAttempts } = require('./src/auth/authState');
const logger = require('./src/utils/logger');

async function testAuth() {
    logger.info('Testing auth state behavior...');
    
    // Clear auth first
    await clearAuthState();
    logger.info('Cleared auth state');
    
    // Test multiple getAuthState calls
    for (let i = 1; i <= 5; i++) {
        logger.info(`--- Test ${i} ---`);
        const { state } = await getAuthState();
        logger.info(`Connection attempts: ${getConnectionAttempts()}`);
        logger.info(`Has credentials: ${Object.keys(state.creds).length > 0}`);
        
        // Simulate a delay between calls
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

testAuth().catch(console.error);
