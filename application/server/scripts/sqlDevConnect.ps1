# PowerShell script to set up the database on Windows

# Get the directory where the script is located
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

# MySQL connection details from environment or defaults
$DB_HOST = if ($env:DEV_HOST) { $env:DEV_HOST } else { "127.0.0.1" }
$DB_USER = if ($env:DEV_USER_STRING) { $env:DEV_USER_STRING } else { "root" }
$DB_PASSWORD = if ($env:DEV_PASSWORD) { $env:DEV_PASSWORD } else { "" }
$DB_NAME = if ($env:DEV_DATABASE) { $env:DEV_DATABASE } else { "ratings_dev_db" }
$SQL_FILE = Join-Path $SCRIPT_DIR "DB.sql"

# Check if the SQL file exists
if (-not (Test-Path $SQL_FILE)) {
    Write-Host "SQL file '$SQL_FILE' not found!" -ForegroundColor Red
    exit 1
}

# Check if MySQL is available
$mysqlPath = Get-Command mysql -ErrorAction SilentlyContinue
if (-not $mysqlPath) {
    Write-Host "MySQL command not found. Please make sure MySQL is installed and in your PATH." -ForegroundColor Red
    exit 1
}

# Create the database if it doesn't exist
Write-Host "Creating database '$DB_NAME' if it does not exist..." -ForegroundColor Yellow
if ($DB_PASSWORD) {
    $createDbCmd = "CREATE DATABASE IF NOT EXISTS $DB_NAME;"
    $result = & mysql -u $DB_USER -p"$DB_PASSWORD" -h $DB_HOST -e $createDbCmd 2>&1
} else {
    $createDbCmd = "CREATE DATABASE IF NOT EXISTS $DB_NAME;"
    $result = & mysql -u $DB_USER -h $DB_HOST -e $createDbCmd 2>&1
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to create database '$DB_NAME'." -ForegroundColor Red
    Write-Host $result -ForegroundColor Red
    exit 1
}

# Run the SQL file
Write-Host "Running SQL file..." -ForegroundColor Yellow
if ($DB_PASSWORD) {
    Get-Content $SQL_FILE | & mysql -u $DB_USER -p"$DB_PASSWORD" -h $DB_HOST $DB_NAME 2>&1
} else {
    Get-Content $SQL_FILE | & mysql -u $DB_USER -h $DB_HOST $DB_NAME 2>&1
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "Database setup completed successfully." -ForegroundColor Green
} else {
    Write-Host "Error occurred during database setup." -ForegroundColor Red
    exit 1
}





