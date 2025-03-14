class AutoReply {
    constructor() {
        this.enabled = false;
        this.replies = new Map();
        
        // Add default common replies
        this.setupDefaultReplies();
    }

    setupDefaultReplies() {
        const defaultReplies = {
            'hi': 'Hello! 👋 How can I help you today?',
            'hello': 'Hi there! 👋 Need any assistance?',
            'good morning': 'Good morning! 🌅 Have a great day!',
            'good afternoon': 'Good afternoon! 🌞 Hope you\'re having a good day!',
            'good evening': 'Good evening! 🌆 Hope you had a great day!',
            'good night': 'Good night! 🌙 Sweet dreams!',
            'thank you': 'You\'re welcome! 😊',
            'thanks': 'You\'re welcome! 😊',
            'help': 'Need help? Use *.panel* to see available commands!',
            'menu': 'To see the full menu of commands, type *.panel*'
        };

        for (const [trigger, response] of Object.entries(defaultReplies)) {
            this.replies.set(trigger.toLowerCase(), response);
        }
    }

    enable() {
        this.enabled = true;
        console.log('[AUTO-REPLY] Enabled');
    }

    disable() {
        this.enabled = false;
        console.log('[AUTO-REPLY] Disabled');
    }

    addReply(trigger, response) {
        if (!trigger || !response) {
            console.log('[AUTO-REPLY] Invalid trigger or response');
            return false;
        }
        
        const normalizedTrigger = trigger.toLowerCase();
        this.replies.set(normalizedTrigger, response);
        console.log('[AUTO-REPLY] Added:', { trigger: normalizedTrigger, response });
        return true;
    }

    removeReply(trigger) {
        if (!trigger) return false;
        const normalizedTrigger = trigger.toLowerCase();
        const result = this.replies.delete(normalizedTrigger);
        if (result) {
            console.log('[AUTO-REPLY] Removed trigger:', normalizedTrigger);
        }
        return result;
    }

    getReply(message) {
        if (!this.enabled || !message) return null;
        
        const normalizedMsg = message.toLowerCase().trim();
        for (const [trigger, response] of this.replies) {
            if (normalizedMsg.includes(trigger)) {
                console.log('[AUTO-REPLY] Match found:', { trigger, response });
                return response;
            }
        }
        return null;
    }

    clearReplies() {
        this.replies.clear();
        console.log('[AUTO-REPLY] All replies cleared');
    }

    listReplies() {
        if (this.replies.size === 0) {
            return null;
        }
        return Array.from(this.replies.entries())
            .map(([trigger, response]) => {
                return `🔹 "${trigger}" ➜ "${response}"`;
            })
            .join('\n');
    }
}

module.exports = AutoReply;
