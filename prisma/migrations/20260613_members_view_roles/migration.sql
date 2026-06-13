-- Extend the members view to expose sci_member so auth-service can synthesize
-- roles. Underlying table lives in the paf-admin database (hyphenated name,
-- must be backtick-quoted). CREATE OR REPLACE so re-running is a no-op.
CREATE OR REPLACE VIEW `members` AS
  SELECT `id`, `email`, `name`, `sci_member` FROM `paf-admin`.`members`;
