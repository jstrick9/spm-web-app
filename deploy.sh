#!/bin/bash

export PATH="/opt/homebrew/opt/node@20/bin:/opt/homebrew/bin:$PATH"
REPO="$HOME/ai-workspace/spm-web-app"
APP="$REPO/wedding-app"

cd $REPO

print_header() {
  echo ""
  echo "══════════════════════════════════════════"
  echo "  $1"
  echo "══════════════════════════════════════════"
}

run_tests() {
  echo ""
  echo "🧪 Running tests..."
  bash $APP/test.sh
  return $?
}

current_branch() {
  git branch --show-current
}

case "$1" in

"feature")
  if [ -z "$2" ]; then
    echo "Usage: deploy feature \"description\""
    exit 1
  fi
  BRANCH="feature/$(echo $2 | tr ' ' '-' | tr '[:upper:]' '[:lower:]')"
  print_header "Creating Feature Branch: $BRANCH"
  git checkout develop
  git pull origin develop
  git checkout -b "$BRANCH"
  echo "✅ Created: $BRANCH"
  echo "When done run: deploy merge-feature"
  ;;

"merge-feature")
  BRANCH=$(current_branch)
  print_header "Merging $BRANCH → develop"
  if [[ ! "$BRANCH" == feature/* ]]; then
    echo "❌ Not on a feature branch (on: $BRANCH)"
    exit 1
  fi
  run_tests
  if [ $? -ne 0 ]; then
    echo "❌ Tests failed — fix before merging"
    exit 1
  fi
  git add -A
  git commit -m "feat: $(echo $BRANCH | sed 's/feature\///')" 2>/dev/null || true
  git checkout develop
  git merge "$BRANCH" --no-ff -m "merge: $BRANCH into develop"
  git push origin develop
  echo "✅ Merged to develop and pushed"
  echo "   https://github.com/jstrick9/spm-web-app/tree/develop"
  ;;

"staging")
  print_header "Deploying to Staging"
  git checkout develop
  git pull origin develop
  run_tests
  if [ $? -ne 0 ]; then
    echo "❌ Tests failed — cannot deploy to staging"
    exit 1
  fi
  git checkout staging
  git merge develop --no-ff -m "deploy: develop → staging ($(date '+%Y-%m-%d %H:%M'))"
  git push origin staging
  echo "✅ Deployed to staging"
  echo "   Test at: http://localhost:5173"
  echo "   When ready: deploy production"
  ;;

"production")
  print_header "🚀 Deploying to Production"
  echo "⚠️  Deploying to MAIN branch."
  read -p "   Are you sure? (yes/no): " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Cancelled"
    exit 0
  fi
  git checkout staging
  git pull origin staging
  run_tests
  if [ $? -ne 0 ]; then
    echo "❌ Tests failed — cannot deploy to production"
    exit 1
  fi
  VERSION="v$(date '+%Y.%m.%d.%H%M')"
  git tag -a "$VERSION" -m "Release $VERSION"
  git checkout main
  git merge staging --no-ff -m "release: $VERSION"
  git push origin main
  git push origin "$VERSION"
  echo "✅ DEPLOYED TO PRODUCTION"
  echo "   Version: $VERSION"
  echo "   https://github.com/jstrick9/spm-web-app"
  ;;

"rollback")
  STEPS="${2:-1}"
  print_header "🔄 Rolling Back $STEPS Commit(s)"
  BRANCH=$(current_branch)
  echo "Branch: $BRANCH"
  echo ""
  git log --oneline -10
  echo ""
  read -p "Rollback $STEPS commit(s)? (yes/no): " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Cancelled"
    exit 0
  fi
  BACKUP="backup/$(date '+%Y%m%d%H%M%S')"
  git tag "$BACKUP"
  echo "✅ Backup saved as tag: $BACKUP"
  git revert HEAD~$STEPS..HEAD --no-edit
  git push origin "$BRANCH"
  echo "✅ Rolled back $STEPS commit(s)"
  echo "   To restore: git checkout $BACKUP"
  ;;

"save")
  MSG="${2:-wip: save progress $(date '+%Y-%m-%d %H:%M')}"
  print_header "Saving Current Work"
  git add -A
  git commit -m "$MSG" 2>/dev/null || echo "(nothing to commit)"
  git push origin "$(current_branch)"
  echo "✅ Saved: $MSG"
  ;;

"push")
  MSG="${2:-auto: save progress $(date '+%H:%M')}"
  BRANCH=$(current_branch)
  git add -A
  git commit -m "$MSG" 2>/dev/null || true
  git push origin "$BRANCH"
  echo "✅ Pushed to GitHub: $BRANCH"
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
  echo ""
  echo "WORKFLOW:"
  echo "  deploy feature \"name\"  → new feature branch"
  echo "  deploy merge-feature   → merge to develop"
  echo "  deploy staging         → test before production"
  echo "  deploy production      → go live on main"
  echo ""
  echo "UTILITIES:"
  echo "  deploy push \"msg\"  → quick save + push"
  echo "  deploy save \"msg\"  → commit + push"
  echo "  deploy status      → git log + status"
  echo "  deploy releases    → list versions"
  echo "  deploy rollback    → undo last commit"
  echo "  deploy rollback 3  → undo last 3 commits"
  echo ""
  ;;

esac
