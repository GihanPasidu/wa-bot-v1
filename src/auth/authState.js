const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

// Use path.resolve to get absolute path from project root
const AUTH_FOLDER = path.resolve(__dirname, '../../auth_info');

async function getAuthState() {
    try {
        // Create auth folder if it doesn't exist
        if (!fs.existsSync(AUTH_FOLDER)) {
            fs.mkdirSync(AUTH_FOLDER, { recursive: true });
            console.log('[AUTH] Created auth folder:', AUTH_FOLDER);
        }

        // Check if existing auth data exists
        const files = fs.readdirSync(AUTH_FOLDER);
        if (files.length > 0) {
            console.log('[AUTH] Found existing auth data');
        }

        return await useMultiFileAuthState(AUTH_FOLDER);
    } catch (error) {
        console.error('[AUTH] Error loading auth state:', error);
        // Only clear on specific errors
        if (error.message.includes('crypto')) {
            await clearAuthState();
        }
        return await useMultiFileAuthState(AUTH_FOLDER);
    }
}

async function clearAuthState() {
    try {
        if (fs.existsSync(AUTH_FOLDER)) {
            const files = fs.readdirSync(AUTH_FOLDER);
            for (const file of files) {
                fs.unlinkSync(path.join(AUTH_FOLDER, file));
            }
            console.log('[AUTH] Auth files cleared');
            return true;
        }
    } catch (error) {
        console.error('[AUTH] Error clearing auth state:', error); 
    }
    return false;
}

// Add function to check auth state
function hasValidSession() {
    try {
        if (!fs.existsSync(AUTH_FOLDER)) {
            return false;
        }
        const files = fs.readdirSync(AUTH_FOLDER);
        return files.length > 0 && files.some(f => f.includes('creds.json'));
    } catch {
        return false;
    }
}

module.exports = { getAuthState, clearAuthState, hasValidSession };
