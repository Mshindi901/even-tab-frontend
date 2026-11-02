# Eventab frontend

Eventab is a responsive event and shared-cost frontend, designed with Kenyan groups in mind. KES is the default currency and the interface uses Kenyan English currency formatting.

## Run locally

```bash
npm install
npm run dev
```

The app calls `/api` on its own origin. In development, Vite proxies `/api` to `https://even-tab-backend.onrender.com`; on Vercel, `vercel.json` rewrites `/api` to the backend. This avoids browser cross-origin requests. Set `VITE_API_PROXY_TARGET` in a frontend `.env` file to change the development proxy target:

```env
VITE_API_PROXY_TARGET=http://localhost:4000
```

If you set `VITE_API_URL` to a full backend URL, the backend must allow the frontend origin through CORS. The hosted backend currently returns a mismatched `Access-Control-Allow-Origin` value for the Vercel site, so use the same-origin rewrite unless backend CORS is corrected.

## How it works

The landing page explains the flow just below the intro: create an event and set its total, share the joining link with the group, then track what people have paid.

## Backend API expectations

The UI uses `GET /bills`, `POST /bills`, `GET /participants/:token`, and `POST /participants/:token/join`. Share URLs use the public token returned in the bill list. Since `POST /bills` currently returns only a success message, the frontend reloads the list and identifies the new bill by its ID; if it cannot identify it, it reports that a share link could not be made rather than inventing a token.

The participant lookup currently returns participants but not event details, so shared links include the event title, currency, and total as display-only query parameters. The backend remains unchanged.
