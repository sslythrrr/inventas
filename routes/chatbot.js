const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../db');
const fuzz = require('fuzzball');

const CHATBOT_API_URL = 'http://localhost:5000';
const SEMANTIC_THRESHOLD = 0.48;

function formatImageData(gambar_barang) {
    if (gambar_barang) {
        return gambar_barang;
    } else {
        return '/img/no-image.svg';
    }
}

function formatCardData(rows, groupByField, intent) {
    if (!rows || rows.length === 0) {
        return null;
    }

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

const responses = {
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
};

// Stopwords per intent
const intentStopwords = {
    'harga_barang': [
        'berapa', 'harga', 'brp', 'hrga', 'harganya', 'hargane',
        'rp', 'rupiah', 'biaya', 'ongkos', 'tarif', 'nilai',
        'untuk', 'dari', 'nya', 'kah', 'sih', 'dong', 'yak',
        'itu', 'ini', 'yang', 'apa', 'ya', 'deh', 'gan',
        'bos', 'min', 'kak', 'bang', 'mas', 'mbak', 'pak', 'bu'
    ],
    'lokasi_barang': [
        'di', 'mana', 'dimana', 'dmn', 'lokasi', 'ada', 'berada',
        'tempat', 'letak', 'posisi', 'lokasinya', 'tempatnya',
        'letaknya', 'adanya', 'keberadaan', 'untuk', 'dari',
        'nya', 'kah', 'sih', 'dong', 'yak', 'itu', 'ini',
        'yang', 'apa', 'ya', 'deh', 'gan', 'bos', 'min',
        'kak', 'bang', 'mas', 'mbak', 'pak', 'bu'
    ],
    'jumlah_barang': [
        'ada', 'berapa', 'brp', 'jumlah', 'banyak', 'byk',
        'total', 'unit', 'jumlahnya', 'banyaknya', 'totalnya',
        'qty', 'quantity', 'stock', 'stok', 'tersedia',
        'untuk', 'dari', 'nya', 'kah', 'sih', 'dong', 'yak',
        'itu', 'ini', 'yang', 'apa', 'ya', 'deh', 'gan',
        'bos', 'min', 'kak', 'bang', 'mas', 'mbak', 'pak', 'bu'
    ],
    'status_barang': [
        'status', 'kondisi', 'apa', 'bagaimana', 'gmn', 'gimana',
        'statusnya', 'kondisinya', 'keadaan', 'keadaannya',
        'situasi', 'situasinya', 'untuk', 'dari', 'nya',
        'kah', 'sih', 'dong', 'yak', 'itu', 'ini', 'yang',
        'ya', 'deh', 'gan', 'bos', 'min', 'kak', 'bang',
        'mas', 'mbak', 'pak', 'bu'
    ],
    'kepemilikan_barang': [
        'siapa', 'pemilik', 'dimiliki', 'punya', 'yang', 'milik',
        'pemiliknya', 'punyanya', 'miliknya', 'empunya',
        'kepunyaan', 'untuk', 'dari', 'nya', 'kah', 'sih',
        'dong', 'yak', 'itu', 'ini', 'apa', 'ya', 'deh',
        'gan', 'bos', 'min', 'kak', 'bang', 'mas', 'mbak',
        'pak', 'bu', 'oleh'
    ]
};

// Extract item dari message
function extractItemFromMessage(message, intent) {
    const stopwords = intentStopwords[intent] || [];

    let tokens = message.toLowerCase()
        .split(/\s+/)
        .filter(t => t.length > 0);

    let cleanTokens = tokens.filter(token => {
        const cleanToken = token.replace(/[^\w]/g, '');
        return cleanToken.length >= 2 && !stopwords.includes(cleanToken);
    });

    const extracted = cleanTokens.join(' ').trim();
    return extracted;
}

function normalizeText(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenize(text) {
    const normalized = normalizeText(text);
    return normalized.split(' ').filter(token => token.length > 1);
}

// Fuzzy search
async function fuzzySearchBarang(searchTerm, threshold = 100) {
    try {
        const searchPattern = `%${searchTerm.substring(0, Math.min(4, searchTerm.length))}%`;

        const [rows] = await db.query(
            `SELECT DISTINCT nama_barang 
             FROM barang 
             WHERE LOWER(nama_barang) LIKE LOWER(?)
             LIMIT 100`,
            [searchPattern]
        );

        if (rows.length === 0) {
            const [allRows] = await db.query('SELECT DISTINCT nama_barang FROM barang LIMIT 100');
            return fuzzyMatchResults(allRows, searchTerm, threshold);
        }

        return fuzzyMatchResults(rows, searchTerm, threshold);
    } catch (error) {
        console.error('Fuzzy search error:', error);
        return [];
    }
}

function fuzzyMatchResults(rows, searchTerm, threshold) {
    const normalizedSearch = normalizeText(searchTerm);

    const matches = rows.map(row => {
        const normalizedItem = normalizeText(row.nama_barang);
        const tokens = tokenize(row.nama_barang);

        let bestTokenScore = 0;
        if (tokens.length > 0) {
            bestTokenScore = Math.max(...tokens.map(token =>
                fuzz.ratio(normalizedSearch, token)
            ));
        }

        const fullStringScore = fuzz.token_sort_ratio(normalizedSearch, normalizedItem);
        const partialScore = fuzz.partial_ratio(normalizedSearch, normalizedItem);

        // Weighted scoring: token 50%, full 30%, partial 20%
        const finalScore = Math.round(
            (bestTokenScore * 0.5) +
            (fullStringScore * 0.3) +
            (partialScore * 0.2)
        );

        return {
            nama: row.nama_barang,
            score: finalScore
        };
    });

    const results = matches
        .filter(m => m.score >= threshold)
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.nama.localeCompare(b.nama, 'id');
        })
        .slice(0, 5);

    return results;
}

// Semantic search
async function semanticSearchBarang(searchTerm, threshold = SEMANTIC_THRESHOLD) {
    try {
        const [rows] = await db.query(
            'SELECT DISTINCT nama_barang FROM barang LIMIT 500'
        );

        if (rows.length === 0) {
            return [];
        }

        const itemNames = rows.map(r => r.nama_barang);

        const response = await axios.post(`${CHATBOT_API_URL}/semantic-search`, {
            query: searchTerm,
            items: itemNames,
            threshold: threshold,
            top_k: 5
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000
        });

        if (response.data.status === 'success' && response.data.results.length > 0) {
            return response.data.results;
        }

        return [];

    } catch (error) {
        if (error.response) {
            console.error('Semantic search API error:', error.response.status);
        } else {
            console.error('Semantic search error:', error.message);
        }
        return [];
    }
}

// Query barang by name
async function queryBarangByName(namaBarang, intent) {
    const queries = {
        'harga_barang': `SELECT id_barang, nama_barang, harga_barang, lokasi_barang, status_barang, kondisi_barang, gambar_barang
                         FROM barang 
                         WHERE LOWER(nama_barang) = LOWER(?)
                         ORDER BY harga_barang ASC`,

        'lokasi_barang': `SELECT id_barang, nama_barang, lokasi_barang, status_barang, kondisi_barang, harga_barang, gambar_barang
                          FROM barang 
                          WHERE LOWER(nama_barang) = LOWER(?)
                          ORDER BY lokasi_barang, nama_barang`,

        'jumlah_barang': `SELECT id_barang, nama_barang, status_barang, lokasi_barang, kondisi_barang, gambar_barang, harga_barang, COUNT(*) as jumlah
                          FROM barang 
                          WHERE LOWER(nama_barang) = LOWER(?)
                          GROUP BY id_barang, nama_barang, status_barang, lokasi_barang, kondisi_barang, gambar_barang, harga_barang
                          ORDER BY nama_barang, status_barang`,

        'status_barang': `SELECT id_barang, nama_barang, status_barang, kondisi_barang, lokasi_barang, harga_barang, gambar_barang
                          FROM barang 
                          WHERE LOWER(nama_barang) = LOWER(?)
                          ORDER BY status_barang, nama_barang`,

        'kepemilikan_barang': `SELECT k.nama_karyawan, k.jabatan, b.id_barang, b.nama_barang, b.gambar_barang, b.harga_barang, b.lokasi_barang, b.status_barang, b.kondisi_barang
                               FROM kepemilikan kp
                               JOIN barang b ON kp.id_barang = b.id_barang
                               JOIN karyawan k ON kp.id_karyawan = k.id_karyawan
                               WHERE LOWER(b.nama_barang) = LOWER(?)
                               AND kp.status_kepemilikan = 'aktif'
                               ORDER BY k.nama_karyawan, b.nama_barang`,

        'fallback': `SELECT id_barang, nama_barang, harga_barang, lokasi_barang, status_barang, kondisi_barang, gambar_barang
                     FROM barang 
                     WHERE LOWER(nama_barang) = LOWER(?)
                     ORDER BY nama_barang`
    };

    const query = queries[intent] || queries['fallback'];
    const [rows] = await db.query(query, [namaBarang]);
    return rows;
}

router.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;

        // Hardcoded help intent
        const lowerMessage = message.toLowerCase();
        const isHelpRequest = lowerMessage.includes('bantu') ||
            lowerMessage.includes('bantuan') ||
            lowerMessage.includes('tolong') ||
            lowerMessage.includes('help');

        if (isHelpRequest) {
            return res.json({
                intent: 'bantuan',
                confidence: 1.0,
                entities: {},
                response: responses.helpResponse,
                ner_tokens: [],
                status: 'success'
            });
        }

        let responseData = null;

        // Call ML model
        const response = await axios.post(`${CHATBOT_API_URL}/predict`, {
            text: message
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000
        });

        let { intent, entities, response: botResponse, ner_tokens, confidence = 0 } = response.data;
        let finalResponse = botResponse;
        let suggestions = [];

        // Intent: kepemilikan_barang
        if (intent === 'kepemilikan_barang') {
            let itemName = entities.item ? entities.item[0] : null;

            // Fallback extraction
            if (!itemName) {
                const extracted = extractItemFromMessage(message, 'kepemilikan_barang');

                if (extracted.length >= 3) {
                    const fuzzyResults = await fuzzySearchBarang(extracted, 65);

                    if (fuzzyResults.length > 0) {
                        itemName = fuzzyResults[0].nama;
                    }
                }
            }

            if (itemName) {
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
                    [itemName, `${itemName}%`, `%${itemName}%`, `%${itemName}%`, `%${itemName}%`]
                );

                if (rows.length > 0) {
                    finalResponse = `Ditemukan ${rows.length} barang ${itemName}:`;
                    responseData = formatCardData(rows, 'pemilik', 'kepemilikan_barang');
                } else {
                    // Fuzzy matching
                    const fuzzyResults = await fuzzySearchBarang(itemName, 65);

                    if (fuzzyResults.length > 0) {
                        const suggestionText = fuzzyResults.length > 1
                            ? `Mungkin yang Anda maksud: ${fuzzyResults.slice(0, 3).map(r => r.nama).join(', ')}? `
                            : `Mungkin yang Anda maksud ${fuzzyResults[0].nama}? `;

                        finalResponse = `Tidak menemukan "${itemName}". ${suggestionText}Menampilkan semua hasil...`;

                        let allRows = [];
                        for (const match of fuzzyResults) {
                            const fuzzyRows = await queryBarangByName(match.nama, 'kepemilikan_barang');
                            allRows = allRows.concat(fuzzyRows);
                        }

                        if (allRows.length > 0) {
                            responseData = formatCardData(allRows, 'pemilik', 'kepemilikan_barang');
                        }
                    } else {
                        // Kemiripan semantik
                        const semanticResults = await semanticSearchBarang(itemName);

                        if (semanticResults.length > 0) {
                            const suggestionText = semanticResults.length > 1
                                ? `Berdasarkan kemiripan makna, mungkin Anda mencari: ${semanticResults.slice(0, 3).map(r => r.nama).join(', ')}?`
                                : `Berdasarkan kemiripan makna, mungkin Anda mencari "${semanticResults[0].nama}"?`;

                            finalResponse = `Tidak menemukan "${itemName}". ${suggestionText} Menampilkan semua hasil...`;

                            let allRows = [];
                            for (const match of semanticResults) {
                                const semanticRows = await queryBarangByName(match.nama, 'kepemilikan_barang');
                                allRows = allRows.concat(semanticRows);
                            }

                            if (allRows.length > 0) {
                                responseData = formatCardData(allRows, 'pemilik', 'kepemilikan_barang');
                            }
                        } else {
                            finalResponse = `Maaf, data kepemilikan untuk "${itemName}" tidak ditemukan.`;
                            suggestions = [{ icon: 'guide', text: 'Lihat Panduan', query: 'bantuan' }];
                        }
                    }
                }
            } else {
                finalResponse = responses.fallbackSpecific.kepemilikan_barang;
                suggestions = [{ icon: 'guide', text: 'Lihat Panduan', query: 'bantuan' }];
            }
        }

        // Intent: harga_barang
        else if (intent === 'harga_barang') {
            let itemName = entities.item ? entities.item[0] : null;

            // Fallback extraction
            if (!itemName) {
                const extracted = extractItemFromMessage(message, 'harga_barang');

                if (extracted.length >= 3) {
                    const fuzzyResults = await fuzzySearchBarang(extracted, 65);

                    if (fuzzyResults.length > 0) {
                        itemName = fuzzyResults[0].nama;
                    }
                }
            }

            if (itemName) {
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
                    [itemName, `${itemName}%`, `%${itemName}%`, `%${itemName}%`, `%${itemName}%`]
                );

                if (rows.length > 0) {
                    finalResponse = `Ditemukan ${rows.length} barang ${itemName}:`;
                    responseData = formatCardData(rows, 'nama', 'harga_barang');
                } else {
                    // Fuzzy matching
                    const fuzzyResults = await fuzzySearchBarang(itemName, 65);

                    if (fuzzyResults.length > 0) {
                        const suggestionText = fuzzyResults.length > 1
                            ? `Mungkin yang Anda maksud: ${fuzzyResults.slice(0, 3).map(r => r.nama).join(', ')}?`
                            : `Mungkin yang Anda maksud "${fuzzyResults[0].nama}"?`;

                        finalResponse = `Tidak menemukan "${itemName}". ${suggestionText} Menampilkan semua hasil...`;

                        let allRows = [];
                        for (const match of fuzzyResults) {
                            const fuzzyRows = await queryBarangByName(match.nama, 'harga_barang');
                            allRows = allRows.concat(fuzzyRows);
                        }

                        if (allRows.length > 0) {
                            responseData = formatCardData(allRows, 'nama', 'harga_barang');
                        }
                    } else {
                        // Kemiripan semantik
                        const semanticResults = await semanticSearchBarang(itemName);

                        if (semanticResults.length > 0) {
                            const suggestionText = semanticResults.length > 1
                                ? `Berdasarkan kemiripan makna, mungkin Anda mencari: ${semanticResults.slice(0, 3).map(r => r.nama).join(', ')}?`
                                : `Berdasarkan kemiripan makna, mungkin Anda mencari "${semanticResults[0].nama}"?`;

                            finalResponse = `Tidak menemukan "${itemName}". ${suggestionText} Menampilkan semua hasil...`;

                            let allRows = [];
                            for (const match of semanticResults) {
                                const semanticRows = await queryBarangByName(match.nama, 'harga_barang');
                                allRows = allRows.concat(semanticRows);
                            }

                            if (allRows.length > 0) {
                                responseData = formatCardData(allRows, 'nama', 'harga_barang');
                            }
                        } else {
                            finalResponse = `Maaf, harga untuk "${itemName}" tidak ditemukan. Coba gunakan kata kunci lain atau lihat panduan.`;
                            suggestions = [{ icon: 'guide', text: 'Lihat Panduan', query: 'bantuan' }];
                        }
                    }
                }
            } else {
                finalResponse = responses.fallbackSpecific.harga_barang;
                suggestions = [{ icon: 'guide', text: 'Lihat Panduan', query: 'bantuan' }];
            }
        }

        // Intent: range_harga
        else if (intent === 'range_harga' && entities.price) {

            function parsePrice(priceStr, originalMessage) {
                const wordToNumber = {
                    'satu': '1', 'dua': '2', 'tiga': '3', 'empat': '4', 'lima': '5',
                    'enam': '6', 'tujuh': '7', 'delapan': '8', 'sembilan': '9'
                };

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

                const numberStr = fullPriceStr.replace(/[^\d.,]/g, '');
                const number = parseFloat(numberStr.replace(',', '.'));

                let maxPrice = 0;
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
                    maxPrice = parseInt(numberStr.replace(/[.,]/g, ''));
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

        // Intent: jumlah_barang
        else if (intent === 'jumlah_barang') {
            let itemName = entities.item ? entities.item[0] : null;

            // Fallback extraction
            if (!itemName) {
                const extracted = extractItemFromMessage(message, 'jumlah_barang');

                if (extracted.length >= 3) {
                    const fuzzyResults = await fuzzySearchBarang(extracted, 65);

                    if (fuzzyResults.length > 0) {
                        itemName = fuzzyResults[0].nama;
                    }
                }
            }

            if (itemName) {
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
                    [itemName, `${itemName}%`, `%${itemName}%`, `%${itemName}%`, `%${itemName}%`]
                );

                if (rows.length > 0) {
                    finalResponse = `Ditemukan ${rows.length} ${itemName}:`;
                    responseData = formatCardData(rows, 'nama', 'jumlah_barang');
                } else {
                    // Fuzzy matching
                    const fuzzyResults = await fuzzySearchBarang(itemName, 65);

                    if (fuzzyResults.length > 0) {
                        const suggestionText = fuzzyResults.length > 1
                            ? `Mungkin yang Anda maksud: ${fuzzyResults.slice(0, 3).map(r => r.nama).join(', ')}?`
                            : `Mungkin yang Anda maksud "${fuzzyResults[0].nama}"?`;

                        finalResponse = `Tidak menemukan "${itemName}". ${suggestionText} Menampilkan semua hasil...`;

                        let allRows = [];
                        for (const match of fuzzyResults) {
                            const fuzzyRows = await queryBarangByName(match.nama, 'jumlah_barang');
                            allRows = allRows.concat(fuzzyRows);
                        }

                        if (allRows.length > 0) {
                            responseData = formatCardData(allRows, 'nama', 'jumlah_barang');
                        }
                    } else {
                        // Kemiripan semantik
                        const semanticResults = await semanticSearchBarang(itemName);

                        if (semanticResults.length > 0) {
                            const suggestionText = semanticResults.length > 1
                                ? `Berdasarkan kemiripan makna, mungkin Anda mencari: ${semanticResults.slice(0, 3).map(r => r.nama).join(', ')}?`
                                : `Berdasarkan kemiripan makna, mungkin Anda mencari "${semanticResults[0].nama}"?`;

                            finalResponse = `Tidak menemukan "${itemName}". ${suggestionText} Menampilkan semua hasil...`;

                            let allRows = [];
                            for (const match of semanticResults) {
                                const semanticRows = await queryBarangByName(match.nama, 'jumlah_barang');
                                allRows = allRows.concat(semanticRows);
                            }

                            if (allRows.length > 0) {
                                responseData = formatCardData(allRows, 'nama', 'jumlah_barang');
                            }
                        } else {
                            finalResponse = `Maaf, jumlah untuk "${itemName}" tidak ditemukan.`;
                            suggestions = [{ icon: 'guide', text: 'Lihat Panduan', query: 'bantuan' }];
                        }
                    }
                }
            } else {
                finalResponse = responses.fallbackSpecific.jumlah_barang;
                suggestions = [{ icon: 'guide', text: 'Lihat Panduan', query: 'bantuan' }];
            }
        }

        // Intent: lokasi_barang
        else if (intent === 'lokasi_barang') {
            let itemName = entities.item ? entities.item[0] : null;

            // Fallback extraction
            if (!itemName) {
                const extracted = extractItemFromMessage(message, 'lokasi_barang');

                if (extracted.length >= 3) {
                    const fuzzyResults = await fuzzySearchBarang(extracted, 65);

                    if (fuzzyResults.length > 0) {
                        itemName = fuzzyResults[0].nama;
                    }
                }
            }

            if (itemName) {
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
                    [itemName, `${itemName}%`, `%${itemName}%`, `%${itemName}%`, `%${itemName}%`]
                );

                if (rows.length > 0) {
                    finalResponse = `Ditemukan ${rows.length} barang ${itemName}:`;
                    responseData = formatCardData(rows, 'lokasi', 'lokasi_barang');
                } else {
                    // Fuzzy matching
                    const fuzzyResults = await fuzzySearchBarang(itemName, 65);

                    if (fuzzyResults.length > 0) {
                        const suggestionText = fuzzyResults.length > 1
                            ? `Mungkin yang Anda maksud: ${fuzzyResults.slice(0, 3).map(r => r.nama).join(', ')}?`
                            : `Mungkin yang Anda maksud "${fuzzyResults[0].nama}"?`;

                        finalResponse = `Tidak menemukan "${itemName}". ${suggestionText} Menampilkan semua hasil...`;

                        let allRows = [];
                        for (const match of fuzzyResults) {
                            const fuzzyRows = await queryBarangByName(match.nama, 'lokasi_barang');
                            allRows = allRows.concat(fuzzyRows);
                        }

                        if (allRows.length > 0) {
                            responseData = formatCardData(allRows, 'lokasi', 'lokasi_barang');
                        }
                    } else {
                        // Kemiripan semantik
                        const semanticResults = await semanticSearchBarang(itemName);

                        if (semanticResults.length > 0) {
                            const suggestionText = semanticResults.length > 1
                                ? `Berdasarkan kemiripan makna, mungkin Anda mencari: ${semanticResults.slice(0, 3).map(r => r.nama).join(', ')}?`
                                : `Berdasarkan kemiripan makna, mungkin Anda mencari "${semanticResults[0].nama}"?`;

                            finalResponse = `Tidak menemukan "${itemName}". ${suggestionText} Menampilkan semua hasil...`;

                            let allRows = [];
                            for (const match of semanticResults) {
                                const semanticRows = await queryBarangByName(match.nama, 'lokasi_barang');
                                allRows = allRows.concat(semanticRows);
                            }

                            if (allRows.length > 0) {
                                responseData = formatCardData(allRows, 'lokasi', 'lokasi_barang');
                            }
                        } else {
                            finalResponse = `Maaf, lokasi untuk "${itemName}" tidak ditemukan.`;
                            suggestions = [{ icon: 'guide', text: 'Lihat Panduan', query: 'bantuan' }];
                        }
                    }
                }
            } else {
                finalResponse = responses.fallbackSpecific.lokasi_barang;
                suggestions = [{ icon: 'guide', text: 'Lihat Panduan', query: 'bantuan' }];
            }
        }

        // Intent: status_barang
        else if (intent === 'status_barang') {
            let itemName = entities.item ? entities.item[0] : null;

            // Fallback extraction
            if (!itemName) {
                const extracted = extractItemFromMessage(message, 'status_barang');

                if (extracted.length >= 3) {
                    const fuzzyResults = await fuzzySearchBarang(extracted, 65);

                    if (fuzzyResults.length > 0) {
                        itemName = fuzzyResults[0].nama;
                    }
                }
            }

            if (itemName) {
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
                    [itemName, `${itemName}%`, `%${itemName}%`, `%${itemName}%`, `%${itemName}%`]
                );

                if (rows.length > 0) {
                    finalResponse = `Status barang ${itemName} (${rows.length} item):`;
                    responseData = formatCardData(rows, 'status', 'status_barang');
                } else {
                    // Fuzzy matching
                    const fuzzyResults = await fuzzySearchBarang(itemName, 65);

                    if (fuzzyResults.length > 0) {
                        const suggestionText = fuzzyResults.length > 1
                            ? `Mungkin yang Anda maksud: ${fuzzyResults.slice(0, 3).map(r => r.nama).join(', ')}?`
                            : `Mungkin yang Anda maksud "${fuzzyResults[0].nama}"?`;

                        finalResponse = `Tidak menemukan "${itemName}". ${suggestionText} Menampilkan semua hasil...`;

                        let allRows = [];
                        for (const match of fuzzyResults) {
                            const fuzzyRows = await queryBarangByName(match.nama, 'status_barang');
                            allRows = allRows.concat(fuzzyRows);
                        }

                        if (allRows.length > 0) {
                            responseData = formatCardData(allRows, 'status', 'status_barang');
                        }
                    } else {
                        // Kemiripan semantik
                        const semanticResults = await semanticSearchBarang(itemName);

                        if (semanticResults.length > 0) {
                            const suggestionText = semanticResults.length > 1
                                ? `Berdasarkan kemiripan makna, mungkin Anda mencari: ${semanticResults.slice(0, 3).map(r => r.nama).join(', ')}?`
                                : `Berdasarkan kemiripan makna, mungkin Anda mencari "${semanticResults[0].nama}"?`;

                            finalResponse = `Tidak menemukan "${itemName}". ${suggestionText} Menampilkan semua hasil...`;

                            let allRows = [];
                            for (const match of semanticResults) {
                                const semanticRows = await queryBarangByName(match.nama, 'status_barang');
                                allRows = allRows.concat(semanticRows);
                            }

                            if (allRows.length > 0) {
                                responseData = formatCardData(allRows, 'status', 'status_barang');
                            }
                        } else {
                            finalResponse = `Maaf, status untuk "${itemName}" tidak ditemukan.`;
                            suggestions = [{ icon: 'guide', text: 'Lihat Panduan', query: 'bantuan' }];
                        }
                    }
                }
            } else {
                finalResponse = responses.fallbackSpecific.status_barang;
                suggestions = [{ icon: 'guide', text: 'Lihat Panduan', query: 'bantuan' }];
            }
        }

        // Intent: lelang_barang
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

        // Intent: sapaan
        else if (intent === 'sapaan') {
            let sapa = 'Halo!';
            const lowerMessage = message.toLowerCase();

            if (lowerMessage.includes('hey')) sapa = 'Hey!';
            else if (lowerMessage.includes('hai')) sapa = 'Hai!';
            else if (lowerMessage.includes('yo')) sapa = 'Yo!';
            else if (lowerMessage.includes('pagi')) sapa = 'Selamat pagi!';
            else if (lowerMessage.includes('siang')) sapa = 'Selamat siang!';
            else if (lowerMessage.includes('malam')) sapa = 'Selamat malam!';
            else if (lowerMessage.includes('assalamualaikum')) sapa = 'Waalaikumsalam!';
            else if (lowerMessage.includes('p')) sapa = 'yoi';
            else if (lowerMessage.includes('punten')) sapa = 'Mangga!';

            finalResponse = `${sapa} ${responses.greetingResponse}`;
        }

        // Intent: ucapan_terima_kasih
        else if (intent === 'ucapan_terima_kasih') {
            finalResponse = responses.thanksResponse;
        }

        // Intent: fallback
        else if (intent === 'fallback') {
            try {
                const fuzzyResults = await fuzzySearchBarang(message, 50);

                if (fuzzyResults.length > 0) {
                    const suggestionText = fuzzyResults.length > 1
                        ? `Mungkin yang Anda maksud: ${fuzzyResults.slice(0, 3).map(r => r.nama).join(', ')}?`
                        : `Mungkin yang Anda maksud "${fuzzyResults[0].nama}"?`;

                    finalResponse = `${suggestionText} Menampilkan semua hasil...`;

                    let allRows = [];
                    for (const match of fuzzyResults) {
                        try {
                            const rows = await queryBarangByName(match.nama, 'fallback');
                            if (rows && rows.length > 0) {
                                allRows = allRows.concat(rows);
                            }
                        } catch (queryError) {
                            console.error(`Error querying ${match.nama}:`, queryError.message);
                        }
                    }

                    if (allRows.length > 0) {
                        responseData = formatCardData(allRows, 'nama', 'fallback');
                    } else {
                        finalResponse = `${suggestionText} Namun data tidak ditemukan.`;
                    }
                }
            } catch (fallbackError) {
                console.error('Fallback fuzzy search error:', fallbackError);
                finalResponse = responses.fallbackGeneral;
                suggestions = [{ icon: 'guide', text: 'Panduan', query: 'bantuan' }];
            }
        }

        // Handle empty entities
        if (!entities || Object.keys(entities).length === 0) {
            if (intent === 'harga_barang') {
                finalResponse = responses.fallbackSpecific.harga_barang;
            } else if (intent === 'jumlah_barang') {
                finalResponse = responses.fallbackSpecific.jumlah_barang;
            } else if (intent === 'lokasi_barang') {
                finalResponse = responses.fallbackSpecific.lokasi_barang;
            } else if (intent === 'status_barang') {
                finalResponse = responses.fallbackSpecific.status_barang;
            } else if (intent === 'kepemilikan_barang') {
                finalResponse = responses.fallbackSpecific.kepemilikan_barang;
            }
        }

        // Generate suggestions
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
        console.error('Chatbot error:', error);

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

router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Chatbot router is running',
        timestamp: new Date().toISOString()
    });
});

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