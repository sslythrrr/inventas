const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../db'); // Import koneksi pool dari db.js

const CHATBOT_API_URL = 'https://5efc81939f40.ngrok-free.app/';



router.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;
        console.log('📥 Received message:', message);

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

        // === INTENT: kepemilikan_barang ===
        if (intent === 'kepemilikan_barang' && entities.item) {
            const [rows] = await db.query(
                `SELECT k.nama_karyawan, k.jabatan, b.nama_barang,
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
 ORDER BY relevance_score DESC, b.nama_barang`,
                [
                    entities.item[0],
                    `${entities.item[0]}%`,
                    `%${entities.item[0]}%`,
                    `%${entities.item[0]}%`,
                    `%${entities.item[0]}%`
                ]
            );

            if (rows.length > 0) {
                if (rows.length === 1) {
                    finalResponse = `${rows[0].nama_barang} dimiliki oleh ${rows[0].nama_karyawan} (${rows[0].jabatan})`;
                } else {
                    // Group by barang, then by owner
                    const grouped = {};
                    rows.forEach(row => {
                        if (!grouped[row.nama_barang]) {
                            grouped[row.nama_barang] = {};
                        }
                        const ownerKey = `${row.nama_karyawan} (${row.jabatan})`;
                        if (!grouped[row.nama_barang][ownerKey]) {
                            grouped[row.nama_barang][ownerKey] = 0;
                        }
                        grouped[row.nama_barang][ownerKey]++;
                    });

                    const results = Object.keys(grouped).map(barang => {
                        const owners = Object.keys(grouped[barang]).map(owner => {
                            const count = grouped[barang][owner];
                            const countStr = count > 1 ? ` (${count} buah)` : '';
                            return `- ${owner}${countStr}`;
                        }).join('\n');

                        return `${barang}:\n${owners}`;
                    }).join('\n\n');

                    finalResponse = `Ditemukan kepemilikan barang:\n\n${results}`;
                }
            } else {
                finalResponse = `Maaf, data pemilik untuk "${entities.item[0]}" tidak ditemukan.`;
            }
        }

        // === INTENT: harga_barang ===
        else if (intent === 'harga_barang' && entities.item) {
            function groupSimilarItems(items) {
                const grouped = {};

                items.forEach(item => {
                    const key = `${item.nama_barang}_${item.harga_barang}`;
                    if (!grouped[key]) {
                        grouped[key] = {
                            nama_barang: item.nama_barang,
                            harga_barang: item.harga_barang,
                            relevance_score: item.relevance_score,
                            count: 1
                        };
                    } else {
                        grouped[key].count++;
                        if (item.relevance_score > grouped[key].relevance_score) {
                            grouped[key].relevance_score = item.relevance_score;
                        }
                    }
                });
                return Object.values(grouped).sort((a, b) => {
                    if (b.relevance_score !== a.relevance_score) {
                        return b.relevance_score - a.relevance_score;
                    }
                    return a.harga_barang - b.harga_barang;
                });
            }
            function formatItemWithCount(item) {
                const countStr = item.count > 1 ? ` (${item.count} item)` : '';
                return `- ${item.nama_barang}${countStr}: Rp ${item.harga_barang.toLocaleString()}`;
            }

            const [rows] = await db.query(
                `SELECT nama_barang, harga_barang,
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
                const groupedItems = groupSimilarItems(rows);

                if (groupedItems.length === 1 && groupedItems[0].count === 1) {
                    finalResponse = `Harga ${groupedItems[0].nama_barang} adalah Rp ${groupedItems[0].harga_barang.toLocaleString()}`;
                } else {
                    const prices = groupedItems.slice(0, 200).map(formatItemWithCount).join('\n');
                    const totalItems = rows.length;
                    const uniqueItems = groupedItems.length;

                    let headerText = `Ditemukan ${totalItems} barang`;
                    headerText += ` terkait ${entities.item[0]}:\n\n`;

                    finalResponse = headerText + prices;
                    if (groupedItems.length > 200) {
                        finalResponse += `\n... dan ${groupedItems.length - 200} jenis barang lainnya`;
                    }
                }
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
            function groupSimilarItems(items) {
                const grouped = {};

                items.forEach(item => {
                    const key = `${item.nama_barang}_${item.harga_barang}`;
                    if (!grouped[key]) {
                        grouped[key] = {
                            nama_barang: item.nama_barang,
                            harga_barang: item.harga_barang,
                            status_barang: item.status_barang,
                            count: 1
                        };
                    } else {
                        grouped[key].count++;
                    }
                });

                return Object.values(grouped);
            }
            function formatItem(item) {
                const countStr = item.count > 1 ? ` (${item.count} item)` : '';
                return `- ${item.nama_barang}${countStr}: Rp ${item.harga_barang.toLocaleString()}`;
            }

            const { maxPrice, displayStr } = parsePrice(entities.price[0], message);

            const [rows] = await db.query(
                `SELECT nama_barang, harga_barang, status_barang 
         FROM barang 
         WHERE harga_barang <= ? 
         ORDER BY harga_barang ASC`,
                [maxPrice]
            );

            if (rows.length > 0) {
                const tersedia = groupSimilarItems(rows.filter(r => r.status_barang === 'tersedia'));
                const tidakTersedia = groupSimilarItems(rows.filter(r => r.status_barang !== 'tersedia'));

                let response = `Ditemukan ${rows.length} barang dengan harga di bawah ${displayStr}:\n\n`;

                if (tersedia.length > 0) {
                    response += `✅ Tersedia (${tersedia.length} jenis):\n`;
                    response += tersedia.slice(0, 200).map(formatItem).join('\n');
                    if (tersedia.length > 200) {
                        response += `\n... dan ${tersedia.length - 200} jenis barang tersedia lainnya`;
                    }
                }

                if (tidakTersedia.length > 0) {
                    response += `\n\n⚠️ Tidak Tersedia (${tidakTersedia.length} jenis):\n`;
                    response += tidakTersedia.slice(0, 3).map(item =>
                        `${formatItem(item)} (${item.status_barang})`
                    ).join('\n');
                }

                finalResponse = response;
            } else {
                finalResponse = `Tidak ada barang dengan harga di bawah ${displayStr}.`;
            }
        }


        // === INTENT: jumlah_barang ===
        else if (intent === 'jumlah_barang' && entities.item) {
            const [rows] = await db.query(
                `SELECT nama_barang, status_barang, COUNT(*) as jumlah,
        CASE 
            WHEN LOWER(nama_barang) = LOWER(?) THEN 3
            WHEN LOWER(nama_barang) LIKE LOWER(?) THEN 2
            WHEN LOWER(nama_barang) LIKE LOWER(?) THEN 1
            ELSE 0
        END as relevance_score
 FROM barang 
 WHERE (LOWER(nama_barang) LIKE LOWER(?) OR LOWER(nama_barang) LIKE LOWER(?))
 GROUP BY nama_barang, status_barang
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
                const grouped = {};
                rows.forEach(row => {
                    if (!grouped[row.nama_barang]) {
                        grouped[row.nama_barang] = { total: 0, tersedia: 0, status: {} };
                    }
                    grouped[row.nama_barang].total += row.jumlah;
                    grouped[row.nama_barang].status[row.status_barang] = row.jumlah;
                    if (row.status_barang === 'tersedia') {
                        grouped[row.nama_barang].tersedia = row.jumlah;
                    }
                });

                if (Object.keys(grouped).length === 1) {
                    const barang = Object.keys(grouped)[0];
                    const data = grouped[barang];

                    if (data.tersedia === data.total) {
                        finalResponse = `${barang}: ${data.total} unit (semua tersedia)`;
                    } else if (data.tersedia === 0) {
                        const statusDetail = Object.keys(data.status)
                            .filter(s => s !== 'tersedia')
                            .map(s => `${data.status[s]} ${s}`)
                            .join(', ');
                        finalResponse = `${barang}: ${data.total} unit (${statusDetail})`;
                    } else {
                        const tidakTersedia = data.total - data.tersedia;
                        finalResponse = `${barang}: ${data.total} unit (${data.tersedia} tersedia, ${tidakTersedia} tidak tersedia)`;
                    }
                } else {
                    const results = Object.keys(grouped).slice(0, 200).map(barang => {
                        const data = grouped[barang];

                        return `- ${barang}: ${data.total} unit (${data.tersedia} tersedia)`;

                    }).join('\n');

                    const totalJenis = Object.keys(grouped).length;
                    finalResponse = `Ditemukan ${totalJenis} jenis barang terkait ${entities.item[0]}:\n\n${results}`;
                }
            } else {
                finalResponse = `Maaf, jumlah untuk "${entities.item[0]}" tidak ditemukan.`;
            }
        }

        // === INTENT: lokasi_barang ===
        else if (intent === 'lokasi_barang' && entities.item) {
            const [rows] = await db.query(
                `SELECT nama_barang, lokasi_barang, status_barang,
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
                function groupSimilarItemsByLocation(items) {
                    const grouped = {};

                    items.forEach(item => {
                        if (!grouped[item.lokasi_barang]) {
                            grouped[item.lokasi_barang] = {};
                        }

                        const key = `${item.nama_barang}_${item.status_barang}`;
                        if (!grouped[item.lokasi_barang][key]) {
                            grouped[item.lokasi_barang][key] = {
                                nama_barang: item.nama_barang,
                                status_barang: item.status_barang,
                                count: 1
                            };
                        } else {
                            grouped[item.lokasi_barang][key].count++;
                        }
                    });

                    return grouped;
                }

                function formatItemWithCount(item) {
                    const countStr = item.count > 1 ? ` (${item.count} item)` : '';
                    return `${item.nama_barang}${countStr} (${item.status_barang})`;
                }

                const grouped = groupSimilarItemsByLocation(rows);

                if (Object.keys(grouped).length === 1 && rows.length === 1) {
                    finalResponse = `${rows[0].nama_barang} disimpan di lokasi: ${rows[0].lokasi_barang} (${rows[0].status_barang})`;
                } else {
                    const results = Object.keys(grouped).slice(0, 10).map(lokasi => {
                        const items = Object.values(grouped[lokasi]).map(formatItemWithCount).join(', ');
                        return `📍 ${lokasi}: ${items}`;
                    }).join('\n');

                    finalResponse = `Lokasi barang ${entities.item[0]}:\n${results}`;
                }
            } else {
                finalResponse = `Maaf, lokasi untuk "${entities.item[0]}" tidak ditemukan.`;
            }
        }

        // === INTENT: status_barang ===
        else if (intent === 'status_barang' && entities.item) {
            const [rows] = await db.query(
                `SELECT nama_barang, status_barang, kondisi_barang, lokasi_barang,
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
                if (rows.length === 1) {
                    finalResponse = `${rows[0].nama_barang}:\n` +
                        `• Status: ${rows[0].status_barang}\n` +
                        `• Kondisi: ${rows[0].kondisi_barang}\n` +
                        `• Lokasi: ${rows[0].lokasi_barang}`;
                } else {
                    const grouped = {};
                    rows.forEach(row => {
                        const key = `${row.status_barang}-${row.kondisi_barang}`;
                        if (!grouped[key]) {
                            grouped[key] = { status: row.status_barang, kondisi: row.kondisi_barang, items: [] };
                        }
                        grouped[key].items.push(`${row.nama_barang} (${row.lokasi_barang})`);
                    });

                    const results = Object.keys(grouped).map(key => {
                        const group = grouped[key];
                        const items = group.items.slice(0, 200).join(', ');
                        const extra = group.items.length > 200 ? ` +${group.items.length - 200} lainnya` : '';
                        return `${group.status} - ${group.kondisi}: ${items}${extra}`;
                    }).join('\n\n');

                    finalResponse = `Status barang "${entities.item[0]}" (${rows.length} item):\n\n${results}`;
                }
            } else {
                finalResponse = `Maaf, status untuk "${entities.item[0]}" tidak ditemukan.`;
            }
        }

        // === INTENT: lelang_barang ===
        else if (intent === 'lelang_barang') {
            const [rows] = await db.query(
                `SELECT b.nama_barang, b.kondisi_barang, l.harga_lelang, l.status_lelang, l.waktu_mulai, l.waktu_selesai
         FROM lelang l 
         JOIN barang b ON l.id_barang = b.id_barang 
         WHERE l.status_lelang IN ('sedang lelang', 'akan dimulai')
         ORDER BY l.waktu_mulai ASC`
            );

            if (rows.length > 0) {
                const sedangLelang = rows.filter(r => r.status_lelang === 'sedang lelang');
                const akanDimulai = rows.filter(r => r.status_lelang === 'akan dimulai');

                let response = `Informasi Lelang Barang:\n\n`;

                if (sedangLelang.length > 0) {
                    response += `🔥 Sedang Berlangsung (${sedangLelang.length}):\n`;
                    response += sedangLelang.map(r =>
                        `${r.nama_barang} (${r.kondisi_barang}) - Rp ${r.harga_lelang.toLocaleString()}`
                    ).join('\n');
                }

                if (akanDimulai.length > 0) {
                    response += `\n\n⏰ Akan Dimulai (${akanDimulai.length}):\n`;
                    response += akanDimulai.map(r =>
                        `${r.nama_barang} (${r.kondisi_barang}) - Rp ${r.harga_lelang.toLocaleString()}`
                    ).join('\n');
                }

                finalResponse = response;
            } else {
                finalResponse = `Tidak ada barang yang sedang atau akan dilelang saat ini.`;
            }
        }

        // === INTENT: sapaan ===
        else if (intent === 'sapaan') {
            let sapa = 'Halo!';
            const lowerMessage = message.toLowerCase();

            if (lowerMessage.includes('hey')) {
                sapa = 'Hey!';
            } else if (lowerMessage.includes('hai')) {
                sapa = 'Hai!';
            } else if (lowerMessage.includes('yo')) {
                sapa = 'Yo!';
            } else if (lowerMessage.includes('pagi')) {
                sapa = 'Selamat pagi!';
            } else if (lowerMessage.includes('siang')) {
                sapa = 'Selamat siang!';
            } else if (lowerMessage.includes('malam')) {
                sapa = 'Selamat malam!';
            }else if (lowerMessage.includes('assalamualaikum')) {
                sapa = 'Waalaikumsalam!';
            }else if (lowerMessage.includes('p')) {
                sapa = 'yoi';
            }else if (lowerMessage.includes('punten')) {
                sapa = 'Mangga!';
            }

            finalResponse = `${sapa} Saya Helena👋. Ada yang bisa saya bantu? Silakan tanyakan tentang harga, jumlah, lokasi, status, atau kepemilikan barang.`;
        }

        // === INTENT: ucapan_terima_kasih ===
        else if (intent === 'ucapan_terima_kasih') {
            finalResponse = `Sama-sama! Senang bisa membantu. Ada yang lain yang ingin ditanyakan?`;
        }

        // === INTENT: fallback ===
        else if (intent === 'fallback') {
            finalResponse = `Maaf, saya tidak mengerti pertanyaan Anda. Coba tanyakan tentang harga, jumlah, lokasi, status, atau kepemilikan barang.`;
        }

        // If entities are empty but intent is detected, try to help
        if (!entities || Object.keys(entities).length === 0) {
            if (intent === 'harga_barang') {
                finalResponse = `Untuk mengecek harga barang, silakan sebutkan nama barangnya. Contoh: "Berapa harga laptop?"`;
            } else if (intent === 'jumlah_barang') {
                finalResponse = `Untuk mengecek jumlah barang, silakan sebutkan nama barangnya. Contoh: "Ada berapa unit printer?"`;
            } else if (intent === 'lokasi_barang') {
                finalResponse = `Untuk mengecek lokasi barang, silakan sebutkan nama barangnya. Contoh: "Di mana lokasi lemari?"`;
            } else if (intent === 'status_barang') {
                finalResponse = `Untuk mengecek status barang, silakan sebutkan nama barangnya. Contoh: "Status laptop apa?"`;
            } else if (intent === 'kepemilikan_barang') {
                finalResponse = `Untuk mengecek kepemilikan barang, silakan sebutkan nama barangnya. Contoh: "Siapa pemilik laptop?"`;
            }
        }

        console.log('💬 Final response:', finalResponse);

        res.json({
            intent,
            confidence: parseFloat(confidence) || 0,
            entities,
            response: finalResponse,
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