#!/usr/bin/env bash
set -euo pipefail

echo "This script creates recurring monthly Stripe prices with lookup keys:"
echo "  - starter_monthly"
echo "  - pro_monthly"
echo
echo "You need the Stripe CLI installed and authenticated."
echo "Docs: https://stripe.com/docs/stripe-cli"
echo

echo "Creating Starter product..."
starter_product_json=$(stripe products create \
  --name "Starter" \
  --description "Perfect for getting started")
starter_product_id=""
if command -v jq >/dev/null 2>&1; then
  starter_product_id=$(printf '%s' "$starter_product_json" | jq -r '.id')
else
  starter_product_id=$(printf '%s' "$starter_product_json" | sed -n 's/.*"id": "\\([^"]*\\)".*/\\1/p' | head -n 1)
fi
if [ -z "$starter_product_id" ] || [ "$starter_product_id" = "null" ]; then
  echo "$starter_product_json"
  read -r -p "Paste the Starter product id (prod_...): " starter_product_id
fi
echo "Using Starter product id: $starter_product_id"

echo "Creating Starter monthly recurring price..."
stripe prices create \
  --product "${starter_product_id}" \
  --unit-amount 900 \
  --currency usd \
  -d 'recurring[interval]=month' \
  -d lookup_key=starter_monthly \
  -d nickname="Starter Monthly"
echo

echo "Creating Professional product..."
pro_product_json=$(stripe products create \
  --name "Professional" \
  --description "Best for growing businesses")
pro_product_id=""
if command -v jq >/dev/null 2>&1; then
  pro_product_id=$(printf '%s' "$pro_product_json" | jq -r '.id')
else
  pro_product_id=$(printf '%s' "$pro_product_json" | sed -n 's/.*"id": "\\([^"]*\\)".*/\\1/p' | head -n 1)
fi
if [ -z "$pro_product_id" ] || [ "$pro_product_id" = "null" ]; then
  echo "$pro_product_json"
  read -r -p "Paste the Professional product id (prod_...): " pro_product_id
fi
echo "Using Professional product id: $pro_product_id"

echo "Creating Professional monthly recurring price..."
stripe prices create \
  --product "${pro_product_id}" \
  --unit-amount 2900 \
  --currency usd \
  -d 'recurring[interval]=month' \
  -d lookup_key=pro_monthly \
  -d nickname="Professional Monthly"
echo

echo "Done. Your lookup keys are starter_monthly and pro_monthly."
