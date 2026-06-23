const pool = require('./db');

const PROFANITY_BLOCKLIST = new Set([
  'fuck','shit','ass','bitch','cunt','dick','cock','pussy','nigger','nigga',
  'faggot','fag','retard','whore','slut','bastard','damn','hell','piss',
]);

function containsProfanity(text) {
  const lower = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  return lower.split(/\s+/).some(w => PROFANITY_BLOCKLIST.has(w));
}

async function seedData() {
  // Seed a season
  await pool.query(`
    INSERT INTO seasons (name, start_date, end_date, status)
    VALUES ('Summer 2026', '2026-06-01', '2026-07-13', 'active')
    ON CONFLICT DO NOTHING;
  `);

  // Seed the partnered venue
  const venueRes = await pool.query(`
    INSERT INTO venues (name, address, tournament_entry_fee_cents, platform_fee_pct)
    VALUES ('The Cage NYC', '4th Street & 6th Ave, New York, NY 10014', 1000, 15)
    ON CONFLICT DO NOTHING
    RETURNING id;
  `);

  let venueId = venueRes.rows[0]?.id;
  if (!venueId) {
    const v = await pool.query(`SELECT id FROM venues WHERE name = 'The Cage NYC'`);
    venueId = v.rows[0].id;
  }

  // Seed venue courts (West 4th Street / The Cage)
  await pool.query(`
    INSERT INTO courts (name, type, venue_id, latitude, longitude, status)
    VALUES
      ('The Cage — Main Court', 'venue', $1, 40.730610, -74.002036, 'active'),
      ('The Cage — Side Court', 'venue', $1, 40.730540, -74.001980, 'active')
    ON CONFLICT DO NOTHING;
  `, [venueId]);

  // Seed public courts around NYC
  await pool.query(`
    INSERT INTO courts (name, type, latitude, longitude, status)
    VALUES
      ('West 4th Street Courts', 'public', 40.730500, -74.001800, 'active'),
      ('Rucker Park', 'public', 40.830120, -73.937050, 'active'),
      ('Goat Park (Roberto Clemente)', 'public', 40.817890, -73.949210, 'active'),
      ('Tompkins Square Courts', 'public', 40.726280, -73.981690, 'active'),
      ('Holcombe Rucker — South Court', 'public', 40.829800, -73.937400, 'active')
    ON CONFLICT DO NOTHING;
  `);

  // Seed achievements
  await pool.query(`
    INSERT INTO achievements (name, description)
    VALUES
      ('First Blood', 'Win your first Call-Out'),
      ('Giant Killer', 'Beat a crew with 200+ more reputation points'),
      ('Undefeated Season', 'End a season with zero losses'),
      ('Turf Lord', 'Hold 3 courts simultaneously'),
      ('Clean Game', 'Win 10 matches with no score disputes')
    ON CONFLICT DO NOTHING;
  `);

  // Seed quests
  await pool.query(`
    INSERT INTO quests (name, description, cadence, requirement_type, requirement_count, coin_reward, active_from, active_until)
    VALUES
      ('First Blood Daily', 'Win a match today', 'daily', 'win_match', 1, 20, CURRENT_DATE, CURRENT_DATE + 365),
      ('Run the Block', 'Win 3 matches this week', 'weekly', 'win_match', 3, 75, CURRENT_DATE, CURRENT_DATE + 365),
      ('Hold It Down', 'Hold 2 courts at the same time', 'weekly', 'hold_courts', 2, 50, CURRENT_DATE, CURRENT_DATE + 365),
      ('Clean Sweep', 'Win 2 matches with no disputes this week', 'weekly', 'win_match', 2, 40, CURRENT_DATE, CURRENT_DATE + 365),
      ('New Turf', 'Win a match at a court your crew has never held', 'weekly', 'win_match', 1, 60, CURRENT_DATE, CURRENT_DATE + 365)
    ON CONFLICT DO NOTHING;
  `);

  // Seed store items
  await pool.query(`
    INSERT INTO store_items (name, item_type, cost_coins, min_reputation, is_consumable)
    VALUES
      ('Classic White Jersey',    'jersey',           150,  0,   false),
      ('Blacktop Black Jersey',   'jersey',           150,  0,   false),
      ('Volt Runner Jersey',      'jersey',           300,  200, false),
      ('Legend Gold Jersey',      'jersey',           500,  1000,false),
      ('Drip Tag Style',          'tag_style',        100,  0,   false),
      ('Graffiti Tag Style',      'tag_style',        200,  200, false),
      ('Street Crown Tag',        'tag_style',        400,  500, false),
      ('Court Banner — Standard', 'court_banner',     200,  0,   false),
      ('Court Banner — Volt Glow','court_banner',     400,  200, false),
      ('Profile Flair — OG',      'profile_flair',    75,   0,   false),
      ('Profile Flair — Legend',  'profile_flair',    350,  1000,false),
      ('Rematch Clause',          'rematch_clause',   100,  0,   true),
      ('Priority Booking',        'priority_booking', 150,  0,   true)
    ON CONFLICT DO NOTHING;
  `);

  console.log('Seed data inserted');
}

module.exports = { seedData, containsProfanity };
