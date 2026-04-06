const express = require("express");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const path = require("path");
const app = express();

const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");

const sessionStore = new MySQLStore({
    host: "localhost",
    user: "root",
    password: "root",
    database: "edumatch"
});

app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
    secret: "edumatchSecret",
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: { 
        maxAge: 1000 * 60 * 60 * 24,
        httpOnly: true
    }
}));

app.get("/", (req, res) => {
    res.redirect("/login");
});

app.use("/", userRoutes);
app.use("/admin", adminRoutes);

app.listen(3000, () => {
    console.log("Server started on http://localhost:3000");
});