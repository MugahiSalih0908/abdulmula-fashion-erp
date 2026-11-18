import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterStaff,
  getStaffInitial,
  getStaffRoleTone
} from './staffManagement.mjs';

const people = [
  { name: 'Amina Yusuf', email: 'amina@example.test', role: 'manager', isActive: true, isVerified: true },
  { name: 'Musa Adam', email: 'musa@example.test', role: 'staff', isActive: true, isVerified: false },
  { name: 'Hassan Ali', email: 'hassan@example.test', role: 'admin', isActive: false, isVerified: true }
];

test('staff filters search names, email addresses and roles without case sensitivity', () => {
  assert.deepEqual(filterStaff(people, { search: 'AMINA' }), [people[0]]);
  assert.deepEqual(filterStaff(people, { search: 'musa@example' }), [people[1]]);
  assert.deepEqual(filterStaff(people, { search: 'admin' }), [people[2]]);
});

test('staff filters combine role and account status', () => {
  assert.deepEqual(filterStaff(people, { role: 'staff', status: 'pending' }), [people[1]]);
  assert.deepEqual(filterStaff(people, { status: 'active' }), [people[0], people[1]]);
  assert.deepEqual(filterStaff(people, { status: 'disabled' }), [people[2]]);
  assert.deepEqual(filterStaff(people, { role: 'manager', status: 'active' }), [people[0]]);
});

test('staff filters safely handle empty and invalid inputs', () => {
  assert.deepEqual(filterStaff(null), []);
  assert.deepEqual(filterStaff(people, { search: 'not found' }), []);
  assert.deepEqual(filterStaff(people, { role: 'owner' }), []);
});

test('staff identity and role presentation helpers stay predictable', () => {
  assert.equal(getStaffInitial('amina yusuf'), 'A');
  assert.equal(getStaffInitial(''), 'U');
  assert.equal(getStaffRoleTone('admin'), 'danger');
  assert.equal(getStaffRoleTone('manager'), 'info');
  assert.equal(getStaffRoleTone('staff'), 'primary');
});
