const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// Get auth folder path based on environment
const AUTH_FOLDER = process.env.RENDER ? 
    '/data/auth_info' : // Render persistent disk path
    path.resolve(__dirname, '../../auth_info'); // Local development path

// Track connection attempts with existing credentials
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;

async function getAuthState() {
    try {
        // Create auth folder if it doesn't exist
        if (!fs.existsSync(AUTH_FOLDER)) {
            fs.mkdirSync(AUTH_FOLDER, { recursive: true });
            logger.auth('Created auth folder', { path: AUTH_FOLDER });
        }

        // Check for existing auth data
        const files = fs.readdirSync(AUTH_FOLDER);
        const hasExistingAuth = files.length > 0 && files.some(f => f.includes('creds.json'));
        
        if (hasExistingAuth) {
            connectionAttempts++;
            logger.auth(`Found existing credentials - attempt ${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS}`, { 
                path: AUTH_FOLDER,
                files: files.length
            });

            // If we've tried too many times with existing auth, clear it
            if (connectionAttempts > MAX_CONNECTION_ATTEMPTS) {
                logger.warning(`Failed to connect after ${MAX_CONNECTION_ATTEMPTS} attempts - clearing auth for fresh start`);
                await clearAuthState();
                logger.auth('Auth state cleared - will generate new QR code');
                // Return fresh auth state after clearing
                return await useMultiFileAuthState(AUTH_FOLDER);
            }
        } else {
            logger.auth('No existing credentials found - will generate QR code');
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
            connectionAttempts = 0; // Reset connection attempts counter
            return true;
        }
    } catch (error) {
        logger.error('Error clearing auth state', { error: error.message }); 
    }
    return false;
}

// Function to reset connection attempts (useful for successful connections)
function resetConnectionAttempts() {
    connectionAttempts = 0;
}

// Function to set connection attempts externally
function setConnectionAttempts(val) {
    connectionAttempts = val;
}

// Function to get current connection attempts count
function getConnectionAttempts() {
    return connectionAttempts;
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

module.exports = { getAuthState, clearAuthState, hasValidSession, resetConnectionAttempts, getConnectionAttempts, setConnectionAttempts };
