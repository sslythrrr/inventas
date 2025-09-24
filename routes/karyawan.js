const express = require('express');
const router = express.Router();
const db = require('../db.js');
const { requireLogin } = require('../routes/auth.js');

router.post('/', requireLogin, async (req, res) => {
    try {
        const { id_karyawan, nama_karyawan, jabatan, jenis_kelamin } = req.body;

        if (!id_karyawan || !nama_karyawan || !jabatan || !jenis_kelamin) {
            return res.status(400).json({ success: false, message: 'Semua field harus diisi' });
        }

        const [result] = await db.query(`
            INSERT INTO karyawan (id_karyawan, nama_karyawan, jabatan, jenis_kelamin)
            VALUES (?, ?, ?, ?)
        `, [id_karyawan, nama_karyawan, jabatan, jenis_kelamin]);

        if (result.affectedRows > 0) {
            res.json({ success: true, message: 'Karyawan berhasil ditambahkan' });
        } else {
            res.status(400).json({ success: false, message: 'Gagal menambahkan karyawan' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Terjadi kesalahan saat menambahkan karyawan', error: error.message });
    }
});

router.post('/edit', requireLogin, async (req, res) => {
    try {
        const { id_karyawan, nama_karyawan, jabatan, jenis_kelamin, status_karyawan } = req.body;

        const [result] = await db.query(`
            UPDATE karyawan 
            SET nama_karyawan = ?, jabatan = ?, jenis_kelamin = ?, status_karyawan = ?
            WHERE id_karyawan = ?
        `, [nama_karyawan, jabatan, jenis_kelamin, status_karyawan, id_karyawan]);

        if (result.affectedRows > 0) {
            res.json({ success: true, message: 'Data karyawan berhasil diperbarui' });
        } else {
            res.status(400).json({ success: false, message: 'Gagal memperbarui data karyawan' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Terjadi kesalahan saat memperbarui data' });
    }
});

router.get('/delete/:id_karyawan', requireLogin, async (req, res) => {
    const id_karyawan = req.params.id_karyawan;

    try {
        await db.query('START TRANSACTION');
        const [karyawanResult] = await db.query('SELECT nama_karyawan FROM karyawan WHERE id_karyawan = ?', [id_karyawan]);

        if (!karyawanResult || karyawanResult.length === 0) {
            await db.query('ROLLBACK');
            return res.redirect('/karyawan');
        }

        await db.query('DELETE FROM kepemilikan WHERE id_karyawan = ?', [id_karyawan]);
        await db.query('DELETE FROM karyawan WHERE id_karyawan = ?', [id_karyawan]);

        await db.query('COMMIT');
        res.json({
            success: true,
            message: 'Karyawan berhasil dihapus'
        });
    } catch (error) {
        console.error("Error saat menghapus karyawan:", error);
        await db.query('ROLLBACK');
        res.redirect('/karyawan');
    }
});


router.get('/detail/:id', requireLogin, async (req, res) => {
    try {
        const id_karyawan = req.params.id;
        const [rows] = await db.query('SELECT * FROM karyawan WHERE id_karyawan = ?', [id_karyawan]);

        if (rows.length > 0) {
            res.json({ success: true, data: rows[0] });
        } else {
            res.status(404).json({ success: false, message: 'Data karyawan tidak ditemukan' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Terjadi kesalahan saat mengambil data' });
    }
});

router.get('/refresh', requireLogin, async (req, res) => {
    let page = req.query.page ? parseInt(req.query.page) : 1;
    let limit = 10;
    let offset = (page - 1) * limit;
    let searchQuery = req.query.search || '';
    let queryParams = [];

    let whereClause = '';
    if (searchQuery) {
        whereClause = `WHERE 
            LOWER(id_karyawan) LIKE LOWER(?) OR 
            LOWER(nama_karyawan) LIKE LOWER(?) OR
            LOWER(jabatan) LIKE LOWER(?) OR
            LOWER(jenis_kelamin) LIKE LOWER(?)`;
        queryParams = Array(4).fill(`%${searchQuery}%`);
    }

    try {
        const [countResult] = await db.query(`
            SELECT COUNT(*) AS total 
            FROM karyawan 
            ${whereClause}
        `, queryParams);

        let totalData = countResult[0].total;
        let totalPages = Math.ceil(totalData / limit);

        const [rows] = await db.query(`
            SELECT id_karyawan, nama_karyawan, jabatan, jenis_kelamin 
            FROM karyawan 
            ${whereClause}
            LIMIT ? OFFSET ?`,
            [...queryParams, limit, offset]
        );

        res.render('karyawan', {
            karyawan: rows,
            currentPage: page,
            totalPages: totalPages,
            totalData: totalData,
            limit: limit,
            searchQuery: searchQuery,
            role: req.session.role || (req.session.atasanEmail ? 'atasan' : 'admin')
        });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Terjadi kesalahan database');
    }
});

router.get('/', requireLogin, async (req, res) => {
    let page = req.query.page ? parseInt(req.query.page) : 1;
    let limit = req.query.limit ? parseInt(req.query.limit) : 10;
    let offset = (page - 1) * limit;
    let searchQuery = req.query.search || '';
    let queryParams = [];

    let whereClause = '';
    if (searchQuery) {
        whereClause = `WHERE 
            LOWER(id_karyawan) LIKE LOWER(?) OR 
            LOWER(nama_karyawan) LIKE LOWER(?) OR
            LOWER(jabatan) LIKE LOWER(?) OR
            LOWER(jenis_kelamin) LIKE LOWER(?)`;
        queryParams = Array(4).fill(`%${searchQuery}%`);
    }

    try {
        const [countResult] = await db.query(`
            SELECT COUNT(*) AS total 
            FROM karyawan 
            ${whereClause}
        `, queryParams);

        let totalData = countResult[0].total;
        let totalPages = Math.ceil(totalData / limit);

        const [rows] = await db.query(`
            SELECT id_karyawan, nama_karyawan, jabatan, jenis_kelamin 
            FROM karyawan 
            ${whereClause}
            LIMIT ? OFFSET ?`,
            [...queryParams, limit, offset]
        );

        res.render('karyawan', {
            karyawan: rows,
            currentPage: page,
            totalPages: totalPages,
            totalData: totalData,
            limit: limit,
            searchQuery: searchQuery,
            role: req.session.role || (req.session.atasanEmail ? 'atasan' : 'admin')
        });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Terjadi kesalahan database');
    }
});

module.exports = router;
