# The Reading Room

An Express, EJS and MongoDB library management system. Members can register, search the catalogue, request books, cancel pending requests and view their borrowing history. Managers can maintain the catalogue, approve or reject requests, record returns, view members and identify overdue loans.

## Requirements

- Node.`js 20 or newer and npm
- MongoDB 6.0 or newer running as a **replica set** (a single-node replica set is sufficient). Transactions protect inventory and borrowing records from concurrent changes; a standalone MongoDB server does not support them. MongoDB Atlas also works.

## Getting started

1. Install dependencies: `npm install`.
2. Create a `.env` file using the settings below. Set a random `SESSION_SECRET` of at least 32 characters, your replica-set `MONGODB_URI`, and the initial manager's name, email and password. Never commit `.env`.
3. If using a local MongoDB installation, start `mongod` with `--replSet rs0` and run `rs.initiate()` once in `mongosh`. Ensure the URI in `.env` matches your replica set. For Atlas, use the connection string provided by Atlas instead.
4. Run `npm run setup-manager` to create the manager account. Running it again does not change an existing manager password. Manager accounts cannot be created through public registration.
5. Run `npm start` (or `npm run dev`) and open `http://localhost:3000`. Sign in with the manager credentials or register a member account.

Example `.env` settings:

```dotenv
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/library?replicaSet=rs0
SESSION_SECRET=replace-with-a-long-random-secret
MANAGER_NAME=Library Manager
MANAGER_EMAIL=manager@example.com
MANAGER_PASSWORD=change-this-password
```

Use HTTPS in production and set `NODE_ENV=production` so the session cookie is secure. Configure the reverse proxy for HTTPS. The application stores sessions in MongoDB; change the example credentials before deployment.

## Google sign-in

Google sign-in is optional. In Google Cloud, configure the OAuth consent screen and create a Web application OAuth client. Add `http://localhost:3000/auth/google/callback` as an authorized redirect URI for local development, then set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in `.env` and restart the app. For deployment, register and use the exact HTTPS callback URL instead. Add test users in the Google Cloud consent screen if the app is in testing mode.

The Google button appears once all three settings are present. New Google accounts are created as members; existing email/password accounts are not automatically linked, even when their email address matches. Sign in with the existing method for those accounts. Google sign-in uses a one-time state, nonce and PKCE for the authorization flow. Never commit client secrets.

## Circulation rules

- Only members can request an available physical book. Each member can have at most one pending request or active loan per title; pending requests do not reserve a copy.
- A manager approves or rejects each pending request. Approval atomically checks and decreases availability, sets the issue date and a 14-day due date. A manager can record a return once, restoring one copy. Overdue loans are highlighted automatically.
- Members see only their own records and may cancel only their own pending requests. Managers can see all records. Records are retained, so books with borrowing history cannot be deleted. Total copies cannot be reduced below the number currently on loan.
- E-books can be catalogued, but digital lending is not implemented.

## Member account

Members can update their name and change their local password from My account. Password changes require the current password and invalidate other sessions. Google-only members manage their password through Google. Members using email and password can delete their account after cancelling pending requests and returning all borrowed books; completed borrowing records are retained without account details. Accounts using Google sign-in cannot be deleted through the application.

## JSON API

All book and borrowing endpoints require a logged-in session; book changes and approval/return actions require the manager role.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/books` or `/api/books/:id` | List or view books |
| POST | `/api/books` | Create a book (manager) |
| PUT | `/api/books/:id` | Replace editable book fields (manager) |
| DELETE | `/api/books/:id` | Delete a book without borrowing history (manager) |
| GET | `/api/borrow-records` | List own records, or all records for a manager |
| POST | `/api/borrow-records` | Request a physical book with `{ "bookId": "..." }` (member) |
| PUT | `/api/borrow-records/:id` | Set `{ "action": "approve", "reject", "return", or "cancel" }` according to role |
| DELETE | `/api/borrow-records/:id` | Cancel a member's own pending request; retains history |

Book POST/PUT accepts `title`, `author`, `isbn`, `category`, `type` (`Physical Book` or `E-book`), `description`, `totalCopies`, and `shelfLocation`. Availability is calculated by the server, not accepted from clients.

For example, authenticate with curl (replace the example credentials):

```sh
curl -c cookies.txt -X POST http://localhost:3000/login \
  --data-urlencode 'email=manager@example.com' --data-urlencode 'password=YOUR_PASSWORD'
curl -b cookies.txt http://localhost:3000/api/books
curl -b cookies.txt -X POST http://localhost:3000/api/books -H 'Content-Type: application/json' \
  -d '{"title":"Example","author":"An Author","isbn":"12345","category":"Fiction","totalCopies":2}'
curl -b cookies.txt -X PUT http://localhost:3000/api/books/BOOK_ID -H 'Content-Type: application/json' \
  -d '{"title":"Updated","author":"An Author","isbn":"12345","category":"Fiction","totalCopies":2}'
curl -b cookies.txt -X DELETE http://localhost:3000/api/books/BOOK_ID
```
