class AutoReply {
    constructor() {
        this.enabled = false;
        this.replies = new Map();
        
        // Add default common replies
        this.setupDefaultReplies();
    }

    setupDefaultReplies() {
        const defaultReplies = {
            'hi': 'Hello! 👋',
            'good morning': 'Good morning! 🌅 Have a great day!',
            'gm': 'Good morning! 🌅 Have a great day!',
            'good afternoon': 'Good afternoon! 🌞 Hope you\'re having a good day!',
            'good evening': 'Good evening! 🌆 Hope you had a great day!',
            'good night': 'Good night! 🌙 Sweet dreams!',
            'gn': 'Good night! 🌙 Sweet dreams!',
            'thank you': 'You\'re welcome! 😊',
            'thanks': 'You\'re welcome! 😊',
        };

        for (const [trigger, response] of Object.entries(defaultReplies)) {
            this.replies.set(trigger.toLowerCase(), response);
        }
        
        console.log('[AUTO-REPLY] Loaded', this.replies.size, 'default replies (Private chats only)');
    }

    enable() {
        this.enabled = true;
        console.log('[AUTO-REPLY] Auto-reply system enabled (Private chats only)');
    }

    disable() {
        this.enabled = false;
        console.log('[AUTO-REPLY] Auto-reply system disabled');
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
        if (!this.enabled || !message) {
            console.log('[AUTO-REPLY] Not enabled or no message:', { enabled: this.enabled, hasMessage: !!message });
            return null;
        }
        
        const normalizedMsg = message.toLowerCase().trim();
        console.log('[AUTO-REPLY] Checking message:', normalizedMsg);
        
        // Check for exact matches first
        if (this.replies.has(normalizedMsg)) {
            const response = this.replies.get(normalizedMsg);
            console.log('[AUTO-REPLY] Exact match found:', { trigger: normalizedMsg, response });
            return response;
        }
        
        // Check for partial matches with word boundaries to avoid false positives
        for (const [trigger, response] of this.replies) {
            // Use word boundary check for better matching
            const triggerWords = trigger.split(' ');
            const messageWords = normalizedMsg.split(' ');
            
            // For single word triggers, check if it's a complete word
            if (triggerWords.length === 1) {
                if (messageWords.includes(trigger)) {
                    console.log('[AUTO-REPLY] Word match found:', { trigger, response, message: normalizedMsg });
                    return response;
                }
            } else {
                // For multi-word triggers, check if all words are present
                const allWordsPresent = triggerWords.every(word => messageWords.includes(word));
                if (allWordsPresent) {
                    console.log('[AUTO-REPLY] Multi-word match found:', { trigger, response, message: normalizedMsg });
                    return response;
                }
            }
        }
        
        console.log('[AUTO-REPLY] No match found for:', normalizedMsg);
        return null;
    }

    clearReplies() {
        this.replies.clear();
        this.setupDefaultReplies(); // Restore defaults
        console.log('[AUTO-REPLY] All custom replies cleared, defaults restored');
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
