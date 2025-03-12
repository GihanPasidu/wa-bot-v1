const { default: makeWASocket, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const { getAuthState } = require('./auth/authState');
const MessageHandler = require('./features/messageHandler');

class WhatsAppBot {
    constructor() {
        this.sock = null;
        this.isConnected = false;
        this.saveCreds = null;
        this.messageHandler = null;
    }

    async connect() {
        const { state, saveCreds } = await getAuthState();
        this.saveCreds = saveCreds;
        
        this.sock = makeWASocket({
            printQRInTerminal: true,
            auth: state,
            defaultQueryTimeoutMs: undefined
        });

        this.messageHandler = new MessageHandler(this.sock);
        
        this.sock.ev.on('connection.update', this.handleConnectionUpdate.bind(this));
        this.sock.ev.on('messages.upsert', m => this.messageHandler.handleMessage(m));
        this.sock.ev.on('call', this.handleCall.bind(this));
        this.sock.ev.on('creds.update', this.saveCreds);
    }

    async handleConnectionUpdate(update) {
        const { connection, lastDisconnect } = update;
        
        if(connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if(shouldReconnect) {
                this.connect();
            }
        }
    }

    async handleCall(call) {
        const config = this.messageHandler.controlPanel.getConfig();
        // Auto reject calls if enabled
        if (config.antiCall && call.status === "offer") {
            await this.sock.rejectCall(call.id, call.from);
        }
    }
}

module.exports = WhatsAppBot;
