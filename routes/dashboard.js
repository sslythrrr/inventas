const express = require('express');
const router = express.Router();
const db = require('../db.js');
const { requireLogin } = require('../routes/auth.js');

router.get('/', requireLogin, async (req, res) => {
  try {
    const [totalBarang] = await db.query('SELECT COUNT(id_barang) as total FROM barang');
    const [barangLelang] = await db.query('SELECT COUNT(id_barang) as total FROM barang WHERE status_barang = "proses"');
    const [akanLelang] = await db.query('SELECT COUNT(id_barang) as total FROM barang WHERE status_barang = "lelang"');
    const [barangTersedia] = await db.query('SELECT COUNT(id_barang) as total FROM barang WHERE status_barang = "tersedia"');
    const [barangJual] = await db.query('SELECT COUNT(id_barang) as total FROM barang WHERE status_barang = "jual"');
    
    const [notif] = await db.query('SELECT COUNT(id_notifikasi) as total FROM notifikasi WHERE status_baca = "0"');
    
    const [peringatanResult] = await db.query('SELECT pesan FROM notifikasi ORDER BY id_notifikasi DESC LIMIT 1');
    const peringatan = peringatanResult.length ? peringatanResult[0].pesan : 'Tidak ada notifikasi';

    const [latestItems] = await db.query(`
      SELECT 
        b.id_barang,
        b.nama_barang,
        b.kategori,
        b.lokasi_barang,
        k.nama_karyawan as pemilik
      FROM 
        barang b
      LEFT JOIN kepemilikan kp ON b.id_barang = kp.id_barang AND kp.status_kepemilikan = 'aktif'
      LEFT JOIN karyawan k ON kp.id_karyawan = k.id_karyawan
      ORDER BY b.waktu_masuk DESC LIMIT 6
    `);

    const chartData = {
      type: 'doughnut',
      data: {
        labels: ['Tersedia', 'Akan Lelang', 'Sedang Lelang', 'Jual'],
        datasets: [{
          data: [barangTersedia[0].total || 0, akanLelang[0].total || 0, barangLelang[0].total || 0, barangJual[0].total || 0],
          backgroundColor: [
            'rgb(9, 158, 9)',
            'rgb(222, 212, 18)',
            'rgb(11, 22, 230)',
            'rgb(191,0,0)'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        cutout: '80%'
      }
    };

    res.render('dashboard', {
      title: 'Dashboard',
      totalBarang: totalBarang[0].total || 0,
      barangLelang: barangLelang[0].total || 0,
      akanLelang: akanLelang[0].total || 0,
      barangTersedia: barangTersedia[0].total || 0,
      barangJual: barangJual[0].total || 0,
      notif: notif[0].total || 0,
      peringatan: peringatan,
      latestItems: latestItems,
      chartData: chartData,
      role: req.session.role || (req.session.atasanEmail ? 'atasan' : 'admin')
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
