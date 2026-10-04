const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const crypto = require('crypto');

const db = require('./database');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

const send = (res, status, payload, headers = {}) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...headers
  });

  res.end(JSON.stringify(payload));
  return true;
};

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

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;

      if (body.length > 100000) {
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON body.'));
      }
    });

    req.on('error', reject);
  });

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

const formatInternship = (row) => ({
  ...row,
  skills: JSON.parse(row.skills)
});

function handleApi(req, res, url) {

  // GET ALL INTERNSHIPS
  if (req.method === 'GET' && url.pathname === '/api/internships') {

    const q = (url.searchParams.get('q') || '').trim().toLowerCase();

    const domain = url.searchParams.get('domain') || 'all';
    const mode = url.searchParams.get('mode') || 'all';
    const location = url.searchParams.get('location') || 'all';

    const sort = url.searchParams.get('sort') || 'recommended';

    const page = Math.max(
      1,
      Number(url.searchParams.get('page') || 1)
    );

    const limit = Math.min(
      50,
      Math.max(1, Number(url.searchParams.get('limit') || 10))
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
        domain === 'all' || internship.domain === domain;

      const matchesMode =
        mode === 'all' || internship.mode === mode;

      const matchesLocation =
        location === 'all' || internship.location === location;

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

    return send(
      res,
      200,
      ok(paginatedRows, {
        page,
        limit,
        total,
        totalPages
      })
    );
  }

  // GET SINGLE INTERNSHIP
  if (
    req.method === 'GET' &&
    url.pathname.match(/^\/api\/internships\/[^/]+$/)
  ) {

    const id = decodeURIComponent(
      url.pathname.split('/').pop()
    );

    const row = db
      .prepare(`
        SELECT *
        FROM internships
        WHERE id = ?
      `)
      .get(id);

    if (!row) {
      return send(
        res,
        404,
        fail(
          'Internship not found.',
          'INTERNSHIP_NOT_FOUND'
        )
      );
    }

    return send(
      res,
      200,
      ok(formatInternship(row))
    );
  }

  // CREATE INTERNSHIP
  if (
    req.method === 'POST' &&
    url.pathname === '/api/internships'
  ) {

    readBody(req)
      .then((body) => {

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
            return send(
              res,
              400,
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
          return send(
            res,
            400,
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
          return send(
            res,
            409,
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

        return send(
          res,
          201,
          ok(formatInternship(created))
        );
      })
      .catch(() => {
        send(
          res,
          400,
          fail(
            'Invalid JSON body.',
            'INVALID_JSON'
          )
        );
      });

    return true;
  }

  // UPDATE INTERNSHIP
  if (
    (req.method === 'PUT' || req.method === 'PATCH') &&
    url.pathname.match(/^\/api\/internships\/[^/]+$/)
  ) {

    const id = decodeURIComponent(
      url.pathname.split('/').pop()
    );

    readBody(req)
      .then((body) => {

        const existing = db
          .prepare(
            'SELECT * FROM internships WHERE id = ?'
          )
          .get(id);

        if (!existing) {
          return send(
            res,
            404,
            fail(
              'Internship not found.',
              'INTERNSHIP_NOT_FOUND'
            )
          );
        }

        const current = formatInternship(existing);

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
          return send(
            res,
            400,
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

        return send(
          res,
          200,
          ok(formatInternship(result))
        );
      })
      .catch(() => {
        send(
          res,
          400,
          fail(
            'Invalid JSON body.',
            'INVALID_JSON'
          )
        );
      });

    return true;
  }

  // DELETE INTERNSHIP
  if (
    req.method === 'DELETE' &&
    url.pathname.match(/^\/api\/internships\/[^/]+$/)
  ) {

    const id = decodeURIComponent(
      url.pathname.split('/').pop()
    );

    const existing = db
      .prepare(
        'SELECT id FROM internships WHERE id = ?'
      )
      .get(id);

    if (!existing) {
      return send(
        res,
        404,
        fail(
          'Internship not found.',
          'INTERNSHIP_NOT_FOUND'
        )
      );
    }

    db.prepare(
      'DELETE FROM internships WHERE id = ?'
    ).run(id);

    return send(
      res,
      200,
      ok({
        id,
        message: 'Internship deleted successfully.'
      })
    );
  }

  // APPLICATION
  if (
    req.method === 'POST' &&
    url.pathname === '/api/applications'
  ) {

    readBody(req)
      .then((body) => {

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
          return send(
            res,
            400,
            fail(
              'Name is required.',
              'NAME_REQUIRED'
            )
          );
        }

        if (
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {
          return send(
            res,
            400,
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
          return send(
            res,
            400,
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
          return send(
            res,
            404,
            fail(
              'Internship not found.',
              'INTERNSHIP_NOT_FOUND'
            )
          );
        }

        // This demo keeps applications in memory.
        // No applicant information is logged.
        if (!global.applicationStore) {
          global.applicationStore = new Map();
        }

        const key = `${internshipId}:${email}`;

        if (global.applicationStore.has(key)) {
          return send(
            res,
            409,
            fail(
              'You have already applied to this internship.',
              'DUPLICATE_APPLICATION'
            )
          );
        }

        const applicationId = crypto.randomUUID();

        global.applicationStore.set(
          key,
          {
            applicationId,
            internshipId
          }
        );

        return send(
          res,
          201,
          ok({
            applicationId,
            internshipId
          })
        );
      })
      .catch(() => {
        send(
          res,
          400,
          fail(
            'Invalid JSON body.',
            'INVALID_JSON'
          )
        );
      });

    return true;
  }

  return false;
}

const server = http.createServer(
  (req, res) => {

    const url = new URL(
      req.url,
      `http://${req.headers.host || 'localhost'}`
    );

    if (url.pathname.startsWith('/api/')) {
      return (
        handleApi(req, res, url) ||
        send(
          res,
          404,
          fail(
            'API route not found.',
            'NOT_FOUND'
          )
        )
      );
    }

    let pathname = decodeURIComponent(
      url.pathname
    );

    if (pathname === '/') {
      pathname = '/index.html';
    }

    const file = path.normalize(
      path.join(ROOT, pathname)
    );

    if (!file.startsWith(ROOT)) {
      return send(
        res,
        403,
        fail(
          'Forbidden.',
          'FORBIDDEN'
        )
      );
    }

    fs.readFile(file, (err, data) => {

      if (err) {
        return res
          .writeHead(404, {
            'Content-Type': 'text/plain'
          })
          .end('Not found');
      }

      res.writeHead(200, {
        'Content-Type':
          MIME[path.extname(file)] ||
          'application/octet-stream'
      });

      res.end(data);
    });
  }
);

server.listen(
  PORT,
  () => {
    console.log(
      `InternConnect running on http://localhost:${PORT}`
    );
  }
);