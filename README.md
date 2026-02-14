# 🇷🇴 Kids Romanian Practice

A **Rosetta Stone-style** Romanian language learning app built for your kids. Run it locally on your home network and let your children practice from their iPads!

## Features

- 🔐 **Simple login system** — each kid has their own account
- 📚 **Structured lessons** — vocabulary intro → exercises (multiple choice, matching, typing)
- 💾 **Progress saving** — kids can leave and come back to where they left off
- 📊 **Parent dashboard** — view each child's scores, progress charts, and analytics
- ✏️ **Easy lesson creation** — drop JSON files in the `/lessons` folder or use the admin panel
- 📱 **iPad-friendly** — responsive design optimized for touch devices
- 🎉 **Fun & engaging** — confetti on good scores, playful animations, kid-friendly design

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start
```

Then open `http://localhost:3000` in your browser.

**Default parent account:**
- Username: `parent`
- Password: `parent123`

### Access from iPads on your network

Find your computer's local IP address and have the kids go to `http://<your-ip>:3000` on their iPads.

## Adding Lessons

### Option 1: Drop a JSON file
Create a `.json` file in the `/lessons` folder following the template in `_template.json`. Restart the server.

### Option 2: Admin panel
Log in as a parent → Dashboard → Manage Lessons → paste JSON and save.

### Lesson JSON Format

```json
{
  "id": "unique-id",
  "title": "Lecția — Lesson Title",
  "description": "What the lesson covers",
  "category": "Basics",
  "level": 1,
  "order": 1,
  "icon": "📚",
  "vocabulary": [
    {
      "romanian": "Cuvânt",
      "english": "Word",
      "pronunciation": "coo-VUHNT",
      "example": {
        "romanian": "Aceasta este un cuvânt.",
        "english": "This is a word."
      }
    }
  ],
  "exercises": [
    {
      "type": "multiple_choice",
      "question": "What does 'Cuvânt' mean?",
      "options": ["Word", "Sentence", "Letter", "Book"],
      "correctAnswer": 0
    },
    {
      "type": "match",
      "instruction": "Match the pairs",
      "pairs": [
        { "romanian": "Cuvânt", "english": "Word" }
      ]
    },
    {
      "type": "type_answer",
      "question": "Type 'Word' in Romanian",
      "answer": "Cuvânt",
      "acceptAlternatives": ["cuvant"]
    }
  ]
}
```

### Exercise Types

| Type | Description |
|------|-------------|
| `multiple_choice` | English question, pick the answer |
| `multiple_choice_romanian` | Ask how to say something in Romanian |
| `match` | Match Romanian ↔ English pairs |
| `type_answer` | Type the translation |
| `translate` | Translate a sentence |

## Included Lessons

1. 👋 **Salutări** — Greetings (hello, goodbye, please, thank you)
2. 🎨 **Culorile** — Colors
3. 🔢 **Numerele** — Numbers 1–20
4. 🐾 **Animalele** — Animals
5. 👨‍👩‍👧‍👦 **Familia** — Family members

## Tech Stack

- **Backend:** Node.js + Express
- **Database:** SQLite (via sql.js — no native dependencies)
- **Frontend:** Vanilla HTML/CSS/JS (single page app)
- **Charts:** Chart.js
