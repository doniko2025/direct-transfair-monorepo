#!/bin/bash

API_URL="http://localhost:3000"

echo ""
echo "===== TESTS DIRECT TRANSF'AIR – FULL AUTO ====="
echo ""

##########################################
# 1) REGISTER USER
##########################################
echo "===== TEST 1 : REGISTER USER ====="
REGISTER_RES=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email":"jallowdoniko@gmail.com",
    "password":"123456789",
    "firstName":"Doniko",
    "lastName":"DIALLO",
    "address":"1 Square Jean Macé",
    "city":"Trappes",
    "zip":"78190",
    "phone":"0621158829"
  }')

echo "$REGISTER_RES"
echo ""

##########################################
# 2) REGISTER ADMIN
##########################################
echo "===== TEST 2 : REGISTER ADMIN ====="
ADMIN_RES=$(curl -s -X POST "$API_URL/auth/register-admin" \
  -H "Content-Type: application/json" \
  -d '{
    "email":"admin@transfair.com",
    "password":"admin12345"
  }')

echo "$ADMIN_RES"
echo ""

##########################################
# 3) LOGIN ADMIN
##########################################
echo "===== TEST 3 : LOGIN ADMIN ====="
LOGIN_ADMIN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@transfair.com","password":"admin12345"}')

echo "$LOGIN_ADMIN"

ADMIN_TOKEN=$(echo "$LOGIN_ADMIN" | jq -r '.access_token')
echo "ADMIN TOKEN = $ADMIN_TOKEN"
echo ""

##########################################
# 4) LOGIN USER
##########################################
echo "===== TEST 4 : LOGIN USER ====="
LOGIN_USER=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"jallowdoniko@gmail.com","password":"123456789"}')

echo "$LOGIN_USER"

USER_TOKEN=$(echo "$LOGIN_USER" | jq -r '.access_token')
echo "USER TOKEN = $USER_TOKEN"
echo ""

##########################################
# 5) CREATE BENEFICIARY
##########################################
echo "===== TEST 5 : CREATE BENEFICIARY ====="
BENEFICIARY_RES=$(curl -s -X POST "$API_URL/beneficiaries" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName":"Diallo Mamadou",
    "country":"Guinée",
    "city":"Conakry",
    "phone":"620000000"
  }')

echo "$BENEFICIARY_RES"

BENEFICIARY_ID=$(echo "$BENEFICIARY_RES" | jq -r '.id')
echo "BENEFICIARY ID = $BENEFICIARY_ID"
echo ""

##########################################
# 6) CREATE TRANSACTION
##########################################
echo "===== TEST 6 : CREATE TRANSACTION ====="
TRANSACTION_RES=$(curl -s -X POST "$API_URL/transactions" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"amount\": 100,
    \"currency\": \"EUR\",
    \"beneficiaryId\": \"$BENEFICIARY_ID\",
    \"payoutMethod\": \"CASH_PICKUP\"
  }")

echo "$TRANSACTION_RES"

TRANSACTION_ID=$(echo "$TRANSACTION_RES" | jq -r '.id')
echo "TRANSACTION ID = $TRANSACTION_ID"
echo ""

##########################################
# 7) ADMIN LIST TRANSACTIONS
##########################################
echo "===== TEST 7 : ADMIN LIST TRANSACTIONS ====="
ADMIN_LIST=$(curl -s -X GET "$API_URL/transactions/admin/all" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "$ADMIN_LIST"
echo ""

##########################################
# 8) ADMIN CHANGE STATUS
##########################################
echo "===== TEST 8 : ADMIN CHANGE STATUS ====="
ADMIN_CHANGE=$(curl -s -X PATCH "$API_URL/transactions/admin/status/$TRANSACTION_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"PAID"}')

echo "$ADMIN_CHANGE"
echo ""

echo "===== FIN DES TESTS ====="
#./tests-directtransfair.sh
#cd/c/dev/DirectTransfair/apps/backend
#cd apps/direct-transfair-mobile
#cd /c/dev/DirectTransfair
