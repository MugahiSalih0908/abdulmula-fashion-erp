import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

const pages = {
  login: read('src/pages/LoginPage.jsx'),
  activate: read('src/pages/ActivateAccountPage.jsx'),
  invite: read('src/pages/InvitePage.jsx'),
  forgot: read('src/pages/ForgotPasswordPage.jsx'),
  reset: read('src/pages/ResetPasswordPage.jsx')
};
const shell = read('src/components/AuthShell.jsx');
const styles = read('src/components/authShell.css');

test('all public authentication routes use the shared premium shell', () => {
  for (const [name, source] of Object.entries(pages)) {
    assert.match(source, /AuthShell/, name + ' should use the shared authentication shell');
  }
  assert.match(shell, /auth-brand-mark/);
  assert.match(shell, /auth-panel-heading/);
  assert.match(styles, /--auth-gold/);
  assert.match(styles, /@media \(max-width: 420px\)/);
});

test('authentication API routes and invitation session handling are preserved', () => {
  assert.match(pages.login, /useAuthStore/);
  assert.match(pages.activate, /\/auth\/activate\//);
  assert.match(pages.invite, /validateInvitation\(token\)/);
  assert.match(pages.invite, /acceptInvitation\(token/);
  assert.match(pages.invite, /setAuth\(\{/);
  assert.match(pages.forgot, /\/auth\/forgot-password/);
  assert.match(pages.reset, /\/auth\/reset-password\//);
});

test('password setup forms retain the backend minimum length and confirmation checks', () => {
  for (const [name, source] of Object.entries({
    activate: pages.activate,
    invite: pages.invite,
    reset: pages.reset
  })) {
    assert.match(source, /at least 12 characters|at least 12|value: 12/, name + ' should enforce the twelve-character minimum');
    assert.match(source, /Passwords do not match|passwords do not match/, name + ' should confirm the new password');
  }
});

test('auth forms expose labels, invalid states and accessible password visibility controls', () => {
  assert.match(pages.login, /htmlFor="login-password"/);
  assert.match(pages.activate, /htmlFor="activate-password"/);
  assert.match(pages.invite, /htmlFor="invite-password"/);
  assert.match(pages.forgot, /htmlFor="forgot-email"/);
  assert.match(pages.reset, /htmlFor="reset-password"/);

  for (const [name, source] of Object.entries(pages)) {
    if (name !== 'forgot') {
      assert.match(source, /aria-pressed=\{showPwd|aria-pressed=\{showPassword/, name + ' should provide a stateful visibility control');
    }
  }
});

test('forgot-password confirmation does not disclose whether an email is registered', () => {
  assert.match(pages.forgot, /does not reveal whether the address is registered/);
  assert.match(pages.forgot, /If an active account exists/);
});
