import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const staffPage = read('src/pages/StaffPage.jsx');
const invitationModal = read('src/components/InvitationModal.jsx');
const workspaceCss = read('src/pages/staffWorkspace.css');

test('staff workspace preserves the existing staff management API contracts', () => {
  assert.match(staffPage, /api\.get\('\/staff'\)/);
  assert.match(staffPage, /api\.post\('\/staff'/);
  assert.match(staffPage, /api\.patch\('\/staff\/' \+ id \+ '\/toggle'\)/);
  assert.match(staffPage, /\/resend-activation/);
  assert.match(staffPage, /\/reset-password/);
  assert.match(staffPage, /\/staff\/' \+ memberId/);
});

test('staff directory includes accessible search, role and status filters', () => {
  assert.match(staffPage, /aria-label="Team metrics"/);
  assert.match(staffPage, /aria-label="Team directory"/);
  assert.match(staffPage, /Search staff members/);
  assert.match(staffPage, /All roles/);
  assert.match(staffPage, /Pending activation/);
  assert.match(staffPage, /aria-label=\{'Actions for '/);
});

test('invitation management preserves service operations and uses a proper dialog shell', () => {
  assert.match(invitationModal, /createInvitation\(/);
  assert.match(invitationModal, /listInvitations\(/);
  assert.match(invitationModal, /resendInvitation\(/);
  assert.match(invitationModal, /deleteInvitation\(/);
  assert.match(invitationModal, /role="dialog"/);
  assert.match(invitationModal, /aria-modal="true"/);
  assert.match(invitationModal, /staff-invitation-description/);
  assert.match(invitationModal, /import Button from '\.\/ui\/Button'/);
  assert.match(invitationModal, /import '\.\.\/pages\/staffWorkspace\.css'/);
});

test('invitation dialog traps keyboard focus and restores page scrolling and focus', () => {
  assert.match(invitationModal, /event\.key === 'Escape'/);
  assert.match(invitationModal, /event\.key !== 'Tab'/);
  assert.match(invitationModal, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(invitationModal, /previouslyFocused\.focus\(\)/);
});

test('staff and invitation workspaces provide responsive and reduced motion styling', () => {
  assert.match(workspaceCss, /@media \(max-width: 639px\)/);
  assert.match(workspaceCss, /@media \(max-width: 1100px\)/);
  assert.match(workspaceCss, /prefers-reduced-motion: reduce/);
  assert.match(workspaceCss, /\.staff-modal-overlay/);
  assert.match(workspaceCss, /\.staff-member-card/);
});


test('staff creation reports email failure separately from account creation', () => {
  assert.match(staffPage, /emailStatus === 'sent'/);
  assert.match(staffPage, /Account created, but activation email was not sent/);
  assert.match(staffPage, /Resend activation/);
});

test('invitation UI keeps failed email state visible and retryable', () => {
  assert.match(invitationModal, /emailStatusMeta/);
  assert.match(invitationModal, /emailErrorMessage/);
  assert.match(invitationModal, /resendMutation\.mutate/);
  assert.match(invitationModal, /getDeliveryMessage/);
});

test('email stylesheets use paths that resolve from their importing components', () => {
  assert.match(staffPage, /import '\.\/staffWorkspace\.css'/);
  assert.match(invitationModal, /import '\.\.\/pages\/staffWorkspace\.css'/);
  assert.match(workspaceCss, /\.staff-invitation-card-badges/);
});
