class KeepAliveService {
    constructor(options = {}) {
        this.url = options.url || process.env.RENDER_EXTERNAL_URL || process.env.RENDER_URL;
        this.interval = options.interval || 10; // minutes
        this.endpoints = options.endpoints || ['/health', '/ping', '/wake'];
        this.userAgent = 'KeepAlive-Bot/1.0';
        this.timeout = options.timeout || 30000; // 30 seconds
        this.intervalId = null;
        
        this.stats = {
            totalPings: 0,
            successfulPings: 0,
            failedPings: 0,
            lastPingTime: null,
            lastSuccessTime: null
        };
    }

    async ping() {
        if (!this.url) {
            console.log('[KEEP-ALIVE] No URL configured, skipping ping');
            return false;
        }

        const endpoint = this.endpoints[Math.floor(Math.random() * this.endpoints.length)];
        const targetUrl = `${this.url}${endpoint}`;
        
        this.stats.totalPings++;
        this.stats.lastPingTime = new Date().toISOString();

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            const response = await fetch(targetUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/json'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                this.stats.successfulPings++;
                this.stats.lastSuccessTime = new Date().toISOString();
                console.log(`[KEEP-ALIVE] ✅ Ping successful: ${targetUrl} (${response.status})`);
                return true;
            } else {
                this.stats.failedPings++;
                console.log(`[KEEP-ALIVE] ❌ Ping failed: ${targetUrl} (${response.status})`);
                return false;
            }
        } catch (error) {
            this.stats.failedPings++;
            if (error.name === 'AbortError') {
                console.log(`[KEEP-ALIVE] ⏰ Ping timeout: ${targetUrl}`);
            } else {
                console.log(`[KEEP-ALIVE] ❌ Ping error: ${targetUrl} - ${error.message}`);
            }
            return false;
        }
    }

    start() {
        if (!this.url) {
            console.log('[KEEP-ALIVE] ⚠️  Keep-alive disabled: No URL configured');
            return false;
        }

        // Schedule pings every N minutes using setInterval
        const intervalMs = this.interval * 60 * 1000; // Convert minutes to milliseconds
        this.intervalId = setInterval(() => {
            this.ping();
        }, intervalMs);

        // Initial ping after 1 minute
        setTimeout(() => {
            this.ping();
        }, 60000);

        console.log(`[KEEP-ALIVE] 🚀 Started with interval: ${this.interval} minutes`);
        console.log(`[KEEP-ALIVE] 🎯 Target URL: ${this.url}`);
        console.log(`[KEEP-ALIVE] 📡 Endpoints: ${this.endpoints.join(', ')}`);
        
        return true;
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[KEEP-ALIVE] 🛑 Keep-alive service stopped');
        }
    }

    getStats() {
        return {
            ...this.stats,
            successRate: this.stats.totalPings > 0 
                ? Math.round((this.stats.successfulPings / this.stats.totalPings) * 100) 
                : 0,
            isActive: !!this.url,
            url: this.url,
            interval: this.interval
        };
    }

    // Method to get stats endpoint for Express
    getStatsEndpoint() {
        return (req, res) => {
            res.json(this.getStats());
        };
    }
}

module.exports = KeepAliveService;
