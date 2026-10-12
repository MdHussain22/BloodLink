# BloodLink — VS Code + Vercel + MongoDB Compass

This project is prepared for local VS Code development and single-project Vercel deployment:
- React + Vite frontend
- Express API running locally as Node, and on Vercel as a serverless function
- MongoDB Atlas database, viewable through MongoDB Compass
- JWT authentication, bcrypt password hashing, validation, rate limiting
- Donor registration/availability, blood requests, preliminary ABO/Rh filtering, request acceptance, and stored in-app notifications

## 1. Install requirements
- Node.js 20 or newer: https://nodejs.org/
- MongoDB Atlas: https://www.mongodb.com/cloud/atlas
- MongoDB Compass (optional): https://www.mongodb.com/products/tools/compass
- Vercel: https://vercel.com/

## 2. Create a MongoDB Atlas database
1. Create a free Atlas cluster.
2. Under **Database Access**, create a database username and strong password.
3. Under **Network Access**, add your current IP for local testing. For Vercel, follow Atlas' current Vercel connectivity guidance. `0.0.0.0/0` permits connections from all IPs and is less secure; if temporarily needed for a classroom demo, use a strong database password and remove the rule when no longer needed.
4. Click **Connect → Drivers**, copy the connection string, and replace the username/password. It looks like:
   `mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/bloodlink?retryWrites=true&w=majority`
5. If the password has special characters, URL-encode them. Do not share the URI publicly.

## 3. Connect MongoDB Compass
1. Open Compass and click **Add new connection**.
2. Paste the same Atlas connection string and click **Connect**.
3. Run the app and register a user or create a request. Refresh Compass: the `bloodlink` database and `users`, `bloodrequests`, and `notifications` collections appear after records are inserted.
4. Keep credentials in `.env`; never commit them to GitHub.

## 4. Run in VS Code
1. Extract the ZIP and open the `BloodLink-VSCode-Vercel` folder in VS Code.
2. Open the terminal in the project root and run `npm install`.
3. Copy `.env.example` to `.env` (PowerShell: `Copy-Item .env.example .env`).
4. Put your Atlas URI in `MONGODB_URI`. Set `JWT_SECRET` to a random string of at least 32 characters. Keep `CLIENT_ORIGINS=http://localhost:5173` for local use.
5. Start frontend and backend together: `npm run dev`.
6. Open `http://localhost:5173`. API health check: `http://localhost:5000/api/health`.

## 5. Deploy frontend + backend together to Vercel
1. Create a GitHub repository and push the project. Do **not** upload `.env`.
2. Visit https://vercel.com/new and import the repository.
3. Use the Vite preset. Build command: `npm run build`; output directory: `dist`.
4. In **Project → Settings → Environment Variables**, add:
   - `MONGODB_URI` = your MongoDB Atlas connection URI
   - `JWT_SECRET` = a different random 32+ character secret
   - `CLIENT_ORIGINS` = your exact site origin, e.g. `https://bloodlink-yourname.vercel.app`
   - `DONATION_COOLDOWN_DAYS` = `90`
5. Redeploy after adding variables.
6. Test `https://YOUR-PROJECT.vercel.app/api/health` — it should return JSON with `status: ok`.
7. Frontend defaults to `/api`, so you do not need `VITE_API_URL` when frontend and backend are deployed in this same Vercel project.

## 6. Demo flow
1. Register one requester and one donor in the same city.
2. Sign in as the donor and turn on **Available to be contacted**.
3. Sign in as requester and post a request for the same city and a compatible declared blood group.
4. Sign in as donor and accept the request.
5. Check the `users`, `bloodrequests`, and `notifications` collections in Compass.

## API routes
- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PATCH /api/donors/me`
- `PATCH /api/donors/availability`
- `GET /api/donors/matches?requestId=...`
- `POST /api/requests`
- `GET /api/requests`
- `POST /api/requests/:id/accept`
- `POST /api/requests/:id/fulfill`
- `POST /api/requests/:id/cancel`
- `GET /api/notifications`

## Honest safety note
This is a college demonstration MVP, not a certified medical/emergency service. Matching is only a preliminary software filter; hospitals and licensed blood banks must independently verify eligibility, testing, compatibility, and arrangements. It does not guarantee donor availability or response. Never delay emergency care while waiting for an app response. Before real public launch, add email verification, password recovery, abuse/admin workflows, tested privacy and consent procedures, monitoring/backups, independent security review, and professional clinical/operational review. Notifications are stored in-app; SMS/email delivery is not configured.
