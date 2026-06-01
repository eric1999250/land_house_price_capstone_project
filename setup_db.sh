#!/bin/bash
# ============================================================
# Land Price Estimation System — PostgreSQL Setup Script
# ============================================================
# Usage: bash setup_db.sh
# Requires: PostgreSQL 14+ installed and running

DB_NAME="land_price_db"
DB_USER="land_admin"
DB_PASS="land1234"
SQL_FILE="land_price_estimation_db.sql"

echo "=== Land Price Estimation — DB Setup ==="

# Create user and database
psql -U postgres -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || echo "User already exists"
psql -U postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || echo "Database already exists"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

# Run schema
psql -U postgres -d $DB_NAME -f $SQL_FILE

# Grant table permissions
psql -U postgres -d $DB_NAME -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO $DB_USER;"
psql -U postgres -d $DB_NAME -c "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;"

echo ""
echo "✅ Database '$DB_NAME' is ready!"
echo "   Host:     localhost"
echo "   Port:     5432"
echo "   Database: $DB_NAME"
echo "   User:     $DB_USER"
echo "   Password: $DB_PASS"
echo ""
echo "Connection string:"
echo "  postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"