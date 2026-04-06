const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

const requireAuth = (req, res, next) => {
    console.log("Session check:", req.session.user);
    if (!req.session.user) {
        return res.redirect("/login");
    }
    next();
};
router.get("/register", userController.showRegister);
router.post("/register", userController.registerUser);

router.get("/login", userController.showLogin);
router.post("/login", userController.loginUser);

router.get("/dashboard", requireAuth, userController.showDashboard);
router.get("/profile", requireAuth, userController.showProfile);
router.get("/college/:id", requireAuth, userController.showCollegeDetail);
router.get("/search", requireAuth, userController.searchColleges);
router.get("/save/:id", requireAuth, userController.saveCollege);
router.get("/saved", requireAuth, userController.savedColleges);
router.get("/unsave/:id", requireAuth, userController.unsaveCollege);
router.get("/feedback", requireAuth, userController.showFeedback);
router.post("/feedback", requireAuth, userController.submitFeedback);

router.get("/logout", userController.logoutUser);

module.exports = router;