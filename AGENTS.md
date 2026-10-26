# Khan Runner scope

This repository contains the standalone Khan Runner Chrome extension. Keep Project Sovereign, RADAR, their repositories, services and accounts untouched.

The canonical extension is `source/extension/`; tests are in `source/tests/`. Production has no runtime dependencies. Use `cd source && npm test` for Node checks and `npm run test:browser` for the actual-extension Chrome checks. See source/README.md for pinned browser-tool setup. Browser tests use isolated profiles and synthetic classroom responses; never label them as signed-in Khan acceptance.

Preserve class scope, existing student work, disabled editor restrictions, verified readback, durable submission intent and Stop. Unknown submission outcomes must not be retried blindly. Do not forge grades, course credit, media time or evidence, bypass authentication/CAPTCHAs, inspect credential stores, or use private application state. Keep private screenshots and student records out of publication artifacts.

Preserve frozen release ZIPs in downloads. Version updates need a newly named package, checksums and actual verification results. Do not replace validation with mock-only test counts or claim all exercise formats are supported.
