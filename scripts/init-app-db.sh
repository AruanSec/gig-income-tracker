#!/bin/sh
set -eu
# Official PostgreSQL entrypoint runs this only for an empty volume.
: "${APP_DATABASE_PASSWORD:?APP_DATABASE_PASSWORD is required}"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=app_password="$APP_DATABASE_PASSWORD" --set=app_db="$POSTGRES_DB" <<'SQL'
SELECT 'CREATE ROLE gig_app' WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gig_app') \gexec
ALTER ROLE gig_app LOGIN PASSWORD :'app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
ALTER SCHEMA public OWNER TO gig_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER TABLE IF EXISTS users OWNER TO gig_app;
ALTER TABLE IF EXISTS sessions OWNER TO gig_app;
ALTER TABLE IF EXISTS income_entries OWNER TO gig_app;
ALTER TABLE IF EXISTS mileage_entries OWNER TO gig_app;
ALTER TABLE IF EXISTS vehicle_expenses OWNER TO gig_app;
ALTER TABLE IF EXISTS cra_rates OWNER TO gig_app;
GRANT CONNECT ON DATABASE :"app_db" TO gig_app;
SQL
