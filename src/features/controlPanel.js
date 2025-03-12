require('dotenv').config();

class ControlPanel {
    constructor(sock) {
        this.sock = sock;
        this.config = {
            autoRead: process.env.AUTO_READ_STATUS === 'true',
            antiLink: process.env.ANTI_LINK === 'true',
            antiCall: process.env.ANTI_CALL === 'true'
        };
    }

    async handleControlCommand(msg, sender) {
        const command = msg.toLowerCase();
        const response = [];

        if (command === '!panel') {
            response.push('🛠️ *Control Panel*');
            response.push('──────────────');
            response.push(`🔄 view status: ${this.config.autoRead ? '✅' : '❌'}`);
            response.push(`🔗 Anti Link: ${this.config.antiLink ? '✅' : '❌'}`);
            response.push(`📞 Anti Call: ${this.config.antiCall ? '✅' : '❌'}`);
            response.push('──────────────');
            response.push('Commands:');
            response.push('!autoread on/off');
            response.push('!antilink on/off');
            response.push('!anticall on/off');
        } else if (command.startsWith('!autoread ')) {
            const value = command.split(' ')[1];
            this.config.autoRead = value === 'on';
            response.push(`Auto Read has been turned ${value.toUpperCase()}`);
        } else if (command.startsWith('!antilink ')) {
            const value = command.split(' ')[1];
            this.config.antiLink = value === 'on';
            response.push(`Anti Link has been turned ${value.toUpperCase()}`);
        } else if (command.startsWith('!anticall ')) {
            const value = command.split(' ')[1];
            this.config.antiCall = value === 'on';
            response.push(`Anti Call has been turned ${value.toUpperCase()}`);
        }

        if (response.length > 0) {
            await this.sock.sendMessage(sender, { 
                text: response.join('\n')
            });
        }
    }

    isControlCommand(msg) {
        const commands = ['!panel', '!autoread', '!antilink', '!anticall'];
        return commands.some(cmd => msg.toLowerCase().startsWith(cmd));
    }

    getConfig() {
        return this.config;
    }
}

module.exports = ControlPanel;
