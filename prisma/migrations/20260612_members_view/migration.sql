-- Read-only window onto paf-admin's members table. The underlying table
-- lives in a different database on the same MariaDB server. Re-runnable
-- via CREATE OR REPLACE.
--
-- Prereqs (run once by a DBA, NOT auth-service's user):
--   GRANT CREATE VIEW, SHOW VIEW ON `<auth_db>`.* TO '<auth_user>'@'%';
--   GRANT SELECT ON `paf-admin`.`members` TO '<auth_user>'@'%';
--   FLUSH PRIVILEGES;
--
-- DB name is literally `paf-admin` (with a hyphen) — must be backtick-quoted.
CREATE OR REPLACE VIEW `members` AS
  SELECT `id`, `email`, `name` FROM `paf-admin`.`members`;
