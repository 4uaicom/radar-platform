Cleaning git history (BFG) — safe procedure

Overview
- The repository contains accidentally committed `node_modules` and other large files. To reduce repo size, we can remove them from history using BFG (or git-filter-repo).
- This rewrites history and requires a forced push. All collaborators must re-clone afterwards.

Pre-flight
1. Ensure you have a backup: create a tag and push it:

```bash
git tag backup-before-clean-$(date +%Y%m%d%H%M)
git push origin --tags
```

2. Inform team: rewriting history will require everyone to re-clone or reset.

Recommended steps (automatic script)
- We provide `.github/scripts/clean_history.sh` which:
  - clones a bare mirror into `/tmp/radar-platform.git`
  - downloads `bfg` jar if needed
  - runs BFG to `--delete-folders node_modules` and `--strip-blobs-bigger-than 5M`
  - runs `git reflog expire` and `git gc`
  - prompts for a final confirmation `FORCE` before running `git push --force`

Manual steps (if you prefer):
1. Clone mirror:

```bash
git clone --mirror git@github.com:4uaicom/radar-platform.git radar-platform.git
cd radar-platform.git
```

2. Download BFG:

```bash
curl -sSL https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar -o bfg.jar
```

3. Run BFG (example):

```bash
java -jar bfg.jar --delete-folders node_modules --strip-blobs-bigger-than 5M ./
```

4. Cleanup and push:

```bash
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force
```

After cleanup
- All collaborators must re-clone the repo:

```bash
git clone git@github.com:4uaicom/radar-platform.git
```

- Alternatively, local clones can run a one-time reset:

```bash
git fetch origin
git reset --hard origin/main
git clean -fdx
```

Caveats
- Force-pushing rewrites history — PRs based on old commits will be orphaned.
- Consider running this during a maintenance window.
- Keep the mirror (`/tmp/radar-platform.git`) until you're confident.

If you want, I can run the provided script now. You must confirm you accept a force-push and that all collaborators are informed.
