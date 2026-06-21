-- Read-only window onto paf-admin's members table, exposing sci_member so
-- auth-service can synthesize roles. The underlying table lives in a different
-- database (`paf-admin`) on the same MariaDB server. CREATE OR REPLACE so
-- re-running is a no-op.
--
-- Prereqs (run ONCE by a DBA, NOT auth-service's app user):
--   GRANT CREATE VIEW, SHOW VIEW ON `<auth_db>`.* TO '<auth_user>'@'%';
--   GRANT SELECT ON `paf-admin`.`members` TO '<auth_user>'@'%';
--   FLUSH PRIVILEGES;
-- Without these, `prisma migrate deploy` (run as the app user) fails here on
-- CREATE OR REPLACE VIEW. DB name is literally `paf-admin` (hyphen) -> backtick-quote.

CREATE OR REPLACE VIEW `members` AS
  SELECT `id`, `email`, `name`, `roles` FROM `paf-admin`.`members`;
