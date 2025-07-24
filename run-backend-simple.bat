@echo off
cd backend
set PATH=C:\Program Files\nodejs;%PATH%
npm install
node --loader ts-node/esm src/index.ts
