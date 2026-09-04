@echo off
echo Starting from D:\GAMES\backup (9) -> Prototpye 4
echo.
echo Starting PHP backend (127.0.0.1:8000)...
start "PHP Backend" cmd /k "cd /d "D:\GAMES\backup (9)\backup (7)\backup (2)\backup\Prototpye 4\backend" && C:\xampp\php\php.exe -S 127.0.0.1:8000 router.php"
echo Starting React frontend (5173)...
start "React Frontend" cmd /k "cd /d "D:\GAMES\backup (9)\backup (7)\backup (2)\backup\Prototpye 4\frontend" && npm run dev"
echo.
echo ============================================
echo   Guest : http://localhost:5173/xevera-portal/
echo   Admin : http://localhost:5173/xevera-portal/#/dashboard
echo   Backend: http://127.0.0.1:8000
echo ============================================
pause
