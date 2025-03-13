class ControlPanel {
    constructor(sock) {
        this.sock = sock;
        this.config = {
            autoRead: process.env.AUTO_READ_STATUS === 'true',
            antiCall: process.env.ANTI_CALL === 'true'
        };
    }

    async handleControlCommand(msg, sender) {
        const command = msg.toLowerCase();
        const response = [];

        if (command === '.panel') {
            response.push('╭━━━ *CLOUDNEXTRA BOT* ━━━┄⃟ ');
            response.push('│');
            response.push('│ *System Status:*');
            response.push(`│ ⚡ Auto Read Status: ${this.config.autoRead ? '✅' : '❌'}`);
            response.push(`│ 📵 Anti Call: ${this.config.antiCall ? '✅' : '❌'}`);
            response.push('│');
            response.push('│ *Command List:*');
            response.push('│ ▢ .panel - Display this menu');
            response.push('│ ▢ .autoread - Toggle auto read');
            response.push('│ ▢ .anticall - Toggle anti call');
            response.push('│ ▢ .clear - Clear all sessions');
            response.push('│');
            response.push('│ *CloudNextra Bot v1.0*');
            response.push('╰━━━━━━━━━━━━━━━┄⃟ ');
        } else if (command === '.autoread') {
            this.config.autoRead = !this.config.autoRead;
            response.push('┌──『 Auto Read Status 』');
            response.push(`└─❒ ${this.config.autoRead ? '✅ Enabled' : '❌ Disabled'}`);
        } else if (command === '.anticall') {
            this.config.antiCall = !this.config.antiCall;
            response.push('┌──『 Anti Call Protection 』');
            response.push(`└─❒ ${this.config.antiCall ? '✅ Enabled' : '❌ Disabled'}`);
        }

        if (response.length > 0) {
            await this.sock.sendMessage(sender, { 
                text: response.join('\n'),
                contextInfo: {
                    externalAdReply: {
                        title: "CloudNextra WhatsApp Bot",
                        body: "Professional WhatsApp Automation",
                        mediaType: 1,
                        showAdAttribution: true,
                        renderLargerThumbnail: false
                    }
                }
            });
        }
    }

    isControlCommand(msg) {
        const commands = ['.panel', '.autoread', '.anticall'];
        return commands.some(cmd => msg.toLowerCase().startsWith(cmd));
    }

    getConfig() {
        return this.config;
    }
}

module.exports = ControlPanel;
