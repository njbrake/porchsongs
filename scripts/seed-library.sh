#!/usr/bin/env bash
# Seed the library with sample songs for testing the horizontal scroll layout.
#
# Usage:
#   ./scripts/seed-library.sh [BASE_URL]          # OSS (no auth)
#   ./scripts/seed-library.sh [BASE_URL] -t TOKEN  # Premium (pass JWT access token)
#
# To get your access token from the browser:
#   Open DevTools > Application > Local Storage > look for "porchsongs_access_token"
#
# Default BASE_URL: http://localhost:8000

set -euo pipefail

BASE="${1:-http://localhost:8000}"
TOKEN=""

# Parse optional -t TOKEN flag
shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--token) TOKEN="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

AUTH_HEADER=""
if [ -n "$TOKEN" ]; then
  AUTH_HEADER="Authorization: Bearer $TOKEN"
fi

api_curl() {
  if [ -n "$AUTH_HEADER" ]; then
    curl -sf -H "$AUTH_HEADER" "$@"
  else
    curl -sf "$@"
  fi
}

# Ensure a profile exists (OSS auto-creates one on first request)
PROFILE_ID=$(api_curl "$BASE/api/profiles" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if d else '')" 2>/dev/null)
if [ -z "$PROFILE_ID" ]; then
  echo "Error: no profile found. Log in first, then retry." >&2
  [ -n "$TOKEN" ] || echo "Hint: premium mode requires -t TOKEN. See --help." >&2
  exit 1
fi

post_song() {
  local title="$1" artist="$2" content="$3" folder="${4:-}"
  local body
  body=$(python3 -c "
import json, sys
print(json.dumps({
    'profile_id': int(sys.argv[1]),
    'title': sys.argv[2],
    'artist': sys.argv[3],
    'original_content': sys.argv[4],
    'rewritten_content': sys.argv[4],
    'changes_summary': 'Seeded for testing',
    'folder': sys.argv[5] or None,
}))
" "$PROFILE_ID" "$title" "$artist" "$content" "$folder")
  api_curl -X POST "$BASE/api/songs" \
    -H "Content-Type: application/json" \
    -d "$body" > /dev/null
  echo "  + $title"
}

echo "Seeding library (profile $PROFILE_ID)..."

# --- Big song: many verses, long lines, chord annotations ---
read -r -d '' BIG_SONG << 'LYRICS' || true
[Verse 1]
G                    C
Woke up this morning with the sunrise in my eyes
D                         G
Coffee on the counter and the birds began to rise
G                    C
Stepped out on the porch where the old wood creaks and groans
D                         G
Felt the whole world turning underneath these aging bones

[Chorus]
C              G
Sing it out loud, let the whole town hear
D                          G
Every broken promise, every wasted year
C              G
Sing it out loud till your voice gives in
D                          G
Then catch your breath and sing it all again

[Verse 2]
G                    C
Drove down to the river where we used to skip our stones
D                         G
Past the church, the hardware store, the field of overgrown
G                    C
Saw old Johnny Walker sitting on his tailgate throne
D                         G
Playing every country song he ever called his own

[Chorus]
C              G
Sing it out loud, let the whole town hear
D                          G
Every broken promise, every wasted year
C              G
Sing it out loud till your voice gives in
D                          G
Then catch your breath and sing it all again

[Bridge]
Am               C
Time don't wait for dreamers
G                D
Or the plans we never made
Am               C
But a song can hold a moment
G                D
Long after the memory starts to fade

[Verse 3]
G                    C
Called up my brother, haven't talked since last July
D                         G
He said the baby's walking now and man, how time flies by
G                    C
We laughed about the trouble that we got in as kids
D                         G
Promised we'd do better but we both know that we did

[Chorus]
C              G
Sing it out loud, let the whole town hear
D                          G
Every broken promise, every wasted year
C              G
Sing it out loud till your voice gives in
D                          G
Then catch your breath and sing it all again

[Outro]
G                    C
So if you hear me singing from the porch at half past ten
D                         G
It's just me remembering the way things might have been
G                    C        D        G
Sing it out loud... sing it all again
LYRICS

post_song "Sing It Out Loud" "Johnny Walker" "$BIG_SONG" "Originals"

# --- Small song: short, simple ---
read -r -d '' SMALL_SONG << 'LYRICS' || true
[Verse]
Am       C
Midnight rain
G        D
Empty lane
Am       C
Your old coat
G        D
Left a note

[Chorus]
C    G
Gone again
D    Am
Who knows when
LYRICS

post_song "Midnight Rain" "Ava Stone" "$SMALL_SONG" "Covers"

# --- Medium songs to fill the library ---
read -r -d '' MED1 << 'LYRICS' || true
[Verse 1]
D              A
Pack up the van and hit the highway line
Bm             G
Leave this town before the morning time
D              A
Radio static, fading station signs
Bm             G
Nothing but the road and what we left behind

[Chorus]
G              D
Rolling on, rolling on
A              Bm
Till the wheels fall off or the gas is gone
G              D         A
Rolling on, rolling on
LYRICS

post_song "Rolling On" "The Highway Band" "$MED1" "Originals"

read -r -d '' MED2 << 'LYRICS' || true
[Verse 1]
Em            C
Kitchen light still on at three AM
G             D
Dishes in the sink from way back when
Em            C
Dog asleep beneath the table leg
G             D
World spins on but here we stay instead

[Verse 2]
Em            C
Photograph of us from '92
G             D
Faded colors but the smile shines through
Em            C
Kids are grown and gone to other towns
G             D
Still I hear their laughter all around

[Chorus]
C             G
This old house has seen it all
D             Em
Every stumble, every fall
C             G        D
And it's standing, standing still
LYRICS

post_song "This Old House" "Margaret Blue" "$MED2"

read -r -d '' MED3 << 'LYRICS' || true
[Verse 1]
A              E
Fireflies and FM radio
D              A
Summer nights that move so slow
A              E
Your bare feet on the dashboard glass
D              A
Wishing moments like this could last

[Chorus]
D              A
Hold on tight, hold on tight
E              A
To the feeling of a perfect night
D              A        E        A
Hold on tight, don't let go
LYRICS

post_song "Hold On Tight" "Sunset Drive" "$MED3" "Covers"

read -r -d '' MED4 << 'LYRICS' || true
[Verse]
C              G
Train whistle blowing through the valley fog
Am             F
Old man fishing from a hollow log
C              G
Smokestacks rising past the morning haze
Am             F
Another dollar for another day

[Chorus]
F              C
Working man's blues, working man's song
G              Am
Hands keep moving when the daylight's gone
F              C        G
Working man's blues all night long
LYRICS

post_song "Working Man's Blues" "Coal Creek" "$MED4" "Originals"

# A few more short ones to get a good count
post_song "Dusty Road" "The Drifters" \
"[Verse]\nEm  G\nDusty road ahead\nC   D\nNowhere left to go\n\n[Chorus]\nG  C\nKeep on walking\nD  Em\nKeep on walking home"

post_song "Last Call" "Barstool Prophets" \
"[Verse 1]\nA       D\nNeon sign says open\nE       A\nBut the crowd has gone\nA       D\nJukebox playing softly\nE       A\nOne more sad old song\n\n[Chorus]\nD       A\nLast call for the lonely\nE       A\nLast call for the night\nD       A    E    A\nLast call for the light"

post_song "Paper Moon" "Luna Grey" \
"[Verse]\nG       Em\nCut it from a magazine\nC       D\nHang it where the stars have been\nG       Em\nPaper moon above the bed\nC       D\nDreaming everything you said\n\n[Chorus]\nC       G\nNot real but close enough\nD       Em\nPaper moon and paper love"

post_song "Copper Line" "River Bend" \
"[Verse 1]\nBm       G\nDown along the copper line\nD        A\nWhere the water meets the vine\nBm       G\nOld man said the fish still bite\nD        A\nIf you get there before first light\n\n[Verse 2]\nBm       G\nBucket full of crawdad shells\nD        A\nStories only grandpa tells\nBm       G\nSunburn and a cane pole bend\nD        A\nDays like this don't ever end\n\n[Chorus]\nG        D\nCopper line, copper line\nA        Bm\nTake me back one more time\nG        D    A\nCopper line"

echo ""
echo "Done! Seeded 10 songs (1 big, 1 small, 8 medium). Visit $BASE/app/library to see them."
