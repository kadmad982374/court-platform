@echo off
REM ============================================================
REM scripts\demo-down.bat
REM Stop the demo stack on Windows (keeps volumes intact).
REM ============================================================
docker compose -f docker-compose.demo.yml down
echo Demo stack stopped. Data volumes preserved.

