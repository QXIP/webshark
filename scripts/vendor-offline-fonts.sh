#!/bin/sh
# Vendor Google fonts into web/ so WebShark works offline (#50).
set -eu

WEB_DIR="${1:-web}"
FONT_DIR="$WEB_DIR/fonts"
INDEX="$WEB_DIR/index.html"

mkdir -p "$FONT_DIR"

download() {
  dest="$1"
  url="$2"
  if [ ! -s "$dest" ]; then
    wget -q -O "$dest" "$url"
  fi
}

download "$FONT_DIR/roboto-latin-300.woff2" "https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmSU5fBBc4AMP6lQ.woff2"
download "$FONT_DIR/roboto-latin-400.woff2" "https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.woff2"
download "$FONT_DIR/roboto-latin-500.woff2" "https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmEU9fBBc4AMP6lQ.woff2"
download "$FONT_DIR/material-icons.woff2" "https://fonts.gstatic.com/s/materialicons/v140/flUhRq6tzZclQEJ-Vdg-IuiaDsNcIhQ8tQ.woff2"

if [ ! -f "$INDEX" ]; then
  echo "missing $INDEX" >&2
  exit 1
fi

# Drop CDN preconnect / googleapis stylesheet links.
sed -i \
  -e '/fonts\.gstatic\.com/d' \
  -e '/fonts\.googleapis\.com/d' \
  "$INDEX"

# If Angular inlined CDN @font-face blocks, replace the whole head font block with local faces.
python3 - "$INDEX" <<'PY'
import re, sys
path = sys.argv[1]
html = open(path, encoding='utf-8').read()
local = """<style type="text/css">
@font-face{font-family:'Roboto';font-style:normal;font-weight:300;font-display:swap;src:url(fonts/roboto-latin-300.woff2) format('woff2');}
@font-face{font-family:'Roboto';font-style:normal;font-weight:400;font-display:swap;src:url(fonts/roboto-latin-400.woff2) format('woff2');}
@font-face{font-family:'Roboto';font-style:normal;font-weight:500;font-display:swap;src:url(fonts/roboto-latin-500.woff2) format('woff2');}
@font-face{font-family:'Material Icons';font-style:normal;font-weight:400;font-display:block;src:url(fonts/material-icons.woff2) format('woff2');}
.material-icons{font-family:'Material Icons';font-weight:normal;font-style:normal;font-size:24px;line-height:1;letter-spacing:normal;text-transform:none;display:inline-block;white-space:nowrap;word-wrap:normal;direction:ltr;-webkit-font-feature-settings:'liga';-webkit-font-smoothing:antialiased;}
</style>
"""
pat = re.compile(
    r'<style type="text/css">@font-face\{font-family:\'Roboto\'.*?</style>\s*'
    r'<style type="text/css">@font-face\{font-family:\'Material Icons\'.*?</style>',
    re.DOTALL,
)
html2, n = pat.subn(local, html, count=1)
if n == 0 and "fonts/roboto-latin-400.woff2" not in html:
    # Insert before first existing <style> or before </head>
    html2 = re.sub(r'(</head>)', local + r'\1', html, count=1, flags=re.I)
open(path, 'w', encoding='utf-8').write(html2)
print('offline fonts ready in', path)
PY
