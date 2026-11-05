# Ella

אפליקציית דסקטופ לסטודנטיות (Windows + Mac): מחברות לימוד בעברית, סיכומים, כרטיסיות לייטנר עם spaced repetition, ומצב AI אופציונלי למבחנים אמריקאיים ושיטת פיינמן.

## הרצה בפיתוח

```bash
npm install
npm run dev
```

## בנייה

```bash
# חבילה לארוזה (תיקייה) — Windows
npm run pack

# מתקין Windows
npm run dist:win

# ב-Mac בלבד:
npm run dist:mac
```

הפלט בתיקיית `release/` (למשל `release/win-unpacked/Ella.exe`).

ב-Windows מומלץ: `$env:CSC_IDENTITY_AUTO_DISCOVERY='false'` אם אין תעודת חתימה.

## AI

בהפעלה הראשונה אפשר לבחור **עם AI** או **בלי AI**. עם AI יש להזין מפתח OpenAI API (נשמר מוצפן מקומית). הכרטיסיות נבנות ידנית בלבד — ה-AI לא יוצר כרטיסיות.
