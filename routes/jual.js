const express = require('express');
const router = express.Router();
const db = require('../db.js');

router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10; // Parse limit from query params
        const offset = (page - 1) * limit;
        const searchQuery = req.query.search || '';

        let queryParams = [];
        let whereClause = 'WHERE status_barang = "jual"';

        if (searchQuery) {
            whereClause += ` AND (
                LOWER(id_barang) LIKE LOWER(?) OR 
                LOWER(nama_barang) LIKE LOWER(?) OR 
                LOWER(kategori) LIKE LOWER(?) OR 
                LOWER(lokasi_barang) LIKE LOWER(?)
            )`;
            queryParams = Array(4).fill(`%${searchQuery}%`);
        }

        const [countResult] = await db.pool.promise().query(
            `SELECT COUNT(*) as total FROM Barang ${whereClause}`,
            queryParams
        );

        const totalData = countResult[0].total;
        const totalPages = Math.ceil(totalData / limit);

        const [barang] = await db.pool.promise().query(
            `SELECT * FROM Barang ${whereClause} LIMIT ? OFFSET ?`,
            [...queryParams, limit, offset]
        );

        res.render('jual', {
            barang,
            currentPage: page,
            totalPages,
            totalData,
            limit,
            searchQuery,
            role: req.session.role || (req.session.atasanEmail ? 'atasan' : 'admin')
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Terjadi kesalahan server');
    }
});

router.post('/konfirmasi', async (req, res) => {
    const { idBarang, tanggalJual, hargaJual } = req.body;
    const conn = await db.pool.promise().getConnection();

    try {
        if (!idBarang || !tanggalJual || !hargaJual) {
            throw new Error('Data penjualan tidak lengkap');
        }

        if (isNaN(hargaJual) || hargaJual <= 0) {
            throw new Error('Harga jual tidak valid');
        }

        await conn.beginTransaction();

        const [barang] = await conn.query(
            'SELECT * FROM Barang WHERE id_barang = ?',
            [idBarang]
        );

        if (barang.length === 0) {
            throw new Error('Barang tidak ditemukan');
        }

        await conn.query(
            `INSERT INTO Penjualan (
                id_penjualan,
                id_barang,
                nama_barang,
                gambar_barang,
                deskripsi_barang,
                kategori,
                harga_jual,
                tanggal_keluar,
                status_penjualan
            ) VALUES (
                UUID(), ?, ?, ?, ?, ?, ?, ?, 'Jual'
            )`,
            [
                idBarang,
                barang[0].nama_barang,
                barang[0].gambar_barang,
                barang[0].deskripsi_barang,
                barang[0].kategori,
                hargaJual,
                tanggalJual
            ]
        );

        const deleteQueries = [
            'DELETE FROM Kepemilikan WHERE id_barang = ?',
            'DELETE FROM Lelang WHERE id_barang = ?',
            'DELETE FROM Notifikasi WHERE id_barang = ?',
            'DELETE FROM Barang WHERE id_barang = ?'
        ];

        for (const query of deleteQueries) {
            await conn.query(query, [idBarang]);
        }

        await conn.commit();
        res.json({
            success: true,
            message: 'Penjualan berhasil diproses'
        });

    } catch (error) {
        await conn.rollback();
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan saat memproses penjualan'
        });

    } finally {
        conn.release();
    }
});

module.exports = router;