# Phase 17 — mobile and performance QA

## Implemented in this phase

- Route-level lazy loading for public and authenticated pages.
- Shared skeleton fallback while page chunks load.
- Mobile bottom navigation with larger icons, touch targets, visible focus states, and iOS safe-area spacing.
- System font stack to remove the blocking external Google Fonts request.
- Debounced search on products, customers, suppliers, expenses, and the loaded invoice page.
- Shared in-flight /auth/me request to avoid duplicate current-user validation.
- Server pagination for customer, supplier, expense, and product management lists.
- Customer, supplier, expense, product and staff query improvements/indexes.
- Vercel static assets and PWA icons retain immutable one-year browser cache headers.

## Automated checks

GitHub Actions runs:
- Backend JavaScript syntax checks and the backend npm test suite.
- Frontend unit/source tests.
- Vite production build.

A green CI run confirms source-level correctness and bundling. It does not replace physical device testing.

## Manual device matrix

| Device / viewport | Checks |
| --- | --- |
| iPhone Safari, 320–390 px | Safe areas, bottom navigation, sheets, forms, icon legibility |
| Android Chrome, 360–430 px | Touch targets, scrolling, search, page controls, keyboard |
| Small Android device, 320–359 px | Header truncation, status indicator, navigation overflow |
| Tablet, 768–1023 px | Content spacing, cards, drawer, landscape layout |
| Desktop, 1024 px and above | Sidebar, tables, page controls, keyboard navigation |

## Network and performance checks

Use Chrome DevTools or Safari Web Inspector to test:
1. Slow 3G and CPU throttling.
2. First visit and repeat visit.
3. Opening pages directly by URL and switching between pages.
4. Search typing: ensure results update after a short pause without a request per keystroke.
5. Long directories: confirm the page requests 25 records at a time.
6. Product images: confirm below-the-fold images load lazily and decode asynchronously.
7. Offline/online transitions and POS offline queue behavior.

Record LCP, INP, CLS, first-load JavaScript size, and API response time before/after using the same device and network profile.

## Deferred infrastructure-dependent work

Do not enable these without selecting and configuring the supporting services:
- Redis caching and cache invalidation.
- Background job queue for email and long-running jobs.
- OpenTelemetry collector and persistent trace backend.
- API response compression on the Render service if the hosting proxy does not provide it.
- Image transformation pipeline/CDN for uploaded images (WebP/AVIF). Current product records accept image URLs; the ERP does not own an image upload/transcode pipeline.
- Backend region changes or MongoDB cluster relocation.
- Load balancing and multiple API instances.
- Streaming AI responses; no streaming AI feature is currently used by the ERP.

Vercel serves the frontend's static build through its edge network and the existing vercel.json config applies long-lived immutable caching to versioned /assets/ and /icons/ files. API hosting remains separate.
