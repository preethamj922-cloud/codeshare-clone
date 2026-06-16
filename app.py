import os
import re
import random
import string
import sqlite3
from datetime import datetime

from flask import Flask, render_template, redirect, url_for, abort, request
from flask_socketio import SocketIO, join_room, leave_room, emit

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "codeshare-dev-secret-key")

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rooms.db")
ROOM_NAME_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{1,50}$")

DEFAULT_CODE = {
    "python": '# Welcome to CodeShare!\n# Start typing to collaborate in real-time.\n\nprint("Hello, World!")\n',
    "javascript": '// Welcome to CodeShare!\n// Start typing to collaborate in real-time.\n\nconsole.log("Hello, World!");\n',
    "c": '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}\n',
    "cpp": '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}\n',
    "java": 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n',
    "html": "<!DOCTYPE html>\n<html>\n<head>\n  <title>CodeShare</title>\n</head>\n<body>\n  <h1>Hello, World!</h1>\n</body>\n</html>\n",
    "css": "body {\n  background-color: #1e1e1e;\n  color: #ffffff;\n  font-family: sans-serif;\n}\n",
    "sql": '-- Welcome to CodeShare!\nSELECT "Hello, World!" AS greeting;\n',
}

VALID_LANGUAGES = set(DEFAULT_CODE.keys())

# In-memory tracking of connected users per room: {room_name: {sid: True}}
room_users = {}


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS rooms (
            name TEXT PRIMARY KEY,
            code TEXT NOT NULL,
            language TEXT NOT NULL DEFAULT 'python',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.commit()
    conn.close()


def is_valid_room_name(name):
    return bool(name) and bool(ROOM_NAME_PATTERN.match(name))


def get_room(name):
    conn = get_db()
    row = conn.execute("SELECT * FROM rooms WHERE name = ?", (name,)).fetchone()
    conn.close()
    return row


def create_room(name, language="python"):
    now = datetime.utcnow().isoformat()
    conn = get_db()
    conn.execute(
        "INSERT INTO rooms (name, code, language, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (name, DEFAULT_CODE.get(language, DEFAULT_CODE["python"]), language, now, now),
    )
    conn.commit()
    conn.close()


def update_room_code(name, code):
    now = datetime.utcnow().isoformat()
    conn = get_db()
    conn.execute("UPDATE rooms SET code = ?, updated_at = ? WHERE name = ?", (code, now, name))
    conn.commit()
    conn.close()


def update_room_language(name, language):
    now = datetime.utcnow().isoformat()
    conn = get_db()
    conn.execute("UPDATE rooms SET language = ?, updated_at = ? WHERE name = ?", (language, now, name))
    conn.commit()
    conn.close()


def random_room_name():
    while True:
        name = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
        if not get_room(name):
            return name


@app.route("/")
def home():
    return render_template("home.html")


@app.route("/new")
def new_room():
    return redirect(url_for("editor", room_name=random_room_name()))


@app.route("/<room_name>")
def editor(room_name):
    if not is_valid_room_name(room_name):
        abort(400, description="Invalid room name. Use only letters, numbers, hyphens, and underscores (max 50 characters).")

    room = get_room(room_name)
    if room is None:
        create_room(room_name)
        room = get_room(room_name)

    user_count = len(room_users.get(room_name, {}))

    return render_template(
        "editor.html",
        room_name=room_name,
        code=room["code"],
        language=room["language"],
        languages=sorted(VALID_LANGUAGES),
        user_count=user_count,
    )


@app.errorhandler(400)
def bad_request(e):
    return render_template("home.html", error=str(e.description)), 400


@app.errorhandler(404)
def not_found(e):
    return render_template("home.html", error="Page not found."), 404


# ---------------- SocketIO events ----------------

@socketio.on("join")
def handle_join(data):
    room_name = data.get("room")
    if not is_valid_room_name(room_name):
        return
    join_room(room_name)
    room_users.setdefault(room_name, {})[request.sid] = True

    room = get_room(room_name)
    if room is None:
        create_room(room_name)
        room = get_room(room_name)

    emit("init_state", {"code": room["code"], "language": room["language"]})

    count = len(room_users[room_name])
    emit("user_count", {"count": count}, room=room_name)


@socketio.on("code_change")
def handle_code_change(data):
    room_name = data.get("room")
    code = data.get("code", "")
    if not is_valid_room_name(room_name):
        return
    emit("code_update", {"code": code}, room=room_name, include_self=False)
    update_room_code(room_name, code)


@socketio.on("language_change")
def handle_language_change(data):
    room_name = data.get("room")
    language = data.get("language")
    if not is_valid_room_name(room_name) or language not in VALID_LANGUAGES:
        return
    emit("language_update", {"language": language}, room=room_name, include_self=False)
    update_room_language(room_name, language)


@socketio.on("disconnect")
def handle_disconnect():
    sid = request.sid
    for room_name, users in list(room_users.items()):
        if sid in users:
            del users[sid]
            leave_room(room_name)
            count = len(users)
            emit("user_count", {"count": count}, room=room_name)
            if count == 0:
                del room_users[room_name]


init_db()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host="0.0.0.0", port=port, debug=True)