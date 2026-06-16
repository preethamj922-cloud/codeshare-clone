# CodeShare Clone (Flask + Flask-SocketIO + Monaco Editor)

A real-time collaborative code editor inspired by CodeShare.io.

## Features

- Custom room URLs (e.g. `/preetham`, `/python-class`, `/interview`) — auto-created on first visit
- Live collaborative editing via WebSockets (Flask-SocketIO)
- Monaco Editor with syntax highlighting for Python, JavaScript, C, C++, Java, HTML, CSS, SQL
- Code autosaved to SQLite, restored on refresh
- Dark theme, responsive layout
- Room name validation, live user count, connection status, copy invite link, download code

## Project Structure

```
codeshare-clone/
├── app.py               # Flask application & SocketIO events
├── requirements.txt     # Python dependencies
├── README.md
├── templates/
│   ├── home.html        # Landing page
│   └── editor.html      # Editor page
└── static/
    ├── script.js        # Monaco editor + Socket.IO client logic
    └── style.css        # Dark theme styles
```

## Local Installation

1. Clone or copy the project files into a folder named `codeshare-clone`.

2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate   # Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run the app:
   ```bash
   python app.py
   ```

5. Open `http://localhost:5000` in your browser.

   Visit any room, e.g. `http://localhost:5000/python-class`.  
   Open the same URL in another tab or browser to see live sync.

The SQLite database (`rooms.db`) is created automatically on first run.

---

## Deploying to Vercel

This project includes a `vercel.json` file so you can import the repo into Vercel.

### Recommended steps

1. Push the project to GitHub.
2. In Vercel, create a new project and connect your repo.
3. Use the default Python deployment settings.
4. Deploy the project.

### Important caveat

Vercel does not currently support persistent WebSocket connections for real-time Socket.IO servers in the same way traditional platforms do. That means this app may not work reliably as a full real-time collaboration server on Vercel.

If you need the live editor and chat features to work correctly, a better choice is a platform that supports long-lived WebSocket connections such as Render, Fly, or Railway.

---

## Deploying to Render

1. Push the project to a GitHub repository.

2. On [Render](https://render.com), create a **New Web Service** and connect your repo.

3. Set the following:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn --worker-class eventlet -w 1 app:app`
   - **Environment Variable:** `SECRET_KEY` → any long random string

4. Click **Deploy**. Render will provide a public URL.

> **Important:** Use exactly **1 worker** (`-w 1`) with the `eventlet` worker class.  
> Multiple workers break WebSocket room state since `room_users` is in-memory.

---

## Environment Variables

| Variable     | Default                    | Description                        |
|-------------|----------------------------|------------------------------------|
| `SECRET_KEY` | `codeshare-dev-secret-key` | Flask session secret (change this in production!) |
| `PORT`       | `5000`                     | Port to listen on                  |

---

## Notes

- The `rooms.db` SQLite file is created next to `app.py` on first run.
- Room code persists across restarts (stored in SQLite).
- Connected user count is in-memory and resets on server restart.
- Language changes are broadcast to all users in the room in real time.
