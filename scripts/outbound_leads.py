"""
Semi-automated outbound system skeleton.

This script is intentionally conservative:
- Focuses on quality over quantity
- Expects leads to come from compliant, manual / approved sources
- Adds rate limiting and logging hooks
- Designed for REVIEW_BEFORE_SEND by default

You can adapt this into a real tool by:
- Wiring up a real email API in `send_email_via_api`
- Replacing the `generate_personalization` stub with real logic (or AI-assisted calls)
"""

from __future__ import annotations

import csv
import dataclasses
import datetime as dt
import random
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional, Tuple


# === Configuration ============================================================

BASE_DIR = Path(__file__).resolve().parents[1]

# Input and output CSVs
LEADS_CSV = BASE_DIR / "outbound_leads.csv"
LOG_CSV = BASE_DIR / "outbound_log.csv"
DRAFTS_CSV = BASE_DIR / "outbound_drafts.csv"

# Daily limits and behaviour
MAX_EMAILS_PER_DAY = 5  # keep small to protect reputation
REVIEW_BEFORE_SEND = True  # set to False only if you explicitly want auto-send

# Random delay between sends (in seconds), if auto-send is enabled
DELAY_MIN = 15 * 60  # 15 minutes
DELAY_MAX = 60 * 60  # 60 minutes

GENERIC_EMAIL_PREFIXES = {"info", "support", "hello", "contact", "sales", "admin"}


# === Data model ==============================================================

@dataclass
class Lead:
    company: str
    website: str
    contact_name: str
    role: str
    email: str
    cloud_provider: str
    main_angle: str  # security | devops | cost | ai
    source: str


@dataclass
class EmailDraft:
    company: str
    contact_name: str
    email: str
    subject: str
    body: str
    created_at: str
    status: str  # draft | sent


# === Utilities ===============================================================

def is_generic_email(address: str) -> bool:
    """Return True if the email looks generic (info@, support@, etc.)."""
    try:
        local, _ = address.split("@", 1)
    except ValueError:
        return True
    return local.lower() in GENERIC_EMAIL_PREFIXES


def load_leads(path: Path) -> List[Lead]:
    """Load leads from CSV. Expected header: company,website,contact_name,role,email,cloud_provider,main_angle,source."""
    leads: List[Lead] = []
    if not path.exists():
        return leads

    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Basic validation; skip incomplete rows
            if not row.get("email") or not row.get("company"):
                continue
            leads.append(
                Lead(
                    company=row.get("company", "").strip(),
                    website=row.get("website", "").strip(),
                    contact_name=row.get("contact_name", "").strip(),
                    role=row.get("role", "").strip(),
                    email=row.get("email", "").strip(),
                    cloud_provider=row.get("cloud_provider", "").strip(),
                    main_angle=row.get("main_angle", "").strip().lower(),
                    source=row.get("source", "").strip(),
                )
            )
    return leads


def today_iso() -> str:
    return dt.date.today().isoformat()


def load_sent_domains_for_today(log_path: Path) -> set[str]:
    """Return set of domains already emailed today, to avoid duplicates."""
    domains: set[str] = set()
    if not log_path.exists():
        return domains

    with log_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("date_sent") != today_iso():
                continue
            email = row.get("email", "")
            if "@" in email:
                domains.add(email.split("@", 1)[1].lower())
    return domains


def ensure_csv_with_header(path: Path, fieldnames: Iterable[str]) -> None:
    """Create CSV with header if it does not exist."""
    if path.exists():
        return
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()


# === Personalization & Email Generation ======================================

def generate_personalization(lead: Lead) -> Tuple[str, str]:
    """
    Stub for personalization.
    Returns (observation, angle_phrase).

    In a real implementation you might:
    - Inspect the website / blog / LinkedIn manually and paste in notes
    - Or call an LLM with cached company context
    """
    # Minimal, safe placeholder based on main_angle only.
    angle = lead.main_angle or "cloud"
    if angle == "security":
        angle_phrase = "cloud security baseline and IAM / logging improvements"
    elif angle == "devops":
        angle_phrase = "stabilising deployments and moving away from risky console changes"
    elif angle == "cost":
        angle_phrase = "making cloud spend more predictable with better visibility and lifecycle policies"
    elif angle == "ai":
        angle_phrase = "deploying AI features with clearer access control, logging, and cost controls"
    else:
        angle_phrase = "practical improvements across security, deployments, and cost"

    observation = (
        f"I’m reaching out because you’re building a SaaS product on {lead.cloud_provider or 'public cloud'}, "
        "where security, deployments, and cost can start to get tricky as the team grows."
    )

    return observation, angle_phrase


def generate_subject(lead: Lead, angle_phrase: str) -> str:
    base = f"Cloud {lead.main_angle or 'infrastructure'} for {lead.company}".strip()
    return base[:80]


def generate_email_body(lead: Lead, observation: str, angle_phrase: str) -> str:
    first_name = (lead.contact_name.split()[0] if lead.contact_name else "").strip() or "there"

    lines = [
        f"Hi {first_name},",
        "",
        observation,
        "",
        "I help small engineering teams on AWS/Azure/GCP with very practical work on "
        f"{angle_phrase} – usually through short, fixed-scope sprints.",
        "",
        "If a 20–30 minute cloud / security review would be useful, I’m happy to walk through how "
        "we’d structure that for your team and leave you with concrete next steps.",
        "",
        "If this isn’t relevant, feel free to ignore or let me know.",
        "",
        "Best,",
        "{{your_name}}",
        "{{your_role}}",
        "{{your_website}}",
    ]
    body = "\n".join(lines)
    # Keep under 150 words as a soft guideline
    return body


# === Sending & Logging =======================================================

def append_draft(draft: EmailDraft) -> None:
    fieldnames = ["company", "contact_name", "email", "subject", "body", "created_at", "status"]
    ensure_csv_with_header(DRAFTS_CSV, fieldnames)
    with DRAFTS_CSV.open("a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writerow(dataclasses.asdict(draft))


def append_log(lead: Lead, subject: str, status: str) -> None:
    fieldnames = [
        "date_sent",
        "company",
        "website",
        "contact_name",
        "role",
        "email",
        "cloud_provider",
        "main_angle",
        "subject",
        "status",
    ]
    ensure_csv_with_header(LOG_CSV, fieldnames)
    with LOG_CSV.open("a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writerow(
            {
                "date_sent": today_iso(),
                "company": lead.company,
                "website": lead.website,
                "contact_name": lead.contact_name,
                "role": lead.role,
                "email": lead.email,
                "cloud_provider": lead.cloud_provider,
                "main_angle": lead.main_angle,
                "subject": subject,
                "status": status,
            }
        )


def send_email_via_api(to_email: str, subject: str, body: str) -> bool:
    """
    Placeholder for real email sending.

    Implement this using your provider of choice (Resend, SES, SendGrid, etc.)
    with proper rate limiting and error handling.
    Return True if sent successfully, False otherwise.
    """
    # TODO: wire up actual email API here.
    print(f"[DRY-RUN] Would send email to {to_email} with subject: {subject!r}")
    return True


def process_leads(leads: List[Lead]) -> None:
    sent_domains_today = load_sent_domains_for_today(LOG_CSV)
    sent_count = 0

    for lead in leads:
        if sent_count >= MAX_EMAILS_PER_DAY:
            break

        if not lead.email or "@" not in lead.email:
            continue

        if is_generic_email(lead.email):
            continue

        domain = lead.email.split("@", 1)[1].lower()
        if domain in sent_domains_today:
            # Already contacted this company today
            continue

        observation, angle_phrase = generate_personalization(lead)
        subject = generate_subject(lead, angle_phrase)
        body = generate_email_body(lead, observation, angle_phrase)

        now_iso = dt.datetime.utcnow().isoformat()
        draft = EmailDraft(
            company=lead.company,
            contact_name=lead.contact_name,
            email=lead.email,
            subject=subject,
            body=body,
            created_at=now_iso,
            status="draft" if REVIEW_BEFORE_SEND else "sent",
        )

        if REVIEW_BEFORE_SEND:
            append_draft(draft)
            append_log(lead, subject, status="draft")
        else:
            ok = send_email_via_api(lead.email, subject, body)
            append_log(lead, subject, status="sent" if ok else "failed")
            # Respect delay between sends
            delay = random.randint(DELAY_MIN, DELAY_MAX)
            time.sleep(delay)

        sent_domains_today.add(domain)
        sent_count += 1


def main() -> None:
    leads = load_leads(LEADS_CSV)
    if not leads:
        print(f"No leads found in {LEADS_CSV}.")
        return

    print(f"Loaded {len(leads)} leads from {LEADS_CSV}.")
    print(
        f"Processing up to {MAX_EMAILS_PER_DAY} leads "
        f"({'draft-only' if REVIEW_BEFORE_SEND else 'auto-send'}) for {today_iso()}."
    )
    process_leads(leads)
    print("Done.")


if __name__ == "__main__":
    main()

