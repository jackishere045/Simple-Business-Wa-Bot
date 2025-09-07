const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const qrcode = require('qrcode-terminal'); // 👉 untuk generate QR di terminal

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        defaultQueryTimeoutMs: undefined,
        printQRInTerminal: false // matikan default QR
    });

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("📲 Scan QR ini untuk login:");
            qrcode.generate(qr, { small: true }); // 👉 tampilkan QR di terminal
        }

        if (connection === "close") {
            const shouldReconnect =
                (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log("Connection closed due to", lastDisconnect.error, ", reconnecting", shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === "open") {
            console.log("✅ Bot WhatsApp berhasil terhubung!");
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0];
        
        if (!message.key.fromMe && m.type === 'notify') {
            const chatId = message.key.remoteJid;
            const messageText = message.message?.conversation || 
                              message.message?.extendedTextMessage?.text || '';
            
            console.log(`Pesan masuk dari ${chatId}: ${messageText}`);
            
            // Auto reply berdasarkan keyword
            let replyText = '';
            const lowerText = messageText.toLowerCase();
            
            if (lowerText.includes('kak') || lowerText.includes('hai') || 
                lowerText.includes('assalamualaikum') || lowerText.includes('mas') || lowerText.includes('misi')) {
                replyText = 'Halo Pak/Bu, ada yang bisa saya bantu?';
            } else if (lowerText.includes('subtotal')) {
                replyText = 'Terimakasih sudah pesan, mohon kirim shareloc untuk segera kami kirim ya Bu/Pak 🙏';
            } else if (lowerText.includes('tes')) {
                replyText = 'Bot aktif ✅';
            }
            
            // Deteksi share location
            if (message.message?.locationMessage || message.message?.liveLocationMessage) {
                replyText = '🚀 Siap, kami segera meluncur ya Bu/Pak, mohon ditunggu 🙏';
                console.log('📍 Lokasi diterima dari:', chatId);
            }
            
            // Kirim balasan jika ada
            if (replyText) {
                await sock.sendMessage(chatId, { text: replyText });
                console.log(`Bot membalas: ${replyText}`);
            }
        }
    });
}

// Jalankan bot
connectToWhatsApp();
