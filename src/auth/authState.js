const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const path = require('path');

async function getAuthState() {
    const authFolder = path.join(__dirname, '../../auth');
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    return { state, saveCreds };
}

module.exports = { getAuthState };
