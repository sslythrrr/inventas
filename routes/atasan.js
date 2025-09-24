const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const { requireAtasanLogin } = require('../routes/auth.js');

router.get('/login', (req, res) => {
  res.render('atasan_login', { error: null });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('Login attempt:', email);

  try {
    const [rows] = await db.query(
        'SELECT * FROM atasan WHERE email = ?',
        [email]
      );

    if (rows.length === 0) {
      console.log('Login failed: User not found');
      return res.json({ success: false, message: 'Email atau password salah atau tidak terdaftar sebagai atasan.' });
    }

    const isMatch = await bcrypt.compare(password, rows[0].password);
    if (!isMatch) {
      return res.json({ success: false, message: 'Email atau password salah atau tidak terdaftar sebagai atasan.' });
    }

    req.session.atasanEmail = rows[0].email;
    req.session.atasanId = rows[0].id_atasan;
    req.session.atasanNama = rows[0].nama_atasan;
    req.session.role = 'atasan';

    console.log('Session atasanEmail:', req.session.atasanEmail);
    console.log('Session atasanId:', req.session.atasanId);
    console.log('Session atasanNama:', req.session.atasanNama);
    console.log('Session role:', req.session.role);

    res.json({ success: true, message: 'Login berhasil' });

  } catch (error) {
    console.error('Login error:', error);
    res.json({ success: false, message: 'Terjadi kesalahan sistem' });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/atasan/login');
  });
});

router.get('/lelang', requireAtasanLogin, async (req, res) => {
  try {

    const [akanLelang] = await db.query(`
      SELECT b.id_barang, b.nama_barang, b.harga_barang, l.harga_lelang, l.waktu_mulai, l.waktu_selesai
      FROM Barang b
      JOIN Lelang l ON l.id_barang = b.id_barang
      WHERE b.status_barang = 'diproses atasan'
    `);

    const [prosesLelang] = await db.query(`
      SELECT b.id_barang, b.nama_barang, l.harga_lelang, l.waktu_mulai, l.waktu_selesai
      FROM Barang b
      JOIN Lelang l ON l.id_barang = b.id_barang
      WHERE l.status_lelang = 'sedang lelang'
    `);

    // const [prosesLelang] = await db.query(`
    //   SELECT b.id_barang, b.nama_barang, l.harga_lelang, l.waktu_mulai, l.waktu_selesai
    //   FROM Barang b
    //   JOIN Lelang l ON l.id_barang = b.id_barang
    //   WHERE l.status_konfirmasi_atasan = 'approved' AND l.status_lelang = '	
    //   sedang lelang'
    // `);

    res.render('atasan_lelang', {
      akanLelang,
      prosesLelang,
      searchQuery: req.query.q || "",
      role: req.session.role || (req.session.atasanEmail ? 'atasan' : 'admin'),
      userRole: 'atasan',
      atasanData: {
        id_atasan: req.session.atasanId,
        nama_atasan: req.session.atasanNama,
        email: req.session.atasanEmail
      }
    });
  } catch (err) {
    res.status(500).send('Gagal memuat data lelang');
  }
});

router.post('/lelang/konfirmasi/:id_barang', requireAtasanLogin, async (req, res) => {
  const { id_barang } = req.params;
  const id_atasan = req.session.atasanId;
  try {
    await db.query(
      `UPDATE lelang SET status_konfirmasi_atasan = 'approved', id_atasan = ?, waktu_konfirmasi_atasan = NOW(), status_lelang = 'sedang lelang' WHERE id_barang = ?`,
      [id_atasan, id_barang]
    );
    await db.query(
      `UPDATE Barang SET status_barang = 'proses' WHERE id_barang = ?`,
      [id_barang]
    );
    res.json({ success: true, message: 'Lelang dikonfirmasi dan dimulai!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal konfirmasi lelang' });
  }
});

router.post('/lelang/tolak/:id_barang', requireAtasanLogin, async (req, res) => {
  const { id_barang } = req.params;
  const id_atasan = req.session.atasanId;
  try {
    await db.query(
      `UPDATE lelang SET status_konfirmasi_atasan = 'rejected', id_atasan = ?, waktu_konfirmasi_atasan = NOW() WHERE id_barang = ?`,
      [id_atasan, id_barang]
    );
    await db.query(
      `UPDATE Barang SET status_barang = 'ditolak atasan' WHERE id_barang = ?`,
      [id_barang]
    );
    res.json({ success: true, message: 'Lelang ditolak oleh atasan.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menolak lelang' });
  }
});

module.exports = router; 