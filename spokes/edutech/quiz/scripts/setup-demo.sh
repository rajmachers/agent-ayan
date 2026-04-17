#!/bin/bash

# Demo Quiz Seeding Script Runner
# Quick setup for Ayan.ai proctoring demo

set -e

echo "🎯 Setting up demo quiz data for Ayan.ai proctoring integration..."
echo ""

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
  echo "❌ Error: Please run this script from the demo-quiz directory"
  echo "   Expected: apps/demo-quiz/"
  exit 1
fi

# Install dependencies if needed
if [[ ! -d "node_modules" ]]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Generate seeding data
echo "🔧 Generating demo data..."
npx ts-node scripts/seed-demo-data.ts

echo ""
echo "✅ Demo quiz setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Apply the generated SQL to your PostgreSQL database:"
echo "   psql -d ayan_db -f seed-data/demo-quiz-seed.sql"
echo ""
echo "2. Start the demo quiz app:"
echo "   npm run dev"
echo ""
echo "3. Start the main Ayan.ai system and create proctoring sessions"
echo ""
echo "🎮 Demo entity structure created:"
echo "   └── Computer Science Department (org)"
echo "       └── Financial Literacy Challenge 2026 (exam)" 
echo "           ├── Fall 2026 CS Cohort (batch)"
echo "           └── Spring 2027 CS Cohort (batch)"
echo "               └── Multiple delivery schedules"
echo "                   └── Candidate sessions ready for proctoring"
echo ""