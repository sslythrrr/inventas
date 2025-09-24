// middlewares/auth.js
const db = require('../db.js');

// Middleware untuk admin

const requireLogin = async (req, res, next) => {
  if (req.session && (req.session.email || req.session.atasanEmail)) {
    if (req.session.email) {
      try {
        const [adminRows] = await db.query(
          'SELECT id_admin FROM Admin WHERE email = ?',
          [req.session.email]
        );
        if (adminRows.length > 0) {
          req.adminId = adminRows[0].id_admin;
          return next();
        } else {
          console.log('Auth failed: Admin not found');
          return res.redirect('/login');
        }
      } catch (error) {
        console.error('Error fetching admin:', error);
        return res.redirect('/login');
      }
    }
    if (req.session.atasanEmail) {
      try {
        const [atasanRows] = await db.query(
          'SELECT id_atasan FROM atasan WHERE email = ?',
          [req.session.atasanEmail]
        );
        if (atasanRows.length > 0) {
          req.atasanId = atasanRows[0].id_atasan;
          return next();
        } else {
          console.log('Auth failed: Atasan not found');
          return res.redirect('/atasan/login');
        }
      } catch (error) {
        console.error('Error fetching atasan:', error);
        return res.redirect('/atasan/login');
      }
    }
  } else {
    console.log('Auth failed: No session found');
    return res.redirect('/login');
  }
};
// const requireLogin = async (req, res, next) => {
//   if (req.session && req.session.email) {
//     try {
//       const [adminRows] = await db.query(
//         'SELECT id_admin FROM Admin WHERE email = ?',
//         [req.session.email]
//       );

//       if (adminRows.length > 0) {
//         req.adminId = adminRows[0].id_admin;
//         next();
//       } else {
//         console.log('Auth failed: Admin not found');
//         res.redirect('/login');
//       }
//     } catch (error) {
//       console.error('Error fetching admin:', error);
//       res.redirect('/login');
//     }
//   } else {
//     console.log('Auth failed: No session found');
//     res.redirect('/login');
//   }
// };

const requireAtasanLogin = async (req, res, next) => {
  if (req.session && req.session.atasanEmail) {
    try {
      const [atasanRows] = await db.query(
        'SELECT id_atasan FROM atasan WHERE email = ?',
        [req.session.atasanEmail]
      );

      if (atasanRows.length > 0) {
        req.atasanId = atasanRows[0].id_atasan;
        next();
      } else {
        console.log('Auth failed: Atasan not found');
        res.redirect('/atasan/login');
      }
    } catch (error) {
      console.error('Error fetching atasan:', error);
      res.redirect('/atasan/login');
    }
  } else {
    res.redirect('/atasan/login');
  }
};

module.exports = { requireLogin, requireAtasanLogin };
