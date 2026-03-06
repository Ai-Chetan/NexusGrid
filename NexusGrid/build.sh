#!/usr/bin/env bash
set -o errexit

echo "📦 Installing dependencies..."
pip install -r requirements.txt

echo "🧹 Collecting static files..."
python manage.py collectstatic --noinput

if python manage.py help | grep -q "compress"; then
	echo "🧪 Running offline compression..."
	python manage.py compress --force
else
	echo "⏭ Skipping offline compression (django-compressor not installed/configured)."
fi