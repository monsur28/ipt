#!/bin/sh

echo "Waiting for PostgreSQL database to be ready..."
# A simple shell loop to wait for db host on port 5432
until nc -z -v -w30 db 5432
do
  echo "PostgreSQL is not ready yet. Retrying in 2 seconds..."
  sleep 2
done
echo "PostgreSQL database is online!"

echo "Running database schema sync (Prisma DB Push)..."
npx prisma db push --accept-data-loss

echo "Starting Fastify API server..."
npm run start
