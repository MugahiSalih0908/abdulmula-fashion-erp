'use strict';
// utils/corsBlockedError.js – the blocked-CORS error (ADR-0001 §12.7, D18)
//
// app.js's CORS check creates its rejection only through createCorsBlockedError(). The error has
// exactly the existing message and carries a marker: a symbol private to this module, so no
// other code can mark an error and no message text is ever used to recognise it.
// errorHandler.js gives the unchanged D18 response only to a marked error; every other error,
// including one whose message starts with the same words, is handled like any other error.

const CORS_BLOCKED = Symbol('corsBlocked');

const createCorsBlockedError = origin => {
  const error = new Error(`CORS blocked: ${origin}`);
  error.name = 'CorsBlockedError';
  // Read-only and not enumerable, so a copy of the error is never marked.
  Object.defineProperty(error, CORS_BLOCKED, { value: true });
  return error;
};

const isCorsBlockedError = error =>
  error !== null && typeof error === 'object' && error[CORS_BLOCKED] === true;

module.exports = { createCorsBlockedError, isCorsBlockedError };
