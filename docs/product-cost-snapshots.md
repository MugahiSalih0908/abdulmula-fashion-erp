# Product cost snapshots and gross-profit reporting

## What is recorded for new invoices

When the backend creates an invoice, it reads each product from MongoDB inside the invoice transaction. A positive `costPrice` value is copied to that invoice line as `unitCost` and marked `costKnown: true`. The browser cannot submit or override this value. Missing or zero product cost remains explicitly uncosted.

The line cost is multiplied by sold quantity. Gross profit uses line revenue after line discounts and before tax, less recorded cost of goods sold.

## Historical invoices

Existing invoices do not contain a trustworthy cost snapshot. They are not backfilled from today's product catalogue because product cost may have changed since the original sale. Any report period containing an invoice with missing line cost keeps gross profit unavailable and displays the number of uncosted invoices.

## Operating process

1. Ensure every active product has an accurate `costPrice` in the system's base currency before selling it.
2. Review missing/zero cost values during product setup and stock receiving.
3. After new sales are recorded with snapshots, run reports over a period containing only fully costed invoices to see gross profit.
4. Do not treat gross profit as net profit. Operating expenses, rent, salaries, transport, transfer fees, taxes and other costs remain separate.

No historical invoice or product record is rewritten by this feature. No database migration is required; older documents simply have no cost snapshot.
