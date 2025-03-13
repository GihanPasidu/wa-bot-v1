const sharp = require('sharp');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

async function createSticker(msg) {
    try {
        console.log('[STICKER] Downloading media...');
        const buffer = await downloadMediaMessage(msg, 'buffer');
        
        console.log('[STICKER] Processing image...');
        const metadata = await sharp(buffer).metadata();
        
        // Calculate dimensions to maintain aspect ratio
        const maxSize = 512;
        let width = metadata.width;
        let height = metadata.height;
        
        if (width > height) {
            if (width > maxSize) {
                height = Math.round((height * maxSize) / width);
                width = maxSize;
            }
        } else {
            if (height > maxSize) {
                width = Math.round((width * maxSize) / height);
                height = maxSize;
            }
        }

        const sticker = await sharp(buffer)
            .resize(width, height, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .webp({ 
                quality: 80,
                lossless: false,
                effort: 6
            })
            .toBuffer();

        console.log('[STICKER] Sending sticker...');
        await msg.sock.sendMessage(msg.key.remoteJid, { 
            sticker: sticker 
        });
        
        console.log('[STICKER] Sticker sent successfully');
    } catch (error) {
        console.error('[STICKER] Error:', error.message);
        await msg.sock.sendMessage(msg.key.remoteJid, { 
            text: '❌ Failed to create sticker! The image may be invalid or too large.' 
        });
    }
}

module.exports = {
    createSticker
};
