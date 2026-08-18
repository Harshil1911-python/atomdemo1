from flask import Flask, render_template, jsonify, send_from_directory
import os
import billing
import admin
import accountant

app = Flask(__name__)


@app.route("/")
@app.route("/billing")
def home():
    return render_template("billing.html")


@app.route("/admin")
def admin_page():
    return render_template("admin.html")


@app.route("/accountant")
def accountant_page():
    return render_template("accountant.html")


@app.route("/api/health")
def health():
    return jsonify(status="ok", app="ATOM POS")


@app.route("/api/admin/summary")
def admin_summary():
    """Server-side shape for admin stats (client still uses IndexedDB)."""
    return jsonify(
        {
            "panel": "admin",
            "helpers": ["product_summary", "sales_summary", "validate_product"],
            "note": "Live data is stored in the browser (IndexedDB).",
        }
    )


@app.route("/api/accountant/status")
def accountant_status():
    return jsonify(accountant.status_message())


@app.route("/manifest.webmanifest")
def manifest():
    return send_from_directory("static", "manifest.webmanifest", mimetype="application/manifest+json")


@app.route("/sw.js")
def service_worker():
    return send_from_directory("static", "sw.js", mimetype="application/javascript")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
