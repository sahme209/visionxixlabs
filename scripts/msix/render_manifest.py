#!/usr/bin/env python3
"""Render the MSIX AppxManifest for the Microsoft Store build of V19.

Identity values come from Partner Center (the app's Product identity page). Until they exist the
placeholders below are used; such a package installs for testing but cannot be uploaded to the Store,
and the summary says so.

Usage: render_manifest.py <template> <out> <semver> [identity_name] [publisher] [publisher_display_name] [display_name]

The display name must match the name reserved in Partner Center.
"""
import re
import sys
from xml.sax.saxutils import escape

PLACEHOLDER = {
    "IDENTITY_NAME": "VisionXIXLabs.V19.Placeholder",
    "PUBLISHER": "CN=V19 Placeholder Publisher",
    "PUBLISHER_DISPLAY_NAME": "Vision XIX Labs",
    "DISPLAY_NAME": "V19",
}


def msix_version(semver: str) -> str:
    """MSIX needs four numeric parts; the Store requires the last one to be 0."""
    m = re.fullmatch(r"v?(\d+)\.(\d+)\.(\d+)", semver.strip())
    if not m:
        raise ValueError(f"not a release version: {semver!r}")
    parts = [int(x) for x in m.groups()]
    if any(p > 65535 for p in parts):
        raise ValueError("version parts must be at most 65535")
    return ".".join(str(p) for p in parts) + ".0"


def validate(identity_name: str, publisher: str, display: str, app_name: str = "V19") -> None:
    if not (1 <= len(app_name) <= 256) or re.search(r"[\r\n]", app_name):
        raise ValueError("display name must be one line of 1-256 characters")
    if not re.fullmatch(r"[A-Za-z0-9.-]{3,50}", identity_name):
        raise ValueError("identity name must be 3-50 letters, digits, dots or dashes")
    if not re.fullmatch(r"CN=[^\r\n<>\"&]{1,8000}", publisher):
        raise ValueError("publisher must start with CN= and have no markup characters")
    if not (1 <= len(display) <= 256) or re.search(r"[\r\n]", display):
        raise ValueError("publisher display name must be one line of 1-256 characters")


def render(template: str, semver: str, identity_name: str = "", publisher: str = "", display: str = "", app_name: str = "") -> tuple[str, bool]:
    values = {
        "IDENTITY_NAME": identity_name or PLACEHOLDER["IDENTITY_NAME"],
        "PUBLISHER": publisher or PLACEHOLDER["PUBLISHER"],
        "PUBLISHER_DISPLAY_NAME": display or PLACEHOLDER["PUBLISHER_DISPLAY_NAME"],
        "DISPLAY_NAME": app_name or PLACEHOLDER["DISPLAY_NAME"],
    }
    validate(values["IDENTITY_NAME"], values["PUBLISHER"], values["PUBLISHER_DISPLAY_NAME"], values["DISPLAY_NAME"])
    values["VERSION"] = msix_version(semver)
    out = template
    for key, value in values.items():
        out = out.replace("{{" + key + "}}", escape(value, {'"': "&quot;"}))
    if "{{" in out:
        raise ValueError("unfilled placeholder in template")
    placeholder = not (identity_name and publisher)
    return out, placeholder


def main(argv: list[str]) -> int:
    if len(argv) < 4:
        print(__doc__, file=sys.stderr)
        return 2
    template_path, out_path, semver = argv[1:4]
    extra = (argv[4:] + ["", "", "", ""])[:4]
    with open(template_path, encoding="utf-8") as f:
        text, placeholder = render(f.read(), semver, *extra)
    with open(out_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    print("placeholder_identity=" + ("true" if placeholder else "false"))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
