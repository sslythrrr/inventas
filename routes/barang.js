const express = require('express');
const router = express.Router();
const db = require('../db.js');
const multer = require('multer');
const sharp = require('sharp');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const { requireLogin } = require('../routes/auth.js');

async function compressImage(buffer, { format = 'jpeg', quality = 80, width = 500 }) {
  return await sharp(buffer)
    .resize({ width })
    .toFormat(format, { quality })
    .toBuffer();
}

async function logAdminActivity(connection, req, jenis_aktivitas, detail_perubahan) {
  try {
    const logQuery = `
          INSERT INTO Log_Aktivitas(timestamp, id_admin, jenis_aktivitas, detail_perubahan) 
          VALUES (NOW(), ?, ?, ?)
      `;
    await connection.query(logQuery, [req.adminId, jenis_aktivitas, detail_perubahan]);
  } catch (error) {
    console.error('Error logging admin activity:', error);
    throw error;
  }
}

router.post('/', requireLogin, upload.single('gambar_barang'), async (req, res) => {
  const connection = await db.getConnection();
  try {
    const {
      id_barang,
      nama_barang,
      deskripsi_barang,
      kategori,
      lokasi_barang,
      harga_barang,
      kondisi_barang,
      status_barang,
      id_karyawan,
      waktu_masuk
    } = req.body;

    const format_harga_barang = parseInt(harga_barang.replace(/[^0-9]/g, ''), 10);
    let gambar_barang = null;

    if (req.file) {
      gambar_barang = await compressImage(req.file.buffer, {
        format: 'jpeg',
        quality: 80,
        width: 500
      });
    }

    await connection.beginTransaction();

    const query = `
      INSERT INTO barang (
        id_barang, nama_barang, kategori, lokasi_barang, harga_barang,
        kondisi_barang, status_barang, deskripsi_barang, gambar_barang, waktu_masuk
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await connection.query(query, [
      id_barang, nama_barang, kategori, lokasi_barang, format_harga_barang,
      kondisi_barang, status_barang, deskripsi_barang, gambar_barang, waktu_masuk
    ]);

    const kepemilikanQuery = `
      INSERT INTO kepemilikan (id_barang, id_karyawan, tanggal_perolehan, status_kepemilikan)
      VALUES (?, ?, NOW(), 'aktif')
    `;

    await connection.query(kepemilikanQuery, [id_barang, id_karyawan]);

    await logAdminActivity(
      connection,
      req,
      'TAMBAH BARANG',
      `Menambahkan barang: (${id_barang})${nama_barang}`
    );

    if (status_barang === 'lelang') {
      const lelangQuery = `
        INSERT INTO lelang (id_barang, status_lelang)
        VALUES (?, 'akan lelang')
      `;

      await connection.query(lelangQuery, [id_barang]);
    }

    await connection.commit();
    res.json({
      success: true,
      message: status_barang === 'lelang' ?
        'Barang, kepemilikan, dan lelang berhasil ditambahkan' :
        'Barang dan kepemilikan berhasil ditambahkan'
    });

  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: 'Terjadi kesalahan saat menambahkan barang' });
  } finally {
    connection.release();
  }
});

router.get('/detail/:id', requireLogin, async (req, res) => {
  const connection = await db.getConnection();
  try {
    const id_barang = req.params.id;
    const query = `
      SELECT b.id_barang, b.nama_barang, b.deskripsi_barang, 
             b.kategori, b.kondisi_barang, b.lokasi_barang, b.harga_barang, 
             b.status_barang, b.gambar_barang, b.kondisi_barang, b.waktu_masuk,
             k.tanggal_perolehan, 
             kar.nama_karyawan, kar.id_karyawan,
             l.status_lelang, l.waktu_mulai, l.waktu_selesai
      FROM barang b
      LEFT JOIN kepemilikan k ON b.id_barang = k.id_barang AND k.status_kepemilikan = 'aktif'
      LEFT JOIN karyawan kar ON k.id_karyawan = kar.id_karyawan
      LEFT JOIN lelang l ON b.id_barang = l.id_barang
      WHERE b.id_barang = ?
    `;

    const [result] = await connection.query(query, [id_barang]);

    if (result.length === 0) {
      return res.json({
        success: false,
        message: 'Barang tidak ditemukan'
      });
    }

    if (result[0].gambar_barang) {
      result[0].gambar_barang = result[0].gambar_barang.toString('base64');
    }

    res.json({
      success: true,
      data: result[0]
    });
  } catch (error) {
    console.error('Error:', error);
    res.json({
      success: false,
      message: error.message
    });
  } finally {
    connection.release();
  }
});

router.post('/edit', requireLogin, upload.single('gambar_barang'), async (req, res) => {
  const connection = await db.getConnection();
  try {
    const {
      id_barang,
      nama_barang,
      deskripsi_barang,
      kategori,
      lokasi_barang,
      harga_barang,
      status_barang,
      kondisi_barang,
      id_karyawan
    } = req.body;

    if (!id_barang || !nama_barang) {
      return res.status(400).json({
        success: false,
        message: 'ID Barang dan Nama Barang wajib diisi'
      });
    }

    const [originalItem] = await connection.query(
      'SELECT b.*, k1.*, k2.nama_karyawan FROM barang b JOIN kepemilikan k1 ON b.id_barang = k1.id_barang JOIN karyawan k2 ON k1.id_karyawan = k2.id_karyawan WHERE b.id_barang = ?',
      [id_barang]
    );

    if (!originalItem || originalItem.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Barang tidak ditemukan'
      });
    }

    const format_harga_barang = parseInt(harga_barang.replace(/[^0-9]/g, ''), 10);
    if (isNaN(format_harga_barang)) {
      return res.status(400).json({
        success: false,
        message: 'Format harga tidak valid'
      });
    }

    let gambar_barang = null;
    if (req.file) {
      gambar_barang = await compressImage(req.file.buffer, {
        format: 'jpeg',
        quality: 80,
        width: 500
      });
    }

    await connection.beginTransaction();

    // Prepare update query
    let updateBarangQuery = `
      UPDATE barang 
      SET nama_barang = ?,
          deskripsi_barang = ?,
          kategori = ?,
          lokasi_barang = ?,
          harga_barang = ?,
          status_barang = ?,
          kondisi_barang = ?
    `;
    let updateBarangValues = [
      nama_barang,
      deskripsi_barang,
      kategori,
      lokasi_barang,
      format_harga_barang,
      status_barang,
      kondisi_barang
    ];

    if (gambar_barang) {
      updateBarangQuery += ', gambar_barang = ?';
      updateBarangValues.push(gambar_barang);
    }

    updateBarangQuery += ' WHERE id_barang = ?';
    updateBarangValues.push(id_barang);

    const [updateResult] = await connection.query(updateBarangQuery, updateBarangValues);

    if (updateResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Barang tidak ditemukan'
      });
    }

    const changes = [];
    const original = originalItem[0];

    if (original.nama_barang !== nama_barang) {
      changes.push(`Nama: ${original.nama_barang} → ${nama_barang}`);
    }
    if (original.deskripsi_barang !== deskripsi_barang) {
      changes.push(`Deskripsi: ${original.deskripsi_barang} → ${deskripsi_barang}`);
    }
    if (original.kategori !== kategori) {
      changes.push(`Kategori: ${original.kategori} → ${kategori}`);
    }
    if (original.lokasi_barang !== lokasi_barang) {
      changes.push(`Lokasi: ${original.lokasi_barang} → ${lokasi_barang}`);
    }
    if (original.harga_barang !== format_harga_barang) {
      changes.push(`Harga: ${original.harga_barang.toLocaleString()} → ${format_harga_barang.toLocaleString()}`);
    }
    if (original.status_barang !== status_barang) {
      changes.push(`Status: ${original.status_barang} → ${status_barang}`);
    }
    if (original.kondisi_barang !== kondisi_barang) {
      changes.push(`Kondisi: ${original.kondisi_barang} → ${kondisi_barang}`);
    }

    if (gambar_barang) {
      changes.push('Gambar diperbarui');
    }
    if (original.id_karyawan !== id_karyawan) {
      changes.push(`Pemilik: ${original.id_karyawan} → ${id_karyawan}`);
    }

    const changeLog = changes.length > 0
      ? `Mengedit barang (${id_barang}) ${nama_barang} ${changes.join(', ')}`
      : `Mengedit barang (${id_barang}) ${nama_barang} tanpa perubahan`;

    await connection.query(
      'UPDATE kepemilikan SET status_kepemilikan = ? WHERE id_barang = ? AND status_kepemilikan = ?',
      ['tidak aktif', id_barang, 'aktif']
    );

    if (id_karyawan) {
      const newKepemilikanQuery = `
        INSERT INTO kepemilikan (id_barang, id_karyawan, tanggal_perolehan, status_kepemilikan)
        VALUES (?, ?, NOW(), 'aktif')
      `;
      await connection.query(newKepemilikanQuery, [id_barang, id_karyawan]);

      await logAdminActivity(
        connection,
        req,
        'EDIT BARANG',
        changeLog
      );

      if (status_barang === 'lelang') {
        const lelangQuery = `
          INSERT INTO lelang (id_barang, status_lelang)
          VALUES (?, 'akan lelang')
          ON DUPLICATE KEY UPDATE status_lelang = 'akan lelang'
        `;
        await connection.query(lelangQuery, [id_barang]);
      }
    }

    await connection.commit();
    res.json({
      success: true,
      message: 'Barang berhasil diperbarui',
      data: { id_barang }
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error updating barang:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengupdate barang'
    });
  } finally {
    connection.release();
  }
});

router.get('/refresh', requireLogin, async (req, res) => {
  const connection = await db.getConnection();
  try {
    let page = req.query.page ? parseInt(req.query.page) : 1;
    let limit = req.query.limit ? parseInt(req.query.limit) : 10;
    let offset = (page - 1) * limit;

    let sortField = req.query.sort || 'waktu_masuk';
    let sortOrder = req.query.order || 'DESC';

    const allowedSortFields = ['waktu_masuk', 'nama_barang', 'id_barang', 'kategori', 'lokasi_barang', 'status_barang'];
    if (!allowedSortFields.includes(sortField)) {
      sortField = 'waktu_masuk';
    }

    if (!['ASC', 'DESC'].includes(sortOrder.toUpperCase())) {
      sortOrder = 'DESC';
    }

    let searchQuery = req.query.search || '';
    let queryParams = [];

    let whereClause = '';
    if (searchQuery) {
      whereClause = `WHERE 
          LOWER(b.nama_barang) LIKE LOWER(?) OR 
          LOWER(b.id_barang) LIKE LOWER(?) OR
          LOWER(COALESCE(b.kategori, '')) LIKE LOWER(?) OR
          LOWER(COALESCE(b.lokasi_barang, '')) LIKE LOWER(?)`;
      queryParams = Array(4).fill(`%${searchQuery}%`);
    }

    const [countResult] = await connection.query(`
        SELECT COUNT(*) AS total 
        FROM barang b 
        ${whereClause}
      `, queryParams);

    let totalData = countResult[0].total;
    let totalPages = Math.ceil(totalData / limit);

    const [rows] = await connection.query(`
        SELECT 
            b.id_barang,
            b.nama_barang,
            b.kategori,
            b.lokasi_barang,
            b.status_barang,
            b.waktu_masuk,
            k.nama_karyawan,
            l.waktu_mulai,
            l.waktu_selesai,
            l.status_lelang,
            CONCAT(
              TIMESTAMPDIFF(DAY, l.waktu_mulai, l.waktu_selesai), 'h',
              MOD(TIMESTAMPDIFF(HOUR, l.waktu_mulai, l.waktu_selesai), 24), 'j',
              MOD(TIMESTAMPDIFF(MINUTE, l.waktu_mulai, l.waktu_selesai), 60), 'm',
              MOD(TIMESTAMPDIFF(SECOND, l.waktu_mulai, l.waktu_selesai), 60), 'd'
            ) as masa_lelang
        FROM barang b
        LEFT JOIN kepemilikan kp ON b.id_barang = kp.id_barang AND kp.status_kepemilikan = 'aktif'
        LEFT JOIN karyawan k ON kp.id_karyawan = k.id_karyawan
        LEFT JOIN lelang l ON b.id_barang = l.id_barang
        ${whereClause}
        ORDER BY b.${sortField} ${sortOrder}
        LIMIT ? OFFSET ?
      `, [...queryParams, limit, offset]);

    res.json({
      success: true,
      barang: rows,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalData: totalData,
        limit: limit,
        tanggal: tanggal,
        searchQuery: searchQuery,
        sortField: sortField,
        sortOrder: sortOrder
      }
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
  } finally {
    connection.release();
  }
});

const tanggal = {
  formatDateTimeLocal(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toISOString().slice(0, 16);
  },

  formatDate(date) {
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(date));
  },
};

router.get('/', requireLogin, async (req, res) => {
  const connection = await db.getConnection();
  try {
    let page = req.query.page ? parseInt(req.query.page) : 1;
    let limit = req.query.limit ? parseInt(req.query.limit) : 10;
    let offset = (page - 1) * limit;

    let sortField = req.query.sort || 'waktu_masuk';
    let sortOrder = req.query.order || 'DESC';

    const allowedSortFields = ['waktu_masuk', 'nama_barang', 'id_barang', 'kategori', 'lokasi_barang', 'status_barang'];
    if (!allowedSortFields.includes(sortField)) {
      sortField = 'waktu_masuk';
    }

    if (!['ASC', 'DESC'].includes(sortOrder.toUpperCase())) {
      sortOrder = 'DESC';
    }

    let searchQuery = req.query.search || '';
    let queryParams = [];

    let whereClause = '';
    if (searchQuery) {
      whereClause = `WHERE 
          LOWER(b.nama_barang) LIKE LOWER(?) OR 
          LOWER(b.id_barang) LIKE LOWER(?) OR
          LOWER(COALESCE(b.kategori, '')) LIKE LOWER(?) OR
          LOWER(COALESCE(b.lokasi_barang, '')) LIKE LOWER(?)`;
      queryParams = Array(4).fill(`%${searchQuery}%`);
    }

    const [countResult] = await connection.query(`
        SELECT COUNT(*) AS total 
        FROM barang b 
        ${whereClause}
      `, queryParams);

    let totalData = countResult[0].total;
    let totalPages = Math.ceil(totalData / limit);

    const [rows] = await connection.query(`
        SELECT 
            b.id_barang,
            b.nama_barang,
            b.kategori,
            b.lokasi_barang,
            b.status_barang,
            b.waktu_masuk,
            k.nama_karyawan,
            l.waktu_mulai,
            l.waktu_selesai,
            l.status_lelang,
            CONCAT(
              TIMESTAMPDIFF(DAY, l.waktu_mulai, l.waktu_selesai), 'h',
              MOD(TIMESTAMPDIFF(HOUR, l.waktu_mulai, l.waktu_selesai), 24), 'j',
              MOD(TIMESTAMPDIFF(MINUTE, l.waktu_mulai, l.waktu_selesai), 60), 'm',
              MOD(TIMESTAMPDIFF(SECOND, l.waktu_mulai, l.waktu_selesai), 60), 'd'
            ) as masa_lelang
        FROM barang b
        LEFT JOIN kepemilikan kp ON b.id_barang = kp.id_barang AND kp.status_kepemilikan = 'aktif'
        LEFT JOIN karyawan k ON kp.id_karyawan = k.id_karyawan 
        LEFT JOIN lelang l ON b.id_barang = l.id_barang
        ${whereClause}
        ORDER BY b.${sortField} ${sortOrder}
        LIMIT ? OFFSET ?
      `, [...queryParams, limit, offset]);

    const [karyawan] = await connection.query('SELECT id_karyawan, nama_karyawan FROM karyawan');

    res.render('barang', {
      barang: rows,
      karyawan: karyawan,
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

router.get('/delete/:id_barang', requireLogin, async (req, res) => {
  const connection = await db.getConnection();
  try {
    const id_barang = req.params.id_barang;

    await connection.beginTransaction();

    const [barangResult] = await connection.query(
      'SELECT nama_barang FROM barang WHERE id_barang = ?',
      [id_barang]
    );

    if (!barangResult || barangResult.length === 0) {
      await connection.rollback();
      return res.status(404).send('Barang tidak ditemukan');
    }

    const nama_barang = barangResult[0].nama_barang;

    await connection.query('DELETE FROM notifikasi WHERE id_barang = ?', [id_barang]);
    await connection.query('DELETE FROM lelang WHERE id_barang = ?', [id_barang]);
    await connection.query('DELETE FROM kepemilikan WHERE id_barang = ?', [id_barang]);
    await connection.query('DELETE FROM barang WHERE id_barang = ?', [id_barang]);

    await logAdminActivity(
      connection,
      req,
      'HAPUS BARANG',
      `Menghapus barang: (${id_barang})${nama_barang}`
    );

    await connection.commit();
    res.json({
      success: true,
      message: 'Barang berhasil dihapus'
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error during deletion:', error);
    res.status(500).send('Gagal menghapus barang');
  } finally {
    connection.release();
  }
});

module.exports = router;