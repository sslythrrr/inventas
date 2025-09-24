const express = require('express');
const router = express.Router();
const db = require('../db.js');
const { requireLogin } = require('../routes/auth.js');

router.get('/',requireLogin, async (req, res) => {
  let searchQuery = req.query.search || '';
  let queryParams = [];
  
  let whereClause = '';
  if (searchQuery) {
      whereClause = `AND (
          LOWER(b.id_barang) LIKE LOWER(?) OR 
          LOWER(b.nama_barang) LIKE LOWER(?)
      )`;
      queryParams = Array(2).fill(`%${searchQuery}%`);
  }

  try {
      const [akanLelang] = await db.query(`
          SELECT b.id_barang, b.nama_barang, b.harga_barang, b.status_barang, l.status_konfirmasi_atasan
          FROM Barang b
          JOIN Lelang l ON b.id_barang = l.id_barang
          WHERE (b.status_barang = 'lelang' OR b.status_barang = 'diproses atasan' OR b.status_barang = 'ditolak atasan')
          ${whereClause}
      `, queryParams);

      const [prosesLelang] = await db.query(`
          SELECT b.id_barang, b.nama_barang, 
                 l.harga_lelang, l.waktu_mulai, l.waktu_selesai
          FROM Lelang l
          JOIN Barang b ON l.id_barang = b.id_barang
          WHERE l.status_lelang = 'sedang lelang'
          ${whereClause}
      `, queryParams);

      res.render('lelang', {
          akanLelang,
          prosesLelang,
          searchQuery: searchQuery,
          role: req.session.role || (req.session.atasanEmail ? 'atasan' : 'admin')
      });
  } catch (error) {
      console.error('Error fetching auction data:', error);
      res.status(500).send('Failed to load auction page');
  }
});

router.post('/konfirmasi-lelang/:id_barang',requireLogin, async (req, res) => {
  const { id_barang } = req.params;
  const { waktu_mulai, waktu_selesai, harga_lelang } = req.body;
  const hargalelang = parseInt(harga_lelang, 10);

  try {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      await connection.query(`
        UPDATE Barang 
        SET status_barang = 'diproses atasan',
            harga_barang = ?
        WHERE id_barang = ?
      `, [hargalelang, id_barang]);

      // await connection.query(`
      //   UPDATE Lelang 
      //   SET harga_lelang = ?, status_lelang = 'sedang lelang', waktu_mulai = ?, waktu_selesai = ?
      //   WHERE id_barang = ?
      // `, [hargalelang, waktu_mulai, waktu_selesai, id_barang]);

      await connection.query(`
        UPDATE Lelang 
        SET harga_lelang = ?, waktu_mulai = ?, waktu_selesai = ?
        WHERE id_barang = ?
      `, [hargalelang, waktu_mulai, waktu_selesai, id_barang]);


      await connection.commit();
      res.json({
        success: true,
        message: 'Lelang berhasil dikonfirmasi'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error konfirmasi lelang:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengkonfirmasi lelang'
    });
  }
});

router.post('/edit-lelang/:id_barang',requireLogin, async (req, res) => {
  const { id_barang } = req.params;
  const { waktu_selesai, harga_lelang } = req.body;

  try {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();
      await connection.query(`
        UPDATE Barang 
        SET harga_barang = ?
        WHERE id_barang = ?
      `, [harga_lelang, id_barang]);

      await connection.query(`
        UPDATE Lelang 
        SET waktu_selesai = ?,
            harga_lelang = ?
        WHERE id_barang = ? AND status_lelang = 'sedang lelang'
      `, [waktu_selesai, harga_lelang, id_barang]);

      await connection.commit();
      res.json({
        success: true,
        message: 'Lelang berhasil diperbarui'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error memperbarui lelang:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal memperbarui lelang'
    });
  }
});

router.post('/selesai-lelang/:id_barang',requireLogin, async (req, res) => {
  const { id_barang } = req.params;

  try {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const [lelangData] = await connection.query(
        'SELECT * FROM Lelang WHERE id_barang = ?',
        [id_barang]
      );

      const [barangData] = await connection.query(
        'SELECT * FROM Barang WHERE id_barang = ?',
        [id_barang]
      );

      if (lelangData.length === 0 || barangData.length === 0) {
        throw new Error('Data tidak ditemukan');
      }

      await connection.query(`
        INSERT INTO Penjualan (
          id_penjualan, id_barang, nama_barang, gambar_barang, 
          deskripsi_barang, kategori, harga_jual, 
          tanggal_keluar, status_penjualan
        )
        VALUES (
          UUID(), ?, ?, ?, ?, ?, ?, 
          NOW(), 'Lelang'
        )
      `, [
        barangData[0].id_barang,
        barangData[0].nama_barang,
        barangData[0].gambar_barang,
        barangData[0].deskripsi_barang,
        barangData[0].kategori,
        lelangData[0].harga_lelang
      ]);

      await connection.query(`
        DELETE FROM Notifikasi 
        WHERE id_barang = ?
      `, [id_barang]);

      await connection.query(`
        DELETE FROM Lelang 
        WHERE id_barang = ?
      `, [id_barang]);

      await connection.query(`
        DELETE FROM Kepemilikan 
        WHERE id_barang = ?
      `, [id_barang]);

      await connection.query(`
        DELETE FROM Barang 
        WHERE id_barang = ?
      `, [id_barang]);

      await connection.commit();
      res.json({
        success: true,
        message: 'Lelang berhasil diselesaikan'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error menyelesaikan lelang:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal menyelesaikan lelang'
    });
  }
});

router.post('/hapus-lelang/:id_barang',requireLogin, async (req, res) => {
  const { id_barang } = req.params;

  try {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const [lelangData] = await connection.query(
        'SELECT id_barang FROM Lelang WHERE id_barang = ?',
        [id_barang]
      );

      if (lelangData.length === 0) {
        throw new Error('Lelang tidak ditemukan');
      }

      await connection.query(`
        UPDATE Barang 
        SET status_barang = 'lelang'
        WHERE id_barang = ?
      `, [id_barang]);

      await connection.query(`
        UPDATE Lelang
        SET status_lelang = 'akan lelang'
        WHERE id_barang = ?
      `, [id_barang]);

      await connection.commit();
      res.json({
        success: true,
        message: 'Lelang berhasil dihapus'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error menghapus lelang:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal menghapus lelang'
    });
  }
});

router.post('/batal-lelang/:id_barang',requireLogin, async (req, res) => {
  const { id_barang } = req.params;

  try {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const [lelangData] = await connection.query(
        'SELECT id_barang FROM Lelang WHERE id_barang = ?',
        [id_barang]
      );

      if (lelangData.length === 0) {
        throw new Error('Lelang tidak ditemukan');
      }

      await connection.query(`
        UPDATE Barang 
        SET status_barang = 'tersedia'
        WHERE id_barang = ?
      `, [id_barang]);

      await connection.query(`
        DELETE from Lelang
        WHERE id_barang = ?
      `, [id_barang]);

      await connection.commit();
      res.json({
        success: true,
        message: 'Lelang berhasil dibatalkan'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error batal lelang:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal batal lelang'
    });
  }
});


module.exports = router;