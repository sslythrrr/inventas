const express = require('express');
const router = express.Router();
const db = require('../db.js');
const { requireLogin } = require('./auth.js');

router.get('/', requireLogin, async (req, res) => {
  const connection = await db.getConnection();
  try {
    let page = req.query.page ? parseInt(req.query.page) : 1;
    let limit = req.query.limit ? parseInt(req.query.limit) : 10;
    let offset = (page - 1) * limit;

    let sortField = req.query.sort || 'tanggal_keluar';
    let sortOrder = req.query.order || 'DESC';

    const allowedSortFields = ['tanggal_keluar', 'nama_barang', 'id_penjualan', 'kategori', 'harga_jual', 'status_penjualan'];
    if (!allowedSortFields.includes(sortField)) {
      sortField = 'tanggal_keluar';
    }

    if (!['ASC', 'DESC'].includes(sortOrder.toUpperCase())) {
      sortOrder = 'DESC';
    }

    let searchQuery = req.query.search || '';
    let queryParams = [];

    let whereClause = '';
    if (searchQuery) {
      whereClause = `WHERE 
          LOWER(p.nama_barang) LIKE LOWER(?) OR 
          LOWER(p.id_penjualan) LIKE LOWER(?) OR
          LOWER(COALESCE(p.kategori, '')) LIKE LOWER(?) OR
          LOWER(COALESCE(p.status_penjualan, '')) LIKE LOWER(?)`;
      queryParams = Array(4).fill(`%${searchQuery}%`);
    }

    const [countResult] = await connection.query(`
        SELECT COUNT(*) AS total 
        FROM penjualan p
        ${whereClause}
      `, queryParams);

    let totalData = countResult[0].total;
    let totalPages = Math.ceil(totalData / limit);

    const [rows] = await connection.query(`
        SELECT 
            p.id_penjualan,
            p.id_barang,
            p.nama_barang,
            p.gambar_barang,
            p.kategori,
            p.harga_jual,
            p.tanggal_keluar,
            p.status_penjualan
        FROM penjualan p
        ${whereClause}
        ORDER BY p.${sortField} ${sortOrder}
        LIMIT ? OFFSET ?
      `, [...queryParams, limit, offset]);

    res.render('penjualan', {
      penjualan: rows,
      currentPage: page,
      totalPages: totalPages,
      totalData: totalData,
      limit: limit,
      tanggal: tanggal,
      searchQuery: searchQuery,
      sortField: sortField,
      sortOrder: sortOrder,
      role: req.session.role || (req.session.atasanEmail ? 'atasan' : 'admin')
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Internal Server Error');
  } finally {
    connection.release();
  }
});

const tanggal = {
  formatDate(date) {
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(date));
  },
};

router.get('/:id', async (req, res) => {
  const { id } = req.params;
    const connection = await db.getConnection();

    try {
        const [rows] = await connection.query(`
            SELECT 
                id_penjualan,
                id_barang,
                nama_barang,
                gambar_barang,
                deskripsi_barang,
                kategori,
                harga_jual,
                tanggal_keluar,
                status_penjualan
            FROM Penjualan
            WHERE id_penjualan = ?
        `, [id]);

        if (rows.length > 0) {
            const data = rows[0];
            
            if (data.gambar_barang) {
                data.gambar_barang = Buffer.from(data.gambar_barang).toString('base64');
            }

            res.json(data);
        } else {
            res.status(404).json({ error: 'Barang tidak ditemukan' });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    } finally {
        connection.release();
    }
});

module.exports = router;