#!/usr/bin/env python3
"""
Scrape the public track listing of a Spotify playlist (no login, no Web API).

Usage:
    pip install playwright
    playwright install chromium
    python3 scrape_hitster_playlist.py

Output:
    hitster_poland_tracklist.csv and hitster_poland_tracklist.json,
    written to ~/Desktop if it exists, otherwise the current directory.

Notes:
    - This opens the public open.spotify.com playlist page anonymously and
      scrolls the virtualized track list until every row has loaded.
    - Spotify's web player markup changes over time. If extraction comes back
      empty or short, open --headed mode (HEADLESS=False below) and inspect
      the row structure with devtools, then adjust the selectors in
      `extract_row`.
"""

import csv
import json
import os
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

PLAYLIST_URL = "https://open.spotify.com/playlist/7j6R0NiyP7cIkg3AO6eF2D"
EXPECTED_TRACKS = 308
HEADLESS = True
MAX_IDLE_ROUNDS = 6          # consecutive scrolls with no new rows before giving up
SCROLL_PAUSE_SECONDS = 0.6
MAX_SCROLL_ROUNDS = 400

OUTPUT_BASENAME = "hitster_poland_tracklist"


def resolve_output_dir() -> Path:
    desktop = Path.home() / "Desktop"
    if desktop.is_dir():
        return desktop
    return Path.cwd()


def dismiss_cookie_banner(page):
    for selector in (
        "#onetrust-accept-btn-handler",
        "button:has-text('Accept cookies')",
        "button:has-text('Accept all')",
        "button:has-text('Zaakceptuj')",
    ):
        try:
            btn = page.locator(selector).first
            if btn.is_visible(timeout=1500):
                btn.click()
                page.wait_for_timeout(300)
                return
        except Exception:
            continue


def find_scroll_container(page):
    """Return a locator for the element that actually scrolls the track rows."""
    candidates = [
        "[data-testid='playlist-tracklist'] [role='grid']",
        "[data-testid='playlist-tracklist']",
        "main [role='grid']",
    ]
    for sel in candidates:
        loc = page.locator(sel).first
        if loc.count() > 0:
            scrollable = loc.evaluate(
                "el => { const t = el.closest('[data-overlayscrollbars-viewport], "
                "[style*=overflow]') || el; return t.scrollHeight > t.clientHeight + 50; }"
            )
            if scrollable:
                return sel
    return "[data-testid='playlist-tracklist']"


def count_rows(page):
    return page.locator("[data-testid='tracklist-row']").count()


def extract_row(row):
    """Pull index/title/artist/album out of a single tracklist-row element."""
    data = {"number": None, "title": None, "artist": None, "album": None}

    row_index = row.get_attribute("aria-rowindex")
    if row_index:
        try:
            data["number"] = int(row_index) - 1  # header row occupies index 1
        except ValueError:
            pass

    title_el = row.locator("[data-testid='internal-track-link'] div").first
    if title_el.count() == 0:
        title_el = row.locator("[data-testid='internal-track-link']").first
    if title_el.count() > 0:
        data["title"] = title_el.inner_text().strip()

    artist_links = row.locator("a[href^='/artist/']")
    if artist_links.count() > 0:
        names = [artist_links.nth(i).inner_text().strip() for i in range(artist_links.count())]
        data["artist"] = ", ".join(n for n in names if n)

    album_link = row.locator("a[href^='/album/']").first
    if album_link.count() > 0:
        data["album"] = album_link.inner_text().strip()

    return data


def scrape():
    tracks_by_number = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=HEADLESS)
        page = browser.new_page(viewport={"width": 1400, "height": 2200})
        page.goto(PLAYLIST_URL, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(2000)
        dismiss_cookie_banner(page)

        page.wait_for_selector("[data-testid='tracklist-row']", timeout=30000)

        scroll_sel = find_scroll_container(page)
        idle_rounds = 0
        last_count = 0

        for _ in range(MAX_SCROLL_ROUNDS):
            rows = page.locator("[data-testid='tracklist-row']")
            n = rows.count()
            for i in range(n):
                info = extract_row(rows.nth(i))
                if info["number"] is not None:
                    tracks_by_number[info["number"]] = info

            if len(tracks_by_number) >= EXPECTED_TRACKS:
                break

            if n == last_count:
                idle_rounds += 1
                if idle_rounds >= MAX_IDLE_ROUNDS:
                    break
            else:
                idle_rounds = 0
            last_count = n

            page.locator(scroll_sel).first.evaluate(
                "el => el.scrollBy(0, el.clientHeight * 0.9)"
            )
            page.mouse.wheel(0, 1200)
            page.wait_for_timeout(int(SCROLL_PAUSE_SECONDS * 1000))

        browser.close()

    ordered = [tracks_by_number[k] for k in sorted(tracks_by_number)]
    return ordered


def save(tracks):
    out_dir = resolve_output_dir()
    csv_path = out_dir / f"{OUTPUT_BASENAME}.csv"
    json_path = out_dir / f"{OUTPUT_BASENAME}.json"

    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["number", "title", "artist", "album"])
        writer.writeheader()
        writer.writerows(tracks)

    with json_path.open("w", encoding="utf-8") as f:
        json.dump(tracks, f, ensure_ascii=False, indent=2)

    return csv_path, json_path


if __name__ == "__main__":
    print(f"Opening {PLAYLIST_URL} ...")
    tracks = scrape()
    print(f"Collected {len(tracks)} / {EXPECTED_TRACKS} tracks.")
    if len(tracks) < EXPECTED_TRACKS:
        print("Warning: fewer tracks than expected — Spotify may have changed its "
              "markup, or the scroll loop stopped early. Try HEADLESS=False to debug.")

    csv_path, json_path = save(tracks)
    print(f"CSV:  {csv_path}")
    print(f"JSON: {json_path}")

    print("\nPreview (first 10 rows):")
    for t in tracks[:10]:
        print(f"{t['number']:>3}  {t['title']} — {t['artist']}  [{t['album']}]")
