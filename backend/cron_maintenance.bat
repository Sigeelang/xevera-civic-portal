@echo off
cd /d "%~dp0"
echo Xevera Maintenance Cron - running every 60s (Ctrl+C to stop).
:loop
C:\xampp\php\php.exe artisan cron:maintenance >nul 2>&1
timeout /t 60 /nobreak >nul
goto loop
