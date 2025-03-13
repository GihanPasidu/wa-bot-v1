# CloudNextra WhatsApp Bot

A WhatsApp bot built with [Baileys](https://github.com/WhiskeySockets/Baileys) that provides useful features like auto-status viewing, sticker creation, and call management.

## Features

- 📱 **Auto Status View**: Automatically view WhatsApp statuses
- 🚫 **Anti-Call Protection**: Block and respond to unwanted calls
- 🖼️ **Sticker Creation**: Create WebP stickers from images
- ⚙️ **Control Panel**: Easy configuration management through commands

## Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/whatsapp.git
cd whatsapp
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your configuration:
```env
AUTO_READ_STATUS=true
ANTI_CALL=true
WELCOME_MESSAGE=Welcome to the group! 👋
GOODBYE_MESSAGE=Goodbye! 👋
```

4. Start the bot:
```bash
npm start
```

5. Scan the QR code with WhatsApp to log in

## Commands

- `.panel` - Show control panel and settings
- `.autoread` - Toggle auto status view
- `.anticall` - Toggle call blocking
- `.sticker` - Create sticker from image (send as image caption)

## Requirements

- Node.js v16 or higher
- A WhatsApp account
- Internet connection

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](https://choosealicense.com/licenses/mit/)

