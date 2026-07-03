@echo off
cd /d "%~dp0"

echo Starting Moyan API and Web...
echo.
echo Keep this window open while testing.
echo Browser will open http://localhost:5173 in a few seconds.
echo.

start "" cmd /c "timeout /t 8 /nobreak >nul && start "" http://localhost:5173"
npm.cmd run dev

pause
