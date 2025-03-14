const AutoReply = require('./autoReply');

class ControlPanel {
    constructor(sock) {
        this.sock = sock;
        this.autoReply = new AutoReply();
        this.config = {
            autoRead: process.env.AUTO_READ_STATUS === 'true' || false,
            antiCall: process.env.ANTI_CALL === 'true' || false,
            autoReply: false
        };

        // Log initial config state
        console.log('[CONTROL] Control panel initialized with config:', {
            autoRead: this.config.autoRead,
            antiCall: this.config.antiCall,
            autoReply: this.config.autoReply
        });
    }

    updateSocket(sock) {
        this.sock = sock;
    }

    async handleControlCommand(msg, sender, sock) {
        this.sock = sock || this.sock;
        const command = msg.toLowerCase().split(' ')[0];
        const args = msg.slice(command.length).trim();
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
                response = `📵 Anti call has been ${this.config.antiCall ? 'enabled ✅\nBot will now reject all calls' : 'disabled ❌\nBot will allow calls'}`;
                break;
            case '.sticker':
                response = `🖼️ *Sticker Command*\n\n` +
                            `📝 To create a sticker:\n` +
                            `1️⃣ Send an image\n` +
                            `2️⃣ Add caption .s\n\n` +
                            `✨ The bot will convert your image to a sticker!`;
                break;
            case '.autoreply':
                this.config.autoReply = !this.config.autoReply;
                if (this.config.autoReply) {
                    this.autoReply.enable();
                    response = '✅ Auto-reply has been enabled';
                } else {
                    this.autoReply.disable();
                    response = '❌ Auto-reply has been disabled';
                }
                break;
            case '.addreply': {
                // Fix: Better parsing for trigger and response
                const parts = args.split('-'); 
                if (parts.length !== 2) {
                    response = '❌ Invalid format. Use: .addreply trigger - response';
                    break;
                }
                const trigger = parts[0].trim();
                const reply = parts[1].trim();
                
                if (!trigger || !reply) {
                    response = '❌ Both trigger and response are required';
                    break;
                }

                console.log('[AUTO-REPLY] Adding new reply:', { trigger, reply });
                this.autoReply.addReply(trigger, reply);
                response = `✅ Added auto-reply:\n🔹 "${trigger}" ➜ "${reply}"`;
                break;
            }
            case '.delreply':
                if (!args) {
                    response = '❌ Please specify the trigger to remove';
                    break;
                }
                response = this.autoReply.removeReply(args) 
                    ? `✅ Removed auto-reply for "${args}"`
                    : `❌ No auto-reply found for "${args}"`;
                break;
            case '.listreplies':
                const replies = this.autoReply.listReplies();
                response = replies ? `📝 Current auto-replies:\n${replies}` : '📝 No auto-replies configured';
                break;
            case '.clearreplies':
                this.autoReply.clearReplies();
                response = '🗑️ All auto-replies have been cleared';
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
            `│ ${this.getStatusEmoji('autoRead')} 👁️ Auto Status View`,
            `│ ${this.getStatusEmoji('antiCall')} 📵 Anti Call Protection`,
            `│ ${this.getStatusEmoji('autoReply')} 💬 Auto Reply`,
            '│',
            '│ ⌨️ *Quick Commands*',
            '│ • 📋 .panel  - Show this menu',
            '│ • 👁️ .autoread - Toggle status viewing',
            '│ • 📵 .anticall - Toggle call blocking',
            '│ • 💬 .autoreply - Toggle auto-reply system',
            '│ • 🖼️ .s     - Create sticker',
            '│ • ❔ .help   - Show detailed help',
            '│',
            '╰━━━━━━━━━━━━━━━┄⃟ '
        ].join('\n');

        return sections;
    }

    getHelpMenu() {
        const sections = [
            '*📚 COMMAND HELP*\n',
            '*📊 System Commands:*',
            '▫️ .panel - Show main control panel',
            '▫️ .help - Show this help menu',
            '',
            '*⚙️ Configuration:*', 
            '▫️ .autoread - Toggle status viewing',
            '▫️ .anticall - Toggle call blocking',
            '',
            '*🔄 Auto-Reply:*',
            '▫️ .autoreply - Toggle auto-reply system',
            '▫️ .addreply trigger - response',
            '▫️ .delreply trigger',
            '▫️ .listreplies - Show all replies',
            '▫️ .clearreplies - Remove all replies',
            '',
            '*📝 Default Auto-Replies:*',
            '▫️ Basic greetings (hi, hello)',
            '▫️ Time greetings (good morning/afternoon/evening/night)',
            '▫️ Thank you messages',
            '▫️ Help requests',
            '',
            '*🖼️ Stickers:*',
            '▫️ .s - Convert image to sticker',
            '▫️ .sticker - Show sticker help'
        ].join('\n');

        return sections;
    }

    getStatusEmoji(feature) {
        return this.config[feature] ? '✅' : '❌';
    }

    isControlCommand(msg) {
        const commands = [
            '.panel', '.help',
            '.autoread', '.anticall',
            '.sticker', '.s',
            '.autoreply', '.addreply', '.delreply',
            '.listreplies', '.clearreplies'
        ];
        return commands.some(cmd => msg.toLowerCase() === cmd);
    }

    getConfig() {
        return this.config;
    }
}

module.exports = ControlPanel;
