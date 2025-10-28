#!/bin/bash

# TripAdvisor Photo Scraper Script
# This script scrapes TripAdvisor photo galleries and updates nearby_listings with image URLs

set -e

echo "🚀 Starting TripAdvisor Photo Gallery Scraper"
echo "==========================================="
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
fi

# Run the photo scraper
npm run scrape-photos-bee

echo ""
echo "✅ Script completed!"
