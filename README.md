# SortSight AI 📦

**AI-Powered Parcel Inspection & Intelligent Sorting System**

SortSight AI is a hackathon prototype designed to automate parcel label inspection and support sorting decisions in logistics and warehouse operations.

## The Problem

Manual parcel label inspection is repetitive, time-consuming, and prone to errors. Unreadable labels, incomplete addresses, and unsupported destinations can delay sorting operations.

## Our Solution

SortSight AI combines Google Gemini Vision with a rule-based sorting engine to:

- Extract tracking numbers and destinations from parcel label images.
- Identify missing or inconsistent label information.
- Recommend a sorting lane for supported destinations.
- Send uncertain or unsupported packages for manual review.
- Display inspection results in a web dashboard.

## Technology Stack

- **Frontend:** Next.js, React, TypeScript
- **Backend:** Python, FastAPI
- **AI:** Google Gemini Vision
- **Deployment:** Vercel and Render

## How It Works

1. Upload a parcel label image.
2. Gemini Vision extracts structured label information.
3. The sorting engine evaluates the extracted information.
4. The system returns a `SORT` or `MANUAL_REVIEW` decision.
5. The dashboard displays inspection history.

## Live Demo

https://sortsight-ai.vercel.app/

## Run Locally

### Backend

```bash
cd backend
pip install -r requirements.txt
```

Create `backend/.env` with your Gemini API configuration:

```env
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=your_supported_model
```

Start the API:

```bash
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

Start the frontend:

```bash
npm run dev
```

Open http://localhost:3000.

## Testing

The backend automated test suite passed 11 tests during development. Manual tests covered label extraction, sorting decisions, unsupported destinations, and dashboard inspection history.

## Current Limitations

- The prototype supports a limited set of sorting destinations.
- Dashboard inspection history is stored in browser local storage.
- Dashboard summary statistics include demonstration data.
- Physical conveyor hardware integration is not implemented.
- Public deployment connectivity is being verified.

## Future Improvements

- Persistent database storage
- Additional destination and routing rules
- Barcode scanning
- Human review workflow
- Integration with warehouse management systems

## Hackathon

Developed for NeuroBridge.SI Baku 2026 — AI Enterprise Solutions track.
