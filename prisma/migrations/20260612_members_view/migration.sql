-- Read-only window onto paf-admin's members table. The underlying table
-- lives in a different database on the same MariaDB server. Re-runnable
-- via CREATE OR REPLACE.
--
-- Prereq: the auth-service DB user must have SELECT on paf_admin.members:
--   GRANT SELECT ON paf_admin.members TO '<auth_user>'@'%';
--
-- If paf-admin's database is named something other than `paf_admin`, update
-- this migration (and re-apply) accordingly.
CREATE OR REPLACE VIEW `members` AS
  SELECT `id`, `email`, `name` FROM `paf_admin`.`members`;
