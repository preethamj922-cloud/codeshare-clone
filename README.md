# CodeShare Clone (Flask + Flask-SocketIO + Monaco Editor)

A real-time collaborative code editor inspired by CodeShare.io.

## Features
- Custom room URLs (e.g. `/preetham`, `/python-class`, `/interview`) — auto-created on first visit
- Live collaborative editing via WebSockets (Flask-SocketIO)
- Monaco Editor with syntax highlighting for Python, JavaScript, C, C++, Java, HTML, CSS, SQL
- Code autosaved to SQLite, restored on refresh
- Dark theme, responsive layout
- Room name validation, user count, connection status, copy invite link, download code

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
5. Open `http://localhost:5000` in your browser. Visit any room, e.g. `http://localhost:5000/python-class`. Open the same URL in another tab/browser to see live sync.

The SQLite database (`rooms.db`) is created automatically on first run.

## Deploying to Render

1. Push the project to a GitHub repository.
2. On [Render](https://render.com), create a **New Web Service** and connect your repo.
3. Set the following:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:**