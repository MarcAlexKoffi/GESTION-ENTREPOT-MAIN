const mysql = require("mysql2/promise");
const path = require("path");

// Robust .env loading
const envPath = path.resolve(__dirname, "../../.env");
require("dotenv").config({ path: envPath });

// Debug logs to help diagnose 503 errors (check Passenger logs)
console.log("DB Config Loading...");
console.log("Looking for excessive .env file at:", envPath);
console.log("DB_HOST from env:", process.env.DB_HOST);
console.log("DB_USER from env:", process.env.DB_USER);

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "gestionentrepots",
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Add SSL configuration only if explicitly enabled
if (process.env.DB_SSL === "true") {
  dbConfig.ssl = { rejectUnauthorized: false };
}

const pool = mysql.createPool(dbConfig);

// Critical: Handle pool errors to prevent process crash
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // process.exit(-1); // Don't exit, let it try to reconnect or fail gracefully
});

// Test the connection inside an async function to log success/error early
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log("✅ Database connection successful!");
    connection.release();
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
  }
})();

module.exports = pool;
