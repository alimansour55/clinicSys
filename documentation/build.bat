@echo off
cd /d "%~dp0"
set PUPPETEER_SKIP_DOWNLOAD=true
echo Starting build... > build.log
call npm install --no-optional >> build.log 2>&1
echo npm install exit: %ERRORLEVEL% >> build.log
call npm run build >> build.log 2>&1
echo npm build exit: %ERRORLEVEL% >> build.log
if exist "output\Clinic_Management_System_Documentation.pdf" (
  echo PDF_CREATED=YES >> build.log
) else (
  echo PDF_CREATED=NO >> build.log
)
