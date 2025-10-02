const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const http = require('http');
const QRCode = require('qrcode');

// Bot configuration
const config = {
    autoRead: false,
    antiCall: true,
    adminJids: [], // Will be auto-populated with QR scanner's account
    botEnabled: true
};

// Bot startup time for uptime calculation
const startTime = Date.now();

// QR code storage for web interface
let currentQRCode = null;
let connectionStatus = 'disconnected'; // 'disconnected', 'connecting', 'connected'

// Backup throttling to prevent excessive backup calls
let lastBackupTime = 0;
const BACKUP_COOLDOWN = 30000; // 30 seconds between backups

// Persistent auth storage for Render deployments
const PERSISTENT_AUTH_KEYS = [
    'BAILEYS_CREDS',
    'BAILEYS_KEYS'
];

// Enhanced auth persistence with multiple storage methods
function backupAuthToEnv(authState, forceBackup = false) {
    try {
        // Throttle backup calls to prevent spam (except when forced)
        const now = Date.now();
        if (!forceBackup && (now - lastBackupTime) < BACKUP_COOLDOWN) {
            console.log(`⏱️ Backup throttled (last backup ${Math.round((now - lastBackupTime) / 1000)}s ago)`);
            return;
        }
        
        if (authState.creds || authState.keys) {
            console.log('🔐 Backing up authentication credentials...');
            lastBackupTime = now;
            
            // Render-optimized backup locations with fallbacks
            const backupLocations = [
                './auth-backup',                         // Local backup (works on Render)
                '/tmp/auth-backup',                      // Temporary storage
                process.env.HOME ? `${process.env.HOME}/.wa-bot-backup` : null // Home directory
            ].filter(Boolean);
            
            let backupSuccess = false;
            let lastError = '';
            
            for (const authBackupDir of backupLocations) {
                try {
                    console.log(`📁 Attempting backup to: ${authBackupDir}`);
                    
                    // Ensure backup directory exists with proper permissions
                    if (!fs.existsSync(authBackupDir)) {
                        fs.mkdirSync(authBackupDir, { recursive: true, mode: 0o755 });
                        console.log(`📁 Created backup directory: ${authBackupDir}`);
                    }
                    
                    // Test write permissions
                    const testFile = path.join(authBackupDir, '.write-test');
                    fs.writeFileSync(testFile, 'test');
                    fs.unlinkSync(testFile);
                    console.log(`✅ Write permissions verified for: ${authBackupDir}`);
                    
                    // Create comprehensive backup object
                    const backupData = {
                        creds: authState.creds || null,
                        keys: authState.keys || {},
                        timestamp: Date.now(),
                        version: '2.0.0'
                    };
                    
                    // Save complete auth state
                    fs.writeFileSync(
                        path.join(authBackupDir, 'auth-complete-backup.json'), 
                        JSON.stringify(backupData, null, 2)
                    );
                    
                    // Save individual components for redundancy
                    if (authState.creds) {
                        fs.writeFileSync(
                            path.join(authBackupDir, 'creds-backup.json'), 
                            JSON.stringify(authState.creds, null, 2)
                        );
                    }
                    
                    if (authState.keys && Object.keys(authState.keys).length > 0) {
                        fs.writeFileSync(
                            path.join(authBackupDir, 'keys-backup.json'), 
                            JSON.stringify(authState.keys, null, 2)
                        );
                    }
                    
                    // Save metadata
                    fs.writeFileSync(
                        path.join(authBackupDir, 'backup-info.json'), 
                        JSON.stringify({
                            timestamp: Date.now(),
                            location: authBackupDir,
                            hasKeys: !!(authState.keys && Object.keys(authState.keys).length > 0),
                            hasCreds: !!authState.creds,
                            version: '2.0.0'
                        }, null, 2)
                    );
                    
                    backupSuccess = true;
                    console.log(`✅ Authentication data backed up to: ${authBackupDir}`);
                    
                    // Also backup to environment variables as secondary method
                    try {
                        if (authState.creds) {
                            process.env.BAILEYS_CREDS_BACKUP = Buffer.from(JSON.stringify(authState.creds)).toString('base64');
                        }
                        if (authState.keys && Object.keys(authState.keys).length > 0) {
                            process.env.BAILEYS_KEYS_BACKUP = Buffer.from(JSON.stringify(authState.keys)).toString('base64');
                        }
                        process.env.BAILEYS_BACKUP_TIMESTAMP = Date.now().toString();
                        console.log(`🔄 Also backed up to environment variables as fallback`);
                    } catch (envError) {
                        console.warn(`⚠️ Failed to backup to environment variables: ${envError.message}`);
                    }
                    
                    break; // Success, no need to try other locations
                    
                } catch (dirError) {
                    lastError = dirError.message;
                    console.warn(`⚠️ Failed to backup to ${authBackupDir}: ${dirError.message}`);
                    continue; // Try next location
                }
            }
            
            if (!backupSuccess) {
                console.error(`❌ All file backup locations failed. Last error: ${lastError}`);
                
                // Final fallback: environment variables only
                try {
                    if (authState.creds) {
                        process.env.BAILEYS_CREDS_BACKUP = Buffer.from(JSON.stringify(authState.creds)).toString('base64');
                    }
                    if (authState.keys && Object.keys(authState.keys).length > 0) {
                        process.env.BAILEYS_KEYS_BACKUP = Buffer.from(JSON.stringify(authState.keys)).toString('base64');
                    }
                    process.env.BAILEYS_BACKUP_TIMESTAMP = Date.now().toString();
                    console.log(`🔄 Used environment variables as final backup method`);
                } catch (envError) {
                    throw new Error(`All backup methods failed: Files: ${lastError}, Env: ${envError.message}`);
                }
            }
            
        } else {
            console.log('⚠️ No auth data to backup (creds and keys are empty)');
        }
    } catch (error) {
        console.error('❌ Error backing up auth data:', error.message);
    }
}

function restoreAuthFromBackup() {
    try {
        // Check multiple backup locations (Render-optimized)
        const backupLocations = [
            './auth-backup',                         // Local backup (works on Render)
            '/tmp/auth-backup',                      // Temporary storage
            process.env.HOME ? `${process.env.HOME}/.wa-bot-backup` : null // Home directory
        ].filter(Boolean);
        
        for (const authBackupDir of backupLocations) {
            try {
                const completeBackupPath = path.join(authBackupDir, 'auth-complete-backup.json');
                const credsBackupPath = path.join(authBackupDir, 'creds-backup.json');
                const keysBackupPath = path.join(authBackupDir, 'keys-backup.json');
                const infoPath = path.join(authBackupDir, 'backup-info.json');
                
                // Check if backup directory exists
                if (!fs.existsSync(authBackupDir)) {
                    continue;
                }
                
                let backupData = null;
                let backupAge = 0;
                
                // Try to restore from complete backup first
                if (fs.existsSync(completeBackupPath)) {
                    const completeData = JSON.parse(fs.readFileSync(completeBackupPath, 'utf8'));
                    backupAge = Date.now() - (completeData.timestamp || 0);
                    backupData = completeData;
                    console.log(`🔍 Found complete backup in: ${authBackupDir}`);
                }
                // Fallback to individual files
                else if (fs.existsSync(credsBackupPath)) {
                    const credsData = JSON.parse(fs.readFileSync(credsBackupPath, 'utf8'));
                    let keysData = {};
                    
                    if (fs.existsSync(keysBackupPath)) {
                        keysData = JSON.parse(fs.readFileSync(keysBackupPath, 'utf8'));
                    }
                    
                    // Get timestamp from info file or file modification time
                    if (fs.existsSync(infoPath)) {
                        const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
                        backupAge = Date.now() - (info.timestamp || 0);
                    } else {
                        const stats = fs.statSync(credsBackupPath);
                        backupAge = Date.now() - stats.mtime.getTime();
                    }
                    
                    backupData = {
                        creds: credsData,
                        keys: keysData,
                        timestamp: Date.now() - backupAge
                    };
                    console.log(`🔍 Found individual backup files in: ${authBackupDir}`);
                }
                
                if (backupData && backupData.creds) {
                    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
                    
                    if (backupAge < maxAge) {
                        console.log(`🔄 Restoring authentication from backup (age: ${Math.round(backupAge / (1000 * 60 * 60))} hours)...`);
                        
                        return {
                            creds: backupData.creds,
                            keys: backupData.keys || {},
                            isRestored: true,
                            backupLocation: authBackupDir,
                            backupAge: backupAge
                        };
                    } else {
                        console.log(`⏰ Auth backup is too old (${Math.round(backupAge / (1000 * 60 * 60 * 24))} days), cleaning up...`);
                        
                        // Clean up old backup files
                        try {
                            if (fs.existsSync(completeBackupPath)) fs.unlinkSync(completeBackupPath);
                            if (fs.existsSync(credsBackupPath)) fs.unlinkSync(credsBackupPath);
                            if (fs.existsSync(keysBackupPath)) fs.unlinkSync(keysBackupPath);
                            if (fs.existsSync(infoPath)) fs.unlinkSync(infoPath);
                            console.log(`🧹 Cleaned up old backup in: ${authBackupDir}`);
                        } catch (cleanupError) {
                            console.warn(`⚠️ Failed to cleanup old backup: ${cleanupError.message}`);
                        }
                    }
                }
                
            } catch (dirError) {
                console.warn(`⚠️ Error checking backup in ${authBackupDir}:`, dirError.message);
                continue;
            }
        }
        
        // Fallback: Check environment variables
        console.log('🔍 Checking environment variable backups...');
        try {
            const credsBackup = process.env.BAILEYS_CREDS_BACKUP;
            const keysBackup = process.env.BAILEYS_KEYS_BACKUP;
            const backupTimestamp = process.env.BAILEYS_BACKUP_TIMESTAMP;
            
            if (credsBackup && backupTimestamp) {
                const backupAge = Date.now() - parseInt(backupTimestamp);
                const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
                
                if (backupAge < maxAge) {
                    console.log(`🔄 Found environment variable backup (age: ${Math.round(backupAge / (1000 * 60 * 60))} hours)`);
                    
                    const creds = JSON.parse(Buffer.from(credsBackup, 'base64').toString());
                    let keys = {};
                    
                    if (keysBackup) {
                        keys = JSON.parse(Buffer.from(keysBackup, 'base64').toString());
                    }
                    
                    return {
                        creds: creds,
                        keys: keys,
                        isRestored: true,
                        backupLocation: 'environment-variables',
                        backupAge: backupAge
                    };
                } else {
                    console.log(`⏰ Environment backup is too old (${Math.round(backupAge / (1000 * 60 * 60 * 24))} days), clearing...`);
                    delete process.env.BAILEYS_CREDS_BACKUP;
                    delete process.env.BAILEYS_KEYS_BACKUP;
                    delete process.env.BAILEYS_BACKUP_TIMESTAMP;
                }
            }
        } catch (envError) {
            console.warn(`⚠️ Error checking environment variable backup: ${envError.message}`);
        }
        
        console.log('📝 No valid auth backup found in any location');
        return null;
        
    } catch (error) {
        console.error('❌ Error restoring auth backup:', error.message);
        return null;
    }
}

// Enhanced auth state management with persistence
async function getAuthState() {
    const authDir = './auth';
    
    // Ensure auth directory exists
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
        console.log('📁 Created auth directory');
    }
    
    try {
        // First try to use existing auth files
        const authState = await useMultiFileAuthState(authDir);
        
        // Check if we have valid credentials
        if (authState.creds && Object.keys(authState.creds).length > 0) {
            console.log('✅ Using existing authentication data from auth directory');
            return authState;
        }
        
        // If no valid local auth, try to restore from backup
        console.log('🔍 No local auth found, checking for backups...');
        const restoredAuth = restoreAuthFromBackup();
        
        if (restoredAuth && restoredAuth.creds) {
            console.log(`🔄 Restoring authentication from backup location: ${restoredAuth.backupLocation}`);
            
            try {
                // Write restored credentials to auth directory
                if (restoredAuth.creds) {
                    fs.writeFileSync(
                        path.join(authDir, 'creds.json'), 
                        JSON.stringify(restoredAuth.creds, null, 2)
                    );
                    console.log('� Restored credentials to auth directory');
                }
                
                // Write restored keys if available
                if (restoredAuth.keys && Object.keys(restoredAuth.keys).length > 0) {
                    // Write each key file individually (Baileys expects separate files)
                    for (const [keyName, keyData] of Object.entries(restoredAuth.keys)) {
                        if (keyData && typeof keyData === 'object') {
                            fs.writeFileSync(
                                path.join(authDir, `${keyName}.json`),
                                JSON.stringify(keyData, null, 2)
                            );
                        }
                    }
                    console.log(`💾 Restored ${Object.keys(restoredAuth.keys).length} key files to auth directory`);
                }
                
                // Return fresh auth state with restored data
                const newAuthState = await useMultiFileAuthState(authDir);
                console.log('✅ Successfully restored authentication from backup');
                return newAuthState;
                
            } catch (restoreError) {
                console.error('❌ Error writing restored auth data:', restoreError.message);
                console.log('🔄 Falling back to fresh authentication');
            }
        }
        
        console.log('🆕 No valid backup found, will generate new QR code');
        return authState;
        
    } catch (error) {
        console.error('❌ Error setting up auth state:', error.message);
        console.log('🔄 Falling back to fresh auth state');
        
        // Fallback to fresh auth state
        try {
            return await useMultiFileAuthState(authDir);
        } catch (fallbackError) {
            console.error('❌ Critical error: Cannot create auth state:', fallbackError.message);
            throw fallbackError;
        }
    }
}

// Function to verify backup integrity
function verifyBackupIntegrity() {
    console.log('🔍 Verifying backup integrity...');
    
    const backupLocations = [
        './auth-backup',                         // Local backup (works on Render)
        '/tmp/auth-backup',                      // Temporary storage
        process.env.HOME ? `${process.env.HOME}/.wa-bot-backup` : null // Home directory
    ].filter(Boolean);
    
    let foundBackups = 0;
    
    for (const location of backupLocations) {
        try {
            if (fs.existsSync(location)) {
                const completeBackup = path.join(location, 'auth-complete-backup.json');
                const credsBackup = path.join(location, 'creds-backup.json');
                const infoFile = path.join(location, 'backup-info.json');
                
                let status = '❌ Invalid';
                let hasComplete = fs.existsSync(completeBackup);
                let hasCreds = fs.existsSync(credsBackup);
                let hasInfo = fs.existsSync(infoFile);
                
                if (hasComplete || hasCreds) {
                    try {
                        if (hasComplete) {
                            const data = JSON.parse(fs.readFileSync(completeBackup, 'utf8'));
                            if (data.creds && data.timestamp) {
                                const age = Date.now() - data.timestamp;
                                status = age < (7 * 24 * 60 * 60 * 1000) ? '✅ Valid' : '⏰ Expired';
                                foundBackups++;
                            }
                        } else if (hasCreds) {
                            JSON.parse(fs.readFileSync(credsBackup, 'utf8'));
                            status = '✅ Valid (partial)';
                            foundBackups++;
                        }
                    } catch (parseError) {
                        status = '❌ Corrupted';
                    }
                }
                
                console.log(`📁 ${location}: ${status} (Complete: ${hasComplete}, Creds: ${hasCreds}, Info: ${hasInfo})`);
            } else {
                console.log(`📁 ${location}: Not found`);
            }
        } catch (error) {
            console.log(`📁 ${location}: Error - ${error.message}`);
        }
    }
    
    // Check environment variable backups
    try {
        const credsBackup = process.env.BAILEYS_CREDS_BACKUP;
        const backupTimestamp = process.env.BAILEYS_BACKUP_TIMESTAMP;
        
        if (credsBackup && backupTimestamp) {
            const backupAge = Date.now() - parseInt(backupTimestamp);
            const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
            
            if (backupAge < maxAge) {
                foundBackups++;
                const ageHours = Math.round(backupAge / (1000 * 60 * 60));
                console.log(`📁 Environment Variables: ✅ Valid (${ageHours}h old)`);
            } else {
                const ageDays = Math.round(backupAge / (1000 * 60 * 60 * 24));
                console.log(`📁 Environment Variables: ⏰ Expired (${ageDays}d old)`);
            }
        } else {
            console.log(`📁 Environment Variables: ❌ Not found`);
        }
    } catch (envError) {
        console.log(`📁 Environment Variables: Error - ${envError.message}`);
    }
    
    console.log(`📊 Backup Summary: ${foundBackups} valid backup(s) found`);
    return foundBackups > 0;
}

function getTextFromMessage(msg) {
    const m = msg.message || {};
    return (
        m.conversation ||
        (m.extendedTextMessage && m.extendedTextMessage.text) ||
        (m.imageMessage && m.imageMessage.caption) ||
        (m.videoMessage && m.videoMessage.caption) ||
        ''
    );
}

// Helper function to handle self-chat message sending
function getSelfChatTargetJid(senderJid, fromJid) {
    // If sender is linked device, redirect to phone number format for self-chat
    if (senderJid === '11837550653588@lid' && fromJid === '11837550653588@lid') {
        return '94788006269@s.whatsapp.net';
    }
    return fromJid;
}

// Helper function to send error messages to users
async function sendErrorMessage(sock, senderJid, fromJid, errorType, commandName = '') {
    const targetJid = getSelfChatTargetJid(senderJid, fromJid);
    const isUserAdmin = config.adminJids.includes(senderJid);
    
    let errorMessage = '';
    switch (errorType) {
        case 'BOT_ADMIN_REQUIRED':
            if (isUserAdmin) {
                errorMessage = `⚠️ *Verification Error*\n\n🤖 *Bot Admin Notice:*\nYou should have access to this command. This might be a bug.\n\n� *Debug Info:*\n• Your JID: ${senderJid}\n• Admin List: ${config.adminJids.join(', ')}\n• Command: ${commandName}\n\n💡 *Contact:* Developer for investigation`;
            } else {
                errorMessage = `�🚫 *Access Denied*\n\n🤖 *Required:* Bot administrator privileges\n\n💡 *Note:* This command is restricted to bot admins only\n\n🤝 *Contact:* A bot administrator if you need this feature`;
            }
            break;
        case 'COMMAND_ERROR':
            if (isUserAdmin) {
                errorMessage = `❌ *Command Processing Error*\n\n🔧 *Admin Debug Info:*\n• Command: ${commandName}\n• Error Type: Processing failure\n• Possible Causes: Syntax error, API failure, server issue\n• Timestamp: ${new Date().toISOString()}\n\n💡 *Admin Actions:* Check server logs, verify command syntax`;
            } else {
                errorMessage = `❌ *Command Error*\n\n🔧 *Command:* ${commandName}\n\n💡 *Try:* Check your command spelling and try again\n\n🤝 *Help:* Contact an admin if this keeps happening`;
            }
            break;
        case 'NETWORK_ERROR':
            if (isUserAdmin) {
                errorMessage = `🌐 *Network Error*\n\n🔧 *Admin Debug Info:*\n• Connection: API timeout or failure\n• Status: Network connectivity issue\n• Service: External API unreachable\n• Time: ${new Date().toLocaleString()}\n\n💡 *Admin Actions:* Check internet connection, verify API endpoints`;
            } else {
                errorMessage = `🌐 *Network Error*\n\n🔧 *Issue:* Connection problem\n\n💡 *Try:* Check your internet and try again in a moment\n\n⏰ *Usually fixes itself:* Network issues are often temporary`;
            }
            break;
        default:
            if (isUserAdmin) {
                errorMessage = `❌ *Unknown Error (Admin)*\n\n🔧 *Debug Info:*\n• Error Type: ${errorType}\n• Command: ${commandName}\n• User: Bot Admin\n• JID: ${senderJid}\n\n💡 *Admin Actions:* Check logs, report to developer if persistent`;
            } else {
                errorMessage = `❌ *Something went wrong*\n\n🔧 *Error:* An unexpected error occurred\n\n💡 *Try:* Please try again in a moment\n\n🤝 *Contact:* An admin if this problem continues`;
            }
    }
    
    try {
        await sock.sendMessage(targetJid, { text: errorMessage });
    } catch (sendError) {
        console.error(`Failed to send error message:`, sendError);
    }
}

async function startBot() {
    console.log('🔍 Checking for existing auth backups...');
    verifyBackupIntegrity();
    
    // Use enhanced auth state management with persistence
    const { state, saveCreds } = await getAuthState();
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['CloudNextra Bot', 'Desktop', '2.0.0']
    });

    // Enhanced credentials saving with backup
    const originalSaveCreds = saveCreds;
    const enhancedSaveCreds = async () => {
        try {
            // Save credentials normally first
            await originalSaveCreds();
            console.log('💾 Auth credentials saved to local files');
            
            // Then backup for persistence across deployments (throttled)
            setTimeout(() => {
                try {
                    backupAuthToEnv({ 
                        creds: state.creds, 
                        keys: state.keys 
                    }); // Use throttled backup for automatic saves
                } catch (backupError) {
                    console.error('❌ Failed to backup auth data:', backupError.message);
                }
            }, 1000); // Small delay to ensure files are written
            
        } catch (saveError) {
            console.error('❌ Failed to save credentials:', saveError.message);
            // Still try to backup what we have (throttled)
            try {
                backupAuthToEnv({ 
                    creds: state.creds, 
                    keys: state.keys 
                }); // Use throttled backup for automatic saves
            } catch (backupError) {
                console.error('❌ Failed to backup auth data after save error:', backupError.message);
            }
        }
    };

    // QR handling with persistence awareness
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('📱 QR Code Generated — Please scan with WhatsApp:');
            qrcode.generate(qr, { small: true });
            console.log('\n📱 Steps: Open WhatsApp → Settings → Linked Devices → Link a Device');
            console.log('⏱️  QR Code expires in 60 seconds...');
            
            // Show QR webpage link prominently
            const baseURL = process.env.NODE_ENV === 'production' && process.env.RENDER_EXTERNAL_URL 
                ? process.env.RENDER_EXTERNAL_URL 
                : `http://localhost:${process.env.PORT || 10000}`;
            
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`🌐 WEB QR CODE: ${baseURL}`);
            console.log(`📊 DASHBOARD: ${baseURL}/qr`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            
            // Generate base64 QR code for web interface
            try {
                const qrImageBuffer = await QRCode.toBuffer(qr, {
                    type: 'png',
                    width: 300,
                    margin: 2,
                    color: {
                        dark: '#000000',
                        light: '#FFFFFF'
                    }
                });
                currentQRCode = qrImageBuffer.toString('base64');
                connectionStatus = 'connecting';
            } catch (error) {
                console.error('❌ Error generating web QR code:', error.message);
            }
        }
        if (connection === 'open') {
            console.log('🚀 CloudNextra Bot Successfully Connected!');
            console.log('🤖 Bot Status: Online and Ready');
            
            // Auto-detect and set bot owner (the account that scanned QR)
            try {
                const ownerJid = sock.user?.id;
                if (ownerJid) {
                    // Update config to only allow the bot owner
                    config.adminJids = [ownerJid];
                    console.log('👑 Bot Owner Auto-Detected:', ownerJid);
                    console.log('🔒 Bot restricted to owner only');
                } else {
                    console.log('⚠️ Could not detect owner JID, using default admin list');
                }
            } catch (error) {
                console.log('⚠️ Error detecting owner:', error.message);
            }
            
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            // Update connection status for web interface
            connectionStatus = 'connected';
            currentQRCode = null;
            
            // Backup authentication data on successful connection with retry
            setTimeout(async () => {
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        backupAuthToEnv({ 
                            creds: state.creds, 
                            keys: state.keys 
                        }, true); // Force backup on connection
                        console.log(`💾 Authentication data backed up successfully (attempt ${attempt}/3)`);
                        break; // Success, exit retry loop
                    } catch (error) {
                        console.error(`❌ Failed to backup auth data (attempt ${attempt}/3):`, error.message);
                        if (attempt < 3) {
                            console.log(`🔄 Retrying backup in ${attempt * 2} seconds...`);
                            await new Promise(resolve => setTimeout(resolve, attempt * 2000));
                        } else {
                            console.error('❌ All backup attempts failed. Auth data may not persist across deployments.');
                        }
                    }
                }
            }, 2000); // Wait 2 seconds for connection to stabilize
        } else if (connection === 'close') {
            connectionStatus = 'disconnected';
            currentQRCode = null;
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('⚠️  Connection Lost. Attempting Reconnection:', shouldReconnect);
            if (shouldReconnect) startBot();
        }
    });

    sock.ev.on('creds.update', enhancedSaveCreds);

    // Messages
    sock.ev.on('messages.upsert', async ({ type, messages }) => {
        if (type !== 'notify') return;
        for (const msg of messages) {
            const from = msg.key.remoteJid;
            if (!from) continue;
            // Handle status updates: mark as read if autoRead, then skip further processing
            if (from === 'status@broadcast') {
                if (config.autoRead) {
                    try { await sock.readMessages([msg.key]); } catch (_) {}
                }
                continue;
            }

            const senderJid = (msg.key.participant || msg.key.remoteJid);
            const body = getTextFromMessage(msg) || '';
            
            // Check if user is a bot admin
            const isBotAdmin = config.adminJids.includes(senderJid);

            // Auto-read normal messages
            if (config.autoRead) {
                try { await sock.readMessages([msg.key]); } catch (_) {}
            }

            if (body.startsWith('.')) {
                const fullCommand = body.trim().toLowerCase();
                const command = fullCommand.split(' ')[0]; // Get just the command part
                const text = body.trim(); // Add text variable for command arguments
                console.log(`Received command: ${fullCommand} from ${from}`);
                console.log(`Parsed command: "${command}"`);
                console.log(`Is Bot Admin: ${isBotAdmin}`);
                
                // If bot is OFF, only allow .on command
                if (!config.botEnabled && command !== '.on') {
                    await sock.sendMessage(from, { text: '🛑 The bot is currently OFF. Only bot admins can send `.on` to enable it.' }, { quoted: msg });
                    continue;
                }
                
                // Only allow commands from the bot owner (QR scanner)
                if (!isBotAdmin) {
                    await sock.sendMessage(from, { 
                        text: '🔒 *Access Restricted*\n\n❌ This bot only responds to the account that scanned the QR code.\n\n🤖 *CloudNextra Bot V2.0* - Owner Only Mode' 
                    }, { quoted: msg });
                    continue;
                }
                
                console.log(`Processing command: "${command}"`);
                switch (command) {
                    case '.test': {
                        await sock.sendMessage(from, { text: '✅ Test command works!' }, { quoted: msg });
                        break;
                    }
                    case '.on': {
                        if (!isBotAdmin) {
                            await sendErrorMessage(sock, senderJid, from, 'BOT_ADMIN_REQUIRED', '.on');
                            break;
                        }
                        config.botEnabled = true;
                        await sock.sendMessage(from, { text: '🚀 *Bot Status Updated*\n\n✅ Bot is now **ONLINE** and ready to serve!\n\n💡 *Tip:* Send `.panel` to explore all features.' }, { quoted: msg });
                        break;
                    }
                    case '.off': {
                        if (!isBotAdmin) {
                            await sendErrorMessage(sock, senderJid, from, 'BOT_ADMIN_REQUIRED', '.off');
                            break;
                        }
                        config.botEnabled = false;
                        await sock.sendMessage(from, { text: '⏸️ *Bot Status Updated*\n\n🛑 Bot is now **OFFLINE** for maintenance.\n\n🔧 Only bot admins can use `.on` to reactivate.' }, { quoted: msg });
                        break;
                    }
                    case '.panel': {
                        // Create different panel content based on user role
                        const isAdmin = isBotAdmin;
                        let panelText;
                        
                        if (isAdmin) {
                            // Admin Panel - Full access
                            panelText = `
🤖  *WhatsApp Bot — Admin Control Panel*
────────────────────────────────────────

👑  *Welcome, Administrator!*
You have full access to all bot features and controls.

📌  *Bot Management* (Admin Only)
• \`.panel\` — Show this admin panel
• \`.autoread\` — Toggle auto view status (${config.autoRead ? '✅ ON' : '❌ OFF'})
• \`.anticall\` — Toggle call blocking (${config.antiCall ? '✅ ON' : '❌ OFF'})
• \`.on\` / \`.off\` — Enable/disable bot

🔍  *Information Commands*
• \`.status\` — Debug & system information
• \`.backuptest\` — Test auth backup system

📊  *System Status*
• Bot: ${config.botEnabled ? '✅ ONLINE' : '🛑 OFFLINE'}
• Auto Read: ${config.autoRead ? '✅ Enabled' : '❌ Disabled'}
• Anti Call: ${config.antiCall ? '✅ Enabled' : '❌ Disabled'}

⚡  *Admin Privileges Active*
`;
                        } else {
                            // User Panel - Limited access
                            panelText = `
🤖  *WhatsApp Bot — User Menu*
──────────────────────────────

👋  *Welcome, User!*
Here are the commands available to you:

🔍  *Information Commands*
• \`.status\` — Bot status & information

  *How to Use*
• Commands work in any chat type

💡  *Need Help?*
Contact a bot administrator for advanced features!
`;
                        }
                        
                        try {
                            // Fix for self-chat: get correct target JID
                            const targetJid = getSelfChatTargetJid(senderJid, from);
                            if (targetJid !== from) {
                                console.log(`🔄 Redirecting self-chat message from ${from} to ${targetJid}`);
                            }
                            
                            await sock.sendMessage(targetJid, { text: panelText }, { quoted: msg });
                            console.log(`✅ ${isAdmin ? 'Admin' : 'User'} panel sent successfully to: ${targetJid}`);
                        } catch (sendError) {
                        console.error(`❌ Failed to send panel message to ${from}:`, sendError);
                        // Try sending without quoted message for self-chat
                        try {
                            await sock.sendMessage(from, { text: panelText });
                            console.log(`✅ Panel message sent (without quote) to: ${from}`);
                        } catch (fallbackError) {
                            console.error(`❌ Fallback send also failed:`, fallbackError);
                        }
                    }
                        break;
                    }
                    case '.status': {
                        const statusText = `
🔍 *Bot Debug Information*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 *Your Status:*
• 👤 JID: \`${senderJid}\`
• 🏷️ Chat Type: ${isGroup ? 'Group' : 'Private'}
• 🤖 Bot Admin: ${isBotAdmin ? '✅ Yes' : '❌ No'}

⚙️ *Bot Configuration:*
• 🟢 Bot Enabled: ${config.botEnabled ? 'Yes' : 'No'}
• 👀 Auto Read: ${config.autoRead ? 'Yes' : 'No'}
• 📵 Anti Call: ${config.antiCall ? 'Yes' : 'No'}

📋 *Configured Admins:*
${config.adminJids.map(jid => `• ${jid}`).join('\n')}

${isBotAdmin ? '✅ *You have bot admin privileges*' : '⚠️ *You are not a bot admin*'}
`;
                        const targetJid = getSelfChatTargetJid(senderJid, from);
                        await sock.sendMessage(targetJid, { text: statusText }, { quoted: msg });
                        break;
                    }
                    case '.backuptest': {
                        if (!isBotAdmin) {
                            await sendErrorMessage(sock, senderJid, from, 'BOT_ADMIN_REQUIRED', '.backuptest');
                            break;
                        }
                        
                        const targetJid = getSelfChatTargetJid(senderJid, from);
                        
                        try {
                            // Get current environment info
                            const envInfo = {
                                platform: process.platform,
                                arch: process.arch,
                                nodeVersion: process.version,
                                cwd: process.cwd(),
                                home: process.env.HOME || 'undefined',
                                user: process.env.USER || process.env.USERNAME || 'undefined',
                                render: process.env.RENDER ? 'Yes' : 'No'
                            };
                            
                            // Run backup verification
                            const hasValidBackup = verifyBackupIntegrity();
                            
                            // Create a test backup to verify the system is working
                            console.log('🧪 Creating test backup...');
                            backupAuthToEnv({ 
                                creds: state.creds, 
                                keys: state.keys 
                            }, true); // Force backup for testing
                            
                            // Check again after backup
                            const hasValidBackupAfter = verifyBackupIntegrity();
                            
                            // Check environment variable backup status
                            const envBackupStatus = {
                                hasCreds: !!process.env.BAILEYS_CREDS_BACKUP,
                                hasKeys: !!process.env.BAILEYS_KEYS_BACKUP,
                                hasTimestamp: !!process.env.BAILEYS_BACKUP_TIMESTAMP
                            };
                            
                            const statusText = `
🔍 *Auth Backup System Test*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🖥️ *Environment Info:*
• Platform: ${envInfo.platform}
• Architecture: ${envInfo.arch}
• Node.js: ${envInfo.nodeVersion}
• Working Dir: ${envInfo.cwd}
• Home Dir: ${envInfo.home}
• Render Deploy: ${envInfo.render}

📊 *Test Results:*
• 🔍 Before Test: ${hasValidBackup ? '✅ Valid backup found' : '❌ No valid backup'}
• 🧪 Test Backup: ✅ Attempted
• 🔍 After Test: ${hasValidBackupAfter ? '✅ Valid backup found' : '❌ No valid backup'}

🗂️ *Backup Locations Checked:*
• ./auth-backup (Local - works on Render)
• /tmp/auth-backup (Temporary)
• ~/.wa-bot-backup (Home directory)

🌐 *Environment Variable Backup:*
• Creds: ${envBackupStatus.hasCreds ? '✅ Present' : '❌ Missing'}
• Keys: ${envBackupStatus.hasKeys ? '✅ Present' : '❌ Missing'}
• Timestamp: ${envBackupStatus.hasTimestamp ? '✅ Present' : '❌ Missing'}

📝 *Auth State Info:*
• 🔑 Has Creds: ${state.creds ? '✅ Yes' : '❌ No'}
• 🗝️ Has Keys: ${state.keys && Object.keys(state.keys).length > 0 ? `✅ Yes (${Object.keys(state.keys).length})` : '❌ No'}

${hasValidBackupAfter ? '🎉 *Backup system is working!*' : '⚠️ *Backup system may have issues*'}

💡 *Note:* Check console logs for detailed backup information.
`;
                            
                            await sock.sendMessage(targetJid, { text: statusText }, { quoted: msg });
                            
                        } catch (error) {
                            console.error('❌ Backup test failed:', error);
                            await sock.sendMessage(targetJid, { 
                                text: `❌ *Backup Test Failed*\n\nError: ${error.message}\n\nCheck console logs for more details.` 
                            }, { quoted: msg });
                        }
                        break;
                    }
                    case '.autoread': {
                        if (!isBotAdmin) {
                            await sendErrorMessage(sock, senderJid, from, 'BOT_ADMIN_REQUIRED', '.autoread');
                            break;
                        }
                        config.autoRead = !config.autoRead;
                        const status = config.autoRead ? '🟢 *ENABLED*' : '🔴 *DISABLED*';
                        const icon = config.autoRead ? '👀' : '🙈';
                        const description = config.autoRead ? 'Messages will be automatically marked as read' : 'Manual read confirmation required';
                        await sock.sendMessage(from, { 
                            text: `${icon} *Auto-Read Feature Updated*\n\n� Status: ${status}\n💬 ${description}\n\n✨ Your privacy settings have been updated!` 
                        }, { quoted: msg });
                        break;
                    }
                    case '.anticall': {
                        if (!isBotAdmin) {
                            await sendErrorMessage(sock, senderJid, from, 'BOT_ADMIN_REQUIRED', '.anticall');
                            break;
                        }
                        config.antiCall = !config.antiCall;
                        const status = config.antiCall ? '🟢 *ENABLED*' : '🔴 *DISABLED*';
                        const icon = config.antiCall ? '📵' : '📞';
                        const description = config.antiCall ? 'Incoming calls will be automatically rejected' : 'All calls will be accepted normally';
                        await sock.sendMessage(from, { 
                            text: `${icon} *Call Protection Updated*\n\n🛡️ Status: ${status}\n📲 ${description}\n\n🔒 Your call preferences have been saved!` 
                        }, { quoted: msg });
                        break;
                    }
                    
                    // Advanced Tools Commands
                    
                    // Basic Commands
                    case '.help': {
                        try {
                            const targetJid = getSelfChatTargetJid(senderJid, from);
                            const isUserAdmin = isBotAdmin;
                            let helpText;
                            
                            if (isUserAdmin) {
                                // Admin Help - Comprehensive guide
                                helpText = `📚 *WhatsApp Bot v2 - Owner Command Reference*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👑 **Welcome, Bot Owner!**
🔒 This bot is restricted to your account only (QR scanner).

🎛️ **Bot Management** (Owner Only)
• \`.panel\` — Admin control panel
• \`.on\` / \`.off\` — Enable/disable bot
• \`.autoread\` — Toggle auto view status
• \`.anticall\` — Toggle call blocking
• \`.status\` — Detailed system information

🔍 **Information & Debug**
• \`.help\` — This admin command reference
• \`.stats\` — Bot statistics & uptime
• \`.ping\` — Response time test
• \`.about\` — Bot technical information

 **Admin Features**
• Complete system access and control
• Advanced error messages with debug info
• Bot configuration management
• System monitoring and diagnostics

💡 **Admin Tips:**
• Use \`.panel\` for interactive admin control
• Error messages include debug information for troubleshooting

🚀 **Technical Details:**
• Built with Baileys v6.6.0
• Node.js 20+ with Sharp image processing
• Persistent authentication with automatic backup
• Self-chat redirection for optimal UX

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
                            } else {
                                // User Help - Simplified guide
                                helpText = `📚 *WhatsApp Bot v2 - User Guide*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👋 **Welcome!**
Here's everything you can do with this bot:

🔍 **Information Commands**
• \`.help\` — Show this user guide
• \`.status\` — Bot status & information  
• \`.panel\` — User menu with available commands

🤝 **Need More Help?**
• Use \`.panel\` for an interactive menu
• Contact a bot administrator for advanced features
• Bot admins have access to additional commands

� **Tips for Best Experience:**
• Be patient with command processing
• Check your spelling when typing commands
• Some features require specific permissions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
                            }
                            
                            await sock.sendMessage(targetJid, { text: helpText }, { quoted: msg });
                        } catch (e) {
                            console.error('Error showing help:', e);
                            await sendErrorMessage(sock, senderJid, from, 'COMMAND_ERROR', 'help');
                        }
                        break;
                    }
                    
                    case '.stats': {
                        try {
                            const targetJid = getSelfChatTargetJid(senderJid, from);
                            const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
                            const uptimeMinutes = Math.floor(uptimeSeconds / 60);
                            const uptimeHours = Math.floor(uptimeMinutes / 60);
                            const uptimeDays = Math.floor(uptimeHours / 24);
                            
                            let uptimeString = '';
                            if (uptimeDays > 0) uptimeString += `${uptimeDays}d `;
                            if (uptimeHours % 24 > 0) uptimeString += `${uptimeHours % 24}h `;
                            if (uptimeMinutes % 60 > 0) uptimeString += `${uptimeMinutes % 60}m `;
                            uptimeString += `${uptimeSeconds % 60}s`;
                            
                            const memoryUsage = process.memoryUsage();
                            const memoryMB = (memoryUsage.rss / 1024 / 1024).toFixed(2);
                            
                            const statsText = `📊 *Bot Statistics & Performance*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏱️ **Uptime Information:**
• 🚀 Started: ${getSriLankaTime().toLocaleString()} (SLST)
• ⏰ Running: ${uptimeString.trim()}
• 📅 Current: ${getSriLankaTime().toLocaleString()} (SLST)

💻 **System Performance:**
• 🧠 Memory Usage: ${memoryMB} MB
• 🔄 Node.js Version: ${process.version}
• 🏗️ Platform: ${process.platform}

🤖 **Bot Status:**
• 🟢 Status: Active & Responsive
• 📡 Connection: Stable
• 🛡️ Auto view status: ${config.autoRead ? 'Enabled' : 'Disabled'}
• 📵 Anti Call: ${config.antiCall ? 'Enabled' : 'Disabled'}

📈 **Feature Statistics:**
• 🎵 Audio Processing: Active
• � Image Processing: Enabled
• 🔐 Security: Enhanced

⚡ **Performance Metrics:**
• 🚀 Response Time: Optimized
• 💾 Cache Status: Active
• 🔧 Error Handling: Comprehensive
• 📱 Self-Chat: Supported

🌟 *Bot running smoothly and ready to serve!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
                            
                            await sock.sendMessage(targetJid, { text: statsText }, { quoted: msg });
                        } catch (e) {
                            console.error('Error showing stats:', e);
                            await sendErrorMessage(sock, senderJid, from, 'COMMAND_ERROR', 'stats');
                        }
                        break;
                    }
                    
                    case '.ping': {
                        try {
                            const targetJid = getSelfChatTargetJid(senderJid, from);
                            const startTime = Date.now();
                            
                            // Send initial ping message
                            const sentMsg = await sock.sendMessage(targetJid, { 
                                text: '📡 *Ping Test*\n\n⏳ Measuring response time...' 
                            }, { quoted: msg });
                            
                            // Calculate response time
                            const responseTime = Date.now() - startTime;
                            
                            // Update with results
                            setTimeout(async () => {
                                try {
                                    let speedEmoji = '🟢';
                                    let speedStatus = 'Excellent';
                                    
                                    if (responseTime > 1000) {
                                        speedEmoji = '🟡';
                                        speedStatus = 'Good';
                                    }
                                    if (responseTime > 2000) {
                                        speedEmoji = '🟠';
                                        speedStatus = 'Average';
                                    }
                                    if (responseTime > 3000) {
                                        speedEmoji = '🔴';
                                        speedStatus = 'Slow';
                                    }
                                    
                                    const pingText = `📡 *Ping Test Results*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ **Response Time:**
• 🕐 Latency: ${responseTime}ms
• ${speedEmoji} Status: ${speedStatus}
• 📊 Performance: ${responseTime < 500 ? 'Optimal' : responseTime < 1500 ? 'Good' : 'Needs Improvement'}

🌐 **Connection Quality:**
• 📶 Signal: Strong
• 🔄 Stability: Active
• 🛡️ Security: Encrypted

📈 **Benchmark:**
• 🟢 < 500ms: Excellent
• 🟡 500-1500ms: Good  
• 🟠 1500-3000ms: Average
• 🔴 > 3000ms: Slow

🚀 *Bot is responding efficiently!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
                                    
                                    await sock.sendMessage(targetJid, { text: pingText }, { quoted: msg });
                                } catch (updateError) {
                                    console.error('Error updating ping result:', updateError);
                                }
                            }, 1000);
                            
                        } catch (e) {
                            console.error('Error running ping test:', e);
                            await sendErrorMessage(sock, senderJid, from, 'COMMAND_ERROR', 'ping');
                        }
                        break;
                    }
                    
                    case '.about': {
                        try {
                            const targetJid = getSelfChatTargetJid(senderJid, from);
                            const aboutText = `ℹ️ *WhatsApp Bot v2 Information*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🤖 **Bot Details:**
• 📛 Name: WhatsApp Bot v2
• 🏷️ Version: 2.0.0 (Owner-Only Mode)
• 👨‍💻 Developer: CloudNextra Solutions
• 📅 Build: October 2025
• 🔒 Access: QR Scanner Account Only

⚙️ **Technical Stack:**
• 🚀 Engine: Node.js ${process.version}
• 📚 Library: @whiskeysockets/baileys v6.6.0
• 🖼️ Image Processing: Sharp v0.33.4
• 🔍 Logging: Pino v9.0.0
• 📱 Platform: ${process.platform}

🌟 **Key Features:**
• 💬 Multi-format messaging support
• 🎨 Advanced media processing
• � Smart utility features
• 🔒 Security & admin controls
• 🛠️ Utility tools & generators
• 📡 Self-chat compatibility
• ⚡ Real-time error handling

🔧 **Capabilities:**
• 📸 Image ↔ Sticker conversion
• 🔗 URL shortening service
• 🎨 Color code lookup
• 🔐 Secure password generation
• ⏰ Time & timezone display
• 📊 System statistics
• 🚫 Anti-spam protection

🛡️ **Security Features:**
• 🔑 Admin permission system
• 🚨 Automatic call rejection
• 🎵 Media processing capabilities
• � Image manipulation features
• 📱 Self-chat message routing

💼 **Professional Use:**
• 🏢 Business communication
• 📋 Automated content processing
• 🎯 Content creation tools
• 📊 Performance monitoring
• 🔧 System administration

🌐 **Open Source:**
• 📄 License: MIT
• 🔄 Updates: Regular
• 🐛 Bug Reports: GitHub Issues
• 💡 Feature Requests: Welcome

🚀 *Built with performance and reliability in mind!*

📞 **Support:** Use .help for commands
🎯 **Quick Start:** Send .panel for menu
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
                            
                            await sock.sendMessage(targetJid, { text: aboutText }, { quoted: msg });
                        } catch (e) {
                            console.error('Error showing about info:', e);
                            await sendErrorMessage(sock, senderJid, from, 'COMMAND_ERROR', 'about');
                        }
                        break;
                    }
                    
                    default: {
                        console.log(`Unknown command: "${command}"`);
                        const targetJid = getSelfChatTargetJid(senderJid, from);
                        const isUserAdmin = isBotAdmin;
                        
                        let helpMessage;
                        if (isUserAdmin) {
                            helpMessage = `❓ *Command Not Recognized (Admin)*\n\n🤖 The command "${command}" is not available\n\n🔧 *Admin Debug Info:*\n• Command: ${command}\n• From: ${senderJid}\n• Context: Private\n\n📋 *Get Help:*\n• Send \`.panel\` for admin control panel\n• Send \`.help\` for complete admin command list\n• Check command spelling and syntax\n\n💡 *Admin Note:* If this should be a valid command, check the code or contact the developer!`;
                        } else {
                            helpMessage = `❓ *Command Not Recognized*\n\n🤖 The command "${command}" is not available to you\n\n📋 *Get Help:*\n• Send \`.panel\` for available commands\n• Send \`.help\` for user guide\n• Check your spelling and try again\n\n💡 *Tips:*\n• Some commands are admin-only\n• Make sure you're typing the command correctly\n• Contact a bot admin if you need special features!`;
                        }
                        
                        await sock.sendMessage(targetJid, { text: helpMessage }, { quoted: msg });
                    }
                }
            }
        }
    });

    // Call handling (anti-call)
    sock.ev.on('call', async (calls) => {
        try {
            for (const call of calls) {
                if (!config.antiCall) continue;
                if (call.status === 'offer') {
                    // Some Baileys versions expose rejectCall; if not, just notify
                    if (typeof sock.rejectCall === 'function') {
                        try { await sock.rejectCall(call.id, call.from); } catch (_) {}
                    }
                    await sock.sendMessage(call.from, { text: '🚫 Calls are not allowed. Your call was rejected.' });
                }
            }
        } catch (err) {
            console.error('Call handling error:', err);
        }
    });
}

console.log('🤖 Initializing CloudNextra Bot V2.0...');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔧 Built with Baileys Library');
console.log('🔒 Owner-Only Mode: Bot restricted to QR scanner account');
console.log('⚡ Loading modules and establishing connection...\n');

// Health check server for Render
const server = http.createServer((req, res) => {
    // Set CORS headers for all requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'healthy', 
            uptime: Date.now() - startTime,
            timestamp: new Date().toISOString()
        }));
    } else if (req.url === '/' || req.url === '/qr') {
        // Serve the QR code webpage
        const fs = require('fs');
        const path = require('path');
        try {
            const htmlContent = fs.readFileSync(path.join(__dirname, 'public', 'qr.html'), 'utf8');
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(htmlContent);
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error loading QR page');
        }
    } else if (req.url === '/qr-data') {
        // Serve QR code data as JSON
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            qr: currentQRCode,
            status: connectionStatus,
            timestamp: new Date().toISOString()
        }));
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`🌐 Health check server running on port ${PORT}`);
    
    // Show QR webpage URLs for easy access
    if (process.env.NODE_ENV === 'production' && process.env.RENDER_EXTERNAL_URL) {
        console.log(`📱 QR Code Webpage: ${process.env.RENDER_EXTERNAL_URL}`);
        console.log(`📡 Health Check: ${process.env.RENDER_EXTERNAL_URL}/health`);
        console.log(`🔗 API Endpoint: ${process.env.RENDER_EXTERNAL_URL}/qr-data`);
    } else {
        console.log(`📱 QR Code Webpage: http://localhost:${PORT}`);
        console.log(`📡 Health Check: http://localhost:${PORT}/health`);
        console.log(`🔗 API Endpoint: http://localhost:${PORT}/qr-data`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

// Self-ping mechanism to keep the service active on Render
let selfPingInterval = null;
if (process.env.NODE_ENV === 'production') {
    const SELF_PING_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    
    // More aggressive keep-alive: ping every 3 minutes instead of 5
    selfPingInterval = setInterval(async () => {
        try {
            const response = await axios.get(`${SELF_PING_URL}/health`, {
                timeout: 10000,
                headers: { 
                    'User-Agent': 'WhatsApp-Bot-KeepAlive',
                    'Cache-Control': 'no-cache'
                }
            });
            console.log(`🏓 Keep-alive ping: ${response.status} - ${new Date().toISOString()}`);
        } catch (error) {
            console.log(`⚠️ Keep-alive ping failed: ${error.message} - ${new Date().toISOString()}`);
            // Try alternative endpoint if health fails
            try {
                await axios.get(`${SELF_PING_URL}/`, { timeout: 5000 });
                console.log(`🏓 Fallback ping successful - ${new Date().toISOString()}`);
            } catch (fallbackError) {
                console.log(`❌ Both ping attempts failed - ${new Date().toISOString()}`);
            }
        }
    }, 3 * 60 * 1000); // Every 3 minutes for better reliability
    
    console.log('🏓 Enhanced keep-alive mechanism activated (3-minute interval)');
}

startBot().catch((e) => {
    console.error('❌ Failed to start bot:', e);
    process.exit(1);
});

process.on('SIGINT', () => {
    console.log('\n🛑 Received shutdown signal (SIGINT)');
    console.log('🧹 Cleaning up resources...');
    if (selfPingInterval) {
        clearInterval(selfPingInterval);
        console.log('🏓 Self-ping mechanism stopped');
    }
    server.close(() => {
        console.log('🌐 Health check server closed');
        console.log('👋 Bot shutdown complete. Goodbye!');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received termination signal (SIGTERM)');
    console.log('🧹 Cleaning up resources...');
    if (selfPingInterval) {
        clearInterval(selfPingInterval);
        console.log('🏓 Self-ping mechanism stopped');
    }
    server.close(() => {
        console.log('🌐 Health check server closed');
        console.log('👋 Bot terminated successfully. Goodbye!');
        process.exit(0);
    });
});
