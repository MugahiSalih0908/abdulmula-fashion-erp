import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterCustomers,
  getCustomerInitials,
  normalizeCustomerPayload,
  summarizeCustomers
} from './customerManagement.mjs';

const customers = [
  { _id: '1', name: 'Amina Hassan', phone: '+211 912 345 678', email: 'amina@example.com', totalPurchases: 250, creditBalance: 25 },
  { _id: '2', name: 'John Peter', phone: '+211 977 000 111', totalPurchases: 120, creditBalance: 0 },
  { _id: '3', name: 'Mariam Ali', address: 'Konyo-Konyo', totalPurchases: 80, creditBalance: 10 }
];

test('customer search matches name, phone, email and address case-insensitively', () => {
  assert.deepEqual(filterCustomers(customers, 'AMINA').map(item => item._id), ['1']);
  assert.deepEqual(filterCustomers(customers, '977 000').map(item => item._id), ['2']);
  assert.deepEqual(filterCustomers(customers, 'EXAMPLE.COM').map(item => item._id), ['1']);
  assert.deepEqual(filterCustomers(customers, 'konyo').map(item => item._id), ['3']);
});

test('credit filter returns only customers with a positive outstanding balance', () => {
  assert.deepEqual(filterCustomers(customers, '', true).map(item => item._id), ['1', '3']);
  assert.deepEqual(filterCustomers(customers, 'john', true), []);
});

test('customer summary uses safe numeric values and counts contact coverage', () => {
  assert.deepEqual(summarizeCustomers([
    ...customers,
    { _id: '4', name: 'Invalid totals', totalPurchases: 'bad', creditBalance: null }
  ]), {
    count: 4,
    totalPurchases: 450,
    outstandingCredit: 35,
    withCredit: 2,
    withEmail: 1,
    withPhone: 2
  });
});

test('customer payload trims optional fields and normalizes email', () => {
  assert.deepEqual(normalizeCustomerPayload({
    name: '  Amina Hassan  ',
    email: '  AMINA@EXAMPLE.COM ',
    phone: '  +211 912 345 678 ',
    address: '  Juba ',
    notes: '  Regular customer '
  }), {
    name: 'Amina Hassan',
    email: 'amina@example.com',
    phone: '+211 912 345 678',
    address: 'Juba',
    notes: 'Regular customer'
  });
});

test('blank optional customer fields are omitted', () => {
  assert.deepEqual(normalizeCustomerPayload({ name: '  John  ', email: '', phone: ' ', address: null, notes: '' }), {
    name: 'John'
  });
});

test('customer initials use up to two name parts and have a safe fallback', () => {
  assert.equal(getCustomerInitials('amina hassan'), 'AH');
  assert.equal(getCustomerInitials('Mariam'), 'M');
  assert.equal(getCustomerInitials('  '), 'CU');
});
