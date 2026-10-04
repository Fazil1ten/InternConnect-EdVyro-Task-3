const express = require('express');
const path = require('path');
const crypto = require('crypto');

const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '100kb' }));

// Serve frontend files
app.use(express.static(__dirname));

// Consistent API responses
const ok = (data, pagination = {}) => ({
  status: 'success',
  data,
  pagination
});

const fail = (message, code = 'BAD_REQUEST') => ({
  status: 'error',
  error: {
    code,
    message
  }
});

// Safe portfolio URL validation
const isSafeUrl = (value) => {
  try {
    const url = new URL(value);

    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !/^(javascript|data|file):/i.test(value)
    );
  } catch {
    return false;
  }
};

// Convert SQLite row into API object
const formatInternship = (row) => ({
  ...row,
  skills: JSON.parse(row.skills)
});

// Temporary application store for demo applications
const applicationStore = new Map();

/*
  GET ALL INTERNSHIPS
  Supports:
  ?q=frontend
  ?domain=Full Stack Development
  ?mode=Remote
  ?location=India
  ?sort=stipend
  ?sort=duration
  ?page=1
  ?limit=10
*/
app.get('/api/internships', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();

  const domain = String(req.query.domain || 'all');
  const mode = String(req.query.mode || 'all');
  const location = String(req.query.location || 'all');

  const sort = String(req.query.sort || 'recommended');

  const page = Math.max(
    1,
    Number(req.query.page || 1)
  );

  const limit = Math.min(
    50,
    Math.max(1, Number(req.query.limit || 10))
  );

  let rows = db
    .prepare(`
      SELECT *
      FROM internships
      ORDER BY rowid ASC
    `)
    .all();

  rows = rows.filter((row) => {
    const internship = formatInternship(row);

    const matchesSearch =
      !q ||
      JSON.stringify(internship)
        .toLowerCase()
        .includes(q);

    const matchesDomain =
      domain === 'all' ||
      internship.domain === domain;

    const matchesMode =
      mode === 'all' ||
      internship.mode === mode;

    const matchesLocation =
      location === 'all' ||
      internship.location === location;

    return (
      matchesSearch &&
      matchesDomain &&
      matchesMode &&
      matchesLocation
    );
  });

  if (sort === 'stipend') {
    rows.sort((a, b) => b.stipend - a.stipend);
  }

  if (sort === 'duration') {
    rows.sort((a, b) => a.duration - b.duration);
  }

  rows = rows.map(formatInternship);

  const total = rows.length;

  const totalPages = Math.max(
    1,
    Math.ceil(total / limit)
  );

  const start = (page - 1) * limit;

  const paginatedRows = rows.slice(
    start,
    start + limit
  );

  return res.status(200).json(
    ok(paginatedRows, {
      page,
      limit,
      total,
      totalPages
    })
  );
});

/*
  GET SINGLE INTERNSHIP
*/
app.get('/api/internships/:id', (req, res) => {
  const id = req.params.id;

  const row = db
    .prepare(`
      SELECT *
      FROM internships
      WHERE id = ?
    `)
    .get(id);

  if (!row) {
    return res.status(404).json(
      fail(
        'Internship not found.',
        'INTERNSHIP_NOT_FOUND'
      )
    );
  }

  return res.status(200).json(
    ok(formatInternship(row))
  );
});

/*
  CREATE INTERNSHIP
*/
app.post('/api/internships', (req, res) => {
  const body = req.body || {};

  const requiredFields = [
    'id',
    'title',
    'domain',
    'mode',
    'location',
    'skills',
    'openings',
    'company',
    'stipend',
    'duration',
    'description'
  ];

  for (const field of requiredFields) {
    if (
      body[field] === undefined ||
      body[field] === null ||
      body[field] === ''
    ) {
      return res.status(400).json(
        fail(
          `${field} is required.`,
          'FIELD_REQUIRED'
        )
      );
    }
  }

  if (
    !Array.isArray(body.skills) ||
    body.skills.length === 0
  ) {
    return res.status(400).json(
      fail(
        'Skills must be a non-empty array.',
        'INVALID_SKILLS'
      )
    );
  }

  const existing = db
    .prepare(
      'SELECT id FROM internships WHERE id = ?'
    )
    .get(String(body.id));

  if (existing) {
    return res.status(409).json(
      fail(
        'Internship ID already exists.',
        'DUPLICATE_ID'
      )
    );
  }

  db.prepare(`
    INSERT INTO internships
    (
      id,
      title,
      domain,
      mode,
      location,
      skills,
      openings,
      company,
      stipend,
      duration,
      description
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(body.id),
    String(body.title).trim(),
    String(body.domain).trim(),
    String(body.mode).trim(),
    String(body.location).trim(),
    JSON.stringify(body.skills),
    Number(body.openings),
    String(body.company).trim(),
    Number(body.stipend),
    Number(body.duration),
    String(body.description).trim()
  );

  const created = db
    .prepare(
      'SELECT * FROM internships WHERE id = ?'
    )
    .get(String(body.id));

  return res.status(201).json(
    ok(formatInternship(created))
  );
});

/*
  UPDATE INTERNSHIP
  Supports PUT and PATCH
*/
const updateInternship = (req, res) => {
  const id = req.params.id;

  const existing = db
    .prepare(
      'SELECT * FROM internships WHERE id = ?'
    )
    .get(id);

  if (!existing) {
    return res.status(404).json(
      fail(
        'Internship not found.',
        'INTERNSHIP_NOT_FOUND'
      )
    );
  }

  const current = formatInternship(existing);
  const body = req.body || {};

  const updated = {
    title:
      body.title !== undefined
        ? String(body.title).trim()
        : current.title,

    domain:
      body.domain !== undefined
        ? String(body.domain).trim()
        : current.domain,

    mode:
      body.mode !== undefined
        ? String(body.mode).trim()
        : current.mode,

    location:
      body.location !== undefined
        ? String(body.location).trim()
        : current.location,

    skills:
      body.skills !== undefined
        ? body.skills
        : current.skills,

    openings:
      body.openings !== undefined
        ? Number(body.openings)
        : current.openings,

    company:
      body.company !== undefined
        ? String(body.company).trim()
        : current.company,

    stipend:
      body.stipend !== undefined
        ? Number(body.stipend)
        : current.stipend,

    duration:
      body.duration !== undefined
        ? Number(body.duration)
        : current.duration,

    description:
      body.description !== undefined
        ? String(body.description).trim()
        : current.description
  };

  if (
    !Array.isArray(updated.skills) ||
    updated.skills.length === 0
  ) {
    return res.status(400).json(
      fail(
        'Skills must be a non-empty array.',
        'INVALID_SKILLS'
      )
    );
  }

  db.prepare(`
    UPDATE internships
    SET
      title = ?,
      domain = ?,
      mode = ?,
      location = ?,
      skills = ?,
      openings = ?,
      company = ?,
      stipend = ?,
      duration = ?,
      description = ?
    WHERE id = ?
  `).run(
    updated.title,
    updated.domain,
    updated.mode,
    updated.location,
    JSON.stringify(updated.skills),
    updated.openings,
    updated.company,
    updated.stipend,
    updated.duration,
    updated.description,
    id
  );

  const result = db
    .prepare(
      'SELECT * FROM internships WHERE id = ?'
    )
    .get(id);

  return res.status(200).json(
    ok(formatInternship(result))
  );
};

app.put('/api/internships/:id', updateInternship);
app.patch('/api/internships/:id', updateInternship);

/*
  DELETE INTERNSHIP
*/
app.delete('/api/internships/:id', (req, res) => {
  const id = req.params.id;

  const existing = db
    .prepare(
      'SELECT id FROM internships WHERE id = ?'
    )
    .get(id);

  if (!existing) {
    return res.status(404).json(
      fail(
        'Internship not found.',
        'INTERNSHIP_NOT_FOUND'
      )
    );
  }

  db.prepare(
    'DELETE FROM internships WHERE id = ?'
  ).run(id);

  return res.status(200).json(
    ok({
      id,
      message: 'Internship deleted successfully.'
    })
  );
});

/*
  SUBMIT APPLICATION
*/
app.post('/api/applications', (req, res) => {
  const body = req.body || {};

  const name = String(
    body.name || ''
  ).trim();

  const email = String(
    body.email || ''
  ).trim().toLowerCase();

  const portfolio = String(
    body.portfolio || ''
  ).trim();

  const internshipId = String(
    body.internshipId || ''
  ).trim();

  if (!name) {
    return res.status(400).json(
      fail(
        'Name is required.',
        'NAME_REQUIRED'
      )
    );
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return res.status(400).json(
      fail(
        'Enter a valid email address.',
        'INVALID_EMAIL'
      )
    );
  }

  if (
    portfolio &&
    !isSafeUrl(portfolio)
  ) {
    return res.status(400).json(
      fail(
        'Portfolio URL must use http or https.',
        'UNSAFE_URL'
      )
    );
  }

  const internship = db
    .prepare(
      'SELECT id FROM internships WHERE id = ?'
    )
    .get(internshipId);

  if (!internship) {
    return res.status(404).json(
      fail(
        'Internship not found.',
        'INTERNSHIP_NOT_FOUND'
      )
    );
  }

  // No applicant information is logged.
  const key = `${internshipId}:${email}`;

  if (applicationStore.has(key)) {
    return res.status(409).json(
      fail(
        'You have already applied to this internship.',
        'DUPLICATE_APPLICATION'
      )
    );
  }

  const applicationId = crypto.randomUUID();

  applicationStore.set(
    key,
    {
      applicationId,
      internshipId
    }
  );

  return res.status(201).json(
    ok({
      applicationId,
      internshipId
    })
  );
});

/*
  API 404 HANDLER
*/
app.use('/api', (req, res) => {
  return res.status(404).json(
    fail(
      'API route not found.',
      'NOT_FOUND'
    )
  );
});

/*
  General 404
*/
app.use((req, res) => {
  return res.status(404).send('Not found');
});

/*
  Start server
*/
app.listen(PORT, () => {
  console.log(
    `InternConnect running on http://localhost:${PORT}`
  );
});