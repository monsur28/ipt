#!/bin/sh

# Only wait for local database container if explicitly requested (e.g. in docker-compose)
if [ "$WAIT_FOR_DB" = "true" ]; then
  echo "Waiting for PostgreSQL database to be ready..."
  until nc -z -v -w30 db 5432
  do
    echo "PostgreSQL is not ready yet. Retrying in 2 seconds..."
    sleep 2
  done
  echo "PostgreSQL database is online!"
fi

echo "Running database schema sync (Prisma DB Push)..."
npx prisma db push --accept-data-loss

echo "Starting Fastify API server..."
npm run start
