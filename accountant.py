"""ATOM POS — Accountant panel helpers (paused / coming soon)"""

from datetime import datetime


def format_currency(amount):
    try:
        return f"₹{float(amount):,.0f}"
    except (TypeError, ValueError):
        return "₹0"


def is_available():
    """Accountant mode is paused for now."""
    return False


def status_message():
    return {
        "available": False,
        "title": "Accountant",
        "message": "Accountant mode is paused. This panel will include reports, GST summaries, and ledger exports in a future update.",
        "updated": datetime.utcnow().isoformat() + "Z",
    }


def build_report_stub(transactions=None):
    """Placeholder for future accounting reports."""
    return {
        "status": "paused",
        "transactions_seen": len(transactions or []),
        "note": "Full accountant reports are not enabled yet.",
    }
