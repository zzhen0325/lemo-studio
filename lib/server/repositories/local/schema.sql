-- Local role and grants only. Apply versioned business migrations first.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'studio_local') THEN
    CREATE ROLE studio_local NOLOGIN;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO studio_local;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO studio_local;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO studio_local;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO studio_local;

NOTIFY pgrst, 'reload schema';
