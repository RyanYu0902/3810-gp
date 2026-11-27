## Project info

An Express, EJS and MongoDB library management system. Members can register, search the catalogue, request books, cancel pending requests and view their borrowing history. Managers can maintain the catalogue, approve or reject requests, record returns, view members and identify overdue loans.

## Group info


## project file intro

server.js — Starts the Express server and configures sessions, routes and database connections.
package.json — Defines the project scripts and dependencies.
package-lock.json — Records the exact installed dependency versions.
config/ — Contains the MongoDB connection configuration.
middleware/ — Checks login sessions and user permissions.
models/ — Defines the user, book and borrowing record data structures.
routes/ — Handles authentication, member, manager and REST API requests.
services/ — Contains the catalogue and borrowing business logic.
views/ — Contains EJS templates for the application’s web pages.
views/partials/ — Contains reusable page components, including the header, footer and borrowing table.
public/ — Contains CSS files for the application’s appearance.
.gitignore — Lists files and folders that Git should not track.

## Operation guides

1. Install dependencies: `npm install`.
2. Create a `.env` file and copy the settings below.
3. Run `npm run dev` and open `http://localhost:3000`.


`.env` settings:

PORT=3000
MONGODB_URI=replace-with-your-mongodb_uri
SESSION_SECRET=replace-with-your-session_secret
MANAGER_NAME=Library Manager
MANAGER_EMAIL=replace-with-your-manager_email
MANAGER_PASSWORD=replace-with-your-manager_password

GOOGLE_CLIENT_ID=replace-with-your-google_client_id
GOOGLE_CLIENT_SECRET=replace-with-your-google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
