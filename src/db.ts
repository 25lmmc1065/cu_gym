import Database from 'better-sqlite3';

import bcrypt from 'bcryptjs';

const db = new Database('hostel_gym.db');

// Initialize Database
export function initDb() {
  // Hostels table
  db.exec(`
    CREATE TABLE IF NOT EXISTS hostels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `);

  // Wings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS wings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hostel_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      FOREIGN KEY (hostel_id) REFERENCES hostels(id),
      UNIQUE(hostel_id, name)
    )
  `);

  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      uid TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT CHECK(role IN ('student', 'admin', 'manager')) NOT NULL DEFAULT 'student',
      is_verified INTEGER DEFAULT 0, -- 0: Pending, 1: Verified
      is_blocked INTEGER DEFAULT 0, -- 0: Active, 1: Blocked
      block_reason TEXT,
      hostel_id INTEGER,
      wing_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hostel_id) REFERENCES hostels(id),
      FOREIGN KEY (wing_id) REFERENCES wings(id)
    )
  `);

  // Check if columns exist and add them if not (for migration)
  try {
    const tableInfo = db.prepare("PRAGMA table_info(users)").all() as any[];
    const hasIsBlocked = tableInfo.some(col => col.name === 'is_blocked');
    const hasBlockReason = tableInfo.some(col => col.name === 'block_reason');
    const hasHostelId = tableInfo.some(col => col.name === 'hostel_id');
    const hasWingId = tableInfo.some(col => col.name === 'wing_id');

    if (!hasIsBlocked) {
      db.exec("ALTER TABLE users ADD COLUMN is_blocked INTEGER DEFAULT 0");
    }
    if (!hasBlockReason) {
      db.exec("ALTER TABLE users ADD COLUMN block_reason TEXT");
    }
    if (!hasHostelId) {
      db.exec("ALTER TABLE users ADD COLUMN hostel_id INTEGER REFERENCES hostels(id)");
    }
    if (!hasWingId) {
      db.exec("ALTER TABLE users ADD COLUMN wing_id INTEGER REFERENCES wings(id)");
    }
  } catch (e) {
    console.error("Migration error:", e);
  }

  // Slots table
  db.exec(`
    CREATE TABLE IF NOT EXISTS slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 15,
      label TEXT NOT NULL, -- e.g., "Morning 1", "Evening 2"
      type TEXT CHECK(type IN ('morning', 'evening')) NOT NULL DEFAULT 'morning',
      warden_id INTEGER,
      FOREIGN KEY (warden_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Check if type column exists in slots and add it if not
  try {
    const slotsInfo = db.prepare("PRAGMA table_info(slots)").all() as any[];
    const hasType = slotsInfo.some(col => col.name === 'type');

    if (!hasType) {
      db.exec("ALTER TABLE slots ADD COLUMN type TEXT CHECK(type IN ('morning', 'evening')) DEFAULT 'morning'");
      // Update existing slots based on AM/PM
      db.exec("UPDATE slots SET type = 'morning' WHERE start_time LIKE '%AM%'");
      db.exec("UPDATE slots SET type = 'evening' WHERE start_time LIKE '%PM%'");
    }

    const hasWardenId = slotsInfo.some(col => col.name === 'warden_id');
    if (!hasWardenId) {
      db.exec("ALTER TABLE slots ADD COLUMN warden_id INTEGER REFERENCES users(id) ON DELETE CASCADE");
    }
  } catch (e) {
    console.error("Slots migration error:", e);
  }

  // Bookings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      slot_id INTEGER NOT NULL,
      booking_date TEXT NOT NULL, -- YYYY-MM-DD
      status TEXT CHECK(status IN ('booked', 'cancelled', 'attended', 'absent', 'waitlisted')) DEFAULT 'booked',
      cancellation_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (slot_id) REFERENCES slots(id),
      UNIQUE(user_id, booking_date) -- One booking per day per student
    )
  `);

  // Migration for Bookings CHECK constraint (to add 'waitlisted' status)
  try {
    const tableInfo: any = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='bookings'").get();
    if (tableInfo && !tableInfo.sql.includes("'waitlisted'")) {
      db.transaction(() => {
        db.exec("PRAGMA foreign_keys=OFF;");
        db.exec("ALTER TABLE bookings RENAME TO bookings_old;");
        db.exec(`
          CREATE TABLE bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            slot_id INTEGER NOT NULL,
            booking_date TEXT NOT NULL,
            status TEXT CHECK(status IN ('booked', 'cancelled', 'attended', 'absent', 'waitlisted')) DEFAULT 'booked',
            cancellation_reason TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (slot_id) REFERENCES slots(id),
            UNIQUE(user_id, booking_date)
          )
        `);
        db.exec("INSERT INTO bookings SELECT * FROM bookings_old;");
        db.exec("DROP TABLE bookings_old;");
        db.exec("PRAGMA foreign_keys=ON;");
      })();
    }
  } catch (e) {
    console.error("Bookings constraint migration error:", e);
  }

  // Mapping tables for Warden to Hostels and Wings
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_hostels (
      user_id INTEGER NOT NULL,
      hostel_id INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, hostel_id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_wings (
      user_id INTEGER NOT NULL,
      wing_id INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (wing_id) REFERENCES wings(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, wing_id)
    )
  `);

  // Activity Logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      action_type TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Seed default slots if empty
  const stmt = db.prepare('SELECT count(*) as count FROM slots');
  const result = stmt.get() as { count: number };

  if (result.count === 0) {
    const insertSlot = db.prepare('INSERT INTO slots (start_time, end_time, capacity, label, type) VALUES (?, ?, ?, ?, ?)');
    insertSlot.run('06:00 AM', '07:00 AM', 15, 'Morning 1', 'morning');
    insertSlot.run('07:00 AM', '08:00 AM', 15, 'Morning 2', 'morning');
    insertSlot.run('05:00 PM', '06:00 PM', 15, 'Evening 1', 'evening');
    insertSlot.run('06:00 PM', '07:00 PM', 15, 'Evening 2', 'evening');
    insertSlot.run('07:00 PM', '08:00 PM', 15, 'Evening 3', 'evening');
  }

  // Seed admin user if not exists
  const adminCheck = db.prepare("SELECT * FROM users WHERE role = 'admin'").get();
  if (!adminCheck) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    const insertAdmin = db.prepare('INSERT INTO users (full_name, uid, phone, password, role, is_verified) VALUES (?, ?, ?, ?, ?, ?)');
    insertAdmin.run('Warden Unnao', 'ADMIN001', '0000000000', hashedPassword, 'admin', 1);
    console.log('Admin user seeded: UID=ADMIN001, Password=admin123');
  }

  // Seed manager user if not exists
  const managerCheck = db.prepare("SELECT * FROM users WHERE role = 'manager'").get();
  if (!managerCheck) {
    const hashedPassword = bcrypt.hashSync('manager123', 10);
    const insertManager = db.prepare('INSERT INTO users (full_name, uid, phone, password, role, is_verified) VALUES (?, ?, ?, ?, ?, ?)');
    insertManager.run('Hostel Manager', 'MANAGER001', '0000000000', hashedPassword, 'manager', 1);
    console.log('Manager user seeded: UID=MANAGER001, Password=manager123');
  }
}

export default db;
