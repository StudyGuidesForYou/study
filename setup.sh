#!/bin/bash
set -e

echo "Installing dependencies..."
npm install

mkdir -p db
echo "Setup complete!"
echo "Run 'node server.js' to start the chat server."
