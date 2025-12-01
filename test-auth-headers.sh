#!/bin/bash

# Test script to verify authentication headers are working
# This simulates what oauth2-proxy should be sending to the backend

echo "Testing authentication with GitHub profile headers..."
echo ""

# Test 1: Health check (no auth required)
echo "1. Testing health endpoint (no auth):"
curl -s http://localhost:5001/api/health | jq .
echo ""

# Test 2: Simulating oauth2-proxy headers with GitHub user
echo "2. Testing with GitHub oauth2-proxy headers:"
curl -s -H "X-Auth-Request-User: ianlintner" \
     -H "X-Auth-Request-Email: ian@example.com" \
     -H "X-Auth-Request-Preferred-Username: Ian Lintner" \
     -H "X-Auth-Request-Access-Token: fake_token_for_testing" \
     http://localhost:5001/api/user/profile | jq .
echo ""

# Test 3: Check if user was created in storage
echo "3. Checking user creation (should have avatar if GitHub API was called):"
curl -s -H "X-Auth-Request-User: ianlintner" \
     -H "X-Auth-Request-Email: ian@example.com" \
     -H "X-Auth-Request-Preferred-Username: Ian Lintner" \
     -H "X-Auth-Request-Access-Token: fake_token_for_testing" \
     http://localhost:5001/api/user/profile | jq .
echo ""

echo "Test complete!"
echo ""
echo "Expected: User object with name, email, and avatar (from GitHub API)"
