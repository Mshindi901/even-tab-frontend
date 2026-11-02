# Eventab frontend

Eventab is a responsive event and shared-cost frontend, designed with Kenyan groups in mind. KES is the default currency and the interface uses Kenyan English currency formatting.

## Run locally

```bash
npm install
npm run dev
```

The production API base URL defaults to `https://even-tab-backend.onrender.com/api`. During development, `/api` requests are proxied to `https://even-tab-backend.onrender.com` to avoid cross-origin browser requests. Set `VITE_API_PROXY_TARGET` in a frontend `.env` file to point the proxy at another backend origin:

```env
VITE_API_PROXY_TARGET=http://localhost:4000
```

To override the API base URL, set `VITE_API_URL` to the full backend URL including `/api`. Production deployments that call the backend directly require the backend's CORS configuration to allow the frontend's origin.

## How it works

The landing page explains the flow just below the intro: create an event and set its total, share the joining link with the group, then track what people have paid.

## Backend API expectations

The UI uses `GET /bills`, `POST /bills`, `GET /participants/:token`, and `POST /participants/:token/join`. Share URLs use the public token returned in the bill list. Since `POST /bills` currently returns only a success message, the frontend reloads the list and identifies the new bill by its ID; if it cannot identify it, it reports that a share link could not be made rather than inventing a token.

The participant lookup currently returns participants but not event details, so shared links include the event title, currency, and total as display-only query parameters. The backend remains unchanged.
