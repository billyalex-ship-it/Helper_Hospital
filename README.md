# Hospital Management System

Hospital Management System is a web application for managing day-to-day hospital services. It uses Express and EJS for server-rendered pages, MySQL for persistent data, and session-based authentication for role-specific workflows.

## Features

- Public hospital home, contact, doctor, nurse, patient, and visitor pages
- User registration and login, with new accounts held for administrator approval
- Role-specific dashboards for administrators, doctors, and receptionists
- Administrator management of staff, employee records, and pending user approvals
- Patient and visitor directories for administrators and receptionists
- Patient registration, gender capture, and in-house/discharged status tracking
- Appointment booking and listings, with doctor actions to accept, cancel, or reschedule appointments

## Technology

- Node.js
- Express
- EJS
- MySQL (`mysql2`)
- `express-session`
- `bcryptjs`

## Getting started

1. Install a supported Node.js version and MySQL.
2. Install the application dependencies:

   ```sh
   npm install
   ```

3. Configure the MySQL connection in `main.js` for your local environment. The schema is named `hospital_ms2`; update the connection settings if your MySQL host, port, or credentials differ.
4. Apply `migration.sql` to create the database schema. The migration includes `ALTER TABLE` statements for approval and patient-status fields; apply those changes only once to an existing database.
5. Start the server:

   ```sh
   node main.js
   ```

6. Open [http://localhost:3000](http://localhost:3000).

New registrations remain pending until an administrator reviews and confirms the requested role. Existing accounts remain approved by default when the approval column is added to a database.

## Main routes

| Route | Purpose |
| --- | --- |
| `/` | Hospital home page |
| `/register` and `/login` | Account registration and sign-in |
| `/dashboard` | Dashboard selected for the signed-in user's role |
| `/employees` | Administrator employee management |
| `/admin/user-approvals` | Administrator review of pending accounts |
| `/PatientsDir` | Patient directory for administrators and receptionists |
| `/VisitorsDir` | Visitor directory for administrators and receptionists |
| `/appointments` | Book and view appointments |
| `/doctors`, `/nurses`, `/patients`, `/visitors` | Public-facing service and team pages |

## Project layout

- `main.js` — Express application, routes, sessions, and database access
- `migration.sql` — MySQL database and table definitions
- `views/` — EJS page templates
- `public/` — CSS, client-side JavaScript, and image assets
