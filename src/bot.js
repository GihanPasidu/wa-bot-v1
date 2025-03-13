const { default: makeWASocket, DisconnectReason } = require('@whiskeysockets/baileys');
const { getAuthState } = require('./auth/authState');
const MessageHandler = require('./features/messageHandler');
const qrcode = require('qrcode-terminal');

class WhatsAppBot {
    constructor() {
        this.sock = null;
        this.messageHandler = null;
    }

    async connect() {
        const { state, saveCreds } = await getAuthState();

        this.sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
        });

        this.messageHandler = new MessageHandler(this.sock);

        this.sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                    this.connect();
                }
            }
        });

        this.sock.ev.on('messages.upsert', async (m) => {
            await this.messageHandler.handleMessage(m);
        });

        // Add call handling
        this.sock.ev.on('call', async (calls) => {
            for (const call of calls) {
                if (this.messageHandler.controlPanel.getConfig().antiCall) {
                    if (call.status === "offer") {
                        await this.sock.rejectCall(call.id, call.from);
                        await this.sock.sendMessage(call.from, { 
                            text: '❌ Sorry, calls are not allowed.' 
                        });
                    }
                }
            }
        });

        this.sock.ev.on('creds.update', saveCreds);
    }
}

module.exports = WhatsAppBot;
