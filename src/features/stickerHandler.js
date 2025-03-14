const sharp = require('sharp');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

async function createSticker(msg, sock) {
    try {
        // Send processing message
        await sock.sendMessage(msg.key.remoteJid, { 
            text: '⏳ Creating sticker...' 
        });

        console.log('[STICKER] Downloading media...');
        const buffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            { 
                reuploadRequest: sock.updateMediaMessage 
            }
        );
        
        console.log('[STICKER] Processing image...');
        const metadata = await sharp(buffer).metadata();
        
        const maxSize = 512;
        let width = metadata.width;
        let height = metadata.height;
        
        // Calculate dimensions while maintaining aspect ratio
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

        // Process image
        const sticker = await sharp(buffer)
            .resize(width, height, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .toFormat('webp', {
                quality: 80,
                lossless: false,
                effort: 6,
                force: true
            })
            .toBuffer();

        console.log('[STICKER] Sending sticker...');
        await sock.sendMessage(msg.key.remoteJid, { 
            sticker: sticker 
        });
        
        console.log('[STICKER] Sticker sent successfully');
    } catch (error) {
        console.error('[STICKER] Error:', error);
        await sock.sendMessage(msg.key.remoteJid, { 
            text: '❌ Failed to create sticker! Please make sure the image is valid and try again.' 
        });
    }
}

module.exports = {
    createSticker
};
