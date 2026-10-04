## Live Demo

https://internconnect-edvyro-task-2.onrender.com
# InternConnect — EdVyro Full Stack Internship Task 2

Responsive internship board built with semantic HTML, responsive CSS, vanilla JavaScript and a small Node.js API. No frontend framework is used.

## What is implemented
- Uses the supplied EdVyro internship seed and preserves IDs `INT-101` to `INT-105`.
- `GET /api/internships` returns a predictable `{ status, data, pagination }` envelope.
- Search, domain, work-mode, location filters and sorting.
- Loading, empty, error and retry states.
- Accessible native controls, labels, keyboard-friendly dialog and Escape-to-close.
- Internship details modal.
- Application form with server validation for required name, valid email, safe `http/https` portfolio URLs and duplicate applications.
- Server does not log applicant personal data.
- Save/unsave uses localStorage.
- Responsive layout tested for mobile/tablet/desktop.
- Dark mode and reduced-motion support.

## Run locally
Requires Node.js 18+.

```bash
npm start
```

Open `http://localhost:3000`.

## API examples

```text
GET /api/internships
GET /api/internships?q=frontend&domain=Full%20Stack%20Development
POST /api/applications
```

Application body:

```json
{
  "internshipId": "INT-101",
  "name": "Demo Student",
  "email": "student@example.com",
  "portfolio": "https://example.com"
}
```

The server rejects missing names, invalid email addresses, unsafe URLs, unknown internship IDs and duplicate applications.

## Deployment
This version needs a Node-capable host because the acceptance criteria include a server/API. Deploy the project to a Node host such as Render or Railway and use the resulting public URL as the proof link. GitHub Pages alone cannot run `server.js`.

## Project
- Website: InternConnect
- Developer: Fazil Hussain
- GitHub: https://github.com/Fazil1ten
- Theme: white + green
