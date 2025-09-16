/**
 * Bot Settings Configuration
 */
module.exports = {
    // Bot settings
    name: 'CloudNextra Bot',
    version: '1.0.0',
    
    // Connection settings
    reconnectAttempts: 5,
    reconnectDelay: 5000,
    reconnectDelayOnAuthReset: 3000,
    reconnectDelayOnStreamError: 10000,
    keepAliveInterval: 600000,
    
    // Commands
    commands: {
        prefix: '.'
    },
    
    // Features
    autoRead: {
        enabled: false
    }
};

// Settings management for the WhatsApp bot
const fs = require('fs');
const path = require('path');

class Settings {
    constructor() {
        this.settingsPath = path.join(__dirname, 'settings.json');
        this.defaultSettings = {
            autoRead: false,
            alwaysOffline: false,
            commandPrefix: '.',
            language: 'en',
            timezone: 'UTC'
        };
        this.settings = this.loadSettings();
    }

    loadSettings() {
        try {
            if (fs.existsSync(this.settingsPath)) {
                const data = fs.readFileSync(this.settingsPath, 'utf8');
                return { ...this.defaultSettings, ...JSON.parse(data) };
            }
        } catch (error) {
            console.error('[SETTINGS] Error loading settings:', error);
        }
        return { ...this.defaultSettings };
    }

    saveSettings() {
        try {
            fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2));
            return true;
        } catch (error) {
            console.error('[SETTINGS] Error saving settings:', error);
            return false;
        }
    }

    get(key) {
        return this.settings[key];
    }

    set(key, value) {
        this.settings[key] = value;
        return this.saveSettings();
    }

    toggle(key) {
        if (typeof this.settings[key] === 'boolean') {
            this.settings[key] = !this.settings[key];
            this.saveSettings();
            return this.settings[key];
        }
        return false;
    }

    reset() {
        this.settings = { ...this.defaultSettings };
        return this.saveSettings();
    }
}

module.exports = new Settings();
