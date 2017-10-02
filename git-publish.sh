#!/bin/bash

# Script to push output for npm to the `npm` branch of the repository.
# This allows to use the package as a `git` dependency by pointing at this branch
# (or a specific commit).

# Inspired by a similar script in `immutable.js`:
# https://github.com/facebook/immutable-js/blob/master/resources/gitpublish.sh

set -e

REPO=slowli/exonum-types
BOT_NAME="Travis CI"
BOT_EMAIL="ostrovski.alex@gmail.com"

rm -rf npm
git clone -b npm "https://${GH_TOKEN}@github.com/${REPO}.git" npm

rm -rf npm/* npm/.gitkeep

cp -r dist npm/
cp LICENSE npm/
cp package.json npm/
cp README.md npm/

cd npm
git config user.name "${BOT_NAME}"
git config user.email "${BOT_EMAIL}"
git config push.default "simple"
git add -A .
if git diff --staged --quiet; then
  echo "Nothing to publish"
else
  git commit -a -m "Deploy master on GitHub"
  git push >/dev/null 2>&1
  echo "Published to npm branch of ${REPO}"
fi
