#!/usr/bin/env python3
"""
Enrich data.json with 'about' text from the CSV's ABOUT HER column.
Cleans up quote artifacts from CSV encoding.
"""

import csv
import json
import re
import unicodedata


def clean_about(text):
    """Clean up ABOUT HER text: fix doubled quotes, strip leading/trailing junk."""
    if not text or not text.strip():
        return ""

    s = text.strip()

    # Python's csv module already handles one layer of CSV quote escaping.
    # What remains: the source data sometimes has extra doubled quotes ("").
    # Some entries have multiple layers of quoting, so we loop until stable.
    while '""' in s:
        s = s.replace('""', '"')

    # After collapsing doubled quotes, strip wrapper quotes if the entire
    # string is enclosed in them (artifact of how the data was entered).
    if s.startswith('"') and s.endswith('"'):
        inner = s[1:-1]
        if not inner.startswith('"'):
            s = inner

    # Clean up whitespace: collapse multiple spaces/newlines
    s = re.sub(r'\s*\n\s*', ' ', s)
    s = re.sub(r' {2,}', ' ', s)

    # Normalize unicode quotes to ASCII where sensible
    s = s.replace('\u201c', '"').replace('\u201d', '"')
    s = s.replace('\u2018', "'").replace('\u2019', "'")
    s = s.replace('\u2014', '—').replace('\u2013', '–')

    return s.strip()


def normalize_name(name):
    """Normalize a name for matching: strip quotes, extra spaces, lowercase."""
    n = name.strip()
    # Remove quotes around nicknames: "Bubbas" -> Bubbas
    n = n.replace('"', '').replace('"', '').replace('"', '')
    # Collapse spaces
    n = re.sub(r'\s+', ' ', n)
    return n


def main():
    csv_path = '2024 WOMEN & GIRLS ALLEGEDLY KILLED BY MEN & BOYS - Working Data.csv'
    json_path = 'data.json'
    output_path = 'data.json'

    # 1. Load CSV into a lookup: normalized_name -> about text
    csv_lookup = {}
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            raw_name = row.get('HER NAME', '').strip()
            about = row.get('ABOUT HER', '').strip()
            if raw_name:
                norm = normalize_name(raw_name)
                cleaned = clean_about(about)
                # Only store if there's actual content
                if cleaned:
                    csv_lookup[norm] = cleaned

    print(f"CSV entries with ABOUT HER text: {len(csv_lookup)}")

    # 2. Load existing data.json
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 3. Enrich: for each day, add 'about' array parallel to 'names'
    matched = 0
    total_names = 0
    for day in data:
        names = day.get('names', [])
        abouts = []
        for name in names:
            total_names += 1
            norm = normalize_name(name)
            about = csv_lookup.get(norm, '')
            if about:
                matched += 1
            abouts.append(about)
        day['about'] = abouts

    print(f"Total names in data.json: {total_names}")
    print(f"Matched with ABOUT HER: {matched}")
    print(f"Without ABOUT HER: {total_names - matched}")

    # 4. Write enriched data.json
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"\nWrote enriched data to {output_path}")

    # 5. Spot check a few entries
    print("\n--- Spot checks ---")
    checks = ["Aaliyah Renee Williams", "Aanya Vinay", "Alizey Fatima", "Allisa Marie Vollan"]
    for day in data:
        for i, name in enumerate(day.get('names', [])):
            if name in checks:
                about = day['about'][i]
                preview = about[:150] + '...' if len(about) > 150 else about
                print(f"\n{name}:")
                print(f"  {preview}")


if __name__ == '__main__':
    main()
