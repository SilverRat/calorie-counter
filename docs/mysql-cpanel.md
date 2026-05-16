# MySQL Setup In cPanel

cPanel's current documentation recommends the Database Wizard for the first database and user. The flow is:

1. Open cPanel.
2. Go to **Databases > MySQL Database Wizard**.
3. Create a database, for example `calorie_counter`.
4. Create a database user, for example `calorie_app`.
5. Assign that user to the database.
6. Select **ALL PRIVILEGES** for the initial setup so the schema import can create tables, indexes, constraints, and seed rows.
7. Open **Databases > phpMyAdmin**.
8. Select the new database.
9. Import `db/mysql/schema.sql`.
10. Import `db/mysql/seed.sql` if you want the default active prompt.

Most cPanel hosts prefix database and user names with the cPanel account name, such as `account_calorie_counter` and `account_calorie_app`. Use the full prefixed names in `.env.local`.

Runtime `.env.local` example:

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=account_calorie_counter
MYSQL_USER=account_calorie_app
MYSQL_PASSWORD=replace-with-cpanel-password
SESSION_SECRET=replace-with-at-least-32-random-characters
OPENAI_API_KEY=replace-with-openai-key
OPENAI_MODEL=gpt-4o-mini
```

For local development against a remote cPanel database, your host may require **Remote MySQL** allowlisting for your IP address. If the app is deployed on the same cPanel account as the database, `MYSQL_HOST=localhost` is usually correct.

After import, if cPanel lets you revise privileges, a narrower runtime set is typically enough:

- `SELECT`
- `INSERT`
- `UPDATE`
- `DELETE`
- `EXECUTE` is not needed by this schema
- `CREATE`, `ALTER`, `DROP`, and `INDEX` are only needed for future migrations

Shared cPanel hosting usually does not grant true global DBA permissions or `CREATE USER` inside MySQL itself. User creation and database assignment normally happen through cPanel, not SQL.
