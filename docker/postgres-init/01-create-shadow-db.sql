\set main_db 'openchat'
\set shadow_db 'openchat_shadow'

-- Create the main application database if it does not already exist.
SELECT format('CREATE DATABASE %I OWNER %I', :'main_db', current_user)
WHERE NOT EXISTS (
	SELECT 1 FROM pg_database WHERE datname = :'main_db'
)\gexec

-- Create the shadow database used by Drizzle migrations if needed.
SELECT format('CREATE DATABASE %I OWNER %I', :'shadow_db', current_user)
WHERE NOT EXISTS (
	SELECT 1 FROM pg_database WHERE datname = :'shadow_db'
)\gexec
