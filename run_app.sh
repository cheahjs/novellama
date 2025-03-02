#!/bin/bash

cd "$(dirname "$0")" || exit

# Start the backend
echo "Starting backend server..."
cd backend || exit 
uv run app.py &
BACKEND_PID=$!

# Start the frontend
echo "Starting frontend development server..."
cd ../frontend || exit 
npm start &
FRONTEND_PID=$!

# Handle shutdown
function cleanup {
  echo "Shutting down servers..."
  kill $BACKEND_PID
  kill $FRONTEND_PID
  exit 0
}

trap cleanup SIGINT

echo "Servers are running. Press Ctrl+C to stop."

# Keep script running
wait