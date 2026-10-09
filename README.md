# 🇷🇴 Kids Romanian Practice

A **Rosetta Stone-style** Romanian language learning app built for your kids. Run it locally on your home network and let your children practice from their iPads!

## Features

- 🔐 **Simple login system** — student/parent/admin roles
- 👶 **Guest mode** — practice any lesson without login (no saved progress/stats)
- 📚 **Structured lessons** — vocabulary intro → exercises (multiple choice, matching, typing)
- 🔁 **Adaptive review** — missed items are repeated automatically within the lesson
- ➡️ **Auto progression** — move to the next lesson automatically after strong scores
- 💾 **Progress saving** — kids can leave and come back to where they left off
- 📊 **Parent dashboard** — view each child's scores and progress charts
- 🌐 **Admin analytics** — site visits, top paths, auth activity, and recent traffic
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

**Default admin account:**
- Username: `admin`
- Password: `admin123`

### Access from iPads on your network

Find your computer's local IP address and have the kids go to `http://<your-ip>:3000` on their iPads.

## Adding Lessons

### Option 1: Drop a JSON file
Create a `.json` file in the `/lessons` folder following the template in `_template.json`. Restart the server.

### Option 2: Admin panel
Log in as a parent/admin → Dashboard → Manage Lessons → paste JSON and save.

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
    },
    {
      "type": "listen_and_select",
      "prompt": "măr",
      "instruction": "Tap play, then choose the right image",
      "options": [
        { "emoji": "🍎", "text": "apple" },
        { "emoji": "📚", "text": "book" },
        { "emoji": "🚗", "text": "car" },
        { "emoji": "⭐", "text": "star" }
      ],
      "correctAnswer": 0,
      "hideLabels": true,
      "showPromptText": false
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
| `listen_and_select` | Tap play, hear Romanian audio (TTS), choose image/action |

## Included Lessons

1. 👋 **Salutări** — Greetings (hello, goodbye, please, thank you)
2. 🎨 **Culorile** — Colors
3. 🔢 **Numerele** — Numbers 1–20
4. 🐾 **Animalele** — Animals
5. 👨‍👩‍👧‍👦 **Familia** — Family members
6. 🧸 **Pre-K — Ascultă și Alege** — Audio-first object picking (non-readers)
7. 🤸 **Pre-K — Ascultă și Mișcă** — Audio-first action picking (non-readers)
8. 🐾 **Pre-K — Animals** — Audio-first animal recognition
9. 🧍 **Pre-K — Body Parts** — Audio-first body part recognition
10. 🧸 **Pre-K — Toys** — Audio-first toy recognition
11. 🪥 **Pre-K — Daily Routines** — Audio-first everyday actions
12. 🏫 **Pre-K — Classroom Commands** — Audio-first classroom prompts
13. 🏠 **Acasă — Home Commands** — core commands used at home
14. 🙂 **Sentimente — Feelings** — emotional vocabulary for kids
15. 🍎 **Mâncare — Food & Snacks** — common food/drink words
16. 📍 **Locuri — Places** — home/school/park and nearby places
17. ↕️ **Opuse — Opposites** — high-frequency opposite pairs
18. 🚗 **Vehicule — Vehicles** — moving toys & transport
19. 🇲🇩 **Graiul Moldovenesc — Vorba Noastră** — Moldovan words (harbuz, zămos, păpușoi, curechi, etc.)
20. 🗣️ **Expresii & Salutări Moldovenești** — family and greeting phrases (Noroc!, Hai la masă!)
21. 🧸 **Pre-K — Gusturi & Cuvinte din Moldova** — audio-first Moldovan matching for young kids


## Tech Stack

- **Backend:** Node.js + Express
- **Database:** SQLite (via sql.js — no native dependencies)
- **Frontend:** Vanilla HTML/CSS/JS (single page app)
- **Charts:** Chart.js
