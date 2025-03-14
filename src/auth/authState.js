const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

// Get auth folder path based on environment
const AUTH_FOLDER = process.env.RENDER ? 
    '/data/auth_info' : // Render persistent disk path
    path.resolve(__dirname, '../../auth_info'); // Local development path

async function getAuthState() {
    try {
        // Create auth folder if it doesn't exist
        if (!fs.existsSync(AUTH_FOLDER)) {
            fs.mkdirSync(AUTH_FOLDER, { recursive: true });
            console.log('[AUTH] Created auth folder:', AUTH_FOLDER);
        }

        // Check for existing auth data
        const files = fs.readdirSync(AUTH_FOLDER);
        if (files.length > 0) {
            console.log('[AUTH] Found existing auth data in:', AUTH_FOLDER);
        }

        return await useMultiFileAuthState(AUTH_FOLDER);

    } catch (error) {
        console.error('[AUTH] Error loading auth state:', error);
        if (!process.env.RENDER) {
            // Only clear on local dev
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
