#!/bin/bash

# ══════════════════════════════════════════════
# Wedding App Deployment Script
# Usage:
#   ./deploy.sh feature "Add bookings table"
#   ./deploy.sh staging
#   ./deploy.sh production
#   ./deploy.sh rollback
#   ./deploy.sh rollback 2  (rollback 2 commits)
# ══════════════════════════════════════════════

export PATH="/opt/homebrew/opt/node@20/bin:/opt/homebrew/bin:$PATH"
REPO="$HOME/ai-workspace/spm-web-app"
APP="$REPO/wedding-app"

cd $REPO

# ── Helper functions ─────────────────────────

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

# ── Commands ─────────────────────────────────

case "$1" in

# ── Create feature branch ────────────────────
"feature")
  if [ -z "$2" ]; then
    echo "Usage: ./deploy.sh feature \"description\""
    exit 1
  fi
  BRANCH="feature/$(echo $2 | tr ' ' '-' | tr '[:upper:]' '[:lower:]')"
  print_header "Creating Feature Branch: $BRANCH"
  git checkout develop
  git pull origin develop
  git checkout -b "$BRANCH"
  echo "✅ Created and switched to: $BRANCH"
  echo ""
  echo "When done with this feature run:"
  echo "  ./deploy.sh merge-feature"
  ;;

# ── Merge feature → develop ──────────────────
"merge-feature")
  BRANCH=$(current_branch)
  print_header "Merging $BRANCH → develop"

  if [[ ! "$BRANCH" == feature/* ]]; then
    echo "❌ Not on a feature branch (currently on: $BRANCH)"
    exit 1
  fi

  run_tests
  if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Tests failed — fix issues before merging"
    exit 1
  fi

  git add -A
  git commit -m "feat: $(echo $BRANCH | sed 's/feature\///')" \
    2>/dev/null || echo "(nothing to commit)"
  git checkout develop
  git merge "$BRANCH" --no-ff \
    -m "merge: $BRANCH into develop"
  git push origin develop
  echo ""
  echo "✅ Merged to develop and pushed to GitHub"
  echo "   View at: https://github.com/jstrick9/spm-web-app/tree/develop"
  ;;

# ── Deploy develop → staging ─────────────────
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
  git merge develop --no-ff \
    -m "deploy: develop → staging ($(date '+%Y-%m-%d %H:%M'))"
  git push origin staging

  echo ""
  echo "✅ Deployed to staging branch"
  echo "   Test your changes at: http://localhost:5173"
  echo "   When satisfied run: ./deploy.sh production"
  ;;

# ── Deploy staging → main (production) ───────
"production")
  print_header "🚀 Deploying to Production (main)"

  echo "⚠️  You are about to deploy to MAIN branch."
  echo "   This updates your live production code."
  echo ""
  read -p "   Are you sure? (yes/no): " CONFIRM

  if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Deployment cancelled"
    exit 0
  fi

  git checkout staging
  git pull origin staging

  run_tests
  if [ $? -ne 0 ]; then
    echo "❌ Tests failed — cannot deploy to production"
    exit 1
  fi

  # Tag the release
  VERSION="v$(date '+%Y.%m.%d.%H%M')"
  git tag -a "$VERSION" -m "Release $VERSION"

  git checkout main
  git merge staging --no-ff \
    -m "release: $VERSION — $(date '+%Y-%m-%d %H:%M')"
  git push origin main
  git push origin "$VERSION"

  echo ""
  echo "✅ DEPLOYED TO PRODUCTION"
  echo "   Version: $VERSION"
  echo "   Branch: main"
  echo "   View: https://github.com/jstrick9/spm-web-app"
  echo ""
  echo "To rollback: ./deploy.sh rollback"
  ;;

# ── Rollback ─────────────────────────────────
"rollback")
  STEPS="${2:-1}"
  print_header "🔄 Rolling Back $STEPS Commit(s)"

  BRANCH=$(current_branch)
  echo "Current branch: $BRANCH"
  echo ""

  echo "Recent commits:"
  git log --oneline -10
  echo ""

  read -p "Rollback $STEPS commit(s) on $BRANCH? (yes/no): " CONFIRM

  if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Rollback cancelled"
    exit 0
  fi

  # Save current state as backup tag
  BACKUP="backup/$(date '+%Y%m%d%H%M%S')"
  git tag "$BACKUP"
  echo "✅ Current state saved as tag: $BACKUP"

  # Perform rollback
  git revert HEAD~$STEPS..HEAD --no-edit
  git push origin "$BRANCH"

  echo ""
  echo "✅ ROLLED BACK $STEPS commit(s)"
  echo "   Branch: $BRANCH"
  echo "   Backup tag: $BACKUP"
  echo ""
  echo "To restore the backup:"
  echo "  git checkout $BACKUP"
  ;;

# ── Quick save (commit current work) ─────────
"save")
  MSG="${2:-wip: save progress $(date '+%Y-%m-%d %H:%M')}"
  print_header "Saving Current Work"

  git add -A
  git commit -m "$MSG"
  git push origin "$(current_branch)"

  echo "✅ Saved and pushed: $MSG"
  ;;

# ── Status ───────────────────────────────────
"status")
  print_header "Git Status"
  echo "Branch: $(current_branch)"
  echo ""
  git log --oneline -5
  echo ""
  git status --short
  ;;

# ── List all tags (releases) ─────────────────
"releases")
  print_header "All Releases"
  git tag -l "v*" --sort=-version:refname | head -20
  ;;

# ── Help ─────────────────────────────────────
*)
  echo ""
  echo "Wedding App Deploy Tool"
  echo "══════════════════════════════════════════"
  echo ""
  echo "WORKFLOW:"
  echo "  1. ./deploy.sh feature \"my feature name\""
  echo "     → Creates feature/my-feature-name branch"
  echo "     → Make your changes"
  echo "     → Test at http://localhost:5173"
  echo ""
  echo "  2. ./deploy.sh merge-feature"
  echo "     → Runs tests"
  echo "     → Merges to develop"
  echo "     → Pushes to GitHub"
  echo ""
  echo "  3. ./deploy.sh staging"
  echo "     → Runs tests"
  echo "     → Deploys develop → staging"
  echo "     → Test staging at http://localhost:5173"
  echo ""
  echo "  4. ./deploy.sh production"
  echo "     → Runs tests"
  echo "     → Confirms with you"
  echo "     → Deploys staging → main"
  echo "     → Creates version tag"
  echo ""
  echo "UTILITIES:"
  echo "  ./deploy.sh save \"message\"  → Quick commit + push"
  echo "  ./deploy.sh status          → Git status + log"
  echo "  ./deploy.sh releases        → List all releases"
  echo "  ./deploy.sh rollback        → Undo last commit"
  echo "  ./deploy.sh rollback 3      → Undo last 3 commits"
  echo ""
  ;;
esac
