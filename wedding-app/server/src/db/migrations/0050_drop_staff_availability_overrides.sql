-- Migration 0050: drop dead `staff_availability_overrides` table (MODULE-05 ST-18).
--
-- Migration 0046 created this table but nothing has ever read or written it:
-- the implemented availability-override mechanism is the shift-level
-- `staff_shifts.availability_override_reason` column (migration 0045), which
-- is enforced at shift create/update and audited. Dropping the unused table
-- removes the schema ambiguity (two competing "override" concepts).
DROP TABLE IF EXISTS staff_availability_overrides;
