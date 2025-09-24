const mysql = require('mysql2');
const bcrypt = require('bcryptjs');

// Database connection configuration
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'passwordBaru123',
  database: 'inventas'
});

// Atasan credentials to add
const newAtasan = {
  id_atasan: 'ats001',
  nama_atasan: 'Atasan Utama',
  email: 'atasan@gmail.com',
  password: 'atasan123'
}; 

// Connect to database
db.connect(async (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
  console.log('Connected to database');

  try {
    // Create Atasan table if not exists
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS Atasan (
        id_atasan VARCHAR(10) PRIMARY KEY,
        nama_atasan VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await db.promise().query(createTableSQL);
    console.log('Atasan table created successfully');

    // Add status_konfirmasi column to Lelang table if not exists
    const alterLelangSQL = `
      ALTER TABLE lelang 
      ADD COLUMN IF NOT EXISTS status_konfirmasi_atasan ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS id_atasan VARCHAR(10),
      ADD COLUMN IF NOT EXISTS waktu_konfirmasi_atasan TIMESTAMP NULL,
      ADD FOREIGN KEY (id_atasan) REFERENCES Atasan(id_atasan) ON DELETE SET NULL
    `;
    
    await db.promise().query(alterLelangSQL);
    console.log('Lelang table updated successfully');

    // Generate password hash
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(newAtasan.password, salt);

    // Check if atasan already exists
    const [existingAtasan] = await db.promise().query(
      'SELECT id_atasan FROM Atasan WHERE email = ?',
      [newAtasan.email]
    );

    if (existingAtasan.length === 0) {
      // SQL query to insert new atasan
      const sql = 'INSERT INTO Atasan (id_atasan, nama_atasan, email, password) VALUES (?, ?, ?, ?)';
      
      await db.promise().query(sql, [
        newAtasan.id_atasan, 
        newAtasan.nama_atasan, 
        newAtasan.email, 
        hashedPassword
      ]);
      
      console.log('Atasan added successfully!');
      console.log('id_atasan:', newAtasan.id_atasan);
      console.log('Nama:', newAtasan.nama_atasan);
      console.log('Email:', newAtasan.email);
      console.log('Password:', newAtasan.password);
    } else {
      console.log('Atasan already exists with email:', newAtasan.email);
    }
    
    // Close the database connection
    db.end();
  } catch (error) {
    console.error('Error:', error);
    db.end();
  }
}); 