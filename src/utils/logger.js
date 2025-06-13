const chalk = require('chalk');

class Logger {
    constructor() {
        this.colors = {
            bot: chalk.cyan.bold,
            success: chalk.green.bold,
            error: chalk.red.bold,
            warning: chalk.yellow.bold,
            info: chalk.blue.bold,
            sticker: chalk.magenta.bold,
            message: chalk.white.bold,
            status: chalk.gray,
            control: chalk.blue.bold,
            auth: chalk.yellow.bold,
            ping: chalk.magenta.bold
        };

        this.emojis = {
            bot: '🤖',
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
            sticker: '🎨',
            message: '💬',
            status: '📡',
            control: '⚙️',
            auth: '🔐',
            ping: '🏓',
            start: '🚀',
            connect: '🔗',
            disconnect: '🔌',
            qr: '📱',
            shield: '🛡️',
            reply: '↩️'
        };
    }

    getTimestamp() {
        return new Date().toLocaleTimeString('en-US', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    formatMessage(category, emoji, message, data = null) {
        const timestamp = chalk.gray(`[${this.getTimestamp()}]`);
        const categoryTag = this.colors[category](`[${category.toUpperCase()}]`);
        const emojiIcon = this.emojis[emoji] || '•';
        
        let logMessage = `${timestamp} ${categoryTag} ${emojiIcon} ${message}`;
        
        if (data) {
            logMessage += '\n' + chalk.gray('    ↳ ') + chalk.dim(JSON.stringify(data, null, 2).replace(/\n/g, '\n      '));
        }
        
        return logMessage;
    }

    // Banner and startup
    showBanner() {
        try {
            console.clear();
        } catch (e) {
            // Ignore clear error in some environments
        }
        console.log(chalk.cyan.bold('\n╔══════════════════════════════════════════════════════════════╗'));
        console.log(chalk.cyan.bold('║') + chalk.white.bold('               🤖 CLOUDNEXTRA WHATSAPP BOT 🤖               ') + chalk.cyan.bold('║'));
        console.log(chalk.cyan.bold('║') + chalk.white('                      Advanced Automation                     ') + chalk.cyan.bold('║'));
        console.log(chalk.cyan.bold('╚══════════════════════════════════════════════════════════════╝'));
        console.log(chalk.gray('                        Version 1.0.0\n'));
    }

    showStartupInfo() {
        console.log(chalk.blue('📋 Features Enabled:'));
        console.log(chalk.gray('  ├─ ') + chalk.green('🎨 Sticker Creation'));
        console.log(chalk.gray('  ├─ ') + chalk.green('💬 Auto-Reply (Private chats)'));
        console.log(chalk.gray('  ├─ ') + chalk.green('👁️  Status Auto-View'));
        console.log(chalk.gray('  ├─ ') + chalk.green('🛡️  Anti-Call Protection'));
        console.log(chalk.gray('  └─ ') + chalk.green('⚙️  Control Panel\n'));
    }

    separator() {
        console.log(chalk.gray('─'.repeat(60)));
    }

    // Main logging methods
    bot(message, data = null) {
        console.log(this.formatMessage('bot', 'bot', message, data));
    }

    success(message, data = null) {
        console.log(this.formatMessage('success', 'success', message, data));
    }

    error(message, data = null) {
        console.log(this.formatMessage('error', 'error', message, data));
    }

    warning(message, data = null) {
        console.log(this.formatMessage('warning', 'warning', message, data));
    }

    info(message, data = null) {
        console.log(this.formatMessage('info', 'info', message, data));
    }

    sticker(message, data = null) {
        console.log(this.formatMessage('sticker', 'sticker', message, data));
    }

    message(message, data = null) {
        console.log(this.formatMessage('message', 'message', message, data));
    }

    status(message, data = null) {
        console.log(this.formatMessage('status', 'status', message, data));
    }

    control(message, data = null) {
        console.log(this.formatMessage('control', 'control', message, data));
    }

    auth(message, data = null) {
        console.log(this.formatMessage('auth', 'auth', message, data));
    }

    ping(message, data = null) {
        console.log(this.formatMessage('ping', 'ping', message, data));
    }

    // Specific actions
    starting(service) {
        console.log(this.formatMessage('bot', 'start', `Starting ${service}...`));
    }

    connected(service) {
        console.log(this.formatMessage('bot', 'connect', `${service} connected successfully`));
    }

    disconnected(service, reason = null) {
        console.log(this.formatMessage('bot', 'disconnect', `${service} disconnected`, reason ? { reason } : null));
    }

    qrGenerated() {
        console.log('\n' + chalk.cyan('═'.repeat(60)));
        console.log(this.formatMessage('auth', 'qr', 'QR Code Generated - Please scan to connect'));
        console.log(chalk.cyan('═'.repeat(60)) + '\n');
    }

    commandProcessed(command, sender) {
        console.log(this.formatMessage('control', 'control', `Command processed: ${command}`, { sender }));
    }

    autoReply(trigger, response, sender) {
        console.log(this.formatMessage('message', 'reply', `Auto-reply sent`, { 
            trigger, 
            response: response.substring(0, 50) + '...', 
            sender 
        }));
    }

    stickerCreated(sender, size) {
        console.log(this.formatMessage('sticker', 'sticker', `Sticker created successfully`, { 
            sender, 
            size: `${(size / 1024).toFixed(1)}KB` 
        }));
    }
}

module.exports = new Logger();
