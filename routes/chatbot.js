const express = require('express');
const router = express.Router();//rvk2
const axios = require('axios');
const db = require('../db'); // Import koneksi pool dari db.js
//rvk
const CHATBOT_API_URL = 'https://8a4451e8dbad.ngrok-free.app';

// Helper function untuk menghandle gambar barang
function formatImageData(gambar_barang, nama_barang) {
    if (gambar_barang) {
        return gambar_barang; // langsung return path
    } else {
        return '/img/no-image.svg';
    }
}

function formatCardData(rows, groupByField, intent) {
    const grouped = {};

    rows.forEach(row => {
        let groupKey;
        if (groupByField === 'pemilik') {
            groupKey = `${row.nama_karyawan} (${row.jabatan})`;
        } else if (groupByField === 'lokasi') {
            groupKey = row.lokasi_barang;
        } else if (groupByField === 'status') {
            groupKey = row.status_barang;
        } else {
            groupKey = row.nama_barang;
        }

        if (!grouped[groupKey]) {
            grouped[groupKey] = [];
        }

        grouped[groupKey].push({
            id_barang: row.id_barang,
            nama_barang: row.nama_barang,
            gambar: formatImageData(row.gambar_barang, row.nama_barang),
            harga_barang: row.harga_barang,
            lokasi_barang: row.lokasi_barang,
            status_barang: row.status_barang,
            kondisi_barang: row.kondisi_barang,
            pemilik: row.nama_karyawan,
            jabatan: row.jabatan
        });
    });

    return {
        type: intent,
        grouped: true,
        groupBy: groupByField,
        groups: Object.keys(grouped).map(key => ({
            groupName: key,
            items: grouped[key]
        }))
    };
}

function generateSuggestions(intent, entities) {
    const suggestions = [];
    const item = entities.item ? entities.item[0] : '';

    const suggestionMap = {
        'harga_barang': [
            { icon: 'location', text: `Lokasi ${item}?`, query: `Di mana lokasi ${item}` },
            { icon: 'quantity', text: `Jumlah ${item}?`, query: `Ada berapa ${item}` },
            { icon: 'owner', text: `Pemilik ${item}?`, query: `Siapa pemilik ${item}` }
        ],
        'lokasi_barang': [
            { icon: 'price', text: `Harga ${item}?`, query: `Berapa harga ${item}` },
            { icon: 'quantity', text: `Jumlah ${item}?`, query: `Ada berapa ${item}` },
            { icon: 'status', text: `Status ${item}?`, query: `Status ${item} apa` }
        ],
        'jumlah_barang': [
            { icon: 'price', text: `Harga ${item}?`, query: `Berapa harga ${item}` },
            { icon: 'location', text: `Lokasi ${item}?`, query: `Di mana lokasi ${item}` },
            { icon: 'owner', text: `Pemilik ${item}?`, query: `Siapa pemilik ${item}` }
        ],
        'status_barang': [
            { icon: 'price', text: `Harga ${item}?`, query: `Berapa harga ${item}` },
            { icon: 'location', text: `Lokasi ${item}?`, query: `Di mana lokasi ${item}` },
            { icon: 'quantity', text: `Jumlah ${item}?`, query: `Ada berapa ${item}` }
        ],
        'kepemilikan_barang': [
            { icon: 'price', text: `Harga ${item}?`, query: `Berapa harga ${item}` },
            { icon: 'location', text: `Lokasi ${item}?`, query: `Di mana lokasi ${item}` },
            { icon: 'status', text: `Status ${item}?`, query: `Status ${item} apa?` }
        ]
    };

    const templateMap = {
        'harga_barang': [
            { icon: 'location', text: 'Lokasi barang?', query: 'Di mana lokasi ' },
            { icon: 'quantity', text: 'Jumlah barang?', query: 'Ada berapa ' },
            { icon: 'owner', text: 'Pemilik barang?', query: 'Siapa pemilik ' }
        ],
        'lokasi_barang': [
            { icon: 'price', text: 'Harga barang?', query: 'Berapa harga ' },
            { icon: 'quantity', text: 'Jumlah barang?', query: 'Ada berapa ' },
            { icon: 'status', text: 'Status barang?', query: 'Status ' }
        ],
        'jumlah_barang': [
            { icon: 'price', text: 'Harga barang?', query: 'Berapa harga ' },
            { icon: 'location', text: 'Lokasi barang?', query: 'Di mana lokasi ' },
            { icon: 'owner', text: 'Pemilik barang?', query: 'Siapa pemilik ' }
        ],
        'status_barang': [
            { icon: 'price', text: 'Harga barang?', query: 'Berapa harga ' },
            { icon: 'location', text: 'Lokasi barang?', query: 'Di mana lokasi ' },
            { icon: 'quantity', text: 'Jumlah barang?', query: 'Ada berapa ' }
        ],
        'kepemilikan_barang': [
            { icon: 'price', text: 'Harga barang?', query: 'Berapa harga ' },
            { icon: 'location', text: 'Lokasi barang?', query: 'Di mana lokasi ' },
            { icon: 'status', text: 'Status barang?', query: 'Status ' }
        ]
    };

    if (item) {
        return suggestionMap[intent] || [];
    } else {
        return templateMap[intent] || [];
    }
}

// Terjemahan untuk semua respon chatbot
const translations = {
    id: {
        helpResponse: `🤖 Panduan Penggunaan Chatbot Helena 🤖

Saya dapat membantu Anda dengan berbagai informasi inventaris barang:

📍 Lokasi Barang
Contoh: "Di mana lokasi laptop?" atau "Lokasi printer ada dimana?"
💰 Harga Barang
Contoh: "Berapa harga kursi?" atau "Harga meja berapa?"
📊 Jumlah Barang
Contoh: "Ada berapa unit komputer?" atau "Jumlah lemari berapa?"
📋 Status Barang
Contoh: "Status laptop apa?" atau "Bagaimana kondisi printer?"
👤 Kepemilikan Barang
Contoh: "Siapa pemilik laptop?" atau "Komputer dimiliki siapa?"
🏷️ Range Harga
Contoh: "Barang di bawah 5 juta" atau "Harga maksimal 2 juta"
🏛️ Lelang Barang
Contoh: "Barang apa yang sedang dilelang?"
💬 Tips:
- Sebutkan nama barang yang spesifik untuk hasil yang lebih akurat
- Gunakan bahasa Indonesia yang natural
- Saya akan mencari barang yang mirip jika tidak ditemukan yang persis

Silakan coba salah satu contoh di atas! 😊`,
        greetingResponse: "Saya Helena👋. Ada yang bisa saya bantu? Silakan tanyakan tentang harga, jumlah, lokasi, status, atau kepemilikan barang.",
        thanksResponse: "Sama-sama! Senang bisa membantu. Ada yang lain yang ingin ditanyakan?",
        fallbackGeneral: "Maaf, saya tidak mengerti pertanyaan Anda. Coba tanyakan tentang harga, jumlah, lokasi, status, atau kepemilikan barang.",
        fallbackSpecific: {
            harga_barang: "Untuk mengecek harga barang, silakan sebutkan nama barangnya. Contoh: 'Berapa harga laptop?'",
            jumlah_barang: "Untuk mengecek jumlah barang, silakan sebutkan nama barangnya. Contoh: 'Ada berapa unit printer?'",
            lokasi_barang: "Untuk mengecek lokasi barang, silakan sebutkan nama barangnya. Contoh: 'Di mana lokasi lemari?'",
            status_barang: "Untuk mengecek status barang, silakan sebutkan nama barangnya. Contoh: 'Status laptop apa?'",
            kepemilikan_barang: "Untuk mengecek kepemilikan barang, silakan sebutkan nama barangnya. Contoh: 'Siapa pemilik laptop?'"
        },
        noDataFound: "Maaf, data yang Anda cari tidak ditemukan.",
        owned_by: "dimiliki oleh",
        position: "jabatan",
        price: "harga",
        currency: "Rp",
        quantity: "jumlah",
        units: "unit",
        location: "lokasi",
        status: "status",
        available_for_auction: "Barang yang tersedia untuk lelang",
        no_auction_items: "Saat ini tidak ada barang yang sedang dilelang.",
        items_found: "Berikut barang yang ditemukan",
        below: "di bawah",
        above: "di atas",
        between: "antara",
        and: "dan"
    },
    en: {
        helpResponse: `🤖 Helena Chatbot Usage Guide 🤖

I can help you with various inventory information:

📍 Item Location
Example: "Where is the laptop located?" or "Where can I find the printer?"
💰 Item Price
Example: "How much is the chair?" or "What's the desk price?"
📊 Item Quantity
Example: "How many computers are there?" or "How many cabinets do we have?"
📋 Item Status
Example: "What's the laptop status?" or "How's the printer condition?"
👤 Item Ownership
Example: "Who owns the laptop?" or "Who is the computer owner?"
🏷️ Price Range
Example: "Items under 5 million" or "Maximum price 2 million"
🏛️ Item Auction
Example: "What items are being auctioned?"
💬 Tips:
- Mention specific item names for more accurate results
- Use natural English language
- I will search for similar items if exact match not found

Please try one of the examples above! 😊`,
        greetingResponse: "I'm Helena👋. How can I help you? Please ask about price, quantity, location, status, or ownership of items.",
        thanksResponse: "You're welcome! Happy to help. Anything else you'd like to ask?",
        fallbackGeneral: "Sorry, I don't understand your question. Try asking about price, quantity, location, status, or ownership of items.",
        fallbackSpecific: {
            harga_barang: "To check item prices, please mention the item name. Example: 'How much is the laptop?'",
            jumlah_barang: "To check item quantity, please mention the item name. Example: 'How many printers are there?'",
            lokasi_barang: "To check item location, please mention the item name. Example: 'Where is the cabinet located?'",
            status_barang: "To check item status, please mention the item name. Example: 'What is the laptop status?'",
            kepemilikan_barang: "To check item ownership, please mention the item name. Example: 'Who owns the laptop?'"
        },
        noDataFound: "Sorry, the data you're looking for was not found.",
        owned_by: "owned by",
        position: "position",
        price: "price",
        currency: "Rp",
        quantity: "quantity",
        units: "units",
        location: "location",
        status: "status",
        available_for_auction: "Items available for auction",
        no_auction_items: "Currently there are no items being auctioned.",
        items_found: "Here are the items found",
        below: "below",
        above: "above",
        between: "between",
        and: "and"
    }
};

function getTranslation(language, key, fallbackKey = null) {
    const lang = language === 'en' ? 'en' : 'id';
    if (translations[lang][key]) {
        return translations[lang][key];
    } else if (fallbackKey && translations[lang][fallbackKey]) {
        return translations[lang][fallbackKey];
    }
    return translations['id'][key] || key; // Fallback to Indonesian
}

router.post('/chat', async (req, res) => {
    try {
        const { message, language = 'id' } = req.body;
        console.log('� Received message:', message, 'Language:', language);

        // Check for hardcoded bantuan/help intent FIRST - before API call
        const lowerMessage = message.toLowerCase();
        const isHelpRequest = language === 'en' ?
            (lowerMessage.includes('help') || lowerMessage.includes('guide') || lowerMessage.includes('assist')) :
            (lowerMessage.includes('bantu') || lowerMessage.includes('bantuan') || lowerMessage.includes('tolong') || lowerMessage.includes('help'));

        if (isHelpRequest) {
            const helpResponse = getTranslation(language, 'helpResponse');
            console.log('💬 Hardcoded help response sent in', language);
            return res.json({
                intent: 'bantuan',
                confidence: 1.0,
                entities: {},
                response: helpResponse,
                ner_tokens: [],
                status: 'success'
            });
        }

        let responseData = null;

        // Continue with ML model for other intents
        const response = await axios.post(`${CHATBOT_API_URL}/predict`, {
            text: message
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000
        });

        let { intent, entities, response: botResponse, ner_tokens, confidence = 0 } = response.data;
        let finalResponse = botResponse;

        console.log('🤖 Chatbot response:', { intent, confidence, entities, response: botResponse });
        console.log(`📊 Intent confidence: ${((confidence || 0) * 100).toFixed(2)}%`);

        let suggestions = [];

        // === INTENT: kepemilikan_barang ===
        if (intent === 'kepemilikan_barang' && entities.item) {
            const [rows] = await db.query(
                `SELECT k.nama_karyawan, k.jabatan, b.id_barang, b.nama_barang, b.gambar_barang, b.harga_barang, b.lokasi_barang, b.status_barang, b.kondisi_barang,
                CASE 
                    WHEN LOWER(b.nama_barang) = LOWER(?) THEN 3
                    WHEN LOWER(b.nama_barang) LIKE LOWER(?) THEN 2
                    WHEN LOWER(b.nama_barang) LIKE LOWER(?) THEN 1
                    ELSE 0
                END as relevance_score
                FROM kepemilikan kp
                JOIN barang b ON kp.id_barang = b.id_barang
                JOIN karyawan k ON kp.id_karyawan = k.id_karyawan
                WHERE (LOWER(b.nama_barang) LIKE LOWER(?) OR LOWER(b.nama_barang) LIKE LOWER(?)) 
                AND kp.status_kepemilikan = 'aktif'
                ORDER BY relevance_score DESC, k.nama_karyawan, b.nama_barang`,
                [
                    entities.item[0],
                    `${entities.item[0]}%`,
                    `%${entities.item[0]}%`,
                    `%${entities.item[0]}%`,
                    `%${entities.item[0]}%`
                ]
            );

            if (rows.length > 0) {
                finalResponse = `Ditemukan ${rows.length} barang ${entities.item[0]}:`;
                responseData = formatCardData(rows, 'pemilik', 'kepemilikan_barang');
            } else {
                finalResponse = `Maaf, data kepemilikan untuk "${entities.item[0]}" tidak ditemukan.`;
                responseData = null;
            }
        }

        // === INTENT: harga_barang ===
        else if (intent === 'harga_barang' && entities.item) {
            const [rows] = await db.query(
                `SELECT id_barang, nama_barang, harga_barang, lokasi_barang, status_barang, kondisi_barang, gambar_barang,
                CASE 
                    WHEN LOWER(nama_barang) = LOWER(?) THEN 3
                    WHEN LOWER(nama_barang) LIKE LOWER(?) THEN 2
                    WHEN LOWER(nama_barang) LIKE LOWER(?) THEN 1
                    ELSE 0
                END as relevance_score
                FROM barang 
                WHERE (LOWER(nama_barang) LIKE LOWER(?) OR LOWER(nama_barang) LIKE LOWER(?))
                ORDER BY relevance_score DESC, harga_barang ASC`,
                [
                    entities.item[0],
                    `${entities.item[0]}%`,
                    `%${entities.item[0]}%`,
                    `%${entities.item[0]}%`,
                    `%${entities.item[0]}%`
                ]
            );

            if (rows.length > 0) {
                finalResponse = `Ditemukan ${rows.length} barang ${entities.item[0]}:`;
                responseData = formatCardData(rows, 'nama', 'harga_barang');
            } else {
                finalResponse = `Maaf, harga untuk "${entities.item[0]}" tidak ditemukan.`;
            }
        }

        // === INTENT: range_harga ===
        else if (intent === 'range_harga' && entities.price) {
            const wordToNumber = {
                'satu': '1', 'dua': '2', 'tiga': '3', 'empat': '4', 'lima': '5',
                'enam': '6', 'tujuh': '7', 'delapan': '8', 'sembilan': '9'
            };

            function parsePrice(priceStr, originalMessage) {
                let workingStr = priceStr.toLowerCase();
                let originalLower = originalMessage.toLowerCase();
                Object.keys(wordToNumber).forEach(word => {
                    workingStr = workingStr.replace(new RegExp(word, 'g'), wordToNumber[word]);
                    originalLower = originalLower.replace(new RegExp(word, 'g'), wordToNumber[word]);
                });

                let fullPriceStr = workingStr;
                if (!fullPriceStr.includes('juta') && !fullPriceStr.includes('ribu')) {
                    const priceMatch = originalLower.match(/(\d+(?:[.,]\d+)?)\s*(ratus\s*juta|juta|ratus\s*ribu|puluh\s*ribu|ribu|ratus)/);
                    if (priceMatch) {
                        fullPriceStr = priceMatch[1] + ' ' + priceMatch[2];
                    }
                }

                let maxPrice = 0;
                const number = parseFloat(fullPriceStr.replace(/[^\d.,]/g, '').replace(',', '.'));

                if (fullPriceStr.includes('ratus juta')) {
                    maxPrice = number * 100000000;
                } else if (fullPriceStr.includes('juta')) {
                    maxPrice = number * 1000000;
                } else if (fullPriceStr.includes('ratus ribu')) {
                    maxPrice = number * 100000;
                } else if (fullPriceStr.includes('puluh ribu')) {
                    maxPrice = number * 10000;
                } else if (fullPriceStr.includes('ribu')) {
                    maxPrice = number * 1000;
                } else if (fullPriceStr.includes('ratus')) {
                    maxPrice = number * 100;
                } else {
                    maxPrice = parseInt(fullPriceStr.replace(/[^\d]/g, ''));
                }

                return { maxPrice, displayStr: fullPriceStr };
            }

            const { maxPrice, displayStr } = parsePrice(entities.price[0], message);

            const [rows] = await db.query(
                `SELECT id_barang, nama_barang, harga_barang, status_barang, lokasi_barang, kondisi_barang, gambar_barang 
                FROM barang 
                WHERE harga_barang <= ? 
                ORDER BY harga_barang ASC`,
                [maxPrice]
            );

            if (rows.length > 0) {
                finalResponse = `Ditemukan ${rows.length} barang dengan harga di bawah ${displayStr}:`;
                responseData = formatCardData(rows, 'nama', 'range_harga');
            } else {
                finalResponse = `Tidak ada barang dengan harga di bawah ${displayStr}.`;
            }
        }

        // === INTENT: jumlah_barang ===
        else if (intent === 'jumlah_barang' && entities.item) {
            const [rows] = await db.query(
                `SELECT id_barang, nama_barang, status_barang, lokasi_barang, kondisi_barang, gambar_barang, harga_barang, COUNT(*) as jumlah,
                CASE 
                    WHEN LOWER(nama_barang) = LOWER(?) THEN 3
                    WHEN LOWER(nama_barang) LIKE LOWER(?) THEN 2
                    WHEN LOWER(nama_barang) LIKE LOWER(?) THEN 1
                    ELSE 0
                END as relevance_score
                FROM barang 
                WHERE (LOWER(nama_barang) LIKE LOWER(?) OR LOWER(nama_barang) LIKE LOWER(?))
                GROUP BY id_barang, nama_barang, status_barang, lokasi_barang, kondisi_barang, gambar_barang, harga_barang
                ORDER BY relevance_score DESC, nama_barang, status_barang`,
                [
                    entities.item[0],
                    `${entities.item[0]}%`,
                    `%${entities.item[0]}%`,
                    `%${entities.item[0]}%`,
                    `%${entities.item[0]}%`
                ]
            );

            if (rows.length > 0) {
                finalResponse = `Ditemukan ${rows.length} ${entities.item[0]}:`;
                responseData = formatCardData(rows, 'nama', 'jumlah_barang');
            } else {
                finalResponse = `Maaf, jumlah untuk "${entities.item[0]}" tidak ditemukan.`;
            }
        }

        // === INTENT: lokasi_barang ===
        else if (intent === 'lokasi_barang' && entities.item) {
            const [rows] = await db.query(
                `SELECT id_barang, nama_barang, lokasi_barang, status_barang, kondisi_barang, harga_barang, gambar_barang,
                CASE 
                    WHEN LOWER(nama_barang) = LOWER(?) THEN 3
                    WHEN LOWER(nama_barang) LIKE LOWER(?) THEN 2
                    WHEN LOWER(nama_barang) LIKE LOWER(?) THEN 1
                    ELSE 0
                END as relevance_score
                FROM barang 
                WHERE (LOWER(nama_barang) LIKE LOWER(?) OR LOWER(nama_barang) LIKE LOWER(?))
                ORDER BY relevance_score DESC, lokasi_barang, nama_barang`,
                [
                    entities.item[0],
                    `${entities.item[0]}%`,
                    `%${entities.item[0]}%`,
                    `%${entities.item[0]}%`,
                    `%${entities.item[0]}%`
                ]
            );

            if (rows.length > 0) {
                finalResponse = `Ditemukan ${rows.length} barang ${entities.item[0]}:`;
                responseData = formatCardData(rows, 'lokasi', 'lokasi_barang');
            } else {
                finalResponse = `Maaf, lokasi untuk "${entities.item[0]}" tidak ditemukan.`;
                responseData = null;
            }
        }

        // === INTENT: status_barang ===
        else if (intent === 'status_barang' && entities.item) {
            const [rows] = await db.query(
                `SELECT id_barang, nama_barang, status_barang, kondisi_barang, lokasi_barang, harga_barang, gambar_barang,
                CASE 
                    WHEN LOWER(nama_barang) = LOWER(?) THEN 3
                    WHEN LOWER(nama_barang) LIKE LOWER(?) THEN 2
                    WHEN LOWER(nama_barang) LIKE LOWER(?) THEN 1
                    ELSE 0
                END as relevance_score
                FROM barang 
                WHERE (LOWER(nama_barang) LIKE LOWER(?) OR LOWER(nama_barang) LIKE LOWER(?))
                ORDER BY relevance_score DESC, status_barang, nama_barang`,
                [
                    entities.item[0],
                    `${entities.item[0]}%`,
                    `%${entities.item[0]}%`,
                    `%${entities.item[0]}%`,
                    `%${entities.item[0]}%`
                ]
            );

            if (rows.length > 0) {
                finalResponse = `Status barang ${entities.item[0]} (${rows.length} item):`;
                responseData = formatCardData(rows, 'status', 'status_barang');
            } else {
                finalResponse = `Maaf, status untuk "${entities.item[0]}" tidak ditemukan.`;
                responseData = null;
            }
        }

        // === INTENT: lelang_barang ===
        else if (intent === 'lelang_barang') {
            const [rows] = await db.query(
                `SELECT b.id_barang, b.nama_barang, b.kondisi_barang, b.status_barang, b.lokasi_barang, b.gambar_barang, l.harga_lelang as harga_barang, l.status_lelang, l.waktu_mulai, l.waktu_selesai
                FROM lelang l 
                JOIN barang b ON l.id_barang = b.id_barang 
                WHERE l.status_lelang IN ('sedang lelang', 'akan dimulai')
                ORDER BY l.waktu_mulai ASC`
            );

            if (rows.length > 0) {
                finalResponse = `Informasi Lelang Barang (${rows.length} item):`;
                responseData = formatCardData(rows, 'nama', 'lelang_barang');
            } else {
                finalResponse = `Tidak ada barang yang sedang atau akan dilelang saat ini.`;
            }
        }

        // === INTENT: sapaan ===
        else if (intent === 'sapaan') {
            let sapa = language === 'en' ? 'Hello!' : 'Halo!';
            const lowerMessage = message.toLowerCase();

            if (language === 'en') {
                if (lowerMessage.includes('hey')) sapa = 'Hey!';
                else if (lowerMessage.includes('hi')) sapa = 'Hi!';
                else if (lowerMessage.includes('good morning')) sapa = 'Good morning!';
                else if (lowerMessage.includes('good afternoon')) sapa = 'Good afternoon!';
                else if (lowerMessage.includes('good evening')) sapa = 'Good evening!';
            } else {
                if (lowerMessage.includes('hey')) sapa = 'Hey!';
                else if (lowerMessage.includes('hai')) sapa = 'Hai!';
                else if (lowerMessage.includes('yo')) sapa = 'Yo!';
                else if (lowerMessage.includes('pagi')) sapa = 'Selamat pagi!';
                else if (lowerMessage.includes('siang')) sapa = 'Selamat siang!';
                else if (lowerMessage.includes('malam')) sapa = 'Selamat malam!';
                else if (lowerMessage.includes('assalamualaikum')) sapa = 'Waalaikumsalam!';
                else if (lowerMessage.includes('p')) sapa = 'yoi';
                else if (lowerMessage.includes('punten')) sapa = 'Mangga!';
            }

            const greetingResponse = getTranslation(language, 'greetingResponse');
            finalResponse = `${sapa} ${greetingResponse}`;
        }

        // === INTENT: ucapan_terima_kasih ===
        else if (intent === 'ucapan_terima_kasih') {
            finalResponse = getTranslation(language, 'thanksResponse');
        }

        // === INTENT: fallback ===
        else if (intent === 'fallback') {
            finalResponse = getTranslation(language, 'fallbackGeneral');
            suggestions = [{
                icon: 'guide',  // <- IDENTIFIER BARU
                text: language === 'en' ? 'Guide' : 'Panduan',
                query: language === 'en' ? 'help' : 'bantuan'
            }];
        }

        // If entities are empty but intent is detected
        if (!entities || Object.keys(entities).length === 0) {
            if (intent === 'harga_barang') {
                finalResponse = getTranslation(language, 'fallbackSpecific').harga_barang;
            } else if (intent === 'jumlah_barang') {
                finalResponse = getTranslation(language, 'fallbackSpecific').jumlah_barang;
            } else if (intent === 'lokasi_barang') {
                finalResponse = getTranslation(language, 'fallbackSpecific').lokasi_barang;
            } else if (intent === 'status_barang') {
                finalResponse = getTranslation(language, 'fallbackSpecific').status_barang;
            } else if (intent === 'kepemilikan_barang') {
                finalResponse = getTranslation(language, 'fallbackSpecific').kepemilikan_barang;
            }
        }

        // Generate suggestions
        if (intent !== 'fallback' && intent !== 'bantuan' && intent !== 'sapaan' && intent !== 'ucapan_terima_kasih') {
            suggestions = generateSuggestions(intent, entities);
        }

        // If entities are empty but intent is detected, try to help
        if (!entities || Object.keys(entities).length === 0) {
            if (intent === 'harga_barang') {
                finalResponse = getTranslation(language, 'fallbackSpecific').harga_barang;
            } else if (intent === 'jumlah_barang') {
                finalResponse = getTranslation(language, 'fallbackSpecific').jumlah_barang;
            } else if (intent === 'lokasi_barang') {
                finalResponse = getTranslation(language, 'fallbackSpecific').lokasi_barang;
            } else if (intent === 'status_barang') {
                finalResponse = getTranslation(language, 'fallbackSpecific').status_barang;
            } else if (intent === 'kepemilikan_barang') {
                finalResponse = getTranslation(language, 'fallbackSpecific').kepemilikan_barang;
            }
        }

        console.log('💬 Final response:', finalResponse);

        if (intent !== 'fallback' && intent !== 'bantuan' && intent !== 'sapaan' && intent !== 'ucapan_terima_kasih') {
            suggestions = generateSuggestions(intent, entities);
        }
        res.json({
            intent,
            confidence: parseFloat(confidence) || 0,
            entities,
            response: finalResponse,
            data: responseData,
            suggestions: suggestions,
            lastIntent: intent,
            lastEntity: entities.item ? entities.item[0] : null,
            ner_tokens,
            status: 'success'
        });

    } catch (error) {
        console.error('❌ Chatbot error:', error);

        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            res.status(503).json({
                error: 'Chatbot service tidak tersedia. Silakan coba lagi nanti.',
                status: 'error'
            });
        } else if (error.response) {
            res.status(error.response.status).json({
                error: error.response.data.error || 'Chatbot error',
                status: 'error'
            });
        } else {
            res.status(500).json({
                error: 'Terjadi kesalahan pada chatbot',
                status: 'error'
            });
        }
    }
});

async function hybridSearch(itemQuery) {
    try {
        const response = await axios.post(`${CHATBOT_API_URL}/hybrid-search`, {
            query: itemQuery
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });

        return response.data.results || [];
    } catch (error) {
        console.error('❌ Hybrid search error:', error.message);
        return null; // null indicates search failed, trigger fallback
    }
}

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Chatbot router is running',
        timestamp: new Date().toISOString()
    });
});

// Test endpoint
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Chatbot router test endpoint',
        endpoints: {
            chat: 'POST /chat',
            health: 'GET /health',
            test: 'GET /test'
        },
        example_request: {
            url: '/chat',
            method: 'POST',
            body: {
                message: 'Berapa harga kursi rapat?'
            }
        }
    });
});

router.use((req, res, next) => {
    res.locals.currentUser = req.session.email || req.session.atasanEmail || 'guest';
    res.locals.userType = req.session.email ? 'admin' : req.session.atasanEmail ? 'atasan' : 'guest';
    next();
});

router.post('/clear-chat', (req, res) => {
    res.json({ success: true, message: 'Chat cleared' });
});

router.get('/chatbot', (req, res) => {
    res.render('chatbot', {
        user: req.session.user,
        role: req.session.role || (req.session.atasanEmail ? 'atasan' : 'admin')
    });
});

router.post('/clear-session', (req, res) => {
    res.json({ success: true, message: 'Session cleared' });
});

module.exports = router;