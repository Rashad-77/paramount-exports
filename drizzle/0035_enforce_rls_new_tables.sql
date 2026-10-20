-- Every table in the public schema keeps row level security on with no API access (the app connects as the owner). The specification
-- catalogue tables (0032, 0033) and the order payment and after-sales tables (0034) were created after the last run of the check.
SELECT enforce_rls();
