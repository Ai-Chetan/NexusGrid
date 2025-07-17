#!/usr/bin/env bash
set -o errexit

echo "📦 Installing dependencies..."
pip install -r requirements.txt

echo "🧹 Collecting static files..."
python manage.py collectstatic --noinput

echo "🧪 Running offline compression..."
python manage.py compress --force
