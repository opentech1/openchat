DO $$
DECLARE
	target_db text := :'shadow_db';
	db_owner text := :'db_owner';
BEGIN
	IF target_db IS NULL THEN
		RETURN;
	END IF;

	IF NOT EXISTS (SELECT FROM pg_database WHERE datname = target_db) THEN
		EXECUTE format('CREATE DATABASE %I OWNER %I', target_db, db_owner);
	END IF;
END
$$;
