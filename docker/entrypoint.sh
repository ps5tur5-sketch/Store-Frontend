#!/bin/sh
set -eu

escaped_api_url=$(printf '%s' "${API_BASE_URL:-http://127.0.0.1:3000}" | sed 's/\\/\\\\/g; s/"/\\"/g')
printf 'window.__APP_CONFIG__ = { API_BASE_URL: "%s" };\n' "$escaped_api_url" > /usr/share/nginx/html/config.js
exec nginx -g 'daemon off;'
