import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import sqlite3 from 'sqlite3';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'farmup_super_secret_key_2025';

// Database setup
const db = new sqlite3.Database(join(__dirname, 'farmup.sqlite'), (err) => {
  if (err) console.error('Error connecting to database:', err);
  else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false // Allow inline scripts/styles for prototype
}));

const corsOptions = {
  origin: '*', // For MVP. In prod use: ['http://localhost:3000', 'https://farmup.app']
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.use(express.json());

// Serving static HTML
app.use(express.static(__dirname));

// Rate Limiting for Auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 auth requests per windowMs
  message: { error: 'Too many login attempts, please try again after 15 minutes' }
});

// Initialize Database Schema
function initializeDatabase() {
  db.serialize(() => {
    // 1. Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 2. Roles Table (Optional, role string used in users usually sufficient for MVP, but added as requested)
    db.run(`CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 3. Farms Table
    db.run(`CREATE TABLE IF NOT EXISTS farms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      farmer_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      location TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(farmer_id) REFERENCES users(id)
    )`);

    // 4. FarmerProfiles Table
    db.run(`CREATE TABLE IF NOT EXISTS farmer_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      farm_id INTEGER NOT NULL,
      planting_method TEXT,
      certificates TEXT,
      gallery TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(farm_id) REFERENCES farms(id)
    )`);

    // 5. Crops Table
    db.run(`CREATE TABLE IF NOT EXISTS crops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      farm_id INTEGER,
      name TEXT NOT NULL,
      category TEXT,
      price DECIMAL(10,2),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(farm_id) REFERENCES farms(id)
    )`);

    // 6. CropLots Table
    db.run(`CREATE TABLE IF NOT EXISTS crop_lots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      crop_id INTEGER NOT NULL,
      lot_number TEXT NOT NULL,
      max_qty INTEGER,
      stock_qty INTEGER,
      harvest_date TEXT,
      status TEXT DEFAULT 'active',
      risk_level TEXT DEFAULT 'low',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(crop_id) REFERENCES crops(id)
    )`);

    // 7. Orders Table
    db.run(`CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      total_price DECIMAL(10,2),
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // 8. OrderItems Table
    db.run(`CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      lot_id INTEGER NOT NULL,
      qty INTEGER,
      price_per_unit DECIMAL(10,2),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id),
      FOREIGN KEY(lot_id) REFERENCES crop_lots(id)
    )`);

    // 9. GrowthUpdates Table
    db.run(`CREATE TABLE IF NOT EXISTS growth_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lot_id INTEGER NOT NULL,
      farmer_id INTEGER NOT NULL,
      stage TEXT,
      message TEXT,
      image_url TEXT,
      recorded_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(lot_id) REFERENCES crop_lots(id),
      FOREIGN KEY(farmer_id) REFERENCES users(id)
    )`);

    // 10. RiskReports Table
    db.run(`CREATE TABLE IF NOT EXISTS risk_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lot_id INTEGER NOT NULL,
      damage_percent INTEGER,
      reason TEXT,
      status TEXT DEFAULT 'reported',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(lot_id) REFERENCES crop_lots(id)
    )`);

    // 11. PickupSchedules Table
    db.run(`CREATE TABLE IF NOT EXISTS pickup_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      location_id INTEGER NOT NULL,
      pickup_date TEXT,
      status TEXT DEFAULT 'scheduled',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id)
    )`);

    // 12. Reviews Table
    db.run(`CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      rating INTEGER,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // 13. Notifications Table
    db.run(`CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT,
      message TEXT,
      is_read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // 14. CommunityMessages Table
    db.run(`CREATE TABLE IF NOT EXISTS community_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      room TEXT,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // 15. MarketLocations Table (Vendor location for pickup)
    db.run(`CREATE TABLE IF NOT EXISTS market_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(vendor_id) REFERENCES users(id)
    )`);

    // 16. VendorProfiles Table
    db.run(`CREATE TABLE IF NOT EXISTS vendor_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_id INTEGER NOT NULL,
      business_name TEXT,
      contact_info TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(vendor_id) REFERENCES users(id)
    )`);

    // 17. ImpactStats Table
    db.run(`CREATE TABLE IF NOT EXISTS impact_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      food_waste_saved_kg DECIMAL(10,2) DEFAULT 0,
      carbon_offset_kg DECIMAL(10,2) DEFAULT 0,
      local_farmers_supported INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
    
    // Check if we need to seed data
    db.get('SELECT COUNT(*) as count FROM crops', (err, row) => {
      if (!err && row.count === 0) seedData();
    });
  });
}

function seedData() {
  console.log('Seeding initial data...');
  const crops = [
    { name: 'มะเขือเทศ Heirloom Batch #24', farm: 'ฟาร์มสมศักดิ์ • เชียงใหม่', price: 280, max: 200, stock: 176, harvest: '2025-04-30' },
    { name: 'ผักบุ้งไร้สาร Batch #5', farm: 'ฟาร์มใจดี • เลย', price: 60, max: 200, stock: 90, harvest: '2025-04-15' },
    { name: 'มะม่วงน้ำดอกไม้ Batch #3', farm: 'ฟาร์มทองคำ • นครสวรรค์', price: 450, max: 200, stock: 150, harvest: '2025-06-01' }
  ];
  
  const stmt = db.prepare('INSERT INTO crops (name, farm_name, price, stock_qty, max_qty, harvest_date) VALUES (?, ?, ?, ?, ?, ?)');
  crops.forEach(c => stmt.run(c.name, c.farm, c.price, c.stock, c.max, c.harvest));
  stmt.finalize();
}

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.status(401).json({ error: 'Unauthorized' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Forbidden' });
    req.user = user;
    next();
  });
};

// --- API ROUTES : AUTHENTICATION ---

app.post('/api/auth/login', authLimiter, (req, res) => {
  const { email, password, rememberMe } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err || !user) return res.status(400).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    
    // Remember me configures expiration time
    const expireTime = rememberMe ? '30d' : '24h';
    const token = jwt.sign({ id: user.id, name: user.name, role: user.role, avatar: user.avatar }, SECRET_KEY, { expiresIn: expireTime });
    
    res.json({ token, user: { id: user.id, name: user.name, role: user.role, avatar: user.avatar, email: user.email } });
  });
});

app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' });

  // Basic validation on backend
  if (email.length < 3) return res.status(400).json({ error: 'อีเมลสั้นเกินไป' });
  if (password.length < 4) return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร' });
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10); // Salt rounds = 10
    const avatar = role === 'farmer' ? '🧑‍🌾' : '🙋'; // Default avatars
    
    db.run('INSERT INTO users (name, email, password, role, avatar) VALUES (?, ?, ?, ?, ?)', 
      [name, email, hashedPassword, role, avatar], 
      function(err) {
        if (err) return res.status(400).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' });
        const user = { id: this.lastID, name, email, role, avatar };
        const token = jwt.sign(user, SECRET_KEY, { expiresIn: '24h' });
        res.json({ token, user });
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET Current User Info
app.get('/api/auth/me', authenticateToken, (req, res) => {
  db.get('SELECT id, name, email, role, avatar, created_at FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  });
});

// Logout (Dummy for Bearer pattern, mostly handled on Client side by deleting token)
app.post('/api/auth/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// Forgot Password Flow
app.post('/api/auth/forgot-password', authLimiter, (req, res) => {
  // Mock endpoint: In reality, send email with reset token
  res.json({ message: 'ระบบได้ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว (หากมีอยู่ในระบบ)' });
});

// Demo Login
app.post('/api/auth/demo-login', authLimiter, (req, res) => {
  const { role } = req.body; // 'consumer' or 'farmer'
  if (role !== 'consumer' && role !== 'farmer') return res.status(400).json({ error: 'Invalid role' });
  
  const email = role === 'farmer' ? 'farmer@demo.farmup.th' : 'demo@farmup.th';
  
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err || !user) {
      // Create demo user on the fly if not exists
      const newName = role === 'farmer' ? 'ลุงสมศักดิ์ นามดี' : 'คุณสมชายใจดี';
      const newAvatar = role === 'farmer' ? '🧑‍🌾' : '🙋';
      const fakeHashedPass = bcrypt.hashSync('demo1234', 10);
      
      db.run('INSERT INTO users (name, email, password, role, avatar) VALUES (?, ?, ?, ?, ?)', 
        [newName, email, fakeHashedPass, role, newAvatar], 
        function(insertErr) {
          if (insertErr) return res.status(500).json({ error: 'Failed to create demo user' });
          const newUser = { id: this.lastID, name: newName, role, avatar: newAvatar, email };
          const token = jwt.sign(newUser, SECRET_KEY, { expiresIn: '24h' });
          return res.json({ token, user: newUser });
      });
    } else {
      const token = jwt.sign({ id: user.id, name: user.name, role: user.role, avatar: user.avatar }, SECRET_KEY, { expiresIn: '24h' });
      res.json({ token, user: { id: user.id, name: user.name, role: user.role, avatar: user.avatar, email: user.email } });
    }
  });
});

// Crops: Get All
app.get('/api/crops', (req, res) => {
  db.all('SELECT * FROM crops ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Orders: Create Order
app.post('/api/orders', authenticateToken, (req, res) => {
  const { crop_id, qty, total_price } = req.body;
  const user_id = req.user.id;
  
  db.run('INSERT INTO orders (user_id, crop_id, qty, total_price) VALUES (?, ?, ?, ?)',
    [user_id, crop_id, qty, total_price],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Order created successfully', orderId: this.lastID });
    }
  );
});

// Orders: Get User Orders
app.get('/api/orders', authenticateToken, (req, res) => {
  db.all(`SELECT o.*, c.name, c.harvest_date 
          FROM orders o 
          JOIN crops c ON o.crop_id = c.id 
          WHERE o.user_id = ? ORDER BY o.id DESC`, 
  [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`FarmUP Server running at http://localhost:${PORT}`);
});
