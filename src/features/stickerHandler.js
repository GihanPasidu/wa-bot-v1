const sharp = require('sharp');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

async function createSticker(msg, sock) {
    const sender = msg.key.remoteJid;
    
    try {
        console.log('[STICKER] Starting sticker creation process...');
        console.log('[STICKER] Message structure:', {
            hasImageMessage: !!msg.message?.imageMessage,
            messageKeys: msg.message ? Object.keys(msg.message) : [],
            keyId: msg.key.id,
            fromMe: msg.key.fromMe
        });
        
        // Check if message has image
        if (!msg.message?.imageMessage) {
            console.log('[STICKER] No image found in message');
            await safeSendMessage(sock, sender, { 
                text: '❌ No image found! Please send an image with `.s` or reply to an image with `.s`' 
            });
            return;
        }

        // Send processing message
        await safeSendMessage(sock, sender, { 
            text: '⏳ Processing image for sticker...' 
        });

        console.log('[STICKER] Downloading media...');
        console.log('[STICKER] Image message details:', {
            url: msg.message.imageMessage.url ? 'present' : 'missing',
            directPath: msg.message.imageMessage.directPath ? 'present' : 'missing',
            mediaKey: msg.message.imageMessage.mediaKey ? 'present' : 'missing',
            fileLength: msg.message.imageMessage.fileLength,
            mimetype: msg.message.imageMessage.mimetype
        });
        
        // Download the image with better error handling
        let buffer;
        try {
            buffer = await downloadMediaMessage(
                msg,
                'buffer',
                {},
                { 
                    reuploadRequest: sock.updateMediaMessage 
                }
            );
        } catch (downloadError) {
            console.error('[STICKER] Download error:', downloadError);
            await safeSendMessage(sock, sender, { 
                text: '❌ Failed to download image. Please try sending the image again.' 
            });
            return;
        }
        
        if (!buffer || buffer.length === 0) {
            throw new Error('Failed to download image or empty buffer received');
        }

        console.log('[STICKER] Image downloaded, size:', buffer.length, 'bytes');
        console.log('[STICKER] Processing image...');
        
        // Get image metadata with validation
        let metadata;
        try {
            metadata = await sharp(buffer).metadata();
            console.log('[STICKER] Image metadata:', {
                format: metadata.format,
                width: metadata.width,
                height: metadata.height,
                size: metadata.size,
                channels: metadata.channels
            });
        } catch (metadataError) {
            console.error('[STICKER] Metadata error:', metadataError);
            await safeSendMessage(sock, sender, { 
                text: '❌ Invalid image format. Please send a valid image (JPEG, PNG, etc.).' 
            });
            return;
        }
        
        // Validate image
        if (!metadata.width || !metadata.height) {
            throw new Error('Invalid image: Could not determine dimensions');
        }

        // Calculate dimensions (max 512x512 for WhatsApp stickers)
        const maxSize = 512;
        let width = metadata.width;
        let height = metadata.height;
        
        // Maintain aspect ratio
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

        // Ensure minimum size
        if (width < 96) width = 96;
        if (height < 96) height = 96;

        console.log('[STICKER] Target dimensions:', { width, height });

        // Process image to webp format with proper sticker settings
        let sticker;
        try {
            sticker = await sharp(buffer)
                .resize(width, height, {
                    fit: 'contain',
                    background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
                })
                .webp({
                    quality: 100,
                    lossless: true,
                    effort: 6,
                    nearLossless: false
                })
                .toBuffer();
                
            console.log('[STICKER] Initial sticker size:', sticker.length, 'bytes');
            
            // If sticker is too large, reduce quality
            if (sticker.length > 1000000) { // 1MB limit
                console.log('[STICKER] Sticker too large, reducing quality...');
                sticker = await sharp(buffer)
                    .resize(width, height, {
                        fit: 'contain',
                        background: { r: 255, g: 255, b: 255, alpha: 0 }
                    })
                    .webp({
                        quality: 80,
                        lossless: false,
                        effort: 6
                    })
                    .toBuffer();
            }
        } catch (processError) {
            console.error('[STICKER] Processing error:', processError);
            await safeSendMessage(sock, sender, { 
                text: '❌ Failed to process image. Please try with a different image.' 
            });
            return;
        }

        console.log('[STICKER] Final sticker size:', sticker.length, 'bytes');

        // Send sticker with proper metadata
        try {
            const stickerMessage = {
                sticker: sticker,
                mimetype: 'image/webp'
            };

            console.log('[STICKER] Sending sticker to:', sender);
            await safeSendMessage(sock, sender, stickerMessage);
            console.log('[STICKER] Sticker sent successfully');
            
            // Send success confirmation
            await safeSendMessage(sock, sender, { 
                text: '✅ Sticker created successfully!' 
            });
            
        } catch (sendError) {
            console.error('[STICKER] Send error:', sendError);
            await safeSendMessage(sock, sender, { 
                text: '❌ Failed to send sticker. The image might be too large or in an unsupported format.' 
            });
        }
        
    } catch (error) {
        console.error('[STICKER] Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        
        let errorMessage = '❌ Failed to create sticker! ';
        
        if (error.message.includes('download')) {
            errorMessage += 'Could not download the image. Please try again.';
        } else if (error.message.includes('Invalid image')) {
            errorMessage += 'The image format is not supported. Please send a valid image (JPEG, PNG, etc.).';
        } else if (error.message.includes('dimensions')) {
            errorMessage += 'Could not process image dimensions.';
        } else if (error.message.includes('too large')) {
            errorMessage += 'The image is too large. Please send a smaller image.';
        } else {
            errorMessage += 'Please make sure you sent a valid image and try again.';
        }
        
        await safeSendMessage(sock, sender, { 
            text: errorMessage
        });
    }
}

// Safe message sending function
async function safeSendMessage(sock, jid, message, retries = 2) {
    for (let i = 0; i <= retries; i++) {
        try {
            await sock.sendMessage(jid, message);
            return true;
        } catch (error) {
            console.error(`[STICKER] Send attempt ${i + 1} failed:`, error.message);
            
            if (i === retries) {
                console.error('[STICKER] Max retries reached, message send failed');
                return false;
            }
            
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
    return false;
}

module.exports = {
    createSticker
};
