@echo off
echo Starting Notive App...
start "Notive Backend" cmd /k "cd backend && npm run dev"
start "Notive Frontend" cmd /k "cd frontend && npm run dev"
echo Waiting for servers to initialize...
timeout /t 10
start http://localhost:3000
echo App started!
