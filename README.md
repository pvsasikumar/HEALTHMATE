# 🩺 HealthMate

A full-stack personal health tracking web application with AI coaching powered by Google Gemini.

---

## ✨ Features

| Module | What it does |
|---|---|
| **Dashboard** | Daily overview — water, glucose, BP, reminders, 7-day trend chart |
| **Health Tracking** | Log water intake, blood glucose, blood pressure, and medications |
| **Fitness Tracker** | Log workouts, track weekly stats, view streak |
| **Reminders** | Schedule medication reminders with browser notifications |
| **AI Coach** | Chat with Google Gemini for personalised health advice |
| **Leaderboard** | Compare your health score with other users |
| **Profile & BMI** | Personal info, goals, and automatic BMI calculation |

---

## 🗂 Project Structure

```
healthmate/
├── app.py               # Flask backend — routes & Gemini API integration
├── requirements.txt     # Python dependencies
├── .env.example         # Environment variable template
├── README.md
├── templates/
│   └── index.html       # Main SPA template (served by Flask)
└── static/
    ├── css/
    │   └── styles.css   # Responsive stylesheet (mobile + tablet + desktop)
    ├── js/
    │   └── script.js    # All frontend logic
    └── images/          # Static assets folder
```

---

## 🚀 Getting Started

### 1. Clone / download the project

```bash
cd healthmate
```

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure your Gemini API key

```bash
cp .env.example .env
```

Open `.env` and add your key:
```
GEMINI_API_KEY=your_actual_key_here
```

> Get a free API key at https://aistudio.google.com/app/apikey

### 4. Run the app

```bash
python app.py
```

Open your browser at **http://localhost:5000**

---

## 🔑 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | **Yes** | Your Google Gemini API key |
| `FLASK_DEBUG` | No | `true` / `false` (default: `true`) |
| `PORT` | No | Server port (default: `5000`) |

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Serve the SPA |
| `POST` | `/chat` | Send message to Gemini AI |
| `GET` | `/health` | Health check JSON |

### POST `/chat` — Request body

```json
{
  "message": "How much water should I drink?",
  "history": [],
  "system_context": "User profile and health data"
}
```

### POST `/chat` — Response

```json
{
  "reply": "For most adults, 2–2.5 litres per day is recommended..."
}
```

---

## 📱 Responsive Design

- **Mobile** (≤768px) — hamburger menu, stacked layout, bottom notifications
- **Tablet** (≤900px) — 2-column grids
- **Desktop** — full sidebar + multi-column layout

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3, Flask |
| AI | Google Gemini 2.0 Flash |
| Frontend | Vanilla HTML5, CSS3, JavaScript (ES2022) |
| Styling | CSS Custom Properties, Flexbox, Grid |
| Fonts | DM Sans + DM Serif Display (Google Fonts) |
| Data | Browser localStorage |

---

## 📝 Notes

- User data is stored in **browser localStorage** — no external database required.
- Passwords are stored as base64-encoded strings (suitable for demo purposes only).
- For a production deployment, replace localStorage with a proper database and use hashed passwords.

---

## 🤝 Contributing

Feel free to fork this project and add features like:
- Dark mode
- Data export (CSV/PDF)
- Push notifications via service workers
- Cloud sync with a real database
