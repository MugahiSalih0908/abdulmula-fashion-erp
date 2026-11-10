import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCatalogProducts, getCatalogCategories } from './posCatalog.mjs';

const products = [
  { _id: '1', name: 'Silk Wrap', sku: 'SW-01', barcode: '01234', category: 'Women', quantity: 4 },
  { _id: '2', name: 'Leather Belt', sku: 'LB-02', barcode: '56789', category: 'Accessories', quantity: 2 },
  { _id: '3', name: 'Out of stock', sku: 'OOS', category: 'Women', quantity: 0 },
  { _id: '4', name: 'Basic Tee', quantity: 1 }
];

test('catalog search matches product name, SKU, and barcode without case sensitivity', () => {
  assert.deepEqual(filterCatalogProducts(products, 'silk', 'All').map(product => product._id), ['1']);
  assert.deepEqual(filterCatalogProducts(products, 'lb-02', 'All').map(product => product._id), ['2']);
  assert.deepEqual(filterCatalogProducts(products, '01234', 'All').map(product => product._id), ['1']);
});

test('catalog category filters preserve available stock behavior and include uncategorized products as Other', () => {
  assert.deepEqual(filterCatalogProducts(products, '', 'Women').map(product => product._id), ['1']);
  assert.deepEqual(filterCatalogProducts(products, '', 'Other').map(product => product._id), ['4']);
  assert.deepEqual(getCatalogCategories(products), ['All', 'Accessories', 'Other', 'Women']);
});
