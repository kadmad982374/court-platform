@echo off
REM ============================================================
REM scripts\demo-up.bat
REM Start the full demo stack on Windows.
REM Run from the project root.
REM ============================================================

if not exist ".env.demo" (
  echo ERROR: .env.demo not found.
  echo   Copy .env.demo.example to .env.demo and fill in your secrets.
  exit /b 1
)

echo =^> Building and starting demo stack...
set DOCKER_BUILDKIT=0
docker compose -p sla-demo -f docker-compose.demo.yml --env-file .env.demo up -d --build

echo.
echo =^> Demo stack is starting.
echo     Frontend:  http://localhost
echo     Backend:   proxied at /api
echo.
echo =^> Default demo credentials ^(all passwords: ChangeMe!2026^):
echo     admin            - CENTRAL_SUPERVISOR
echo     section_fi_dam   - SECTION_HEAD
echo     lawyer_fi_dam    - STATE_LAWYER
echo     viewer           - READ_ONLY_SUPERVISOR
echo.
echo See docs\deployment\DEMO_DEPLOYMENT_GUIDE.md for all credentials.


