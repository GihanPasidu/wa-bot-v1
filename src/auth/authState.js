const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

const AUTH_FOLDER = './auth_info';

async function getAuthState() {
    try {
        if (!fs.existsSync(AUTH_FOLDER)) {
            fs.mkdirSync(AUTH_FOLDER, { recursive: true });
        }
        return await useMultiFileAuthState(AUTH_FOLDER);
    } catch (error) {
        console.error('[AUTH] Error loading auth state:', error);
        // On auth load error, clear and create fresh
        await clearAuthState();
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
            console.log('[AUTH] Auth state cleared successfully');
            return true;
        }
    } catch (error) {
        console.error('[AUTH] Error clearing auth state:', error);
    }
    return false;
}

module.exports = { getAuthState, clearAuthState };
