import express from "express";
import { createServer as createViteServer } from "vite";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import db, { initDb } from "./src/db";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-change-this";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // Initialize DB
  initDb();

  // --- Middleware ---
  const authenticateToken = (req: any, res: any, next: any) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized: No token provided" });

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.status(403).json({ error: "Forbidden: Invalid token" });
      req.user = user;
      next();
    });
  };

  // --- Helpers ---
  const logActivity = (userId: number | null, userName: string, actionType: string, details: string) => {
    try {
      const stmt = db.prepare("INSERT INTO activity_logs (user_id, user_name, action_type, details) VALUES (?, ?, ?, ?)");
      stmt.run(userId, userName, actionType, details);
    } catch (err) {
      console.error("Failed to log activity:", err);
    }
  };

  // --- API Routes ---

  // --- Hostel & Wing Routes ---

  // Get All Hostels
  app.get("/api/hostels", (_req, res) => {
    try {
      const hostels = db.prepare("SELECT * FROM hostels").all();
      res.json(hostels);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch hostels" });
    }
  });

  // Get Wings for a Hostel
  app.get("/api/hostels/:hostelId/wings", (req, res) => {
    const { hostelId } = req.params;
    try {
      const wings = db.prepare("SELECT * FROM wings WHERE hostel_id = ?").all(hostelId);
      res.json(wings);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch wings" });
    }
  });

  // Create Hostel (Manager Only)
  app.post("/api/manager/hostels", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'manager') return res.sendStatus(403);
    const { name } = req.body;
    try {
      const stmt = db.prepare("INSERT INTO hostels (name) VALUES (?)");
      stmt.run(name);
      res.json({ message: "Hostel created successfully" });
    } catch (err) {
      res.status(500).json({ error: "Failed to create hostel" });
    }
  });

  // Edit Hostel (Manager Only)
  app.put("/api/manager/hostels/:id", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'manager') return res.sendStatus(403);
    const { id } = req.params;
    const { name } = req.body;
    try {
      const stmt = db.prepare("UPDATE hostels SET name = ? WHERE id = ?");
      stmt.run(name, id);
      res.json({ message: "Hostel updated successfully" });
    } catch (err) {
      res.status(500).json({ error: "Failed to update hostel" });
    }
  });

  // Create Wing (Manager Only)
  app.post("/api/manager/wings", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'manager') return res.sendStatus(403);
    const { hostel_id, name } = req.body;
    try {
      const stmt = db.prepare("INSERT INTO wings (hostel_id, name) VALUES (?, ?)");
      stmt.run(hostel_id, name);
      res.json({ message: "Wing created successfully" });
    } catch (err) {
      res.status(500).json({ error: "Failed to create wing" });
    }
  });

  // Get All Wings (Manager Only)
  app.get("/api/manager/wings", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'manager') return res.sendStatus(403);
    try {
      const wings = db.prepare("SELECT * FROM wings").all();
      res.json(wings);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch wings" });
    }
  });

  // Edit Wing (Manager Only)
  app.put("/api/manager/wings/:id", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'manager') return res.sendStatus(403);
    const { id } = req.params;
    const { name, hostel_id } = req.body;
    try {
      const editWingTx = db.transaction((wingId, newName, newHostelId) => {
        // Find existing wing to see if hostel changed
        const existingWing = db.prepare("SELECT * FROM wings WHERE id = ?").get(wingId) as any;

        if (existingWing && newHostelId && existingWing.hostel_id !== Number(newHostelId)) {
          // Update the wing's hostel
          db.prepare("UPDATE wings SET name = ?, hostel_id = ? WHERE id = ?").run(newName, newHostelId, wingId);

          // If the wing moved to a new hostel, update the users table so their hostel matches the wing's new hostel
          // This applies to students (who have hostel_id/wing_id columns)
          db.prepare("UPDATE users SET hostel_id = ? WHERE wing_id = ?").run(newHostelId, wingId);

          // For wardens (who use mapping tables user_hostels / user_wings), we need to ensure the new hostel 
          // is in their user_hostels mapping if they are assigned to this wing.
          const wardensWithWing = db.prepare("SELECT user_id FROM user_wings WHERE wing_id = ?").all(wingId) as { user_id: number }[];
          for (const warden of wardensWithWing) {
            // Insert or ignore into user_hostels
            db.prepare("INSERT OR IGNORE INTO user_hostels (user_id, hostel_id) VALUES (?, ?)").run(warden.user_id, newHostelId);
          }
        } else {
          // Just update the name
          db.prepare("UPDATE wings SET name = ? WHERE id = ?").run(newName, wingId);
        }
      });

      editWingTx(id, name, hostel_id);
      res.json({ message: "Wing updated successfully" });
    } catch (err) {
      console.error("Failed to update wing:", err);
      res.status(500).json({ error: "Failed to update wing" });
    }
  });

  // Delete Hostel (Manager Only)
  app.delete("/api/manager/hostels/:id", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'manager') return res.sendStatus(403);
    const { id } = req.params;
    try {
      const deleteHostelTx = db.transaction((hostelId) => {
        // Set user hostel_id to null
        db.prepare("UPDATE users SET hostel_id = NULL WHERE hostel_id = ?").run(hostelId);
        // Set user wing_id to null if the wing belongs to this hostel
        db.prepare("UPDATE users SET wing_id = NULL WHERE wing_id IN (SELECT id FROM wings WHERE hostel_id = ?)").run(hostelId);
        // Delete from user_wings for wings belonging to this hostel
        db.prepare("DELETE FROM user_wings WHERE wing_id IN (SELECT id FROM wings WHERE hostel_id = ?)").run(hostelId);
        // Delete the wings
        db.prepare("DELETE FROM wings WHERE hostel_id = ?").run(hostelId);
        // Delete the hostel mapping
        db.prepare("DELETE FROM user_hostels WHERE hostel_id = ?").run(hostelId);
        // Delete the hostel
        db.prepare("DELETE FROM hostels WHERE id = ?").run(hostelId);
      });
      deleteHostelTx(id);
      res.json({ message: "Hostel deleted successfully" });
    } catch (err) {
      console.error("Failed to delete hostel:", err);
      res.status(500).json({ error: "Failed to delete hostel" });
    }
  });

  // Delete Wing (Manager Only)
  app.delete("/api/manager/wings/:id", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'manager') return res.sendStatus(403);
    const { id } = req.params;
    try {
      const deleteWingTx = db.transaction((wingId) => {
        // Set user wing_id to null
        db.prepare("UPDATE users SET wing_id = NULL WHERE wing_id = ?").run(wingId);
        // Delete the wing mapping
        db.prepare("DELETE FROM user_wings WHERE wing_id = ?").run(wingId);
        // Delete the wing
        db.prepare("DELETE FROM wings WHERE id = ?").run(wingId);
      });
      deleteWingTx(id);
      res.json({ message: "Wing deleted successfully" });
    } catch (err) {
      console.error("Failed to delete wing:", err);
      res.status(500).json({ error: "Failed to delete wing" });
    }
  });

  // Register
  app.post("/api/auth/register", (req, res) => {
    console.log("Register request:", req.body);
    const { full_name, uid, phone, password, hostel_id, wing_id } = req.body;

    if (!full_name || !uid || !phone || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Optional: Validate hostel_id and wing_id if provided
    // For now, we allow them to be null if not selected, or enforce on frontend

    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      const stmt = db.prepare(
        "INSERT INTO users (full_name, uid, phone, password, hostel_id, wing_id) VALUES (?, ?, ?, ?, ?, ?)"
      );
      const info = stmt.run(full_name, uid, phone, hashedPassword, hostel_id || null, wing_id || null);
      logActivity(Number(info.lastInsertRowid), full_name, 'REGISTER', `User registered with UID: ${uid}`);
      res.json({ message: "Registration successful. Please wait for gym trainer verification." });
    } catch (err: any) {
      console.error("Register error:", err);
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ error: "UID already registered" });
      }
      res.status(500).json({ error: "Database error" });
    }
  });

  // Reset Password
  app.post("/api/auth/reset-password", (req, res) => {
    const { uid, phone, new_password } = req.body;

    if (!uid || !phone || !new_password) {
      return res.status(400).json({ error: "UID, Phone Number, and New Password are required." });
    }

    try {
      // Find user matching exact UID and Phone
      const stmt = db.prepare("SELECT id FROM users WHERE uid = ? AND phone = ?");
      const user: any = stmt.get(uid, phone);

      if (!user) {
        return res.status(404).json({ error: "No account found matching this UID and Phone Number." });
      }

      // Hash the new password and update
      const hashedPassword = bcrypt.hashSync(new_password, 10);
      db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashedPassword, user.id);

      logActivity(user.id, uid, 'PASSWORD_RESET', `User reset their password via Forgot Password flow`);

      res.json({ message: "Password reset successful! You can now login with your new password." });
    } catch (err: any) {
      console.error("Reset password error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // Login
  app.post("/api/auth/login", (req, res) => {
    console.log("Login request:", req.body);
    const { uid, password } = req.body;
    const stmt = db.prepare("SELECT * FROM users WHERE uid = ?");
    const user: any = stmt.get(uid);

    if (!user) return res.status(400).json({ error: "User not found" });

    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(400).json({ error: "Invalid password" });
    }

    if (user.role === 'student' && user.is_verified === 0) {
      // Use 401 instead of 403 to avoid potential proxy interception of 403 pages
      return res.status(401).json({ error: "Account pending verification by gym trainer." });
    }

    if (user.is_blocked === 1) {
      return res.status(403).json({ error: `Account Blocked: ${user.block_reason || 'Contact Gym Trainer'}` });
    }

    const token = jwt.sign({ id: user.id, role: user.role, name: user.full_name }, JWT_SECRET, { expiresIn: "24h" });

    // AI Studio iframe requires SameSite=None and Secure=true
    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    logActivity(user.id, user.full_name, 'LOGIN', `User logged in`);
    res.json({ message: "Login successful", user: { id: user.id, role: user.role, name: user.full_name, uid: user.uid } });
  });

  // Logout
  app.post("/api/auth/logout", (_req, res) => {
    res.clearCookie("token");
    res.json({ message: "Logged out" });
  });

  // Get Current User
  app.get("/api/auth/me", authenticateToken, (req: any, res) => {
    res.json(req.user);
  });

  // --- Student Routes ---

  // Get Slots
  app.get("/api/slots", authenticateToken, (req: any, res) => {
    const today = new Date().toISOString().split('T')[0];

    const userId = req.user.id;
    const role = req.user.role;

    let slotsStmt;
    let slots;

    if (role === 'admin') {
      // If the requester is a warden, only show their own slots
      slotsStmt = db.prepare("SELECT * FROM slots WHERE warden_id = ?");
      slots = slotsStmt.all(userId);
    } else {
      // Get the student's own hostel/wing to determine their wardens
      const student = db.prepare("SELECT hostel_id, wing_id FROM users WHERE id = ?").get(userId) as any;

      // We only show slots created by Wardens mapped to this student
      const allowedWardensQuery = `
        SELECT id FROM users admin
        WHERE admin.role = 'admin' AND (
          (admin.id IN (SELECT user_id FROM user_wings WHERE wing_id = ?))
          OR (admin.id IN (SELECT user_id FROM user_hostels WHERE hostel_id = ?) AND ? IS NULL)
          OR (admin.id IN (SELECT user_id FROM user_hostels WHERE hostel_id = ?) AND NOT EXISTS (SELECT 1 FROM user_wings uw JOIN wings w ON uw.wing_id = w.id WHERE uw.user_id = admin.id AND w.hostel_id = ?))
        )
      `;

      // Get slots for these wardens
      if (student?.hostel_id || student?.wing_id) {
        slotsStmt = db.prepare(`SELECT * FROM slots WHERE warden_id IN (${allowedWardensQuery})`);
        slots = slotsStmt.all(student.wing_id, student.hostel_id, student.wing_id, student.hostel_id, student.hostel_id);
      } else {
        // If student is unassigned, maybe show no slots, or all slots without warden_id. 
        // Showing none is safer to prevent chaos.
        slots = [];
      }
    }

    // Get booking counts for today per slot (global count is fine now because slots are isolated per warden)
    const bookingsStmt = db.prepare(`
      SELECT slot_id, count(*) as count 
      FROM bookings
      WHERE booking_date = ? AND status != 'cancelled' 
      GROUP BY slot_id
    `);
    const bookings = bookingsStmt.all(today) as { slot_id: number, count: number }[];

    const bookingMap = new Map(bookings.map(b => [b.slot_id, b.count]));

    const slotsWithAvailability = slots.map((slot: any) => ({
      ...slot,
      booked_count: bookingMap.get(slot.id) || 0,
      available_spots: slot.capacity - (bookingMap.get(slot.id) || 0)
    }));

    res.json(slotsWithAvailability);
  });

  // Book Slot
  app.post("/api/bookings", authenticateToken, (req: any, res) => {
    const { slot_id } = req.body;
    const user_id = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    // Check if user already booked today
    const existingBooking = db.prepare("SELECT * FROM bookings WHERE user_id = ? AND booking_date = ? AND status != 'cancelled'").get(user_id, today);
    if (existingBooking) {
      return res.status(400).json({ error: "You have already booked a slot for today." });
    }

    // Because slots are structurally isolated, we just check global capacity on that specific slot
    const slot: any = db.prepare("SELECT * FROM slots WHERE id = ?").get(slot_id);
    if (!slot) return res.status(404).json({ error: "Slot not found" });

    // Time restriction check
    const now = new Date();
    // Use server local time assuming server timezone is correctly set to IST
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const timeInMinutes = hours * 60 + minutes;

    const slotType = slot.type || (slot.start_time.includes('AM') ? 'morning' : 'evening');

    if (slotType === 'morning') {
      if (timeInMinutes < 240 || timeInMinutes > 480) { // 4:00 AM to 8:00 AM
        return res.status(400).json({ error: "Morning slots can only be booked between 4:00 AM and 8:00 AM." });
      }
    } else if (slotType === 'evening') {
      if (timeInMinutes < 990 || timeInMinutes > 1260) { // 4:30 PM to 9:00 PM
        return res.status(400).json({ error: "Evening slots can only be booked between 4:30 PM and 9:00 PM." });
      }
    }

    const bookingCount: any = db.prepare(`
      SELECT count(*) as count FROM bookings WHERE slot_id = ? AND booking_date = ? AND status = 'booked'
    `).get(slot.id, today);

    const isFull = bookingCount.count >= slot.capacity;
    const finalStatus = isFull ? 'waitlisted' : 'booked';

    // Create booking
    try {
      const insert = db.prepare("INSERT INTO bookings (user_id, slot_id, booking_date, status) VALUES (?, ?, ?, ?)");
      insert.run(user_id, slot_id, today, finalStatus);
      logActivity(user_id, req.user.name, 'BOOKING_CREATED', `${finalStatus === 'waitlisted' ? 'Waitlisted for' : 'Booked'} slot ${slot.label} for ${today}`);
      res.json({ message: finalStatus === 'waitlisted' ? "Added to waitlist!" : "Booking confirmed!" });
    } catch (err) {
      res.status(500).json({ error: "Booking failed" });
    }
  });

  // Get My Bookings
  app.get("/api/bookings/my", authenticateToken, (req: any, res) => {
    const user_id = req.user.id;
    const bookings = db.prepare(`
      SELECT b.id, b.booking_date, b.status, b.cancellation_reason, s.start_time, s.end_time, s.label
      FROM bookings b
      JOIN slots s ON b.slot_id = s.id
      WHERE b.user_id = ?
      ORDER BY b.booking_date DESC, s.start_time ASC
    `).all(user_id);
    res.json(bookings);
  });

  // Get My Profile (Student)
  app.get("/api/student/profile", authenticateToken, (req: any, res) => {
    const user_id = req.user.id;

    try {
      // Fetch student details with their assigned hostel and wing names
      const student = db.prepare(`
        SELECT u.id, u.full_name, u.uid, u.phone, u.created_at, u.hostel_id, u.wing_id,
               h.name as hostel_name, w.name as wing_name
        FROM users u
        LEFT JOIN hostels h ON u.hostel_id = h.id
        LEFT JOIN wings w ON u.wing_id = w.id
        WHERE u.id = ?
      `).get(user_id) as any;

      if (!student) return res.status(404).json({ error: "Student not found" });

      // Fetch the assigned wardens. A warden is assigned if they are mapped to the student's hostel OR wing
      let wardens: any[] = [];
      if (student.hostel_id || student.wing_id) {
        wardens = db.prepare(`
          SELECT DISTINCT u.full_name 
          FROM users u
          WHERE u.role = 'admin' AND (
            u.id IN (SELECT user_id FROM user_wings WHERE wing_id = ?)
            OR 
            (u.id IN (SELECT user_id FROM user_hostels WHERE hostel_id = ?) AND ? IS NULL)
            OR
            (u.id IN (SELECT user_id FROM user_hostels WHERE hostel_id = ?) 
             AND NOT EXISTS (SELECT 1 FROM user_wings uw JOIN wings w ON uw.wing_id = w.id WHERE uw.user_id = u.id AND w.hostel_id = ?))
          )
        `).all(student.wing_id, student.hostel_id, student.wing_id, student.hostel_id, student.hostel_id);
      }

      res.json({
        ...student,
        warden_names: wardens.map(w => w.full_name)
      });
    } catch (err) {
      console.error("Error fetching student profile:", err);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  // --- Admin Routes ---

  // Get Dashboard Stats
  app.get("/api/admin/stats", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);

    const today = new Date().toISOString().split('T')[0];
    const wardenId = req.user.id;

    // Helper query part to check warden mapping for a student 'u'
    const wardenMappingCheck = `
      (
        u.wing_id IN (SELECT wing_id FROM user_wings WHERE user_id = ?)
        OR 
        (
          u.hostel_id IN (SELECT hostel_id FROM user_hostels WHERE user_id = ?)
          AND u.wing_id IS NULL
        )
        OR
        (
          u.hostel_id IN (SELECT hostel_id FROM user_hostels WHERE user_id = ?)
          AND NOT EXISTS (
            SELECT 1 FROM user_wings uw 
            JOIN wings w ON uw.wing_id = w.id 
            WHERE uw.user_id = ? AND w.hostel_id = u.hostel_id
          )
        )
      )
    `;

    // Total students mapped to this warden
    const totalStudents = (db.prepare(`
      SELECT count(*) as count FROM users u 
      WHERE u.role = 'student' AND ${wardenMappingCheck}
    `).get(wardenId, wardenId, wardenId, wardenId) as any).count;

    // Today's bookings for students mapped to this warden
    const todaysBookings = (db.prepare(`
      SELECT count(DISTINCT b.id) as count 
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      WHERE b.booking_date = ? AND b.status != 'cancelled'
      AND ${wardenMappingCheck}
    `).get(today, wardenId, wardenId, wardenId, wardenId) as any).count;

    // Pending verifications for students mapped to this warden
    const pendingVerifications = (db.prepare(`
      SELECT count(*) as count FROM users u 
      WHERE u.role = 'student' AND u.is_verified = 0
      AND ${wardenMappingCheck}
    `).get(wardenId, wardenId, wardenId, wardenId) as any).count;

    res.json({ totalStudents, todaysBookings, pendingVerifications });
  });

  // Get Users (with filter)
  app.get("/api/admin/users", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);

    const { filter } = req.query; // 'pending' or 'all'
    const wardenId = req.user.id;

    try {
      // Add warden filtering condition
      let baseQuery = `
      SELECT u.id, u.full_name, u.uid, u.phone, u.is_verified, u.is_blocked, u.block_reason, u.created_at,
             h.name as hostel_name, w.name as wing_name
      FROM users u
      LEFT JOIN hostels h ON u.hostel_id = h.id
      LEFT JOIN wings w ON u.wing_id = w.id
      WHERE u.role = 'student' 
      AND (
        u.wing_id IN (SELECT wing_id FROM user_wings WHERE user_id = ?)
        OR 
        (u.hostel_id IN (SELECT hostel_id FROM user_hostels WHERE user_id = ?) AND u.wing_id IS NULL)
        OR
        (u.hostel_id IN (SELECT hostel_id FROM user_hostels WHERE user_id = ?) 
         AND NOT EXISTS (SELECT 1 FROM user_wings uw JOIN wings w ON uw.wing_id = w.id WHERE uw.user_id = ? AND w.hostel_id = u.hostel_id))
      )
    `;

      const params: any[] = [wardenId, wardenId, wardenId, wardenId];
      let stmt;
      if (filter === 'pending') {
        stmt = db.prepare(`${baseQuery} AND u.is_verified = 0`);
      } else {
        stmt = db.prepare(baseQuery);
      }
      const users = stmt.all(...params);
      res.json(users);
    } catch (err) {
      console.error("Error fetching users:", err);
      res.status(500).json({ error: "Database error fetching users" });
    }
  });

  // Verify User
  app.post("/api/admin/verify", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { user_id } = req.body;

    db.prepare("UPDATE users SET is_verified = 1 WHERE id = ?").run(user_id);

    // Get user details for log
    const user: any = db.prepare("SELECT full_name FROM users WHERE id = ?").get(user_id);
    logActivity(req.user.id, req.user.name, 'USER_VERIFIED', `Verified student: ${user?.full_name}`);

    res.json({ message: "User verified successfully" });
  });

  // Block/Unblock User
  app.post("/api/admin/users/block", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { user_id, is_blocked, reason } = req.body;

    db.prepare("UPDATE users SET is_blocked = ?, block_reason = ? WHERE id = ?").run(is_blocked ? 1 : 0, reason || null, user_id);

    const user: any = db.prepare("SELECT full_name FROM users WHERE id = ?").get(user_id);
    const action = is_blocked ? 'USER_BLOCKED' : 'USER_UNBLOCKED';
    logActivity(req.user.id, req.user.name, action, `${is_blocked ? 'Blocked' : 'Unblocked'} student: ${user?.full_name}. Reason: ${reason || 'N/A'}`);

    res.json({ message: `User ${is_blocked ? 'blocked' : 'unblocked'} successfully` });
  });

  // Get Admin Profile
  app.get("/api/admin/profile", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);

    try {
      const user = db.prepare(`
        SELECT id, full_name, uid, phone, created_at 
        FROM users WHERE id = ?
      `).get(req.user.id) as any;

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Fetch mapped hostels
      const hostels = db.prepare(`
        SELECT h.id, h.name 
        FROM user_hostels uh 
        JOIN hostels h ON uh.hostel_id = h.id 
        WHERE uh.user_id = ?
      `).all(req.user.id);

      // Fetch mapped wings
      const wings = db.prepare(`
        SELECT w.id, w.name, h.name as hostel_name 
        FROM user_wings uw 
        JOIN wings w ON uw.wing_id = w.id 
        JOIN hostels h ON w.hostel_id = h.id
        WHERE uw.user_id = ?
      `).all(req.user.id);

      res.json({
        ...user,
        hostels,
        wings
      });
    } catch (err) {
      console.error("Error fetching admin profile:", err);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  // Update Booking Status (Verify/Absent/Cancel)
  app.post("/api/admin/booking/status", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { booking_id, status, reason } = req.body;
    const wardenId = req.user.id;

    if (!['attended', 'absent', 'cancelled', 'booked'].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    try {
      const originalBooking: any = db.prepare("SELECT slot_id, booking_date, status FROM bookings WHERE id = ?").get(booking_id);
      if (!originalBooking) return res.status(404).json({ error: "Booking not found" });

      const stmt = db.prepare("UPDATE bookings SET status = ?, cancellation_reason = ? WHERE id = ? AND slot_id IN (SELECT id FROM slots WHERE warden_id = ?)");
      const result = stmt.run(status, reason, booking_id, wardenId);

      if (result.changes === 0) return res.status(404).json({ error: "Booking not found or unauthorized" });

      // If a 'booked' student was cancelled, promote the next waitlisted student
      if (status === 'cancelled' && originalBooking.status === 'booked') {
        const nextInLine: any = db.prepare(`
          SELECT id, user_id FROM bookings 
          WHERE slot_id = ? AND booking_date = ? AND status = 'waitlisted' 
          ORDER BY created_at ASC LIMIT 1
        `).get(originalBooking.slot_id, originalBooking.booking_date);

        if (nextInLine) {
          db.prepare("UPDATE bookings SET status = 'booked' WHERE id = ?").run(nextInLine.id);
          // Log the promotion
          const promotedUser: any = db.prepare("SELECT full_name FROM users WHERE id = ?").get(nextInLine.user_id);
          logActivity(req.user.id, req.user.name, 'WAITLIST_PROMOTED', `Automatically promoted ${promotedUser?.full_name} from waitlist to booked for slot ${originalBooking.slot_id}`);
        }
      }

      // Log the status update
      const booking: any = db.prepare(`
        SELECT u.full_name, b.booking_date 
        FROM bookings b JOIN users u ON b.user_id = u.id 
        WHERE b.id = ?
      `).get(booking_id);
      logActivity(req.user.id, req.user.name, 'BOOKING_UPDATE', `Marked booking for ${booking?.full_name} on ${booking?.booking_date} as ${status}. Reason: ${reason || 'N/A'}`);

      res.json({ message: "Status updated successfully" });
    } catch (err) {
      console.error("Failed to update booking:", err);
      res.status(500).json({ error: "Failed to update booking" });
    }
  });

  // Get Analytics
  app.get("/api/admin/analytics", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const dateStr = threeMonthsAgo.toISOString().split('T')[0];

    // Stats for last 3 months
    const stats = db.prepare(`
      SELECT 
        SUM(CASE WHEN status = 'attended' THEN 1 ELSE 0 END) as attended,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        count(*) as total
      FROM bookings
      WHERE booking_date >= ?
    `).get(dateStr);

    // Recent Activity Logs
    const logs = db.prepare(`
      SELECT * FROM activity_logs 
      ORDER BY created_at DESC 
      LIMIT 50
    `).all();

    res.json({ stats, logs });
  });

  // Get Shift Data (for admin dashboard tables)
  app.get("/api/admin/shifts", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);

    const { date } = req.query;
    const targetDate = (date as string) || new Date().toISOString().split('T')[0];
    const wardenId = req.user.id;

    // A warden should only see shifts (slots) they created
    const slots = db.prepare("SELECT * FROM slots WHERE warden_id = ?").all(wardenId);

    const shiftsData = slots.map((slot: any) => {
      // Include booking ID and status
      // We no longer need wardenMappingCheck for bookings here because the slot itself isolates the users
      const bookings = db.prepare(`
        SELECT b.id as booking_id, b.status, b.cancellation_reason, u.full_name, u.uid, u.phone 
        FROM bookings b
        JOIN users u ON b.user_id = u.id
        WHERE b.slot_id = ? AND b.booking_date = ?
      `).all(slot.id, targetDate);

      return {
        ...slot,
        bookings
      };
    });

    res.json(shiftsData);
  });

  // --- Manager Routes ---

  // Get Wardens (Admins)
  app.get("/api/manager/wardens", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'manager') return res.sendStatus(403);

    try {
      const wardens = db.prepare("SELECT id, full_name, uid, phone, created_at FROM users WHERE role = 'admin'").all();

      const wardensData = wardens.map((w: any) => {
        const hostels = db.prepare("SELECT hostel_id FROM user_hostels WHERE user_id = ?").all(w.id);
        const wings = db.prepare("SELECT wing_id FROM user_wings WHERE user_id = ?").all(w.id);
        return {
          ...w,
          hostel_ids: hostels.map((h: any) => h.hostel_id),
          wing_ids: wings.map((wi: any) => wi.wing_id)
        };
      });

      res.json(wardensData);
    } catch (err) {
      console.error("Error fetching wardens:", err);
      res.status(500).json({ error: "Failed to fetch wardens" });
    }
  });

  // Create Warden
  app.post("/api/manager/wardens", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'manager') return res.sendStatus(403);
    const { full_name, uid, phone, password, hostel_ids, wing_ids } = req.body;

    if (!full_name || !uid || !phone || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    try {
      const hashedPassword = bcrypt.hashSync(password, 10);

      const insertWarden = db.transaction(() => {
        const stmt = db.prepare(
          "INSERT INTO users (full_name, uid, phone, password, role, is_verified) VALUES (?, ?, ?, ?, 'admin', 1)"
        );
        const info = stmt.run(full_name, uid, phone, hashedPassword);
        const userId = info.lastInsertRowid;

        if (hostel_ids && Array.isArray(hostel_ids)) {
          const stmtHostel = db.prepare("INSERT INTO user_hostels (user_id, hostel_id) VALUES (?, ?)");
          for (const hid of hostel_ids) {
            stmtHostel.run(userId, hid);
          }
        }

        if (wing_ids && Array.isArray(wing_ids)) {
          const stmtWing = db.prepare("INSERT INTO user_wings (user_id, wing_id) VALUES (?, ?)");
          for (const wid of wing_ids) {
            stmtWing.run(userId, wid);
          }
        }

        return userId;
      });

      insertWarden();

      logActivity(req.user.id, req.user.name, 'WARDEN_CREATED', `Created warden: ${full_name} (${uid})`);
      res.json({ message: "Warden created successfully" });
    } catch (err: any) {
      console.error("Create warden error:", err);
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ error: "UID already exists" });
      }
      res.status(500).json({ error: "Failed to create warden" });
    }
  });

  // Update Warden
  app.put("/api/manager/wardens/:id", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'manager') return res.sendStatus(403);
    const { id } = req.params;
    const { full_name, uid, phone, hostel_ids, wing_ids } = req.body;

    if (!full_name || !uid || !phone) {
      return res.status(400).json({ error: "Full name, UID, and phone are required" });
    }

    try {
      const updateWarden = db.transaction(() => {
        const stmt = db.prepare(
          "UPDATE users SET full_name = ?, uid = ?, phone = ? WHERE id = ? AND role = 'admin'"
        );
        stmt.run(full_name, uid, phone, id);

        db.prepare("DELETE FROM user_hostels WHERE user_id = ?").run(id);
        if (hostel_ids && Array.isArray(hostel_ids)) {
          const stmtHostel = db.prepare("INSERT INTO user_hostels (user_id, hostel_id) VALUES (?, ?)");
          for (const hid of hostel_ids) {
            stmtHostel.run(id, hid);
          }
        }

        db.prepare("DELETE FROM user_wings WHERE user_id = ?").run(id);
        if (wing_ids && Array.isArray(wing_ids)) {
          const stmtWing = db.prepare("INSERT INTO user_wings (user_id, wing_id) VALUES (?, ?)");
          for (const wid of wing_ids) {
            stmtWing.run(id, wid);
          }
        }
      });

      updateWarden();

      logActivity(req.user.id, req.user.name, 'WARDEN_UPDATED', `Updated warden: ${full_name} (${uid})`);
      res.json({ message: "Warden updated successfully" });
    } catch (err: any) {
      console.error("Update warden error:", err);
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ error: "UID already exists" });
      }
      res.status(500).json({ error: "Failed to update warden" });
    }
  });

  // Get Students (Manager View)
  app.get("/api/manager/students", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'manager') return res.sendStatus(403);

    try {
      const students = db.prepare(`
        SELECT u.id, u.full_name, u.uid, u.phone, u.is_verified, u.is_blocked, u.created_at,
    h.name as hostel_name, w.name as wing_name,
    u.hostel_id, u.wing_id
        FROM users u
        LEFT JOIN hostels h ON u.hostel_id = h.id
        LEFT JOIN wings w ON u.wing_id = w.id
        WHERE u.role = 'student'
    `).all();
      res.json(students);
    } catch (err) {
      console.error("Error fetching students:", err);
      res.status(500).json({ error: "Failed to fetch students" });
    }
  });

  // --- Slot Management Routes ---

  // Create Slot
  app.post("/api/admin/slots", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { start_time, end_time, capacity, label, type } = req.body;

    if (!start_time || !end_time || !capacity || !label || !type) {
      return res.status(400).json({ error: "All fields are required" });
    }

    try {
      // Set the warden_id to the user making the request
      const stmt = db.prepare("INSERT INTO slots (start_time, end_time, capacity, label, type, warden_id) VALUES (?, ?, ?, ?, ?, ?)");
      stmt.run(start_time, end_time, capacity, label, type, req.user.id);
      logActivity(req.user.id, req.user.name, 'SLOT_CREATED', `Created slot: ${label} (${start_time} -${end_time})`);
      res.json({ message: "Slot created successfully" });
    } catch (err) {
      console.error("Create slot error:", err);
      res.status(500).json({ error: "Failed to create slot" });
    }
  });

  // Update Slot
  app.put("/api/admin/slots/:id", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { id } = req.params;
    const { start_time, end_time, capacity, label, type } = req.body;

    try {
      // Make sure we only update slots belonging to this warden
      const stmt = db.prepare("UPDATE slots SET start_time = ?, end_time = ?, capacity = ?, label = ?, type = ? WHERE id = ? AND warden_id = ?");
      const info = stmt.run(start_time, end_time, capacity, label, type, id, req.user.id);

      if (info.changes === 0) {
        return res.status(404).json({ error: "Slot not found or unauthorized" });
      }

      logActivity(req.user.id, req.user.name, 'SLOT_UPDATED', `Updated slot ID ${id}: ${label} `);
      res.json({ message: "Slot updated successfully" });
    } catch (err) {
      console.error("Update slot error:", err);
      res.status(500).json({ error: "Failed to update slot" });
    }
  });

  // Delete Slot
  app.delete("/api/admin/slots/:id", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { id } = req.params;

    try {
      // Ensure the warden owns this slot
      const checkSlot: any = db.prepare("SELECT warden_id FROM slots WHERE id = ?").get(id);
      if (!checkSlot || checkSlot.warden_id !== req.user.id) {
        return res.status(404).json({ error: "Slot not found or unauthorized" });
      }

      // Check for existing bookings
      const bookingsCount = (db.prepare("SELECT count(*) as count FROM bookings WHERE slot_id = ?").get(id) as any).count;
      if (bookingsCount > 0) {
        return res.status(400).json({ error: "Cannot delete slot with existing bookings. Cancel bookings first." });
      }

      const stmt = db.prepare("DELETE FROM slots WHERE id = ?");
      stmt.run(id);
      logActivity(req.user.id, req.user.name, 'SLOT_DELETED', `Deleted slot ID ${id} `);
      res.json({ message: "Slot deleted successfully" });
    } catch (err) {
      console.error("Delete slot error:", err);
      res.status(500).json({ error: "Failed to delete slot" });
    }
  });


  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("Vite middleware initialized");
    } catch (e) {
      console.error("Failed to start Vite middleware", e);
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
