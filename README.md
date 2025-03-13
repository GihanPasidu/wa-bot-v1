# WhatsApp Bot

A feature-rich WhatsApp bot built with Node.js and Baileys library.

## Features

- 🤖 Auto read messages
- 🔗 Anti-link protection
- ☎️ Auto reject calls
- 🖼️ Sticker creation from images
- ⚙️ Configurable settings via environment variables

## Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/whatsapp.git
cd whatsapp
```

2. Install dependencies
```bash
npm install
```

3. Configure environment variables by copying `.env.example` to `.env`
```bash
cp .env.example .env
```

4. Edit `.env` file with your preferred settings:
```properties
AUTO_READ_STATUS=true
ANTI_LINK=true
ANTI_CALL=true
WELCOME_MESSAGE=Welcome to the group! 👋
GOODBYE_MESSAGE=Goodbye! 👋
```

5. Start the bot
```bash
npm start
```

## Usage

1. Scan the QR code that appears in the terminal with your WhatsApp
2. The bot will now respond to commands and enforce configured settings
3. To create a sticker, send an image with caption `!sticker`

## Features Configuration

- `AUTO_READ_STATUS`: Enable/disable automatic message read
- `ANTI_LINK`: Enable/disable link protection
- `ANTI_CALL`: Enable/disable automatic call rejection

## License

MIT License - see LICENSE file for details

