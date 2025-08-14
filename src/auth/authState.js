const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// Get auth folder path based on environment
const AUTH_FOLDER = process.env.RENDER ? 
    '/data/auth_info' : // Render persistent disk path
    path.resolve(__dirname, '../../auth_info'); // Local development path

async function getAuthState() {
    try {
        // Create auth folder if it doesn't exist
        if (!fs.existsSync(AUTH_FOLDER)) {
            fs.mkdirSync(AUTH_FOLDER, { recursive: true });
            logger.auth('Created auth folder', { path: AUTH_FOLDER });
        }

        // Check for existing auth data
        const files = fs.readdirSync(AUTH_FOLDER);
        if (files.length > 0) {
            logger.auth('Found existing auth data', { 
                path: AUTH_FOLDER,
                files: files.length
            });
        }

        return await useMultiFileAuthState(AUTH_FOLDER);

    } catch (error) {
        logger.error('Error loading auth state', { error: error.message });
        // Clear auth state on any critical error
        logger.warning('Clearing corrupted auth state');
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
            logger.auth('Auth files cleared');
            return true;
        }
    } catch (error) {
        logger.error('Error clearing auth state', { error: error.message }); 
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
