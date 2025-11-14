#!/bin/bash

echo "Testing all pages for errors..."
echo "================================"

# Test function
test_page() {
    local url=$1
    local name=$2

    response=$(curl -s -o /dev/null -w "%{http_code}" "$url")

    if [[ $response == 200 ]] || [[ $response == 307 ]]; then
        echo "✅ $name: HTTP $response"
    else
        echo "❌ $name: HTTP $response (unexpected)"
    fi
}

# Test all pages
test_page "http://localhost:3000/" "Landing Page"
test_page "http://localhost:3000/onboarding" "Onboarding Page"
test_page "http://localhost:3000/auth/sign-in" "Sign-in Page"
test_page "http://localhost:3000/auth/sign-up" "Sign-up Page"
test_page "http://localhost:3000/dashboard" "Dashboard (expects redirect)"
test_page "http://localhost:3000/dashboard/settings" "Settings (expects redirect)"

echo "================================"
echo "Test complete!"