# OTC Symptom Relief Assistant

A simple, rule-based web app that suggests over-the-counter (OTC) medications based on symptoms and safety exceptions. This is **not** a diagnosis tool—it is informational only.

## Stack

- **Web:** Next.js (React) + Tailwind CSS
- **iOS:** Expo (React Native) in [`mobile/`](mobile/)
- **Data:** JSON files for medication data and recommendation rules

## Phase 2 

- Symptom input
- Allergy / exception input
- Hardcoded recommendation rules
- Top 3 results with basic allergy filtering

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### iOS app

See **[mobile/README.md](mobile/README.md)** for running on your iPhone with Expo Go and building for the App Store.

```bash
cd mobile
npm start
```

### Example

**Symptoms:** headache, fever  
**Exceptions:** allergic to ibuprofen  

**Result:** Acetaminophen, Aspirin, Naproxen (ibuprofen excluded)

## Project structure

```
src/             # Web app
  app/
  data/
  lib/
mobile/          # iOS app (Expo)
  App.tsx
  data/
  lib/
```

## Roadmap (from project plan)

1. **Phase 3** — Connect Health Canada drug API
2. **Phase 4** — Expand safety logic (contraindications, age, duplicates)
3. **Phase 5** — UX polish (loading states, suggestions, mobile)

## Deploy

Deploy to [Vercel](https://vercel.com) by connecting this repository.
