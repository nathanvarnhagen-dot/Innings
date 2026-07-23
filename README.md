# Innings

Innings is a mobile-first web app for keeping track of the people and moments that matter. Users can sign in with a US mobile number, save past memories, plan future moments, browse a feed and calendar, manage a profile, and install the site on a phone as a Progressive Web App (PWA).

## Main features

- Phone-number sign-in and first-time profile setup
- Feed, calendar, memories, and profile views
- Past memories and future plans, including photo uploads
- Moment details, RSVPs, and event chat support
- Notifications and a festival experience
- Installable, mobile-first PWA interface

## Technology

The frontend is built with React 19, TypeScript, and Vite. It uses:

- Firebase Authentication for SMS sign-in
- Cloud Firestore for profiles, moments, RSVPs, and chat data
- Firebase Storage for uploaded photos
- React Router for page navigation
- TanStack Query for asynchronous data state
- React Hook Form and Zod for form handling and validation
- Vitest and Testing Library for automated tests
- ESLint for static analysis
- `vite-plugin-pwa` for the web app manifest and service worker

## Requirements

- Node.js 20.19 or newer (a current Node.js LTS release is recommended)
- npm, which is included with Node.js
- A modern web browser
- Access to the configured Firebase project for working authentication and saved data

For a beginner-friendly setup walkthrough, see [getting-started.md](getting-started.md).

## Local development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local address printed in the terminal, normally `http://localhost:5173`.

## Firebase configuration

The repository currently includes a default Firebase web configuration in `src/firebase/client.ts`, so no environment file is required to start the app. That configuration identifies the Firebase project; it is not a Firebase administrator credential.

To use a different Firebase project, create a `.env.local` file in the project root with these values:

```dotenv
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

The Firebase project must have Phone Authentication enabled and must allow the app's host in Authentication's authorized domains. Its Firestore, Storage, SMS region, security-rule, and quota settings must also permit the operations being tested. Never place Firebase Admin SDK keys, service-account files, or other private credentials in a `VITE_` variable; Vite exposes those variables to the browser.

## Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server with hot reload |
| `npm run build` | Type-check the app and create a production build in `dist/` |
| `npm run preview` | Serve the production build locally for inspection |
| `npm test` | Run the automated test suite once |
| `npm run test:watch` | Re-run tests as files change |
| `npm run lint` | Check the source code with ESLint |

## Project structure

```text
src/
  app/          Application routing and providers
  components/   Shared layout and interface components
  features/     Feature pages grouped by area
  firebase/     Firebase client and data-access functions
  styles/       Global styles, design tokens, and foundations
  test/         Shared test setup
  types/        Domain types
  utils/        General utilities
```

## Production build

Run `npm run build`, then use `npm run preview` to inspect the generated app locally. The deploy host must support a single-page application: unknown routes should fall back to `index.html`. Deployments that use a different hostname must also add that hostname to Firebase Authentication's authorized domains.

