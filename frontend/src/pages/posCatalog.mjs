import { getSellableUnitCount, getStockStatus } from '../utils/posStock.mjs';

export function getCatalogCategories(products) {
  const categories = new Set(
    products
      .filter(Boolean)
      .map(product => product.category?.trim() || 'Other')
  );
  return ['All', ...Array.from(categories).sort((a, b) => a.localeCompare(b))];
}

export function scanCatalogProduct(products, code, addItem) {
  const scannedCode = String(code || '').trim().toLocaleLowerCase();
  const product = products.find(candidate => candidate &&
    String(candidate.barcode || '').trim().toLocaleLowerCase() === scannedCode ||
    String(candidate.sku || '').trim().toLocaleLowerCase() === scannedCode
  );
  if (!product) return { ok: false, status: 'not-found' };

  const stockStatus = getStockStatus(product.quantity);
  const cartResult = addItem(product);
  if (stockStatus !== 'available') {
    return { ...cartResult, ok: false, status: stockStatus, product };
  }
  return { ...cartResult, product };
}

export function filterCatalogProducts(products, search, category) {
  const query = search.trim().toLocaleLowerCase();
  return products.filter(product => {
    if (!product || getSellableUnitCount(product.quantity) < 1) return false;
    const productCategory = product.category?.trim() || 'Other';
    const matchesCategory = category === 'All' || productCategory === category;
    if (!matchesCategory) return false;
    if (!query) return true;

    return [product.name, product.sku, product.barcode]
      .some(value => String(value || '').toLocaleLowerCase().includes(query));
  });
}
