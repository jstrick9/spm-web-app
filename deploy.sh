#!/bin/bash
# Self-locating deploy tool: derives the repo root from this script's own
# location so it works from any checkout on any machine.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if command -v node >/dev/null 2>&1; then
  :
elif [ -x /opt/homebrew/opt/node@20/bin/node ]; then
  export PATH="/opt/homebrew/opt/node@20/bin:/opt/homebrew/bin:$PATH"
fi
REPO="$SCRIPT_DIR"
APP="$REPO/wedding-app"
cd "$REPO"

print_header() {
  echo ""
  echo "══════════════════════════════════════════"
  echo "  $1"
  echo "══════════════════════════════════════════"
}

run_tests() {
  echo "Running tests..."
  bash $APP/test.sh
  return $?
}

current_branch() {
  git branch --show-current
}

case "$1" in

"feature")
  [ -z "$2" ] && echo "Usage: deploy feature name" && exit 1
  BRANCH="feature/$(echo $2 | tr ' ' '-' | tr '[:upper:]' '[:lower:]')"
  print_header "Creating: $BRANCH"
  git checkout develop
  git pull origin develop
  git checkout -b "$BRANCH"
  echo "Created branch: $BRANCH"
  ;;

"merge-feature")
  BRANCH=$(current_branch)
  if [[ ! "$BRANCH" == feature/* ]]; then
    echo "Not on a feature branch"
    exit 1
  fi
  print_header "Merging $BRANCH to develop"
  run_tests || { echo "Tests failed"; exit 1; }
  git add -A
  git commit -m "feat: $(echo $BRANCH | sed 's/feature\///')" 2>/dev/null || true
  git checkout develop
  git merge "$BRANCH" --no-ff -m "merge: $BRANCH"
  git push origin develop
  echo "Merged and pushed to develop"
  ;;

"staging")
  print_header "Deploying to Staging"
  git checkout develop
  git pull origin develop
  run_tests || { echo "Tests failed"; exit 1; }
  git checkout staging
  git merge develop --no-ff -m "deploy: staging $(date '+%Y-%m-%d %H:%M')"
  git push origin staging
  echo "Deployed to staging"
  ;;

"production")
  print_header "Deploying to Production"
  read -p "Deploy to main? (yes/no): " C
  [ "$C" != "yes" ] && echo "Cancelled" && exit 0
  git checkout staging
  git pull origin staging
  run_tests || { echo "Tests failed"; exit 1; }
  VERSION="v$(date '+%Y.%m.%d.%H%M')"
  git tag -a "$VERSION" -m "Release $VERSION"
  git checkout main
  git merge staging --no-ff -m "release: $VERSION"
  git push origin main
  git push origin "$VERSION"
  echo "DEPLOYED: $VERSION"
  ;;

"rollback")
  STEPS="${2:-1}"
  print_header "Rolling Back $STEPS Commits"
  git log --oneline -10
  echo ""
  read -p "Rollback $STEPS commits on $(current_branch)? (yes/no): " C
  [ "$C" != "yes" ] && echo "Cancelled" && exit 0
  BACKUP="backup/$(date '+%Y%m%d%H%M%S')"
  git tag "$BACKUP"
  git revert HEAD~$STEPS..HEAD --no-edit
  git push origin "$(current_branch)"
  echo "Rolled back. Backup tag: $BACKUP"
  ;;

"push"|"save")
  MSG="${2:-wip: $(date '+%Y-%m-%d %H:%M')}"
  BRANCH=$(current_branch)
  git add -A
  git commit -m "$MSG" 2>/dev/null || echo "Nothing to commit"
  git push origin "$BRANCH"
  echo "Pushed to $BRANCH: $MSG"
  ;;

"sync")
  print_header "Syncing All Branches"
  git fetch --all
  git checkout main
  git pull origin main
  git checkout staging
  git pull origin staging 2>/dev/null || git push origin staging
  git checkout develop
  git pull origin develop 2>/dev/null || git push origin develop
  echo "All branches synced"
  ;;

"status")
  print_header "Git Status"
  echo "Branch: $(current_branch)"
  echo ""
  git log --oneline -5
  echo ""
  git status --short
  ;;

"releases")
  print_header "All Releases"
  git tag -l "v*" --sort=-version:refname | head -20
  ;;

*)
  echo ""
  echo "Wedding App Deploy Tool"
  echo "══════════════════════════════════════════"
  echo "  deploy feature name    new feature branch"
  echo "  deploy merge-feature   merge to develop"
  echo "  deploy staging         deploy to staging"
  echo "  deploy production      go live on main"
  echo "  deploy push msg        quick save + push"
  echo "  deploy rollback        undo last commit"
  echo "  deploy rollback 3      undo last 3 commits"
  echo "  deploy status          git log + status"
  echo "  deploy sync            sync all branches"
  echo "  deploy releases        list versions"
  echo "══════════════════════════════════════════"
  ;;

esac
