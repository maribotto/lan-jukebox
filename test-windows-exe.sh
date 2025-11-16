#!/bin/bash

# Test Windows .exe build artifacts
# This script verifies that the built executables are valid
# Note: Full Wine testing is not reliable with pkg-bundled Node.js apps

set -e

echo "========================================="
echo "Testing Windows Build Artifacts"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

cd dist

# Test 1: Check if executables exist
echo "Test 1: Checking if executables exist..."
if [ ! -f "lan-jukebox.exe" ]; then
    echo -e "${RED}❌ FAILED: lan-jukebox.exe not found${NC}"
    exit 1
fi
if [ ! -f "generate-password.exe" ]; then
    echo -e "${RED}❌ FAILED: generate-password.exe not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Both executables exist${NC}"
echo ""

# Test 2: Check file sizes
echo "Test 2: Checking executable sizes..."
JUKEBOX_SIZE=$(stat -f%z "lan-jukebox.exe" 2>/dev/null || stat -c%s "lan-jukebox.exe" 2>/dev/null)
PASSWORD_SIZE=$(stat -f%z "generate-password.exe" 2>/dev/null || stat -c%s "generate-password.exe" 2>/dev/null)

# Executables should be > 30MB (pkg bundles Node.js runtime)
if [ "$JUKEBOX_SIZE" -lt 30000000 ]; then
    echo -e "${RED}❌ FAILED: lan-jukebox.exe is too small ($JUKEBOX_SIZE bytes)${NC}"
    exit 1
fi
if [ "$PASSWORD_SIZE" -lt 30000000 ]; then
    echo -e "${RED}❌ FAILED: generate-password.exe is too small ($PASSWORD_SIZE bytes)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Executable sizes are valid${NC}"
echo "   lan-jukebox.exe: $(numfmt --to=iec-i --suffix=B $JUKEBOX_SIZE 2>/dev/null || echo "$JUKEBOX_SIZE bytes")"
echo "   generate-password.exe: $(numfmt --to=iec-i --suffix=B $PASSWORD_SIZE 2>/dev/null || echo "$PASSWORD_SIZE bytes")"
echo ""

# Test 3: Check file headers (PE format)
echo "Test 3: Checking file format..."
if file "lan-jukebox.exe" | grep -q "PE32+ executable"; then
    echo -e "${GREEN}✅ lan-jukebox.exe is a valid PE32+ executable${NC}"
elif file "lan-jukebox.exe" | grep -q "PE32 executable"; then
    echo -e "${GREEN}✅ lan-jukebox.exe is a valid PE32 executable${NC}"
else
    echo -e "${RED}❌ FAILED: lan-jukebox.exe is not a valid Windows executable${NC}"
    file "lan-jukebox.exe"
    exit 1
fi

if file "generate-password.exe" | grep -q "PE32"; then
    echo -e "${GREEN}✅ generate-password.exe is a valid PE executable${NC}"
else
    echo -e "${RED}❌ FAILED: generate-password.exe is not a valid Windows executable${NC}"
    file "generate-password.exe"
    exit 1
fi
echo ""

# Test 4: Check required files
echo "Test 4: Checking required support files..."
MISSING_FILES=()

if [ ! -f "config.example.json" ]; then
    MISSING_FILES+=("config.example.json")
fi
if [ ! -f "README.txt" ]; then
    MISSING_FILES+=("README.txt")
fi
if [ ! -d "public" ]; then
    MISSING_FILES+=("public/")
fi
if [ ! -f "public/index.html" ]; then
    MISSING_FILES+=("public/index.html")
fi
if [ ! -f "public/mobile.html" ]; then
    MISSING_FILES+=("public/mobile.html")
fi
if [ ! -f "public/login.html" ]; then
    MISSING_FILES+=("public/login.html")
fi

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo -e "${RED}❌ FAILED: Missing required files:${NC}"
    for file in "${MISSING_FILES[@]}"; do
        echo "   - $file"
    done
    exit 1
fi

echo -e "${GREEN}✅ All required support files present${NC}"
echo ""

# Test 5: Check config.example.json is valid JSON
echo "Test 5: Validating config.example.json..."
if ! python3 -m json.tool config.example.json > /dev/null 2>&1; then
    echo -e "${RED}❌ FAILED: config.example.json is not valid JSON${NC}"
    exit 1
fi
echo -e "${GREEN}✅ config.example.json is valid JSON${NC}"
echo ""

# Test 6: Check HTML files are valid
echo "Test 6: Validating HTML files..."
for htmlfile in public/index.html public/mobile.html public/login.html; do
    if ! grep -q "<!DOCTYPE html>" "$htmlfile"; then
        echo -e "${RED}❌ FAILED: $htmlfile missing DOCTYPE${NC}"
        exit 1
    fi
done
echo -e "${GREEN}✅ All HTML files have DOCTYPE${NC}"
echo ""

cd ..

echo ""
echo "========================================="
echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
echo "========================================="
echo ""
echo "The Windows build artifacts are valid and ready for release!"
echo ""
echo -e "${YELLOW}Note: Full runtime testing requires Windows environment.${NC}"
echo "These executables have been validated on Windows in the past."
