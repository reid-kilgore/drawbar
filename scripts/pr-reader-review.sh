#!/bin/bash
# Reader review of the ship PR text (drawbar-ship section 4). Run before the opening fence.
# Reads title and body written by the agent under $PWD/.drawbar/tmp/ship, substitutes nothing into itself.
# Exit 0 and READER_PASS + PR_TITLE_LITERAL when reader-review stamps the exact text; exit 1 and READER_FAIL otherwise.
IN_DIR="$PWD/.drawbar/tmp/ship"
PWD_REAL=$(readlink -f "$PWD") || { echo "FATAL: cannot resolve the working directory — refusing."; exit 1; }
IN_REAL=$(readlink -f "$IN_DIR") || { echo "FATAL: $IN_DIR does not resolve — write the title and body first; refusing."; exit 1; }
[ "$IN_REAL" = "$PWD_REAL/.drawbar/tmp/ship" ] && [ -d "$IN_REAL" ] || { echo "FATAL: $IN_DIR is not a plain directory under the working directory — refusing."; exit 1; }
PR_TITLE_FILE="${IN_DIR}/title"
PR_BODY_FILE="${IN_DIR}/body"
PR_TEXT_FILE="${IN_DIR}/pr-text"
for f in "$PR_TITLE_FILE" "$PR_BODY_FILE"; do
  [ -f "$f" ] && [ -s "$f" ] && [ ! -L "$f" ] || { echo "FATAL: $f is missing, empty, not a regular file or a symlink — write title and body with the Write tool first; refusing."; exit 1; }
done
[ ! -L "$PR_TEXT_FILE" ] || { echo "FATAL: $PR_TEXT_FILE is a symlink — refusing."; exit 1; }
command -v reader-review >/dev/null 2>&1 || { echo "READER_FAIL: reader-review is not on PATH — park the story (Outcome A); there is no bypass."; exit 1; }
# The title is typed into the opening command as a literal, so its shape is gated HERE: a character
# outside this set could close the quotes it is typed between. It also keeps the title to 100 characters.
TITLE=$(cat "$PR_TITLE_FILE")
TITLE_RE='^[A-Za-z0-9][A-Za-z0-9 .,:()/+-]{0,99}$'
( LC_ALL=C; [[ "$TITLE" =~ $TITLE_RE ]] ) || { echo "READER_FAIL: the title has a character outside letters, digits, spaces and . , : ( ) / + - , or is longer than 100 characters, or has more than one line — rewrite it."; exit 1; }
grep -q '^Review provenance: reviewed at ' "$PR_BODY_FILE" || { echo "READER_FAIL: the body has no 'Review provenance: reviewed at ...' line in its evidence block — add it."; exit 1; }
trap ': > "$PR_TEXT_FILE"' EXIT
{ printf '%s\n\n' "$TITLE"; cat "$PR_BODY_FILE"; } > "$PR_TEXT_FILE"
reader-review "$PR_TEXT_FILE" --kind pr
RC=$?
if [ "$RC" -eq 0 ]; then
  echo "READER_PASS: the title and body are stamped. Type this title, exactly, as the --title literal of both gh commands in the opening fence of section 4:"
  echo "PR_TITLE_LITERAL: $TITLE"
else
  echo "READER_FAIL: reader-review exited $RC — the findings are above. Fix by rule and run this script once more; a second failure parks the story (Outcome A)."
  exit 1
fi
