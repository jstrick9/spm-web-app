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
  echo "🧪 Running tests..."
  bash $APP/test.sh
  return $?
}

current_branch() {
  git branch --show-current
}

case "$1" in

"feature")
  [ -z "$2" ] && echo "Usage: deploy feature \"name\"" && exit 1
  BRANCH="feature/$(echo $2 | tr ' ' '-' | tr '[:upper:]' '[:lower:]')"
  print_header "Creating: $BRANCH"
  git checkout develop && git pull origin develop
  git checkout -b "$BRANCH"
  echo "✅ On branch: $BRANCH"
  ;;

"merge-feature")
  BRANCH=$(current_branch)
  [[ ! "$BRANCH" == feature/* ]] && echo "❌ Not on feature branch" && exit 1
  print_header "Merging $BRANCH → develop"
  run_tests || { echo "❌ Tests failed"; exit 1; }
  git add -A
  git commit -m "feat: $(echo $BRANCH | sed 's/feature\///')" 2>/dev/null || true
  git checkout develop
  git merge "$BRANCH" --no-ff -m "merge: $BRANCH"
  git push origin develop
  echo "✅ Merged and pushed to develop"
  ;;

"staging")
  print_header "Deploying → Staging"
  git checkout develop && git pull origin develop
  run_tests || { echo "❌ Tests failed"; exit 1; }
  git checkout staging
  git merge develop --no-ff -m "deploy: staging $(date '+%Y-%m-%d %H:%M')"
  git push origin staging
  echo "✅ Deployed to staging"
  ;;

"production")
  print_header "🚀 Deploying → Production"
  read -p "Deploy to main? (yes/no): " C
  [ "$C" != "yes" ] && echo "❌ Cancelled" && exit 0
  git checkout staging && git pull origin staging
  run_tests || { echo "❌ Tests failed"; exit 1; }
  VERSION="v$(date '+%Y.%m.%d.%H%M')"
  git tag -a "$VERSION" -m "Release $VERSION"
  git checkout main
  git merge staging --no-ff -m "release: $VERSION"
  git push origin main
  git push origin "$VERSION"
  echo "✅ LIVE: $VERSION"
  ;;

"rollback")
  STEPS="${2:-1}"
  print_header "Rolling Back $STEPS Commits"
  git log --oneline -10
  read -p "Rollback $STEPS commits? (yes/no): " C
  [ "$C" != "yes" ] && echo "❌ Cancelled" && exit 0
  BACKUP="backup/$(date '+%Y%m%d%H%M%S')"
  git tag "$BACKUP"
  git revert HEAD~$STEPS..HEAD --no-edit
  git push origin "$(current_branch)"
  echo "✅ Rolled back — backup: $BACKUP"
  ;;

"push"|"save")
  MSG="${2:-wip: $(date '+%Y-%m-%d %H:%M')}"
  BRANCH=$(current_branch)
  git add -A
  git commit -m "$MSG" 2>/dev/null || echo "(nothing to commit)"
  git push origin "$BRANCH"
  echo "✅ Pushed to $BRANCH: $MSG"
  ;;

"status")
  print_header "Git Status"
  echo "Branch: $(current_branch)"
  git log --oneline -5
  echo ""
  git status --short
  ;;

"releases")
  git tag -l "v*" --sort=-version:refname | head -20
  ;;

"sync")
  print_header "Syncing All Branches"
  git checkout main && git pull origin main
  git checkout staging
  git merge main --no-ff -m "sync: staging with main" 2>/dev/null || true
  git push origin staging
  git checkout develop
  git merge staging --no-ff -m "sync: develop with staging" 2>/dev/null || true
  git push origin develop
  echo "✅ All branches synced"
  ;;

*)
  echo ""
  echo "Wedding App Deploy Tool"
  echo "══════════════════════════════════════════"
  echo "  deploy feature \"name\"   new feature branch"
  echo "  deploy merge-feature    merge to develop"
  echo "  deploy staging          test then stage"
  echo "  deploy production       go live"
  echo "  deploy push \"msg\"       quick save + push"
  echo "  deploy save \"msg\"       commit + push"
  echo "  deploy rollback         undo last commit"
  echo "  deploy rollback 3       undo last 3"
  echo "  deploy status           git log + status"
  echo "  deploy releases         list versions"
  echo "  deploy sync             sync all branches"
  echo "══════════════════════════════════════════"
  ;;
esac
