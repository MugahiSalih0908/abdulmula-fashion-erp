// middleware/errorHandler.js – centralised error handling
const { getEmailDeliveryError } = require('../utils/emailDeliveryError');

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message    = err.message    || 'Internal Server Error';
  let responseCode;

  if (typeof err.code === 'string' && err.code.startsWith('EMAIL_')) {
    const safeEmailError = getEmailDeliveryError(err);
    message = safeEmailError.message;
    responseCode = safeEmailError.code;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message    = Object.values(err.errors).map(e => e.message).join('. ');
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`;
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format.';
  }

  // Never return raw internal exception messages to production clients.
  // Keep explicit, validated 4xx messages above, but hide unexpected server failures.
  if (statusCode >= 500 && process.env.NODE_ENV === 'production') {
    message = 'An unexpected server error occurred. Please try again or contact an administrator.';
  }

  // JWT errors (caught in middleware, but just in case)
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token.';
  }

  console.error(`[${new Date().toISOString()}] ${statusCode} – ${message}`, err.stack);

  res.status(statusCode).json({
    success: false,
    message,
    ...(responseCode && { code: responseCode }),
    ...(typeof err.code === 'string' && err.code.startsWith('OFFLINE_') && { code: err.code }),
    ...(err.conflictDetails && { conflictDetails: err.conflictDetails }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;
