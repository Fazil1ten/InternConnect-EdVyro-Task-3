const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const db = new Database(path.join(__dirname, "internships.db"));

db.pragma("journal_mode = WAL");

// Create internships table
db.exec(`
  CREATE TABLE IF NOT EXISTS internships (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    domain TEXT NOT NULL,
    mode TEXT NOT NULL,
    location TEXT NOT NULL,
    skills TEXT NOT NULL,
    openings INTEGER NOT NULL,
    company TEXT NOT NULL,
    stipend INTEGER NOT NULL,
    duration INTEGER NOT NULL,
    description TEXT NOT NULL
  )
`);

// Load seed data
const seedPath = path.join(__dirname, "seed.json");
const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));

// Insert seed records only if they don't already exist
const insert = db.prepare(`
  INSERT OR IGNORE INTO internships
  (id, title, domain, mode, location, skills, openings, company, stipend, duration, description)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertMany = db.transaction((internships) => {
  for (const internship of internships) {
    insert.run(
      internship.id,
      internship.title,
      internship.domain,
      internship.mode,
      internship.location,
      JSON.stringify(internship.skills),
      internship.openings,
      internship.company,
      internship.stipend,
      internship.duration,
      internship.description
    );
  }
});

insertMany(seed.internships);

module.exports = db;