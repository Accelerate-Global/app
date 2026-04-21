# Database Test Notes

- Keep security posture checks consolidated in `/Users/blake/Documents/accelerate-global/online/supabase/tests/database/001_public_security.test.sql` unless a second file is clearly necessary.
- Coverage must include app-owned public tables, `storage.objects` dataset-bucket policies, and `private.analytics_events` access posture.
