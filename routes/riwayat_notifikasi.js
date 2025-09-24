const express = require('express');
const router = express.Router();
const db = require('../db.js');
const { requireLogin } = require('../routes/auth.js');

router.get('/', requireLogin, async (req, res) => {
    let page = req.query.page ? parseInt(req.query.page) : 1;
    let limit = req.query.limit ? parseInt(req.query.limit) : 10;
    let offset = (page - 1) * limit;

    try {
        const [countResult] = await db.query('SELECT COUNT(*) AS total FROM Notifikasi');
        let totalData = countResult[0].total;
        let totalPages = Math.ceil(totalData / limit);

        const [notifications] = await db.query(`
            SELECT 
                waktu_dibuat,
                id_barang,
                tipe_notifikasi,
                pesan
            FROM Notifikasi
            ORDER BY waktu_dibuat DESC 
            LIMIT ? OFFSET ?
        `, [limit, offset]);

        res.render('riwayat_notifikasi', {
            notifications,
            currentPage: page,
            totalPages: totalPages,
            totalData: totalData,
            limit: limit,
            role: req.session.role || (req.session.atasanEmail ? 'atasan' : 'admin')
        });

    } catch (err) {
        console.error('Error fetching notifications:', err);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;