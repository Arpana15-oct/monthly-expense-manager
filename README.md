# Monthly Expense Manager

MERN stack expense tracker jisme income/expense/budget tracking ke saath **savings goals** aur **AI suggestions** bhi hain.

## Features

- Signup / login (JWT), dark mode
- Income, expense, budget management, Excel export, reports
- **Savings Goals:** target + deadline do, app tere pichle 12 hafte ke kharch dekh ke hafte-wise plan banata hai
  - Rent/EMI jaisi fixed cheezein chhod ke flexible categories (Food, Shopping...) mein cut lagata hai
  - Overspend/underspend hone pe baaki hafton ka plan **khud adjust** hota hai
  - Agar goal us pace pe possible nahi, toh saaf bata deta hai ki max kitna bach sakta hai
- **AI Suggestions (side icon):** pichle records se suggestions, aur ye bhi ki koi category *kyun* badhi (ek bada kharch / zyada baar / doosri category se shift)

Saara calculation code mein hota hai. AI sirf samjhata hai, aur koi number khud nahi banata (galat number aaye toh response discard ho jaata hai). AI key na ho toh bhi app chalta hai.

## Setup

```bash
# Backend
cd Backend
cp .env.example .env      # phir .env mein values bharo
npm install
npm run dev               # http://localhost:8000

# Frontend (naya terminal)
cd frontend/expense-tracker
npm install
npm run dev               # http://localhost:5173
```

## Environment variables (`Backend/.env`)

| Variable | Zaroori? | Kya hai |
|---|---|---|
| `MONGO_URL` | haan | MongoDB connection string |
| `JWT_SECRET` | haan | Token sign karne ka secret |
| `PORT` | haan | Backend port (frontend `8000` maanta hai) |
| `ANTHROPIC_API_KEY` | nahi | AI notes/suggestions ke liye |

## API (naye endpoints)

| Method | Route | Kaam |
|---|---|---|
| POST | `/api/v1/goal/add` | Goal + weekly plan banao |
| GET | `/api/v1/goal/get` | Goals lo (purana plan auto-refresh hota hai) |
| POST | `/api/v1/goal/:id/replan` | Plan update + naya AI note |
| DELETE | `/api/v1/goal/:id` | Goal delete |
| GET | `/api/v1/insights/suggestions` | AI suggestions (`?refresh=1` cache skip) |