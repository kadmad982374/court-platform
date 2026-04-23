@echo off
REM ============================================================
REM scripts\demo-update.bat
REM Pull latest code, rebuild images, restart services (Windows).
REM ============================================================
git pull
docker compose -f docker-compose.demo.yml --env-file .env.demo up -d --build
echo Update complete.

