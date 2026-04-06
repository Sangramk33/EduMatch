const db = require("../config/db");
const bcrypt = require("bcrypt");

// ================= REGISTER =================
exports.showRegister = (req, res) => {
    res.render("register", { error: null });
};

exports.registerUser = async (req, res) => {
    const { name, email, mobile, cet_percentage, city, graduation, password } = req.body;

    if (!name || !email || !mobile || !cet_percentage || !city || !graduation || !password) {
        return res.render("register", { error: "All fields are required." });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = `INSERT INTO usermaster 
            (name, email, mobile, cet_percentage, city, graduation, password) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`;

        db.query(sql, [name, email, mobile, cet_percentage, city, graduation, hashedPassword], (err) => {
            if (err) {
                console.error("Register Error:", err);
                return res.render("register", { error: "Email already exists." });
            }
            res.redirect("/login");
        });

    } catch (err) {
        console.error("Hash Error:", err);
        res.render("register", { error: "Something went wrong." });
    }
};

// ================= LOGIN =================
exports.showLogin = (req, res) => {
    res.render("login", { error: null });
};

exports.loginUser = (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.render("login", { error: "All fields are required." });
    }

    const sql = "SELECT * FROM usermaster WHERE email = ?";

    db.query(sql, [email], async (err, result) => {
        if (err) return res.render("login", { error: "DB error." });

        if (result.length === 0) {
            return res.render("login", { error: "Invalid email or password." });
        }

        const user = result[0];
        const match = await bcrypt.compare(password, user.password);

        if (match) {
            req.session.user = user;
            req.session.save((err) => {
                if (err) {
                    console.error("Session save error:", err);
                    return res.render("login", { error: "Session error. Try again." });
                }
                res.redirect("/dashboard");
            });
        } else {
            return res.render("login", { error: "Invalid email or password." });
        }
    });
};

// ================= DASHBOARD =================
exports.showDashboard = (req, res) => {
    const student = req.session.user;

    const sql = `
        SELECT c.*, m.cutoff_percentage,
        CASE 
            WHEN ? >= m.cutoff_percentage + 5 THEN 'Safe'
            WHEN ? >= m.cutoff_percentage THEN 'Moderate'
            ELSE 'Difficult'
        END AS chances
        FROM collegemaster c
        LEFT JOIN meritlist m ON c.id = m.college_id
        WHERE c.course = 'MCA'
        ORDER BY m.cutoff_percentage ASC
    `;

    db.query(sql, [student.cet_percentage, student.cet_percentage], (err, colleges) => {
        if (err) {
            console.error("Dashboard Error:", err);
            return res.render("dashboard", { student, colleges: [] });
        }
        res.render("dashboard", { student, colleges });
    });
};

// ================= PROFILE =================
exports.showProfile = (req, res) => {
    res.render("profile", { student: req.session.user });
};

// ================= LOGOUT =================
exports.logoutUser = (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.send("Error logging out.");
        res.clearCookie('connect.sid');
        res.redirect("/login");
    });
};

// ================= SEARCH =================
exports.searchColleges = (req, res) => {
    const student = req.session.user;
    const { type, percentage, collegename, city, course } = req.query;

    let sql = "";
    let params = [];

    if (type === 'cet') {
        sql = `
            SELECT c.*, m.cutoff_percentage,
            CASE 
                WHEN ? >= m.cutoff_percentage + 5 THEN 'Safe'
                WHEN ? >= m.cutoff_percentage THEN 'Moderate'
                ELSE 'Difficult'
            END AS chances
            FROM collegemaster c
            LEFT JOIN meritlist m ON c.id = m.college_id
            WHERE c.course = 'MCA'
            AND m.cutoff_percentage <= ?
            ORDER BY m.cutoff_percentage DESC
        `;
        params = [percentage, percentage, percentage];

    } else if (type === 'name') {
        sql = `
            SELECT c.*, m.cutoff_percentage, 'N/A' AS chances
            FROM collegemaster c
            LEFT JOIN meritlist m ON c.id = m.college_id
            WHERE c.name LIKE ? AND c.course = 'MCA'
        `;
        params = ['%' + collegename + '%'];

    } else if (type === 'city') {
        sql = `
            SELECT c.*, m.cutoff_percentage, 'N/A' AS chances
            FROM collegemaster c
            LEFT JOIN meritlist m ON c.id = m.college_id
            WHERE c.city LIKE ? AND c.course = 'MCA'
        `;
        params = ['%' + city + '%'];

    } else if (type === 'course') {
        sql = `
            SELECT c.*, m.cutoff_percentage, 'N/A' AS chances
            FROM collegemaster c
            LEFT JOIN meritlist m ON c.id = m.college_id
            WHERE c.course = ?
        `;
        params = [course];
    }

    db.query(sql, params, (err, colleges) => {
        if (err) {
            console.error("Search Error:", err);
            return res.render("dashboard", { student, colleges: [], searchType: type });
        }
        res.render("dashboard", { student, colleges, searchType: type });
    });
};

// ================= COLLEGE DETAIL =================
exports.showCollegeDetail = (req, res) => {
    const collegeId = req.params.id;
    const student = req.session.user;

    const sql = `
        SELECT c.*, m.cutoff_percentage, a.hostel, a.labs, 
               a.library, a.sports, a.canteen, a.wifi
        FROM collegemaster c
        LEFT JOIN meritlist m ON c.id = m.college_id
        LEFT JOIN collegeamenities a ON c.id = a.college_id
        WHERE c.id = ?
    `;

    db.query(sql, [collegeId], (err, result) => {
        if (err) {
            console.error("DB Error:", err);
            return res.redirect("/dashboard");
        }
        if (result.length === 0) {
            return res.redirect("/dashboard");
        }
        res.render("collegeDetail", { college: result[0], student });
    });
};

// ================= SAVE COLLEGE =================
exports.saveCollege = (req, res) => {
    const collegeId = req.params.id;
    const userId = req.session.user.id;

    const checkSql = "SELECT * FROM savedcolleges WHERE user_id = ? AND college_id = ?";
    db.query(checkSql, [userId, collegeId], (err, result) => {
        if (err) return res.redirect("/dashboard");

        if (result.length > 0) {
            return res.redirect("/saved");
        }

        const sql = "INSERT INTO savedcolleges (user_id, college_id) VALUES (?, ?)";
        db.query(sql, [userId, collegeId], (err) => {
            if (err) {
                console.error("Save Error:", err);
                return res.redirect("/dashboard");
            }
            res.redirect("/saved");
        });
    });
};

// ================= SAVED COLLEGES =================
exports.savedColleges = (req, res) => {
    const userId = req.session.user.id;
    const student = req.session.user;

    const sql = `
        SELECT c.*, m.cutoff_percentage, s.saved_at
        FROM savedcolleges s
        JOIN collegemaster c ON s.college_id = c.id
        LEFT JOIN meritlist m ON c.id = m.college_id
        WHERE s.user_id = ?
        ORDER BY s.saved_at DESC
    `;

    db.query(sql, [userId], (err, colleges) => {
        if (err) {
            console.error("Saved Error:", err);
            return res.render("savedColleges", { student, colleges: [] });
        }
        res.render("savedColleges", { student, colleges });
    });
};

// ================= UNSAVE COLLEGE =================
exports.unsaveCollege = (req, res) => {
    const collegeId = req.params.id;
    const userId = req.session.user.id;

    const sql = "DELETE FROM savedcolleges WHERE user_id = ? AND college_id = ?";
    db.query(sql, [userId, collegeId], (err) => {
        if (err) console.error("Unsave Error:", err);
        res.redirect("/saved");
    });
};

// ================= FEEDBACK =================
exports.showFeedback = (req, res) => {
    const student = req.session.user;

    const sql = "SELECT * FROM feedback WHERE user_id = ? ORDER BY created_at DESC";
    db.query(sql, [student.id], (err, feedbacks) => {
        if (err) {
            console.error("Feedback Error:", err);
            return res.render("feedback", { student, feedbacks: [] });
        }
        res.render("feedback", { student, feedbacks });
    });
};

exports.submitFeedback = (req, res) => {
    const student = req.session.user;
    const { message } = req.body;

    if (!message) return res.redirect("/feedback");

    const sql = "INSERT INTO feedback (user_id, message) VALUES (?, ?)";
    db.query(sql, [student.id, message], (err) => {
        if (err) {
            console.error("Submit Feedback Error:", err);
            return res.redirect("/feedback");
        }
        res.redirect("/feedback");
    });
};