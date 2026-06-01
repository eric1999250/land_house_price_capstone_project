from dotenv import load_dotenv
load_dotenv()  # ← must be FIRST, before any os.getenv() calls

from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
# Add these imports at the top with other imports
import PyPDF2
import docx as python_docx
import joblib
import pandas as pd
import numpy as np
import json
import warnings
import re
import uuid
from datetime import datetime
import smtplib
from email.mime.text import MIMEText
import secrets
from openai import OpenAI
import os

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

warnings.filterwarnings('ignore')

app = Flask(__name__, template_folder='templates')

CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:3000"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

import psycopg2
import psycopg2.extras
import bcrypt

DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "database": "land_price_estimation",
    "user": "postgres",
    "password": os.getenv("DB_PASSWORD")
}

# Folder where uploaded documents are saved
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def get_db():
    return psycopg2.connect(**DB_CONFIG, cursor_factory=psycopg2.extras.RealDictCursor)


# ══════════════════════════════════════════════════════════════
# DATABASE MIGRATION — run this once to add new tables/columns
# Call GET /migrate to execute on first deploy
# ══════════════════════════════════════════════════════════════
@app.route('/migrate', methods=['GET'])
def migrate():
    """
    Adds all new columns and tables needed for the 12-step workflow.
    Safe to run multiple times (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
    """
    try:
        conn = get_db()
        cur = conn.cursor()

        # ── agreements table — add new workflow columns ──
        new_agreement_cols = [
            ("form_status",          "VARCHAR(50) DEFAULT 'pending'"),
            ("form_id",              "INTEGER"),
            ("form_submitted_at",    "TIMESTAMP"),
            ("notary_id",            "INTEGER"),
            ("notary_name",          "VARCHAR(255)"),
            ("notary_email",         "VARCHAR(255)"),
            ("notary_sector",        "VARCHAR(255)"),
            ("notary_type",          "VARCHAR(50)"),
            ("notary_requested_at",  "TIMESTAMP"),
            ("appointment_date",     "DATE"),
            ("appointment_time",     "VARCHAR(20)"),
            ("appointment_location", "TEXT"),
            ("appointment_set_at",   "TIMESTAMP"),
            ("stamped_at",           "TIMESTAMP"),
            ("sent_to_district_at",  "TIMESTAMP"),
            ("district_ref",         "VARCHAR(100)"),
        ]
        for col, coltype in new_agreement_cols:
            cur.execute(f"""
                ALTER TABLE agreements
                ADD COLUMN IF NOT EXISTS {col} {coltype}
            """)

        # ── sale_forms table — stores Form 11.a + 11.b data ──
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sale_forms (
                id                   SERIAL PRIMARY KEY,
                form_ref             VARCHAR(50) UNIQUE NOT NULL,
                agreement_id         INTEGER REFERENCES agreements(id) ON DELETE CASCADE,
                listing_id           INTEGER,
                seller_id            INTEGER REFERENCES users(id) ON DELETE SET NULL,
                buyer_id             INTEGER REFERENCES users(id) ON DELETE SET NULL,

                -- Form 11.a — Seller info
                seller_name          VARCHAR(255),
                seller_national_id   VARCHAR(50),
                seller_district      VARCHAR(100),
                seller_sector        VARCHAR(100),
                seller_cell          VARCHAR(100),
                seller_village       VARCHAR(100),
                seller_phone         VARCHAR(50),
                seller_email         VARCHAR(255),
                buyer_phone          VARCHAR(50),

                -- Marital status
                married              VARCHAR(5) DEFAULT 'no',
                spouse_name          VARCHAR(255),
                spouse_national_id   VARCHAR(50),

                -- Parcel info
                upi                  VARCHAR(100),
                province             VARCHAR(100),
                district             VARCHAR(100),
                sector               VARCHAR(100),
                cell                 VARCHAR(100),
                percentage           VARCHAR(10) DEFAULT '100',
                motivation           TEXT,

                -- Form 11.b — Buyer info
                buyer_name           VARCHAR(255),
                buyer_national_id    VARCHAR(50),
                buyer_district       VARCHAR(100),
                buyer_sector         VARCHAR(100),
                buyer_cell           VARCHAR(100),
                buyer_village        VARCHAR(100),

                -- Contract values
                agreed_price         NUMERIC(15,2),
                land_value           NUMERIC(15,2),
                development_value    NUMERIC(15,2) DEFAULT 0,

                -- Document checklist
                doc_buyer_id         BOOLEAN DEFAULT FALSE,
                doc_civil_status     BOOLEAN DEFAULT FALSE,
                doc_land_title       BOOLEAN DEFAULT FALSE,

                -- Uploaded file paths (stored on server)
                file_seller_id       VARCHAR(500),
                file_spouse_id       VARCHAR(500),
                file_buyer_id        VARCHAR(500),
                file_land_title      VARCHAR(500),
                file_civil_cert_seller VARCHAR(500),
                file_civil_cert_buyer  VARCHAR(500),

                created_at           TIMESTAMP DEFAULT NOW(),
                updated_at           TIMESTAMP DEFAULT NOW()
            )
        """)

        # ── notary_requests table — tracks notary assignment ──
        cur.execute("""
            CREATE TABLE IF NOT EXISTS notary_requests (
                id              SERIAL PRIMARY KEY,
                request_ref     VARCHAR(50) UNIQUE NOT NULL,
                agreement_id    INTEGER REFERENCES agreements(id) ON DELETE CASCADE,
                form_id         INTEGER REFERENCES sale_forms(id) ON DELETE SET NULL,
                listing_id      INTEGER,
                seller_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
                buyer_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
                upi             VARCHAR(100),
                notary_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
                notary_name     VARCHAR(255),
                notary_email    VARCHAR(255),
                notary_sector   VARCHAR(255),
                notary_type     VARCHAR(50),
                status          VARCHAR(50) DEFAULT 'pending',
                created_at      TIMESTAMP DEFAULT NOW(),
                responded_at    TIMESTAMP,
                notes           TEXT
            )
        """)

        # ── notary_documents table — files notary uploads ──
        cur.execute("""
            CREATE TABLE IF NOT EXISTS notary_documents (
                id              SERIAL PRIMARY KEY,
                request_id      INTEGER REFERENCES notary_requests(id) ON DELETE CASCADE,
                agreement_id    INTEGER REFERENCES agreements(id) ON DELETE CASCADE,
                doc_type        VARCHAR(100),
                file_path       VARCHAR(500),
                original_name   VARCHAR(500),
                uploaded_at     TIMESTAMP DEFAULT NOW(),
                verified        BOOLEAN DEFAULT FALSE,
                verified_at     TIMESTAMP
            )
        """)

        # ── notary_type, district_name, sector_name, license_number columns on users ──
        cur.execute("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS notary_type VARCHAR(50) DEFAULT 'sector'
        """)
        cur.execute("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS district_name VARCHAR(255)
        """)
        cur.execute("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS sector_name VARCHAR(255)
        """)
        cur.execute("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS license_number VARCHAR(255)
        """)

        # Add rejection_reason to transactions if missing
        cur.execute("""
            ALTER TABLE transactions
            ADD COLUMN IF NOT EXISTS rejection_reason TEXT
        """)

        # ── appointment_* columns on notary_requests ──
        appt_cols = [
            ("appointment_date",     "DATE"),
            ("appointment_time",     "VARCHAR(20)"),
            ("appointment_location", "TEXT"),
            ("appointment_set_at",   "TIMESTAMP"),
        ]
        for col, coltype in appt_cols:
            cur.execute(f"""
                ALTER TABLE notary_requests
                ADD COLUMN IF NOT EXISTS {col} {coltype}
            """)

        # ── land_parcels text columns (formerly migrate2) ──
        for col in ['cell', 'village', 'province_text', 'district_text', 'sector_text']:
            cur.execute(f"ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS {col} VARCHAR(255)")

        #  ══════════════════════════════════════════════════════════════
        # RUN THESE SQL STATEMENTS ONCE (add to /migrate route or run directly)
        # ══════════════════════════════════════════════════════════════

        # 1. Add generated_at column to reports table
        cur.execute("""ALTER TABLE reports ADD COLUMN IF NOT EXISTS generated_at TIMESTAMP DEFAULT NOW();""")

        #  2. Backfill existing rows
        cur.execute("""UPDATE reports SET generated_at = sent_at WHERE generated_at IS NULL;""")

        # 3. Add from_role column if missing
        cur.execute("""ALTER TABLE reports ADD COLUMN IF NOT EXISTS from_role VARCHAR(50);""")

        #  4. Add verified_at to land_parcels if missing (needed for date filtering)
        cur.execute("""ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;""")
        cur.execute("""ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS entered_by INTEGER REFERENCES users(id);""")

        #  5. Add appointment_set_at to notary_requests if missing
        cur.execute("""ALTER TABLE notary_requests ADD COLUMN IF NOT EXISTS appointment_set_at TIMESTAMP;""")

        #  6. Backfill appointment_set_at from responded_at for stamped records
        cur.execute("""UPDATE notary_requests 
        SET appointment_set_at = responded_at 
        WHERE appointment_set_at IS NULL AND responded_at IS NOT NULL AND status IN ('appointment_set','stamped','sent_to_district','sent_to_admin');""")

        # Inside migrate(), add after existing ALTER TABLE statements:
        
        cur.execute("ALTER TABLE reports ADD COLUMN IF NOT EXISTS generated_at TIMESTAMP DEFAULT NOW()")
        cur.execute("UPDATE reports SET generated_at = sent_at WHERE generated_at IS NULL")
        cur.execute("ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP")
        cur.execute("ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS entered_by INTEGER REFERENCES users(id) ON DELETE SET NULL")
        cur.execute("ALTER TABLE notary_requests ADD COLUMN IF NOT EXISTS appointment_set_at TIMESTAMP")
        cur.execute("ALTER TABLE reports ADD COLUMN IF NOT EXISTS generated_at TIMESTAMP DEFAULT NOW()")
        # ══════════════════════════════════════════════════════════════
        cur.execute("ALTER TABLE reports ADD COLUMN IF NOT EXISTS generated_at TIMESTAMP DEFAULT NOW()")
        cur.execute("UPDATE reports SET generated_at = sent_at WHERE generated_at IS NULL")
        cur.execute("ALTER TABLE reports ADD COLUMN IF NOT EXISTS from_role VARCHAR(50)")
 

        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'message': 'Migration complete (includes land_parcels columns)'})
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500       


# ── LOGIN ──────────────────────────────────────────────────
@app.route('/auth/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data     = request.get_json()
        email    = data.get('email', '').strip().lower()
        password = data.get('password', '').strip()

        if not email or not password:
            return jsonify({'success': False, 'message': 'Email and password are required'}), 400

        conn = get_db()
        cur  = conn.cursor()
        cur.execute("""
            SELECT u.id, u.full_name, u.email, u.password_hash,
                   u.status, r.name AS role,
                   u.district_id, u.sector_id,
                   d.name AS district_name,
                   s.name AS sector_name,
                   u.notary_type
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN districts d ON u.district_id = d.id
            LEFT JOIN sectors s ON u.sector_id = s.id
            WHERE LOWER(u.email) = %s
        """, (email,))
        user = cur.fetchone()
        cur.close()
        conn.close()

        if not user:
            return jsonify({'success': False, 'message': 'Incorrect Email or password'}), 401
        if user['status'] != 'approved':
            return jsonify({'success': False, 'message': f'Account is {user["status"]}. Contact administrator.'}), 403

        # bcrypt password check
        try:
            password_ok = bcrypt.checkpw(
                password.encode('utf-8'),
                user['password_hash'].encode('utf-8')
            )
        except Exception:
            password_ok = False

        if not password_ok:
            return jsonify({'success': False, 'message': 'Incorrect Email or password'}), 401

        ROLE_REDIRECTS = {
            'admin':                 '/dashboard/admin',
            'district_land_officer': '/dashboard/district',
            'sector_land_officer':   '/dashboard/sector',
            'notary':                '/dashboard/notary',
            'buyer_seller':          '/dashboard/buyer',
        }

        # Fetch notary_type if user is notary (already in query, but ensure it's there)
        notary_type_val = user.get('notary_type') if user['role'] == 'notary' else None

        return jsonify({
            'success':  True,
            'redirect': ROLE_REDIRECTS.get(user['role'], '/dashboard/buyer'),
            'user': {
                'id':            user['id'],
                'name':          user['full_name'],
                'email':         user['email'],
                'role':          user['role'],
                'notary_type':   notary_type_val,
                'district_id':   user.get('district_id'),
                'district_name': user.get('district_name'),
                'sector_id':     user.get('sector_id'),
                'sector_name':   user.get('sector_name'),
            }
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500


# ── GET USER PROFILE ───────────────────────────────────────
@app.route('/auth/me', methods=['POST', 'OPTIONS'])
def get_me():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data    = request.get_json()
        user_id = data.get('user_id')
        conn    = get_db()
        cur     = conn.cursor()
        cur.execute("""
            SELECT u.id, u.full_name, u.email, u.phone,
                   u.status, r.name AS role,
                   p.name AS province, d.name AS district, s.name AS sector
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN provinces p ON u.province_id = p.id
            LEFT JOIN districts d ON u.district_id = d.id
            LEFT JOIN sectors   s ON u.sector_id   = s.id
            WHERE u.id = %s
        """, (user_id,))
        user = cur.fetchone()
        cur.close(); conn.close()
        if not user:
            return jsonify({'success': False, 'message': 'User not found'}), 404
        return jsonify({'success': True, 'user': dict(user)})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ── Load ML artifacts ──────────────────────────────────────
try:
    land_model    = joblib.load('best_land_price_model.pkl')
    label_encoders = joblib.load('label_encoders.pkl')
    scaler        = joblib.load('scaler.pkl')
    with open('features.json', 'r') as f:
        features = json.load(f)
    df = pd.read_csv('all_upi_cleaned.csv', encoding='latin1', engine='python', on_bad_lines='skip')
    print("Models and data loaded successfully!")
except Exception as e:
    print(f"Error loading files: {e}")
    land_model = label_encoders = scaler = features = df = None


# ── Preprocessing helpers ──────────────────────────────────
def normalize_land_use(s):
    if pd.isna(s): return 'unknown'
    s = str(s).lower().strip().lstrip('|').strip()
    if any(x in s for x in ['farm', 'agricultur', 'agri']): return 'agriculture'
    if 'plantation' in s: return 'plantation'
    if 'forest'     in s: return 'forest'
    if 'wetland'    in s: return 'wetland'
    if 'commercial' in s: return 'commercial'
    if 'industrial' in s: return 'industrial'
    if 'road'       in s: return 'road'
    if 'mixed'      in s: return 'mixed_use'
    if 'residential'in s: return 'residential'
    return 'other'

def extract_zone_code(z):
    if pd.isna(z): return 'Unknown'
    m = re.match(r'^([A-Z0-9]+)', str(z).strip())
    return m.group(1) if m else 'Unknown'

def normalize_settlement(s):
    if pd.isna(s): return 'not_found'
    s = str(s).lower().strip()
    if 'secondary' in s or 'second' in s: return 'secondary_city'
    if 'rural'     in s or 'rular'  in s: return 'rural_settlement'
    if 'plantation'in s: return 'plantation'
    return 'not_found'

def safe_encode(le, value):
    try:
        return int(le.transform([str(value)])[0])
    except ValueError:
        return 0

def preprocess_row(row):
    x    = float(row.get('x', 0) or 0)
    y    = float(row.get('y', 0) or 0)
    area = float(row.get('area_in_meter_square', 0) or 0)
    zoning_pct = float(row.get('zoning_percentage', 0) or 0)
    settle_pct = float(row.get('sentlement_percentage', 0) or 0)

    land_use_clean   = normalize_land_use(row.get('Land_Use'))
    zone_code        = extract_zone_code(row.get('zoning'))
    settlement_clean = normalize_settlement(row.get('sentlement'))
    village_clean    = str(row.get('village', '')).lower().strip()
    cell_clean       = str(row.get('cell', '')).lower().strip()

    encoded = {
        'land_use_clean_enc':   safe_encode(label_encoders['land_use_clean'],   land_use_clean),
        'zone_code_enc':        safe_encode(label_encoders['zone_code'],         zone_code),
        'settlement_clean_enc': safe_encode(label_encoders['settlement_clean'],  settlement_clean),
        'village_clean_enc':    safe_encode(label_encoders['village_clean'],     village_clean),
        'cell_clean_enc':       safe_encode(label_encoders['cell_clean'],        cell_clean),
    }

    feature_values = {
        'x': x, 'y': y, 'area_in_meter_square': area,
        'zoning_percentage': zoning_pct, 'sentlement_percentage': settle_pct,
        **encoded
    }
    return pd.DataFrame([feature_values])[features]

def clean_upi(upi):
    return str(upi).strip().replace(' ', '')


# ── SEARCH ────────────────────────────────────────────────
@app.route('/search', methods=['POST', 'OPTIONS'])
def search():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        upi  = data.get('upi', '').strip()
        if not upi:
            return jsonify({'success': False, 'message': 'UPI is required'}), 400

        try:
            conn = get_db(); cur = conn.cursor()
            cur.execute("""
                SELECT lp.upi, lp.x, lp.y, lp.area_in_meter_square,
                       lp.zoning, lp.zoning_percentage,
                       lp.sentlement, lp.sentlement_percentage, lp.land_use,
                       lp.minimum_value_per_sqm,
                       lp.weighted_average_value_per_sqm,
                       lp.maximum_value_per_sqm,
                       p.name AS province, d.name AS district,
                       s.name AS sector,
                       lp.cell, lp.village
                FROM land_parcels lp
                LEFT JOIN provinces p ON lp.province_id = p.id
                LEFT JOIN districts d ON lp.district_id = d.id
                LEFT JOIN sectors   s ON lp.sector_id   = s.id
                WHERE lp.upi = %s
            """, (upi,))
            db_row = cur.fetchone()
            cur.close(); conn.close()

            if db_row:
                r = dict(db_row)
                return jsonify({'success': True, 'data': {
                    'UPI':          str(r['upi']),
                    'Village':      str(r['village']  or 'N/A'),
                    'Province':     str(r['province'] or 'N/A'),
                    'District':     str(r['district'] or 'N/A'),
                    'Sector':       str(r['sector']   or 'N/A'),
                    'Cell':         str(r['cell']     or 'N/A'),
                    'X_coordinate': float(r['x']      or 0),
                    'Y_coordinate': float(r['y']      or 0),
                    'Area':         float(r['area_in_meter_square'] or 0),
                    'Zoning':       str(r['zoning']   or 'N/A'),
                    'Zoning_%':     float(r['zoning_percentage']    or 0),
                    'Settlement':   str(r['sentlement']  or 'N/A'),
                    'Settlement_%': float(r['sentlement_percentage'] or 0),
                    'Land_use':     str(r['land_use'] or 'N/A'),
                    'Min_Value_Sqm': float(r['minimum_value_per_sqm']          or 0),
                    'Avg_Value_Sqm': float(r['weighted_average_value_per_sqm'] or 0),
                    'Max_Value_Sqm': float(r['maximum_value_per_sqm']          or 0),
                    '_source': 'db',
                }})
        except Exception as db_err:
            print(f"[search] DB lookup failed: {db_err}")

        if df is None:
            return jsonify({'success': False, 'message': 'Dataset not loaded'}), 500

        df_temp = df.copy()
        df_temp['upi_clean'] = df_temp['upi'].apply(clean_upi)
        match = df_temp[df_temp['upi_clean'] == clean_upi(upi)]
        if match.empty:
            return jsonify({'success': False, 'message': f'UPI "{upi}" not found'}), 404

        row = match.iloc[0]
        return jsonify({'success': True, 'data': {
            'UPI':          str(row['upi']),
            'Village':      str(row['village']),
            'Province':     str(row['province']),
            'District':     str(row['district']),
            'Sector':       str(row['sector']),
            'Cell':         str(row['cell']),
            'X_coordinate': float(row['x']),
            'Y_coordinate': float(row['y']),
            'Area':         float(row['area_in_meter_square']),
            'Zoning':       str(row['zoning'])      if pd.notna(row['zoning'])      else 'N/A',
            'Zoning_%':     float(row['zoning_percentage']) if pd.notna(row['zoning_percentage']) else 0,
            'Settlement':   str(row['sentlement'])   if pd.notna(row['sentlement'])   else 'N/A',
            'Settlement_%': float(row['sentlement_percentage']) if pd.notna(row['sentlement_percentage']) else 0,
            'Land_use':     str(row['Land_Use'])     if pd.notna(row['Land_Use'])     else 'N/A',
            'Min_Value_Sqm': float(row['Minimum_Value_Per_Sqm']),
            'Avg_Value_Sqm': float(row['Weighted_Average_Value_Per_Sqm']),
            'Max_Value_Sqm': float(row['Maximum_Value_Per_Sqm']),
            '_source': 'csv',
        }})
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error: {str(e)}'}), 500


# ── PREDICT ───────────────────────────────────────────────
@app.route('/predict', methods=['POST', 'OPTIONS'])
def predict():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data    = request.get_json()
        upi     = data.get('upi', '').strip()
        user_id = data.get('user_id')

        if not upi:
            return jsonify({'success': False, 'message': 'UPI is required'}), 400
        if land_model is None:
            return jsonify({'success': False, 'message': 'Model not loaded'}), 500

        row = None
        try:
            conn = get_db(); cur = conn.cursor()
            cur.execute("""
                SELECT lp.upi, lp.x, lp.y, lp.area_in_meter_square,
                       lp.zoning, lp.zoning_percentage,
                       lp.sentlement, lp.sentlement_percentage, lp.land_use,
                       p.name AS province, d.name AS district,
                       s.name AS sector, lp.cell, lp.village
                FROM land_parcels lp
                LEFT JOIN provinces p ON lp.province_id = p.id
                LEFT JOIN districts d ON lp.district_id = d.id
                LEFT JOIN sectors   s ON lp.sector_id   = s.id
                WHERE lp.upi = %s
            """, (upi,))
            db_row = cur.fetchone()
            cur.close(); conn.close()
            if db_row:
                r = dict(db_row)
                row = pd.Series({
                    'upi': r['upi'], 'x': r['x'] or 0, 'y': r['y'] or 0,
                    'area_in_meter_square': r['area_in_meter_square'] or 0,
                    'zoning': r['zoning'], 'zoning_percentage': r['zoning_percentage'] or 0,
                    'sentlement': r['sentlement'], 'sentlement_percentage': r['sentlement_percentage'] or 0,
                    'Land_Use': r['land_use'], 'province': r['province'],
                    'district': r['district'], 'sector': r['sector'],
                    'cell': r['cell'] or '', 'village': r['village'] or '',
                })
        except Exception as db_err:
            print(f"[predict] DB lookup failed: {db_err}")

        if row is None:
            if df is None:
                return jsonify({'success': False, 'message': 'UPI not found'}), 404
            df_temp = df.copy()
            df_temp['upi_clean'] = df_temp['upi'].apply(clean_upi)
            match = df_temp[df_temp['upi_clean'] == clean_upi(upi)]
            if match.empty:
                return jsonify({'success': False, 'message': f'UPI "{upi}" not found'}), 404
            row = match.iloc[0]

        area = float(row['area_in_meter_square'])
        if area <= 0:
            return jsonify({'success': False, 'message': 'Invalid area value for this UPI'}), 400

        X_input    = preprocess_row(row)
        X_scaled   = scaler.transform(X_input)
        prediction = land_model.predict(X_scaled)[0]

        min_sqm = float(prediction[0])
        avg_sqm = float(prediction[1])
        max_sqm = float(prediction[2])
        min_total = min_sqm * area
        avg_total = avg_sqm * area
        max_total = max_sqm * area

        def calc_tax(p):
            return (p - 5_000_000) * 0.025 if p > 5_000_000 else 0.0

        if user_id:
            print(f"[DEBUG] Saving history for user_id={user_id}, upi={upi}")
            try:
                session_key = str(uuid.uuid4())[:16]
                conn = get_db(); cur = conn.cursor()
                cur.execute("""
                    INSERT INTO prediction_history (
                        user_id, upi, province, district, sector, cell, village,
                        area_m2, land_use, zoning,
                        min_price, avg_price, max_price,
                        min_per_sqm, avg_per_sqm, max_per_sqm,
                        tax_min, tax_avg, tax_max, session_key,
                        created_at
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
                    ON CONFLICT (user_id, upi)
                    DO UPDATE SET
                        min_price    = EXCLUDED.min_price,
                        avg_price    = EXCLUDED.avg_price,
                        max_price    = EXCLUDED.max_price,
                        min_per_sqm  = EXCLUDED.min_per_sqm,
                        avg_per_sqm  = EXCLUDED.avg_per_sqm,
                        max_per_sqm  = EXCLUDED.max_per_sqm,
                        tax_min      = EXCLUDED.tax_min,
                        tax_avg      = EXCLUDED.tax_avg,
                        tax_max      = EXCLUDED.tax_max,
                        session_key  = EXCLUDED.session_key,
                        created_at   = NOW()
                """, (
                    user_id, str(row['upi']),
                    str(row.get('province') or ''), str(row.get('district') or ''),
                    str(row.get('sector') or ''), str(row.get('cell') or ''),
                    str(row.get('village') or ''), area,
                    str(row.get('Land_Use') or row.get('land_use') or ''),
                    str(row.get('zoning') or ''),
                    min_total, avg_total, max_total,
                    min_sqm, avg_sqm, max_sqm,
                    calc_tax(min_total), calc_tax(avg_total), calc_tax(max_total),
                    session_key,
                ))
                conn.commit(); 
                print(f"[DEBUG] History saved successfully for user_id={user_id}") 
                cur.close(); conn.close()
            except Exception as db_err:
                import traceback; traceback.print_exc()
                print(f"DB save error full: {db_err}")

        return jsonify({
            'success': True,
            'min_price': min_total, 'avg_price': avg_total, 'max_price': max_total,
            'area': area,
            'min_per_sqm': min_sqm, 'avg_per_sqm': avg_sqm, 'max_per_sqm': max_sqm,
        })
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': f'Error: {str(e)}'}), 500


# ══════════════════════════════════════════════════════════════
# NEW ROUTE 1 — Submit Form 11.a + 11.b
# POST /sale-form/submit  (multipart/form-data)
# ══════════════════════════════════════════════════════════════
@app.route('/sale-form/submit', methods=['POST', 'OPTIONS'])
def sale_form_submit():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        # Parse fields (sent as FormData, not JSON)
        agreement_id = request.form.get('agreement_id')
        listing_id   = request.form.get('listing_id')
        seller_id    = request.form.get('seller_id_user')
        buyer_id     = request.form.get('buyer_id_user')
        form_json    = request.form.get('form_data', '{}')

        try:
            fd = json.loads(form_json)
        except Exception:
            return jsonify({'success': False, 'message': 'Invalid form_data JSON'}), 400

        if not agreement_id:
            return jsonify({'success': False, 'message': 'agreement_id is required'}), 400
        if not fd.get('seller_national_id'):
            return jsonify({'success': False, 'message': 'Seller National ID is required'}), 400
        if not fd.get('buyer_national_id'):
            return jsonify({'success': False, 'message': 'Buyer National ID is required'}), 400

        # ── Save uploaded files ──
        def save_file(field_key):
            f = request.files.get(field_key)
            if not f or f.filename == '':
                return None
            ext  = os.path.splitext(f.filename)[1].lower()
            safe = f'{field_key}_{uuid.uuid4().hex[:12]}{ext}'
            path = os.path.join(UPLOAD_FOLDER, safe)
            f.save(path)
            return safe  # store relative name; serve with /uploads/<name> if needed

        file_seller_id        = save_file('seller_id')
        file_spouse_id        = save_file('spouse_id')
        file_buyer_id         = save_file('buyer_id')
        file_land_title       = save_file('land_title')
        file_civil_seller     = save_file('civil_cert_seller')
        file_civil_buyer      = save_file('civil_cert_buyer')

        # ── Generate form reference ──
        form_ref = 'SF-' + uuid.uuid4().hex[:10].upper()

        conn = get_db()
        cur  = conn.cursor()

        # Insert into sale_forms
        cur.execute("""
            INSERT INTO sale_forms (
                form_ref, agreement_id, listing_id, seller_id, buyer_id,
                seller_name, seller_national_id,
                seller_district, seller_sector, seller_cell, seller_village,
                seller_phone, seller_email, buyer_phone,
                married, spouse_name, spouse_national_id,
                upi, province, district, sector, cell, percentage, motivation,
                buyer_name, buyer_national_id,
                buyer_district, buyer_sector, buyer_cell, buyer_village,
                agreed_price, land_value, development_value,
                doc_buyer_id, doc_civil_status, doc_land_title,
                file_seller_id, file_spouse_id, file_buyer_id,
                file_land_title, file_civil_cert_seller, file_civil_cert_buyer
            ) VALUES (
                %s,%s,%s,%s,%s,
                %s,%s,%s,%s,%s,%s,%s,%s,%s,
                %s,%s,%s,
                %s,%s,%s,%s,%s,%s,%s,
                %s,%s,%s,%s,%s,%s,
                %s,%s,%s,
                %s,%s,%s,
                %s,%s,%s,%s,%s,%s
            )
            RETURNING id
        """, (
            form_ref, agreement_id, listing_id, seller_id, buyer_id,
            fd.get('seller_name'), fd.get('seller_national_id'),
            fd.get('seller_district'), fd.get('seller_sector'),
            fd.get('seller_cell'), fd.get('seller_village'),
            fd.get('seller_phone'), fd.get('seller_email'), fd.get('buyer_phone'),
            fd.get('married', 'no'), fd.get('spouse_name'), fd.get('spouse_national_id'),
            fd.get('upi'), fd.get('province'), fd.get('district'),
            fd.get('sector'), fd.get('cell'),
            fd.get('percentage', '100'), fd.get('motivation'),
            fd.get('buyer_name'), fd.get('buyer_national_id'),
            fd.get('buyer_district'), fd.get('buyer_sector'),
            fd.get('buyer_cell'), fd.get('buyer_village'),
            fd.get('agreed_price') or None,
            fd.get('land_value') or None,
            fd.get('development_value') or 0,
            fd.get('doc_buyer_id', False),
            fd.get('doc_civil_status', False),
            fd.get('doc_land_title', False),
            file_seller_id, file_spouse_id, file_buyer_id,
            file_land_title, file_civil_seller, file_civil_buyer,
        ))
        form_id = cur.fetchone()['id']

        # Update agreement status to 'form_submitted'
        cur.execute("""
            UPDATE agreements
            SET form_status       = 'form_submitted',
                form_id           = %s,
                form_submitted_at = NOW()
            WHERE id = %s
        """, (form_id, agreement_id))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            'success':  True,
            'form_id':  form_id,
            'form_ref': form_ref,
            'message':  'Form 11.a & 11.b submitted successfully',
        })
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


# ══════════════════════════════════════════════════════════════
# NEW ROUTE 2 — Send notary request
# POST /notary-request/send
# ══════════════════════════════════════════════════════════════
@app.route('/notary-request/send', methods=['POST', 'OPTIONS'])
def notary_request_send():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data         = request.get_json()
        agreement_id = data.get('agreement_id')
        form_id      = data.get('form_id')
        listing_id   = data.get('listing_id')
        seller_id    = data.get('seller_id')
        buyer_id     = data.get('buyer_id')
        upi          = data.get('upi', '')
        notary_id    = data.get('notary_id')
        notary_name  = data.get('notary_name', '')
        notary_email = data.get('notary_email', '')
        notary_sector= data.get('notary_sector', '')
        notary_type  = data.get('notary_type', 'sector')

        if not agreement_id or not notary_id:
            return jsonify({'success': False, 'message': 'agreement_id and notary_id are required'}), 400

        request_ref = 'NR-' + uuid.uuid4().hex[:10].upper()

        conn = get_db()
        cur  = conn.cursor()

        # Insert notary request
        cur.execute("""
            INSERT INTO notary_requests (
                request_ref, agreement_id, form_id, listing_id,
                seller_id, buyer_id, upi,
                notary_id, notary_name, notary_email, notary_sector, notary_type,
                status
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'pending')
            RETURNING id
        """, (
            request_ref, agreement_id, form_id, listing_id,
            seller_id, buyer_id, upi,
            notary_id, notary_name, notary_email, notary_sector, notary_type,
        ))
        request_id = cur.fetchone()['id']

        # Update agreement with notary info + status
        cur.execute("""
            UPDATE agreements
            SET form_status          = 'notary_requested',
                notary_id            = %s,
                notary_name          = %s,
                notary_email         = %s,
                notary_sector        = %s,
                notary_type          = %s,
                notary_requested_at  = NOW()
            WHERE id = %s
        """, (notary_id, notary_name, notary_email, notary_sector, notary_type, agreement_id))

        # Send a system chat message to notify the notary
        # Room name follows pattern: mutation_{request_ref}_notary_{notary_id}
        room = f'notary_{request_ref}'
        cur.execute("""
            INSERT INTO chat_messages
                (room, sender_id, sender_name, sender_role, message,
                 listing_id, seller_id, buyer_id, notary_id, mutation_ref)
            VALUES (%s, %s, 'System', 'system', %s, %s, %s, %s, %s, %s)
        """, (
            room, seller_id,
            f'New land transfer request received. UPI: {upi}. Seller and buyer have agreed and filled Form 11.a & 11.b. Please review the documents and set an appointment date for signing. Reference: {request_ref}',
            listing_id, seller_id, buyer_id, notary_id, request_ref,
        ))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            'success':     True,
            'request_id':  request_id,
            'request_ref': request_ref,
            'message':     f'Request sent to notary {notary_name}',
        })
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


# ══════════════════════════════════════════════════════════════
# NEW ROUTE 3 — Get agreements where user is the SELLER
# POST /agreements/seller
# ══════════════════════════════════════════════════════════════
@app.route('/agreements/seller', methods=['POST', 'OPTIONS'])
def agreements_seller():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data      = request.get_json()
        seller_id = data.get('seller_id')

        if not seller_id:
            return jsonify({'success': False, 'message': 'seller_id required'}), 400

        conn = get_db()
        cur  = conn.cursor()
        cur.execute("""
            SELECT a.id, a.upi, a.listing_id, a.seller_id, a.buyer_id,
                   a.seller_name, a.buyer_name, a.room,
                   a.agreed_price, a.confirmed_at,
                   a.form_status, a.form_id, a.form_submitted_at,
                   a.notary_id, a.notary_name, a.notary_email,
                   a.notary_sector, a.notary_type, a.notary_requested_at,
                   a.appointment_date, a.appointment_time, a.appointment_location,
                   a.stamped_at, a.sent_to_district_at, a.district_ref,
                   p.land_data
            FROM agreements a
            LEFT JOIN publications p ON a.listing_id = p.id
            WHERE a.seller_id = %s
            ORDER BY a.confirmed_at DESC
        """, (seller_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()

        result = []
        for r in rows:
            d = dict(r)
            for ts_col in ['confirmed_at', 'form_submitted_at', 'notary_requested_at',
                           'appointment_set_at', 'stamped_at', 'sent_to_district_at']:
                if d.get(ts_col):
                    d[ts_col] = d[ts_col].isoformat()
            if d.get('appointment_date'):
                d['appointment_date'] = str(d['appointment_date'])
            ld = d.pop('land_data', {}) or {}
            if isinstance(ld, str):
                try: ld = json.loads(ld)
                except: ld = {}
            d['agreed_price'] = d['agreed_price'] or ld.get('asking_price', 0)
            result.append(d)

        return jsonify({'success': True, 'agreements': result})
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


# ── Agreements — BUYER VIEW ────────────────────────────────
@app.route('/agreements/buyer', methods=['POST', 'OPTIONS'])
def agreements_buyer():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data     = request.get_json()
        buyer_id = data.get('buyer_id')

        if not buyer_id:
            return jsonify({'success': False, 'message': 'buyer_id required'}), 400

        conn = get_db()
        cur  = conn.cursor()
        cur.execute("""
            SELECT a.id, a.upi, a.listing_id, a.seller_id, a.buyer_id,
                   a.seller_name, a.buyer_name, a.room,
                   a.agreed_price, a.confirmed_at, a.is_mutated,
                   a.form_status, a.form_submitted_at,
                   a.notary_name, a.notary_email, a.notary_sector, a.notary_type,
                   a.appointment_date, a.appointment_time, a.appointment_location,
                   a.stamped_at, a.sent_to_district_at, a.district_ref,
                   p.land_data
            FROM agreements a
            LEFT JOIN publications p ON a.listing_id = p.id
            WHERE a.buyer_id = %s AND a.is_mutated = FALSE
            ORDER BY a.confirmed_at DESC
        """, (buyer_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()

        result = []
        for r in rows:
            d = dict(r)
            for ts_col in ['confirmed_at', 'form_submitted_at', 'stamped_at', 'sent_to_district_at']:
                if d.get(ts_col):
                    d[ts_col] = d[ts_col].isoformat()
            if d.get('appointment_date'):
                d['appointment_date'] = str(d['appointment_date'])
            ld = d.pop('land_data', {}) or {}
            if isinstance(ld, str):
                try: ld = json.loads(ld)
                except: ld = {}
            d['agreed_price'] = d['agreed_price'] or ld.get('asking_price', 0)
            result.append(d)

        return jsonify({'success': True, 'agreements': result})
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


# ══════════════════════════════════════════════════════════════
# NOTARY DASHBOARD ROUTES
# (used by notary.js — steps 9, 10, 11, 12)
# ══════════════════════════════════════════════════════════════

# ── Get all pending notary requests for a notary ──
@app.route('/notary-requests/mine', methods=['POST', 'OPTIONS'])
def notary_requests_mine():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data      = request.get_json()
        notary_id = data.get('notary_id')

        if not notary_id:
            return jsonify({'success': False, 'message': 'notary_id required'}), 400

        conn = get_db()
        cur  = conn.cursor()
        cur.execute("""
            SELECT nr.id, nr.request_ref, nr.agreement_id, nr.form_id,
                   nr.seller_id, nr.buyer_id, nr.upi,
                   nr.notary_name, nr.notary_type, nr.status,
                   nr.appointment_date, nr.appointment_time, nr.appointment_location,
                   nr.created_at, nr.responded_at,
                   a.seller_name, a.buyer_name, a.agreed_price,
                   a.form_status, a.stamped_at, a.sent_to_district_at
            FROM notary_requests nr
            JOIN agreements a ON nr.agreement_id = a.id
            WHERE nr.notary_id = %s
            ORDER BY nr.created_at DESC
        """, (notary_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()

        result = []
        for r in rows:
            d = dict(r)
            for ts_col in ['created_at', 'responded_at', 'stamped_at', 'sent_to_district_at']:
                if d.get(ts_col):
                    d[ts_col] = d[ts_col].isoformat()
            if d.get('appointment_date'):
                d['appointment_date'] = str(d['appointment_date'])
            result.append(d)

        return jsonify({'success': True, 'requests': result})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ── Get form data for a specific request ──
@app.route('/sale-form/get', methods=['POST', 'OPTIONS'])
def sale_form_get():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data    = request.get_json()
        form_id = data.get('form_id')
        if not form_id:
            return jsonify({'success': False, 'message': 'form_id required'}), 400

        conn = get_db()
        cur  = conn.cursor()
        cur.execute("SELECT * FROM sale_forms WHERE id = %s", (form_id,))
        row = cur.fetchone()
        cur.close()
        conn.close()

        if not row:
            return jsonify({'success': False, 'message': 'Form not found'}), 404

        d = dict(row)
        for ts_col in ['created_at', 'updated_at']:
            if d.get(ts_col):
                d[ts_col] = d[ts_col].isoformat()
        return jsonify({'success': True, 'form': d})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ── Step 9: Notary sets appointment ──
@app.route('/notary-request/set-appointment', methods=['POST', 'OPTIONS'])
def notary_set_appointment():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data             = request.get_json()
        request_id       = data.get('request_id')
        agreement_id     = data.get('agreement_id')
        appointment_date = data.get('appointment_date')
        appointment_time = data.get('appointment_time', '')
        location         = data.get('location', '')

        if not request_id or not appointment_date:
            return jsonify({'success': False, 'message': 'request_id and appointment_date required'}), 400

        conn = get_db()
        cur  = conn.cursor()

        cur.execute("""
            UPDATE notary_requests
            SET appointment_date     = %s,
                appointment_time     = %s,
                appointment_location = %s,
                appointment_set_at   = NOW(),
                status               = 'appointment_set'
            WHERE id = %s
        """, (appointment_date, appointment_time, location, request_id))

        cur.execute("""
            UPDATE agreements
            SET form_status          = 'appointment_set',
                appointment_date     = %s,
                appointment_time     = %s,
                appointment_location = %s,
                appointment_set_at   = NOW()
            WHERE id = %s
        """, (appointment_date, appointment_time, location, agreement_id))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({'success': True, 'message': 'Appointment set. Seller and buyer will be notified.'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ── Step 10: Notary uploads documents ──
@app.route('/notary-documents/upload', methods=['POST', 'OPTIONS'])
def notary_documents_upload():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        request_id   = request.form.get('request_id')
        agreement_id = request.form.get('agreement_id')
        doc_type     = request.form.get('doc_type', 'other')

        if not request_id:
            return jsonify({'success': False, 'message': 'request_id required'}), 400

        uploaded = []
        for key, f in request.files.items():
            if f and f.filename:
                ext  = os.path.splitext(f.filename)[1].lower()
                safe = f'notary_{doc_type}_{uuid.uuid4().hex[:12]}{ext}'
                path = os.path.join(UPLOAD_FOLDER, safe)
                f.save(path)

                conn = get_db()
                cur  = conn.cursor()
                cur.execute("""
                    INSERT INTO notary_documents
                        (request_id, agreement_id, doc_type, file_path, original_name)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                """, (request_id, agreement_id, doc_type, safe, f.filename))
                doc_id = cur.fetchone()['id']
                conn.commit()
                cur.close()
                conn.close()
                uploaded.append({'id': doc_id, 'doc_type': doc_type, 'name': f.filename})

        return jsonify({'success': True, 'uploaded': uploaded})
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


# ── Get documents uploaded for a request ──
@app.route('/notary-documents/list', methods=['POST', 'OPTIONS'])
def notary_documents_list():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data       = request.get_json()
        request_id = data.get('request_id')
        if not request_id:
            return jsonify({'success': False, 'message': 'request_id required'}), 400

        conn = get_db()
        cur  = conn.cursor()
        cur.execute("""
            SELECT id, doc_type, file_path, original_name, verified, uploaded_at
            FROM notary_documents
            WHERE request_id = %s
            ORDER BY uploaded_at ASC
        """, (request_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()

        result = []
        for r in rows:
            d = dict(r)
            if d.get('uploaded_at'):
                d['uploaded_at'] = d['uploaded_at'].isoformat()
            result.append(d)
        return jsonify({'success': True, 'documents': result})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/transaction/documents', methods=['POST', 'OPTIONS'])
def transaction_documents():
    """Get all documents for a mutation matched strictly by UPI"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        transaction_id = data.get('transaction_id')
        reference = data.get('reference')

        if not transaction_id and not reference:
            return jsonify({'success': False, 'message': 'transaction_id or reference required'}), 400

        conn = get_db()
        cur = conn.cursor()

        # Get transaction
        if reference:
            cur.execute("SELECT id, upi, notary_id, buyer_id, seller_id FROM transactions WHERE reference = %s", (reference,))
        else:
            cur.execute("SELECT id, upi, notary_id, buyer_id, seller_id FROM transactions WHERE id = %s", (transaction_id,))
        tx = cur.fetchone()

        if not tx:
            cur.close(); conn.close()
            return jsonify({'success': False, 'message': 'Transaction not found'}), 404

        upi = tx['upi']

        # Find ALL notary_requests for this exact UPI (not just one)
        cur.execute("""
            SELECT nr.id, nr.request_ref, nr.notary_name, nr.notary_type,
                   nr.agreement_id,
                   u.sector_name, u.district_name, u.license_number
            FROM notary_requests nr
            LEFT JOIN users u ON nr.notary_id = u.id
            WHERE nr.upi = %s
            ORDER BY nr.id DESC
        """, (upi,))
        notary_requests = cur.fetchall()

        all_docs = []
        notary_info = None

        for nr in notary_requests:
            if notary_info is None:
                notary_info = dict(nr)

            # Get notary-uploaded documents for this request
            cur.execute("""
                SELECT id, doc_type, file_path, original_name, verified, uploaded_at
                FROM notary_documents
                WHERE request_id = %s
                ORDER BY uploaded_at ASC
            """, (nr['id'],))
            docs = cur.fetchall()
            for d in docs:
                doc = dict(d)
                if doc.get('uploaded_at'):
                    doc['uploaded_at'] = doc['uploaded_at'].isoformat()
                buyer_doc_types = {'seller_id_document', 'spouse_id_document', 'buyer_id_document',
                                   'land_title', 'civil_cert_seller', 'civil_cert_buyer'}
                doc['source'] = 'buyer' if doc['doc_type'] in buyer_doc_types else 'notary'
                # Avoid duplicates by file_path
                if not any(x['file_path'] == doc['file_path'] for x in all_docs):
                    all_docs.append(doc)

            # Also pull buyer docs from sale_forms linked to this agreement
            if nr.get('agreement_id'):
                cur.execute("""
                    SELECT sf.file_seller_id, sf.file_spouse_id, sf.file_buyer_id,
                           sf.file_land_title, sf.file_civil_cert_seller, sf.file_civil_cert_buyer
                    FROM sale_forms sf
                    WHERE sf.agreement_id = %s
                """, (nr['agreement_id'],))
                sf = cur.fetchone()
                if sf:
                    buyer_map = {
                        'seller_id_document': sf.get('file_seller_id'),
                        'spouse_id_document': sf.get('file_spouse_id'),
                        'buyer_id_document':  sf.get('file_buyer_id'),
                        'land_title':         sf.get('file_land_title'),
                        'civil_cert_seller':  sf.get('file_civil_cert_seller'),
                        'civil_cert_buyer':   sf.get('file_civil_cert_buyer'),
                    }
                    for doc_type, file_path in buyer_map.items():
                        if file_path and not any(x['file_path'] == file_path for x in all_docs):
                            all_docs.append({
                                'id': None,
                                'doc_type': doc_type,
                                'file_path': file_path,
                                'original_name': file_path,
                                'verified': True,
                                'uploaded_at': None,
                                'source': 'buyer',
                            })

        cur.close()
        conn.close()

        return jsonify({
            'success': True,
            'documents': all_docs,
            'notary_info': notary_info,
            'total': len(all_docs),
            'upi': upi,
        })
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500       


# ── Step 11: Notary stamps and signs ──
@app.route('/notary-request/stamp', methods=['POST', 'OPTIONS'])
def notary_stamp():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        request_id   = request.form.get('request_id') or (request.get_json() or {}).get('request_id')
        agreement_id = request.form.get('agreement_id') or (request.get_json() or {}).get('agreement_id')
        cert_number  = request.form.get('cert_number') or (request.get_json() or {}).get('cert_number', '')
        signed_date  = request.form.get('signed_date') or (request.get_json() or {}).get('signed_date', '')

        # Handle optional stamped document upload
        f = request.files.get('stamped_doc')
        if f and f.filename:
            ext  = os.path.splitext(f.filename)[1].lower()
            safe = f'stamped_{uuid.uuid4().hex[:12]}{ext}'
            f.save(os.path.join(UPLOAD_FOLDER, safe))
            conn2 = get_db(); cur2 = conn2.cursor()
            cur2.execute("""
                INSERT INTO notary_documents
                    (request_id, agreement_id, doc_type, file_path, original_name)
                VALUES (%s, %s, 'stamped_agreement', %s, %s)
            """, (request_id, agreement_id, safe, f.filename))
            conn2.commit(); cur2.close(); conn2.close()

        conn = get_db()
        cur  = conn.cursor()

        # ── 1. Fetch notary request details ──
        cur.execute("""
            SELECT nr.notary_id, nr.notary_type, nr.upi,
                   nr.seller_id, nr.buyer_id,
                   a.seller_name, a.buyer_name, a.agreed_price,
                   a.form_id
            FROM notary_requests nr
            JOIN agreements a ON nr.agreement_id = a.id
            WHERE nr.id = %s
        """, (request_id,))
        req_row = cur.fetchone()

        # ── 2. Fetch parcel data from land_parcels + location joins ──
        parcel = None
        if req_row and req_row['upi']:
            cur.execute("""
                SELECT lp.upi, lp.x, lp.y, lp.area_in_meter_square,
                       lp.zoning, lp.zoning_percentage,
                       lp.sentlement, lp.sentlement_percentage, lp.land_use,
                       lp.minimum_value_per_sqm,
                       lp.weighted_average_value_per_sqm,
                       lp.maximum_value_per_sqm,
                       p.name AS province, d.name AS district,
                       s.name AS sector, lp.cell, lp.village
                FROM land_parcels lp
                LEFT JOIN provinces p ON lp.province_id = p.id
                LEFT JOIN districts d ON lp.district_id = d.id
                LEFT JOIN sectors   s ON lp.sector_id   = s.id
                WHERE lp.upi = %s
            """, (req_row['upi'],))
            parcel = cur.fetchone()

            # Fallback to CSV if not in DB
            if not parcel and df is not None:
                df_temp = df.copy()
                df_temp['upi_clean'] = df_temp['upi'].apply(clean_upi)
                match = df_temp[df_temp['upi_clean'] == clean_upi(req_row['upi'])]
                if not match.empty:
                    row = match.iloc[0]
                    parcel = {
                        'upi': str(row['upi']),
                        'x': float(row['x']),
                        'y': float(row['y']),
                        'area_in_meter_square': float(row['area_in_meter_square']),
                        'zoning': str(row.get('zoning', '')),
                        'zoning_percentage': float(row.get('zoning_percentage', 0) or 0),
                        'sentlement': str(row.get('sentlement', '')),
                        'sentlement_percentage': float(row.get('sentlement_percentage', 0) or 0),
                        'land_use': str(row.get('Land_Use', '')),
                        'minimum_value_per_sqm': float(row.get('Minimum_Value_Per_Sqm', 0) or 0),
                        'weighted_average_value_per_sqm': float(row.get('Weighted_Average_Value_Per_Sqm', 0) or 0),
                        'maximum_value_per_sqm': float(row.get('Maximum_Value_Per_Sqm', 0) or 0),
                        'province': str(row.get('province', '')),
                        'district': str(row.get('district', '')),
                        'sector': str(row.get('sector', '')),
                        'cell': str(row.get('cell', '')),
                        'village': str(row.get('village', '')),
                    }

        # ── 3. Run ML prediction to get 3 prices ──
        ml_min = ml_avg = ml_max = None
        ml_min_sqm = ml_avg_sqm = ml_max_sqm = None
        if parcel and land_model is not None:
            try:
                area = float(parcel['area_in_meter_square'] or 0)
                if area > 0:
                    row_series = pd.Series({
                        'x': parcel['x'] or 0,
                        'y': parcel['y'] or 0,
                        'area_in_meter_square': area,
                        'zoning': parcel['zoning'],
                        'zoning_percentage': parcel['zoning_percentage'],
                        'sentlement': parcel['sentlement'],
                        'sentlement_percentage': parcel['sentlement_percentage'],
                        'Land_Use': parcel['land_use'],
                        'cell': parcel.get('cell', ''),
                        'village': parcel.get('village', ''),
                    })
                    X_input  = preprocess_row(row_series)
                    X_scaled = scaler.transform(X_input)
                    pred     = land_model.predict(X_scaled)[0]
                    ml_min_sqm = float(pred[0])
                    ml_avg_sqm = float(pred[1])
                    ml_max_sqm = float(pred[2])
                    ml_min = ml_min_sqm * area
                    ml_avg = ml_avg_sqm * area
                    ml_max = ml_max_sqm * area
            except Exception as pred_err:
                print(f"[stamp] ML prediction failed: {pred_err}")

        # ── 4. Get agreed price from form or agreement ──
        agreed_price = float(req_row['agreed_price'] or 0) if req_row else 0
        if not agreed_price and req_row and req_row.get('form_id'):
            cur.execute("SELECT agreed_price FROM sale_forms WHERE id = %s", (req_row['form_id'],))
            sf = cur.fetchone()
            if sf and sf['agreed_price']:
                agreed_price = float(sf['agreed_price'])

        # ── 5. Calculate capital gains tax ──
        tax = (agreed_price - 5_000_000) * 0.025 if agreed_price > 5_000_000 else 0.0

        # ── 6. Save to stamped_parcel_records ──
        if req_row and parcel:
            cur.execute("""
                INSERT INTO stamped_parcel_records (
                    request_id, agreement_id, request_ref, cert_number, signed_date,
                    notary_id, notary_type,
                    seller_id, buyer_id, seller_name, buyer_name,
                    upi, province, district, sector, cell, village,
                    x_coordinate, y_coordinate, area_m2,
                    zoning, zoning_percentage, settlement, settlement_percentage, land_use,
                    min_value_per_sqm, avg_value_per_sqm, max_value_per_sqm,
                    ml_min_price, ml_avg_price, ml_max_price,
                    ml_min_per_sqm, ml_avg_per_sqm, ml_max_per_sqm,
                    agreed_price, capital_gains_tax, stamped_at
                ) VALUES (
                    %s,%s,
                    (SELECT request_ref FROM notary_requests WHERE id=%s),
                    %s,%s,
                    %s,%s,
                    %s,%s,%s,%s,
                    %s,%s,%s,%s,%s,%s,
                    %s,%s,%s,
                    %s,%s,%s,%s,%s,
                    %s,%s,%s,
                    %s,%s,%s,
                    %s,%s,%s,
                    %s,%s,NOW()
                )
            """, (
                request_id, agreement_id,
                request_id,
                cert_number, signed_date or None,
                req_row['notary_id'], req_row['notary_type'],
                req_row['seller_id'], req_row['buyer_id'],
                req_row['seller_name'], req_row['buyer_name'],
                parcel['upi'],
                parcel.get('province'), parcel.get('district'),
                parcel.get('sector'), parcel.get('cell'), parcel.get('village'),
                parcel.get('x'), parcel.get('y'), parcel.get('area_in_meter_square'),
                parcel.get('zoning'), parcel.get('zoning_percentage'),
                parcel.get('sentlement'), parcel.get('sentlement_percentage'),
                parcel.get('land_use'),
                parcel.get('minimum_value_per_sqm'),
                parcel.get('weighted_average_value_per_sqm'),
                parcel.get('maximum_value_per_sqm'),
                ml_min, ml_avg, ml_max,
                ml_min_sqm, ml_avg_sqm, ml_max_sqm,
                agreed_price, tax,
            ))

        # ── 7. Update notary_requests and agreements status ──
        cur.execute("""
            UPDATE notary_requests
            SET status = 'stamped', responded_at = NOW()
            WHERE id = %s
        """, (request_id,))

        cur.execute("""
            UPDATE agreements
            SET form_status = 'stamped', stamped_at = NOW()
            WHERE id = %s
        """, (agreement_id,))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({'success': True, 'message': 'Documents stamped and signed. Parcel record saved.'})
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


# ── Step 12: Notary sends to district ──
@app.route('/notary-request/send-to-district', methods=['POST', 'OPTIONS'])
def notary_send_to_district():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data         = request.get_json()
        request_id   = data.get('request_id')
        agreement_id = data.get('agreement_id')
        notary_id    = data.get('notary_id')
        upi          = data.get('upi', '')
        notes        = data.get('notes', '')

        if not request_id or not agreement_id:
            return jsonify({'success': False, 'message': 'request_id and agreement_id required'}), 400

        district_ref = 'DIST-' + uuid.uuid4().hex[:10].upper()

        conn = get_db()
        cur  = conn.cursor()

        # Get notary details from the notary_requests table first
        cur.execute("""
            SELECT notary_id, notary_name, notary_email, notary_sector, notary_type
            FROM notary_requests
            WHERE id = %s
        """, (request_id,))
        notary_req = cur.fetchone()
        
        # Also get notary name from users table as fallback
        notary_name_from_user = None
        if not notary_req or not notary_req.get('notary_name'):
            cur.execute("""
                SELECT full_name as notary_name FROM users WHERE id = %s
            """, (notary_id,))
            user_row = cur.fetchone()
            if user_row:
                notary_name_from_user = user_row.get('notary_name')

        # Get all notary-uploaded documents for this request
        cur.execute("""
            SELECT id, doc_type, file_path, original_name
            FROM notary_documents WHERE request_id = %s
        """, (request_id,))
        docs = [dict(r) for r in cur.fetchall()]

        # Also get buyer-uploaded documents from sale_forms (Form 11.a files)
        cur.execute("""
            SELECT sf.file_seller_id, sf.file_spouse_id, sf.file_buyer_id,
                   sf.file_land_title, sf.file_civil_cert_seller, sf.file_civil_cert_buyer,
                   sf.seller_name, sf.buyer_name, sf.seller_national_id, sf.buyer_national_id
            FROM sale_forms sf
            JOIN agreements a ON sf.id = a.form_id
            WHERE a.id = %s
        """, (agreement_id,))
        sale_form = cur.fetchone()

        # Insert buyer docs into notary_documents so district/admin can see them
        if sale_form:
            buyer_doc_map = {
                'seller_id_document': sale_form.get('file_seller_id'),
                'spouse_id_document': sale_form.get('file_spouse_id'),
                'buyer_id_document':  sale_form.get('file_buyer_id'),
                'land_title':         sale_form.get('file_land_title'),
                'civil_cert_seller':  sale_form.get('file_civil_cert_seller'),
                'civil_cert_buyer':   sale_form.get('file_civil_cert_buyer'),
            }
            for doc_type, file_path in buyer_doc_map.items():
                if file_path:
                    # Check if not already inserted
                    cur.execute("""
                        SELECT id FROM notary_documents
                        WHERE request_id = %s AND doc_type = %s
                    """, (request_id, doc_type))
                    if not cur.fetchone():
                        cur.execute("""
                            INSERT INTO notary_documents
                                (request_id, agreement_id, doc_type, file_path, original_name, verified, verified_at)
                            VALUES (%s, %s, %s, %s, %s, TRUE, NOW())
                        """, (request_id, agreement_id, doc_type, file_path, file_path))
            # Re-fetch all docs including newly added buyer docs
            cur.execute("""
                SELECT id, doc_type, file_path, original_name
                FROM notary_documents WHERE request_id = %s
            """, (request_id,))
            docs = [dict(r) for r in cur.fetchall()]

        # Mark all docs as verified
        cur.execute("""
            UPDATE notary_documents
            SET verified = TRUE, verified_at = NOW()
            WHERE request_id = %s
        """, (request_id,))

        # Update notary request
        final_status = 'sent_to_admin' if (notary_req and notary_req.get('notary_type') == 'private') else 'sent_to_district'
        cur.execute("""
           UPDATE notary_requests
           SET status = %s, notes = %s
           WHERE id = %s
        """, (final_status, notes, request_id))

        # Get agreement details for the transaction record
        cur.execute("""
            SELECT a.*, 
                   sf.seller_name as sf_seller_name, 
                   sf.buyer_name as sf_buyer_name,
                   sf.agreed_price as sf_price, 
                   sf.seller_national_id, 
                   sf.buyer_national_id,
                   a.notary_name
            FROM agreements a
            LEFT JOIN sale_forms sf ON a.form_id = sf.id
            WHERE a.id = %s
        """, (agreement_id,))
        ag = cur.fetchone()

        if ag:
            # Create the transaction record (visible to district/admin)
            import random, string
            ref = 'MUT-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
            buyer_id_col = ag.get('buyer_id')
            seller_id_col = ag.get('seller_id')
            price = ag.get('sf_price') or ag.get('agreed_price') or 0
            
            # Get notary name - priority order:
            # 1. From notary_requests table
            # 2. From users table (fallback)
            # 3. From agreements table (last resort)
            # Get notary name - simplified
            notary_name = notary_req.get('notary_name') if notary_req else ag.get('notary_name', '')

            # Also get from users table if still empty
            if not notary_name and notary_id:
                cur.execute("SELECT full_name FROM users WHERE id = %s", (notary_id,))
                user_row = cur.fetchone()
                if user_row:
                    notary_name = user_row.get('full_name')
            else:
                notary_name = ag.get('notary_name', '')
            
            notary_id_val = notary_req.get('notary_id') if notary_req else (notary_id or ag.get('notary_id'))

            # Fetch notary sector/district/license for the transaction note
            notary_extra = ''
            if notary_id_val:
                cur.execute("SELECT sector_name, district_name, license_number FROM users WHERE id = %s", (notary_id_val,))
                nextra = cur.fetchone()
                if nextra:
                    parts = []
                    if nextra.get('sector_name'): parts.append(f"Sector: {nextra['sector_name']}")
                    if nextra.get('district_name'): parts.append(f"District: {nextra['district_name']}")
                    if nextra.get('license_number'): parts.append(f"License: {nextra['license_number']}")
                    if parts: notary_extra = ' | ' + ' | '.join(parts)

            cur.execute("""
                INSERT INTO transactions
                    (user_id, upi, buyer_name, seller_name, agreed_price,
                    phone, note, status, reference, notary_name, notary_id,
                    buyer_id, seller_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending', %s, %s, %s, %s, %s)
                """, (
                    buyer_id_col, ag['upi'],
                    ag.get('buyer_name'), ag.get('seller_name'),
                    float(price),
                    '', f'Sent by notary{notary_extra}. District ref: {district_ref}',
                    ref, notary_name, notary_id_val,
                    buyer_id_col, seller_id_col   # ← ADD THESE
                ))

            # Mark agreement as mutated
            cur.execute("""
                UPDATE agreements SET is_mutated = TRUE WHERE id = %s
            """, (agreement_id,))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            'success':      True,
            'district_ref': district_ref,
            'doc_count':    len(docs),
            'message':      f'All {len(docs)} documents sent to district. Reference: {district_ref}',
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


# ── Notary stats (updated) ─────────────────────────────────
@app.route('/notary/stats', methods=['POST', 'OPTIONS'])
def notary_stats():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data      = request.get_json()
        notary_id = data.get('user_id')

        conn = get_db()
        cur  = conn.cursor()

        cur.execute("SELECT COUNT(*) AS cnt FROM notary_requests WHERE notary_id = %s AND status = 'pending'", (notary_id,))
        pending = cur.fetchone()['cnt']

        cur.execute("SELECT COUNT(*) AS cnt FROM notary_requests WHERE notary_id = %s AND status = 'appointment_set'", (notary_id,))
        appointment_set = cur.fetchone()['cnt']

        cur.execute("SELECT COUNT(*) AS cnt FROM notary_requests WHERE notary_id = %s AND status = 'stamped'", (notary_id,))
        stamped = cur.fetchone()['cnt']

        cur.execute("SELECT COUNT(*) AS cnt FROM notary_requests WHERE notary_id = %s AND (status = 'sent_to_district' OR status = 'sent_to_admin')", (notary_id,))
        sent = cur.fetchone()['cnt']

        cur.execute("SELECT COUNT(*) AS cnt FROM notary_requests WHERE notary_id = %s", (notary_id,))
        total = cur.fetchone()['cnt']

        # Legacy: approved/rejected from transactions
        cur.execute("SELECT COUNT(*) AS cnt FROM transactions WHERE status = 'approved'")
        approved = cur.fetchone()['cnt']

        cur.execute("SELECT COUNT(*) AS cnt FROM transactions WHERE status = 'rejected'")
        rejected = cur.fetchone()['cnt']

        cur.close()
        conn.close()

        return jsonify({
            'success': True,
            'stats': {
                'pending':         pending,
                'appointment_set': appointment_set,
                'stamped':         stamped,
                'sent':            sent,
                'total':           total,
                'approved':        approved,
                'rejected':        rejected,
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ── Get all notaries ───────────────────────────────────────
@app.route('/notaries/all', methods=['POST', 'OPTIONS'])
def notaries_all():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("""
            SELECT u.id, u.full_name, u.email, u.phone,
                   s.name AS sector,
                   COALESCE(u.notary_type, 'sector') AS notary_type,
                   COALESCE(u.sector_name, '') AS sector_name,
                   COALESCE(u.district_name, '') AS district_name,
                   COALESCE(u.license_number, '') AS license_number
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN sectors s ON u.sector_id = s.id
            WHERE r.name = 'notary' AND u.status = 'approved'
            ORDER BY u.full_name
        """)
        rows = cur.fetchall(); cur.close(); conn.close()
        return jsonify({'success': True, 'notaries': [dict(r) for r in rows]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ══════════════════════════════════════════════════════════════
# ALL EXISTING ROUTES (unchanged)
# ══════════════════════════════════════════════════════════════

@app.route('/history', methods=['POST', 'OPTIONS'])
def history():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data    = request.get_json()
        user_id = data.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'message': 'user_id is required'}), 400
        conn = get_db(); cur = conn.cursor()
        cur.execute("""
            SELECT id, upi, province, district, sector, cell, village,
                   area_m2, land_use, zoning,
                   min_price, avg_price, max_price,
                   min_per_sqm, avg_per_sqm, max_per_sqm,
                   tax_min, tax_avg, tax_max, created_at
            FROM prediction_history
            WHERE user_id = %s
            ORDER BY created_at DESC LIMIT 100
        """, (user_id,))
        rows = cur.fetchall(); cur.close(); conn.close()
        result = []
        for r in rows:
            row_dict = dict(r)
            if row_dict.get('created_at'):
                row_dict['created_at'] = row_dict['created_at'].isoformat()
            result.append(row_dict)
        return jsonify({'success': True, 'history': result})
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error: {str(e)}'}), 500


@app.route('/transaction', methods=['POST', 'OPTIONS'])
def transaction():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data         = request.get_json()
        user_id      = data.get('user_id')
        upi          = data.get('upi', '').strip()
        buyer_name   = data.get('buyer_name', '').strip()
        seller_name  = data.get('seller_name', '').strip()
        agreed_price = data.get('agreed_price')
        phone        = data.get('phone', '').strip()
        note         = data.get('note', '').strip()
        if not all([user_id, upi, buyer_name, seller_name, agreed_price, phone]):
            return jsonify({'success': False, 'message': 'All required fields must be filled'}), 400
        import random, string
        ref = 'TX-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
        conn = get_db(); cur = conn.cursor()
        cur.execute("""
            INSERT INTO transactions
                (user_id, upi, buyer_name, seller_name, agreed_price, phone, note, status, reference)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending', %s)
            RETURNING id
        """, (user_id, upi, buyer_name, seller_name, float(agreed_price), phone, note, ref))
        new_id = cur.fetchone()['id']
        conn.commit(); cur.close(); conn.close()
        return jsonify({'success': True, 'id': new_id, 'reference': ref, 'message': 'Transaction submitted successfully'})
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error: {str(e)}'}), 500


@app.route('/transactions/all', methods=['POST', 'OPTIONS'])
def transactions_all():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
        SELECT t.id, t.user_id, t.upi, t.buyer_name, t.seller_name,
            t.agreed_price, t.phone, t.note, t.status, t.reference, t.created_at,
            t.notary_name, t.notary_id, t.buyer_id, t.seller_id,
            COALESCE(u.notary_type, 'sector') AS notary_type
        FROM transactions t
        LEFT JOIN users u ON t.notary_id = u.id
        ORDER BY t.created_at DESC LIMIT 300
        """)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        result = []
        for r in rows:
            d = dict(r)
            if d.get('created_at'):
                d['created_at'] = d['created_at'].isoformat()
            # Ensure notary_name is never None
            if not d.get('notary_name'):
                d['notary_name'] = '—'
            result.append(d)
        return jsonify({'success': True, 'transactions': result})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/transactions/update', methods=['POST', 'OPTIONS'])
def transactions_update():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data   = request.get_json()
        tx_id  = data.get('transaction_id')
        status = data.get('status')
        if not tx_id or status not in ('approved', 'rejected'):
            return jsonify({'success': False, 'message': 'Invalid request'}), 400
        conn = get_db(); cur = conn.cursor()
        cur.execute("UPDATE transactions SET status=%s WHERE id=%s", (status, tx_id))
        conn.commit(); cur.close(); conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/transactions/mine', methods=['POST', 'OPTIONS'])
def transactions_mine():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'message': 'user_id required'}), 400
        conn = get_db(); cur = conn.cursor()
        cur.execute("""
            SELECT id, reference, upi, buyer_name, seller_name,
                   agreed_price, phone, note, status, created_at
            FROM transactions WHERE user_id = %s
            ORDER BY created_at DESC
        """, (user_id,))
        rows = cur.fetchall(); cur.close(); conn.close()
        result = []
        for r in rows:
            d = dict(r)
            if d.get('created_at'): d['created_at'] = d['created_at'].isoformat()
            result.append(d)
        return jsonify({'success': True, 'transactions': result})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/transactions/create', methods=['POST', 'OPTIONS'])
def transactions_create():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data         = request.get_json()
        upi          = data.get('upi', '').strip()
        buyer_id     = data.get('buyer_id')
        seller_id    = data.get('seller_id')
        buyer_name   = data.get('buyer_name', '')
        seller_name  = data.get('seller_name', '')
        agreed_price = data.get('agreed_price')
        phone        = data.get('phone', '')
        note         = data.get('note', '')
        if not upi or not agreed_price:
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400
        import random, string
        ref = 'MUT-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
        conn = get_db(); cur = conn.cursor()
        if buyer_id and not buyer_name:
            cur.execute("SELECT full_name FROM users WHERE id = %s", (buyer_id,))
            u = cur.fetchone()
            if u: buyer_name = u['full_name']
        if seller_id and not seller_name:
            cur.execute("SELECT full_name FROM users WHERE id = %s", (seller_id,))
            u = cur.fetchone()
            if u: seller_name = u['full_name']
        cur.execute("""
            INSERT INTO transactions
                (user_id, upi, buyer_name, seller_name, agreed_price, phone, note, status, reference)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending', %s) RETURNING id
        """, (buyer_id or seller_id, upi, buyer_name, seller_name, float(agreed_price), phone, note, ref))
        cur.execute("UPDATE agreements SET is_mutated = TRUE WHERE buyer_id = %s AND upi = %s", (buyer_id or seller_id, upi))
        new_id = cur.fetchone()['id']
        conn.commit(); cur.close(); conn.close()
        return jsonify({'success': True, 'id': new_id, 'reference': ref})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/sector/stats', methods=['POST', 'OPTIONS'])
def sector_stats():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json(); user_id = data.get('user_id')
        conn = get_db(); cur = conn.cursor()
        cur.execute("SELECT COUNT(*) AS cnt FROM land_parcels WHERE entered_by = %s", (user_id,))
        entered = cur.fetchone()['cnt']
        cur.execute("SELECT COUNT(*) AS cnt FROM land_parcels WHERE entered_by = %s AND verified = TRUE", (user_id,))
        verified = cur.fetchone()['cnt']
        cur.execute("SELECT COUNT(*) AS cnt FROM transactions WHERE status = 'pending'")
        pending = cur.fetchone()['cnt']
        cur.execute("SELECT COUNT(*) AS cnt FROM transactions WHERE status = 'approved'")
        approved = cur.fetchone()['cnt']
        cur.close(); conn.close()
        return jsonify({'success': True, 'stats': {'entered': entered, 'verified': verified, 'pending': pending, 'approved': approved}})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/sector/input', methods=['POST', 'OPTIONS'])
def sector_input():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        upi      = data.get('upi', '').strip()
        user_id  = data.get('user_id')
        area_m2  = data.get('area_m2')
        land_use = data.get('land_use', '').strip()

        for f in ['upi', 'area_m2', 'land_use']:
            if not data.get(f):
                return jsonify({'success': False, 'message': f'Missing field: {f}'}), 400

        owner_national_id = data.get('owner_national_id', '').strip() or None
        owner_name_val    = data.get('owner_name', '').strip() or None
        x_val  = float(data['x']) if data.get('x') else None
        y_val  = float(data['y']) if data.get('y') else None

        conn = get_db(); cur = conn.cursor()
        cur.execute("""
            INSERT INTO land_parcels
                (upi, owner_id, owner_national_id, owner_name,
                area_in_meter_square, land_use,
                zoning, zoning_percentage, sentlement, sentlement_percentage,
                x, y,
                minimum_value_per_sqm, weighted_average_value_per_sqm, maximum_value_per_sqm,
                verified, entered_by, created_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,TRUE,%s,NOW())
            ON CONFLICT (upi) DO UPDATE SET
                owner_id = EXCLUDED.owner_id,
                owner_national_id = EXCLUDED.owner_national_id,
                owner_name = EXCLUDED.owner_name,
                area_in_meter_square = EXCLUDED.area_in_meter_square,
                land_use = EXCLUDED.land_use,
                zoning = EXCLUDED.zoning,
                zoning_percentage = EXCLUDED.zoning_percentage,
                sentlement = EXCLUDED.sentlement,
                sentlement_percentage = EXCLUDED.sentlement_percentage,
                x = EXCLUDED.x,
                y = EXCLUDED.y,
                minimum_value_per_sqm = EXCLUDED.minimum_value_per_sqm,
                weighted_average_value_per_sqm = EXCLUDED.weighted_average_value_per_sqm,
                maximum_value_per_sqm = EXCLUDED.maximum_value_per_sqm
            RETURNING id
        """, (
            upi, user_id or None, owner_national_id, owner_name_val,
            float(area_m2), land_use,
            data.get('zoning') or None,
            float(data['zoning_percentage']) if data.get('zoning_percentage') else None,
            data.get('sentlement') or None,
            float(data['sentlement_percentage']) if data.get('sentlement_percentage') else None,
            x_val, y_val,
            float(data['minimum_value_per_sqm']) if data.get('minimum_value_per_sqm') else None,
            float(data['weighted_average_value_per_sqm']) if data.get('weighted_average_value_per_sqm') else None,
            float(data['maximum_value_per_sqm']) if data.get('maximum_value_per_sqm') else None,
            user_id,
        ))
        conn.commit(); cur.close(); conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/sector/verify', methods=['POST', 'OPTIONS'])
def sector_verify():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        d = request.get_json(); upi = d.get('upi')
        if not upi:
            return jsonify({'success': False, 'message': 'UPI is required'}), 400
        conn = get_db(); cur = conn.cursor()
        cur.execute("UPDATE land_parcels SET verified = TRUE, verified_by = %s, verified_at = NOW() WHERE upi = %s", (d.get('user_id'), upi))
        conn.commit(); cur.close(); conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ══════════════════════════════════════════════════════════════
# SECTOR REPORT ENDPOINTS
# ══════════════════════════════════════════════════════════════
 
@app.route('/sector/report/check', methods=['POST', 'OPTIONS'])
def sector_report_check():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        user_id    = data.get('user_id')
        start_date = data.get('start_date')
        end_date   = data.get('end_date')
 
        if not all([user_id, start_date, end_date]):
            return jsonify({'success': False, 'message': 'user_id, start_date, end_date required'}), 400
 
        conn = get_db(); cur = conn.cursor()
        cur.execute("""
            SELECT reference, content, generated_at
            FROM reports
            WHERE from_user_id = %s
              AND from_role = 'sector_land_officer'
              AND DATE(generated_at) >= %s
              AND DATE(generated_at) <= %s
            ORDER BY generated_at DESC
            LIMIT 1
        """, (user_id, start_date, end_date))
        existing = cur.fetchone()
        cur.close(); conn.close()
 
        if existing:
            return jsonify({
                'success': True, 'exists': True,
                'existing_report': {
                    'reference':     existing['reference'],
                    'content':       existing['content'],
                    'generated_at':  existing['generated_at'].isoformat() if existing['generated_at'] else None,
                }
            })
        return jsonify({'success': True, 'exists': False})
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/sector/report', methods=['POST', 'OPTIONS'])
def sector_report():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        user_id    = data.get('user_id')
        start_date = data.get('start_date')
        end_date   = data.get('end_date')
 
        if not all([user_id, start_date, end_date]):
            return jsonify({'success': False, 'message': 'user_id, start_date, end_date required'}), 400
 
        reference = 'RPT-SECTOR-' + uuid.uuid4().hex[:8].upper()
        conn = get_db(); cur = conn.cursor()
 
        # ── Parcels entered in date range ──
        cur.execute("""
            SELECT COUNT(*) AS cnt FROM land_parcels
            WHERE entered_by = %s
              AND DATE(created_at) >= %s AND DATE(created_at) <= %s
        """, (user_id, start_date, end_date))
        entered = cur.fetchone()['cnt']
 
        # ── Parcels verified in date range ──
        cur.execute("""
            SELECT COUNT(*) AS cnt FROM land_parcels
            WHERE entered_by = %s AND verified = TRUE
              AND DATE(verified_at) >= %s AND DATE(verified_at) <= %s
        """, (user_id, start_date, end_date))
        verified = cur.fetchone()['cnt']
 
        # ── All parcels previously entered (cumulative) ──
        cur.execute("""
            SELECT COUNT(*) AS cnt FROM land_parcels WHERE entered_by = %s
        """, (user_id,))
        total_parcels = cur.fetchone()['cnt']
 
        # ── Mutations in date range (sector sees all) ──
        cur.execute("""
            SELECT COUNT(*) AS cnt FROM transactions
            WHERE DATE(created_at) >= %s AND DATE(created_at) <= %s
        """, (start_date, end_date))
        mutations = cur.fetchone()['cnt']
 
        cur.execute("""
            SELECT COUNT(*) AS cnt FROM transactions
            WHERE status = 'approved'
              AND DATE(created_at) >= %s AND DATE(created_at) <= %s
        """, (start_date, end_date))
        approved_mutations = cur.fetchone()['cnt']
 
        cur.execute("""
            SELECT COUNT(*) AS cnt FROM transactions
            WHERE status = 'pending'
              AND DATE(created_at) >= %s AND DATE(created_at) <= %s
        """, (start_date, end_date))
        pending_mutations = cur.fetchone()['cnt']
 
        # ── Unverified parcels at end of period ──
        cur.execute("""
            SELECT COUNT(*) AS cnt FROM land_parcels
            WHERE entered_by = %s AND (verified = FALSE OR verified IS NULL)
        """, (user_id,))
        unverified = cur.fetchone()['cnt']
 
        # ── Get officer info ──
        cur.execute("""
            SELECT full_name, sector_name FROM users WHERE id = %s
        """, (user_id,))
        officer = cur.fetchone()
        officer_name    = officer['full_name']    if officer else 'Unknown'
        officer_sector  = officer['sector_name']  if officer else 'Unknown'
 
        content = '\n'.join([
            f"SECTOR LAND OFFICER — COMPREHENSIVE REPORT",
            f"==========================================",
            f"Reference   : {reference}",
            f"Officer     : {officer_name}",
            f"Sector      : {officer_sector}",
            f"Date Range  : {start_date}  to  {end_date}",
            f"Generated   : {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            f"",
            f"──────────────────────────────────────────",
            f"LAND PARCELS (activities in date range)",
            f"──────────────────────────────────────────",
            f"Parcels Entered (this period)  : {entered}",
            f"Parcels Verified (this period) : {verified}",
            f"Total Parcels On Record        : {total_parcels}",
            f"Currently Unverified           : {unverified}",
            f"",
            f"──────────────────────────────────────────",
            f"MUTATIONS (in date range)",
            f"──────────────────────────────────────────",
            f"Total Mutations  : {mutations}",
            f"Approved         : {approved_mutations}",
            f"Pending          : {pending_mutations}",
            f"Rejected         : {mutations - approved_mutations - pending_mutations}",
            f"",
            f"──────────────────────────────────────────",
            f"END OF REPORT",
        ])
 
        cur.execute("""
            INSERT INTO reports
                (reference, from_user_id, from_role, to_role, type, content, sent_at, read, generated_at)
            VALUES (%s, %s, 'sector_land_officer', 'district_land_officer', 'full', %s, NOW(), FALSE, NOW())
        """, (reference, user_id, content))
        conn.commit(); cur.close(); conn.close()
 
        return jsonify({'success': True, 'reference': reference, 'content': content})
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/sector/report/send', methods=['POST', 'OPTIONS'])
def sector_report_send():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        report_ref = data.get('report_ref')
        conn = get_db(); cur = conn.cursor()
        cur.execute("SELECT * FROM reports WHERE reference = %s", (report_ref,))
        original = cur.fetchone()
        if not original:
            cur.close(); conn.close()
            return jsonify({'success': False, 'message': 'Report not found'}), 404
        new_reference = 'RPT-DISTRICT-' + uuid.uuid4().hex[:8].upper()
        # Get the sector officer's district_id
        cur.execute("""
        SELECT u.district_id FROM users u WHERE u.id = %s
        """, (original['from_user_id'],))
        sector_user = cur.fetchone()
        district_id = sector_user['district_id'] if sector_user else None

        cur.execute("""
        INSERT INTO reports (reference, from_user_id, from_role, to_role, type, content, sent_at, read, forwarded_from, district_id)
        VALUES (%s, %s, %s, 'district_land_officer', %s, %s, NOW(), FALSE, %s, %s)
        """, (new_reference, original['from_user_id'], original['from_role'], original['type'], original['content'], original['reference'], district_id))
        conn.commit(); cur.close(); conn.close()
        return jsonify({'success': True, 'new_reference': new_reference})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/district/stats', methods=['POST', 'OPTIONS'])
def district_stats():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        conn = get_db(); cur = conn.cursor()
        
        # Get district of the logged-in district officer
        cur.execute("SELECT district_id FROM users WHERE id=%s", (user_id,))
        user_result = cur.fetchone()
        district_id = user_result['district_id'] if user_result else None
        
        # Count sector officers in the same district
        if district_id:
            cur.execute("""
                SELECT COUNT(*) AS cnt 
                FROM users u 
                JOIN roles r ON u.role_id=r.id 
                LEFT JOIN sectors s ON u.sector_id=s.id 
                WHERE r.name='sector_land_officer' AND s.district_id=%s
            """, (district_id,))
            officers_count = cur.fetchone()['cnt']
            
            # Also count sector notaries in the same district
            cur.execute("""
                SELECT COUNT(*) AS cnt 
                FROM users u 
                JOIN roles r ON u.role_id=r.id 
                LEFT JOIN sectors s ON u.sector_id=s.id 
                WHERE r.name='notary' AND u.notary_type='sector' AND s.district_id=%s
            """, (district_id,))
            sector_notaries_count = cur.fetchone()['cnt']
            
            officers = officers_count + sector_notaries_count
        else:
            cur.execute("SELECT COUNT(*) AS cnt FROM users u JOIN roles r ON u.role_id=r.id WHERE r.name='sector_land_officer'")
            officers_count = cur.fetchone()['cnt']
            
            cur.execute("SELECT COUNT(*) AS cnt FROM users u JOIN roles r ON u.role_id=r.id WHERE r.name='notary' AND u.notary_type='sector'")
            sector_notaries_count = cur.fetchone()['cnt']
            
            officers = officers_count + sector_notaries_count
        cur.execute("SELECT COUNT(*) AS cnt FROM land_parcels")
        parcels = cur.fetchone()['cnt']
        cur.execute("SELECT COUNT(*) AS cnt FROM transactions")
        mutations = cur.fetchone()['cnt']
        cur.execute("SELECT COUNT(*) AS cnt FROM reports WHERE from_role='district_land_officer'")
        reports = cur.fetchone()['cnt']
        cur.execute("SELECT COUNT(*) AS cnt FROM land_parcels WHERE verified = FALSE")
        pending = cur.fetchone()['cnt']
        cur.close(); conn.close()
        return jsonify({'success': True, 'stats': {'officers': officers, 'parcels': parcels, 'mutations': mutations, 'reports': reports, 'pending': pending}})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/district/officers', methods=['POST', 'OPTIONS'])
def district_officers():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        conn = get_db(); cur = conn.cursor()
        
        # Get district of the logged-in district officer
        cur.execute("SELECT district_id FROM users WHERE id=%s", (user_id,))
        user_result = cur.fetchone()
        district_id = user_result['district_id'] if user_result else None
        
        # Get sector officers in the same district
        if district_id:
            cur.execute("""
                SELECT u.id, u.full_name, u.email, u.status, u.created_at, u.suspend_reason, s.name AS sector
                FROM users u 
                JOIN roles r ON u.role_id=r.id 
                LEFT JOIN sectors s ON u.sector_id=s.id 
                WHERE r.name='sector_land_officer' AND s.district_id=%s
                ORDER BY u.full_name
            """, (district_id,))
        else:
            cur.execute("""
                SELECT u.id, u.full_name, u.email, u.status, u.created_at, u.suspend_reason, s.name AS sector
                FROM users u JOIN roles r ON u.role_id=r.id LEFT JOIN sectors s ON u.sector_id=s.id
                WHERE r.name='sector_land_officer' ORDER BY u.full_name
            """)
        rows = cur.fetchall(); cur.close(); conn.close()
        result = []
        for r in rows:
            d = dict(r)
            if d.get('created_at'): d['created_at'] = d['created_at'].isoformat()
            result.append(d)
        return jsonify({'success': True, 'officers': result})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/district/officers/update', methods=['POST', 'OPTIONS'])
def district_officers_update():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        officer_id = data.get('officer_id'); status = data.get('status'); reason = data.get('reason', '')
        if not officer_id or status not in ('approved', 'suspended', 'rejected'):
            return jsonify({'success': False, 'message': 'Invalid request'}), 400
        conn = get_db(); cur = conn.cursor()
        cur.execute("UPDATE users SET status=%s, suspend_reason=%s WHERE id=%s", (status, reason if status == 'suspended' else None, officer_id))
        conn.commit(); cur.close(); conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ══════════════════════════════════════════════════════════════
# DISTRICT REPORT ENDPOINTS
# ══════════════════════════════════════════════════════════════
 
@app.route('/district/report/check', methods=['POST', 'OPTIONS'])
def district_report_check():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        user_id    = data.get('user_id')
        start_date = data.get('start_date')
        end_date   = data.get('end_date')
 
        if not all([user_id, start_date, end_date]):
            return jsonify({'success': False, 'message': 'user_id, start_date, end_date required'}), 400
 
        conn = get_db(); cur = conn.cursor()
        cur.execute("""
            SELECT reference, content, generated_at
            FROM reports
            WHERE from_user_id = %s
              AND from_role = 'district_land_officer'
              AND DATE(generated_at) >= %s
              AND DATE(generated_at) <= %s
            ORDER BY generated_at DESC
            LIMIT 1
        """, (user_id, start_date, end_date))
        existing = cur.fetchone()
        cur.close(); conn.close()
 
        if existing:
            return jsonify({
                'success': True, 'exists': True,
                'existing_report': {
                    'reference':    existing['reference'],
                    'content':      existing['content'],
                    'generated_at': existing['generated_at'].isoformat() if existing['generated_at'] else None,
                }
            })
        return jsonify({'success': True, 'exists': False})
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/district/report', methods=['POST', 'OPTIONS'])
def district_report():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        user_id    = data.get('user_id')
        start_date = data.get('start_date')
        end_date   = data.get('end_date')
 
        if not all([user_id, start_date, end_date]):
            return jsonify({'success': False, 'message': 'user_id, start_date, end_date required'}), 400
 
        reference = 'RPT-DIST-' + uuid.uuid4().hex[:8].upper()
        conn = get_db(); cur = conn.cursor()
 
        # Get officer's district
        cur.execute("""
            SELECT u.id, u.full_name, u.district_id, u.province_id, d.name AS district_name
            FROM users u
            LEFT JOIN districts d ON u.district_id = d.id
            WHERE u.id = %s
        """, (user_id,))
        officer = cur.fetchone()
        if not officer:
            cur.close(); conn.close()
            return jsonify({'success': False, 'message': 'Officer not found'}), 404
 
        district_id   = officer['district_id']
        province_id   = officer['province_id']
        officer_name  = officer['full_name']
        district_name = officer['district_name'] or 'Unknown'
 
        # ── Parcels in district, date range ──
        if district_id:
            cur.execute("""
                SELECT COUNT(*) AS cnt FROM land_parcels
                WHERE district_id = %s AND DATE(created_at) >= %s AND DATE(created_at) <= %s
            """, (district_id, start_date, end_date))
        else:
            cur.execute("""
                SELECT COUNT(*) AS cnt FROM land_parcels
                WHERE DATE(created_at) >= %s AND DATE(created_at) <= %s
            """, (start_date, end_date))
        parcels = cur.fetchone()['cnt']
 
        if district_id:
            cur.execute("""
                SELECT COUNT(*) AS cnt FROM land_parcels
                WHERE district_id = %s AND verified = TRUE
                  AND DATE(verified_at) >= %s AND DATE(verified_at) <= %s
            """, (district_id, start_date, end_date))
        else:
            cur.execute("""
                SELECT COUNT(*) AS cnt FROM land_parcels
                WHERE verified = TRUE AND DATE(verified_at) >= %s AND DATE(verified_at) <= %s
            """, (start_date, end_date))
        verified_parcels = cur.fetchone()['cnt']
 
        # ── Unverified cumulative ──
        if district_id:
            cur.execute("""
                SELECT COUNT(*) AS cnt FROM land_parcels
                WHERE district_id = %s AND (verified = FALSE OR verified IS NULL)
            """, (district_id,))
        else:
            cur.execute("SELECT COUNT(*) AS cnt FROM land_parcels WHERE (verified = FALSE OR verified IS NULL)")
        unverified_parcels = cur.fetchone()['cnt']
 
        # ── Sector officers in district ──
        if district_id:
            cur.execute("""
                SELECT COUNT(*) AS cnt
                FROM users u
                JOIN roles r ON u.role_id = r.id
                LEFT JOIN sectors s ON u.sector_id = s.id
                WHERE r.name = 'sector_land_officer' AND s.district_id = %s
            """, (district_id,))
        else:
            cur.execute("""
                SELECT COUNT(*) AS cnt FROM users u
                JOIN roles r ON u.role_id = r.id WHERE r.name = 'sector_land_officer'
            """)
        total_officers = cur.fetchone()['cnt']
 
        if district_id:
            cur.execute("""
                SELECT COUNT(*) AS cnt
                FROM users u JOIN roles r ON u.role_id = r.id
                LEFT JOIN sectors s ON u.sector_id = s.id
                WHERE r.name = 'sector_land_officer' AND s.district_id = %s AND u.status = 'approved'
            """, (district_id,))
        else:
            cur.execute("""
                SELECT COUNT(*) AS cnt FROM users u JOIN roles r ON u.role_id = r.id
                WHERE r.name = 'sector_land_officer' AND u.status = 'approved'
            """)
        active_officers = cur.fetchone()['cnt']
 
        # ── New officers registered in date range ──
        if district_id:
            cur.execute("""
                SELECT COUNT(*) AS cnt
                FROM users u JOIN roles r ON u.role_id = r.id
                LEFT JOIN sectors s ON u.sector_id = s.id
                WHERE r.name = 'sector_land_officer' AND s.district_id = %s
                  AND DATE(u.created_at) >= %s AND DATE(u.created_at) <= %s
            """, (district_id, start_date, end_date))
        else:
            cur.execute("""
                SELECT COUNT(*) AS cnt FROM users u JOIN roles r ON u.role_id = r.id
                WHERE r.name = 'sector_land_officer'
                  AND DATE(u.created_at) >= %s AND DATE(u.created_at) <= %s
            """, (start_date, end_date))
        new_officers = cur.fetchone()['cnt']
 
        # ── Mutations ──
        cur.execute("""
            SELECT COUNT(*) AS cnt FROM transactions
            WHERE DATE(created_at) >= %s AND DATE(created_at) <= %s
        """, (start_date, end_date))
        mutations = cur.fetchone()['cnt']
 
        cur.execute("""
            SELECT COUNT(*) AS cnt FROM transactions
            WHERE status = 'approved' AND DATE(created_at) >= %s AND DATE(created_at) <= %s
        """, (start_date, end_date))
        approved_mutations = cur.fetchone()['cnt']
 
        cur.execute("""
            SELECT COUNT(*) AS cnt FROM transactions
            WHERE status = 'pending' AND DATE(created_at) >= %s AND DATE(created_at) <= %s
        """, (start_date, end_date))
        pending_mutations = cur.fetchone()['cnt']
 
        # ── Stamped records in date range ──
        cur.execute("""
            SELECT COUNT(*) AS cnt FROM stamped_parcel_records
            WHERE DATE(stamped_at) >= %s AND DATE(stamped_at) <= %s
        """, (start_date, end_date))
        stamped = cur.fetchone()['cnt']
 
        content = '\n'.join([
            f"DISTRICT LAND OFFICER — COMPREHENSIVE REPORT",
            f"============================================",
            f"Reference   : {reference}",
            f"Officer     : {officer_name}",
            f"District    : {district_name}",
            f"Date Range  : {start_date}  to  {end_date}",
            f"Generated   : {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            f"",
            f"──────────────────────────────────────────",
            f"LAND PARCELS (activities in date range)",
            f"──────────────────────────────────────────",
            f"Parcels Registered (this period) : {parcels}",
            f"Parcels Verified (this period)   : {verified_parcels}",
            f"Currently Unverified (all time)  : {unverified_parcels}",
            f"",
            f"──────────────────────────────────────────",
            f"SECTOR OFFICERS",
            f"──────────────────────────────────────────",
            f"Total Officers in District  : {total_officers}",
            f"Active Officers             : {active_officers}",
            f"New Officers (this period)  : {new_officers}",
            f"Suspended Officers          : {total_officers - active_officers}",
            f"",
            f"──────────────────────────────────────────",
            f"MUTATIONS (in date range)",
            f"──────────────────────────────────────────",
            f"Total Mutations  : {mutations}",
            f"Approved         : {approved_mutations}",
            f"Pending          : {pending_mutations}",
            f"Rejected         : {max(0, mutations - approved_mutations - pending_mutations)}",
            f"",
            f"──────────────────────────────────────────",
            f"STAMPED RECORDS (in date range)",
            f"──────────────────────────────────────────",
            f"Notarized & Stamped Deeds : {stamped}",
            f"",
            f"──────────────────────────────────────────",
            f"END OF REPORT",
        ])
 
        cur.execute("""
            INSERT INTO reports
                (reference, from_user_id, from_role, to_role, type, content,
                 sent_at, read, district_id, province_id, generated_at)
            VALUES (%s, %s, 'district_land_officer', 'district_land_officer', 'full',
                    %s, NOW(), FALSE, %s, %s, NOW())
        """, (reference, user_id, content, district_id, province_id))
        conn.commit(); cur.close(); conn.close()
 
        return jsonify({'success': True, 'reference': reference, 'content': content})
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/district/reports/delete', methods=['POST', 'OPTIONS'])
def district_delete_report():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        report_id = data.get('report_id')
        if not report_id:
            return jsonify({'success': False, 'message': 'Report ID required'}), 400
        
        conn = get_db(); cur = conn.cursor()
        # Delete the report
        cur.execute("DELETE FROM reports WHERE id = %s", (report_id,))
        conn.commit()
        cur.close(); conn.close()
        return jsonify({'success': True, 'message': 'Report deleted successfully'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/district/reports/delete-all', methods=['POST', 'OPTIONS'])
def district_delete_all_reports():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        user_id = data.get('user_id') if data else None
        
        if not user_id:
            return jsonify({'success': False, 'message': 'User ID required'}), 400
        
        conn = get_db(); cur = conn.cursor()
        
        # Get district of the district officer
        cur.execute("SELECT district_id FROM users WHERE id=%s", (user_id,))
        user_result = cur.fetchone()
        district_id = user_result['district_id'] if user_result else None
        
        if district_id:
            # Delete all reports for this district (both assigned and forwarded)
            cur.execute("DELETE FROM reports WHERE district_id = %s", (district_id,))
            # Also delete any reports sent TO this district officer that might not have district_id set
            cur.execute("DELETE FROM reports WHERE to_role = 'district_land_officer' AND from_user_id = %s", (user_id,))
        else:
            # Delete all reports (fallback)
            cur.execute("DELETE FROM reports")
            
        conn.commit()
        cur.close(); conn.close()
        return jsonify({'success': True, 'message': 'All reports deleted successfully'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/district/report/forward', methods=['POST', 'OPTIONS'])
def district_report_forward():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data       = request.get_json()
        report_ref = data.get('report_ref')
        user_id    = data.get('user_id')
 
        conn = get_db(); cur = conn.cursor()
        cur.execute("SELECT * FROM reports WHERE reference = %s", (report_ref,))
        original = cur.fetchone()
        if not original:
            cur.close(); conn.close()
            return jsonify({'success': False, 'message': 'Report not found'}), 404
 
        new_ref = 'RPT-ADMIN-' + uuid.uuid4().hex[:8].upper()
        cur.execute("""
            INSERT INTO reports
                (reference, from_user_id, from_role, to_role, type, content,
                 sent_at, read, forwarded_from, district_id, province_id, generated_at)
            VALUES (%s, %s, %s, 'admin', %s, %s, NOW(), FALSE, %s, %s, %s, NOW())
        """, (
            new_ref,
            original['from_user_id'],
            original['from_role'],
            original['type'],
            original['content'],
            original['reference'],
            original.get('district_id'),
            original.get('province_id'),
        ))
        conn.commit(); cur.close(); conn.close()
 
        return jsonify({'success': True, 'new_reference': new_ref})
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/district/inbox', methods=['POST', 'OPTIONS'])
def district_inbox():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json(); user_id = data.get('user_id')
        conn = get_db(); cur = conn.cursor()
        cur.execute("SELECT district_id FROM users WHERE id = %s", (user_id,))
        user = cur.fetchone()
        if not user:
            cur.close(); conn.close()
            return jsonify({'success': False, 'message': 'User not found'}), 404
        cur.execute("""
            SELECT r.id, r.reference, r.from_user_id, r.from_role, r.to_role,
                   r.type, r.content, r.sent_at, r.read, r.forwarded_from, u.full_name AS from_name
            FROM reports r JOIN users u ON r.from_user_id = u.id
            WHERE r.to_role = 'district_land_officer' AND r.district_id = %s
            ORDER BY r.sent_at DESC LIMIT 100
        """, (user['district_id'],))
        rows = cur.fetchall(); cur.close(); conn.close()
        result = []
        for r in rows:
            d = dict(r)
            if d.get('sent_at'): d['sent_at'] = d['sent_at'].isoformat()
            result.append(d)
        return jsonify({'success': True, 'reports': result})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/district/inbox/read', methods=['POST', 'OPTIONS'])
def district_inbox_read():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json(); report_id = data.get('report_id')
        conn = get_db(); cur = conn.cursor()
        cur.execute("UPDATE reports SET read = TRUE WHERE id = %s", (report_id,))
        conn.commit(); cur.close(); conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/admin/stats', methods=['POST', 'OPTIONS'])
def admin_stats():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("SELECT COUNT(*) AS cnt FROM users")
        total = cur.fetchone()['cnt']
        cur.execute("SELECT COUNT(*) AS cnt FROM users u JOIN roles r ON u.role_id=r.id WHERE r.name='district_land_officer'")
        district = cur.fetchone()['cnt']
        cur.execute("SELECT COUNT(*) AS cnt FROM users u JOIN roles r ON u.role_id=r.id WHERE r.name='sector_land_officer'")
        sector = cur.fetchone()['cnt']
        cur.execute("SELECT COUNT(*) AS cnt FROM users WHERE status='pending'")
        pending = cur.fetchone()['cnt']
        cur.execute("SELECT COUNT(*) AS cnt FROM users u JOIN roles r ON u.role_id=r.id WHERE r.name='notary'")
        notary_total = cur.fetchone()['cnt']
        cur.execute("SELECT COUNT(*) AS cnt FROM users u JOIN roles r ON u.role_id=r.id WHERE r.name='notary' AND COALESCE(u.notary_type,'sector')='sector'")
        notary_sector = cur.fetchone()['cnt']
        cur.execute("SELECT COUNT(*) AS cnt FROM users u JOIN roles r ON u.role_id=r.id WHERE r.name='notary' AND u.notary_type='private'")
        notary_private = cur.fetchone()['cnt']
        cur.execute("SELECT COUNT(*) AS cnt FROM users u JOIN roles r ON u.role_id=r.id WHERE r.name='buyer_seller'")
        buyers = cur.fetchone()['cnt']
        cur.execute("SELECT COUNT(*) AS cnt FROM transactions")
        txs = cur.fetchone()['cnt']
        cur.execute("SELECT COUNT(*) AS cnt FROM stamped_parcel_records")
        stamped_records = cur.fetchone()['cnt']
        cur.close(); conn.close()
        return jsonify({'success': True, 'stats': {
            'total': total, 'district': district, 'sector': sector, 'pending': pending,
            'notary': notary_total, 'notary_sector': notary_sector, 'notary_private': notary_private,
            'buyers': buyers, 'txs': txs, 'stamped_records': stamped_records,
        }})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/admin/users', methods=['POST', 'OPTIONS'])
def admin_users():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("""
            SELECT u.id, u.full_name, u.email, u.status, u.created_at,
                   r.name AS role,
                   COALESCE(u.notary_type, '') AS notary_type,
                   COALESCE(u.national_id, '') AS national_id
            FROM users u JOIN roles r ON u.role_id=r.id ORDER BY u.created_at DESC
        """)
        rows = cur.fetchall(); cur.close(); conn.close()
        result = []
        for r in rows:
            d = dict(r)
            if d.get('created_at'): d['created_at'] = d['created_at'].isoformat()
            result.append(d)
        return jsonify({'success': True, 'users': result})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/admin/users/by-role', methods=['POST', 'OPTIONS'])
def admin_users_by_role():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        role         = data.get('role')
        notary_type  = data.get('notary_type')   # optional: 'sector' or 'private'
        conn = get_db(); cur = conn.cursor()

        if role == 'notary' and notary_type:
            if notary_type == 'sector':
                cur.execute("""
                    SELECT u.id, u.full_name, u.email, u.status, u.created_at,
                           COALESCE(u.notary_type,'sector') AS notary_type,
                           COALESCE(u.sector_name,'') AS sector_name,
                           COALESCE(u.district_name,'') AS district_name,
                           COALESCE(u.license_number,'') AS license_number
                    FROM users u JOIN roles r ON u.role_id=r.id
                    WHERE r.name='notary'
                      AND COALESCE(u.notary_type,'sector') = 'sector'
                    ORDER BY u.status DESC, u.created_at DESC
                """)
            else:
                cur.execute("""
                    SELECT u.id, u.full_name, u.email, u.status, u.created_at,
                           u.notary_type,
                           COALESCE(u.sector_name,'') AS sector_name,
                           COALESCE(u.district_name,'') AS district_name,
                           COALESCE(u.license_number,'') AS license_number
                    FROM users u JOIN roles r ON u.role_id=r.id
                    WHERE r.name='notary' AND u.notary_type = %s
                    ORDER BY u.status DESC, u.created_at DESC
                """, (notary_type,))
        else:
            cur.execute("""
                SELECT u.id, u.full_name, u.email, u.status, u.created_at,
                       COALESCE(u.notary_type, '') AS notary_type,
                       COALESCE(u.district_name,'') AS district_name,
                       COALESCE(u.sector_name,'') AS sector_name,
                       COALESCE(u.license_number,'') AS license_number
                FROM users u JOIN roles r ON u.role_id=r.id
                WHERE r.name=%s ORDER BY u.status DESC, u.created_at DESC
            """, (role,))
        rows = cur.fetchall(); cur.close(); conn.close()
        result = []
        for r in rows:
            d = dict(r)
            if d.get('created_at'): d['created_at'] = d['created_at'].isoformat()
            result.append(d)
        return jsonify({'success': True, 'users': result})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/admin/users/update', methods=['POST', 'OPTIONS'])
def admin_users_update():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json(); user_id = data.get('user_id'); status = data.get('status')
        if not user_id or status not in ('approved', 'suspended', 'rejected'):
            return jsonify({'success': False, 'message': 'Invalid request'}), 400
        conn = get_db(); cur = conn.cursor()
        cur.execute("UPDATE users SET status=%s WHERE id=%s", (status, user_id))
        conn.commit(); cur.close(); conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/admin/users/edit', methods=['POST', 'OPTIONS'])
def admin_users_edit():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json(); user_id = data.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'message': 'user_id required'}), 400
        conn = get_db(); cur = conn.cursor()
        updates = []; params = []
        if data.get('full_name'): updates.append("full_name=%s"); params.append(data['full_name'])
        if data.get('email'):     updates.append("email=%s");     params.append(data['email'])
        if data.get('phone') is not None: updates.append("phone=%s"); params.append(data['phone'])
        if updates:
            params.append(user_id)
            cur.execute(f"UPDATE users SET {', '.join(updates)} WHERE id=%s", params)
            conn.commit()
        cur.close(); conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/admin/users/delete', methods=['POST', 'OPTIONS'])
def admin_users_delete():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json(); user_id = data.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'message': 'user_id required'}), 400
        conn = get_db(); cur = conn.cursor()
        cur.execute("SELECT role_id FROM users WHERE id=%s", (user_id,))
        user = cur.fetchone()
        if user:
            cur.execute("SELECT name FROM roles WHERE id=%s", (user['role_id'],))
            role = cur.fetchone()
            if role and role['name'] == 'system_admin':
                cur.execute("SELECT COUNT(*) as cnt FROM users u JOIN roles r ON u.role_id=r.id WHERE r.name='system_admin'")
                if cur.fetchone()['cnt'] <= 1:
                    cur.close(); conn.close()
                    return jsonify({'success': False, 'message': 'Cannot delete the last admin account'}), 400
        cur.execute("DELETE FROM users WHERE id=%s", (user_id,))
        conn.commit()
        deleted = cur.rowcount > 0
        cur.close(); conn.close()
        return jsonify({'success': True if deleted else False, 'message': 'User deleted' if deleted else 'Not found'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/admin/stamped-records', methods=['POST', 'OPTIONS'])
def admin_stamped_records():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("""
            SELECT * FROM stamped_parcel_records
            ORDER BY stamped_at DESC LIMIT 300
        """)
        rows = cur.fetchall(); cur.close(); conn.close()
        result = []
        for r in rows:
            d = dict(r)
            for col in ['stamped_at', 'created_at']:
                if d.get(col): d[col] = d[col].isoformat()
            if d.get('signed_date'): d['signed_date'] = str(d['signed_date'])
            result.append(d)
        return jsonify({'success': True, 'records': result})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/admin/stamped-records/delete', methods=['POST', 'OPTIONS'])
def admin_stamped_records_delete():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json(); record_id = data.get('record_id')
        if not record_id:
            return jsonify({'success': False, 'message': 'record_id required'}), 400
        conn = get_db(); cur = conn.cursor()
        cur.execute("DELETE FROM stamped_parcel_records WHERE id = %s", (record_id,))
        conn.commit(); deleted = cur.rowcount > 0
        cur.close(); conn.close()
        return jsonify({'success': deleted, 'message': 'Deleted' if deleted else 'Not found'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/admin/stamped-records/edit', methods=['POST', 'OPTIONS'])
def admin_stamped_records_edit():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        record_id    = data.get('record_id')
        cert_number  = data.get('cert_number')
        signed_date  = data.get('signed_date') or None
        agreed_price = data.get('agreed_price')
        notes        = data.get('notes')
        if not record_id:
            return jsonify({'success': False, 'message': 'record_id required'}), 400
        # Recalculate tax if agreed_price changed
        tax = None
        if agreed_price:
            price = float(agreed_price)
            tax = (price - 5_000_000) * 0.025 if price > 5_000_000 else 0.0
        conn = get_db(); cur = conn.cursor()
        updates = []; params = []
        if cert_number  is not None: updates.append("cert_number = %s");       params.append(cert_number)
        if signed_date  is not None: updates.append("signed_date = %s");       params.append(signed_date)
        if agreed_price is not None: updates.append("agreed_price = %s");      params.append(float(agreed_price))
        if tax          is not None: updates.append("capital_gains_tax = %s"); params.append(tax)
        if notes        is not None: updates.append("notes = %s");             params.append(notes)
        if updates:
            params.append(record_id)
            cur.execute(f"UPDATE stamped_parcel_records SET {', '.join(updates)} WHERE id = %s", params)
            conn.commit()
        cur.close(); conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/admin/inbox', methods=['POST', 'OPTIONS'])
def admin_inbox():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("""
            SELECT r.id, r.reference, r.from_user_id, r.from_role, r.to_role,
                   r.type, r.content, r.sent_at, r.read, r.forwarded_from,
                   u.full_name AS from_name, d.name AS district_name
            FROM reports r JOIN users u ON r.from_user_id=u.id
            LEFT JOIN districts d ON r.district_id=d.id
            WHERE r.to_role='admin' ORDER BY r.sent_at DESC LIMIT 100
        """)
        rows = cur.fetchall(); cur.close(); conn.close()
        result = []
        for r in rows:
            d = dict(r)
            if d.get('sent_at'): d['sent_at'] = d['sent_at'].isoformat()
            if d.get('district_name'): d['from_name'] = f"{d['from_name']} ({d['district_name']})"
            result.append(d)
        return jsonify({'success': True, 'reports': result})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/admin/inbox/read', methods=['POST', 'OPTIONS'])
def admin_inbox_read():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json(); report_id = data.get('report_id')
        conn = get_db(); cur = conn.cursor()
        cur.execute("UPDATE reports SET read=TRUE WHERE id=%s", (report_id,))
        conn.commit(); cur.close(); conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/admin/suggestions/delete', methods=['POST', 'OPTIONS'])
def admin_suggestions_delete():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json(); suggestion_id = data.get('suggestion_id')
        conn = get_db(); cur = conn.cursor()
        cur.execute("DELETE FROM suggestions WHERE id=%s", (suggestion_id,))
        conn.commit(); cur.close(); conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/admin/suggestions/delete-all', methods=['POST', 'OPTIONS'])
def admin_suggestions_delete_all():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("DELETE FROM suggestions"); conn.commit(); cur.close(); conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/admin/reports/delete', methods=['POST', 'OPTIONS'])
def admin_reports_delete():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json(); report_id = data.get('report_id')
        conn = get_db(); cur = conn.cursor()
        cur.execute("DELETE FROM reports WHERE id=%s", (report_id,))
        conn.commit(); cur.close(); conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/admin/reports/delete-all', methods=['POST', 'OPTIONS'])
def admin_reports_delete_all():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("DELETE FROM reports"); conn.commit(); cur.close(); conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/admin/transactions/delete', methods=['POST', 'OPTIONS'])
def admin_transactions_delete():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json(); transaction_id = data.get('transaction_id')
        conn = get_db(); cur = conn.cursor()
        cur.execute("DELETE FROM transactions WHERE id=%s", (transaction_id,))
        conn.commit()
        deleted = cur.rowcount > 0
        cur.close(); conn.close()
        return jsonify({'success': deleted, 'message': 'Deleted' if deleted else 'Not found'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/buyer/stats', methods=['POST', 'OPTIONS'])
def buyer_stats():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json(); user_id = data.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'message': 'user_id required'}), 400
        conn = get_db(); cur = conn.cursor()
        cur.execute("SELECT COUNT(*) AS cnt FROM publications WHERE user_id=%s", (user_id,))
        listings = cur.fetchone()['cnt']
        cur.execute("SELECT COUNT(*) AS cnt FROM transactions WHERE user_id=%s", (user_id,))
        mutations = cur.fetchone()['cnt']
        cur.execute("SELECT COUNT(*) AS cnt FROM transactions WHERE user_id=%s AND status='approved'", (user_id,))
        approved = cur.fetchone()['cnt']
        cur.execute("SELECT COUNT(*) AS cnt FROM prediction_history WHERE user_id=%s", (user_id,))
        estimates = cur.fetchone()['cnt']
        cur.close(); conn.close()
        return jsonify({'success': True, 'stats': {'listings': listings, 'mutations': mutations, 'approved': approved, 'estimates': estimates}})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/listings/mine', methods=['POST', 'OPTIONS'])
def listings_mine():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json(); user_id = data.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'message': 'user_id required'}), 400
        conn = get_db(); cur = conn.cursor()
        cur.execute("""
            SELECT id, upi, user_id, land_data, publisher, published_at
            FROM publications WHERE user_id=%s ORDER BY published_at DESC
        """, (user_id,))
        rows = cur.fetchall(); cur.close(); conn.close()
        result = []
        for r in rows:
            d = dict(r)
            if d.get('published_at'): d['published_at'] = d['published_at'].isoformat()
            ld = d.pop('land_data', {})
            if isinstance(ld, str):
                try: ld = json.loads(ld)
                except: ld = {}
            d['asking_price'] = ld.get('asking_price', 0)
            d['description'] = ld.get('description', '')
            d['phone'] = ld.get('phone', '')
            d['seller_name'] = ld.get('seller_name', d.get('publisher', ''))
            d['status'] = 'active'
            d['created_at'] = d['published_at']
            result.append(d)
        return jsonify({'success': True, 'listings': result})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/listings/all', methods=['POST', 'OPTIONS'])
def listings_all():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("""
            SELECT p.id, p.upi, p.user_id, p.land_data, p.publisher, p.published_at,
                   p.is_agreed, u.full_name AS seller_name, u.phone
            FROM publications p JOIN users u ON p.user_id=u.id
            WHERE p.is_agreed=FALSE OR p.is_agreed IS NULL
            ORDER BY p.published_at DESC
        """)
        rows = cur.fetchall(); cur.close(); conn.close()
        result = []
        for r in rows:
            d = dict(r)
            if d.get('published_at'): d['published_at'] = d['published_at'].isoformat()
            ld = d.pop('land_data', {})
            if isinstance(ld, str):
                try: ld = json.loads(ld)
                except: ld = {}
            d['asking_price'] = ld.get('asking_price', 0)
            d['description'] = ld.get('description', '')
            d['phone'] = d.get('phone') or ld.get('phone', '')
            d['seller_name'] = d.get('seller_name') or d.get('publisher', 'Unknown')
            d['status'] = 'active'
            d['created_at'] = d['published_at']
            result.append(d)
        return jsonify({'success': True, 'listings': result})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/listings/create', methods=['POST', 'OPTIONS'])
def listings_create():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        user_id = data.get('user_id'); upi = data.get('upi', '').strip()
        asking_price = data.get('asking_price'); seller_name = data.get('seller_name', '')
        phone = data.get('phone', ''); description = data.get('description', '')
        if not user_id or not upi or not asking_price:
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400
        land_data = {'asking_price': asking_price, 'description': description, 'phone': phone, 'seller_name': seller_name}
        conn = get_db(); cur = conn.cursor()
        cur.execute("SELECT id FROM publications WHERE upi=%s", (upi,))
        existing = cur.fetchone()
        if existing:
            cur.execute("UPDATE publications SET land_data=%s, user_id=%s, publisher=%s, published_at=NOW() WHERE upi=%s RETURNING id", (json.dumps(land_data), user_id, seller_name, upi))
        else:
            cur.execute("INSERT INTO publications (upi, user_id, land_data, publisher) VALUES (%s,%s,%s,%s) RETURNING id", (upi, user_id, json.dumps(land_data), seller_name))
        new_id = cur.fetchone()['id']
        conn.commit(); cur.close(); conn.close()
        return jsonify({'success': True, 'id': new_id})
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/listings/delete', methods=['POST', 'OPTIONS'])
def listings_delete():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json(); listing_id = data.get('listing_id')
        if not listing_id:
            return jsonify({'success': False, 'message': 'listing_id required'}), 400
        conn = get_db(); cur = conn.cursor()
        cur.execute("DELETE FROM publications WHERE id=%s", (listing_id,))
        conn.commit(); cur.close(); conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/listings/confirm-agreement', methods=['POST', 'OPTIONS'])
def listings_confirm_agreement():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        listing_id = data.get('listing_id'); seller_id = data.get('seller_id'); room = data.get('room', '')
        if not listing_id or not seller_id:
            return jsonify({'success': False, 'message': 'listing_id and seller_id required'}), 400
        conn = get_db(); cur = conn.cursor()
        cur.execute("SELECT * FROM publications WHERE id=%s AND user_id=%s", (listing_id, seller_id))
        listing = cur.fetchone()
        if not listing:
            cur.close(); conn.close()
            return jsonify({'success': False, 'message': 'Listing not found or not yours'}), 404
        cur.execute("SELECT DISTINCT buyer_id, buyer_name FROM chat_messages WHERE room=%s AND buyer_id IS NOT NULL LIMIT 1", (room,))
        buyer_row = cur.fetchone()
        buyer_id   = buyer_row['buyer_id']   if buyer_row else None
        buyer_name = buyer_row['buyer_name'] if buyer_row else 'Unknown Buyer'
        cur.execute("SELECT full_name FROM users WHERE id=%s", (seller_id,))
        seller_row = cur.fetchone()
        seller_name = seller_row['full_name'] if seller_row else 'Unknown Seller'
        cur.execute("UPDATE publications SET is_agreed=TRUE, agreed_at=NOW(), agreed_buyer_id=%s, agreed_room=%s WHERE id=%s", (buyer_id, room, listing_id))
        # Insert agreement with form_status = 'pending' (seller fills form next)
        cur.execute("""
            INSERT INTO agreements
                (upi, listing_id, seller_id, buyer_id, seller_name, buyer_name, room,
                 form_status, confirmed_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,'pending',NOW())
            ON CONFLICT DO NOTHING
        """, (listing['upi'], listing_id, seller_id, buyer_id, seller_name, buyer_name, room))
        system_msg = f"✓ {seller_name} confirmed agreement for UPI {listing['upi']}. Go to your Agreements tab for next steps."
        cur.execute("""
            INSERT INTO chat_messages (room, sender_id, sender_name, sender_role, message, listing_id, seller_id, buyer_id, buyer_name)
            VALUES (%s,%s,'System','system',%s,%s,%s,%s,%s)
        """, (room, seller_id, system_msg, listing_id, seller_id, buyer_id, buyer_name))
        conn.commit(); cur.close(); conn.close()
        return jsonify({'success': True, 'message': 'Agreement confirmed.', 'buyer_name': buyer_name})
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/chat/send', methods=['POST', 'OPTIONS'])
def chat_send():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        room = str(data.get('room', '')); sender_id = data.get('sender_id')
        sender_name = data.get('sender_name', ''); sender_role = data.get('sender_role', '')
        message = data.get('message', '').strip()
        listing_id = data.get('listing_id'); seller_id = data.get('seller_id')
        buyer_id = data.get('buyer_id'); buyer_name = data.get('buyer_name', '')
        notary_id = data.get('notary_id'); mutation_ref = data.get('mutation_ref', '')
        if not room or not message:
            return jsonify({'success': False, 'message': 'room and message required'}), 400
        conn = get_db(); cur = conn.cursor()
        cur.execute("""
            INSERT INTO chat_messages
                (room, sender_id, sender_name, sender_role, message,
                 listing_id, seller_id, buyer_id, buyer_name, notary_id, mutation_ref)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING id, sent_at
        """, (room, sender_id, sender_name, sender_role, message,
              listing_id, seller_id, buyer_id,
              buyer_name or (sender_name if sender_role == 'buyer_seller' else None),
              notary_id, mutation_ref))
        row = cur.fetchone()
        conn.commit(); cur.close(); conn.close()
        return jsonify({'success': True, 'id': row['id'], 'sent_at': row['sent_at'].isoformat()})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/chat/messages', methods=['POST', 'OPTIONS'])
def chat_messages():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        room = str(data.get('room', '')); since = data.get('since_id', 0)
        conn = get_db(); cur = conn.cursor()
        cur.execute("""
            SELECT id, sender_id, sender_name, sender_role, message, sent_at
            FROM chat_messages WHERE room=%s AND id>%s ORDER BY sent_at ASC LIMIT 100
        """, (room, since))
        rows = cur.fetchall(); cur.close(); conn.close()
        result = []
        for r in rows:
            d = dict(r)
            if d.get('sent_at'): d['sent_at'] = d['sent_at'].isoformat()
            result.append(d)
        return jsonify({'success': True, 'messages': result})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/chat/rooms/seller', methods=['POST', 'OPTIONS'])
def chat_rooms_seller():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json(); seller_id = data.get('seller_id')
        if not seller_id:
            return jsonify({'success': False, 'message': 'seller_id required'}), 400
        conn = get_db(); cur = conn.cursor()
        cur.execute("""
            SELECT cm.room, cm.listing_id,
                   MAX(cm.buyer_name) AS buyer_name, MAX(cm.buyer_id) AS buyer_id,
                   MAX(cm.sent_at) AS last_message_at, COUNT(*) AS message_count,
                   BOOL_OR(p.is_agreed AND p.agreed_room = cm.room) AS agreed
            FROM chat_messages cm
            LEFT JOIN publications p ON cm.listing_id = p.id
            WHERE cm.seller_id=%s AND cm.sender_role='buyer_seller'
            GROUP BY cm.room, cm.listing_id ORDER BY last_message_at DESC
        """, (seller_id,))
        rows = cur.fetchall(); cur.close(); conn.close()
        result = []
        for r in rows:
            d = dict(r)
            if d.get('last_message_at'): d['last_message_at'] = d['last_message_at'].isoformat()
            result.append(d)
        return jsonify({'success': True, 'rooms': result})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/chat/rooms/notary', methods=['POST', 'OPTIONS'])
def chat_rooms_notary():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json(); notary_id = data.get('notary_id')
        conn = get_db(); cur = conn.cursor()
        if notary_id:
            cur.execute("""
                SELECT room, MAX(sender_name) FILTER (WHERE sender_role='buyer_seller') AS buyer_name,
                       MAX(mutation_ref) AS mutation_ref, MAX(sent_at) AS last_message_at, COUNT(*) AS message_count
                FROM chat_messages WHERE notary_id=%s OR room LIKE 'notary_%%'
                GROUP BY room ORDER BY last_message_at DESC
            """, (notary_id,))
        else:
            cur.execute("""
                SELECT room, MAX(sender_name) FILTER (WHERE sender_role='buyer_seller') AS buyer_name,
                       MAX(mutation_ref) AS mutation_ref, MAX(sent_at) AS last_message_at, COUNT(*) AS message_count
                FROM chat_messages WHERE room LIKE 'notary_%%'
                GROUP BY room ORDER BY last_message_at DESC
            """)
        rows = cur.fetchall(); cur.close(); conn.close()
        result = []
        for r in rows:
            d = dict(r)
            if d.get('last_message_at'): d['last_message_at'] = d['last_message_at'].isoformat()
            result.append(d)
        return jsonify({'success': True, 'rooms': result})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/suggestions', methods=['POST', 'OPTIONS'])
@app.route('/suggestions/create', methods=['POST', 'OPTIONS'])
def suggestions_create():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        user_id = data.get('user_id'); user_name = data.get('user_name', '')
        category = data.get('category', 'general'); rating = int(data.get('rating', 0))
        message = data.get('text', '').strip() or data.get('message', '').strip()
        if not message:
            return jsonify({'success': False, 'message': 'Message is required'}), 400
        conn = get_db(); cur = conn.cursor()
        cur.execute("INSERT INTO suggestions (user_id, user_name, category, rating, message) VALUES (%s,%s,%s,%s,%s) RETURNING id", (user_id, user_name, category, rating, message))
        new_id = cur.fetchone()['id']
        conn.commit(); cur.close(); conn.close()
        return jsonify({'success': True, 'id': new_id})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/suggestions/all', methods=['POST', 'OPTIONS'])
def suggestions_all():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("SELECT id, user_id, user_name, category, rating, message, created_at FROM suggestions ORDER BY created_at DESC LIMIT 200")
        rows = cur.fetchall(); cur.close(); conn.close()
        result = []
        for r in rows:
            d = dict(r)
            if d.get('created_at'): d['created_at'] = d['created_at'].isoformat()
            result.append(d)
        return jsonify({'success': True, 'suggestions': result})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ══════════════════════════════════════════════════════════════
# NOTARY REPORT ENDPOINTS
# ══════════════════════════════════════════════════════════════
 
@app.route('/notary/report/check', methods=['POST', 'OPTIONS'])
def notary_report_check():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        user_id    = data.get('user_id')
        start_date = data.get('start_date')
        end_date   = data.get('end_date')
 
        if not all([user_id, start_date, end_date]):
            return jsonify({'success': False, 'message': 'user_id, start_date, end_date required'}), 400
 
        conn = get_db(); cur = conn.cursor()
        cur.execute("""
            SELECT reference, content, generated_at
            FROM reports
            WHERE from_user_id = %s
              AND from_role = 'notary'
              AND DATE(generated_at) >= %s
              AND DATE(generated_at) <= %s
            ORDER BY generated_at DESC
            LIMIT 1
        """, (user_id, start_date, end_date))
        existing = cur.fetchone()
        cur.close(); conn.close()
 
        if existing:
            return jsonify({
                'success': True, 'exists': True,
                'existing_report': {
                    'reference':    existing['reference'],
                    'content':      existing['content'],
                    'generated_at': existing['generated_at'].isoformat() if existing['generated_at'] else None,
                }
            })
        return jsonify({'success': True, 'exists': False})
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/notary/report', methods=['POST', 'OPTIONS'])
def notary_report():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        user_id    = data.get('user_id')
        start_date = data.get('start_date')
        end_date   = data.get('end_date')
 
        if not all([user_id, start_date, end_date]):
            return jsonify({'success': False, 'message': 'user_id, start_date, end_date required'}), 400
 
        reference = 'RPT-NOTARY-' + uuid.uuid4().hex[:8].upper()
        conn = get_db(); cur = conn.cursor()
 
        # Get notary info
        cur.execute("""
            SELECT full_name, notary_type, sector_name, district_name, license_number
            FROM users WHERE id = %s
        """, (user_id,))
        notary_row = cur.fetchone()
        if not notary_row:
            cur.close(); conn.close()
            return jsonify({'success': False, 'message': 'Notary not found'}), 404
 
        notary_type   = notary_row['notary_type'] or 'sector'
        notary_name   = notary_row['full_name']
        sector_name   = notary_row['sector_name'] or '—'
        district_name = notary_row['district_name'] or '—'
        license_num   = notary_row['license_number'] or '—'
 
        # Private → admin, Sector → district
        to_role = 'admin' if notary_type == 'private' else 'district_land_officer'
        dest_label = 'System Admin' if notary_type == 'private' else 'District Land Officer'
 
        # ── Total requests in date range ──
        cur.execute("""
            SELECT COUNT(*) AS cnt FROM notary_requests
            WHERE notary_id = %s AND DATE(created_at) >= %s AND DATE(created_at) <= %s
        """, (user_id, start_date, end_date))
        total = cur.fetchone()['cnt']
 
        # ── By status in date range ──
        for status_val in ['pending', 'appointment_set', 'stamped']:
            cur.execute("""
                SELECT COUNT(*) AS cnt FROM notary_requests
                WHERE notary_id = %s AND status = %s
                  AND DATE(created_at) >= %s AND DATE(created_at) <= %s
            """, (user_id, status_val, start_date, end_date))
 
        cur.execute("""
            SELECT COUNT(*) AS cnt FROM notary_requests
            WHERE notary_id = %s AND status = 'pending'
              AND DATE(created_at) >= %s AND DATE(created_at) <= %s
        """, (user_id, start_date, end_date))
        pending = cur.fetchone()['cnt']
 
        cur.execute("""
            SELECT COUNT(*) AS cnt FROM notary_requests
            WHERE notary_id = %s AND status = 'appointment_set'
              AND DATE(created_at) >= %s AND DATE(created_at) <= %s
        """, (user_id, start_date, end_date))
        appointments = cur.fetchone()['cnt']
 
        cur.execute("""
            SELECT COUNT(*) AS cnt FROM notary_requests
            WHERE notary_id = %s AND status = 'stamped'
              AND DATE(created_at) >= %s AND DATE(created_at) <= %s
        """, (user_id, start_date, end_date))
        stamped = cur.fetchone()['cnt']
 
        cur.execute("""
            SELECT COUNT(*) AS cnt FROM notary_requests
            WHERE notary_id = %s AND (status = 'sent_to_district' OR status = 'sent_to_admin')
              AND DATE(created_at) >= %s AND DATE(created_at) <= %s
        """, (user_id, start_date, end_date))
        sent = cur.fetchone()['cnt']
 
        # ── Appointments set in date range ──
        cur.execute("""
            SELECT COUNT(*) AS cnt FROM notary_requests
            WHERE notary_id = %s
              AND DATE(appointment_set_at) >= %s AND DATE(appointment_set_at) <= %s
        """, (user_id, start_date, end_date))
        appts_set = cur.fetchone()['cnt']
 
        # ── Documents uploaded in date range ──
        cur.execute("""
            SELECT COUNT(*) AS cnt FROM notary_documents nd
            JOIN notary_requests nr ON nd.request_id = nr.id
            WHERE nr.notary_id = %s
              AND DATE(nd.uploaded_at) >= %s AND DATE(nd.uploaded_at) <= %s
        """, (user_id, start_date, end_date))
        docs_uploaded = cur.fetchone()['cnt']
 
        # ── Stamped records created in date range ──
        cur.execute("""
            SELECT COUNT(*) AS cnt FROM stamped_parcel_records
            WHERE notary_id = %s
              AND DATE(stamped_at) >= %s AND DATE(stamped_at) <= %s
        """, (user_id, start_date, end_date))
        stamped_records = cur.fetchone()['cnt']
 
        content = '\n'.join([
            f"NOTARY — COMPREHENSIVE REPORT",
            f"==============================",
            f"Reference    : {reference}",
            f"Notary Name  : {notary_name}",
            f"Notary Type  : {notary_type.title()} Notary",
            f"Sector       : {sector_name}",
            f"District     : {district_name}",
            f"License No.  : {license_num}",
            f"Date Range   : {start_date}  to  {end_date}",
            f"Generated    : {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            f"Destination  : {dest_label}",
            f"",
            f"──────────────────────────────────────────",
            f"NOTARY REQUESTS (received in date range)",
            f"──────────────────────────────────────────",
            f"Total Requests Received  : {total}",
            f"Pending (awaiting action): {pending}",
            f"Appointment Set          : {appointments}",
            f"Stamped & Signed         : {stamped}",
            f"Sent to {dest_label[:14]:<14} : {sent}",
            f"",
            f"──────────────────────────────────────────",
            f"APPOINTMENTS (set in date range)",
            f"──────────────────────────────────────────",
            f"Appointments Scheduled   : {appts_set}",
            f"",
            f"──────────────────────────────────────────",
            f"DOCUMENTS & STAMPED RECORDS",
            f"──────────────────────────────────────────",
            f"Documents Uploaded       : {docs_uploaded}",
            f"Stamped Parcel Records   : {stamped_records}",
            f"",
            f"──────────────────────────────────────────",
            f"END OF REPORT",
        ])
 
        cur.execute("""
            INSERT INTO reports
                (reference, from_user_id, from_role, to_role, type, content,
                 sent_at, read, generated_at)
            VALUES (%s, %s, 'notary', %s, 'full', %s, NOW(), FALSE, NOW())
        """, (reference, user_id, to_role, content))
        conn.commit(); cur.close(); conn.close()
 
        return jsonify({'success': True, 'reference': reference, 'content': content})
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/notary/report/send', methods=['POST', 'OPTIONS'])
def notary_report_send():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        report_ref = data.get('report_ref')
        user_id    = data.get('user_id')
 
        if not report_ref or not user_id:
            return jsonify({'success': False, 'message': 'report_ref and user_id required'}), 400
 
        conn = get_db()
        cur  = conn.cursor()
 
        # Get the original report
        cur.execute("SELECT * FROM reports WHERE reference = %s", (report_ref,))
        original = cur.fetchone()
        if not original:
            cur.close(); conn.close()
            return jsonify({'success': False, 'message': 'Report not found'}), 404
 
        # Get notary_type from users table (source of truth)
        cur.execute("SELECT notary_type FROM users WHERE id = %s", (user_id,))
        u = cur.fetchone()
        notary_type = (u['notary_type'] or 'sector') if u else 'sector'
 
        # Route based on type
        to_role    = 'admin' if notary_type == 'private' else 'district_land_officer'
        new_ref    = 'RPT-' + uuid.uuid4().hex[:8].upper()
 
        cur.execute("""
            INSERT INTO reports
                (reference, from_user_id, from_role, to_role, type, content,
                 sent_at, read, forwarded_from, district_id, province_id, generated_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW(), FALSE, %s, %s, %s, NOW())
        """, (
            new_ref,
            original['from_user_id'],
            original['from_role'],
            to_role,
            original['type'],
            original['content'],
            original['reference'],
            original.get('district_id'),
            original.get('province_id'),
        ))
        conn.commit()
        cur.close()
        conn.close()
 
        dest = 'Admin' if notary_type == 'private' else 'District Land Officer'
        return jsonify({
            'success':      True,
            'new_reference': new_ref,
            'sent_to':       to_role,
            'message':       f'Report sent to {dest}'
        })
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


# ── SMTP + Password Reset ──────────────────────────────────
SMTP_HOST     = 'smtp.gmail.com'
SMTP_PORT     = 587
SMTP_USERNAME = 'ericuwinezastarboy@gmail.com'
SMTP_PASSWORD = 'wagbvbyowxhbwrsg'
SMTP_FROM     = 'Land Price Estimation System <ericuwinezastarboy@gmail.com>'
FRONTEND_URL  = 'http://localhost:3000'

def send_reset_email(to_email, reset_token, full_name=''):
    reset_link = f"{FRONTEND_URL}/reset-password?token={reset_token}"
    greeting = f"Hello {full_name}," if full_name else "Hello,"
    msg = MIMEText(f"""{greeting}

We received a request to reset the password for your Land Price Estimation System account ({to_email}).

Reset your password here:
{reset_link}

This link expires in 30 minutes.

If you did not request this, ignore this email.

— Rwanda Polytechnic · Huye College · ICT Department""", 'plain')
    msg['Subject'] = 'Reset your password for Land Price Estimation System'
    msg['From'] = SMTP_FROM
    msg['To'] = to_email
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo(); server.starttls(); server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"[Email Error] {e}"); return False


@app.route('/auth/forgot-password', methods=['POST', 'OPTIONS'])
def forgot_password():
    if request.method == 'OPTIONS':
        return '', 204
    data = request.get_json(silent=True) or {}
    input_val = (data.get('email') or '').strip()
    if not input_val:
        return jsonify(success=False, message='Email or username is required.'), 400
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("SELECT id, full_name, email FROM users WHERE LOWER(email)=%s", (input_val.lower(),))
        user = cur.fetchone()
        if not user:
            cur.execute("SELECT id, full_name, email FROM users WHERE LOWER(full_name)=%s", (input_val.lower(),))
            user = cur.fetchone()
        if not user:
            cur.close(); conn.close()
            return jsonify(success=False, message='No account found with that email or username.'), 404
        to_email = user['email']
        if not to_email or '@' not in to_email:
            cur.close(); conn.close()
            return jsonify(success=False, message='No valid email on file for this account.'), 400
        token = secrets.token_urlsafe(48)
        cur.execute("UPDATE users SET temp_password=%s WHERE id=%s", (token, user['id']))
        conn.commit(); cur.close(); conn.close()
        sent = send_reset_email(to_email, token, user['full_name'])
        if not sent:
            return jsonify(success=False, message='Failed to send email. Please try again.'), 500
        return jsonify(success=True, message='Reset link sent to the email on file.')
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500


@app.route('/auth/reset-password', methods=['POST', 'OPTIONS'])
def reset_password():
    if request.method == 'OPTIONS':
        return '', 204
    data = request.get_json(silent=True) or {}
    token        = data.get('token', '').strip()
    new_password = data.get('password', '').strip()

    if not token or not new_password:
        return jsonify(success=False, message='Token and new password are required.'), 400
    if len(new_password) < 8:
        return jsonify(success=False, message='Password must be at least 8 characters.'), 400

    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("SELECT id, password_hash FROM users WHERE temp_password=%s", (token,))
        user = cur.fetchone()
        if not user:
            cur.close(); conn.close()
            return jsonify(success=False, message='Reset link is invalid or has expired.'), 400

        # FIXED: check against hashed password properly
        current_hash = user['password_hash'] or ''
        is_same = False
        if current_hash.startswith('$2b$') or current_hash.startswith('$2a$'):
            try:
                is_same = bcrypt.checkpw(new_password.encode('utf-8'), current_hash.encode('utf-8'))
            except Exception:
                is_same = False
        else:
            is_same = (new_password == current_hash)  # fallback for plain text users

        if is_same:
            cur.close(); conn.close()
            return jsonify(success=False, message='New password must be different from your current password.'), 400

        # FIXED: store hashed, not plain text
        hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        cur.execute("UPDATE users SET password_hash=%s, temp_password=NULL WHERE id=%s", (hashed, user['id']))
        conn.commit(); cur.close(); conn.close()

        return jsonify(success=True, message='Password updated successfully.')
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500


@app.route('/auth/register', methods=['POST', 'OPTIONS'])
def register():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        full_name   = data.get('full_name', '').strip()
        email       = data.get('email', '').strip().lower()
        password    = data.get('password', '').strip()
        phone       = data.get('phone', '').strip()
        national_id = data.get('national_id', '').strip()
        role        = data.get('role', 'buyer_seller').strip()
        sex         = data.get('sex', '').strip()

        # NEW: Get district_id and sector_id from request (FK values)
        district_id = data.get('district_id')
        sector_id   = data.get('sector_id')
        
        # Keep display names as fallback (for backward compatibility)
        district_name_val = data.get('district_name', '').strip() or None
        sector_name_val   = data.get('sector_name', '').strip() or None
        license_number_val = data.get('license_number', '').strip() or None
        notary_type = data.get('notary_type', '').strip() or None

        if not full_name or not email or not password:
            return jsonify({'success': False, 'message': 'Name, email and password are required'}), 400

        conn = get_db()
        cur = conn.cursor()
        
        # Check if email exists
        cur.execute("SELECT id FROM users WHERE LOWER(email)=%s", (email,))
        if cur.fetchone():
            cur.close()
            conn.close()
            return jsonify({'success': False, 'message': 'An account with this email already exists'}), 409

        # Get role ID
        cur.execute("SELECT id FROM roles WHERE name=%s", (role,))
        role_row = cur.fetchone()
        if not role_row:
            cur.close()
            conn.close()
            return jsonify({'success': False, 'message': 'Invalid role selected'}), 400

        role_id = role_row['id']
        
        # Validation for District Officer
        if role == 'district_land_officer':
            if not district_id and not district_name_val:
                cur.close()
                conn.close()
                return jsonify({'success': False, 'message': 'District is required for District Officer'}), 400
            
            # If district_id is provided, fetch the district name for display
            if district_id and not district_name_val:
                cur.execute("SELECT name FROM districts WHERE id = %s", (district_id,))
                name_row = cur.fetchone()
                if name_row:
                    district_name_val = name_row['name']
                else:
                    cur.close()
                    conn.close()
                    return jsonify({'success': False, 'message': f'District ID {district_id} not found'}), 400
        
        # Validation for Private Notary
        if role == 'notary' and notary_type == 'private':
            if not district_id and not district_name_val:
                cur.close()
                conn.close()
                return jsonify({'success': False, 'message': 'District is required for Private Notary'}), 400
            if not sector_id and not sector_name_val:
                cur.close()
                conn.close()
                return jsonify({'success': False, 'message': 'Sector is required for Private Notary'}), 400
            
            # If IDs provided, fetch names for display
            if district_id and not district_name_val:
                cur.execute("SELECT name FROM districts WHERE id = %s", (district_id,))
                name_row = cur.fetchone()
                if name_row:
                    district_name_val = name_row['name']
            
            if sector_id and not sector_name_val:
                cur.execute("SELECT name FROM sectors WHERE id = %s", (sector_id,))
                name_row = cur.fetchone()
                if name_row:
                    sector_name_val = name_row['name']
        
        # For buyer_seller, auto-approve; others require admin approval
        status = 'approved' if role == 'buyer_seller' else 'pending'
        
        # Hash the password
        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        # Insert user with proper FK relationships
        cur.execute("""
            INSERT INTO users (
                full_name, email, password_hash, phone, national_id, sex, 
                role_id, status, notary_type, 
                district_id, district_name, sector_id, sector_name, license_number
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            full_name, email, hashed, phone, national_id, sex,
            role_id, status, notary_type,
            district_id if district_id else None, 
            district_name_val,
            sector_id if sector_id else None,
            sector_name_val,
            license_number_val
        ))

        new_id = cur.fetchone()['id']
        conn.commit()
        cur.close()
        conn.close()

        msg = 'Account created! You may now log in.' if status == 'approved' else 'Registration submitted. Await approval from an administrator.'
        return jsonify({'success': True, 'message': msg, 'status': status, 'id': new_id, 'user_id': new_id})
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500


@app.route('/')
def home():
    return jsonify({
        'status': 'running',
        'message': 'Land Price Estimation API is running',
        'version': '1.0'
    })


# ── Chatbot — OpenAI powered ───────────────────────────────
import openai
import re

def load_knowledge_folder(folder_name='knowledge_base'):
    """Load all documents from the knowledge_base folder"""
    knowledge_text = []
    folder_path = os.path.join(os.path.dirname(__file__), folder_name)
    
    if not os.path.exists(folder_path):
        os.makedirs(folder_path)
        print(f"Created empty knowledge_base folder at: {folder_path}")
        return "No documents loaded yet."
    
    files_loaded = 0
    for filename in os.listdir(folder_path):
        filepath = os.path.join(folder_path, filename)
        text = ""
        try:
            if filename.lower().endswith('.pdf'):
                with open(filepath, 'rb') as f:
                    reader = PyPDF2.PdfReader(f)
                    for page in reader.pages:
                        text += page.extract_text() + "\n"
            elif filename.lower().endswith('.docx'):
                doc = python_docx.Document(filepath)
                for para in doc.paragraphs:
                    text += para.text + "\n"
            elif filename.lower().endswith('.txt'):
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    text = f.read()
            
            if text.strip():
                knowledge_text.append(f"\n--- Document: {filename} ---\n{text}")
                files_loaded += 1
                print(f"  Loaded: {filename}")
        except Exception as e:
            print(f"  Warning: Could not load {filename}: {e}")
    
    print(f"Knowledge base: {files_loaded} documents loaded from '{folder_name}/'")
    return "\n".join(knowledge_text) if knowledge_text else "No documents found."


# Load knowledge base once at startup
LPES_KNOWLEDGE = load_knowledge_folder('knowledge_base')


def mask_upi(text):
    return re.sub(
        r'\b\d+(/\d+){2,}\b',
        lambda m: '/'.join(['XX'] * len(m.group(0).split('/'))),
        text
    )


def detect_language(text):
    kinyarwanda_words = [
        'muraho','mwaramutse','mwiriwe','amakuru','bite','yego','oya',
        'murakoze','urakoze','mbabarira','sisiteme','ubutaka','agaciro',
        'kubara','igice','nomero','umusoro','ibiciro','intara','akarere',
        'umurenge','akagari','umudugudu','ndashaka','ushaka','nifuza',
        'ukoresha','nkoresha','ikinyarwanda','kinyarwanda','fasha',
        'gufasha','sobanura','menya','kumenya'
    ]
    text_lower = text.lower()
    return 'rw' if any(w in text_lower for w in kinyarwanda_words) else 'en'


# ── FIXED GREETING DETECTION ───────────────────────────────
def is_greeting(text):
    text = text.lower()
    greetings = [
        'hi', 'hello', 'hey', 'morning', 'good morning',
        'good evening', 'good afternoon',
        'muraho', 'amakuru', 'mwaramutse', 'mwiriwe'
    ]
    return any(g in text for g in greetings)


# Single conversation sessions store
conversation_sessions = {}


@app.route('/chat', methods=['POST', 'OPTIONS'])
def chat():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data       = request.get_json()
        message    = data.get('message', '').strip()
        session_id = data.get('session_id', 'default')

        if not message:
            return jsonify({'success': False, 'response': 'Please enter a message'}), 400

        masked_message = mask_upi(message)
        user_lang = detect_language(message)

        # ── FIX 1: GREETING WORKS PROPERLY ──
        if is_greeting(message):
            if user_lang == 'rw':
                return jsonify({
                    'success': True,
                    'response': "Muraho! Ndi assistant wa Land Price Estimation System. Nigute nagufasha?",
                    'lang': user_lang,
                    'provider': 'LPES Assistant'
                })
            else:
                return jsonify({
                    'success': True,
                    'response': "Hello! I'm the Land Price Estimation System assistant. How can I help you?",
                    'lang': user_lang,
                    'provider': 'LPES Assistant'
                })

        if user_lang == 'rw':
            system_prompt = (
                "Uri assistant ufasha abantu gukoresha LPES mu Rwanda. "
                "Subiza mu Kinyarwanda gisanzwe, wumvikane neza kandi ube mugufi.\n\n"
                "Knowledge base:\n"
                f"{LPES_KNOWLEDGE[:6000]}\n\n"
                "AMATEGEKO:\n"
                "- Subiza amagambo make — interuro 5-6 gusa\n"
                "- Niba utazi, bivuge mu ncamake\n"
                "- UPI ni ibanga: isimbuze XX/XX/XX/XX/XXXX\n"
                "- Ntukoreshe ubumenyi bwo hanze\n"
            )
        else:
            system_prompt = (
                "You are an assistant for LPES (Land Price Estimation System).\n"
                "Answer only using the knowledge base.\n"
                "Be concise (5-6 sentences max).\n\n"
                f"{LPES_KNOWLEDGE[:6000]}"
            )

        if session_id not in conversation_sessions:
            conversation_sessions[session_id] = []

        history = conversation_sessions[session_id]
        history.append({'role': 'user', 'content': masked_message})

        if len(history) > 10:
            history = history[-10:]
            conversation_sessions[session_id] = history

        # ── REMOVED BAD FILTER (THIS WAS YOUR MAIN BUG) ──
        # No more blocking valid questions

        response = client.chat.completions.create(
            model='gpt-4o-mini',
            messages=[
                {'role': 'system', 'content': system_prompt},
                *history
            ],
            max_tokens=300,
            temperature=0.6,
        )

        reply = response.choices[0].message.content.strip()
        reply = mask_upi(reply)

        history.append({'role': 'assistant', 'content': reply})

        return jsonify({
            'success': True,
            'response': reply,
            'lang': user_lang,
            'provider': 'OpenAI GPT-4o-mini'
        })

    except Exception as e:
        print(f"Chat error: {e}")
        return jsonify({
            'success': True,
            'response': 'Sorry, something went wrong. Please try again.',
            'provider': 'error'
        })


@app.route('/chat/reset', methods=['POST'])
def reset_chat():
    data = request.get_json()
    sid  = data.get('session_id', 'default')
    if sid in conversation_sessions:
        del conversation_sessions[sid]
    return jsonify({'success': True})

@app.route('/auth/google-login', methods=['POST', 'OPTIONS'])
def google_login():
    """Legacy demo route — kept for compatibility"""
    if request.method == 'OPTIONS':
        return '', 204
    return jsonify({'success': False, 'message': 'Use /auth/google-callback instead'}), 400


@app.route('/auth/google-callback', methods=['POST', 'OPTIONS'])
def google_callback():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data         = request.get_json()
        code         = data.get('code', '')
        redirect_uri = data.get('redirect_uri', 'http://localhost:3000/auth/callback')

        if not code:
            return jsonify({'success': False, 'message': 'No authorization code provided'}), 400

        import requests as req

        # Exchange code for tokens
        token_res = req.post('https://oauth2.googleapis.com/token', data={
            'code':          code,
            'client_id':     os.getenv('GOOGLE_CLIENT_ID'),
            'client_secret': os.getenv('GOOGLE_CLIENT_SECRET'),
            'redirect_uri':  redirect_uri,
            'grant_type':    'authorization_code',
        })
        token_data = token_res.json()

        if 'error' in token_data:
            return jsonify({'success': False, 'message': token_data.get('error_description', 'Token exchange failed')}), 400

        # Get user info from Google
        userinfo_res = req.get('https://www.googleapis.com/oauth2/v2/userinfo',
            headers={'Authorization': f"Bearer {token_data['access_token']}"})
        google_user = userinfo_res.json()

        email = google_user.get('email', '').strip().lower()
        name  = google_user.get('name', 'Google User')

        if not email:
            return jsonify({'success': False, 'message': 'Could not get email from Google'}), 400

        conn = get_db()
        cur  = conn.cursor()

        cur.execute("""
            SELECT u.id, u.full_name, u.email, r.name AS role
            FROM users u JOIN roles r ON u.role_id = r.id
            WHERE LOWER(u.email) = %s
        """, (email,))
        user = cur.fetchone()

        if not user:
            cur.execute("SELECT id FROM roles WHERE name = 'buyer_seller'")
            role_row = cur.fetchone()
            if not role_row:
                cur.close(); conn.close()
                return jsonify({'success': False, 'message': 'Role not found'}), 500

            cur.execute("""
                INSERT INTO users (full_name, email, password_hash, role_id, status)
                VALUES (%s, %s, 'GOOGLE_AUTH', %s, 'approved')
                RETURNING id, full_name, email
            """, (name, email, role_row['id']))
            new_user = cur.fetchone()
            conn.commit(); cur.close(); conn.close()
            return jsonify({
                'success': True,
                'user': {'id': new_user['id'], 'name': new_user['full_name'], 'email': new_user['email'], 'role': 'buyer_seller'}
            })

        cur.close(); conn.close()

        if user['role'] != 'buyer_seller':
            return jsonify({'success': False, 'message': 'Google sign-in is only for Buyer/Seller accounts.'})

        return jsonify({
            'success': True,
            'user': {'id': user['id'], 'name': user['full_name'], 'email': user['email'], 'role': user['role']}
        })
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/auth/change-password', methods=['POST', 'OPTIONS'])
def change_password():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        current_password = data.get('current_password', '').strip()
        new_password = data.get('new_password', '').strip()
        if not user_id or not current_password or not new_password:
            return jsonify({'success': False, 'message': 'All fields are required.'}), 400
        conn = get_db(); cur = conn.cursor()
        cur.execute("SELECT password_hash FROM users WHERE id = %s", (user_id,))
        row = cur.fetchone()
        if not row:
            cur.close(); conn.close()
            return jsonify({'success': False, 'message': 'User not found.'}), 404
        try:
            match = bcrypt.checkpw(current_password.encode('utf-8'), row['password_hash'].encode('utf-8'))
        except Exception:
            match = False
        if not match:
            cur.close(); conn.close()
            return jsonify({'success': False, 'message': 'Current password is incorrect.'}), 401
        hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (hashed, user_id))
        conn.commit(); cur.close(); conn.close()
        return jsonify({'success': True, 'message': 'Password changed successfully.'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# Add this to app.py after the existing routes

@app.route('/admin/mutations/confirm', methods=['POST', 'OPTIONS'])
def admin_confirm_mutation():
    """Admin confirms a mutation - transfers parcel ownership from seller to buyer"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        transaction_id = data.get('transaction_id')
        admin_id = data.get('admin_id')
        
        if not transaction_id:
            return jsonify({'success': False, 'message': 'transaction_id required'}), 400
        
        conn = get_db()
        cur = conn.cursor()
        
        # Get transaction details
        cur.execute("""
            SELECT id, upi, buyer_name, seller_name, buyer_id, seller_id, 
                agreed_price, status, reference
            FROM transactions 
            WHERE id = %s
        """, (transaction_id,))
        tx = cur.fetchone()
        
        if not tx:
            cur.close(); conn.close()
            return jsonify({'success': False, 'message': 'Transaction not found'}), 404
        
        if tx['status'] == 'approved':
            cur.close(); conn.close()
            return jsonify({'success': False, 'message': 'Mutation already approved'}), 400
        
        # Update transaction status
        cur.execute("""
            UPDATE transactions 
                SET status = 'approved'
            WHERE id = %s
        """, (transaction_id,))
        
        # Transfer ownership: update land_parcels owner from seller to buyer
        if tx['buyer_id'] and tx['seller_id']:
            cur.execute("""
                UPDATE land_parcels 
                SET owner_id = %s, 
                    previous_owner_id = %s,
                    transferred_at = NOW(),
                    transfer_price = %s
                WHERE upi = %s
            """, (tx['buyer_id'], tx['seller_id'], tx['agreed_price'], tx['upi']))
            
            # Also update any associated agreements
            cur.execute("""
                UPDATE agreements 
                SET is_mutated = TRUE, 
                    mutated_at = NOW(),
                    mutation_ref = %s
                WHERE upi = %s AND seller_id = %s AND buyer_id = %s
            """, (tx['reference'], tx['upi'], tx['seller_id'], tx['buyer_id']))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': f'Mutation confirmed and parcel transferred from {tx["seller_name"]} to {tx["buyer_name"]}',
            'transaction': dict(tx)
        })
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/admin/mutations/reject', methods=['POST', 'OPTIONS'])
def admin_reject_mutation():
    """Admin rejects a mutation"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        transaction_id = data.get('transaction_id')
        reason = data.get('reason', '')
        
        if not transaction_id:
            return jsonify({'success': False, 'message': 'transaction_id required'}), 400
        
        conn = get_db()
        cur = conn.cursor()
        
        cur.execute("""
            UPDATE transactions 
                SET status = 'rejected', 
                rejection_reason = %s
            WHERE id = %s
        """, (reason, transaction_id))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Mutation rejected'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500



@app.route('/user/parcels', methods=['POST', 'OPTIONS'])
def user_parcels():
    """Get all land parcels owned by a user"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        
        if not user_id:
            return jsonify({'success': False, 'message': 'user_id required'}), 400
        
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT lp.upi, lp.area_in_meter_square, lp.land_use,
                   p.name AS province, d.name AS district, s.name AS sector,
                   lp.transferred_at, lp.transfer_price,
                   lp.x, lp.y
            FROM land_parcels lp
            LEFT JOIN provinces p ON lp.province_id = p.id
            LEFT JOIN districts d ON lp.district_id = d.id
            LEFT JOIN sectors s ON lp.sector_id = s.id
            WHERE lp.owner_id = %s
            ORDER BY lp.transferred_at DESC
        """, (user_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        result = []
        for r in rows:
            d = dict(r)
            if d.get('transferred_at'):
                d['transferred_at'] = d['transferred_at'].isoformat()
            result.append(d)
        
        return jsonify({'success': True, 'parcels': result})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500  
      
@app.route('/admin/mutations/edit', methods=['POST', 'OPTIONS'])
def admin_mutations_edit():
    """Admin edits a mutation"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        transaction_id = data.get('transaction_id')
        
        if not transaction_id:
            return jsonify({'success': False, 'message': 'transaction_id required'}), 400
        
        conn = get_db()
        cur = conn.cursor()
        
        updates = []
        params = []
        
        if data.get('buyer_name') is not None:
            updates.append("buyer_name = %s")
            params.append(data['buyer_name'])
        if data.get('seller_name') is not None:
            updates.append("seller_name = %s")
            params.append(data['seller_name'])
        if data.get('agreed_price') is not None:
            updates.append("agreed_price = %s")
            params.append(float(data['agreed_price']))
        if data.get('upi') is not None:
            updates.append("upi = %s")
            params.append(data['upi'])
        if data.get('notary_name') is not None:
            updates.append("notary_name = %s")
            params.append(data['notary_name'])
        
        if updates:
            params.append(transaction_id)
            cur.execute(f"UPDATE transactions SET {', '.join(updates)} WHERE id = %s", params)
            conn.commit()
        
        cur.close()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Mutation updated'})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/admin/land-parcels', methods=['POST', 'OPTIONS'])
def admin_land_parcels():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("""
        SELECT lp.id, lp.upi, lp.area_in_meter_square, lp.land_use,
               lp.zoning, lp.zoning_percentage, lp.sentlement, lp.sentlement_percentage,
               lp.minimum_value_per_sqm, lp.weighted_average_value_per_sqm, lp.maximum_value_per_sqm,
               lp.owner_id, lp.transferred_at, lp.transfer_price, lp.owner_sex,
               lp.owner_national_id, lp.owner_name,
               lp.cell, lp.village, lp.x, lp.y,
               p.name AS province, d.name AS district, s.name AS sector
        FROM land_parcels lp
        LEFT JOIN users u ON lp.owner_id = u.id
        LEFT JOIN provinces p ON lp.province_id = p.id
        LEFT JOIN districts d ON lp.district_id = d.id
        LEFT JOIN sectors s ON lp.sector_id = s.id
        ORDER BY lp.created_at DESC LIMIT 500
        """)
        rows = cur.fetchall(); cur.close(); conn.close()
        result = []
        for r in rows:
            d = dict(r)
            if d.get('transferred_at'): d['transferred_at'] = d['transferred_at'].isoformat()
            result.append(d)
        return jsonify({'success': True, 'parcels': result})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/admin/land-parcels/create', methods=['POST', 'OPTIONS'])
def admin_land_parcels_create():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        upi      = data.get('upi','').strip()
        user_id  = data.get('user_id')
        area_m2  = data.get('area_m2')
        land_use = data.get('land_use','').strip()
        if not upi or not area_m2 or not land_use:
            return jsonify({'success': False, 'message': 'UPI, area and land use are required'}), 400

        conn = get_db(); cur = conn.cursor()
        owner_national_id = data.get('owner_national_id', '').strip() or None
        owner_name_val    = data.get('owner_name', '').strip() or None
        owner_sex_val     = data.get('owner_sex', '').strip() or None
        x_val  = float(data['x']) if data.get('x') else None
        y_val  = float(data['y']) if data.get('y') else None

        # If national_id provided, try to find matching user
        if owner_national_id and not user_id:
            cur.execute("SELECT id FROM users WHERE national_id = %s LIMIT 1", (owner_national_id,))
            nid_user = cur.fetchone()
            if nid_user:
                user_id = nid_user['id']

        # Look up province_id, district_id, sector_id by name
        province_name = data.get('province', '').strip()
        district_name = data.get('district', '').strip()
        sector_name   = data.get('sector', '').strip()

        province_id = district_id = sector_id = None

        if province_name:
            cur.execute("""
                SELECT id FROM provinces 
                WHERE LOWER(name) = LOWER(%s)
                   OR LOWER(%s) LIKE LOWER(name) || '%%'
                   OR LOWER(name) LIKE LOWER(%s) || '%%'
                LIMIT 1
            """, (province_name, province_name, province_name))
            row = cur.fetchone()
            province_id = row['id'] if row else None

        if district_name:
            cur.execute("""
                SELECT id FROM districts 
                WHERE LOWER(name) = LOWER(%s)
                   OR LOWER(%s) LIKE LOWER(name) || '%%'
                   OR LOWER(name) LIKE LOWER(%s) || '%%'
                LIMIT 1
            """, (district_name, district_name, district_name))
            row = cur.fetchone()
            district_id = row['id'] if row else None

        if sector_name:
            cur.execute("""
                SELECT id FROM sectors 
                WHERE LOWER(name) = LOWER(%s)
                   OR LOWER(%s) LIKE LOWER(name) || '%%'
                   OR LOWER(name) LIKE LOWER(%s) || '%%'
                LIMIT 1
            """, (sector_name, sector_name, sector_name))
            row = cur.fetchone()
            sector_id = row['id'] if row else None

        # FIX: validate all location IDs — if not found, return clear error
        if province_name and not province_id:
            cur.close(); conn.close()
            return jsonify({'success': False, 'message': f'Province "{province_name}" not found in the system. Please go to Locations and create it first.'}), 400

        if district_name and not district_id:
            cur.close(); conn.close()
            return jsonify({'success': False, 'message': f'District "{district_name}" not found in the system. Please go to Locations and create it first.'}), 400

        if sector_name and not sector_id:
            cur.close(); conn.close()
            return jsonify({'success': False, 'message': f'Sector "{sector_name}" not found in the system. Please go to Locations and create it first.'}), 400

        cell_name   = data.get('cell', '').strip()
        village_name = data.get('village', '').strip()

        cur.execute("""
            INSERT INTO land_parcels
                (upi, owner_id, owner_national_id, owner_name, owner_sex,
                area_in_meter_square, land_use,
                zoning, zoning_percentage, sentlement, sentlement_percentage,
                x, y,
                province_id, district_id, sector_id,
                cell, village,
                minimum_value_per_sqm, weighted_average_value_per_sqm, maximum_value_per_sqm,
                verified, created_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,TRUE,NOW())
            ON CONFLICT (upi) DO UPDATE SET
                owner_id = EXCLUDED.owner_id,
                owner_national_id = EXCLUDED.owner_national_id,
                owner_name = EXCLUDED.owner_name,
                owner_sex = EXCLUDED.owner_sex,
                area_in_meter_square = EXCLUDED.area_in_meter_square,
                land_use = EXCLUDED.land_use,
                zoning = EXCLUDED.zoning,
                zoning_percentage = EXCLUDED.zoning_percentage,
                sentlement = EXCLUDED.sentlement,
                sentlement_percentage = EXCLUDED.sentlement_percentage,
                x = EXCLUDED.x,
                y = EXCLUDED.y,
                province_id = EXCLUDED.province_id,
                district_id = EXCLUDED.district_id,
                sector_id = EXCLUDED.sector_id,
                cell = EXCLUDED.cell,
                village = EXCLUDED.village,
                minimum_value_per_sqm = EXCLUDED.minimum_value_per_sqm,
                weighted_average_value_per_sqm = EXCLUDED.weighted_average_value_per_sqm,
                maximum_value_per_sqm = EXCLUDED.maximum_value_per_sqm
            RETURNING id
        """, (
            upi, user_id or None, owner_national_id, owner_name_val, owner_sex_val,
            float(area_m2), land_use,
            data.get('zoning') or None,
            float(data['zoning_percentage']) if data.get('zoning_percentage') else None,
            data.get('sentlement') or None,
            float(data['sentlement_percentage']) if data.get('sentlement_percentage') else None,
            x_val, y_val,
            province_id, district_id, sector_id,
            cell_name or None, village_name or None,
            float(data['minimum_value_per_sqm']) if data.get('minimum_value_per_sqm') else None,
            float(data['weighted_average_value_per_sqm']) if data.get('weighted_average_value_per_sqm') else None,
            float(data['maximum_value_per_sqm']) if data.get('maximum_value_per_sqm') else None,
        ))
        new_id = cur.fetchone()['id']
        conn.commit(); cur.close(); conn.close()
        return jsonify({'success': True, 'id': new_id})
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/admin/land-parcels/edit', methods=['POST', 'OPTIONS'])
def admin_land_parcels_edit():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        parcel_id = data.get('parcel_id')
        if not parcel_id:
            return jsonify({'success': False, 'message': 'parcel_id required'}), 400

        conn = get_db()
        cur = conn.cursor()

        updates = []
        params = []

        # ── Owner info ──
        if data.get('user_id') is not None:
            updates.append("owner_id = %s"); params.append(data['user_id'])
        if data.get('owner_national_id') is not None:
            updates.append("owner_national_id = %s"); params.append(data['owner_national_id'] or None)
        if data.get('owner_name') is not None:
            updates.append("owner_name = %s"); params.append(data['owner_name'] or None)
        if data.get('owner_sex') is not None:
            updates.append("owner_sex = %s"); params.append(data['owner_sex'] or None)

        # ── Coordinates & area ──
        if data.get('x') not in (None, ''):
            updates.append("x = %s"); params.append(float(data['x']))
        if data.get('y') not in (None, ''):
            updates.append("y = %s"); params.append(float(data['y']))
        if data.get('area_m2') not in (None, ''):
            updates.append("area_in_meter_square = %s"); params.append(float(data['area_m2']))

        # ── Land characteristics ──
        if data.get('land_use') is not None:
            updates.append("land_use = %s"); params.append(data['land_use'] or None)
        if data.get('zoning') is not None:
            updates.append("zoning = %s"); params.append(data['zoning'] or None)
        if data.get('zoning_percentage') not in (None, ''):
            updates.append("zoning_percentage = %s"); params.append(float(data['zoning_percentage']))
        if data.get('sentlement') is not None:
            updates.append("sentlement = %s"); params.append(data['sentlement'] or None)
        if data.get('sentlement_percentage') not in (None, ''):
            updates.append("sentlement_percentage = %s"); params.append(float(data['sentlement_percentage']))

        # ── Values per sqm ──
        if data.get('minimum_value_per_sqm') not in (None, ''):
            updates.append("minimum_value_per_sqm = %s"); params.append(float(data['minimum_value_per_sqm']))
        if data.get('weighted_average_value_per_sqm') not in (None, ''):
            updates.append("weighted_average_value_per_sqm = %s"); params.append(float(data['weighted_average_value_per_sqm']))
        if data.get('maximum_value_per_sqm') not in (None, ''):
            updates.append("maximum_value_per_sqm = %s"); params.append(float(data['maximum_value_per_sqm']))

        # ── Location text fields ──
        if data.get('cell') is not None:
            updates.append("cell = %s"); params.append(data['cell'] or None)
        if data.get('village') is not None:
            updates.append("village = %s"); params.append(data['village'] or None)

        # ── Location FK lookups (province → district → sector) ──
        for field_name, table, fk_col in [
            ('province', 'provinces', 'province_id'),
            ('district', 'districts', 'district_id'),
            ('sector',   'sectors',   'sector_id'),
        ]:
            val = data.get(field_name)
            if val not in (None, ''):
                cur.execute(f"""
                    SELECT id FROM {table}
                    WHERE LOWER(name) = LOWER(%s)
                       OR LOWER(%s) LIKE LOWER(name) || '%%'
                       OR LOWER(name) LIKE LOWER(%s) || '%%'
                    LIMIT 1
                """, (val, val, val))
                row = cur.fetchone()
                if row:
                    updates.append(f"{fk_col} = %s"); params.append(row['id'])
                else:
                    cur.close(); conn.close()
                    return jsonify({'success': False, 'message': f'{field_name.title()} "{val}" not found. Create it in Locations first.'}), 400

        if updates:
            params.append(parcel_id)
            cur.execute(f"UPDATE land_parcels SET {', '.join(updates)} WHERE id = %s", params)
            conn.commit()

        cur.close()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/admin/land-parcels/delete', methods=['POST', 'OPTIONS'])
def admin_land_parcels_delete():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json(); parcel_id = data.get('parcel_id')
        if not parcel_id:
            return jsonify({'success': False, 'message': 'parcel_id required'}), 400
        conn = get_db(); cur = conn.cursor()
        cur.execute("DELETE FROM land_parcels WHERE id = %s", (parcel_id,))
        conn.commit(); deleted = cur.rowcount > 0
        cur.close(); conn.close()
        return jsonify({'success': deleted, 'message': 'Deleted' if deleted else 'Not found'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500 


import json

@app.route('/admin/import-locations', methods=['POST', 'OPTIONS'])
def import_locations():
    if request.method == 'OPTIONS':
        return '', 204

    data = request.get_json() or {}
    admin_id = data.get('admin_id')
    
    # Admin verification
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT u.id FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = %s AND r.name IN ('admin', 'system_admin') AND u.status = 'approved'
    """, (admin_id,))
    if not cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({'success': False, 'message': 'Unauthorized'}), 403
    cur.close()
    conn.close()

    try:
        json_path = os.path.join(os.path.dirname(__file__), 'data.json')
        with open(json_path, 'r', encoding='utf-8') as f:
            location_data = json.load(f)
    except FileNotFoundError:
        return jsonify({'success': False, 'message': 'data.json not found in project root'}), 500
    except json.JSONDecodeError as e:
        return jsonify({'success': False, 'message': f'Invalid JSON: {str(e)}'}), 500

    stats = {'provinces': 0, 'districts': 0, 'sectors': 0, 'cells': 0, 'villages': 0}
    conn = get_db()
    cur = conn.cursor()

    try:
        for province_name, districts_data in location_data.items():
            # PROVINCE - NO CODE COLUMN
            cur.execute("SELECT id FROM provinces WHERE LOWER(name) = LOWER(%s)", (province_name,))
            row = cur.fetchone()
            if row:
                province_id = row['id']
            else:
                cur.execute("INSERT INTO provinces (name) VALUES (%s) RETURNING id", (province_name,))
                province_id = cur.fetchone()['id']
                stats['provinces'] += 1
                print(f"Created province: {province_name}")

            for district_name, sectors_data in districts_data.items():
                # DISTRICT - NO CODE COLUMN
                cur.execute("SELECT id FROM districts WHERE LOWER(name) = LOWER(%s) AND province_id = %s", (district_name, province_id))
                row = cur.fetchone()
                if row:
                    district_id = row['id']
                else:
                    cur.execute("INSERT INTO districts (name, province_id) VALUES (%s, %s) RETURNING id", (district_name, province_id))
                    district_id = cur.fetchone()['id']
                    stats['districts'] += 1
                    print(f"Created district: {district_name} → {province_name}")

                for sector_name, cells_data in sectors_data.items():
                    # SECTOR - NO CODE COLUMN
                    cur.execute("SELECT id FROM sectors WHERE LOWER(name) = LOWER(%s) AND district_id = %s", (sector_name, district_id))
                    row = cur.fetchone()
                    if row:
                        sector_id = row['id']
                    else:
                        cur.execute("INSERT INTO sectors (name, district_id) VALUES (%s, %s) RETURNING id", (sector_name, district_id))
                        sector_id = cur.fetchone()['id']
                        stats['sectors'] += 1
                        print(f"Created sector: {sector_name} → {district_name}")

                    if isinstance(cells_data, dict):
                        for cell_name, villages_list in cells_data.items():
                            # CELL - NO CODE COLUMN
                            cur.execute("SELECT id FROM cells WHERE LOWER(name) = LOWER(%s) AND sector_id = %s", (cell_name, sector_id))
                            row = cur.fetchone()
                            if row:
                                cell_id = row['id']
                            else:
                                cur.execute("INSERT INTO cells (name, sector_id) VALUES (%s, %s) RETURNING id", (cell_name, sector_id))
                                cell_id = cur.fetchone()['id']
                                stats['cells'] += 1
                                print(f"Created cell: {cell_name} → {sector_name}")

                            if isinstance(villages_list, list):
                                for village_name in villages_list:
                                    # VILLAGE - NO CODE COLUMN
                                    cur.execute("SELECT id FROM villages WHERE LOWER(name) = LOWER(%s) AND cell_id = %s", (village_name, cell_id))
                                    if not cur.fetchone():
                                        cur.execute("INSERT INTO villages (name, cell_id) VALUES (%s, %s)", (village_name, cell_id))
                                        stats['villages'] += 1

        conn.commit()
        print(f"\n{'='*50}")
        print(f" IMPORT COMPLETE! (No code columns)")
        print(f"   Provinces: {stats['provinces']}")
        print(f"   Districts: {stats['districts']}")
        print(f"   Sectors:   {stats['sectors']}")
        print(f"   Cells:     {stats['cells']}")
        print(f"   Villages:  {stats['villages']}")
        print(f"{'='*50}")
        
        return jsonify({
            'success': True, 
            'message': f'Import complete! {stats["provinces"]} provinces, {stats["districts"]} districts, {stats["sectors"]} sectors, {stats["cells"]} cells, {stats["villages"]} villages',
            'stats': stats
        })

    except Exception as e:
        conn.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/locations/provinces', methods=['GET'])
def get_provinces():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, name FROM provinces ORDER BY name")
    provinces = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify({'success': True, 'provinces': [dict(p) for p in provinces]})


# ══════════════════════════════════════════════════════════════
# LOCATION CRUD OPERATIONS - Complete
# ══════════════════════════════════════════════════════════════

# ── PROVINCES ──────────────────────────────────────────────
@app.route('/locations/provinces/create', methods=['POST', 'OPTIONS'])
def create_province():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        if not name:
            return jsonify({'success': False, 'message': 'Name is required'}), 400
        conn = get_db()
        cur = conn.cursor()
        cur.execute("INSERT INTO provinces (name) VALUES (%s) RETURNING id", (name,))
        new_id = cur.fetchone()['id']
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'id': new_id})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/locations/provinces/update', methods=['POST', 'OPTIONS'])
def update_province():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        pid = data.get('id')
        name = data.get('name', '').strip()
        if not pid or not name:
            return jsonify({'success': False, 'message': 'ID and Name are required'}), 400
        conn = get_db()
        cur = conn.cursor()
        cur.execute("UPDATE provinces SET name = %s WHERE id = %s", (name, pid))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/locations/provinces/delete', methods=['POST', 'OPTIONS'])
def delete_province():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        pid = data.get('id')
        if not pid:
            return jsonify({'success': False, 'message': 'ID required'}), 400
        conn = get_db()
        cur = conn.cursor()
        cur.execute("DELETE FROM provinces WHERE id = %s", (pid,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ── DISTRICTS ──────────────────────────────────────────────
@app.route('/locations/districts/create', methods=['POST', 'OPTIONS'])
def create_district():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        province_id = data.get('province_id')
        if not name or not province_id:
            return jsonify({'success': False, 'message': 'Name and Province ID are required'}), 400
        conn = get_db()
        cur = conn.cursor()
        cur.execute("INSERT INTO districts (name, province_id) VALUES (%s, %s) RETURNING id", (name, province_id))
        new_id = cur.fetchone()['id']
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'id': new_id})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/locations/districts/update', methods=['POST', 'OPTIONS'])
def update_district():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        did = data.get('id')
        name = data.get('name', '').strip()
        province_id = data.get('province_id')
        if not did or not name:
            return jsonify({'success': False, 'message': 'ID and Name are required'}), 400
        conn = get_db()
        cur = conn.cursor()
        cur.execute("UPDATE districts SET name = %s, province_id = %s WHERE id = %s", (name, province_id, did))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/locations/districts/delete', methods=['POST', 'OPTIONS'])
def delete_district():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        did = data.get('id')
        if not did:
            return jsonify({'success': False, 'message': 'ID required'}), 400
        conn = get_db()
        cur = conn.cursor()
        cur.execute("DELETE FROM districts WHERE id = %s", (did,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/locations/districts/by-province', methods=['POST', 'OPTIONS'])
def get_districts_by_province():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        province_id = data.get('province_id')
        conn = get_db()
        cur = conn.cursor()
        if province_id:
            cur.execute("SELECT id, name FROM districts WHERE province_id = %s ORDER BY name", (province_id,))
        else:
            cur.execute("SELECT id, name FROM districts ORDER BY name")
        districts = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'districts': [dict(d) for d in districts]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ── SECTORS ────────────────────────────────────────────────
@app.route('/locations/sectors/create', methods=['POST', 'OPTIONS'])
def create_sector():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        district_id = data.get('district_id')
        if not name or not district_id:
            return jsonify({'success': False, 'message': 'Name and District ID are required'}), 400
        conn = get_db()
        cur = conn.cursor()
        cur.execute("INSERT INTO sectors (name, district_id) VALUES (%s, %s) RETURNING id", (name, district_id))
        new_id = cur.fetchone()['id']
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'id': new_id})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/locations/sectors/update', methods=['POST', 'OPTIONS'])
def update_sector():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        sid = data.get('id')
        name = data.get('name', '').strip()
        district_id = data.get('district_id')
        if not sid or not name:
            return jsonify({'success': False, 'message': 'ID and Name are required'}), 400
        conn = get_db()
        cur = conn.cursor()
        cur.execute("UPDATE sectors SET name = %s, district_id = %s WHERE id = %s", (name, district_id, sid))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/locations/sectors/delete', methods=['POST', 'OPTIONS'])
def delete_sector():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        sid = data.get('id')
        if not sid:
            return jsonify({'success': False, 'message': 'ID required'}), 400
        conn = get_db()
        cur = conn.cursor()
        cur.execute("DELETE FROM sectors WHERE id = %s", (sid,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/locations/sectors/by-district', methods=['POST', 'OPTIONS'])
def get_sectors_by_district():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        district_id = data.get('district_id')
        conn = get_db()
        cur = conn.cursor()
        if district_id:
            # REMOVED 'code' from SELECT
            cur.execute("SELECT id, name FROM sectors WHERE district_id = %s ORDER BY name", (district_id,))
        else:
            # REMOVED 'code' from SELECT
            cur.execute("SELECT id, name FROM sectors ORDER BY name")
        sectors = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'sectors': [dict(s) for s in sectors]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ── CELLS ──────────────────────────────────────────────────
@app.route('/locations/cells/create', methods=['POST', 'OPTIONS'])
def create_cell():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        sector_id = data.get('sector_id')
        if not name or not sector_id:
            return jsonify({'success': False, 'message': 'Name and Sector ID are required'}), 400
        conn = get_db()
        cur = conn.cursor()
        cur.execute("INSERT INTO cells (name, sector_id) VALUES (%s, %s) RETURNING id", (name, sector_id))
        new_id = cur.fetchone()['id']
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'id': new_id})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/locations/cells/update', methods=['POST', 'OPTIONS'])
def update_cell():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        cid = data.get('id')
        name = data.get('name', '').strip()
        sector_id = data.get('sector_id')
        if not cid or not name:
            return jsonify({'success': False, 'message': 'ID and Name are required'}), 400
        conn = get_db()
        cur = conn.cursor()
        cur.execute("UPDATE cells SET name = %s, sector_id = %s WHERE id = %s", (name, sector_id, cid))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/locations/cells/delete', methods=['POST', 'OPTIONS'])
def delete_cell():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        cid = data.get('id')
        if not cid:
            return jsonify({'success': False, 'message': 'ID required'}), 400
        conn = get_db()
        cur = conn.cursor()
        cur.execute("DELETE FROM cells WHERE id = %s", (cid,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ── VILLAGES ───────────────────────────────────────────────
@app.route('/locations/villages/create', methods=['POST', 'OPTIONS'])
def create_village():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        cell_id = data.get('cell_id')
        if not name or not cell_id:
            return jsonify({'success': False, 'message': 'Name and Cell ID are required'}), 400
        conn = get_db()
        cur = conn.cursor()
        cur.execute("INSERT INTO villages (name, cell_id) VALUES (%s, %s) RETURNING id", (name, cell_id))
        new_id = cur.fetchone()['id']
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'id': new_id})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/locations/villages/update', methods=['POST', 'OPTIONS'])
def update_village():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        vid = data.get('id')
        name = data.get('name', '').strip()
        cell_id = data.get('cell_id')
        if not vid or not name:
            return jsonify({'success': False, 'message': 'ID and Name are required'}), 400
        conn = get_db()
        cur = conn.cursor()
        cur.execute("UPDATE villages SET name = %s, cell_id = %s WHERE id = %s", (name, cell_id, vid))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/locations/villages/delete', methods=['POST', 'OPTIONS'])
def delete_village():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        vid = data.get('id')
        if not vid:
            return jsonify({'success': False, 'message': 'ID required'}), 400
        conn = get_db()
        cur = conn.cursor()
        cur.execute("DELETE FROM villages WHERE id = %s", (vid,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/locations/cells/by-sector', methods=['POST', 'OPTIONS'])
def get_cells_by_sector():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json(silent=True) or {}
        sector_id = data.get('sector_id')
        conn = get_db()
        cur = conn.cursor()
        if sector_id:
            cur.execute("""
                SELECT c.id, c.name, c.sector_id, s.name as sector_name 
                FROM cells c 
                JOIN sectors s ON c.sector_id = s.id 
                WHERE c.sector_id = %s 
                ORDER BY c.name
            """, (sector_id,))
        else:
            cur.execute("""
                SELECT c.id, c.name, c.sector_id, s.name as sector_name 
                FROM cells c 
                JOIN sectors s ON c.sector_id = s.id 
                ORDER BY c.name
                LIMIT 5000
            """)
        cells = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'cells': [dict(c) for c in cells]})
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/locations/villages/by-cell', methods=['POST', 'OPTIONS'])
def get_villages_by_cell():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json(silent=True) or {}
        cell_id = data.get('cell_id')
        conn = get_db()
        cur = conn.cursor()
        if cell_id:
            cur.execute("""
                SELECT v.id, v.name, v.cell_id, c.name as cell_name 
                FROM villages v 
                JOIN cells c ON v.cell_id = c.id 
                WHERE v.cell_id = %s 
                ORDER BY v.name
            """, (cell_id,))
        else:
            cur.execute("""
                SELECT v.id, v.name, v.cell_id, c.name as cell_name 
                FROM villages v 
                JOIN cells c ON v.cell_id = c.id 
                ORDER BY v.name
                LIMIT 20000
            """)
        villages = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'villages': [dict(v) for v in villages]})
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


# ── GET CELLS AND VILLAGES FOR DROPDOWNS ───────────────────
@app.route('/locations/cells', methods=['POST', 'OPTIONS'])
def get_cells():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json(silent=True) or {}
        sector_id = data.get('sector_id')
        conn = get_db()
        cur = conn.cursor()
        if sector_id:
            cur.execute("""
                SELECT c.id, c.name, c.sector_id, s.name as sector_name 
                FROM cells c 
                JOIN sectors s ON c.sector_id = s.id 
                WHERE c.sector_id = %s ORDER BY c.name
            """, (sector_id,))
        else:
            cur.execute("""
                SELECT c.id, c.name, c.sector_id, s.name as sector_name 
                FROM cells c 
                JOIN sectors s ON c.sector_id = s.id 
                ORDER BY c.name LIMIT 100
            """)
        cells = cur.fetchall()
        cur.close(); conn.close()
        return jsonify({'success': True, 'cells': [dict(c) for c in cells]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/locations/villages', methods=['POST', 'OPTIONS'])
def get_villages():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json(silent=True) or {}
        cell_id = data.get('cell_id')
        conn = get_db()
        cur = conn.cursor()
        if cell_id:
            cur.execute("""
                SELECT v.id, v.name, v.cell_id, c.name as cell_name 
                FROM villages v 
                JOIN cells c ON v.cell_id = c.id 
                WHERE v.cell_id = %s ORDER BY v.name
            """, (cell_id,))
        else:
            cur.execute("""
                SELECT v.id, v.name, v.cell_id, c.name as cell_name 
                FROM villages v 
                JOIN cells c ON v.cell_id = c.id 
                ORDER BY v.name
            """)
        villages = cur.fetchall()
        cur.close(); conn.close()
        return jsonify({'success': True, 'villages': [dict(v) for v in villages]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ── UPDATE fetch functions to include parent names ─────────
@app.route('/locations/districts', methods=['POST', 'OPTIONS'])
def get_districts_with_parent():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json() or {}
        province_id = data.get('province_id')
        conn = get_db()
        cur = conn.cursor()
        if province_id:
            cur.execute("""
                SELECT d.id, d.name, d.province_id, p.name as province_name
                FROM districts d
                JOIN provinces p ON d.province_id = p.id
                WHERE d.province_id = %s
                ORDER BY d.name
            """, (province_id,))
        else:
            cur.execute("""
                SELECT d.id, d.name, d.province_id, p.name as province_name
                FROM districts d
                JOIN provinces p ON d.province_id = p.id
                ORDER BY d.name
            """)
        districts = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'districts': [dict(d) for d in districts]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/locations/sectors', methods=['POST', 'OPTIONS'])
def get_sectors_with_parent():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json() or {}
        district_id = data.get('district_id')
        conn = get_db()
        cur = conn.cursor()
        if district_id:
            cur.execute("""
                SELECT s.id, s.name, s.district_id, d.name as district_name
                FROM sectors s
                JOIN districts d ON s.district_id = d.id
                WHERE s.district_id = %s
                ORDER BY s.name
            """, (district_id,))
        else:
            cur.execute("""
                SELECT s.id, s.name, s.district_id, d.name as district_name
                FROM sectors s
                JOIN districts d ON s.district_id = d.id
                ORDER BY s.name
            """)
        sectors = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'sectors': [dict(s) for s in sectors]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/locations/counts', methods=['GET', 'POST', 'OPTIONS'])
def location_counts():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("""
            SELECT 
                (SELECT COUNT(*) FROM provinces) as provinces,
                (SELECT COUNT(*) FROM districts) as districts,
                (SELECT COUNT(*) FROM sectors) as sectors,
                (SELECT COUNT(*) FROM cells) as cells,
                (SELECT COUNT(*) FROM villages) as villages
        """)
        row = cur.fetchone()
        cur.close(); conn.close()
        return jsonify({'success': True, 'counts': dict(row)})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500  


from flask import send_from_directory

@app.route('/uploads/<path:filename>', methods=['GET'])
def serve_upload(filename):
    """Serve uploaded files"""
    try:
        return send_from_directory(UPLOAD_FOLDER, filename)
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 404        


# ============================================================
# ADD THESE NEW ROUTES TO app.py
# ============================================================

@app.route('/notaries/by-sector', methods=['POST', 'OPTIONS'])
def notaries_by_sector():
    """Get notaries that work in a specific sector (for seller selection)"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        sector_name = data.get('sector_name', '').strip()
        
        if not sector_name:
            return jsonify({'success': False, 'message': 'sector_name required'}), 400
        
        conn = get_db()
        cur = conn.cursor()
        
        # Get notaries that work in this sector (sector notaries) OR private notaries (can work anywhere)
        cur.execute("""
            SELECT u.id, u.full_name, u.email, u.phone,
                   COALESCE(u.notary_type, 'sector') AS notary_type,
                   COALESCE(u.sector_name, '') AS sector_name,
                   COALESCE(u.district_name, '') AS district_name,
                   COALESCE(u.license_number, '') AS license_number
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE r.name = 'notary' 
              AND u.status = 'approved'
              AND (
                  u.notary_type = 'private'
                  OR (u.notary_type = 'sector' AND LOWER(u.sector_name) = LOWER(%s))
              )
            ORDER BY u.full_name
        """, (sector_name,))
        
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        return jsonify({'success': True, 'notaries': [dict(r) for r in rows]})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/district/land-parcels', methods=['POST', 'OPTIONS'])
def district_land_parcels():
    """Get land parcels filtered by district officer's district"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        
        if not user_id:
            return jsonify({'success': False, 'message': 'user_id required'}), 400
        
        conn = get_db()
        cur = conn.cursor()
        
        # Get district of the district officer
        cur.execute("""
            SELECT district_name, district_id 
            FROM users 
            WHERE id = %s
        """, (user_id,))
        officer = cur.fetchone()
        
        if not officer:
            cur.close()
            conn.close()
            return jsonify({'success': False, 'message': 'Officer not found'}), 404
        
        district_id = officer.get('district_id')
        district_name = officer.get('district_name')
        
        # Query parcels based on district
        if district_id:
            cur.execute("""
                SELECT lp.id, lp.upi, lp.area_in_meter_square, lp.land_use,
                       lp.zoning, lp.zoning_percentage, lp.sentlement, lp.sentlement_percentage,
                       lp.minimum_value_per_sqm, lp.weighted_average_value_per_sqm, lp.maximum_value_per_sqm,
                       lp.owner_id, lp.transferred_at, lp.transfer_price, lp.owner_sex,
                       lp.owner_national_id, lp.owner_name,
                       lp.cell, lp.village, lp.x, lp.y,
                       p.name AS province, d.name AS district, s.name AS sector
                FROM land_parcels lp
                LEFT JOIN users u ON lp.owner_id = u.id
                LEFT JOIN provinces p ON lp.province_id = p.id
                LEFT JOIN districts d ON lp.district_id = d.id
                LEFT JOIN sectors s ON lp.sector_id = s.id
                WHERE lp.district_id = %s
                ORDER BY lp.created_at DESC LIMIT 500
            """, (district_id,))
        elif district_name:
            # Fallback to name match if no ID
            cur.execute("""
                SELECT lp.id, lp.upi, lp.area_in_meter_square, lp.land_use,
                       lp.zoning, lp.zoning_percentage, lp.sentlement, lp.sentlement_percentage,
                       lp.minimum_value_per_sqm, lp.weighted_average_value_per_sqm, lp.maximum_value_per_sqm,
                       lp.owner_id, lp.transferred_at, lp.transfer_price, lp.owner_sex,
                       lp.owner_national_id, lp.owner_name,
                       lp.cell, lp.village, lp.x, lp.y,
                       p.name AS province, d.name AS district, s.name AS sector
                FROM land_parcels lp
                LEFT JOIN users u ON lp.owner_id = u.id
                LEFT JOIN provinces p ON lp.province_id = p.id
                LEFT JOIN districts d ON lp.district_id = d.id
                LEFT JOIN sectors s ON lp.sector_id = s.id
                WHERE LOWER(d.name) = LOWER(%s)
                ORDER BY lp.created_at DESC LIMIT 500
            """, (district_name,))
        else:
            cur.execute("""
                SELECT lp.id, lp.upi, lp.area_in_meter_square, lp.land_use,
                       lp.zoning, lp.zoning_percentage, lp.sentlement, lp.sentlement_percentage,
                       lp.minimum_value_per_sqm, lp.weighted_average_value_per_sqm, lp.maximum_value_per_sqm,
                       lp.owner_id, lp.transferred_at, lp.transfer_price, lp.owner_sex,
                       lp.owner_national_id, lp.owner_name,
                       lp.cell, lp.village, lp.x, lp.y,
                       p.name AS province, d.name AS district, s.name AS sector
                FROM land_parcels lp
                LEFT JOIN users u ON lp.owner_id = u.id
                LEFT JOIN provinces p ON lp.province_id = p.id
                LEFT JOIN districts d ON lp.district_id = d.id
                LEFT JOIN sectors s ON lp.sector_id = s.id
                ORDER BY lp.created_at DESC LIMIT 500
            """)
        
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        result = []
        for r in rows:
            d = dict(r)
            if d.get('transferred_at'):
                d['transferred_at'] = d['transferred_at'].isoformat()
            result.append(d)
        
        return jsonify({'success': True, 'parcels': result})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/sector/land-parcels', methods=['POST', 'OPTIONS'])
def sector_land_parcels():
    """Get land parcels filtered by sector officer's sector"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        
        if not user_id:
            return jsonify({'success': False, 'message': 'user_id required'}), 400
        
        conn = get_db()
        cur = conn.cursor()
        
        # Get sector of the sector officer
        cur.execute("""
            SELECT sector_name, sector_id 
            FROM users 
            WHERE id = %s
        """, (user_id,))
        officer = cur.fetchone()
        
        if not officer:
            cur.close()
            conn.close()
            return jsonify({'success': False, 'message': 'Officer not found'}), 404
        
        sector_id = officer.get('sector_id')
        sector_name = officer.get('sector_name')
        
        # Query parcels based on sector
        if sector_id:
            cur.execute("""
                SELECT lp.id, lp.upi, lp.area_in_meter_square, lp.land_use,
                       lp.zoning, lp.zoning_percentage, lp.sentlement, lp.sentlement_percentage,
                       lp.minimum_value_per_sqm, lp.weighted_average_value_per_sqm, lp.maximum_value_per_sqm,
                       lp.owner_id, lp.transferred_at, lp.transfer_price, lp.owner_sex,
                       lp.owner_national_id, lp.owner_name,
                       lp.cell, lp.village, lp.x, lp.y,
                       p.name AS province, d.name AS district, s.name AS sector
                FROM land_parcels lp
                LEFT JOIN users u ON lp.owner_id = u.id
                LEFT JOIN provinces p ON lp.province_id = p.id
                LEFT JOIN districts d ON lp.district_id = d.id
                LEFT JOIN sectors s ON lp.sector_id = s.id
                WHERE lp.sector_id = %s
                ORDER BY lp.created_at DESC LIMIT 500
            """, (sector_id,))
        elif sector_name:
            cur.execute("""
                SELECT lp.id, lp.upi, lp.area_in_meter_square, lp.land_use,
                       lp.zoning, lp.zoning_percentage, lp.sentlement, lp.sentlement_percentage,
                       lp.minimum_value_per_sqm, lp.weighted_average_value_per_sqm, lp.maximum_value_per_sqm,
                       lp.owner_id, lp.transferred_at, lp.transfer_price, lp.owner_sex,
                       lp.owner_national_id, lp.owner_name,
                       lp.cell, lp.village, lp.x, lp.y,
                       p.name AS province, d.name AS district, s.name AS sector
                FROM land_parcels lp
                LEFT JOIN users u ON lp.owner_id = u.id
                LEFT JOIN provinces p ON lp.province_id = p.id
                LEFT JOIN districts d ON lp.district_id = d.id
                LEFT JOIN sectors s ON lp.sector_id = s.id
                WHERE LOWER(s.name) = LOWER(%s)
                ORDER BY lp.created_at DESC LIMIT 500
            """, (sector_name,))
        else:
            return jsonify({'success': True, 'parcels': []})
        
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        result = []
        for r in rows:
            d = dict(r)
            if d.get('transferred_at'):
                d['transferred_at'] = d['transferred_at'].isoformat()
            result.append(d)
        
        return jsonify({'success': True, 'parcels': result})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/notary-request/documents/review', methods=['POST', 'OPTIONS'])
def notary_review_documents():
    """Notary marks documents as reviewed/verified"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        document_id = data.get('document_id')
        request_id = data.get('request_id')
        verified = data.get('verified', True)
        notes = data.get('notes', '')
        
        if not document_id and not request_id:
            return jsonify({'success': False, 'message': 'document_id or request_id required'}), 400
        
        conn = get_db()
        cur = conn.cursor()
        
        if document_id:
            cur.execute("""
                UPDATE notary_documents
                SET verified = %s, verified_at = NOW(), notes = %s
                WHERE id = %s
                RETURNING id
            """, (verified, notes, document_id))
        else:
            # Mark all documents for this request
            cur.execute("""
                UPDATE notary_documents
                SET verified = %s, verified_at = NOW(), notes = %s
                WHERE request_id = %s
            """, (verified, notes, request_id))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Documents reviewed successfully'})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/admin/mutations/forward', methods=['POST', 'OPTIONS'])
def admin_forward_mutation_to_district():
    """Admin forwards approved mutation to district for final processing"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        transaction_id = data.get('transaction_id')
        forward_to_district = data.get('forward_to_district', True)
        admin_notes = data.get('admin_notes', '')
        
        if not transaction_id:
            return jsonify({'success': False, 'message': 'transaction_id required'}), 400
        
        conn = get_db()
        cur = conn.cursor()
        
        # Get transaction details
        cur.execute("""
            SELECT id, upi, buyer_name, seller_name, buyer_id, seller_id, 
                agreed_price, status, reference
            FROM transactions 
            WHERE id = %s
        """, (transaction_id,))
        tx = cur.fetchone()
        
        if not tx:
            cur.close()
            conn.close()
            return jsonify({'success': False, 'message': 'Transaction not found'}), 404
        
        if forward_to_district:
            cur.execute("""
                UPDATE transactions 
                SET status = 'forwarded_to_admin'
                WHERE id = %s
            """, (transaction_id,))
            
            # Create a notification for district
            district_ref = tx.get('district_ref') or ('DIST-' + uuid.uuid4().hex[:10].upper())
            cur.execute("""
                INSERT INTO reports (
                    reference, from_user_id, from_role, to_role, 
                    type, content, sent_at, read
                ) VALUES (
                    %s, %s, 'admin', 'district_land_officer',
                    'mutation_pending', %s, NOW(), FALSE
                )
            """, (district_ref, data.get('district_officer_id') or data.get('admin_id') or 1, 
                  f"Mutation {tx['reference']} approved by Admin. UPI: {tx['upi']}. "
                  f"Seller: {tx['seller_name']} → Buyer: {tx['buyer_name']}. "
                  f"Price: {tx['agreed_price'] or 0} RWF. "
                  f"Notes: {admin_notes}"))
            
            message = f"Mutation forwarded to district for processing. District will handle the parcel transfer."
        else:
            cur.execute("""
                UPDATE transactions 
                SET status = 'approved'
                WHERE id = %s
            """, (transaction_id,))
            
            # Transfer ownership
            if tx['buyer_id'] and tx['seller_id']:
                cur.execute("""
                    UPDATE land_parcels 
                    SET owner_id = %s, 
                        previous_owner_id = %s,
                        transferred_at = NOW(),
                        transfer_price = %s
                    WHERE upi = %s
                """, (tx['buyer_id'], tx['seller_id'], tx['agreed_price'], tx['upi']))
            
            message = f"Mutation approved directly. Parcel ownership transferred."
        
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({'success': True, 'message': message})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


# Add to app.py - Get documents for a notary request
@app.route('/notary-request/documents/list', methods=['POST', 'OPTIONS'])
def notary_request_documents_list():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        request_id = data.get('request_id')
        
        if not request_id:
            return jsonify({'success': False, 'message': 'request_id required'}), 400
        
        conn = get_db()
        cur = conn.cursor()
        
        # Get all documents for this request from notary_documents
        cur.execute("""
            SELECT id, doc_type, file_path, original_name, verified, uploaded_at,
                   CASE 
                       WHEN doc_type IN ('seller_id', 'spouse_id', 'buyer_id', 'land_title', 'civil_cert_seller', 'civil_cert_buyer') 
                       THEN 'buyer' 
                       ELSE 'notary' 
                   END as source
            FROM notary_documents
            WHERE request_id = %s
            ORDER BY uploaded_at DESC
        """, (request_id,))
        
        notary_docs = cur.fetchall()
        
        # Also get buyer-uploaded documents from sale_forms
        cur.execute("""
            SELECT nr.agreement_id, sf.file_seller_id, sf.file_spouse_id, sf.file_buyer_id,
                   sf.file_land_title, sf.file_civil_cert_seller, sf.file_civil_cert_buyer
            FROM notary_requests nr
            LEFT JOIN sale_forms sf ON nr.form_id = sf.id
            WHERE nr.id = %s
        """, (request_id,))
        
        sale_form = cur.fetchone()
        
        all_docs = []
        
        # Add notary uploaded docs
        for doc in notary_docs:
            all_docs.append({
                'id': doc['id'],
                'doc_type': doc['doc_type'],
                'file_path': doc['file_path'],
                'original_name': doc['original_name'],
                'verified': doc['verified'],
                'source': doc['source'],
                'uploaded_at': doc['uploaded_at'].isoformat() if doc['uploaded_at'] else None
            })
        
        # Add buyer uploaded docs from sale_forms
        if sale_form:
            buyer_doc_map = {
                'seller_id': sale_form.get('file_seller_id'),
                'spouse_id': sale_form.get('file_spouse_id'),
                'buyer_id': sale_form.get('file_buyer_id'),
                'land_title': sale_form.get('file_land_title'),
                'civil_cert_seller': sale_form.get('file_civil_cert_seller'),
                'civil_cert_buyer': sale_form.get('file_civil_cert_buyer'),
            }
            
            for doc_type, file_path in buyer_doc_map.items():
                if file_path and not any(d.get('file_path') == file_path for d in all_docs):
                    all_docs.append({
                        'id': None,
                        'doc_type': doc_type,
                        'file_path': file_path,
                        'original_name': file_path,
                        'verified': True,
                        'source': 'buyer',
                        'uploaded_at': None
                    })
        
        cur.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'documents': all_docs,
            'total': len(all_docs)
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500 


@app.route('/notary-request/documents/verify', methods=['POST', 'OPTIONS'])
def notary_request_documents_verify():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        document_id = data.get('document_id')
        request_id = data.get('request_id')
        verified = data.get('verified', True)
        
        if not document_id and not request_id:
            return jsonify({'success': False, 'message': 'document_id or request_id required'}), 400
        
        conn = get_db()
        cur = conn.cursor()
        
        if document_id:
            cur.execute("""
                UPDATE notary_documents
                SET verified = %s, verified_at = NOW()
                WHERE id = %s
            """, (verified, document_id))
        else:
            return jsonify({'success': False, 'message': 'document_id required'}), 400
        
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Document verified successfully'})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/notary-request/documents/verify-all', methods=['POST', 'OPTIONS'])
def notary_request_documents_verify_all():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        request_id = data.get('request_id')
        verified = data.get('verified', True)
        
        if not request_id:
            return jsonify({'success': False, 'message': 'request_id required'}), 400
        
        conn = get_db()
        cur = conn.cursor()
        
        cur.execute("""
            UPDATE notary_documents
            SET verified = %s, verified_at = NOW()
            WHERE request_id = %s
        """, (verified, request_id))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({'success': True, 'message': 'All documents verified successfully'})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/admin/mutations/grant-permission', methods=['POST', 'OPTIONS'])
def admin_grant_mutation_permission():
    """Admin grants permission to District to confirm mutation"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        transaction_id = data.get('transaction_id')
        admin_id = data.get('admin_id')
        admin_notes = data.get('admin_notes', '')
        
        if not transaction_id:
            return jsonify({'success': False, 'message': 'transaction_id required'}), 400
        
        conn = get_db()
        cur = conn.cursor()
        
        # Check if transaction exists and is in pending status
        cur.execute("SELECT id, status, reference FROM transactions WHERE id = %s", (transaction_id,))
        tx = cur.fetchone()
        
        if not tx:
            cur.close(); conn.close()
            return jsonify({'success': False, 'message': 'Transaction not found'}), 404
        
        if tx['status'] not in ('pending', 'forwarded_to_admin'):
            cur.close(); conn.close()
            return jsonify({'success': False, 'message': f'Transaction is {tx["status"]}, cannot grant permission'}), 400
        
        # Grant permission - change status to 'permission_granted'
        cur.execute("""
            UPDATE transactions 
            SET status = 'permission_granted'
            WHERE id = %s
        """, (transaction_id,))
        
        # Send notification to district via chat
        cur.execute("""
            INSERT INTO chat_messages 
                (room, sender_id, sender_name, sender_role, message, mutation_ref)
            VALUES 
                (%s, %s, 'System', 'admin', %s, %s)
        """, (f'mutation_{tx["reference"]}', admin_id, 
              f'Admin has reviewed and GRANTED permission to confirm mutation {tx["reference"]}. You may now confirm the land transfer.', 
              tx['reference']))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Permission granted to district to confirm mutation'})
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500 


@app.route('/district/mutations/confirm', methods=['POST', 'OPTIONS'])
def district_confirm_mutation():
    """District confirms mutation after admin grants permission"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        transaction_id = data.get('transaction_id')
        district_id = data.get('district_id')
        
        if not transaction_id:
            return jsonify({'success': False, 'message': 'transaction_id required'}), 400
        
        conn = get_db()
        cur = conn.cursor()
        
        # Get transaction details and verify permission was granted
        cur.execute("""
            SELECT id, upi, buyer_name, seller_name, buyer_id, seller_id, 
                   agreed_price, status, reference
            FROM transactions 
            WHERE id = %s
        """, (transaction_id,))
        tx = cur.fetchone()
        
        if not tx:
            cur.close(); conn.close()
            return jsonify({'success': False, 'message': 'Transaction not found'}), 404
        
        if tx['status'] != 'permission_granted':
            cur.close(); conn.close()
            return jsonify({'success': False, 'message': f'Admin must grant permission first. Status: {tx["status"]}'}), 400
        
        # Update transaction status to approved
        cur.execute("""
            UPDATE transactions 
            SET status = 'approved'
            WHERE id = %s
        """, (transaction_id,))
        
        # Transfer ownership: update land_parcels owner from seller to buyer
        if tx['buyer_id'] and tx['seller_id']:
            cur.execute("""
                UPDATE land_parcels 
                SET owner_id = %s, 
                    previous_owner_id = %s,
                    transferred_at = NOW(),
                    transfer_price = %s
                WHERE upi = %s
            """, (tx['buyer_id'], tx['seller_id'], tx['agreed_price'], tx['upi']))
            
            # Also update any associated agreements
            cur.execute("""
                UPDATE agreements 
                SET is_mutated = TRUE, 
                    mutated_at = NOW(),
                    mutation_ref = %s
                WHERE upi = %s AND seller_id = %s AND buyer_id = %s
            """, (tx['reference'], tx['upi'], tx['seller_id'], tx['buyer_id']))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': f'Mutation confirmed and parcel transferred from {tx["seller_name"]} to {tx["buyer_name"]}',
            'transaction': dict(tx)
        })
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500               


if __name__ == '__main__':
    print("\n" + "="*60)
    print("  LAND PRICE ESTIMATION — Flask API")
    print("="*60)
    app.run(debug=True, host='0.0.0.0', port=5000)