# Hive frontend

Hive is a small, responsive frontend for creating shared bills and inviting people to join by link.

## Run locally

```bash
npm install
npm run dev
```

During development, `/api` requests are proxied to `http://localhost:3000` to avoid cross-origin browser requests. Set `VITE_API_PROXY_TARGET` in a frontend `.env` file to point the proxy at another backend origin:

```env
VITE_API_PROXY_TARGET=http://localhost:4000
```

For deployments, serve or proxy `/api` from the same origin as the frontend, or set `VITE_API_URL` to the backend's full `/api` URL (the backend must allow that origin).

## Backend API expectations

The UI uses `GET /bills`, `POST /bills`, `GET /participants/:token`, and `POST /participants/:token/join`. Share URLs use the public token returned in the bill list. Since `POST /bills` currently returns only a success message, the frontend reloads the list and identifies the new bill by its ID; if it cannot identify it, it reports that a share link could not be made rather than inventing a token.

The participant lookup currently returns participants but not bill details, so shared links include the plan title, currency, and total as display-only query parameters. The backend remains unchanged.
