const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");

const requireAdmin = (req, res, next) => {
    if (!req.session.admin) {
        return res.redirect("/admin/login");
    }
    next();
};

router.get("/login", adminController.showLogin);
router.post("/login", adminController.loginAdmin);
router.get("/logout", adminController.logoutAdmin);

router.get("/dashboard", requireAdmin, adminController.showDashboard);
router.get("/students", requireAdmin, adminController.showStudents);
router.get("/delete-student/:id", requireAdmin, adminController.deleteStudent);
router.get("/colleges", requireAdmin, adminController.showColleges);
router.post("/add-college", requireAdmin, adminController.addCollege);
router.get("/delete-college/:id", requireAdmin, adminController.deleteCollege);
router.get("/feedback", requireAdmin, adminController.showFeedback);
router.post("/reply-feedback/:id", requireAdmin, adminController.replyFeedback);

module.exports = router;