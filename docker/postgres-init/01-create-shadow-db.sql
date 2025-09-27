DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'openchat_shadow') THEN
        EXECUTE 'CREATE DATABASE openchat_shadow';
    END IF;
END$$;
