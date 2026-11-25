// middleware/errorHandler.js – centralised error handling (ADR-0001 §12.5, §12.7: D9, D18, D22)
//
// The existing mappings are unchanged. Then:
//  * a 500 gets one fixed generic body in every environment, with no error message, stack
//    trace, database detail or internal code (D9). The one exception is the blocked-CORS error,
//    recognised only by the marker from utils/corsBlockedError.js: its body stays exactly as
//    before, with no stack field (D18);
//  * every other status keeps its existing body;
//  * one safe structured line is logged per handled error (D22): the event, the final status,
//    the method, the matched route template (or "unmatched") and the error's safe description,
//    never its message, a stack trace, stored values, the URL, the query string, headers or body;
//  * if building the response fails, the generic 500 is sent instead. If a response has already
//    been sent, nothing more is sent. The error is never passed on to Express, whose default
//    handler would print its message and stack.
const { getEmailDeliveryError } = require('../utils/emailDeliveryError');
const { isCorsBlockedError } = require('../utils/corsBlockedError');
const { describeError, emitSafeLine } = require('../utils/transactions');

const ERROR_HANDLER_EVENT = 'http.error_handled';
const GENERIC_500_MESSAGE = 'Something went wrong. Check the result before trying again.';
const genericResponse = () => ({ statusCode: 500, body: { success: false, message: GENERIC_500_MESSAGE } });

// The existing mappings, followed by the D9 and D18 rules for a 500.
const mapError = err => {
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
    message = `Invalid ID format: ${err.value}`;
  }

  // JWT errors (caught in middleware, but just in case)
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token.';
  }

  if (statusCode === 500) {
    // D18: the blocked-CORS body stays exactly as before, in every environment.
    if (isCorsBlockedError(err)) return { statusCode, body: { success: false, message } };
    return genericResponse(); // D9
  }

  return {
    statusCode,
    body: {
      success: false,
      message,
      ...(responseCode && { code: responseCode }),
      ...(typeof err.code === 'string' && err.code.startsWith('OFFLINE_') && { code: err.code }),
      ...(err.conflictDetails && { conflictDetails: err.conflictDetails }),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  };
};

// The matched route template, for example "/api/products/:id", from Express 4's router: the
// matched route's own path, plus the static mount path of the app-level router that holds it,
// read from that router's matcher. Never the concrete URL, query string or parameter values:
// anything that cannot be established from the templates gives "unmatched".
const STATIC_MOUNT = /^\^((?:\\\/[A-Za-z0-9_-]+)+)\\\/\?\(\?=\\\/\|\$\)$/;
const ROUTE_TEMPLATE = /^\/[A-Za-z0-9/_:.-]*$/;

const routeTemplateOf = req => {
  try {
    const route = req?.route;
    const stack = req?.app?._router?.stack;
    if (!route || typeof route.path !== 'string' || !Array.isArray(stack)) return 'unmatched';
    let template;
    for (const layer of stack) {
      if (layer.route === route) {
        template = route.path;
        break;
      }
      if (Array.isArray(layer.handle?.stack) && layer.handle.stack.some(entry => entry.route === route)) {
        const mount = STATIC_MOUNT.exec(layer.regexp?.source ?? '');
        if (mount) template = mount[1].replace(/\\\//g, '/') + (route.path === '/' ? '' : route.path);
        break;
      }
    }
    return typeof template === 'string' && ROUTE_TEMPLATE.test(template) ? template : 'unmatched';
  } catch {
    return 'unmatched';
  }
};

const METHOD = /^[A-Z][A-Z-]{0,15}$/;

const safeStatus = (value, fallback) =>
  (Number.isInteger(value) && value >= 100 && value <= 999 ? value : fallback);

const methodOf = req => {
  try {
    return typeof req?.method === 'string' && METHOD.test(req.method) ? req.method : 'UNKNOWN';
  } catch {
    return 'UNKNOWN';
  }
};

// The D22 line: always exactly these five fields. A status that cannot be read safely is logged
// as 500, and a method that cannot be read safely as "UNKNOWN".
const errorLine = (err, req, status) => ({
  event: ERROR_HANDLER_EVENT,
  status: safeStatus(status, 500),
  method: methodOf(req),
  route: routeTemplateOf(req),
  error: describeError(err)
});

const errorHandler = (err, req, res, next) => {
  // Set before any response attempt, so the line always has a status: 500 until a different
  // status is known to be intended or sent.
  let status = 500;
  try {
    if (res.headersSent) {
      // A response was already sent: never a second one. An unfinished one is closed.
      status = safeStatus(res.statusCode, 500);
      if (!res.writableEnded) res.destroy();
      return;
    }
    let response;
    try {
      response = mapError(err);
      JSON.stringify(response.body); // a body that cannot be serialized also gets the generic 500
    } catch {
      response = genericResponse();
    }
    status = safeStatus(response.statusCode, 500); // the intended status
    try {
      res.status(response.statusCode).json(response.body);
      status = safeStatus(res.statusCode, status); // the status actually sent
    } catch {
      if (res.headersSent) {
        // The response went out before the failure: never a second one.
        status = safeStatus(res.statusCode, status);
        if (!res.writableEnded) res.destroy();
      } else {
        status = 500; // the generic 500 fallback, recorded even if sending it fails too
        res.status(500).json(genericResponse().body);
      }
    }
  } catch {
    // Error handling must never throw, so close the response if it is still open.
    try {
      if (!res.writableEnded) res.destroy();
    } catch {
      // Nothing more can be done safely.
    }
  } finally {
    try {
      emitSafeLine(errorLine(err, req, status));
    } catch {
      // Logging must never throw.
    }
  }
};

module.exports = errorHandler;
