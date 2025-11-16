#!/bin/bash

# Automated Release Script for LAN Jukebox
# This script automates the entire release process:
# 1. Updates version in package.json
# 2. Commits and pushes changes
# 3. Creates GitHub release
# 4. GitHub Actions then automatically builds, tests, and deploys

set -e  # Exit on any error

echo "========================================="
echo "LAN Jukebox Release Automation"
echo "========================================="
echo ""

# Check if we're on master branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "master" ]; then
    echo "⚠️  WARNING: You are on branch '$CURRENT_BRANCH', not 'master'"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  WARNING: You have uncommitted changes!"
    git status --short
    echo ""
    read -p "Do you want to commit these changes as part of the release? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Please commit your changes first, then run this script again."
        exit 1
    fi
fi

# Read current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"
echo ""

# Ask for new version
read -p "Enter new version (e.g., 1.15.0): " NEW_VERSION

# Validate version format (basic check)
if ! [[ $NEW_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "❌ Invalid version format. Use semantic versioning (e.g., 1.15.0)"
    exit 1
fi

# Check if version is newer
if [ "$NEW_VERSION" == "$CURRENT_VERSION" ]; then
    echo "❌ New version must be different from current version"
    exit 1
fi

echo ""
echo "Version will be updated: $CURRENT_VERSION → $NEW_VERSION"
echo ""

# Ask for release title
read -p "Enter release title (e.g., 'New Feature Name'): " RELEASE_TITLE
if [ -z "$RELEASE_TITLE" ]; then
    RELEASE_TITLE="Release v$NEW_VERSION"
fi

# Ask for release notes
echo ""
echo "Enter release notes (press Ctrl+D when done, or leave empty for auto-generated):"
RELEASE_NOTES=$(cat)

if [ -z "$RELEASE_NOTES" ]; then
    RELEASE_NOTES="Release v$NEW_VERSION"
fi

echo ""
echo "========================================="
echo "Release Summary"
echo "========================================="
echo "Version:      v$NEW_VERSION"
echo "Title:        $RELEASE_TITLE"
echo "Notes:        $RELEASE_NOTES"
echo "Branch:       $CURRENT_BRANCH"
echo ""
read -p "Proceed with release? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "========================================="
echo "Step 1: Updating package.json"
echo "========================================="

# Update version in package.json using node
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('✅ Updated package.json to version $NEW_VERSION');
"

echo ""
echo "========================================="
echo "Step 2: Committing changes"
echo "========================================="

git add package.json
git commit -m "Bump version to $NEW_VERSION for release

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

echo "✅ Changes committed"

echo ""
echo "========================================="
echo "Step 3: Pushing to GitHub"
echo "========================================="

git push

echo "✅ Pushed to GitHub"

echo ""
echo "========================================="
echo "Step 4: Building Windows executables"
echo "========================================="

# Build Windows executables locally (faster and more reliable than CI)
npm run build:win

echo "✅ Windows executables built"

echo ""
echo "========================================="
echo "Step 5: Creating release archive"
echo "========================================="

# Create zip archive
cd dist
zip -r "lan-jukebox-windows-v$NEW_VERSION.zip" \
    lan-jukebox.exe \
    generate-password.exe \
    config.example.json \
    README.txt \
    public/

cd ..
mv "dist/lan-jukebox-windows-v$NEW_VERSION.zip" .

echo "✅ Release archive created: lan-jukebox-windows-v$NEW_VERSION.zip"

echo ""
echo "========================================="
echo "Step 6: Creating GitHub release"
echo "========================================="

# Create GitHub release
gh release create "v$NEW_VERSION" \
    --title "v$NEW_VERSION - $RELEASE_TITLE" \
    --notes "$RELEASE_NOTES" \
    "lan-jukebox-windows-v$NEW_VERSION.zip"

echo "✅ GitHub release created with Windows .exe"

echo ""
echo "========================================="
echo "✅ Release Process Complete!"
echo "========================================="
echo ""
echo "Release tag:  v$NEW_VERSION"
echo "Release URL:  https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/releases/tag/v$NEW_VERSION"
echo ""
echo "GitHub Actions will now:"
echo "  🔨 Build and test Docker image"
echo "  🚀 Deploy Docker image to Docker Hub"
echo ""
echo "Windows .exe has been built locally and uploaded to the release."
echo ""
echo "View workflow progress:"
echo "  gh run watch"
echo ""
echo "Or visit:"
echo "  https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/actions"
echo ""
