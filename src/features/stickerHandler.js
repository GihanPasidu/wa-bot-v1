const sharp = require('sharp');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

async function createSticker(msg) {
    try {
        // Download the image
        const buffer = await downloadMediaMessage(msg, 'buffer');
        
        // Convert to webp format with metadata
        const sticker = await sharp(buffer)
            .resize(512, 512, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .webp()
            .toBuffer();

        // Send the sticker
        return await msg.sock.sendMessage(msg.key.remoteJid, { 
            sticker: sticker 
        });
    } catch (error) {
        console.error('Error creating sticker:', error);
        await msg.sock.sendMessage(msg.key.remoteJid, { 
            text: 'Failed to create sticker! Try again.' 
        });
    }
}

module.exports = {
    createSticker
};
