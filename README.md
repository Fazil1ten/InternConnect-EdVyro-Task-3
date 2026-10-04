# InternConnect — EdVyro Full Stack Development Task 3

REST API and Persistent Data implementation for the InternConnect internship board.

Built with Node.js, Express dependency support, SQLite and vanilla JavaScript.

## Live Demo

Task 3 deployment will be added after deployment.

## GitHub Repository

https://github.com/Fazil1ten/InternConnect-EdVyro-Task-3

## Features

- REST API for internship records
- SQLite persistent database
- Supplied EdVyro seed data
- Preserves internship IDs INT-101 to INT-105
- List internships
- Get internship details
- Create internship
- Update internship
- Delete internship
- Search and filtering
- Pagination
- Sorting by stipend and duration
- Consistent API response envelope
- Input validation
- Consistent HTTP status codes
- Duplicate application rejection
- Valid email validation
- Safe HTTP/HTTPS portfolio URL validation
- Error responses with error codes
- No applicant personal data in server logs

## Internship Data Model

Each internship contains:

- `id`
- `title`
- `domain`
- `mode`
- `location`
- `skills`
- `openings`
- `company`
- `stipend`
- `duration`
- `description`

The original EdVyro internship IDs are preserved:

- INT-101
- INT-102
- INT-103
- INT-104
- INT-105

## Database

SQLite is used for persistent internship data.

Database file:

`internships.db`

The database schema is created automatically when the server starts.

Seed data is loaded from:

`seed.json`

Existing records are preserved using `INSERT OR IGNORE`.

## API Response Format

Successful responses use:

```json
{
  "status": "success",
  "data": [],
  "pagination": {}
}