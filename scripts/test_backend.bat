@echo off
REM ============================================================
REM  Run backend integration tests (Mini-Phase A coverage).
REM
REM  Usage:    scripts\test_backend.bat
REM            scripts\test_backend.bat AssignableLawyersApiIT       (single class)
REM
REM  Notes:
REM    * Uses Testcontainers — Docker Desktop must be running.
REM    * Postgres image will be pulled on first run.
REM ============================================================
setlocal
set ROOT=%~dp0..
set POM=%ROOT%\backend\pom.xml

if "%~1"=="" (
    set TARGET=test
) else (
    set TARGET=test -Dtest=%~1
)

echo.
echo === Running: mvn -f "%POM%" -B %TARGET% ===
echo.
call mvn -f "%POM%" -B %TARGET%
endlocal

