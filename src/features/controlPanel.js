class ControlPanel {
    constructor(sock) {
        this.sock = sock;
        this.config = {
            autoRead: process.env.AUTO_READ_STATUS === 'true' || false,
            antiCall: process.env.ANTI_CALL === 'true' || false
        };

        // Log initial config state
        console.log('[CONTROL] Control panel initialized with config:', {
            autoRead: this.config.autoRead,
            antiCall: this.config.antiCall
        });
    }

    updateSocket(sock) {
        this.sock = sock;
    }

    async handleControlCommand(msg, sender, sock) {
        this.sock = sock || this.sock;
        const command = msg.toLowerCase();
        console.log('[CONTROL] Received command:', command);

        let response = '';

        switch(command) {
            case '.panel':
                response = this.getPanelMenu();
                break;
            case '.autoread':
                this.config.autoRead = !this.config.autoRead;
                response = `👁️ Auto view status has been ${this.config.autoRead ? 'enabled ✅\nBot will now automatically view status updates' : 'disabled ❌\nBot will ignore status updates'}`;
                break;
            case '.anticall':
                this.config.antiCall = !this.config.antiCall;
                response = `📵 Anti call has been ${this.config.antiCall ? 'enabled ✅' : 'disabled ❌'}`;
                break;
            case '.sticker':
                response = `🖼️ *Sticker Command*\n\n` +
                         `📝 To create a sticker:\n` +
                         `1️⃣ Send an image\n` +
                         `2️⃣ Add caption .sticker\n\n` +
                         `✨ The bot will convert your image to a sticker!`;
                break;
            default:
                return;
        }

        if (response) {
            await this.sock.sendMessage(sender, {
                text: response,
                contextInfo: {
                    externalAdReply: {
                        title: "CloudNextra Bot",
                        body: "WhatsApp Automation",
                        mediaType: 1,
                        thumbnail: null,
                        showAdAttribution: true
                    }
                }
            });
        }
    }

    getPanelMenu() {
        const sections = [
            '╭━━━ *🤖 CLOUDNEXTRA BOT* ━━━┄⃟ ',
            '│',
            '│ 📊 *System Status*',
            `│ ${this.config.autoRead ? '✅' : '❌'} 👁️ Auto Status View`,
            `│ ${this.config.antiCall ? '✅' : '❌'} 📵 Anti Call Protection`,
            '│',
            '│ ⌨️ *Commands List*',
            '│ • 📋 .panel     - Show this menu',
            '│ • 👀 .autoread  - Toggle status view',
            '│ • 📞 .anticall  - Toggle call block',
            '│ • 🖼️ .sticker   - Create sticker',
            '│',
            '│ 🔮 Version: 1.0.0',
            '╰━━━━━━━━━━━━━━━┄⃟ '
        ];

        return sections.join('\n');
    }

    isControlCommand(msg) {
        const commands = ['.panel', '.autoread', '.anticall', '.sticker'];
        return commands.some(cmd => msg.toLowerCase() === cmd);
    }

    getConfig() {
        return this.config;
    }
}

module.exports = ControlPanel;
