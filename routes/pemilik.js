const express = require('express');
const router = express.Router();
const db = require('../db.js');
const { requireLogin } = require('../routes/auth.js');

router.get('/', requireLogin, async (req, res) => {
    try {
        let page = req.query.page ? parseInt(req.query.page) : 1;
        let limit = req.query.limit ? parseInt(req.query.limit) : 10;
        let offset = (page - 1) * limit;

        let sortField = req.query.sort || 'tanggal_perolehan';
        let sortOrder = req.query.order || 'DESC';

        const allowedSortFields = ['tanggal_perolehan', 'id_barang', 'id_karyawan'];
        if (!allowedSortFields.includes(sortField)) {
            sortField = 'tanggal_perolehan';
        }
        
        if (!['ASC', 'DESC'].includes(sortOrder.toUpperCase())) {
            sortOrder = 'DESC';
        }
        let searchQuery = req.query.search || '';
        let queryParams = [];

        let whereClause = '';
        if (searchQuery) {
            whereClause = `WHERE 
                LOWER(b.id_barang) LIKE LOWER(?) OR 
                LOWER(b.nama_barang) LIKE LOWER(?) OR
                LOWER(k1.id_karyawan) LIKE LOWER(?) OR
                LOWER(k1.nama_karyawan) LIKE LOWER(?) OR
                LOWER(k2.nama_karyawan) LIKE LOWER(?)`;
            queryParams = Array(5).fill(`%${searchQuery}%`);
        }

        const [countResult] = await db.query(`
            SELECT COUNT(*) AS total 
            FROM (
                SELECT b.id_barang
                FROM Barang b
                INNER JOIN (
                    SELECT id_barang, id_karyawan
                    FROM Kepemilikan
                    WHERE status_kepemilikan = 'aktif'
                ) current_own ON b.id_barang = current_own.id_barang
                LEFT JOIN Karyawan k1 ON current_own.id_karyawan = k1.id_karyawan
                LEFT JOIN (
                    SELECT k.id_barang, k.id_karyawan
                    FROM Kepemilikan k
                    WHERE k.status_kepemilikan = 'tidak aktif'
                    AND k.tanggal_perolehan = (
                        SELECT MAX(k3.tanggal_perolehan)
                        FROM Kepemilikan k3
                        WHERE k3.id_barang = k.id_barang 
                        AND k3.status_kepemilikan = 'tidak aktif'
                        AND k3.id_karyawan != (
                            SELECT id_karyawan 
                            FROM Kepemilikan 
                            WHERE id_barang = k.id_barang 
                            AND status_kepemilikan = 'aktif'
                        )
                    )
                ) prev_own ON b.id_barang = prev_own.id_barang
                LEFT JOIN Karyawan k2 ON prev_own.id_karyawan = k2.id_karyawan
                ${whereClause}
            ) as subquery
        `, queryParams);

        let totalData = countResult[0].total;
        let totalPages = Math.ceil(totalData / limit);

        const [rows] = await db.query(`
            SELECT 
                b.id_barang,
                b.nama_barang,
                k1.nama_karyawan AS pemilik_sekarang,
                k1.id_karyawan AS id_pemilik_sekarang,
                k2.nama_karyawan AS pemilik_sebelumnya
            FROM Barang b
            INNER JOIN (
    SELECT id_barang, id_karyawan, tanggal_perolehan
    FROM Kepemilikan
    WHERE status_kepemilikan = 'aktif'
) current_own ON b.id_barang = current_own.id_barang

            LEFT JOIN Karyawan k1 ON current_own.id_karyawan = k1.id_karyawan
            LEFT JOIN (
                SELECT k.id_barang, k.id_karyawan
                FROM Kepemilikan k
                WHERE k.status_kepemilikan = 'tidak aktif'
                AND k.tanggal_perolehan = (
                    SELECT MAX(k3.tanggal_perolehan)
                    FROM Kepemilikan k3
                    WHERE k3.id_barang = k.id_barang 
                    AND k3.status_kepemilikan = 'tidak aktif'
                    AND k3.id_karyawan != (
                        SELECT id_karyawan 
                        FROM Kepemilikan 
                        WHERE id_barang = k.id_barang 
                        AND status_kepemilikan = 'aktif'
                    )
                )
            ) prev_own ON b.id_barang = prev_own.id_barang
            LEFT JOIN Karyawan k2 ON prev_own.id_karyawan = k2.id_karyawan
            ${whereClause}
             ORDER BY current_own.${sortField} ${sortOrder}
        LIMIT ? OFFSET ?
      `, [...queryParams, limit, offset]);

        res.render('pemilik', {
            kepemilikan: rows,
            currentPage: page,
            totalPages: totalPages,
            totalData: totalData,
            limit: limit,
            searchQuery: searchQuery,
            sortField: sortField,
            sortOrder: sortOrder,
            role: req.session.role || (req.session.atasanEmail ? 'atasan' : 'admin')
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

router.get('/histori-kepemilikan/:idBarang', requireLogin, async (req, res) => {
    try {
        const [histori] = await db.query(`
      WITH RankedKepemilikan AS (
          SELECT 
              k.tanggal_perolehan,
              k.id_karyawan,
              kr.nama_karyawan,
              k.status_kepemilikan,
              ROW_NUMBER() OVER (PARTITION BY k.id_karyawan ORDER BY k.tanggal_perolehan DESC) as rn
          FROM Kepemilikan k
          JOIN Karyawan kr ON k.id_karyawan = kr.id_karyawan
          WHERE k.id_barang = ?
      )
      SELECT 
          tanggal_perolehan,
          nama_karyawan,
          status_kepemilikan
      FROM RankedKepemilikan
      WHERE rn = 1
      ORDER BY tanggal_perolehan DESC
    `, [req.params.idBarang]);

        res.json(histori);
    } catch (error) {
        console.error('Error fetching ownership history:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
