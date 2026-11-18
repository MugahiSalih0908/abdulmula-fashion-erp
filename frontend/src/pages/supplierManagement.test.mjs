import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterSuppliers,
  getSupplierInitials,
  normalizeSupplierPayload,
  summarizeSuppliers
} from './supplierManagement.mjs';

const suppliers = [
  { _id: '1', name: 'Al Nour Textiles', company: 'Al Nour Group', phone: '+211 912 000 111', email: 'orders@alnour.example', debtBalance: 850 },
  { _id: '2', name: 'Juba Garments', company: 'Juba Garments Ltd', phone: '+211 977 123 456', debtBalance: 0 },
  { _id: '3', name: 'Mariam Trading', address: 'Konyo-Konyo', debtBalance: 250 }
];

test('supplier search matches name, company, phone, email and address', () => {
  assert.deepEqual(filterSuppliers(suppliers, 'AL NOUR').map(item => item._id), ['1']);
  assert.deepEqual(filterSuppliers(suppliers, '977 123').map(item => item._id), ['2']);
  assert.deepEqual(filterSuppliers(suppliers, 'ORDERS@ALNOUR').map(item => item._id), ['1']);
  assert.deepEqual(filterSuppliers(suppliers, 'konyo').map(item => item._id), ['3']);
});

test('supplier debt filter only includes positive outstanding balances', () => {
  assert.deepEqual(filterSuppliers(suppliers, '', true).map(item => item._id), ['1', '3']);
  assert.deepEqual(filterSuppliers(suppliers, 'juba', true), []);
});

test('supplier summary safely totals debt and contact coverage', () => {
  assert.deepEqual(summarizeSuppliers([
    ...suppliers,
    { _id: '4', name: 'Invalid', debtBalance: 'not-a-number' }
  ]), {
    count: 4,
    totalDebt: 1100,
    withDebt: 2,
    withPhone: 2,
    withEmail: 1
  });
});

test('supplier payload trims optional values and normalizes email', () => {
  assert.deepEqual(normalizeSupplierPayload({
    name: '  Al Nour  ',
    company: ' Textiles Ltd ',
    email: ' ORDERS@ALNOUR.EXAMPLE ',
    phone: ' +211 912 ',
    address: ' Konyo-Konyo ',
    notes: ' Main fabric supplier '
  }), {
    name: 'Al Nour',
    company: 'Textiles Ltd',
    email: 'orders@alnour.example',
    phone: '+211 912',
    address: 'Konyo-Konyo',
    notes: 'Main fabric supplier'
  });
});

test('blank optional supplier fields are omitted', () => {
  assert.deepEqual(normalizeSupplierPayload({ name: 'Juba', company: '', email: ' ', phone: null, address: '', notes: '' }), {
    name: 'Juba'
  });
});

test('supplier initials use up to two words and safe fallback', () => {
  assert.equal(getSupplierInitials('al nour textiles'), 'AN');
  assert.equal(getSupplierInitials('Mariam'), 'M');
  assert.equal(getSupplierInitials('  '), 'SU');
});
