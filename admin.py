"""ATOM POS — Admin panel helpers"""

from datetime import datetime, timedelta


def format_currency(amount):
    try:
        return f"₹{float(amount):,.0f}"
    except (TypeError, ValueError):
        return "₹0"


def product_summary(products):
    """Basic catalog stats for the admin dashboard."""
    products = products or []
    total = len(products)
    out_of_stock = sum(1 for p in products if (p.get("stock") or 0) <= 0)
    low_stock = sum(1 for p in products if 0 < (p.get("stock") or 0) <= 5)
    with_photo = sum(1 for p in products if p.get("photo"))
    inv_value = sum((p.get("price") or 0) * max(0, p.get("stock") or 0) for p in products)
    return {
        "total_products": total,
        "out_of_stock": out_of_stock,
        "low_stock": low_stock,
        "with_photo": with_photo,
        "inventory_value": inv_value,
        "inventory_value_fmt": format_currency(inv_value),
    }


def sales_summary(transactions, days=30):
    """Aggregate sales from recent transactions."""
    transactions = transactions or []
    cutoff = datetime.utcnow() - timedelta(days=days)
    recent = []
    for t in transactions:
        try:
            d = datetime.fromisoformat((t.get("date") or "").replace("Z", ""))
        except ValueError:
            continue
        if d >= cutoff:
            recent.append(t)
    paid = [t for t in recent if t.get("status") == "paid"]
    unpaid = [t for t in recent if t.get("status") == "unpaid"]
    total_paid = sum(t.get("amount") or 0 for t in paid)
    total_unpaid = sum(t.get("amount") or 0 for t in unpaid)
    return {
        "period_days": days,
        "sales_count": len(paid),
        "unpaid_count": len(unpaid),
        "total_paid": total_paid,
        "total_unpaid": total_unpaid,
        "total_paid_fmt": format_currency(total_paid),
        "total_unpaid_fmt": format_currency(total_unpaid),
    }


def validate_product(name, price, stock=0):
    """Validate product fields before save."""
    errors = []
    if not (name or "").strip():
        errors.append("Name is required")
    try:
        p = float(price)
        if p < 0:
            errors.append("Price cannot be negative")
    except (TypeError, ValueError):
        errors.append("Price must be a number")
    try:
        s = int(stock)
        if s < 0:
            errors.append("Stock cannot be negative")
    except (TypeError, ValueError):
        errors.append("Stock must be a whole number")
    return errors
