#!/bin/bash
# Database setup script for TestForge
# Run this script to set up the PostgreSQL database

set -e

echo "TestForge Database Setup"
echo "========================"

# Check if PostgreSQL is running
if ! pg_isready -q; then
    echo "Error: PostgreSQL is not running"
    exit 1
fi

echo "PostgreSQL is running."

# Database configuration
DB_NAME="testforge"
DB_USER="qualitypilot_user"

# Create database if it doesn't exist
echo "Creating database '$DB_NAME' if it doesn't exist..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;"

# Grant permissions
echo "Granting permissions to '$DB_USER'..."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;"
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;"

echo "Database setup complete!"
echo ""
echo "Next steps:"
echo "1. Run: pnpm prisma migrate dev --name init"
echo "2. Run: pnpm prisma db seed"
