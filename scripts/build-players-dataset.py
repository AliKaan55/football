#!/usr/bin/env python3
"""
Builds data/players-dataset.json (used by server.ts for local, offline
footballer verification) from a transfermarkt-datasets .duckdb file.

Source project: https://github.com/dcaribou/transfermarkt-datasets

Usage:
    pip install duckdb
    python scripts/build-players-dataset.py /path/to/transfermarkt-datasets.duckdb

Output:
    data/players-dataset.json  — one entry per player:
        { "i": player_id, "n": "Full Name", "v": market_value_in_eur, "c": [clubs...] }
    "c" (career clubs) is built from TWO sources, combined for best coverage:
      1. appearances table  — clubs the player actually appeared in a match for
         (most reliable, but this dataset's appearances only start ~mid-2012).
      2. transfers table    — from/to club names of every recorded transfer
         (fills in additional spells, e.g. loans, not caught by (1)).
    current_club_name is appended as a final safety net if still missing.

    NOTE: because of the ~2012 appearances cutoff and incomplete transfer
    history for some players, a handful of veteran players' pre-2012 clubs
    may be missing. This is a limitation of the underlying open dataset, not
    of this script.
"""
import sys
import os
import json

import duckdb

PLACEHOLDER_CLUBS = {"without club", "retired", "unknown", "career break"}


def main():
    if len(sys.argv) != 2:
        print(f"Usage: python {sys.argv[0]} /path/to/transfermarkt-datasets.duckdb")
        sys.exit(1)

    duckdb_path = sys.argv[1]
    if not os.path.isfile(duckdb_path):
        print(f"File not found: {duckdb_path}")
        sys.exit(1)

    con = duckdb.connect(duckdb_path, read_only=True)

    print("Reading clubs...")
    club_name_by_id = {
        str(cid): name for cid, name in con.execute("SELECT club_id, name FROM clubs").fetchall()
    }

    print("Reading appearances (actual matches played per club)...")
    app_rows = con.execute("""
        SELECT player_id, player_club_id, MIN(date) as first_date
        FROM appearances
        WHERE player_club_id IS NOT NULL
        GROUP BY player_id, player_club_id
        ORDER BY player_id, first_date
    """).fetchall()

    player_clubs_from_appearances = {}
    for pid, club_id, _first_date in app_rows:
        name = club_name_by_id.get(str(club_id))
        if not name:
            continue
        lst = player_clubs_from_appearances.setdefault(pid, [])
        if name not in lst:
            lst.append(name)

    print("Reading transfers (chronological from/to club history)...")
    trows = con.execute("""
        SELECT player_id, transfer_date, from_club_name, to_club_name
        FROM transfers
        ORDER BY player_id, transfer_date
    """).fetchall()

    player_clubs_from_transfers = {}
    for pid, _tdate, fname, tname in trows:
        lst = player_clubs_from_transfers.setdefault(pid, [])
        for name in (fname, tname):
            if not name or name.strip().lower() in PLACEHOLDER_CLUBS:
                continue
            if not lst or lst[-1] != name:
                lst.append(name)

    for pid, lst in player_clubs_from_transfers.items():
        seen = []
        for n in lst:
            if n not in seen:
                seen.append(n)
        player_clubs_from_transfers[pid] = seen

    print("Reading players...")
    prows = con.execute("""
        SELECT player_id, name, first_name, last_name,
               COALESCE(highest_market_value_in_eur, market_value_in_eur, 0) as val,
               current_club_name
        FROM players
    """).fetchall()

    out = []
    for pid, name, first, last, val, current_club in prows:
        if not name:
            name = f"{first or ''} {last or ''}".strip()
        if not name:
            continue

        clubs = []
        for c in player_clubs_from_appearances.get(pid, []):
            if c not in clubs:
                clubs.append(c)
        for c in player_clubs_from_transfers.get(pid, []):
            if c not in clubs:
                clubs.append(c)
        if current_club and current_club.strip().lower() not in PLACEHOLDER_CLUBS and current_club not in clubs:
            clubs.append(current_club)

        entry = {"i": pid, "n": name, "v": int(val or 0)}
        if clubs:
            entry["c"] = clubs
        out.append(entry)

    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "players-dataset.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    size_mb = os.path.getsize(out_path) / 1e6
    with_clubs = sum(1 for e in out if e.get("c"))
    print(f"Wrote {out_path}")
    print(f"  {len(out)} players total, {with_clubs} with club history, {size_mb:.2f} MB")


if __name__ == "__main__":
    main()
