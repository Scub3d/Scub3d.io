@echo off
REM Launches the alltrails residential proxy in the background. Wired to
REM Task Scheduler ("Scub3dAlltrailsProxy") so it auto-starts at logon.
set LOG_DIR=%LOCALAPPDATA%\Scub3d
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
"C:\Users\solys\AppData\Local\Programs\Python\Python310\pythonw.exe" "C:\Users\solys\Documents\GitHub\Scub3d.io\tooling\servers\proxy_server.py" 8888 > "%LOG_DIR%\proxy_server.log" 2>&1
