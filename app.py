from flask import Flask, render_template, jsonify
import billing
app = Flask(__name__)
@app.route('/')
@app.route('/billing')
def home(): return render_template('billing.html')
@app.route('/api/health')
def health(): return jsonify(status='ok', app='ATOM POS')
if __name__ == '__main__': app.run(host='0.0.0.0', port=5000, debug=True)
