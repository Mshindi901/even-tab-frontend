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

## Participants and balances

The UI uses `GET /bills`, `POST /bills`, `GET /participants/:token`, `POST /participants/:token/join`, and `GET /participants/:token/balance`. After creating an event, the creator is added as its first participant, then balances are calculated. Balances are recalculated after every successful participant join. The participant list shows each person's paid amount and calculated balance.

The current participant API requires `amount_paid` to be greater than zero, so the creator and guests must enter a positive contribution to join. Share URLs include the event title, currency, and total as display-only query parameters because participant lookup returns participants but not event details. The backend remains unchanged.
