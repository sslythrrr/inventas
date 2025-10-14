const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../db');
const fuzz = require('fuzzball');

const CHATBOT_API_URL = 'http://localhost:5000';
const SEMANTIC_THRESHOLD = 0.45;

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

function detectAggregationQuery(message) {
    const lowerMsg = message.toLowerCase();

    const totalPattern = /\b(total|jumlah semua|jumlah keseluruhan)\b.*\bharga\b/i;
    const avgPattern = /\b(rata-rata|rata rata|average|rerata|mean)\b.*\bharga\b/i;
    const locationPattern = /\b(di|pada|untuk|lokasi)\s+([a-zA-Z0-9\s]+?)(?:\s+(?:harga|barang|nya|itu|ini|dong|deh|sih)|$)/i;

    let type = null;
    if (totalPattern.test(lowerMsg)) type = 'total';
    else if (avgPattern.test(lowerMsg)) type = 'average';

    if (!type) return null;

    let location = null;
    const locMatch = lowerMsg.match(locationPattern);
    if (locMatch) {
        location = locMatch[2].trim();

        const noiseWords = ['harga', 'barang', 'nya', 'itu', 'ini', 'dong', 'deh', 'sih', 'yah'];
        let locTokens = location.split(/\s+/).filter(t => !noiseWords.includes(t.toLowerCase()));
        location = locTokens.join(' ').trim();
    }

    const stopwords = [
        'total', 'rata-rata', 'rata', 'average', 'harga', 'jumlah', 'semua',
        'keseluruhan', 'barang', 'di', 'pada', 'untuk', 'nya', 'itu', 'ini',
        'rerata', 'mean', 'dong', 'deh', 'sih', 'yah', 'kah', 'lokasi'
    ];

    let tokens = lowerMsg.split(/\s+/).filter(t => {
        const clean = t.toLowerCase();
        return clean.length > 0 && !stopwords.includes(clean);
    });

    let entity = tokens.join(' ').trim();

    if (location) {
        entity = entity.replace(new RegExp(location, 'gi'), '').trim();
    }

    if (!entity || entity.length < 2 || /^\d+$/.test(entity)) {
        entity = null;
    }

    return { type, entity, location };
}

function detectRankingQuery(message) {
    const lowerMsg = message.toLowerCase();

    const rankingPattern = /\b(termahal|termurah|terbanyak|paling\s*(mahal|murah|banyak))\b/i;
    const topPattern = /\b(?:top|teratas)\s*(\d+)/i;
    const numberPattern = /\b(\d+)\s*(?:barang|item)?\s*(termahal|termurah|terbanyak)/i;

    if (!rankingPattern.test(lowerMsg) && !topPattern.test(lowerMsg)) return null;

    let type = null;
    if (/termahal|paling\s*mahal/i.test(lowerMsg)) type = 'termahal';
    else if (/termurah|paling\s*murah/i.test(lowerMsg)) type = 'termurah';
    else if (/terbanyak|paling\s*banyak/i.test(lowerMsg)) type = 'terbanyak';

    let limit = 10;
    const topMatch = lowerMsg.match(topPattern);
    const numMatch = lowerMsg.match(numberPattern);

    if (topMatch) limit = parseInt(topMatch[1]);
    else if (numMatch) limit = parseInt(numMatch[1]);

    let scope = 'barang';
    if (/lokasi/i.test(lowerMsg)) scope = 'lokasi';

    const stopwords = [
        'termahal', 'termurah', 'terbanyak', 'paling', 'mahal', 'murah', 'banyak',
        'top', 'barang', 'item', 'lokasi', 'dengan', 'yang', 'apa', 'ada',
        'coba', 'tolong', 'tampilin', 'tampilkan', 'lihat', 'liat', 'show',
        'kasih', 'berikan', 'list', 'daftar', 'dong', 'deh', 'nih', 'nya'
    ];

    let tokens = lowerMsg.split(/\s+/).filter(t => {
        const clean = t.replace(/\d+/g, '').trim();
        return clean.length > 2 && !stopwords.includes(clean);
    });

    let entity = tokens.join(' ').trim();

    if (!entity || entity.length < 3) {
        entity = null;
    }

    return { type, limit, scope, entity };
}
function detectGroupingQuery(message) {
    const lowerMsg = message.toLowerCase();

    const groupPattern = /\b(per|setiap|masing-masing|tiap)\s*(lokasi|karyawan|orang|pegawai|staff)/i;

    const ownershipPattern = /\b(barang|aset|inventaris).*(dimiliki|milik|punya|punyaan)\s+([a-zA-Z\s]+)/i;

    const directOwnerPattern = /\b(barang|aset|inventaris)\s+([a-zA-Z]+)\b(?!\s+(termahal|termurah|terbanyak|di|pada))/i;

    const totalPattern = /\b(total|jumlah).*\bharga.*(karyawan|milik|punya)\s*([a-zA-Z\s]+)/i;

    let type = null;
    let entity = null;

    const groupMatch = lowerMsg.match(groupPattern);
    if (groupMatch) {
        const groupBy = groupMatch[2];
        if (['lokasi'].includes(groupBy)) {
            type = 'per_lokasi';
        } else if (['karyawan', 'orang', 'pegawai', 'staff'].includes(groupBy)) {
            type = 'per_karyawan';
        }
    }

    if (!type) {
        const ownerMatch = lowerMsg.match(ownershipPattern);
        if (ownerMatch) {
            type = 'barang_karyawan';
            entity = ownerMatch[3].trim();

            const noisyWords = ['yang', 'itu', 'ini', 'nya', 'dong', 'sih', 'yah', 'deh'];
            let entityTokens = entity.split(/\s+/).filter(t => !noisyWords.includes(t));
            entity = entityTokens.join(' ').trim();
        }
    }

    if (!type) {
        const directMatch = lowerMsg.match(directOwnerPattern);
        if (directMatch) {
            type = 'barang_karyawan';
            entity = directMatch[2].trim();
        }
    }

    if (!type) {
        const totalMatch = lowerMsg.match(totalPattern);
        if (totalMatch) {
            type = 'total_harga_karyawan';
            entity = totalMatch[3].trim();

            const noisyWords = ['yang', 'itu', 'ini', 'nya', 'dong', 'sih', 'yah', 'deh'];
            let entityTokens = entity.split(/\s+/).filter(t => !noisyWords.includes(t));
            entity = entityTokens.join(' ').trim();
        }
    }

    if (!type) return null;

    return { type, entity };
}

function detectGuideQuery(message, role) {
    const lowerMsg = message.toLowerCase();

    const guidePattern = /\b(panduan|cara|bagaimana|tutorial|gimana|gmn)\b/i;

    if (!guidePattern.test(lowerMsg)) return null;

    let context = null;
    if (/lelang/i.test(lowerMsg)) context = 'lelang';
    else if (/sistem|pakai|gunakan|menggunakan/i.test(lowerMsg)) context = 'sistem';

    return { context, role: role || 'guest' };
}

function detectQueryContext(message, intent) {
    const lowerMsg = message.toLowerCase();

    const rankingPattern = /\b(termahal|termurah|terbanyak|paling\s*(mahal|murah|banyak))\b/i;
    const topPattern = /\b(?:top|teratas)\s*(\d+)/i;
    const numberRankPattern = /\b(\d+)\s*(?:barang|item)?\s*(termahal|termurah|terbanyak)/i;

    if (rankingPattern.test(lowerMsg) || topPattern.test(lowerMsg) || numberRankPattern.test(lowerMsg)) {
        const rankQuery = detectRankingQuery(message);
        if (rankQuery) {
            let targetIntent = 'harga_barang';
            if (/terbanyak/i.test(lowerMsg) || /jumlah/i.test(lowerMsg)) {
                targetIntent = 'jumlah_barang';
            }

            return {
                type: 'ranking',
                params: rankQuery,
                suggestedIntent: targetIntent
            };
        }
    }

    const groupPattern = /\b(per|setiap|masing-masing|tiap)\s*(lokasi|karyawan|orang|pegawai|staff)/i;
    const ownershipPattern = /\b(barang|aset|inventaris).*(dimiliki|milik|punya|punyaan)\s+([a-zA-Z\s]+)/i;
    const directOwnerPattern = /\b(barang|aset|inventaris)\s+([a-zA-Z]+)\b(?!\s+(termahal|termurah|terbanyak|di|pada))/i;

    if (groupPattern.test(lowerMsg) || ownershipPattern.test(lowerMsg) || directOwnerPattern.test(lowerMsg)) {
        const groupQuery = detectGroupingQuery(message);
        if (groupQuery) {
            let targetIntent = 'jumlah_barang';
            if (groupQuery.type === 'barang_karyawan' || groupQuery.type === 'total_harga_karyawan') {
                targetIntent = 'kepemilikan_barang';
            }

            return {
                type: 'grouping',
                params: groupQuery,
                suggestedIntent: targetIntent
            };
        }
    }

    const totalPattern = /\b(total|jumlah semua|jumlah keseluruhan)\b.*\bharga\b/i;
    const avgPattern = /\b(rata-rata|rata rata|average|rerata|mean)\b.*\bharga\b/i;

    if (totalPattern.test(lowerMsg) || avgPattern.test(lowerMsg)) {
        const aggQuery = detectAggregationQuery(message);
        if (aggQuery) {
            return {
                type: 'aggregation',
                params: aggQuery,
                suggestedIntent: 'harga_barang'
            };
        }
    }

    return { type: null, params: null, suggestedIntent: null };
}

async function handleAggregation(queryData) {
    const { type, entity, location } = queryData;

    let query = '';
    let params = [];
    let itemName = entity;

    if (entity && entity.length >= 3) {
        const fuzzyResults = await fuzzySearchBarang(entity, 65);
        if (fuzzyResults.length > 0) {
            itemName = fuzzyResults[0].nama;
        }
    }

    if (type === 'total') {
        if (location) {
            query = `SELECT SUM(harga_barang) as total, COUNT(*) as jumlah FROM barang WHERE LOWER(lokasi_barang) LIKE LOWER(?)`;
            params = [`%${location}%`];
        } else if (itemName) {
            query = `SELECT SUM(harga_barang) as total, COUNT(*) as jumlah FROM barang WHERE LOWER(nama_barang) LIKE LOWER(?)`;
            params = [`%${itemName}%`];
        } else {
            return { success: false, message: 'Silakan sebutkan nama barang atau lokasi. Contoh: "Total harga laptop" atau "Total harga barang di ruang IT"' };
        }
    } else if (type === 'average') {
        if (itemName) {
            query = `SELECT AVG(harga_barang) as rata, COUNT(*) as jumlah FROM barang WHERE LOWER(nama_barang) LIKE LOWER(?)`;
            params = [`%${itemName}%`];
        } else {
            return { success: false, message: 'Silakan sebutkan nama barang. Contoh: "Rata-rata harga kursi"' };
        }
    }

    const [rows] = await db.query(query, params);

    if (rows.length === 0 || rows[0].jumlah === 0) {
        return { success: false, message: `Tidak ditemukan data untuk "${entity || location}".` };
    }

    const result = rows[0];
    let response = '';

    if (type === 'total') {
        const totalFormatted = new Intl.NumberFormat('id-ID').format(result.total || 0);
        if (location) {
            response = `Total harga ${result.jumlah} barang di ${location} adalah Rp ${totalFormatted}`;
        } else {
            response = `Total harga ${result.jumlah} unit ${itemName} adalah Rp ${totalFormatted}`;
        }
    } else if (type === 'average') {
        const avgFormatted = new Intl.NumberFormat('id-ID').format(Math.round(result.rata || 0));
        response = `Rata-rata harga ${itemName} (${result.jumlah} unit) adalah Rp ${avgFormatted}`;
    }

    return { success: true, response, data: result };
}

async function handleRanking(queryData) {
    const { type, limit, scope, entity } = queryData;

    let query = '';
    let params = [];
    let itemName = entity;

    if (entity && entity.length >= 3) {
        const fuzzyResults = await fuzzySearchBarang(entity, 65);
        if (fuzzyResults.length > 0) {
            itemName = fuzzyResults[0].nama;
        }
    }

    if (scope === 'barang') {
        if (type === 'termahal') {
            if (itemName) {
                query = `SELECT id_barang, nama_barang, harga_barang, lokasi_barang, status_barang, kondisi_barang, gambar_barang 
                         FROM barang WHERE LOWER(nama_barang) LIKE LOWER(?) ORDER BY harga_barang DESC LIMIT ?`;
                params = [`%${itemName}%`, limit];
            } else {
                query = `SELECT id_barang, nama_barang, harga_barang, lokasi_barang, status_barang, kondisi_barang, gambar_barang 
                         FROM barang ORDER BY harga_barang DESC LIMIT ?`;
                params = [limit];
            }
        } else if (type === 'termurah') {
            if (itemName) {
                query = `SELECT id_barang, nama_barang, harga_barang, lokasi_barang, status_barang, kondisi_barang, gambar_barang 
                         FROM barang WHERE LOWER(nama_barang) LIKE LOWER(?) ORDER BY harga_barang ASC LIMIT ?`;
                params = [`%${itemName}%`, limit];
            } else {
                query = `SELECT id_barang, nama_barang, harga_barang, lokasi_barang, status_barang, kondisi_barang, gambar_barang 
                         FROM barang ORDER BY harga_barang ASC LIMIT ?`;
                params = [limit];
            }
        } else if (type === 'terbanyak') {
            query = `SELECT nama_barang, COUNT(*) as jumlah, 
                     MAX(harga_barang) as harga_barang, 
                     MAX(lokasi_barang) as lokasi_barang,
                     MAX(status_barang) as status_barang,
                     MAX(kondisi_barang) as kondisi_barang,
                     MAX(gambar_barang) as gambar_barang,
                     MAX(id_barang) as id_barang
                     FROM barang 
                     GROUP BY nama_barang 
                     ORDER BY jumlah DESC 
                     LIMIT ?`;
            params = [limit];
        }
    } else if (scope === 'lokasi') {
        if (type === 'termahal') {
            query = `SELECT lokasi_barang, MAX(harga_barang) as harga_tertinggi, COUNT(*) as jumlah_barang
                     FROM barang 
                     GROUP BY lokasi_barang 
                     ORDER BY harga_tertinggi DESC 
                     LIMIT ?`;
            params = [limit];
        } else if (type === 'terbanyak') {
            query = `SELECT lokasi_barang, COUNT(*) as jumlah_barang, SUM(harga_barang) as total_harga
                     FROM barang 
                     GROUP BY lokasi_barang 
                     ORDER BY jumlah_barang DESC 
                     LIMIT ?`;
            params = [limit];
        }
    }

    const [rows] = await db.query(query, params);

    if (rows.length === 0) {
        return { success: false, message: `Tidak ditemukan data ${type}${itemName ? ` untuk "${itemName}"` : ''}.` };
    }

    let responseText = '';
    if (scope === 'barang') {
        const itemText = itemName ? ` ${itemName}` : '';
        const typeText = type === 'termahal' ? 'termahal' : type === 'termurah' ? 'termurah' : 'dengan stok terbanyak';
        responseText = `Berikut ${rows.length}${itemText} barang ${typeText}:`;
    } else if (scope === 'lokasi') {
        const typeText = type === 'termahal' ? 'dengan barang termahal' : 'dengan barang terbanyak';
        responseText = `Berikut ${rows.length} lokasi ${typeText}:`;
    }

    return { success: true, response: responseText, rows, rankingType: type, scope };
}

async function handleGrouping(queryData) {
    const { type, entity } = queryData;

    let query = '';
    let params = [];

    if (type === 'per_lokasi') {
        query = `SELECT lokasi_barang, COUNT(*) as jumlah, SUM(harga_barang) as total_harga
                 FROM barang 
                 GROUP BY lokasi_barang 
                 ORDER BY jumlah DESC`;
    } else if (type === 'per_karyawan') {
        query = `SELECT k.nama_karyawan, k.jabatan, COUNT(*) as jumlah, SUM(b.harga_barang) as total_harga
                 FROM kepemilikan kp
                 JOIN barang b ON kp.id_barang = b.id_barang
                 JOIN karyawan k ON kp.id_karyawan = k.id_karyawan
                 WHERE kp.status_kepemilikan = 'aktif'
                 GROUP BY k.id_karyawan, k.nama_karyawan, k.jabatan
                 ORDER BY jumlah DESC`;
    } else if (type === 'barang_karyawan' || type === 'total_harga_karyawan') {
        if (!entity || entity.length < 3) {
            return { success: false, message: 'Silakan sebutkan nama karyawan. Contoh: "Barang yang dimiliki Budi"' };
        }

        query = `SELECT k.nama_karyawan, k.jabatan, b.id_barang, b.nama_barang, b.harga_barang, 
                 b.lokasi_barang, b.status_barang, b.kondisi_barang, b.gambar_barang
                 FROM kepemilikan kp
                 JOIN barang b ON kp.id_barang = b.id_barang
                 JOIN karyawan k ON kp.id_karyawan = k.id_karyawan
                 WHERE LOWER(k.nama_karyawan) LIKE LOWER(?) 
                 AND kp.status_kepemilikan = 'aktif'
                 ORDER BY b.nama_barang`;
        params = [`%${entity}%`];
    }

    const [rows] = await db.query(query, params);

    if (rows.length === 0) {
        if (type === 'barang_karyawan' || type === 'total_harga_karyawan') {
            return { success: false, message: `Tidak ditemukan data kepemilikan untuk "${entity}".` };
        }
        return { success: false, message: 'Tidak ditemukan data.' };
    }

    let responseText = '';
    let formattedData = null;

    if (type === 'per_lokasi') {
        responseText = `Jumlah barang per lokasi (${rows.length} lokasi):`;
        let details = rows.map(r => {
            const totalFormatted = new Intl.NumberFormat('id-ID').format(r.total_harga || 0);
            return `\n📍 ${r.lokasi_barang}: ${r.jumlah} barang (Total: Rp ${totalFormatted})`;
        }).join('');
        responseText += details;
    } else if (type === 'per_karyawan') {
        responseText = `Jumlah barang per karyawan (${rows.length} karyawan):`;
        let details = rows.map(r => {
            const totalFormatted = new Intl.NumberFormat('id-ID').format(r.total_harga || 0);
            return `\n👤 ${r.nama_karyawan} (${r.jabatan}): ${r.jumlah} barang (Total: Rp ${totalFormatted})`;
        }).join('');
        responseText += details;
    } else if (type === 'barang_karyawan') {
        const karyawan = rows[0].nama_karyawan;
        responseText = `Barang yang dimiliki ${karyawan} (${rows.length} item):`;
        formattedData = formatCardData(rows, 'pemilik', 'kepemilikan_barang');
    } else if (type === 'total_harga_karyawan') {
        const karyawan = rows[0].nama_karyawan;
        const total = rows.reduce((sum, r) => sum + (r.harga_barang || 0), 0);
        const totalFormatted = new Intl.NumberFormat('id-ID').format(total);
        responseText = `Total harga barang yang dimiliki ${karyawan}: Rp ${totalFormatted} (${rows.length} item)`;
        formattedData = formatCardData(rows, 'pemilik', 'kepemilikan_barang');
    }

    return { success: true, response: responseText, data: formattedData };
}

function handleGuide(queryData) {
    const { context, role } = queryData;

    let responseText = '';
    let actionButtons = [];

    if (context === 'lelang' && role === 'admin') {
        responseText = `💬 Panduan Lelang Barang untuk Admin

👋 Halo, Admin! Berikut panduan langkah demi langkah dalam mengelola proses lelang barang di sistem:

1️⃣ Pengecekan Otomatis Barang
🧾 Barang furniture dengan masa pakai 5 tahun dan elektronik dengan masa pakai 3 tahun akan otomatis masuk ke menu "Barang Akan Dilelang."

2️⃣ Konfirmasi Barang Lelang
⚙️ Buka menu Manajemen Lelang → Barang Akan Dilelang.
Klik tombol Konfirmasi, lalu isi:
⏰ Waktu mulai dan selesai lelang
💰 Harga awal lelang
Setelah dikonfirmasi, barang akan dikirim ke role Atasan untuk disetujui.

3️⃣ Menunggu Persetujuan Atasan
🕓 Selama proses ini, status barang = Pending.
Admin belum bisa melelang barang sebelum atasan memberikan keputusan.

4️⃣ Jika Disetujui Atasan
✅ Barang akan otomatis pindah ke menu "Dalam Proses Lelang."
Admin dapat:
✏️ Mengubah waktu selesai atau harga lelang
🗑️ Menghapus barang dari daftar lelang
🏁 Menyelesaikan lelang saat sudah berakhir

5️⃣ Jika Ditolak Atasan
❌ Status barang = Rejected.
Admin memiliki dua pilihan:
🔄 Ajukan kembali: klik "Konfirmasi" ulang dan atur kembali waktu serta harga lelang.
🔙 Batalkan lelang: maka status barang akan kembali menjadi "Tersedia."`;

        actionButtons = [
            { text: '📋 Lihat Daftar Lelang', url: '/lelang' }
        ];
    } else if (context === 'sistem' && role === 'atasan') {
        responseText = `💬 Panduan Sistem untuk Atasan

👋 Halo, Atasan! Berikut panduan singkat penggunaan sistem Anda:

1️⃣ Akses Menu Sistem
📂 Atasan dapat melihat seluruh menu sistem, termasuk data barang, karyawan, dan lelang
Namun, atasan tidak dapat mengubah data — hanya bisa melihat informasi.

2️⃣ Persetujuan Barang Lelang
📑 Pada menu Persetujuan Lelang, akan tampil daftar barang yang telah diajukan oleh admin.
Atasan dapat melakukan dua tindakan:
✅ Menyetujui barang → Barang akan masuk ke tahap "Dalam Proses Lelang".
❌ Menolak barang → Status barang di role Admin akan berubah menjadi "Rejected" dan admin dapat mengajukan lelang kembali atau membatalkan lelang

3️⃣ Pencetakan Laporan
🖨️ Atasan juga dapat mencetak laporan barang sesuai kebutuhan, misalnya untuk rekap inventaris atau data lelang.

🎯 Kesimpulan:
Peran Atasan berfokus pada monitoring dan persetujuan, bukan pengelolaan data.
Dengan begitu, proses lelang tetap berjalan terkendali, transparan, dan efisien.`;

        actionButtons = [
            { text: '✅ Lihat Persetujuan Lelang', url: '/atasan/lelang' }
        ];
    } else if (context === 'lelang') {
        responseText = responses.helpResponse;
    } else if (context === 'sistem') {
        responseText = responses.helpResponse;
    } else {
        responseText = responses.helpResponse;
    }

    return { success: true, response: responseText, actionButtons };
}

function formatRankingCard(rows, rankingType, scope) {
    console.log(`🎯 formatRankingCard called: ${rows?.length || 0} rows, type: ${rankingType}, scope: ${scope}`);

    if (!rows || rows.length === 0) {
        console.log(`⚠️ No rows to format`);
        return null;
    }

    if (scope === 'lokasi') {
        console.log(`ℹ️ Location scope, returning null`);
        return null;
    }

    const rankedItems = rows.map((row, index) => ({
        ranking: index + 1,
        id_barang: row.id_barang,
        nama_barang: row.nama_barang,
        gambar: formatImageData(row.gambar_barang),
        harga_barang: row.harga_barang,
        lokasi_barang: row.lokasi_barang,
        status_barang: row.status_barang,
        kondisi_barang: row.kondisi_barang,
        jumlah: row.jumlah
    }));

    console.log(`✅ Formatted ${rankedItems.length} items for ranking card`);

    return {
        type: 'ranking',
        rankingType: rankingType,
        grouped: false,
        items: rankedItems
    };
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
    and: "dan",
    aggregationFallback: "Silakan sebutkan nama barang atau lokasi untuk perhitungan. Contoh: 'Total harga laptop' atau 'Rata-rata harga kursi'",
    rankingFallback: "Silakan sebutkan jenis ranking yang Anda inginkan. Contoh: 'Barang termahal' atau 'Top 5 termurah'",
    groupingFallback: "Silakan sebutkan cara pengelompokan. Contoh: 'Jumlah barang per lokasi' atau 'Barang yang dimiliki Mutiara'"
};

const intentStopwords = {
    'harga_barang': [
        'berapa', 'harga', 'brp', 'hrga', 'harganya', 'hargane',
        'rp', 'rupiah', 'biaya', 'ongkos', 'tarif', 'nilai',
        'untuk', 'dari', 'nya', 'kah', 'sih', 'dong', 'yak',
        'itu', 'ini', 'yang', 'apa', 'ya', 'deh', 'gan',
        'bos', 'min', 'kak', 'bang', 'mas', 'mbak', 'pak', 'bu',
        'coba', 'tolong', 'kasih', 'tau', 'tahu', 'info', 'informasi',
        'liat', 'lihat', 'tampilkan', 'tampilin', 'show', 'list', 'daftar'
    ],
    'lokasi_barang': [
        'di', 'mana', 'dimana', 'dmn', 'lokasi', 'ada', 'berada',
        'letak', 'posisi', 'lokasinya',
        'letaknya', 'adanya', 'keberadaan', 'untuk', 'dari',
        'nya', 'kah', 'sih', 'dong', 'yak', 'itu', 'ini',
        'yang', 'apa', 'ya', 'deh', 'gan', 'bos', 'min',
        'kak', 'bang', 'mas', 'mbak', 'pak', 'bu',
        'coba', 'tolong', 'kasih', 'tau', 'tahu', 'info',
        'liat', 'lihat', 'tampilkan', 'tampilin'
    ],
    'jumlah_barang': [
        'ada', 'berapa', 'brp', 'jumlah', 'banyak', 'byk',
        'total', 'unit', 'jumlahnya', 'banyaknya', 'totalnya',
        'qty', 'quantity', 'stock', 'stok', 'tersedia',
        'untuk', 'dari', 'nya', 'kah', 'sih', 'dong', 'yak',
        'itu', 'ini', 'yang', 'apa', 'ya', 'deh', 'gan',
        'bos', 'min', 'kak', 'bang', 'mas', 'mbak', 'pak', 'bu',
        'coba', 'tolong', 'kasih', 'tau', 'tahu',
        'liat', 'lihat', 'tampilkan', 'tampilin'
    ],
    'status_barang': [
        'status', 'kondisi', 'apa', 'bagaimana', 'gmn', 'gimana',
        'statusnya', 'kondisinya', 'keadaan', 'keadaannya',
        'situasi', 'situasinya', 'untuk', 'dari', 'nya',
        'kah', 'sih', 'dong', 'yak', 'itu', 'ini', 'yang',
        'ya', 'deh', 'gan', 'bos', 'min', 'kak', 'bang',
        'mas', 'mbak', 'pak', 'bu',
        'coba', 'tolong', 'kasih', 'tau', 'tahu'
    ],
    'kepemilikan_barang': [
        'siapa', 'pemilik', 'dimiliki', 'punya', 'yang', 'milik',
        'pemiliknya', 'punyanya', 'miliknya', 'empunya',
        'kepunyaan', 'untuk', 'dari', 'nya', 'kah', 'sih',
        'dong', 'yak', 'itu', 'ini', 'apa', 'ya', 'deh',
        'gan', 'bos', 'min', 'kak', 'bang', 'mas', 'mbak',
        'pak', 'bu', 'oleh',
        'coba', 'tolong', 'kasih', 'tau', 'tahu', 'barang'
    ]
};

const logger = {
    input(message) {
        console.log(`\nInput: "${message}"`);
    },
    detect(intent, confidence, entity) {
        const entityStr = entity ? `| Entity: ${entity}` : '| No entity';
        console.log(`Deteksi: ${intent} (${(confidence * 100).toFixed(0)}%) ${entityStr}`);
    },
    searchDirect(count) {
        console.log(`Pencarian: Direct → ${count} hasil`);
    },
    searchNoResults() {
        console.log(`Pencarian: Direct → 0 hasil`);
    },
    fuzzyAttempt() {
        console.log(`Menjalankan fuzzy matching`);
    },
    fuzzyResults(matches) {
        if (matches.length === 0) {
            console.log(`Fuzzy: Tidak ada (threshold: 65)`);
        } else {
            console.log(`Fuzzy: ${matches.length} ditemukan`);
            matches.slice(0, 3).forEach(m => {
                console.log(`   • ${m.nama} (score: ${m.score})`);
            });
        }
    },
    semanticAttempt() {
        console.log(`Menjalankan model semantik`);
    },
    semanticResults(matches) {
        if (matches.length === 0) {
            console.log(`Semantik: Tidak ada (threshold: ${SEMANTIC_THRESHOLD})`);
        } else {
            console.log(`Semantik: ${matches.length} ditemukan`);
            matches.slice(0, 3).forEach(m => {
                console.log(`   • ${m.nama} (similarity: ${m.score.toFixed(2)})`);
            });
        }
    },
    dbResults(rows, intent) {
        console.log(`Hasil: ${rows.length} items total`);
        if (rows.length > 0) {
            const displayCount = Math.min(5, rows.length);
            rows.slice(0, displayCount).forEach(row => {
                if (intent === 'kepemilikan_barang') {
                    console.log(`   • ${row.nama_barang} - ${row.nama_karyawan} (${row.jabatan})`);
                } else {
                    const price = row.harga_barang ? `(Rp ${row.harga_barang.toLocaleString('id-ID')})` : '';
                    console.log(`   • ${row.nama_barang} ${price}`);
                }
            });
            if (rows.length > displayCount) {
                console.log(`   ... dan ${rows.length - displayCount} item lainnya`);
            }
        }
    },
    output(response) {
        console.log(`Output: "${response}"\n`);
    },
    error(message) {
        console.log(`\nError: ${message}\n`);
    },
    helpRequest() {
        console.log(`Bantuan`);
    }
};

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

        logger.input(message);

        const lowerMessage = message.toLowerCase();
        const isHelpRequest = lowerMessage.includes('bantu') ||
            lowerMessage.includes('bantuan') ||
            lowerMessage.includes('tolong') ||
            lowerMessage.includes('help');

        // Intent: Bantuan
        if (isHelpRequest) {
            logger.helpRequest();
            logger.output(responses.helpResponse);

            return res.json({
                intent: 'bantuan',
                confidence: 1.0,
                entities: {},
                response: responses.helpResponse,
                ner_tokens: [],
                status: 'success'
            });
        }
    // Intent: Panduan (Guide)
    const userRole = req.session.email ? 'admin' : req.session.atasanEmail ? 'atasan' : 'guest';
        const guideQuery = detectGuideQuery(message, userRole);

        if (guideQuery) {
            console.log(`PANDUAN: ${guideQuery.context || 'umum'} (Role: ${guideQuery.role})`);
            const guideResult = handleGuide(guideQuery);

            logger.output(guideResult.response);

            return res.json({
                intent: 'panduan',
                confidence: 1.0,
                entities: {},
                response: guideResult.response,
                actionButtons: guideResult.actionButtons || [],
                suggestions: [],
                status: 'success'
            });
        }

        let responseData = null;

        const response = await axios.post(`${CHATBOT_API_URL}/predict`, {
            text: message
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000
        });

        let { intent, entities, response: botResponse, ner_tokens, confidence = 0 } = response.data;
        const queryContext = detectQueryContext(message, intent);
        if (queryContext.type && (intent === 'fallback' || intent === 'range_harga')) {
            console.log(`🔄 CONTEXT OVERRIDE: Model classify sebagai "${intent}", tapi detected context: ${queryContext.type}`);

            if (queryContext.type === 'ranking') {
                console.log(`🏆 RANKING OVERRIDE: ${queryContext.params.type} - Limit: ${queryContext.params.limit}`);

                const rankResult = await handleRanking(queryContext.params);

                if (rankResult.success) {
                    logger.output(rankResult.response);

                    let formattedData = null;
                    if (rankResult.scope === 'barang') {
                        formattedData = formatRankingCard(rankResult.rows, rankResult.rankingType, rankResult.scope);
                    } else if (rankResult.scope === 'lokasi') {
                        let details = '';
                        rankResult.rows.forEach((row, idx) => {
                            if (rankResult.rankingType === 'termahal') {
                                const hargaFormatted = new Intl.NumberFormat('id-ID').format(row.harga_tertinggi || 0);
                                details += `\n#${idx + 1} 📍 ${row.lokasi_barang}: Rp ${hargaFormatted} (${row.jumlah_barang} barang)`;
                            } else if (rankResult.rankingType === 'terbanyak') {
                                const totalFormatted = new Intl.NumberFormat('id-ID').format(row.total_harga || 0);
                                details += `\n#${idx + 1} 📍 ${row.lokasi_barang}: ${row.jumlah_barang} barang (Total: Rp ${totalFormatted})`;
                            }
                        });
                        rankResult.response += details;
                    }

                    return res.json({
                        intent: 'ranking',
                        confidence: 1.0,
                        entities: queryContext.params.entity ? { item: [queryContext.params.entity] } : {},
                        response: rankResult.response,
                        data: formattedData,
                        suggestions: [],
                        status: 'success'
                    });
                } else {
                    logger.output(rankResult.message);
                    return res.json({
                        intent: 'ranking',
                        confidence: 0.5,
                        entities: {},
                        response: rankResult.message,
                        suggestions: [{ icon: 'guide', text: 'Lihat Panduan', query: 'bantuan' }],
                        status: 'success'
                    });
                }
            }
            else if (queryContext.type === 'aggregation') {
                console.log(`🧮 AGGREGATION OVERRIDE: ${queryContext.params.type}`);

                const aggResult = await handleAggregation(queryContext.params);

                if (aggResult.success) {
                    logger.output(aggResult.response);
                    return res.json({
                        intent: 'agregasi',
                        confidence: 1.0,
                        entities: { item: queryContext.params.entity ? [queryContext.params.entity] : [] },
                        response: aggResult.response,
                        suggestions: [],
                        status: 'success'
                    });
                } else {
                    logger.output(aggResult.message);
                    return res.json({
                        intent: 'agregasi',
                        confidence: 0.5,
                        entities: {},
                        response: aggResult.message,
                        suggestions: [{ icon: 'guide', text: 'Lihat Panduan', query: 'bantuan' }],
                        status: 'success'
                    });
                }
            }
            else if (queryContext.type === 'grouping') {
                console.log(`📊 GROUPING OVERRIDE: ${queryContext.params.type}`);

                const groupResult = await handleGrouping(queryContext.params);

                if (groupResult.success) {
                    logger.output(groupResult.response);
                    return res.json({
                        intent: 'grouping',
                        confidence: 1.0,
                        entities: { item: queryContext.params.entity ? [queryContext.params.entity] : [] },
                        response: groupResult.response,
                        data: groupResult.data || null,
                        suggestions: [],
                        status: 'success'
                    });
                } else {
                    logger.output(groupResult.message);
                    return res.json({
                        intent: 'grouping',
                        confidence: 0.5,
                        entities: {},
                        response: groupResult.message,
                        suggestions: [{ icon: 'guide', text: 'Lihat Panduan', query: 'bantuan' }],
                        status: 'success'
                    });
                }
            }
        }
        let finalResponse = botResponse;
        let suggestions = [];

        const entityName = entities.item ? entities.item[0] : null;
        logger.detect(intent, confidence, entityName);

        // Intent: Kepemilikan Barang
        if (intent === 'kepemilikan_barang') {
            let itemName = entities.item ? entities.item[0] : null;

            if (!itemName) {
                const extracted = extractItemFromMessage(message, 'kepemilikan_barang');

                if (extracted.length >= 3) {
                    const fuzzyResults = await fuzzySearchBarang(extracted, 65);

                    if (fuzzyResults.length > 0) {
                        itemName = fuzzyResults[0].nama;
                    }
                }
            }

            if (queryContext.type === 'grouping') {
                console.log(`📊 GROUPING via kepemilikan_barang: ${queryContext.params.type}`);

                const groupResult = await handleGrouping(queryContext.params);

                if (groupResult.success) {
                    logger.output(groupResult.response);
                    return res.json({
                        intent: 'kepemilikan_barang',
                        confidence: 1.0,
                        entities,
                        response: groupResult.response,
                        data: groupResult.data || null,
                        suggestions: [],
                        status: 'success'
                    });
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
                    logger.searchDirect(rows.length);
                    logger.dbResults(rows, 'kepemilikan_barang');
                    finalResponse = `Ditemukan ${rows.length} barang ${itemName}:`;
                    responseData = formatCardData(rows, 'pemilik', 'kepemilikan_barang');
                } else {
                    logger.searchNoResults();
                    // Fuzzy Match
                    logger.fuzzyAttempt();

                    const fuzzyResults = await fuzzySearchBarang(itemName, 65);
                    logger.fuzzyResults(fuzzyResults);

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
                            logger.dbResults(allRows, 'kepemilikan_barang');
                            responseData = formatCardData(allRows, 'pemilik', 'kepemilikan_barang');
                        }
                    } else {
                        // Semantic Similarity
                        logger.semanticAttempt();

                        const semanticResults = await semanticSearchBarang(itemName);
                        logger.semanticResults(semanticResults);

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
                                logger.dbResults(allRows, 'kepemilikan_barang');
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

        // Intent: Harga Barang
        else if (intent === 'harga_barang') {
            let itemName = entities.item ? entities.item[0] : null;

            if (!itemName) {
                const extracted = extractItemFromMessage(message, 'harga_barang');
                if (extracted.length >= 3) {
                    const fuzzyResults = await fuzzySearchBarang(extracted, 65);
                    if (fuzzyResults.length > 0) {
                        itemName = fuzzyResults[0].nama;
                    }
                }
            }

            if (queryContext.type === 'aggregation') {
                console.log(`🧮 AGREGASI via harga_barang: ${queryContext.params.type}`);

                const aggResult = await handleAggregation(queryContext.params);

                if (aggResult.success) {
                    logger.output(aggResult.response);
                    return res.json({
                        intent: 'harga_barang',
                        confidence: 1.0,
                        entities,
                        response: aggResult.response,
                        suggestions: [],
                        status: 'success'
                    });
                } else {
                    logger.output(aggResult.message);
                    return res.json({
                        intent: 'harga_barang',
                        confidence: 0.5,
                        entities: {},
                        response: aggResult.message,
                        suggestions: [{ icon: 'guide', text: 'Lihat Panduan', query: 'bantuan' }],
                        status: 'success'
                    });
                }
            }
            else if (queryContext.type === 'ranking') {
                console.log(`🏆 RANKING via harga_barang: ${queryContext.params.type}`);

                const rankResult = await handleRanking(queryContext.params);

                if (rankResult.success) {
                    logger.output(rankResult.response);

                    let formattedData = null;
                    if (rankResult.scope === 'barang') {
                        formattedData = formatRankingCard(rankResult.rows, rankResult.rankingType, rankResult.scope);
                    } else if (rankResult.scope === 'lokasi') {
                        let details = '';
                        rankResult.rows.forEach((row, idx) => {
                            if (rankResult.rankingType === 'termahal') {
                                const hargaFormatted = new Intl.NumberFormat('id-ID').format(row.harga_tertinggi || 0);
                                details += `\n#${idx + 1} 📍 ${row.lokasi_barang}: Rp ${hargaFormatted} (${row.jumlah_barang} barang)`;
                            } else if (rankResult.rankingType === 'terbanyak') {
                                const totalFormatted = new Intl.NumberFormat('id-ID').format(row.total_harga || 0);
                                details += `\n#${idx + 1} 📍 ${row.lokasi_barang}: ${row.jumlah_barang} barang (Total: Rp ${totalFormatted})`;
                            }
                        });
                        rankResult.response += details;
                    }

                    return res.json({
                        intent: 'harga_barang',
                        confidence: 1.0,
                        entities,
                        response: rankResult.response,
                        data: formattedData,
                        suggestions: [],
                        status: 'success'
                    });
                } else {
                    logger.output(rankResult.message);
                    return res.json({
                        intent: 'harga_barang',
                        confidence: 0.5,
                        entities: {},
                        response: rankResult.message,
                        suggestions: [{ icon: 'guide', text: 'Lihat Panduan', query: 'bantuan' }],
                        status: 'success'
                    });
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
                    logger.searchDirect(rows.length);
                    logger.dbResults(rows, 'harga_barang');
                    finalResponse = `Ditemukan ${rows.length} barang ${itemName}:`;
                    responseData = formatCardData(rows, 'nama', 'harga_barang');
                } else {
                    logger.searchNoResults();
                    // Fuzzy Match
                    logger.fuzzyAttempt();

                    const fuzzyResults = await fuzzySearchBarang(itemName, 65);
                    logger.fuzzyResults(fuzzyResults);

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
                            logger.dbResults(allRows, 'harga_barang');
                            responseData = formatCardData(allRows, 'nama', 'harga_barang');
                        }
                    } else {
                        // Semantic Similarity
                        logger.semanticAttempt();

                        const semanticResults = await semanticSearchBarang(itemName);
                        logger.semanticResults(semanticResults);

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
                                logger.dbResults(allRows, 'harga_barang');
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

    // Intent: Range Harga
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
            console.log(`💰 RANGE: Mencari barang dengan harga ≤ Rp ${maxPrice.toLocaleString('id-ID')} (${displayStr})`);

            const [rows] = await db.query(
                `SELECT id_barang, nama_barang, harga_barang, status_barang, lokasi_barang, kondisi_barang, gambar_barang 
        FROM barang 
        WHERE harga_barang <= ? 
        ORDER BY harga_barang ASC`,
                [maxPrice]
            );

            if (rows.length > 0) {
                logger.dbResults(rows, 'range_harga');
                finalResponse = `Ditemukan ${rows.length} barang dengan harga di bawah ${displayStr}:`;
                responseData = formatCardData(rows, 'nama', 'range_harga');
            } else {
                finalResponse = `Tidak ada barang dengan harga di bawah ${displayStr}.`;
            }
        }

        // Intent: Jumlah Barang
        else if (intent === 'jumlah_barang') {
            let itemName = entities.item ? entities.item[0] : null;

            if (!itemName) {
                const extracted = extractItemFromMessage(message, 'jumlah_barang');

                if (extracted.length >= 3) {
                    const fuzzyResults = await fuzzySearchBarang(extracted, 65);

                    if (fuzzyResults.length > 0) {
                        itemName = fuzzyResults[0].nama;
                    }
                }
            }

            if (queryContext.type === 'grouping') {
                console.log(`📊 GROUPING via jumlah_barang: ${queryContext.params.type}`);

                const groupResult = await handleGrouping(queryContext.params);

                if (groupResult.success) {
                    logger.output(groupResult.response);
                    return res.json({
                        intent: 'jumlah_barang',
                        confidence: 1.0,
                        entities,
                        response: groupResult.response,
                        data: groupResult.data || null,
                        suggestions: [],
                        status: 'success'
                    });
                } else {
                    logger.output(groupResult.message);
                    return res.json({
                        intent: 'jumlah_barang',
                        confidence: 0.5,
                        entities: {},
                        response: groupResult.message,
                        suggestions: [{ icon: 'guide', text: 'Lihat Panduan', query: 'bantuan' }],
                        status: 'success'
                    });
                }
            }
            else if (queryContext.type === 'ranking') {
                console.log(`🏆 RANKING via jumlah_barang: ${queryContext.params.type}`);

                const rankResult = await handleRanking(queryContext.params);

                if (rankResult.success) {
                    logger.output(rankResult.response);

                    let formattedData = null;
                    if (rankResult.scope === 'barang') {
                        formattedData = formatRankingCard(rankResult.rows, rankResult.rankingType, rankResult.scope);
                    }

                    return res.json({
                        intent: 'jumlah_barang',
                        confidence: 1.0,
                        entities,
                        response: rankResult.response,
                        data: formattedData,
                        suggestions: [],
                        status: 'success'
                    });
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
                    logger.searchDirect(rows.length);
                    logger.dbResults(rows, 'jumlah_barang');
                    finalResponse = `Ditemukan ${rows.length} ${itemName}:`;
                    responseData = formatCardData(rows, 'nama', 'jumlah_barang');
                } else {
                    logger.searchNoResults();
                    // Fuzzy Match
                    logger.fuzzyAttempt();

                    const fuzzyResults = await fuzzySearchBarang(itemName, 65);
                    logger.fuzzyResults(fuzzyResults);

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
                            logger.dbResults(allRows, 'jumlah_barang');
                            responseData = formatCardData(allRows, 'nama', 'jumlah_barang');
                        }
                    } else {
                        // Semantic Similarity
                        logger.semanticAttempt();

                        const semanticResults = await semanticSearchBarang(itemName);
                        logger.semanticResults(semanticResults);

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
                                logger.dbResults(allRows, 'jumlah_barang');
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

        // Intent: Lokasi Barang
        else if (intent === 'lokasi_barang') {
            let itemName = entities.item ? entities.item[0] : null;

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
                    logger.searchDirect(rows.length);
                    logger.dbResults(rows, 'lokasi_barang');
                    finalResponse = `Ditemukan ${rows.length} barang ${itemName}:`;
                    responseData = formatCardData(rows, 'lokasi', 'lokasi_barang');
                } else {
                    logger.searchNoResults();
                    // Fuzzy Match
                    logger.fuzzyAttempt();

                    const fuzzyResults = await fuzzySearchBarang(itemName, 65);
                    logger.fuzzyResults(fuzzyResults);

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
                            logger.dbResults(allRows, 'lokasi_barang');
                            responseData = formatCardData(allRows, 'lokasi', 'lokasi_barang');
                        }
                    } else {
                        // Semantic Similarity
                        logger.semanticAttempt();

                        const semanticResults = await semanticSearchBarang(itemName);
                        logger.semanticResults(semanticResults);

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
                                logger.dbResults(allRows, 'lokasi_barang');
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

        // Intent: Status Barang
        else if (intent === 'status_barang') {
            let itemName = entities.item ? entities.item[0] : null;

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
                    logger.searchDirect(rows.length);
                    logger.dbResults(rows, 'status_barang');
                    finalResponse = `Status barang ${itemName} (${rows.length} item):`;
                    responseData = formatCardData(rows, 'status', 'status_barang');
                } else {
                    logger.searchNoResults();
                    // Fuzzy Match
                    logger.fuzzyAttempt();

                    const fuzzyResults = await fuzzySearchBarang(itemName, 65);
                    logger.fuzzyResults(fuzzyResults);

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
                            logger.dbResults(allRows, 'status_barang');
                            responseData = formatCardData(allRows, 'status', 'status_barang');
                        }
                    } else {
                        // Semantic Similarity
                        logger.semanticAttempt();

                        const semanticResults = await semanticSearchBarang(itemName);
                        logger.semanticResults(semanticResults);

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
                                logger.dbResults(allRows, 'status_barang');
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

        // Intent: Lelang Barang
        else if (intent === 'lelang_barang') {
            console.log(`Lelang: Mencari barang yang dilelang`);

            const [rows] = await db.query(
                `SELECT b.id_barang, b.nama_barang, b.kondisi_barang, b.status_barang, b.lokasi_barang, b.gambar_barang, l.harga_lelang as harga_barang, l.status_lelang, l.waktu_mulai, l.waktu_selesai
        FROM lelang l 
        JOIN barang b ON l.id_barang = b.id_barang 
        WHERE l.status_lelang IN ('sedang lelang', 'akan dimulai')
        ORDER BY l.waktu_mulai ASC`
            );

            if (rows.length > 0) {
                logger.dbResults(rows, 'lelang_barang');
                finalResponse = `Informasi Lelang Barang (${rows.length} item):`;
                responseData = formatCardData(rows, 'nama', 'lelang_barang');
            } else {
                console.log(`Hasil: 0 items`);
                finalResponse = `Tidak ada barang yang sedang atau akan dilelang saat ini.`;
            }
        }

        // Intent: Sapaan
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

            console.log(`HALO: ${sapa}`);
            finalResponse = `${sapa} ${responses.greetingResponse}`;
        }

        // Intent: Ucapan Terima Kasih
        else if (intent === 'ucapan_terima_kasih') {
            console.log(`MAKASIH`);
            finalResponse = responses.thanksResponse;
        }

    // Intent: Fallback
    else if (intent === 'fallback') {
            console.log(`Fallback: Intent tidak dikenali, mencoba fallback search`);

            try {
        // Fuzzy Match
        logger.fuzzyAttempt();
                const fuzzyResults = await fuzzySearchBarang(message, 65);
                logger.fuzzyResults(fuzzyResults);

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
                        logger.dbResults(allRows, 'fallback');
                        responseData = formatCardData(allRows, 'nama', 'fallback');
                    } else {
                        finalResponse = `${suggestionText} Namun data tidak ditemukan.`;
                    }
                } else {
                    // Semantic Similarity
                    logger.semanticAttempt();
                    const semanticResults = await semanticSearchBarang(message);
                    logger.semanticResults(semanticResults);

                    if (semanticResults.length > 0) {
                        const suggestionText = semanticResults.length > 1
                            ? `Berdasarkan kemiripan makna, mungkin Anda mencari: ${semanticResults.slice(0, 3).map(r => r.nama).join(', ')}?`
                            : `Berdasarkan kemiripan makna, mungkin Anda mencari "${semanticResults[0].nama}"?`;

                        finalResponse = `${suggestionText} Menampilkan semua hasil...`;

                        let allRows = [];
                        for (const match of semanticResults) {
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
                            logger.dbResults(allRows, 'fallback');
                            responseData = formatCardData(allRows, 'nama', 'fallback');
                        } else {
                            finalResponse = responses.fallbackGeneral;
                            suggestions = [{ icon: 'guide', text: 'Panduan', query: 'bantuan' }];
                        }
                    } else {
                        finalResponse = responses.fallbackGeneral;
                        suggestions = [{ icon: 'guide', text: 'Panduan', query: 'bantuan' }];
                    }
                }
            } catch (fallbackError) {
                console.error('Fallback fuzzy error:', fallbackError);
                finalResponse = responses.fallbackGeneral;
                suggestions = [{ icon: 'guide', text: 'Panduan', query: 'bantuan' }];
            }
        }

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

        if (intent !== 'fallback' && intent !== 'bantuan' && intent !== 'sapaan' && intent !== 'ucapan_terima_kasih') {
            suggestions = generateSuggestions(intent, entities);
        }

        logger.output(finalResponse);

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
        logger.error(error.message);

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