# APEX — Coach Musculation IA

PWA de coaching musculation 100% pilotée par l'IA Claude.

## Setup

1. `npm install`
2. Copier `.env.local.example` → `.env.local` et renseigner votre clé Anthropic
3. `npm run dev`

## Deploy (Netlify)

Push sur main → Netlify build automatique via `netlify.toml`

La clé API Anthropic est saisie directement dans l'app (stockée localement, jamais transmise au serveur).

## Stack

React 18 + Vite + TypeScript + Tailwind CSS + Zustand + Dexie.js + Anthropic SDK + Framer Motion + Recharts + PWA
