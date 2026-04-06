const mysql = require("mysql2");

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "root",
    database: "edumatch"
});

db.connect((err) => {
    if (err) {
        console.log("DB Error ❌", err);
    } else {
        console.log("DB Connected ✅");
    }
});

module.exports = db;