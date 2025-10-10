const express = require('express');
const router = express.Router();
const { requireLogin } = require('../routes/auth.js');

module.exports = (notificationService) => {
    router.get('/',requireLogin, async (req, res) => {
        try {
            const notifications = await notificationService.getUnreadNotifications();
            //console.log('Sending notifications:', notifications);
            res.json(notifications);
        } catch (error) {
            console.error('Error fetching notifications:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    router.get('/count',requireLogin, async (req, res) => {
        try {
            const notifications = await notificationService.getUnreadNotifications();
            res.json({ count: notifications.length });
        } catch (error) {
            console.error('Error fetching notification count:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    router.put('/:id/read',requireLogin, async (req, res) => {
        try {
            await notificationService.markAsRead(req.params.id);
            res.json({ success: true });
        } catch (error) {
            console.error('Error marking notification as read:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    router.put('/mark-all-read',requireLogin, async (req, res) => {
        try {
            await notificationService.markAllAsRead();
            res.json({ success: true });
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    return router;
};