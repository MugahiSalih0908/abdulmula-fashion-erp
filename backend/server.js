// server.js – Abdulmula Fashion ERP v6 — Production Backend
// NO public register endpoint
//
// Process entry point. Responsible only for loading environment configuration,
// connecting to MongoDB and starting the HTTP server. The Express application
// itself (middleware, routes, error handling) is built by createApp() in app.js.

require('dotenv').config();


const connectDB     = require('./config/db');
const { createApp } = require('./app');

const PORT = process.env.PORT || 5000;

connectDB();

const app = createApp();

app.listen(PORT, () => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 Abdulmula Fashion ERP API');
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`📡 Port: ${PORT}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});
module.exports = app;
