#!/usr/bin/env bash
set -euo pipefail

# clean_history.sh
# Safely remove node_modules folders and large blobs from git history using BFG.
# WARNING: This rewrites history and requires a force-push to remote. Create backups first.

REPO_URL=$(git remote get-url origin)
MIRROR_DIR="/tmp/radar-platform.git"
BFG_JAR="/tmp/bfg.jar"
BFG_URL="https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar"

echo "Repository: $REPO_URL"

read -p "This will create a bare mirror at $MIRROR_DIR and rewrite history. Continue? (yes/NO) " confirm
if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

# Create a mirror clone
rm -rf "$MIRROR_DIR"
git clone --mirror "$REPO_URL" "$MIRROR_DIR"

# Download BFG if missing
if [ ! -f "$BFG_JAR" ]; then
  echo "Downloading BFG to $BFG_JAR"
  curl -sSL "$BFG_URL" -o "$BFG_JAR"
fi

# Run BFG to delete node_modules folders and strip blobs bigger than 5MB
java -jar "$BFG_JAR" --delete-folders node_modules --strip-blobs-bigger-than 5M "$MIRROR_DIR"

# Cleanup and compact
cd "$MIRROR_DIR"
# expire reflogs and garbage collect
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Push cleaned mirror (force)
echo "About to force-push cleaned history to origin. This will rewrite remote history."
read -p "Type FORCE to proceed with force-push: " force_confirm
if [ "$force_confirm" != "FORCE" ]; then
  echo "Force-push aborted. Mirror kept at $MIRROR_DIR"
  exit 1
fi

git push --force

echo "History cleaned and pushed. Be sure to notify collaborators to re-clone the repo." 
