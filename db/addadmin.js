const mysql = require('mysql2');
const bcrypt = require('bcryptjs');

// Database connection configuration
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'passwordBaru123',
  database: 'inventas'
});

// Admin credentials to add
const newAdmin = {
  id_admin: 'ad00923',
    email: 'admin123@gmail.com',
    password: 'admin123'
  }; 

// Connect to database
db.connect(async (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
  console.log('Connected to database');

  try {
    // Generate password hash
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(newAdmin.password, salt);

    // SQL query to insert new admin
    const sql = 'INSERT INTO admin (id_admin, email, password) VALUES (?, ?, ?)';
    
    db.query(sql, [newAdmin.id_admin, newAdmin.email, hashedPassword], (err, result) => {
      if (err) {
        console.error('Error adding admin:', err);
      } else {
        console.log('Admin added successfully!');
        console.log('id_admin:', newAdmin.id_admin);
        console.log('Email:', newAdmin.email);
        console.log('Password:', newAdmin.password);
      }
      
      // Close the database connection
      db.end();
    });

  } catch (error) {
    console.error('Error:', error);
    db.end();
  }
});