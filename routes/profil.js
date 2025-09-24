const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});
const db = require('../db.js');
const bcrypt = require('bcrypt');
const { requireLogin } = require('../routes/auth.js');

router.get('/', requireLogin, async (req, res) => {
    try {
        if (req.session.atasanEmail) {
            // Handle atasan profile
            const [atasanRows] = await db.query(
                'SELECT id_atasan, nama_atasan, email FROM atasan WHERE email = ?',
                [req.session.atasanEmail]
            );

            if (!atasanRows.length) {
                return res.status(404).send('Atasan not found');
            }

            const [activities] = await db.query(
                `SELECT * FROM Log_Aktivitas 
                 WHERE id_admin = ? 
                 ORDER BY timestamp DESC 
                 LIMIT 10`,
                [atasanRows[0].id_atasan]
            );

            res.render('profil', {
                title: 'Profil Atasan',
                atasan: atasanRows[0],
                activities: activities,
                role: 'atasan',
                userRole: 'atasan'
            });
        } else {
            // Handle admin profile
            const [adminRows] = await db.query(
                'SELECT id_admin, username, email, foto FROM Admin WHERE email = ?',
                [req.session.email]
            );

            if (!adminRows.length) {
                return res.status(404).send('Admin not found');
            }

            const [activities] = await db.query(
                `SELECT * FROM Log_Aktivitas 
                 WHERE id_admin = ? 
                 ORDER BY timestamp DESC 
                 LIMIT 10`,
                [adminRows[0].id_admin]
            );

            res.render('profil', {
                title: 'Profil Admin',
                admin: adminRows[0],
                activities: activities,
                role: req.session.role || 'admin',
                userRole: 'admin'
            });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server error');
    }
});

router.post('/update-profil', requireLogin, async (req, res) => {
    // Check if user is atasan
    if (req.session.atasanEmail) {
        return res.status(403).json({ message: 'Profil atasan tidak dapat diubah melalui interface ini' });
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const { username, email, currentPassword, newPassword } = req.body;
        const previousEmail = req.session.email;

        const [adminRows] = await conn.query(
            'SELECT id_admin, password FROM Admin WHERE email = ?',
            [previousEmail]
        );

        if (!adminRows.length) {
            await conn.rollback();
            return res.status(404).json({ message: 'Admin not found' });
        }

        if (newPassword) {
            if (!currentPassword) {
                await conn.rollback();
                return res.status(400).json({ message: 'Current password is required to change password' });
            }

            const isValidPassword = await bcrypt.compare(currentPassword, adminRows[0].password);
            if (!isValidPassword) {
                await conn.rollback();
                return res.status(401).json({ message: 'Current password is incorrect' });
            }
        }

        if (email !== previousEmail) {
            const [existingEmail] = await conn.query(
                'SELECT id_admin FROM Admin WHERE email = ? AND id_admin != ?',
                [email, adminRows[0].id_admin]
            );

            if (existingEmail.length > 0) {
                await conn.rollback();
                return res.status(400).json({ message: 'Email already in use' });
            }
        }

        let updateQuery = 'UPDATE Admin SET username = ?, email = ?';
        let queryParams = [username, email];

        if (newPassword) {
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            updateQuery += ', password = ?';
            queryParams.push(hashedPassword);
        }

        queryParams.push(adminRows[0].id_admin);
        updateQuery += ' WHERE id_admin = ?';

        const [updateResult] = await conn.query(updateQuery, queryParams);

        if (updateResult.affectedRows === 0) {
            await conn.rollback();
            return res.status(400).json({ message: 'No changes were made' });
        }
        req.session.email = email;

        await conn.commit();
        res.json({
            message: 'Profile berhasil diperbarui',
            previousEmail: previousEmail
        });

    } catch (error) {
        await conn.rollback();
        console.error('Error updating profile:', error);
        res.status(500).json({
            message: 'Server error while updating profile',
            error: error.message
        });
    } finally {
        conn.release();
    }
});

router.post('/update-photo', requireLogin, upload.single('photo'), async (req, res) => {
    // Check if user is atasan
    if (req.session.atasanEmail) {
        return res.status(403).json({ message: 'Foto profil atasan tidak dapat diubah melalui interface ini' });
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        if (!req.file) {
            await conn.rollback();
            return res.status(400).json({ message: 'No file uploaded' });
        }

        if (!req.file.mimetype.startsWith('image/')) {
            await conn.rollback();
            return res.status(400).json({ message: 'Only image files are allowed' });
        }

        const [adminRows] = await conn.query(
            'SELECT id_admin FROM Admin WHERE email = ?',
            [req.session.email]
        );

        if (!adminRows.length) {
            await conn.rollback();
            return res.status(404).json({ message: 'Admin not found' });
        }

        const [updateResult] = await conn.query(
            'UPDATE Admin SET foto = ? WHERE id_admin = ?',
            [req.file.buffer, adminRows[0].id_admin]
        );

        if (updateResult.affectedRows === 0) {
            await conn.rollback();
            return res.status(400).json({ message: 'Failed to update photo' });
        }
        await conn.commit();
        res.json({
            message: 'Photo updated successfully',
            adminId: adminRows[0].id_admin
        });

    } catch (error) {
        await conn.rollback();
        console.error('Error updating photo:', error);
        res.status(500).json({
            message: 'Server error while updating photo',
            error: error.message
        });
    } finally {
        conn.release();
    }
});


router.get('/photo/:id', requireLogin, async (req, res) => {
    try {
        // If user is atasan, return default avatar
        if (req.session.atasanEmail) {
            return res.redirect('/img/avatars/pfp.jpg');
        }

        const [rows] = await db.query(
            'SELECT foto FROM Admin WHERE id_admin = ?',
            [req.params.id]
        );

        if (rows[0] && rows[0].foto) {
            res.set('Content-Type', 'image/jpeg');
            res.send(rows[0].foto);
        } else {
            res.status(404).send('Photo not found');
        }
    } catch (error) {
        console.error('Error fetching photo:', error);
        res.status(500).send('Error fetching photo');
    }
});

module.exports = router;