# hash_passwords.py
from werkzeug.security import generate_password_hash
import mysql.connector

def get_db_connection():
    return mysql.connector.connect(
        host="localhost", user="root", password="Akash@93", database="smartcampus"
    )

def main():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT user_id, password FROM users")
    rows = cursor.fetchall()

    for r in rows:
        user_id = r['user_id']
        pwd = r['password'] or ""
        # If password looks already hashed (start with 'pbkdf2:'), skip
        if pwd.startswith("pbkdf2:") or pwd.startswith("sha256$") or len(pwd) > 40:
            print(f"Skipping user {user_id} (looks hashed).")
            continue
        new_hash = generate_password_hash(pwd)
        cursor2 = conn.cursor()
        cursor2.execute("UPDATE users SET password=%s WHERE user_id=%s", (new_hash, user_id))
        conn.commit()
        cursor2.close()
        print(f"Hashed user {user_id}")

    cursor.close()
    conn.close()
    print("Done.")

if __name__ == "__main__":
    main()
