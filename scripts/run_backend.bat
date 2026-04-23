@echo off
REM ============================================================
REM  Rebuild + start backend (Mini-Phase A verified surface).
REM
REM  Usage:    double-click, OR run from any cmd window:
REM            scripts\run_backend.bat
REM
REM  - Builds with Maven (skipping tests for speed; pass /T to run them).
REM  - Then starts the Spring Boot jar in the foreground.
REM  - Backend will listen on http://localhost:8080
REM
REM  Requirements:
REM    * JDK 17+ on PATH  (java -version)
REM    * Maven on PATH    (mvn -v)
REM    * Postgres reachable per backend/src/main/resources/application.yml
REM ============================================================
setlocal
set ROOT=%~dp0..
set POM=%ROOT%\backend\pom.xml
set TARGET=%ROOT%\backend\target

set SKIP=-DskipTests
if /I "%~1"=="/T" set SKIP=

echo.
echo === Building backend ===
echo POM: %POM%
echo.
call mvn -f "%POM%" -B %SKIP% clean package
if errorlevel 1 (
    echo.
    echo *** BUILD FAILED ***
    pause
    exit /b 1
)

echo.
echo === Starting backend ===
echo Looking for jar in: %TARGET%
for %%F in ("%TARGET%\state-litigation-backend*.jar") do set JAR=%%F
if not defined JAR (
    echo *** No jar produced. ***
    pause
    exit /b 2
)

echo Running: java -jar "%JAR%"
echo (Ctrl+C to stop. Logs go to console.)
echo.
java -jar "%JAR%"
endlocal

