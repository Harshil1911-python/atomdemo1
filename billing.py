"""ATOM POS — Billing / POS helpers"""


def format_currency(amount):
    try:
        return f"₹{float(amount):,.0f}"
    except (TypeError, ValueError):
        return "₹0"


def invoice_number(existing_count):
    """Simple sequential-style invoice number."""
    return 1233 + int(existing_count or 0) + 1
