#!/usr/bin/env bash
# Upload a Playwright-recorded .webm video to a GitHub PR as a release asset
# and post a comment with the download link.
#
# Usage: ./scripts/upload-pr-video.sh <pr-number> <video-file>
#
# Prerequisites:
#   - gh CLI authenticated with push access
#   - A "ci-assets" pre-release exists on the repo (created once, reused forever)
#
# The script:
#   1. Finds or creates the ci-assets release
#   2. Uploads the .webm as a release asset with a unique name
#   3. Posts a PR comment with the download link
#
# Note: GitHub does not support inline video playback for release asset URLs.
# Videos render as download links. For inline playback, manually drag-and-drop
# the .webm into the PR description via the GitHub web UI.

set -euo pipefail

REPO="${GITHUB_REPO:-njbrake/porchsongs}"
PR_NUMBER="${1:?Usage: $0 <pr-number> <video-file>}"
VIDEO_FILE="${2:?Usage: $0 <pr-number> <video-file>}"
TAG_NAME="ci-assets"

if [ ! -f "$VIDEO_FILE" ]; then
  echo "Error: Video file not found: $VIDEO_FILE" >&2
  exit 1
fi

# Step 1: Get or create the ci-assets release
RELEASE_ID=$(gh api "repos/${REPO}/releases/tags/${TAG_NAME}" --jq '.id' 2>/dev/null || echo "")

if [ -z "$RELEASE_ID" ]; then
  echo "Creating ci-assets release..."
  DEFAULT_SHA=$(gh api "repos/${REPO}/git/ref/heads/main" --jq '.object.sha')
  gh api "repos/${REPO}/git/refs" --method POST \
    -f ref="refs/tags/${TAG_NAME}" -f sha="${DEFAULT_SHA}" >/dev/null 2>&1 || true
  RELEASE_ID=$(gh api "repos/${REPO}/releases" --method POST \
    -f tag_name="${TAG_NAME}" \
    -f name="CI Assets" \
    -f body="Auto-managed release for CI/agent video uploads. Do not delete." \
    -F draft=false -F prerelease=true --jq '.id')
  echo "Created release ID: ${RELEASE_ID}"
fi

# Step 2: Upload video as release asset
TIMESTAMP=$(date +%s)
ASSET_NAME="pr-${PR_NUMBER}-demo-${TIMESTAMP}.webm"
TOKEN=$(gh auth token)

echo "Uploading ${VIDEO_FILE} as ${ASSET_NAME}..."
UPLOAD_RESPONSE=$(curl -sS \
  -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: video/webm" \
  --data-binary @"${VIDEO_FILE}" \
  "https://uploads.github.com/repos/${REPO}/releases/${RELEASE_ID}/assets?name=${ASSET_NAME}")

ASSET_URL=$(echo "$UPLOAD_RESPONSE" | python3 -c "import json,sys; print(json.load(sys.stdin)['browser_download_url'])" 2>/dev/null)

if [ -z "$ASSET_URL" ]; then
  echo "Error: Upload failed. Response:" >&2
  echo "$UPLOAD_RESPONSE" >&2
  exit 1
fi

echo "Uploaded: ${ASSET_URL}"

# Step 3: Post PR comment with download link
gh pr comment "${PR_NUMBER}" --repo "${REPO}" --body "$(cat <<EOF
## Demo Video

[Download demo video (${ASSET_NAME})](${ASSET_URL})

> Playwright-recorded .webm — download and open in browser to view.
EOF
)"

echo "Comment posted on PR #${PR_NUMBER}"
echo "Video URL: ${ASSET_URL}"
