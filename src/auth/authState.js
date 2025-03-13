const fs = require('fs');
const makeWASocket = require('@whiskeysockets/baileys');

const { useMultiFileAuthState } = makeWASocket;
const AUTH_FOLDER = './auth_info';

async function getAuthState() {
    if (!fs.existsSync(AUTH_FOLDER)) {
        fs.mkdirSync(AUTH_FOLDER);
    }
    return await useMultiFileAuthState(AUTH_FOLDER);
}

async function clearAuthState() {
    if (fs.existsSync(AUTH_FOLDER)) {
        fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
        fs.mkdirSync(AUTH_FOLDER);
        return true;
    }
    return false;
}

module.exports = { getAuthState, clearAuthState };
