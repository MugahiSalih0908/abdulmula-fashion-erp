const SENSITIVE_PATHS = [
  [/^\\/api\\/auth\\/activate\\/[^/]+(?:\\/|$)/, '/api/auth/activate/[REDACTED]'],
  [/^\\/api\\/auth\\/reset-password\\/[^/]+(?:\\/|$)/, '/api/auth/reset-password/[REDACTED]'],
  [/^\\/api\\/invitations\\/validate\\/[^/]+(?:\\/|$)/, '/api/invitations/validate/[REDACTED]'],
  [/^\\/api\\/invitations\\/accept\\/[^/]+(?:\\/|$)/, '/api/invitations/accept/[REDACTED]']
];

function redactRequestPath(req) {
  const path = String((req && (req.path || req.originalUrl)) || '/').split('?')[0];
  for (const [pattern, replacement] of SENSITIVE_PATHS) {
    if (pattern.test(path)) return path.replace(pattern, replacement);
  }
  return path;
}

module.exports = { redactRequestPath };
