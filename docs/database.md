# 🗄️ Prisma Database Migration Guidelines

To prevent database-schema mismatches, out-of-sync migration histories, or table alignment issues in the future, please adhere to these core rules:

---

## 🚨 The Golden Rules

### 1. Always Keep `schema.prisma` and Migrations Synced
* When a schema update occurs in `schema.prisma`, ensure that the corresponding migration files are also generated and updated.
* Every schema change must have a matching generated migration folder inside `prisma/migrations/`.
* **Action:** Immediately after editing `schema.prisma`, run:
  ```bash
  npx prisma migrate dev --name <describe_your_change>
  ```
  This will create the migration folder locally. Ensure both the `schema.prisma` file and the new migration files are staged and committed manually.

### 2. Never Rename or Edit Applied Migrations
* Once a migration has been applied to a database, **never** rename or delete the migration folder inside `prisma/migrations/` locally.
* Prisma matches applied migrations in the database (stored in the `_prisma_migrations` table) by their exact directory name/timestamp. Renaming a migration folder locally will cause a lock-out and prevent any future migrations from running.

### 3. Setting Up a Fresh Environment (e.g. Another Laptop)
When you or another team member clones the repository onto a new laptop/environment:
* **For Development (Safe to recreate/empty DB):**
  ```bash
  npx prisma migrate dev
  ```
  This will check the migration history, apply all migrations to the local database, and keep everything perfectly in sync.
* **For Staging/Production (Never drops data):**
  ```bash
  npx prisma migrate deploy
  ```

---

## 🛠️ Troubleshooting & Schema Out-of-Sync Recovery

If you ever encounter a migration mismatch (e.g., local history differs from database history) and you are in the **early stages** where preserving database data is **not** important:

### The Clean Reset Protocol:
1. **Empty the database schema (Postgres):**
   ```bash
   psql "postgresql://postgres:password@localhost:5432/chatapp" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
   ```
2. **Apply migrations freshly:**
   ```bash
   npx prisma migrate dev
   ```

### Squashing/Consolidating Migrations (Optional):
If your migration history grows too large or messy with redundant renames, you can squash them into a single clean initial migration:
1. Delete all folders inside `prisma/migrations/`.
2. Run the **Clean Reset Protocol** above.
3. Generate the new single initial migration:
   ```bash
   npx prisma migrate dev --name init
   ```
