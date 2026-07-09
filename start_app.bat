@echo off
Mediarift

echo ==========================================
echo         Starting Mediarift
echo ==========================================

if not exist "%~dp0backend\app.py" (
    echo ERROR: backend\app.py not found!
    pause
    exit
)

if not exist "%~dp0frontend\package.json" (
    echo ERROR: frontend\package.json not found!
    pause
    exit
)

echo Starting Backend...
start "Backend" cmd /k "cd /d "%~dp0backend" && python app.py"

timeout /t 5 /nobreak >nul

echo Starting Frontend...
start "Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

timeout /t 5 /nobreak >nul

start "" "http://localhost:5173"

echo.
echo ==========================================
echo Application Started!
echo Frontend: http://localhost:5173
echo Backend : http://localhost:5000
echo ==========================================

exit