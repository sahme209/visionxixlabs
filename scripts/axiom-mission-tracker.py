#!/usr/bin/env python3
"""Check source coverage and render the persistent Axiom requirement register.

Assessments live in JSON and must be reviewed by a human/agent, never inferred
from test counts. --check catches lost source units, stale text and bad links.
"""
import argparse
import collections
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
REGISTER = ROOT / "docs/mission/requirements.json"
OUTPUT = ROOT / "docs/AXIOM_MISSION_REQUIREMENTS.md"
STATES = {"Implemented and verified", "Implemented but not validated", "Partially implemented", "Missing", "Blocked by external access"}


def extract(path):
    """One entry per list item, prose paragraph, or substantive table row."""
    lines = (ROOT / path).read_text().splitlines()
    units, paragraph = [], []
    section = "Introduction"
    heading = section
    fenced = False

    def flush():
        if paragraph:
            units.append({"line": paragraph[0][0], "text": " ".join(t for _, t in paragraph), "section": section})
            paragraph.clear()

    for number, raw in enumerate(lines, 1):
        text = raw.strip()
        if text.startswith("```"):
            flush()
            fenced = not fenced
            continue
        if fenced:
            continue
        if text.startswith("#"):
            flush()
            section = text.lstrip("# ")
            heading = section
        elif re.fullmatch(r"\*\*[^*]+\*\*", text):
            flush()
            section = heading + " / " + text.strip("*")
            paragraph.append((number, text))
        elif not text or re.fullmatch(r"[-*_]{3,}", text):
            flush()
        elif text.startswith("|"):
            flush()
            if not re.fullmatch(r"[|\s:-]+", text):
                units.append({"line": number, "text": text, "section": section})
        elif re.match(r"(?:[-*] |\d+\. )", text):
            flush()
            paragraph.append((number, text))
        else:
            paragraph.append((number, text))
    flush()
    return units


def render(data):
    counts = collections.Counter(row["status"] for row in data["requirements"])
    out = ["# Axiom complete mission requirement register", "",
           "Generated from [editable assessments](mission/requirements.json). "
           "Read [the audit and priorities](AXIOM_COMPLETE_MISSION_TRACKER.md) first.", "",
           "This is a source-coverage register, not proof that every row has passed acceptance. "
           "Evidence scope and next actions are explicit; related files do not prove the full requirement. "
           "The absent original 36-section source prevents an exhaustive original-specification claim.", "",
           "| State | Rows |", "| --- | ---: |"]
    out += [f"| {state} | {counts[state]} |" for state in sorted(STATES)]
    out += ["", "Process, historical proposals, source gaps and product acceptance rows are distinct in JSON. "
            "Do not interpret this distribution as a product completion percentage.", ""]
    out += ["## Active product workstreams", "", "Dependencies below gate customer acceptance, not independent engineering. All streams remain active; major visual redesign is deferred.", "", "| Workstream | Engineering / customer acceptance | Verified evidence scope | Acceptance dependencies / blockers | Next action |", "| --- | --- | --- | --- | --- |"]
    for stream in data.get("workstreams", []):
        evidence = "; ".join(f"[{p}](../{p})" for p in stream["evidence"])
        cells = [stream["name"], stream["engineeringActivity"] + " / " + stream["customerAcceptance"], stream["verification"] + " " + evidence, ", ".join(stream["acceptanceDependencies"]) + ": " + stream["blockers"], stream["nextAction"]]
        out.append("| " + " | ".join(str(cell).replace("|", "\\|").replace("\n", " ") for cell in cells) + " |")
    out.append("")
    for source in data["sources"] + [{"path": "Unavailable original source"}]:
        rows = [r for r in data["requirements"] if r["source"] == source["path"]]
        out += [f"## {source['path']}", "", "| ID / scope | Requirement | Status / evidence scope | Evidence | Next engineering action |", "| --- | --- | --- | --- | --- |"]
        for row in rows:
            esc = lambda text: str(text).replace("|", "\\|").replace("\n", " ")
            evidence = "; ".join(f"[{p}](../{p})" for p in row["evidence"])
            if row.get("prs"):
                evidence += "; " + " ".join(f"[#{p}](https://github.com/sahme209/visionxixlabs/pull/{p})" for p in row["prs"])
            if source["path"] != "Unavailable original source":
                evidence = f"[source](../{source['path']}#L{row['line']}); " + evidence
            out.append("| " + " | ".join(map(esc, [row["id"] + " / " + row["scope"], row["requirement"], row["status"] + ": " + row["verification"], evidence or "No implementation evidence", row["nextAction"]])) + " |")
        out.append("")
    return "\n".join(out).rstrip() + "\n"


def validate(data):
    errors, ids = [], set()
    for row in data["requirements"]:
        if row["id"] in ids:
            errors.append("Duplicate ID " + row["id"])
        ids.add(row["id"])
        if row["status"] not in STATES:
            errors.append("Invalid state " + row["id"])
        if not row["nextAction"] or not row["verification"]:
            errors.append("Missing assessment " + row["id"])
        for evidence in row["evidence"]:
            if not (ROOT / evidence).exists():
                errors.append("Missing evidence " + evidence)
    for source in data["sources"]:
        expected = {(u["line"], u["text"]) for u in extract(source["path"])}
        actual = {(r["line"], r["requirement"]) for r in data["requirements"] if r["source"] == source["path"]}
        if expected != actual:
            errors.append(f"Source coverage mismatch: {source['path']} ({len(expected - actual)} missing/stale units)")
    streams = data.get("workstreams", [])
    stream_ids = {stream["id"] for stream in streams}
    required = {"auth_database", "ai_agent", "github", "cloud", "terraform", "airflow", "deployment", "governance", "desktop", "billing", "website", "testing", "security", "launch", "vercel_cost"}
    if stream_ids != required or len(streams) != len(required):
        errors.append("Missing, duplicate or unexpected active workstream")
    for stream in streams:
        if stream["status"] not in STATES or not stream["nextAction"] or not stream["verification"]:
            errors.append("Invalid workstream assessment " + stream["id"])
        if not set(stream["acceptanceDependencies"]) <= stream_ids:
            errors.append("Unknown workstream dependency " + stream["id"])
        for evidence in stream["evidence"]:
            if not (ROOT / evidence).exists():
                errors.append("Missing workstream evidence " + evidence)
    for number in range(1, 37):
        if f"SOURCE-SECTION-{number:02}" not in ids:
            errors.append("Missing original-section placeholder")
    for letter in "ABCDEFGHIJKL":
        if f"SOURCE-SCENARIO-{letter}" not in ids:
            errors.append("Missing original-scenario placeholder")
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    data = json.loads(REGISTER.read_text())
    errors = validate(data)
    expected = render(data)
    if args.check and (not OUTPUT.exists() or OUTPUT.read_text() != expected):
        errors.append("Rendered requirement table is stale; run this script without --check")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    if not args.check:
        OUTPUT.write_text(expected)
    print(json.dumps({"sources": len(data["sources"]), "rows": len(data["requirements"]), "states": dict(collections.Counter(r["status"] for r in data["requirements"])), "coverage": "all available source units; original specification absent"}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
