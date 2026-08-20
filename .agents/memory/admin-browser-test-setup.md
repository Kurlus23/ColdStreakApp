---
name: Admin browser-test setup
description: Reliable setup and cleanup for authenticated admin browser checks in the development environment.
---

For repeatable authenticated admin browser checks, register a unique development-only user, promote that exact record to admin, and then log in through the UI in a fresh browser context. Delete every related test record when the run finishes.

**Why:** The admin seed intentionally preserves an existing password hash, so its source default credentials are not a dependable way to authenticate a browser test against a reused development database.

**How to apply:** Use this only in the development test environment. Promote the account before logging in so the newly issued bearer token includes the admin claim; clean up associated Brain Freeze answers, plunges, and the user row afterward.