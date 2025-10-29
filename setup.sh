#!/bin/bash

# =========================================
# Chat System Setup Script
# =========================================

# Exit immediately if a command fails
set -e

echo "-------------------------------------"
echo "  Chat System Setup Starting..."
echo "-------------------------------------"

# 1. Check if Node.js is installed
if ! command -v node &> /dev/null
then
    echo "Node.js not found. Please install Node.js first."
    exit 1
fi

# 2. Install dependencies
echo "Installing Node.js dependencies..."
npm install

# 3. Create a .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    echo "# Example .env file" > .env
    echo "PORT=3000" >> .env
fi

# 4. Provide instructions for GitHub / Render deployment
echo "-------------------------------------"
echo "Setup complete!"
echo "To run your chat server locally:"
echo "  1. node server.js"
echo "  2. Open your browser at http://localhost:3000"
echo ""
echo "To deploy on Render:"
echo "  1. Push this repo to GitHub"
echo "  2. Create a new Web Service on Render and connect your GitHub repo"
echo "  3. Set the start command to: node server.js"
echo "-------------------------------------"

# 5. Optional: Start server immediately
read -p "Do you want to start the server now? (y/n) " start_now
if [[ "$start_now" == "y" || "$start_now" == "Y" ]]; then
    echo "Starting server..."
    node server.js
fi
