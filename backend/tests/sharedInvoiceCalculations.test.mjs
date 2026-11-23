// Runs shared/invoiceCalculations.test.mjs as part of the backend `npm test`, which is
// the command CI runs. `node --test` only discovers test files inside backend/, so this
// entry imports the shared tests and their test() calls register here. Test-only.
import '../../shared/invoiceCalculations.test.mjs';
