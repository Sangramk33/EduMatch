const db = require("../config/db");
const bcrypt = require("bcrypt");

// ================= ADMIN LOGIN =================
exports.loginAdmin = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.render("admin/adminLogin", { error: "All fields are required." });
    }

    try {
        // Step 1: Student table मध्ये email आहे का check करा
        const studentSql = "SELECT * FROM usermaster WHERE email = ?";
        const [studentRows] = await db.promise().query(studentSql, [email]);

        if (studentRows.length > 0) {
            // Email student चं आहे — password match होतो का बघा
            const isStudentPassword = await bcrypt.compare(password, studentRows[0].password);
            if (isStudentPassword) {
                return res.render("admin/adminLogin", {
                    error: "⚠️ This login is for Admin only. Please use Student Login."
                });
            }
        }

        // Step 2: Admin table मध्ये check करा
        const adminSql = "SELECT * FROM admins WHERE email = ?";
        const [adminRows] = await db.promise().query(adminSql, [email]);

        if (adminRows.length === 0) {
            return res.render("admin/adminLogin", { error: "Invalid email or password." });
        }

        const admin = adminRows[0];
        const match = await bcrypt.compare(password, admin.password);

        if (match) {
    req.session.admin = admin;
    req.session.save((err) => {
        if (err) {
            return res.render("admin/adminLogin", { error: "Session error. Try again." });
        }
        res.redirect("/admin/dashboard");
    });
} else {
            return res.render("admin/adminLogin", { error: "Invalid email or password." });
        }

    } catch (err) {
        console.error("Admin Login Error:", err);
        res.render("admin/adminLogin", { error: "Something went wrong. Try again." });
    }
};
exports.logoutAdmin = (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.send("Error logging out.");
        res.clearCookie('connect.sid');
        res.redirect("/admin/login");
    });
};

// ================= ADMIN DASHBOARD =================
exports.showDashboard = (req, res) => {
    const admin = req.session.admin;
    
    // ✅ No cache — refresh केल्यावर session check होईल
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');

    const studentSql = "SELECT COUNT(*) AS total FROM usermaster";
    const collegeSql = "SELECT COUNT(*) AS total FROM collegemaster";
    const feedbackSql = "SELECT COUNT(*) AS total FROM feedback WHERE admin_reply IS NULL";

    db.query(studentSql, (err, students) => {
        db.query(collegeSql, (err, colleges) => {
            db.query(feedbackSql, (err, feedbacks) => {
                res.render("admin/adminDashboard", {
                    admin,
                    totalStudents: students[0].total,
                    totalColleges: colleges[0].total,
                    pendingFeedbacks: feedbacks[0].total
                });
            });
        });
    });
};
// ================= STUDENTS =================
exports.showStudents = (req, res) => {
    const admin = req.session.admin;
    const sql = "SELECT id, name, email, mobile, cet_percentage, city, graduation FROM usermaster ORDER BY id DESC";

    db.query(sql, (err, students) => {
        if (err) return res.render("admin/students", { admin, students: [] });
        res.render("admin/students", { admin, students });
    });
};

exports.deleteStudent = (req, res) => {
    const studentId = req.params.id;

    db.query("DELETE FROM savedcolleges WHERE user_id = ?", [studentId]);
    db.query("DELETE FROM feedback WHERE user_id = ?", [studentId]);
    db.query("DELETE FROM usermaster WHERE id = ?", [studentId], (err) => {
        if (err) console.error("Delete Student Error:", err);
        res.redirect("/admin/students");
    });
};

// ================= COLLEGES =================
exports.showColleges = (req, res) => {
    const admin = req.session.admin;
    const sql = `
        SELECT c.*, m.cutoff_percentage 
        FROM collegemaster c
        LEFT JOIN meritlist m ON c.id = m.college_id
        ORDER BY c.id DESC
    `;

    db.query(sql, (err, colleges) => {
        if (err) return res.render("admin/colleges", { admin, colleges: [] });
        res.render("admin/colleges", { admin, colleges });
    });
};

exports.addCollege = (req, res) => {
    const { name, city, course, cutoff_percentage, website } = req.body;

    // ✅ Checkboxes — checked असेल तर 1, नसेल तर 0
    const hostel  = req.body.hostel  ? 1 : 0;
    const labs    = req.body.labs    ? 1 : 0;
    const library = req.body.library ? 1 : 0;
    const sports  = req.body.sports  ? 1 : 0;
    const canteen = req.body.canteen ? 1 : 0;
    const wifi    = req.body.wifi    ? 1 : 0;

    // ✅ website पण save करा
    const sql = "INSERT INTO collegemaster (name, city, course, website) VALUES (?, ?, ?, ?)";
    db.query(sql, [name, city, course, website || null], (err, result) => {
        if (err) {
            console.error("Add College Error:", err);
            return res.redirect("/admin/colleges");
        }

        const collegeId = result.insertId;

        const meritSql = "INSERT INTO meritlist (college_id, year, cutoff_percentage) VALUES (?, 2024, ?)";
        db.query(meritSql, [collegeId, cutoff_percentage], (err) => {
            if (err) console.error("Merit Error:", err);

            const amenitySql = `INSERT INTO collegeamenities 
                (college_id, hostel, labs, library, sports, canteen, wifi) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`;
            db.query(amenitySql, [collegeId, hostel, labs, library, sports, canteen, wifi], (err) => {
                if (err) console.error("Amenity Error:", err);
                res.redirect("/admin/colleges");
            });
        });
    });
};

exports.deleteCollege = (req, res) => {
    const collegeId = req.params.id;

    db.query("DELETE FROM meritlist WHERE college_id = ?", [collegeId]);
    db.query("DELETE FROM collegeamenities WHERE college_id = ?", [collegeId]);
    db.query("DELETE FROM savedcolleges WHERE college_id = ?", [collegeId]);
    db.query("DELETE FROM collegemaster WHERE id = ?", [collegeId], (err) => {
        if (err) console.error("Delete College Error:", err);
        res.redirect("/admin/colleges");
    });
};

// ================= FEEDBACK =================
exports.showFeedback = (req, res) => {
    const admin = req.session.admin;
    const sql = `
        SELECT f.*, u.name AS student_name 
        FROM feedback f
        JOIN usermaster u ON f.user_id = u.id
        ORDER BY f.created_at DESC
    `;

    db.query(sql, (err, feedbacks) => {
        if (err) return res.render("admin/feedback", { admin, feedbacks: [] });
        res.render("admin/feedback", { admin, feedbacks });
    });
};

exports.replyFeedback = (req, res) => {
    const feedbackId = req.params.id;
    const { reply } = req.body;

    const sql = "UPDATE feedback SET admin_reply = ? WHERE id = ?";
    db.query(sql, [reply, feedbackId], (err) => {
        if (err) console.error("Reply Error:", err);
        res.redirect("/admin/feedback");
    });

    

};
exports.showLogin = (req, res) => {
    res.render("admin/adminLogin", { error: null });
};