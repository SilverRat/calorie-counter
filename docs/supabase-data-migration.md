# Supabase Data Migration Notes

The table shapes intentionally keep UUID strings so existing row IDs can be moved into MySQL. The main difference is auth:

- Supabase Auth password hashes should not be moved into this app.
- Existing users should create new passwords through `/login`.
- If you want to preserve existing `user_id` values in `food_entries`, insert matching rows into `users` with those same IDs before importing entries.

Recommended export order from Supabase:

1. `auth.users` email and id values, if you are allowed to export them.
2. `public.prompts`
3. `public.chat_sessions`
4. `public.food_entries`
5. `public.chat_messages`

Recommended import order into MySQL:

1. `users`
2. `prompts`
3. `chat_sessions`
4. `food_entries`
5. `chat_messages`

Postgres `timestamptz` values should be imported as UTC `datetime(3)` values. Postgres `jsonb` values can be imported as MySQL `json` strings.

If preserving old users is not important, create fresh users in the app and import only data that can be remapped to the new user IDs.
