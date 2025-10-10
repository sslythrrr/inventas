const schedule = require('node-schedule');
const mysql = require('mysql2');

class NotificationService {
  constructor(db) {
    this.db = mysql.createPool({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'dbinventas',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    }).promise();
  }

  async getAllNotifications(page, limit) {
    const offset = (page - 1) * limit;
    try {
      const [notifications] = await this.db.query(`
          SELECT n.*, b.nama_barang 
          FROM Notifikasi n
          JOIN Barang b ON n.id_barang = b.id_barang
          WHERE b.status_barang = 'tersedia'
          ORDER BY n.waktu_dibuat DESC
          LIMIT ? OFFSET ?
      `, [limit, offset]);

      const [total] = await this.db.query(`
          SELECT COUNT(*) as total
          FROM Notifikasi n
          JOIN Barang b ON n.id_barang = b.id_barang
          WHERE b.status_barang = 'tersedia'
      `);

      return {
        notifications,
        total: total[0].total,
        page,
        totalPages: Math.ceil(total[0].total / limit)
      };
    } catch (error) {
      console.error('Error getting all notifications:', error);
      return { notifications: [], total: 0, page: 1, totalPages: 0 };
    }
  }

  async markAllAsRead() {
    try {
      await this.db.query(`
          UPDATE Notifikasi n
          JOIN Barang b ON n.id_barang = b.id_barang
          SET n.status_baca = TRUE
          WHERE b.status_barang = 'tersedia'
          AND n.status_baca = FALSE
      `);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }

  async hasExistingNotification(idBarang, tipeNotifikasi) {
    try {
      const [existing] = await this.db.query(
        'SELECT COUNT(*) as count FROM Notifikasi WHERE id_barang = ? AND tipe_notifikasi = ?',
        [idBarang, tipeNotifikasi]
      );
      return existing[0].count > 0;
    } catch (error) {
      console.error('Error checking existing notification:', error);
      return false;
    }
  }

  async checkAndCreateNotifications() {
    try {
      const [barang] = await this.db.query(`
        SELECT id_barang, nama_barang, waktu_masuk
        FROM Barang 
        WHERE status_barang = 'tersedia'
      `);

      const now = new Date();

      for (const item of barang) {
        const masukDate = new Date(item.waktu_masuk);
        const ageInMonths = Math.floor((now - masukDate) / (1000 * 60 * 60 * 24 * 30));

        //console.log(`Checking item ${item.nama_barang}: Age = ${ageInMonths} months`);
        if (ageInMonths >= 36) {
          const hasAutoAuction = await this.hasExistingNotification(item.id_barang, 'lelang otomatis');
          if (!hasAutoAuction) {
            await this.createNotification(item.id_barang, 'lelang otomatis',
              `Barang ${item.nama_barang}(${item.id_barang}) akan memasuki status akan lelang`);
            console.log(`Ubah status lelang: ${item.nama_barang}`);
            await this.autoUpdateToLelang(item.id_barang);
          }
        }
        else if (ageInMonths >= 33) {
          const has3MonthWarning = await this.hasExistingNotification(item.id_barang, 'sisa 3 bulan');
          if (!has3MonthWarning) {
            await this.createNotification(item.id_barang, 'sisa 3 bulan',
              `Barang ${item.nama_barang}(${item.id_barang}) akan memasuki masa lelang dalam 3 bulan`);
            console.log(`Buat peringatan 3 bulan: ${item.nama_barang}`);
          }
        }
        else if (ageInMonths >= 30) {
          const has6MonthWarning = await this.hasExistingNotification(item.id_barang, 'sisa 6 bulan');
          if (!has6MonthWarning) {
            await this.createNotification(item.id_barang, 'sisa 6 bulan',
              `Barang ${item.nama_barang}(${item.id_barang}) akan memasuki masa lelang dalam 6 bulan`);
            console.log(`Buat peringatan 6 bulan: ${item.nama_barang}`);
          }
        }
        else if (ageInMonths >= 24) {
          const has12MonthWarning = await this.hasExistingNotification(item.id_barang, 'sisa 1 tahun');
          if (!has12MonthWarning) {
            await this.createNotification(item.id_barang, 'sisa 1 tahun',
              `Barang ${item.nama_barang}(${item.id_barang}) akan memasuki masa lelang dalam 1 tahun`);
            console.log(`Buat peringatan 12 bulan: ${item.nama_barang}`);
          }
        }
      }
    } catch (error) {
      console.error('Error in checkAndCreateNotifications:', error);
    }
  }

  async createNotification(idBarang, tipe, pesan) {
    try {
      const result = await this.db.query(
        'INSERT INTO Notifikasi (id_barang, tipe_notifikasi, pesan, status_baca) VALUES (?, ?, ?, FALSE)',
        [idBarang, tipe, pesan]
      );
      console.log('Notification created:', { idBarang, tipe, pesan });
      return result;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  async autoUpdateToLelang(idBarang) {
    try {
      await this.db.query('UPDATE Barang SET status_barang = "lelang" WHERE id_barang = ?', [idBarang]);
      await this.db.query('INSERT INTO Lelang (id_barang, status_lelang) VALUES (?, "akan lelang")', [idBarang]);
      await this.createNotification(idBarang, 'lelang otomatis',
        'Barang telah otomatis masuk ke status lelang karena telah mencapai usia 3 tahun');
    } catch (error) {
      console.error('Error updating to auction:', error);
    }
  }

  async getUnreadNotifications() {
    try {
      const [notifications] = await this.db.query(`
        SELECT n.*, b.nama_barang 
        FROM Notifikasi n
        JOIN Barang b ON n.id_barang = b.id_barang
        WHERE n.status_baca = FALSE
        AND b.status_barang IN ('tersedia', 'lelang')
        ORDER BY n.waktu_dibuat DESC
      `);
      return notifications;
    } catch (error) {
      console.error('Error getting unread notifications:', error);
      return [];
    }
  }

  async markAsRead(idNotifikasi) {
    try {
      await this.db.query(
        'UPDATE Notifikasi SET status_baca = TRUE WHERE id_notifikasi = ?',
        [idNotifikasi]
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }
}

const initNotificationSystem = (db) => {
  const notificationService = new NotificationService(db);

  const job = schedule.scheduleJob('*/1 * * * *', async () => {
    //console.log('Running notification check...');
    await notificationService.checkAndCreateNotifications();
  });

  setTimeout(async () => {
    console.log('Running initial notification check...');
    await notificationService.checkAndCreateNotifications();
  }, 3000);

  return notificationService;
};

module.exports = { initNotificationSystem };