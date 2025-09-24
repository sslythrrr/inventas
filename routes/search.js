const express = require('express');
const router = express.Router();
const db = require('../db.js');
const { requireLogin } = require('../routes/auth.js');

router.get('/', requireLogin, async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.json([]);
    }

    const searchPattern = `%${query}%`;

    const [results] = await db.query(`
        SELECT 
  'barang' as type,
  id_barang as id,
  nama_barang as title,
  CONCAT('/barang/', id_barang) as url,
  CONCAT('Kategori: ', COALESCE(kategori, '-'), ', Lokasi: ', COALESCE(lokasi_barang, '-'), ', Status: ', COALESCE(status_barang, '-')) as description
FROM Barang 
WHERE 
  LOWER(nama_barang) LIKE LOWER(?) OR 
  LOWER(id_barang) LIKE LOWER(?) OR
  LOWER(COALESCE(kategori, '')) LIKE LOWER(?) OR
  LOWER(COALESCE(lokasi_barang, '')) LIKE LOWER(?) OR
  LOWER(COALESCE(status_barang, '')) LIKE LOWER(?)
UNION ALL
SELECT 
  'karyawan' as type,
  id_karyawan as id,
  nama_karyawan as title,
  CONCAT('/karyawan/', id_karyawan) as url,
  jabatan as description
FROM Karyawan
WHERE 
  LOWER(nama_karyawan) LIKE LOWER(?) OR
  LOWER(id_karyawan) LIKE LOWER(?) OR
  LOWER(COALESCE(jabatan, '')) LIKE LOWER(?)
LIMIT 10
      `, Array(8).fill(searchPattern));

    res.json(results);

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;