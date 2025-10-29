#!/bin/bash

# ✅ Ensure Node 18 is used
echo "Using Node version from .nvmrc..."
nvm use

# ✅ Clean old installs (optional, safe to run)
echo "Cleaning old dependencies..."
rm -rf node_modules package-lock.json

# ✅ Install dependencies fresh
echo "Installing dependencies..."
npm install

# ✅ Start the server
echo "Starting server..."
npm start
