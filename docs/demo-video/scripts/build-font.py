#!/usr/bin/env python3
"""
Build the self-hosted webfonts used by the video.

Why this exists: web-served fonts cost one request per unicode-range chunk,
and Google splits Noto Sans SC into ~98 of them per weight. Any single dropped
request fails the frame being rendered — on a flaky connection that lost
roughly a third of our renders. Self-hosting removes the network entirely.

Two outputs, both committed, so a normal `npm run render` never needs this:

  public/fonts/kaleido-han.woff2   subsetted from a local Noto Sans CJK SC
  public/fonts/inter-latin.woff2   fetched once from Google (Inter, SIL OFL)

Re-run after changing any copy in src/kaleido/script.ts:

    npm run font

Requires: fontTools + brotli (`pip install 'fonttools[woff]'`) and a locally
installed Noto Sans CJK. If a glyph is ever missing, the CSS stack in
fonts.ts falls back to the system CJK face rather than rendering tofu.
"""

from __future__ import annotations

import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCRIPT_TS = ROOT / "src" / "kaleido" / "script.ts"
OUT_FILE = ROOT / "public" / "fonts" / "kaleido-han.woff2"

# Inter, variable weight, Latin subset. Fetched once and committed; there is
# no local source to subset from, unlike the CJK face.
LATIN_OUT = ROOT / "public" / "fonts" / "inter-latin.woff2"
LATIN_URL = (
    "https://fonts.gstatic.com/s/inter/v20/"
    "UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2"
)

# Face index 2 of the collection is "Noto Sans CJK SC Light".
SOURCE_CANDIDATES = [
    ("/usr/share/fonts/opentype/noto/NotoSansCJK-Light.ttc", 2),
    ("/usr/share/fonts/opentype/noto/NotoSansCJK.ttc", 2),
    ("/System/Library/Fonts/PingFang.ttc", 0),
]

# Always include these so punctuation and digits survive a copy change.
ALWAYS = set(
    "0123456789"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "abcdefghijklmnopqrstuvwxyz"
    " .,:;!?·—–-…、。，：；！？（）「」『』《》“”‘’%¥→←↑↓"
)


def find_source() -> tuple[str, int]:
    for path, index in SOURCE_CANDIDATES:
        if pathlib.Path(path).is_file():
            return path, index
    sys.exit(
        "error: no Noto Sans CJK / PingFang source font found.\n"
        "       install fonts-noto-cjk, or add your path to SOURCE_CANDIDATES."
    )


def collect_glyphs() -> str:
    """
    Every non-ASCII character in the edit list, plus the ASCII baseline.

    Scanning the whole file rather than parsing out the copy fields is
    deliberate: it also picks up characters used in comments, costs a few
    kilobytes, and cannot silently miss a string the parser didn't understand.
    """
    source = SCRIPT_TS.read_text(encoding="utf-8")
    wanted = {ch for ch in source if ch >= " "} | ALWAYS
    return "".join(sorted(wanted))


def fetch_latin() -> None:
    """Download Inter once. Already-present files are left alone."""
    if LATIN_OUT.is_file():
        print(f"  · {LATIN_OUT.relative_to(ROOT)} already present, skipping")
        return

    LATIN_OUT.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["curl", "-sS", "--retry", "6", "--retry-all-errors", "--retry-delay", "2",
         "-A", "Mozilla/5.0", LATIN_URL, "-o", str(LATIN_OUT)],
        check=True,
    )
    print(f"  ✓ {LATIN_OUT.relative_to(ROOT)}  {LATIN_OUT.stat().st_size / 1024:.1f} KB")


def main() -> None:
    fetch_latin()
    font_path, font_number = find_source()
    glyphs = collect_glyphs()
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    text_file = OUT_FILE.parent / ".subset-glyphs.txt"
    text_file.write_text(glyphs, encoding="utf-8")

    try:
        subprocess.run(
            [
                sys.executable,
                "-m",
                "fontTools.subset",
                font_path,
                f"--font-number={font_number}",
                f"--text-file={text_file}",
                "--flavor=woff2",
                f"--output-file={OUT_FILE}",
                "--layout-features=*",
                "--name-IDs=*",
            ],
            check=True,
        )
    finally:
        text_file.unlink(missing_ok=True)

    size_kb = OUT_FILE.stat().st_size / 1024
    print(f"\n  ✓ {OUT_FILE.relative_to(ROOT)}  {len(glyphs)} glyphs, {size_kb:.1f} KB")
    print(f"    source: {font_path} (face {font_number})")


if __name__ == "__main__":
    main()
