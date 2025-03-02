#!/bin/bash

cd "$(dirname "$0")" || exit

# Backend setup
echo "Setting up backend..."
cd backend || exit
uv venv
source .venv/bin/activate
uv sync

# Frontend setup
echo "Setting up frontend..."
cd ../frontend || exit
npm install

echo "Setup complete!"
echo "Run ./run_app.sh to start the application"
