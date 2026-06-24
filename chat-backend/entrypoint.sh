#!/bin/sh
set -e

# Run migrations if requested
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Applying database migrations..."
  MAX_RETRIES=15
  RETRY_COUNT=0
  
  until npx prisma migrate deploy || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
    echo "Database connection or migration failed. Retrying in 2 seconds..."
    RETRY_COUNT=$((RETRY_COUNT+1))
    sleep 2
  done
  
  if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "Migrations failed after $MAX_RETRIES attempts. Exiting."
    exit 1
  fi
else
  echo "Skipping migrations (RUN_MIGRATIONS is not set to 'true')"
fi

# Execute the main container command
exec "$@"
