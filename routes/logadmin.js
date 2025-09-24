const express = require('express');
const router = express.Router();
const db = require('../db.js');
const { requireLogin } = require('../routes/auth.js');

router.get('/', requireLogin, async (req, res) => {
  let page = req.query.page ? parseInt(req.query.page) : 1;
    let limit = req.query.limit ? parseInt(req.query.limit) : 10;
    let offset = (page - 1) * limit;

  try {
    const [countResult] = await db.query('SELECT COUNT(*) AS total FROM log_aktivitas');
    let totalData = countResult[0].total;
    let totalPages = Math.ceil(totalData / limit);

    const [log] = await db.query(`
      SELECT 
        l.timestamp,
        l.id_admin,
        a.username AS nama_admin,
        l.jenis_aktivitas,
        l.detail_perubahan 
      FROM log_aktivitas l
      LEFT JOIN admin a ON l.id_admin = a.id_admin
      ORDER BY l.timestamp DESC 
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    res.render('logadmin', {
      log,
      currentPage: page,
      totalPages: totalPages,
      totalData: totalData,
      limit: limit,
      role: req.session.role || (req.session.atasanEmail ? 'atasan' : 'admin')
    });

  } catch (err) {
    console.error('Error fetching admin logs:', err);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;