// Node.js polyfills for Docker/Render compatibility
if (typeof global.crypto === 'undefined') {
    global.crypto = require('crypto');
}

// Additional polyfills if needed
if (typeof global.Buffer === 'undefined') {
    global.Buffer = require('buffer').Buffer;
}

// WebCrypto polyfill for Node.js environments
if (typeof global.crypto.subtle === 'undefined') {
    const { webcrypto } = require('crypto');
    global.crypto.subtle = webcrypto.subtle;
}

console.log('[POLYFILL] Crypto modules initialized');
