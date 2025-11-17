# app.py - corrected version (complete)
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import mysql.connector
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from datetime import datetime, date
import time
import os, time as time_module

BASE_DIR = os.path.dirname(__file__)
UPLOAD_DIR = os.path.join(BASE_DIR, "static", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
ALLOWED_EXT = {"png", "jpg", "jpeg", "gif"}

app = Flask(__name__, static_folder="static", static_url_path="/static")
CORS(app)


from dotenv import load_dotenv
import os
load_dotenv()

def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASS"),
        database=os.getenv("DB_NAME", "smartcampus"),
    )


# def get_db_connection():
#     return mysql.connector.connect(
#         host="localhost",
#         user="root",
#         password="",
#         database="smartcampus"
#     )


def row_serialize(row):
    """
    Convert row dictionary values that are date/time/datetime into strings
    so jsonify can serialize them.
    """
    for k, v in list(row.items()):
        if isinstance(v, (datetime, date, time)):
            # use ISO-ish formats but friendly
            if isinstance(v, datetime):
                row[k] = v.strftime("%Y-%m-%d %H:%M:%S")
            elif isinstance(v, date):
                row[k] = v.strftime("%Y-%m-%d")
            else:  # time
                row[k] = v.strftime("%H:%M:%S")
        elif v is None:
            row[k] = None
        else:
            # leave as-is
            pass
    return row


# ---------------------------
# Auth endpoints
# ---------------------------
@app.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    name = data.get("fullname")
    email = data.get("email")
    password = data.get("password")
    role = data.get("role") or "student"

    if not name or not email or not password:
        return jsonify({"error": "Missing fields"}), 400

    password_hash = generate_password_hash(password)
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO users (name, email, password, role) VALUES (%s, %s, %s, %s)",
        (name, email, password_hash, role),
    )
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"message": "✅ User registered successfully!"})


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Missing fields"}), 400

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT * FROM users WHERE email = %s", (email,))
    user = cur.fetchone()
    cur.close()
    conn.close()

    if user and check_password_hash(user["password"], password):
        user.pop("password", None)
        return jsonify({"message": "✅ Login successful!", "user": user})
    else:
        return jsonify({"message": "❌ Invalid email or password!"}), 401



# ---------- helper: serialize datetimes / times / timedeltas ----------
# ---------- Ground booking endpoints ----------
from datetime import datetime, date, time as pytime, timedelta

def _serialize_row_times(row):
    """Convert DB date/time to simple strings for JSON response."""
    out = dict(row)
    # date -> ISO
    dt = out.get("date")
    if isinstance(dt, (datetime, date)):
        out["date"] = dt.isoformat()
    # start_time / end_time might be datetime.time or timedelta
    for k in ("start_time", "end_time"):
        v = out.get(k)
        if v is None:
            out[k] = None
            continue
        if isinstance(v, pytime):
            out[k] = v.strftime("%H:%M")
        elif isinstance(v, timedelta):
            total = int(v.total_seconds())
            hh = total // 3600
            mm = (total % 3600) // 60
            out[k] = f"{hh:02}:{mm:02}"
        else:
            out[k] = str(v)
    # ensure requester_name exists (if joined)
    if out.get("requester_name") is None:
        out["requester_name"] = ""
    return out


@app.route("/book_ground", methods=["POST"])
def book_ground():
    """
    POST JSON:
      { user_id, event_name, date (YYYY-MM-DD), start_time (HH:MM), end_time (HH:MM) }
    """
    data = request.get_json() or {}
    user_id = data.get("user_id")
    event_name = data.get("event_name")
    date_str = data.get("date")
    start_time = data.get("start_time")
    end_time = data.get("end_time")

    # Basic validation
    if not (user_id and event_name and date_str and start_time and end_time):
        return jsonify({"error": "Missing fields"}), 400

    # Parse/validate
    try:
        s_dt = datetime.strptime(f"{date_str} {start_time}", "%Y-%m-%d %H:%M")
        e_dt = datetime.strptime(f"{date_str} {end_time}", "%Y-%m-%d %H:%M")
        if e_dt <= s_dt:
            return jsonify({"error": "End time must be after start time"}), 400
    except Exception:
        return jsonify({"error": "Invalid date/time format; use YYYY-MM-DD and HH:MM"}), 400

    # Conflict check: pending/approved bookings overlapping on the same date
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("""
        SELECT id, start_time, end_time, status
        FROM ground_booking
        WHERE date = %s AND status IN ('Pending','Approved')
          AND (
            (start_time < %s AND end_time > %s) OR
            (start_time >= %s AND start_time < %s)
          )
    """, (date_str, end_time, start_time, start_time, end_time))
    conflicts = cur.fetchall()
    if conflicts:
        cur.close()
        conn.close()
        return jsonify({
            "error": "Conflict with existing booking",
            "conflicts": [_serialize_row_times(c) for c in conflicts]
        }), 409

    # insert
    cur.execute("""
        INSERT INTO ground_booking (user_id, event_name, date, start_time, end_time, status)
        VALUES (%s, %s, %s, %s, %s, 'Pending')
    """, (user_id, event_name, date_str, start_time, end_time))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"message": "Ground booking requested (Pending approval)"}), 201


@app.route("/update_ground_booking_status", methods=["POST"])
def update_ground_booking_status():
    """
    Admin only endpoint (server checks role in real app).
    POST JSON: { booking_id, status }  status in ("Approved","Rejected")
    """
    data = request.get_json() or {}
    booking_id = data.get("booking_id")
    status = data.get("status")
    if not booking_id or status not in ("Approved", "Rejected"):
        return jsonify({"error": "Invalid input"}), 400

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("UPDATE ground_booking SET status=%s WHERE id=%s", (status, booking_id))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"message": "Booking status updated"}), 200


@app.route("/get_ground_bookings", methods=["GET"])
def get_ground_bookings():
    """
    Query params:
      - role=admin|faculty|student (default student)
      - user_id=... (for faculty to fetch their own bookings)
      - status=Pending|Approved|Rejected|All
    """
    role = request.args.get("role", "student")
    user_id = request.args.get("user_id")
    status = request.args.get("status")

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    if role == "admin":
        if status and status != "All":
            cur.execute("""
                SELECT gb.*, u.name as requester_name
                FROM ground_booking gb
                LEFT JOIN users u ON gb.user_id = u.user_id
                WHERE gb.status = %s
                ORDER BY gb.date DESC, gb.start_time
            """, (status,))
        else:
            cur.execute("""
                SELECT gb.*, u.name as requester_name
                FROM ground_booking gb
                LEFT JOIN users u ON gb.user_id = u.user_id
                ORDER BY gb.date DESC, gb.start_time
            """)
    elif role == "faculty":
        if not user_id:
            cur.close(); conn.close()
            return jsonify({"error": "user_id required for faculty"}), 400
        if status and status != "All":
            cur.execute("""
                SELECT gb.*, u.name as requester_name
                FROM ground_booking gb
                LEFT JOIN users u ON gb.user_id = u.user_id
                WHERE gb.user_id = %s AND gb.status = %s
                ORDER BY gb.date DESC, gb.start_time
            """, (user_id, status))
        else:
            cur.execute("""
                SELECT gb.*, u.name as requester_name
                FROM ground_booking gb
                LEFT JOIN users u ON gb.user_id = u.user_id
                WHERE gb.user_id = %s
                ORDER BY gb.date DESC, gb.start_time
            """, (user_id,))
    else:
        # students: show only Approved by default
        if status and status != "All":
            cur.execute("""
                SELECT gb.*, u.name as requester_name
                FROM ground_booking gb
                LEFT JOIN users u ON gb.user_id = u.user_id
                WHERE gb.status = %s
                ORDER BY gb.date DESC, gb.start_time
            """, (status,))
        else:
            cur.execute("""
                SELECT gb.*, u.name as requester_name
                FROM ground_booking gb
                LEFT JOIN users u ON gb.user_id = u.user_id
                WHERE gb.status = 'Approved'
                ORDER BY gb.date DESC, gb.start_time
            """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    safe_rows = [_serialize_row_times(r) for r in rows]
    return jsonify(safe_rows), 200

# ----------------------------------------------------------------------------------

# ---------------------------
# Lost & Found endpoints (file upload)
# ---------------------------

@app.route("/add_lost_item", methods=["POST"])
def add_lost_item():
    """
    Accepts multipart/form-data with optional 'image' file.
    Fields:
      - item_name (required)
      - description (optional)
      - status (optional: Lost/Found/Returned)
      - user_id (optional)
      - image (file optional)
    """
    name = request.form.get("item_name")
    description = request.form.get("description")
    status = request.form.get("status") or "Lost"
    user_id = request.form.get("user_id")

    if not name:
        return jsonify({"error": "Missing item_name"}), 400

    filename = None
    if "image" in request.files:
        f = request.files["image"]
        if f and f.filename:
            ext = f.filename.rsplit(".", 1)[-1].lower()
            if ext in ALLOWED_EXT:
                safe = secure_filename(f.filename)
                filename = f"{int(time.time())}_{safe}"
                f.save(os.path.join(UPLOAD_DIR, filename))
            else:
                return jsonify({"error": "Bad file type"}), 400

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO lost_found (user_id, item_name, description, image_path, status)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (user_id, name, description, filename, status),
    )
    conn.commit()
    cur.close()
    conn.close()

    resp = {"message": "Item added"}
    if filename:
        resp["image_url"] = f"/uploads/{filename}"
    return jsonify(resp), 201


@app.route('/get_lost_items', methods=['GET'])
def get_lost_items():
    """
    Returns lost/found items and includes a full absolute image URL
    so the front-end on port 5500 can load the image from Flask (port 5000).
    Optional query param: ?status=Lost|Found|Returned
    """
    status = request.args.get('status')
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    if status:
        cur.execute(
            "SELECT lf.*, u.name as posted_by_name FROM lost_found lf "
            "LEFT JOIN users u ON lf.user_id=u.user_id "
            "WHERE lf.status=%s ORDER BY posted_at DESC",
            (status,),
        )
    else:
        cur.execute(
            "SELECT lf.*, u.name as posted_by_name FROM lost_found lf "
            "LEFT JOIN users u ON lf.user_id=u.user_id ORDER BY posted_at DESC"
        )

    rows = cur.fetchall()
    cur.close()
    conn.close()

    # e.g. http://127.0.0.1:5000/static/uploads/1638123_myfile.jpg
    base = request.host_url.rstrip('/')  # e.g. http://127.0.0.1:5000
    for r in rows:
        if r.get('image_path'):
            r['image_url'] = f"{base}/static/uploads/{r['image_path']}"
        else:
            r['image_url'] = None

    return jsonify(rows)



@app.route("/update_lost_status", methods=["POST"])
def update_lost_status():
    data = request.get_json()
    item_id = data.get("item_id")
    status = data.get("status")
    if not item_id or status not in ("Lost", "Found", "Returned"):
        return jsonify({"error": "Invalid input"}), 400
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("UPDATE lost_found SET status=%s WHERE item_id=%s", (status, item_id))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"message": "Status updated"})


# ---------- Auditorium booking endpoint----------
#from datetime import datetime, date, time as pytime

from datetime import datetime, date, time as pytime, timedelta

def _serialize_row_datetime(row):
    out = dict(row)
    # Convert MySQL DATE, TIME, DATETIME, and TIMEDELTA to strings
    for key, val in list(out.items()):
        if isinstance(val, (datetime, date)):
            out[key] = val.isoformat()
        elif isinstance(val, pytime):
            out[key] = val.strftime("%H:%M:%S")
        elif isinstance(val, timedelta):
            # MySQL sometimes returns TIME as timedelta (hours, minutes, seconds)
            total_seconds = int(val.total_seconds())
            h = total_seconds // 3600
            m = (total_seconds % 3600) // 60
            s = total_seconds % 60
            out[key] = f"{h:02d}:{m:02d}:{s:02d}"
        elif val is None:
            out[key] = None
    if out.get("requester_name") is None:
        out["requester_name"] = ""
    return out


@app.route("/book_auditorium", methods=["POST"])
def book_auditorium():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    event_name = data.get("event_name")
    date_str = data.get("date")
    start_time = data.get("start_time")
    end_time = data.get("end_time")

    if not (user_id and event_name and date_str and start_time and end_time):
        return jsonify({"error": "Missing fields"}), 400

    # parse/validate
    try:
        s_dt = datetime.strptime(f"{date_str} {start_time}", "%Y-%m-%d %H:%M")
        e_dt = datetime.strptime(f"{date_str} {end_time}", "%Y-%m-%d %H:%M")
        if e_dt <= s_dt:
            return jsonify({"error": "End time must be after start time"}), 400
    except Exception:
        return jsonify({"error": "Invalid date/time format; use YYYY-MM-DD and HH:MM"}), 400

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    # check conflict with Pending/Approved on same date
    cur.execute("""
        SELECT id, start_time, end_time, status
        FROM auditorium_booking
        WHERE date = %s AND status IN ('Pending','Approved')
          AND (
            (start_time < %s AND end_time > %s) OR
            (start_time >= %s AND start_time < %s)
          )
        """, (date_str, end_time, start_time, start_time, end_time))
    conflicts = cur.fetchall()
    if conflicts:
        cur.close()
        conn.close()
        # return conflict details (safe)
        simple_conflicts = []
        for c in conflicts:
            simple_conflicts.append({
                "id": c.get("id"),
                "start_time": (c.get("start_time").strftime("%H:%M") if isinstance(c.get("start_time"), pytime) else str(c.get("start_time"))),
                "end_time": (c.get("end_time").strftime("%H:%M") if isinstance(c.get("end_time"), pytime) else str(c.get("end_time"))),
                "status": c.get("status")
            })
        return jsonify({"error": "Conflict with existing booking", "conflicts": simple_conflicts}), 409

    cur.execute(
        "INSERT INTO auditorium_booking (user_id, event_name, date, start_time, end_time, status) VALUES (%s, %s, %s, %s, %s, 'Pending')",
        (user_id, event_name, date_str, start_time, end_time)
    )
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"message": "✅ Auditorium booking requested (Pending approval)"}), 201


@app.route("/get_auditorium_bookings", methods=["GET"])
def get_auditorium_bookings():
    role = request.args.get("role", "student")
    user_id = request.args.get("user_id")
    status = request.args.get("status")  # optional

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    if role == "admin":
        if status and status != "All":
            cur.execute("""
                SELECT ab.*, u.name as requester_name
                FROM auditorium_booking ab
                LEFT JOIN users u ON ab.user_id = u.user_id
                WHERE ab.status = %s
                ORDER BY ab.date DESC, ab.start_time
            """, (status,))
        else:
            cur.execute("""
                SELECT ab.*, u.name as requester_name
                FROM auditorium_booking ab
                LEFT JOIN users u ON ab.user_id = u.user_id
                ORDER BY ab.date DESC, ab.start_time
            """)
    elif role == "faculty":
        if not user_id:
            cur.close()
            conn.close()
            return jsonify({"error": "user_id required for faculty"}), 400
        if status and status != "All":
            cur.execute("""
                SELECT ab.*, u.name as requester_name
                FROM auditorium_booking ab
                LEFT JOIN users u ON ab.user_id = u.user_id
                WHERE ab.user_id = %s AND ab.status = %s
                ORDER BY ab.date DESC, ab.start_time
            """, (user_id, status))
        else:
            cur.execute("""
                SELECT ab.*, u.name as requester_name
                FROM auditorium_booking ab
                LEFT JOIN users u ON ab.user_id = u.user_id
                WHERE ab.user_id = %s
                ORDER BY ab.date DESC, ab.start_time
            """, (user_id,))
    else:
        # students: default Approved only
        if status and status != "All":
            cur.execute("""
                SELECT ab.*, u.name as requester_name
                FROM auditorium_booking ab
                LEFT JOIN users u ON ab.user_id = u.user_id
                WHERE ab.status = %s
                ORDER BY ab.date DESC, ab.start_time
            """, (status,))
        else:
            cur.execute("""
                SELECT ab.*, u.name as requester_name
                FROM auditorium_booking ab
                LEFT JOIN users u ON ab.user_id = u.user_id
                WHERE ab.status = 'Approved'
                ORDER BY ab.date DESC, ab.start_time
            """)

    rows = cur.fetchall()
    cur.close()
    conn.close()

    safe_rows = [_serialize_row_datetime(r) for r in rows]
    return jsonify(safe_rows)


@app.route("/update_auditorium_booking_status", methods=["POST"])
def update_auditorium_booking_status():
    data = request.get_json() or {}
    booking_id = data.get("booking_id")
    status = data.get("status")
    if not booking_id or status not in ("Approved", "Rejected"):
        return jsonify({"error": "Invalid input"}), 400
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("UPDATE auditorium_booking SET status=%s WHERE id=%s", (status, booking_id))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"message": "Auditorium booking status updated"})



# ---------------------------
# Faculty availability (secure)
# ---------------------------
@app.route("/update_availability", methods=["POST"])
def update_availability():
    data = request.get_json() or {}
    faculty_name = data.get("faculty_name")
    new_status = data.get("status")

    # basic validation
    if not faculty_name or not new_status:
        return jsonify({"error": "Missing data"}), 400

    # ---------- server-side role + identity check ----------
    # Read role/name from headers (frontend must send these)
    requester_role = (request.headers.get("X-User-Role") or "").lower()
    requester_name = request.headers.get("X-User-Name") or ""

    # Only faculty may update availability
    if requester_role != "faculty":
        return jsonify({"error": "Only faculty may update availability"}), 403

    # Faculty may only update their own availability (prevent changing others)
    # compare names exactly (you can adjust normalization if needed)
    if requester_name != faculty_name:
        return jsonify({"error": "You may update only your own availability"}), 403

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)

        # upsert behavior: update if exists else insert
        cur.execute("SELECT id FROM faculty_availability WHERE faculty_name = %s", (faculty_name,))
        existing = cur.fetchone()

        if existing:
            cur.execute(
                "UPDATE faculty_availability SET status=%s, updated_at=CURRENT_TIMESTAMP WHERE faculty_name=%s",
                (new_status, faculty_name),
            )
        else:
            cur.execute(
                "INSERT INTO faculty_availability (faculty_name, status) VALUES (%s, %s)",
                (faculty_name, new_status),
            )

        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"message": "✅ Availability updated successfully!"}), 200

    except Exception as e:
        print("Error in update_availability:", e)
        return jsonify({"error": "Database error"}), 500


# alias kept for compatibility
@app.route("/update_faculty_availability", methods=["POST"])
def update_faculty_availability():
    return update_availability()


# read-only endpoints unchanged
@app.route("/get_availability", methods=["GET"])
def get_availability():
    faculty_name = request.args.get("faculty_name")
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT status FROM faculty_availability WHERE faculty_name = %s", (faculty_name,))
    data = cur.fetchone()
    cur.close()
    conn.close()

    if data:
        return jsonify(data)
    else:
        return jsonify({"status": "Available"})


@app.route("/list_faculty_availability", methods=["GET"])
def list_faculty_availability():
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT * FROM faculty_availability ORDER BY updated_at DESC")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify(rows)



# ---------------------------
# Admin user management
# ---------------------------
@app.route("/get_users", methods=["GET"])
def get_users():
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT user_id, name, email, role, created_at FROM users ORDER BY created_at DESC")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify(rows)


@app.route("/update_user_role", methods=["POST"])
def update_user_role():
    data = request.get_json()
    user_id = data.get("user_id")
    role = data.get("role")
    if not user_id or role not in ("student", "faculty", "admin"):
        return jsonify({"error": "invalid input"}), 400

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("UPDATE users SET role=%s WHERE user_id=%s", (role, user_id))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"message": "User role updated"})


@app.route("/delete_user", methods=["POST"])
def delete_user():
    data = request.get_json()
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "invalid input"}), 400

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM users WHERE user_id=%s", (user_id,))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"message": "User deleted"})

if __name__ == "__main__":
    app.run(debug=True)
