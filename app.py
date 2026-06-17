import os
import re
import random
import string
from datetime import datetime

from flask import Flask, render_template, redirect, url_for, abort, request, jsonify
from flask_socketio import SocketIO, join_room, leave_room, emit

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "codeshare-dev-secret-key")

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# In-memory storage for rooms (replaces SQLite for Vercel)
rooms_data = {}
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

# In-memory tracking of connected users per room: {room_name: {sid: user_label}}
room_users = {}


def is_valid_room_name(name):
    return bool(name) and bool(ROOM_NAME_PATTERN.match(name))


def get_room(name):
    """Return room dict or None."""
    return rooms_data.get(name)


def create_room(name, language="python"):
    now = datetime.utcnow().isoformat()
    rooms_data[name] = {
        "name": name,
        "code": DEFAULT_CODE.get(language, DEFAULT_CODE["python"]),
        "language": language,
        "created_at": now,
        "updated_at": now,
    }


def update_room_code(name, code):
    now = datetime.utcnow().isoformat()
    room = rooms_data.get(name)
    if room is None:
        return False
    room["code"] = code
    room["updated_at"] = now
    return True


def update_room_language(name, language):
    now = datetime.utcnow().isoformat()
    room = rooms_data.get(name)
    if room is None:
        return False
    room["language"] = language
    room["updated_at"] = now
    return True


def random_room_name():
    while True:
        name = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
        if name not in rooms_data:
            return name


def clone_room(old_name, new_name):
    room = rooms_data.get(old_name)
    if not room:
        return False
    now = datetime.utcnow().isoformat()
    rooms_data[new_name] = {
        "name": new_name,
        "code": room.get("code", DEFAULT_CODE.get(room.get("language", "python"))),
        "language": room.get("language", "python"),
        "created_at": now,
        "updated_at": now,
    }
    return True


@app.route("/customize-room", methods=["POST"])
def customize_room():
    data = request.get_json() or {}
    old_room = data.get("old_room")
    new_room = data.get("new_room")

    if not is_valid_room_name(old_room) or not is_valid_room_name(new_room):
        return jsonify({"error": "Invalid room name."}), 400

    if get_room(new_room) is not None:
        return jsonify({"error": "Room name is already taken. Please choose another."}), 409

    if not get_room(old_room):
        return jsonify({"error": "Original room not found."}), 404

    clone_room(old_room, new_room)
    return jsonify({"new_room": new_room}), 201


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
    user_label = request.sid[:8]
    room_users.setdefault(room_name, {})[request.sid] = user_label

    room = get_room(room_name)
    if room is None:
        create_room(room_name)
        room = get_room(room_name)

    emit("init_state", {"code": room["code"], "language": room["language"]})
    emit(
        "chat_message",
        {
            "sender": "System",
            "message": f"User {user_label} joined the room.",
            "timestamp": datetime.utcnow().isoformat() + "Z",
        },
        room=room_name,
    )

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


@socketio.on("chat_message")
def handle_chat_message(data):
    room_name = data.get("room")
    message = (data.get("message") or "").strip()
    if not is_valid_room_name(room_name) or not message:
        return

    sender = room_users.get(room_name, {}).get(request.sid, request.sid[:8])
    emit(
        "chat_message",
        {
            "sender": sender,
            "message": message,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        },
        room=room_name,
    )


@socketio.on("disconnect")
def handle_disconnect():
    sid = request.sid
    for room_name, users in list(room_users.items()):
        if sid in users:
            user_label = users[sid]
            del users[sid]
            leave_room(room_name)
            emit(
                "chat_message",
                {
                    "sender": "System",
                    "message": f"User {user_label} left the room.",
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                },
                room=room_name,
            )
            count = len(users)
            emit("user_count", {"count": count}, room=room_name)
            if count == 0:
                del room_users[room_name]


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host="0.0.0.0", port=port, debug=True)