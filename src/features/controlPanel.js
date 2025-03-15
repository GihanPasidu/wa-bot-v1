const AutoReply = require('./autoReply');
const fs = require('fs');
const path = require('path');

class ControlPanel {
    constructor(sock) {
        this.sock = sock;
        this.autoReply = new AutoReply();
        this.config = {
            autoRead: false,
            antiCall: false,
            autoReply: false
        };

        // Log initial config state
        console.log('[CONTROL] Control panel initialized with config:', {
            autoRead: this.config.autoRead,
            antiCall: this.config.antiCall,
            autoReply: this.config.autoReply
        });

        // Pre-cache both menu and thumbnail
        this._cachedMenu = null;
        this._cachedConfig = null;
        this._loadCachedData();
    }

    _loadCachedData() {
        try {
            // Pre-generate menu text
            this._cachedMenu = this.generatePanelMenu();
            
            // Pre-generate message config
            const thumbnailPath = path.join(__dirname, '..', 'Cloud Nextra Solutions.png');
            const thumbnail = fs.readFileSync(thumbnailPath);
            
            this._cachedConfig = {
                contextInfo: {
                    externalAdReply: {
                        title: "CloudNextra Bot",
                        body: "WhatsApp Automation",
                        previewType: "PHOTO",
                        showAdAttribution: true,
                        renderLargerThumbnail: true,
                        mediaType: 1,
                        thumbnail
                    }
                }
            };
        } catch (err) {
            console.warn('[CONTROL] Failed to cache panel data:', err.message);
        }
    }

    updateSocket(sock) {
        this.sock = sock;
    }

    async handlePanelCommand(sender) {
        if (!this._cachedMenu) {
            this._cachedMenu = this.generatePanelMenu();
        }

        const messageConfig = {
            text: this._cachedMenu,
            ...(this._cachedConfig || {})
        };

        return this.sock.sendMessage(sender, messageConfig);
    }

    async handleControlCommand(msg, sender, sock) {
        this.sock = sock || this.sock;
        const command = msg.toLowerCase().split(' ')[0];
        const args = msg.slice(command.length).trim();

        // Fast path for panel command
        if (command === '.panel') {
            return this.handlePanelCommand(sender);
        }

        // Remove console log to reduce delay
        let response = '';

        // Use Map for faster command lookup
        const commandHandlers = new Map([
            ['.autoread', () => {
                this.config.autoRead = !this.config.autoRead;
                return `👁️ Auto view status has been ${this.config.autoRead ? 'enabled ✅\nBot will now automatically view status updates' : 'disabled ❌\nBot will ignore status updates'}`;
            }],
            ['.anticall', () => {
                this.config.antiCall = !this.config.antiCall;
                return `📵 Anti call has been ${this.config.antiCall ? 'enabled ✅\nBot will now reject all calls' : 'disabled ❌\nBot will allow calls'}`;
            }]
        ]);

        const handler = commandHandlers.get(command);
        if (handler) {
            response = handler();
        } else {
            switch(command) {
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
        }

        if (response) {
            // Send response immediately
            await this.sock.sendMessage(sender, { text: response }).catch(console.error);
        }
    }

    generatePanelMenu() {
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
            '│ • 💬 .autoreply - Toggle auto-reply',
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
