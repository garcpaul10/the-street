require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const path = require('path');
const pool = require('./db');
const { initSchema } = require('./schema');
const { seedData, containsProfanity } = require('./seed');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new PgSession({ pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 },
}));

app.use(express.static(path.join(__dirname, 'public')));

const twilio = require('twilio');
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// ── Auth middleware ──
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

// ── Public endpoint: today's match count (pre-login screen) ──
app.get('/api/public/today-matches', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT COUNT(*) AS count FROM matches
      WHERE DATE(scheduled_time) = CURRENT_DATE
      AND status IN ('negotiating','locked','active')
    `);
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (e) {
    res.json({ count: 0 });
  }
});

// ── AUTH ──

function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('1') && digits.length === 11) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (raw.trim().startsWith('+')) return raw.trim();
  return `+${digits}`;
}

// Step 1: send OTP via Twilio Verify
app.post('/api/auth/send-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone || phone.trim().length < 7) {
    return res.status(400).json({ error: 'Valid phone number required' });
  }
  const e164 = normalizePhone(phone);
  try {
    await twilioClient.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verifications.create({ to: e164, channel: 'sms' });
    res.json({ success: true, normalizedPhone: e164 });
  } catch (err) {
    console.error('Twilio send-otp error:', err.message);
    res.status(500).json({ error: 'Failed to send verification code. Check your number and try again.' });
  }
});

// Step 2: verify OTP via Twilio Verify
app.post('/api/auth/verify-otp', async (req, res) => {
  const { phone, code } = req.body;
  const e164 = normalizePhone(phone);
  let check;
  try {
    check = await twilioClient.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({ to: e164, code: code.trim() });
  } catch (err) {
    console.error('Twilio verify-otp error:', err.message);
    return res.status(400).json({ error: 'Invalid or expired code' });
  }
  if (check.status !== 'approved') {
    return res.status(400).json({ error: 'Invalid or expired code' });
  }

  // Check if user exists
  const existing = await pool.query('SELECT id, username FROM users WHERE phone_number = $1', [e164]);
  if (existing.rows.length > 0) {
    req.session.userId = existing.rows[0].id;
    return res.json({ success: true, newUser: false, username: existing.rows[0].username });
  }

  // New user — need onboarding
  req.session.pendingPhone = e164;
  res.json({ success: true, newUser: true });
});

// Step 3: complete onboarding (new users only)
app.post('/api/auth/complete-signup', async (req, res) => {
  const { username, date_of_birth, gender } = req.body;
  const phone = req.session.pendingPhone;
  if (!phone) return res.status(400).json({ error: 'Session expired. Start over.' });

  // Age check
  const dob = new Date(date_of_birth);
  const age = (Date.now() - dob) / (365.25 * 24 * 60 * 60 * 1000);
  if (age < 13) {
    return res.status(400).json({ error: 'You must be at least 13 to join The Street.' });
  }

  // Profanity check on handle
  if (containsProfanity(username)) {
    return res.status(400).json({ error: 'That handle isn\'t allowed. Choose another.' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO users (phone_number, username, date_of_birth, gender) VALUES ($1, $2, $3, $4) RETURNING id',
      [phone, username.trim(), date_of_birth, gender]
    );
    const userId = result.rows[0].id;
    await pool.query(
      'INSERT INTO player_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING',
      [userId]
    );
    delete req.session.pendingPhone;
    req.session.userId = userId;

    // Auto-join crew if an invite token was stashed during signup
    let joinedCrew = null;
    const token = req.session.pendingInviteToken;
    if (token) {
      const inv = await pool.query(
        `SELECT ci.*, c.age_class FROM crew_invites ci JOIN crews c ON c.id = ci.crew_id
         WHERE ci.invite_token = $1 AND ci.status = 'pending' AND ci.expires_at > NOW()`,
        [token]
      );
      if (inv.rows.length) {
        const row = inv.rows[0];
        const dob2 = new Date(date_of_birth);
        const ageYears = (Date.now() - dob2) / (365.25 * 24 * 3600 * 1000);
        let ageOk = true;
        if (row.age_class === 'U14' && ageYears >= 14) ageOk = false;
        if (row.age_class === 'U18' && ageYears >= 18) ageOk = false;
        if (row.age_class === 'Adult' && ageYears < 18) ageOk = false;
        if (ageOk) {
          await pool.query('INSERT INTO crew_rosters (crew_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [row.crew_id, userId]);
          await pool.query('UPDATE crew_invites SET status = $1, invited_user_id = $2 WHERE invite_token = $3', ['accepted', userId, token]);
          joinedCrew = row.crew_id;
        }
      }
      delete req.session.pendingInviteToken;
    }

    res.json({ success: true, username: username.trim(), joined_crew_id: joinedCrew });
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: 'That handle is taken. Try another.' });
    throw e;
  }
});

// ── DEV / TEST endpoints — only active when DEV_SECRET is set ──
app.post('/api/dev/login', async (req, res) => {
  const secret = process.env.DEV_SECRET;
  if (!secret) return res.status(404).json({ error: 'Not found' });
  if (req.body.secret !== secret) return res.status(403).json({ error: 'Forbidden' });
  const user = await pool.query('SELECT id, username FROM users WHERE username = $1', [req.body.username]);
  if (!user.rows.length) return res.status(404).json({ error: 'User not found' });
  req.session.userId = user.rows[0].id;
  res.json({ success: true, username: user.rows[0].username });
});

app.post('/api/dev/seed', async (req, res) => {
  const secret = process.env.DEV_SECRET;
  if (!secret) return res.status(404).json({ error: 'Not found' });
  if (req.body.secret !== secret) return res.status(403).json({ error: 'Forbidden' });

  const users = [
    { username: 'RivalBoss',   phone: '+15550010001', gender: 'Male',   dob: '1995-03-12' },
    { username: 'RivalPlayer', phone: '+15550010002', gender: 'Male',   dob: '1998-07-22' },
    { username: 'WildCard',    phone: '+15550010003', gender: 'Female', dob: '2000-01-05' },
  ];

  const created = [];
  for (const u of users) {
    const ex = await pool.query('SELECT id FROM users WHERE username = $1', [u.username]);
    if (ex.rows.length) { created.push({ username: u.username, id: ex.rows[0].id, skipped: true }); continue; }
    const r = await pool.query(
      `INSERT INTO users (username, phone_number, date_of_birth, gender, tier)
       VALUES ($1,$2,$3,$4,'free') RETURNING id`,
      [u.username, u.phone, u.dob, u.gender]
    );
    await pool.query('INSERT INTO player_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [r.rows[0].id]);
    created.push({ username: u.username, id: r.rows[0].id });
  }

  // Create rival crew if not exists
  const existingCrew = await pool.query("SELECT id FROM crews WHERE name = 'Downtown Kings'");
  let rivalCrewId;
  if (existingCrew.rows.length) {
    rivalCrewId = existingCrew.rows[0].id;
  } else {
    const boss = created.find(u => u.username === 'RivalBoss');
    const crew = await pool.query(
      `INSERT INTO crews (name, sport_type, age_class, gender_class, boss_id, map_color_hex, coin_balance, reputation_score)
       VALUES ('Downtown Kings','basketball','Open','Male',$1,'#ff3b4e',500,120) RETURNING id`,
      [boss.id]
    );
    rivalCrewId = crew.rows[0].id;
    for (const u of created) {
      await pool.query(
        'INSERT INTO crew_rosters (crew_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [rivalCrewId, u.id]
      );
    }
  }

  res.json({ success: true, users: created, rivalCrewId });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/auth/me', async (req, res) => {
  if (!req.session.userId) return res.json({ authenticated: false });
  const result = await pool.query('SELECT id, username, tier FROM users WHERE id = $1', [req.session.userId]);
  if (!result.rows.length) return res.json({ authenticated: false });
  res.json({ authenticated: true, user: result.rows[0] });
});

// ── CREWS ──

app.post('/api/crews', requireAuth, async (req, res) => {
  const { name, age_class, gender_class, map_color_hex } = req.body;
  const sport_type = (req.body.sport_type || '').toLowerCase().trim();

  if (containsProfanity(name)) {
    return res.status(400).json({ error: 'Crew name isn\'t allowed. Choose another.' });
  }

  const color = map_color_hex || '#44FF22';
  try {
    // Block if already a member of any crew in this sport
    const existing = await pool.query(
      `SELECT c.id FROM crew_rosters cr
       JOIN crews c ON c.id = cr.crew_id
       WHERE cr.user_id = $1 AND LOWER(c.sport_type) = $2`,
      [req.session.userId, sport_type]
    );
    if (existing.rows.length) {
      return res.status(400).json({ error: `You're already on a ${sport_type} crew. You can only be on one crew per sport.` });
    }

    const result = await pool.query(
      `INSERT INTO crews (name, boss_id, sport_type, age_class, gender_class, map_color_hex)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name.trim(), req.session.userId, sport_type, age_class, gender_class, color]
    );
    const crew = result.rows[0];
    // Boss is also on the roster
    await pool.query(
      'INSERT INTO crew_rosters (crew_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [crew.id, req.session.userId]
    );
    res.json({ success: true, crew });
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: 'Crew name is taken.' });
    throw e;
  }
});

// Serve crew logo as image
app.get('/api/crews/:id/logo', async (req, res) => {
  const crew = await pool.query('SELECT logo_url FROM crews WHERE id = $1', [req.params.id]);
  if (!crew.rows.length || !crew.rows[0].logo_url) return res.status(404).end();
  const dataUrl = crew.rows[0].logo_url;
  const [header, data] = dataUrl.split(',');
  const mimeType = (header.match(/:(.*?);/) || [])[1] || 'image/jpeg';
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(Buffer.from(data, 'base64'));
});

// Upload crew logo (boss only)
app.post('/api/crews/:id/logo', requireAuth, async (req, res) => {
  const crewId = req.params.id;
  const { logo_url } = req.body;
  const crew = await pool.query('SELECT boss_id FROM crews WHERE id = $1', [crewId]);
  if (!crew.rows.length || crew.rows[0].boss_id !== req.session.userId) {
    return res.status(403).json({ error: 'Only the boss can update the crew logo.' });
  }
  if (!logo_url || !logo_url.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Invalid image.' });
  }
  await pool.query('UPDATE crews SET logo_url = $1 WHERE id = $2', [logo_url, crewId]);
  res.json({ success: true });
});

app.get('/api/crews/search', requireAuth, async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.json({ crews: [] });
  const result = await pool.query(
    `SELECT id, name, sport_type, age_class, gender_class, map_color_hex, reputation_score
     FROM crews WHERE name ILIKE $1 ORDER BY reputation_score DESC LIMIT 15`,
    [`%${q.trim()}%`]
  );
  res.json({ crews: result.rows });
});

app.get('/api/crews/mine', requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT c.*, u.username AS boss_username
     FROM crews c
     JOIN crew_rosters cr ON cr.crew_id = c.id
     JOIN users u ON u.id = c.boss_id
     WHERE cr.user_id = $1`,
    [req.session.userId]
  );
  res.json({ crews: result.rows });
});

app.get('/api/crews/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const crew = await pool.query(
    `SELECT c.*, u.username AS boss_username FROM crews c JOIN users u ON u.id = c.boss_id WHERE c.id = $1`,
    [id]
  );
  if (!crew.rows.length) return res.status(404).json({ error: 'Crew not found' });

  const roster = await pool.query(
    `SELECT u.id, u.username, cr.joined_at FROM crew_rosters cr JOIN users u ON u.id = cr.user_id WHERE cr.crew_id = $1`,
    [id]
  );
  res.json({ crew: crew.rows[0], roster: roster.rows });
});

// Add player to crew with age_class guardrail
app.post('/api/crews/:id/roster', requireAuth, async (req, res) => {
  const crewId = req.params.id;
  const { user_id } = req.body;
  const targetUserId = user_id || req.session.userId;

  const crew = await pool.query('SELECT * FROM crews WHERE id = $1', [crewId]);
  if (!crew.rows.length) return res.status(404).json({ error: 'Crew not found' });
  const c = crew.rows[0];

  const user = await pool.query('SELECT date_of_birth FROM users WHERE id = $1', [targetUserId]);
  if (!user.rows.length) return res.status(404).json({ error: 'User not found' });

  const dob = new Date(user.rows[0].date_of_birth);
  const age = Math.floor((Date.now() - dob) / (365.25 * 24 * 60 * 60 * 1000));

  if (c.age_class === 'U14' && age >= 14) return res.status(400).json({ error: 'U14 crews only accept players under 14.' });
  if (c.age_class === 'U18' && age >= 18) return res.status(400).json({ error: 'U18 crews only accept players under 18.' });
  if (c.age_class === 'Adult' && age < 18) return res.status(400).json({ error: 'Adult crews only accept players 18 and over.' });

  await pool.query(
    'INSERT INTO crew_rosters (crew_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [crewId, targetUserId]
  );
  res.json({ success: true });
});

// Transfer boss
app.post('/api/crews/:id/transfer-boss', requireAuth, async (req, res) => {
  const crewId = req.params.id;
  const { new_boss_id } = req.body;
  const crew = await pool.query('SELECT * FROM crews WHERE id = $1', [crewId]);
  if (!crew.rows.length) return res.status(404).json({ error: 'Crew not found' });
  if (crew.rows[0].boss_id !== req.session.userId) return res.status(403).json({ error: 'Only the Boss can transfer.' });

  const onRoster = await pool.query('SELECT 1 FROM crew_rosters WHERE crew_id = $1 AND user_id = $2', [crewId, new_boss_id]);
  if (!onRoster.rows.length) return res.status(400).json({ error: 'New boss must be on the roster.' });

  await pool.query('UPDATE crews SET boss_id = $1 WHERE id = $2', [new_boss_id, crewId]);
  res.json({ success: true });
});

// Leave a crew (non-boss members only) — costs 25 rep
app.delete('/api/crews/:id/roster', requireAuth, async (req, res) => {
  const crewId = req.params.id;
  const userId = req.session.userId;

  const crew = await pool.query('SELECT boss_id FROM crews WHERE id = $1', [crewId]);
  if (!crew.rows.length) return res.status(404).json({ error: 'Crew not found.' });
  if (crew.rows[0].boss_id === userId) {
    return res.status(400).json({ error: 'You\'re the boss — transfer leadership before leaving.' });
  }

  // Block if in a pending or active match lineup for this crew
  const activeLineup = await pool.query(
    `SELECT m.id FROM match_lineups ml
     JOIN matches m ON m.id = ml.match_id
     WHERE ml.user_id = $1 AND ml.crew_id = $2
       AND m.status IN ('negotiating','locked','active','disputed')`,
    [userId, crewId]
  );
  if (activeLineup.rows.length) {
    return res.status(400).json({ error: 'You\'re locked into an active match. Finish it before leaving.' });
  }

  // Deduct 25 rep from the user's player stats
  await pool.query(
    `UPDATE player_stats SET reputation = GREATEST(0, COALESCE(reputation, 0) - 25) WHERE user_id = $1`,
    [userId]
  );
  await pool.query('DELETE FROM crew_rosters WHERE crew_id = $1 AND user_id = $2', [crewId, userId]);
  res.json({ success: true, rep_lost: 25 });
});

// Player profile (by user ID)
app.get('/api/players/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const user = await pool.query(
    `SELECT u.id, u.username, u.tier,
            COALESCE(ps.total_appearances, 0) AS total_appearances,
            COALESCE(ps.wins, 0) AS wins,
            COALESCE(ps.losses, 0) AS losses,
            COALESCE(ps.reputation, 100) AS reputation,
            COALESCE(ps.coin_balance, 100) AS coin_balance
     FROM users u
     LEFT JOIN player_stats ps ON ps.user_id = u.id
     WHERE u.id = $1`, [id]
  );
  if (!user.rows.length) return res.status(404).json({ error: 'Player not found.' });

  const crews = await pool.query(
    `SELECT c.id, c.name, c.sport_type, c.map_color_hex, c.reputation_score, c.coin_balance,
            cr.joined_at,
            (c.boss_id = $1) AS is_boss
     FROM crew_rosters cr
     JOIN crews c ON c.id = cr.crew_id
     WHERE cr.user_id = $1
     ORDER BY cr.joined_at`,
    [id]
  );

  const recentMatches = await pool.query(
    `SELECT m.id, m.format_type, m.status, m.winner_crew_id, m.wager_amount,
            ch.name AS challenger_name, de.name AS defender_name, wc.name AS winner_name
     FROM match_lineups ml
     JOIN matches m ON m.id = ml.match_id
     LEFT JOIN crews ch ON ch.id = m.challenger_crew_id
     LEFT JOIN crews de ON de.id = m.defender_crew_id
     LEFT JOIN crews wc ON wc.id = m.winner_crew_id
     WHERE ml.user_id = $1 AND m.status IN ('resolved','voided')
     ORDER BY m.id DESC LIMIT 10`, [id]
  );

  const flairRows = await pool.query(
    `SELECT ci.crew_id, si.name FROM crew_inventory ci
     JOIN store_items si ON si.id = ci.item_id
     WHERE ci.equipped = TRUE AND si.item_type = 'profile_flair'
       AND ci.crew_id IN (SELECT crew_id FROM crew_rosters WHERE user_id = $1)`, [id]
  );
  const crewFlair = {};
  for (const f of flairRows.rows) crewFlair[f.crew_id] = f.name;

  res.json({ player: user.rows[0], crews: crews.rows, recentMatches: recentMatches.rows, crewFlair });
});

// Season leaderboard
app.get('/api/seasons/leaderboard', requireAuth, async (req, res) => {
  const season = await pool.query(`SELECT * FROM seasons WHERE status = 'active' ORDER BY id DESC LIMIT 1`);
  const past = await pool.query(`SELECT * FROM seasons WHERE status = 'complete' ORDER BY end_date DESC LIMIT 5`);

  // Current standings: live reputation ranking
  const current = await pool.query(
    `SELECT c.id, c.name, c.map_color_hex, c.reputation_score, c.coin_balance, c.current_win_streak,
            COUNT(m.id) FILTER (WHERE m.winner_crew_id = c.id AND m.status = 'resolved') AS season_wins,
            COUNT(m.id) FILTER (WHERE m.winner_crew_id != c.id AND (m.challenger_crew_id = c.id OR m.defender_crew_id = c.id) AND m.status = 'resolved') AS season_losses
     FROM crews c
     LEFT JOIN matches m ON m.challenger_crew_id = c.id OR m.defender_crew_id = c.id
     GROUP BY c.id ORDER BY c.reputation_score DESC LIMIT 20`
  );

  // Past season results
  const pastResults = {};
  for (const s of past.rows) {
    const rows = await pool.query(
      `SELECT sr.final_rank, sr.final_reputation, c.name AS crew_name, c.map_color_hex
       FROM season_results sr JOIN crews c ON c.id = sr.crew_id
       WHERE sr.season_id = $1 ORDER BY sr.final_rank LIMIT 10`, [s.id]
    );
    pastResults[s.id] = { season: s, results: rows.rows };
  }

  res.json({
    currentSeason: season.rows[0] || null,
    standings: current.rows,
    pastSeasons: pastResults
  });
});

// Court submission fee preview (no side effects)
app.get('/api/courts/submit/fee', requireAuth, async (req, res) => {
  const { crew_id } = req.query;
  const subCount = await pool.query('SELECT COUNT(*) FROM courts WHERE submitted_by_crew_id = $1', [crew_id]);
  const fee = 25 + (parseInt(subCount.rows[0].count) * 25);
  const crew = await pool.query('SELECT coin_balance FROM crews WHERE id = $1', [crew_id]);
  const balance = crew.rows.length ? crew.rows[0].coin_balance : 0;
  res.json({ fee, can_afford: balance >= fee, balance });
});

// ── COURTS ──

app.get('/api/courts', requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT co.*, cr.name AS holder_name, cr.map_color_hex AS holder_color
     FROM courts co
     LEFT JOIN crews cr ON cr.id = co.holding_crew_id
     WHERE co.status = 'active'
     ORDER BY co.type, co.name`
  );
  res.json({ courts: result.rows });
});

// ── MATCHES / CALL-OUTS ──

app.post('/api/matches', requireAuth, async (req, res) => {
  const { challenger_crew_id, defender_crew_id, court_id, wager_amount, format_type, scheduled_time, lineup_user_ids } = req.body;

  // Verify caller is the challenger crew's boss
  const crew = await pool.query('SELECT * FROM crews WHERE id = $1 AND boss_id = $2', [challenger_crew_id, req.session.userId]);
  if (!crew.rows.length) return res.status(403).json({ error: 'Only the crew Boss can issue a Call-Out.' });

  const challengerCrew = crew.rows[0];

  // Block enforcement: reject if either boss has blocked the other
  const defenderCrew = await pool.query('SELECT boss_id FROM crews WHERE id = $1', [defender_crew_id]);
  if (defenderCrew.rows.length) {
    const defenderBossId = defenderCrew.rows[0].boss_id;
    const blocked = await pool.query(
      `SELECT 1 FROM blocks WHERE
        (blocker_user_id = $1 AND blocked_user_id = $2) OR
        (blocker_user_id = $2 AND blocked_user_id = $1)`,
      [req.session.userId, defenderBossId]
    );
    if (blocked.rows.length) return res.status(403).json({ error: 'You cannot challenge this crew.' });
  }

  // Court must be public (venue courts only host Turf Wars)
  const court = await pool.query('SELECT * FROM courts WHERE id = $1 AND status = $2', [court_id, 'active']);
  if (!court.rows.length) return res.status(404).json({ error: 'Court not found.' });
  if (court.rows[0].type !== 'public') return res.status(400).json({ error: 'Call-Outs can only be issued at public courts.' });

  // Wager balance check
  if (wager_amount > 0 && challengerCrew.coin_balance < wager_amount) {
    return res.status(400).json({ error: 'Not enough coins for this wager.' });
  }

  // Validate lineup count matches format
  const formatCount = parseInt(format_type.split('v')[0]);
  if (!lineup_user_ids || lineup_user_ids.length !== formatCount) {
    return res.status(400).json({ error: `A ${format_type} match requires exactly ${formatCount} player(s) in the lineup.` });
  }

  // Check lineup players are on the roster and not already locked in another active match
  for (const uid of lineup_user_ids) {
    const onRoster = await pool.query('SELECT 1 FROM crew_rosters WHERE crew_id = $1 AND user_id = $2', [challenger_crew_id, uid]);
    if (!onRoster.rows.length) return res.status(400).json({ error: `Player ${uid} is not on the roster.` });

    const locked = await pool.query(
      `SELECT 1 FROM match_lineups ml
       JOIN matches m ON m.id = ml.match_id
       WHERE ml.user_id = $1 AND ml.crew_id = $2
       AND m.status IN ('negotiating','locked','active')`,
      [uid, challenger_crew_id]
    );
    if (locked.rows.length) return res.status(400).json({ error: `Player ${uid} is already locked into another active match.` });
  }

  const match = await pool.query(
    `INSERT INTO matches (challenger_crew_id, defender_crew_id, court_id, wager_amount, format_type, scheduled_time, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'negotiating') RETURNING *`,
    [challenger_crew_id, defender_crew_id, court_id, wager_amount || 0, format_type, scheduled_time || null]
  );
  const matchId = match.rows[0].id;

  for (const uid of lineup_user_ids) {
    await pool.query(
      'INSERT INTO match_lineups (match_id, crew_id, user_id) VALUES ($1, $2, $3)',
      [matchId, challenger_crew_id, uid]
    );
  }

  res.json({ success: true, match: match.rows[0] });
});

// Defender responds to a Call-Out
app.post('/api/matches/:id/respond', requireAuth, async (req, res) => {
  const { action, lineup_user_ids } = req.body; // action: 'accept' | 'decline'
  const match = await pool.query('SELECT * FROM matches WHERE id = $1', [req.params.id]);
  if (!match.rows.length) return res.status(404).json({ error: 'Match not found.' });
  const m = match.rows[0];

  // Verify caller is defender crew boss
  const crew = await pool.query('SELECT * FROM crews WHERE id = $1 AND boss_id = $2', [m.defender_crew_id, req.session.userId]);
  if (!crew.rows.length) return res.status(403).json({ error: 'Only the defender crew Boss can respond.' });
  const defenderCrew = crew.rows[0];

  if (m.status !== 'negotiating') return res.status(400).json({ error: 'This match is no longer open for a response.' });

  if (action === 'decline') {
    await pool.query('UPDATE matches SET status = $1 WHERE id = $2', ['voided', m.id]);

    // Turf decline logic
    const court = await pool.query('SELECT * FROM courts WHERE id = $1', [m.court_id]);
    const c = court.rows[0];
    if (c.holding_crew_id === m.defender_crew_id) {
      const newCount = c.holder_decline_count + 1;
      if (newCount >= 3) {
        await pool.query(
          'UPDATE courts SET holding_crew_id = NULL, holder_decline_count = 0, turf_held_since = NULL WHERE id = $1',
          [m.court_id]
        );
        await pool.query(
          `UPDATE matches SET x_message = $1 WHERE id = $2`,
          ['Turf forfeited — 3 challenge declines at this court. Court is now up for grabs. — X', m.id]
        );
      } else {
        await pool.query('UPDATE courts SET holder_decline_count = $1 WHERE id = $2', [newCount, m.court_id]);
      }
    }
    return res.json({ success: true, action: 'declined' });
  }

  if (action === 'accept') {
    // Balance check for defender
    if (m.wager_amount > 0 && defenderCrew.coin_balance < m.wager_amount) {
      return res.status(400).json({ error: 'Not enough coins to accept this wager.' });
    }

    // Lock defender lineup
    const formatCount = parseInt(m.format_type.split('v')[0]);
    if (!lineup_user_ids || lineup_user_ids.length !== formatCount) {
      return res.status(400).json({ error: `A ${m.format_type} match requires exactly ${formatCount} player(s).` });
    }

    for (const uid of lineup_user_ids) {
      const onRoster = await pool.query('SELECT 1 FROM crew_rosters WHERE crew_id = $1 AND user_id = $2', [m.defender_crew_id, uid]);
      if (!onRoster.rows.length) return res.status(400).json({ error: `Player ${uid} is not on the roster.` });

      await pool.query(
        'INSERT INTO match_lineups (match_id, crew_id, user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [m.id, m.defender_crew_id, uid]
      );
    }

    await pool.query('UPDATE matches SET status = $1 WHERE id = $2', ['locked', m.id]);
    return res.json({ success: true, action: 'accepted' });
  }

  res.status(400).json({ error: 'Invalid action. Use "accept" or "decline".' });
});

// Report score
app.post('/api/matches/:id/report-score', requireAuth, async (req, res) => {
  const { score, crew_id } = req.body;
  const match = await pool.query('SELECT * FROM matches WHERE id = $1', [req.params.id]);
  if (!match.rows.length) return res.status(404).json({ error: 'Match not found.' });
  const m = match.rows[0];

  if (!['locked', 'active', 'disputed'].includes(m.status)) {
    return res.status(400).json({ error: 'This match is not in a reportable state.' });
  }

  // Verify caller is boss of the reporting crew
  const crew = await pool.query('SELECT * FROM crews WHERE id = $1 AND boss_id = $2', [crew_id, req.session.userId]);
  if (!crew.rows.length) return res.status(403).json({ error: 'Only the crew Boss can report a score.' });

  const isChallenger = parseInt(crew_id) === m.challenger_crew_id;
  const isDefender = parseInt(crew_id) === m.defender_crew_id;
  if (!isChallenger && !isDefender) return res.status(403).json({ error: 'Your crew is not in this match.' });

  const field = isChallenger ? 'challenger_reported_score' : 'defender_reported_score';
  await pool.query(`UPDATE matches SET ${field} = $1 WHERE id = $2`, [score, m.id]);

  // Re-fetch to check both scores
  const updated = await pool.query('SELECT * FROM matches WHERE id = $1', [m.id]);
  const u = updated.rows[0];

  if (u.challenger_reported_score && u.defender_reported_score) {
    if (u.challenger_reported_score === u.defender_reported_score) {
      // Scores agree — resolve; snapshot rep before to detect tier-up for reporting crew
      const myCrewId = parseInt(crew_id);
      const repSnap = await pool.query('SELECT reputation_score FROM crews WHERE id = $1', [myCrewId]);
      const repBefore = repSnap.rows[0]?.reputation_score ?? 0;
      await resolveMatch(u);
      const repSnapAfter = await pool.query('SELECT reputation_score FROM crews WHERE id = $1', [myCrewId]);
      const repAfterVal = repSnapAfter.rows[0]?.reputation_score ?? 0;
      const tieredUp = [200, 500, 1000].find(t => repBefore < t && repAfterVal >= t) || null;
      return res.json({ success: true, resolved: true, tiered_up: tieredUp });
    } else {
      // Mismatch — start dispute clock if not already started
      if (!u.disputed_at) {
        await pool.query('UPDATE matches SET status = $1, disputed_at = NOW() WHERE id = $2', ['disputed', m.id]);
      }
      return res.json({ success: true, disputed: true });
    }
  }

  res.json({ success: true });
});

async function resolveMatch(m) {
  // Parse scores like "21-14" — challenger score is first number
  const parts = m.challenger_reported_score.split('-').map(Number);
  const challengerScore = parts[0];
  const defenderScore = parts[1];
  const winnerId = challengerScore > defenderScore ? m.challenger_crew_id : m.defender_crew_id;
  const loserId = winnerId === m.challenger_crew_id ? m.defender_crew_id : m.challenger_crew_id;

  await pool.query(
    'UPDATE matches SET status = $1, winner_crew_id = $2 WHERE id = $3',
    ['resolved', winnerId, m.id]
  );

  // Coins: wager
  if (m.wager_amount > 0) {
    const rake = Math.floor(m.wager_amount * 0.1);
    const winnings = m.wager_amount - rake;
    await pool.query('UPDATE crews SET coin_balance = coin_balance - $1 WHERE id = $2', [m.wager_amount, loserId]);
    await pool.query('UPDATE crews SET coin_balance = coin_balance + $1 WHERE id = $2', [winnings, winnerId]);
    await pool.query('INSERT INTO coin_transactions (crew_id, amount, reason, match_id) VALUES ($1, $2, $3, $4)',
      [loserId, -m.wager_amount, 'match_wager', m.id]);
    await pool.query('INSERT INTO coin_transactions (crew_id, amount, reason, match_id) VALUES ($1, $2, $3, $4)',
      [winnerId, winnings, 'match_win', m.id]);
    await pool.query('INSERT INTO coin_transactions (crew_id, amount, reason, match_id) VALUES ($1, $2, $3, $4)',
      [winnerId, -rake, 'rake', m.id]);
  }

  // Spectator wager payouts — parimutuel: losers' pool split to winners proportionally
  const wagers = await pool.query('SELECT * FROM match_wagers WHERE match_id=$1 AND status=$2', [m.id, 'pending']);
  if (wagers.rows.length) {
    const winners = wagers.rows.filter(w => w.crew_id_bet_on === winnerId);
    const losers  = wagers.rows.filter(w => w.crew_id_bet_on === loserId);
    const loserPool = losers.reduce((s, w) => s + w.amount, 0);
    const winnerStake = winners.reduce((s, w) => s + w.amount, 0);
    for (const w of losers) {
      await pool.query('UPDATE match_wagers SET status=$1 WHERE id=$2', ['lost', w.id]);
    }
    for (const w of winners) {
      const share = winnerStake > 0 ? Math.floor(loserPool * w.amount / winnerStake) : 0;
      const payout = w.amount + share;
      await pool.query('UPDATE match_wagers SET status=$1, payout=$2 WHERE id=$3', ['won', payout, w.id]);
      await pool.query('UPDATE player_stats SET coin_balance = coin_balance + $1 WHERE user_id=$2', [payout, w.user_id]);
    }
    // No winners (everyone bet on loser) — house keeps nothing, already deducted
  }

  // Clean-play bonus (no dispute)
  if (!m.disputed_at) {
    const cleanBonus = 10;
    await pool.query('UPDATE crews SET coin_balance = coin_balance + $1 WHERE id = $2', [cleanBonus, winnerId]);
    await pool.query('UPDATE crews SET coin_balance = coin_balance + $1 WHERE id = $2', [cleanBonus, loserId]);
    await pool.query('INSERT INTO coin_transactions (crew_id, amount, reason, match_id) VALUES ($1, $2, $3, $4)',
      [winnerId, cleanBonus, 'clean_play', m.id]);
    await pool.query('INSERT INTO coin_transactions (crew_id, amount, reason, match_id) VALUES ($1, $2, $3, $4)',
      [loserId, cleanBonus, 'clean_play', m.id]);
  }

  // Reputation — capture before/after to detect tier crossings
  const repBefore = await pool.query('SELECT reputation_score FROM crews WHERE id = $1', [winnerId]);
  const oldRep = repBefore.rows[0].reputation_score;
  await pool.query('UPDATE crews SET reputation_score = reputation_score + 25 WHERE id = $1', [winnerId]);
  await pool.query('UPDATE crews SET reputation_score = GREATEST(0, reputation_score - 10) WHERE id = $1', [loserId]);
  const repAfter = await pool.query('SELECT reputation_score FROM crews WHERE id = $1', [winnerId]);
  const newRep = repAfter.rows[0].reputation_score;
  // Tier thresholds: 200=Up & Comer, 500=Baller, 1000=Legend

  // Win streak
  await pool.query('UPDATE crews SET current_win_streak = current_win_streak + 1 WHERE id = $1', [winnerId]);
  await pool.query('UPDATE crews SET current_win_streak = 0 WHERE id = $1', [loserId]);

  // Trophy case — snapshot loser's name and logo at time of win
  const loserSnap = await pool.query('SELECT name, logo_url FROM crews WHERE id = $1', [loserId]);
  if (loserSnap.rows.length) {
    const { name: loserName, logo_url: loserLogo } = loserSnap.rows[0];
    await pool.query(`
      INSERT INTO crew_trophy_case (crew_id, defeated_crew_id, defeated_crew_name, defeated_logo_url, win_count, last_win_at)
      VALUES ($1, $2, $3, $4, 1, NOW())
      ON CONFLICT (crew_id, defeated_crew_id) DO UPDATE SET
        win_count = crew_trophy_case.win_count + 1,
        defeated_crew_name = $3,
        defeated_logo_url = $4,
        last_win_at = NOW()
    `, [winnerId, loserId, loserName, loserLogo]);
  }

  // Streak bonuses
  const winner = await pool.query('SELECT current_win_streak FROM crews WHERE id = $1', [winnerId]);
  const streak = winner.rows[0].current_win_streak;
  let streakBonus = 0;
  if (streak === 3) streakBonus = 15;
  else if (streak === 5) streakBonus = 30;
  else if (streak >= 10) streakBonus = 75;
  if (streakBonus > 0) {
    await pool.query('UPDATE crews SET coin_balance = coin_balance + $1 WHERE id = $2', [streakBonus, winnerId]);
    await pool.query('INSERT INTO coin_transactions (crew_id, amount, reason, match_id) VALUES ($1, $2, $3, $4)',
      [winnerId, streakBonus, 'win_streak', m.id]);
  }

  // Player stats
  const lineup = await pool.query('SELECT user_id, crew_id FROM match_lineups WHERE match_id = $1', [m.id]);
  for (const row of lineup.rows) {
    const isWinner = row.crew_id === winnerId;
    await pool.query(
      `INSERT INTO player_stats (user_id, total_appearances, wins, losses)
       VALUES ($1, 1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET
         total_appearances = player_stats.total_appearances + 1,
         wins = player_stats.wins + $2,
         losses = player_stats.losses + $3`,
      [row.user_id, isWinner ? 1 : 0, isWinner ? 0 : 1]
    );
  }

  // Turf: update holding_crew_id to winner
  await pool.query(
    'UPDATE courts SET holding_crew_id = $1, holder_decline_count = 0, turf_held_since = NOW() WHERE id = $2',
    [winnerId, m.court_id]
  );

  // Check achievements
  await checkAchievements(winnerId, m);

  // Update quest progress for both crews
  await updateQuestProgress(winnerId, 'win_match', 1, m);
  await updateQuestProgress(winnerId, 'win_streak', streak, m);
  if (!m.disputed_at) await updateQuestProgress(winnerId, 'clean_game', 1, m);

  // hold_courts: re-count turf after update
  const turfCount = await pool.query('SELECT COUNT(*) FROM courts WHERE holding_crew_id = $1', [winnerId]);
  await updateQuestProgress(winnerId, 'hold_courts', parseInt(turfCount.rows[0].count), m);

  // Check for earned cosmetics
  await checkEarnedCosmetics(winnerId);

  // Advance tournament bracket or rotation queue
  if (m.tournament_id) {
    const tourn = await pool.query('SELECT bracket_type FROM tournaments WHERE id = $1', [m.tournament_id]);
    if (tourn.rows.length) {
      if (tourn.rows[0].bracket_type === 'rotation') {
        await handleRotationMatchResolved(m, winnerId, loserId);
      } else if (m.tournament_round) {
        await advanceTournamentBracket(m.tournament_id, m.tournament_round);
      }
    }
  }
}

async function checkEarnedCosmetics(crewId) {
  const items = await pool.query(`SELECT * FROM store_items WHERE unlock_type = 'achievement'`);
  if (!items.rows.length) return;

  const crew = await pool.query('SELECT current_win_streak FROM crews WHERE id = $1', [crewId]);
  if (!crew.rows.length) return;
  const streak = crew.rows[0].current_win_streak;

  const turf = await pool.query(`SELECT COUNT(*) FROM courts WHERE holding_crew_id = $1 AND status = 'active'`, [crewId]);
  const turfHeld = parseInt(turf.rows[0].count);

  const defWins = await pool.query(
    `SELECT COUNT(*) FROM matches WHERE defender_crew_id = $1 AND winner_crew_id = $1 AND status = 'resolved'`, [crewId]
  );
  const defenderWins = parseInt(defWins.rows[0].count);

  const claimed = await pool.query(
    `SELECT COUNT(*) FROM crew_quest_progress WHERE crew_id = $1 AND claimed = TRUE`, [crewId]
  );
  const questsClaimed = parseInt(claimed.rows[0].count);

  for (const item of items.rows) {
    const already = await pool.query(
      'SELECT id FROM crew_inventory WHERE crew_id = $1 AND item_id = $2', [crewId, item.id]
    );
    if (already.rows.length) continue;

    let unlocked = false;
    if (item.unlock_requirement === 'win_streak_10'    && streak >= 10)       unlocked = true;
    if (item.unlock_requirement === 'hold_3_courts'    && turfHeld >= 3)      unlocked = true;
    if (item.unlock_requirement === 'defender_wins_3'  && defenderWins >= 3)  unlocked = true;
    if (item.unlock_requirement === 'quests_claimed_5' && questsClaimed >= 5) unlocked = true;

    if (unlocked) {
      await pool.query('INSERT INTO crew_inventory (crew_id, item_id) VALUES ($1, $2)', [crewId, item.id]);
    }
  }
}

async function updateQuestProgress(crewId, requirementType, value, match) {
  // Find active quests of this type
  const quests = await pool.query(`
    SELECT * FROM quests
    WHERE requirement_type = $1
    AND active_from <= CURRENT_DATE AND active_until >= CURRENT_DATE
  `, [requirementType]);

  for (const q of quests.rows) {
    // Determine current period start for cadence
    const periodStart = q.cadence === 'daily'
      ? new Date().toISOString().slice(0, 10)            // today
      : getWeekStart();                                   // this Monday

    // Upsert progress row
    const existing = await pool.query(
      'SELECT * FROM crew_quest_progress WHERE crew_id = $1 AND quest_id = $2',
      [crewId, q.id]
    );

    if (!existing.rows.length) {
      // New row
      const newCount = requirementType === 'hold_courts' || requirementType === 'win_streak'
        ? value  // absolute value
        : 1;     // increment
      const completed = newCount >= q.requirement_count ? new Date() : null;
      await pool.query(
        `INSERT INTO crew_quest_progress (crew_id, quest_id, progress_count, completed_at, claimed, period_start)
         VALUES ($1, $2, $3, $4, false, $5)`,
        [crewId, q.id, newCount, completed, periodStart]
      );
    } else {
      const row = existing.rows[0];
      // Reset if period has rolled over
      const needsReset = row.period_start && row.period_start.toISOString().slice(0, 10) < periodStart;
      if (needsReset) {
        const newCount = requirementType === 'hold_courts' || requirementType === 'win_streak' ? value : 1;
        const completed = newCount >= q.requirement_count ? new Date() : null;
        await pool.query(
          `UPDATE crew_quest_progress SET progress_count = $1, completed_at = $2, claimed = false, period_start = $3
           WHERE crew_id = $4 AND quest_id = $5`,
          [newCount, completed, periodStart, crewId, q.id]
        );
      } else if (!row.claimed) {
        // Already in period — increment or update absolute
        let newCount;
        if (requirementType === 'hold_courts' || requirementType === 'win_streak') {
          newCount = Math.max(row.progress_count, value); // take the highest seen this period
        } else {
          newCount = row.progress_count + 1;
        }
        const completed = row.completed_at || (newCount >= q.requirement_count ? new Date() : null);
        await pool.query(
          `UPDATE crew_quest_progress SET progress_count = $1, completed_at = $2, period_start = $3
           WHERE crew_id = $4 AND quest_id = $5`,
          [newCount, completed, periodStart, crewId, q.id]
        );
      }
    }
  }
}

function getWeekStart() {
  const d = new Date();
  const day = d.getDay(); // 0 = Sunday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  return new Date(d.setDate(diff)).toISOString().slice(0, 10);
}

async function checkAchievements(crewId, match) {
  // First Blood — first ever win
  const wins = await pool.query('SELECT COUNT(*) FROM matches WHERE winner_crew_id = $1', [crewId]);
  if (parseInt(wins.rows[0].count) === 1) {
    await awardAchievement(crewId, 'First Blood');
  }

  // Giant Killer — beat a crew with 200+ more reputation
  const loserCrew = crewId === match.challenger_crew_id ? match.defender_crew_id : match.challenger_crew_id;
  const repDiff = await pool.query(
    'SELECT (d.reputation_score - w.reputation_score) AS diff FROM crews w, crews d WHERE w.id = $1 AND d.id = $2',
    [crewId, loserCrew]
  );
  if (repDiff.rows.length && repDiff.rows[0].diff >= 200) {
    await awardAchievement(crewId, 'Giant Killer');
  }

  // Turf Lord — hold 3 courts
  const turfCount = await pool.query('SELECT COUNT(*) FROM courts WHERE holding_crew_id = $1', [crewId]);
  if (parseInt(turfCount.rows[0].count) >= 3) {
    await awardAchievement(crewId, 'Turf Lord');
  }

  // Clean Game — 10 wins with no dispute
  if (!match.disputed_at) {
    const cleanWins = await pool.query(
      `SELECT COUNT(*) FROM matches WHERE winner_crew_id = $1 AND disputed_at IS NULL AND status = 'resolved'`,
      [crewId]
    );
    if (parseInt(cleanWins.rows[0].count) >= 10) {
      await awardAchievement(crewId, 'Clean Game');
    }
  }
}

async function awardAchievement(crewId, name) {
  const ach = await pool.query('SELECT id FROM achievements WHERE name = $1', [name]);
  if (ach.rows.length) {
    await pool.query(
      'INSERT INTO crew_achievements (crew_id, achievement_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [crewId, ach.rows[0].id]
    );
  }
}

// Auto-void disputed matches past 48 hours (run this on a schedule)
async function autoVoidExpiredDisputes() {
  const expired = await pool.query(
    `SELECT * FROM matches WHERE status = 'disputed' AND disputed_at < NOW() - INTERVAL '48 hours'`
  );
  for (const m of expired.rows) {
    await pool.query(
      `UPDATE matches SET status = 'voided', x_message = $1 WHERE id = $2`,
      ['Score dispute unresolved after 48 hours. Match voided — wagers refunded. — X', m.id]
    );
    if (m.wager_amount > 0) {
      await pool.query('UPDATE crews SET coin_balance = coin_balance + $1 WHERE id = $2', [m.wager_amount, m.challenger_crew_id]);
      await pool.query('UPDATE crews SET coin_balance = coin_balance + $1 WHERE id = $2', [m.wager_amount, m.defender_crew_id]);
      await pool.query('INSERT INTO coin_transactions (crew_id, amount, reason, match_id) VALUES ($1, $2, $3, $4)',
        [m.challenger_crew_id, m.wager_amount, 'match_void_refund', m.id]);
      await pool.query('INSERT INTO coin_transactions (crew_id, amount, reason, match_id) VALUES ($1, $2, $3, $4)',
        [m.defender_crew_id, m.wager_amount, 'match_void_refund', m.id]);
    }
    // Refund spectator wagers
    const spectatorWagers = await pool.query(
      `SELECT * FROM match_wagers WHERE match_id=$1 AND status='pending'`, [m.id]
    );
    for (const w of spectatorWagers.rows) {
      await pool.query('UPDATE match_wagers SET status=$1, payout=$2 WHERE id=$3', ['refunded', w.amount, w.id]);
      await pool.query('UPDATE player_stats SET coin_balance = coin_balance + $1 WHERE user_id=$2', [w.amount, w.user_id]);
    }
  }
}

// Run auto-void check every hour
setInterval(autoVoidExpiredDisputes, 60 * 60 * 1000);

app.get('/api/matches', requireAuth, async (req, res) => {
  const { crew_id } = req.query;
  let query = `
    SELECT m.*,
      cc.name AS challenger_name, dc.name AS defender_name,
      wc.name AS winner_name, co.name AS court_name
    FROM matches m
    LEFT JOIN crews cc ON cc.id = m.challenger_crew_id
    LEFT JOIN crews dc ON dc.id = m.defender_crew_id
    LEFT JOIN crews wc ON wc.id = m.winner_crew_id
    LEFT JOIN courts co ON co.id = m.court_id
  `;
  const params = [];
  if (crew_id) {
    query += ' WHERE m.challenger_crew_id = $1 OR m.defender_crew_id = $1';
    params.push(crew_id);
  }
  query += ' ORDER BY m.id DESC LIMIT 50';
  const result = await pool.query(query, params);
  res.json({ matches: result.rows });
});

// ── REPORT & BLOCK ──

app.post('/api/reports', requireAuth, async (req, res) => {
  const { reported_user_id, reported_crew_id, reason, note } = req.body;
  await pool.query(
    'INSERT INTO reports (reporter_user_id, reported_user_id, reported_crew_id, reason, note) VALUES ($1, $2, $3, $4, $5)',
    [req.session.userId, reported_user_id || null, reported_crew_id || null, reason, note || null]
  );
  res.json({ success: true });
});

app.post('/api/blocks', requireAuth, async (req, res) => {
  const { blocked_user_id } = req.body;
  await pool.query(
    'INSERT INTO blocks (blocker_user_id, blocked_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [req.session.userId, blocked_user_id]
  );
  res.json({ success: true });
});

// ── THE WIRE ──

app.get('/api/wire', async (req, res) => {
  // Public feed — no auth required
  const upcoming = await pool.query(`
    SELECT m.*,
      cc.name AS challenger_name, cc.map_color_hex AS challenger_color,
      dc.name AS defender_name, dc.map_color_hex AS defender_color,
      co.name AS court_name,
      wc.name AS winner_name
    FROM matches m
    LEFT JOIN crews cc ON cc.id = m.challenger_crew_id
    LEFT JOIN crews dc ON dc.id = m.defender_crew_id
    LEFT JOIN crews wc ON wc.id = m.winner_crew_id
    LEFT JOIN courts co ON co.id = m.court_id
    WHERE m.status IN ('locked','active','negotiating')
    ORDER BY m.scheduled_time ASC NULLS LAST, m.id DESC
    LIMIT 20
  `);
  const recent = await pool.query(`
    SELECT m.*,
      cc.name AS challenger_name, cc.map_color_hex AS challenger_color,
      dc.name AS defender_name, dc.map_color_hex AS defender_color,
      co.name AS court_name,
      wc.name AS winner_name, wc.map_color_hex AS winner_color
    FROM matches m
    LEFT JOIN crews cc ON cc.id = m.challenger_crew_id
    LEFT JOIN crews dc ON dc.id = m.defender_crew_id
    LEFT JOIN crews wc ON wc.id = m.winner_crew_id
    LEFT JOIN courts co ON co.id = m.court_id
    WHERE m.status IN ('resolved','voided','disputed')
    ORDER BY m.id DESC
    LIMIT 30
  `);
  res.json({ upcoming: upcoming.rows, recent: recent.rows });
});

// Hype a match (one per user per match)
app.post('/api/matches/:id/hype', requireAuth, async (req, res) => {
  const matchId = req.params.id;
  const userId = req.session.userId;

  const already = await pool.query(
    'SELECT 1 FROM match_hypes WHERE match_id = $1 AND user_id = $2', [matchId, userId]
  );
  if (already.rows.length) return res.status(400).json({ error: 'Already hyped.', already_hyped: true });

  await pool.query('INSERT INTO match_hypes (match_id, user_id) VALUES ($1, $2)', [matchId, userId]);

  const result = await pool.query(
    'UPDATE matches SET hype_count = hype_count + 1 WHERE id = $1 RETURNING hype_count',
    [matchId]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Match not found' });
  const count = result.rows[0].hype_count;

  // Hype bonus at threshold of 10
  if (count === 10) {
    const match = await pool.query('SELECT * FROM matches WHERE id = $1', [req.params.id]);
    const m = match.rows[0];
    if (m && m.challenger_crew_id && m.defender_crew_id) {
      for (const crewId of [m.challenger_crew_id, m.defender_crew_id]) {
        await pool.query('UPDATE crews SET coin_balance = coin_balance + 15 WHERE id = $1', [crewId]);
        await pool.query('INSERT INTO coin_transactions (crew_id, amount, reason, match_id) VALUES ($1, 15, $2, $3)',
          [crewId, 'hype_bonus', m.id]);
      }
    }
  }
  res.json({ hype_count: count });
});

// ── SPECTATOR WAGERS ──

// Get wager totals + user's existing bet for a match
app.get('/api/matches/:id/wagers', requireAuth, async (req, res) => {
  const matchId = req.params.id;
  const userId = req.session.userId;
  const [totals, mine, bal] = await Promise.all([
    pool.query(`
      SELECT crew_id_bet_on, SUM(amount) AS total
      FROM match_wagers WHERE match_id = $1 AND status = 'pending'
      GROUP BY crew_id_bet_on
    `, [matchId]),
    pool.query(`SELECT * FROM match_wagers WHERE match_id=$1 AND user_id=$2`, [matchId, userId]),
    pool.query(`SELECT coin_balance FROM player_stats WHERE user_id=$1`, [userId]),
  ]);
  res.json({
    totals: totals.rows,
    mine: mine.rows[0] || null,
    coin_balance: bal.rows[0]?.coin_balance ?? 100,
  });
});

// Place a wager
app.post('/api/matches/:id/wager', requireAuth, async (req, res) => {
  const matchId = parseInt(req.params.id);
  const userId = req.session.userId;
  const { crew_id, amount } = req.body;
  const coins = parseInt(amount);
  if (!coins || coins < 5) return res.status(400).json({ error: 'Minimum bet is 5 coins.' });
  if (coins > 500) return res.status(400).json({ error: 'Maximum bet is 500 coins.' });

  const match = await pool.query('SELECT * FROM matches WHERE id=$1', [matchId]);
  if (!match.rows.length) return res.status(404).json({ error: 'Match not found.' });
  if (match.rows[0].status !== 'locked') return res.status(400).json({ error: 'Wagers only open on locked matches.' });
  if (crew_id !== match.rows[0].challenger_crew_id && crew_id !== match.rows[0].defender_crew_id) {
    return res.status(400).json({ error: 'Invalid crew.' });
  }

  // Ensure player_stats row exists
  await pool.query(`INSERT INTO player_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [userId]);

  const bal = await pool.query('SELECT coin_balance FROM player_stats WHERE user_id=$1', [userId]);
  if ((bal.rows[0]?.coin_balance ?? 0) < coins) return res.status(400).json({ error: 'Not enough coins.' });

  const existing = await pool.query('SELECT id FROM match_wagers WHERE match_id=$1 AND user_id=$2', [matchId, userId]);
  if (existing.rows.length) return res.status(400).json({ error: 'You already have a bet on this match.' });

  await pool.query('UPDATE player_stats SET coin_balance = coin_balance - $1 WHERE user_id=$2', [coins, userId]);
  await pool.query(
    'INSERT INTO match_wagers (match_id, user_id, crew_id_bet_on, amount) VALUES ($1,$2,$3,$4)',
    [matchId, userId, crew_id, coins]
  );
  const newBal = await pool.query('SELECT coin_balance FROM player_stats WHERE user_id=$1', [userId]);
  res.json({ success: true, coin_balance: newBal.rows[0].coin_balance });
});

// ── MAP ──

app.get('/api/map/courts', async (req, res) => {
  const result = await pool.query(`
    SELECT co.id, co.name, co.type, co.latitude, co.longitude,
      co.holding_crew_id, co.holder_decline_count,
      cr.name AS holder_name, cr.map_color_hex AS holder_color,
      v.name AS venue_name
    FROM courts co
    LEFT JOIN crews cr ON cr.id = co.holding_crew_id
    LEFT JOIN venues v ON v.id = co.venue_id
    WHERE co.status = 'active'
      AND co.latitude IS NOT NULL
      AND co.longitude IS NOT NULL
  `);
  res.json({ courts: result.rows });
});

// ── QUESTS ──

app.get('/api/quests', requireAuth, async (req, res) => {
  const { crew_id } = req.query;
  if (!crew_id) return res.status(400).json({ error: 'crew_id required' });

  const quests = await pool.query(`
    SELECT q.*,
      COALESCE(qp.progress_count, 0) AS progress_count,
      qp.completed_at, qp.claimed
    FROM quests q
    LEFT JOIN crew_quest_progress qp ON qp.quest_id = q.id AND qp.crew_id = $1
    WHERE q.active_from <= CURRENT_DATE AND q.active_until >= CURRENT_DATE
    ORDER BY q.cadence, q.coin_reward DESC
  `, [crew_id]);
  res.json({ quests: quests.rows });
});

app.post('/api/quests/:id/claim', requireAuth, async (req, res) => {
  const { crew_id } = req.body;
  const questId = req.params.id;

  const progress = await pool.query(
    'SELECT * FROM crew_quest_progress WHERE crew_id = $1 AND quest_id = $2',
    [crew_id, questId]
  );
  if (!progress.rows.length || !progress.rows[0].completed_at) {
    return res.status(400).json({ error: 'Quest not completed yet.' });
  }
  if (progress.rows[0].claimed) {
    return res.status(400).json({ error: 'Already claimed.' });
  }

  const quest = await pool.query('SELECT * FROM quests WHERE id = $1', [questId]);
  const reward = quest.rows[0].coin_reward;

  await pool.query('UPDATE crew_quest_progress SET claimed = TRUE WHERE crew_id = $1 AND quest_id = $2', [crew_id, questId]);
  await pool.query('UPDATE crews SET coin_balance = coin_balance + $1 WHERE id = $2', [reward, crew_id]);
  await pool.query('INSERT INTO coin_transactions (crew_id, amount, reason) VALUES ($1, $2, $3)',
    [crew_id, reward, 'quest_reward']);

  await checkEarnedCosmetics(crew_id);

  res.json({ success: true, coins_earned: reward });
});

// ── PUBLIC COURT SUBMISSION ──

app.post('/api/courts/submit', requireAuth, async (req, res) => {
  const { name, latitude, longitude, crew_id, client_latitude, client_longitude } = req.body;

  // GPS proximity check — submitted location must be within 500m of the device
  if (client_latitude != null && client_longitude != null) {
    const latDiff = latitude - client_latitude;
    const lngDiff = longitude - client_longitude;
    const distMeters = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111000;
    if (distMeters > 500) {
      return res.status(400).json({
        error: `You need to be near this location to submit it. You appear to be ${Math.round(distMeters)}m away (max 500m). — X`
      });
    }
  }

  if (containsProfanity(name)) {
    return res.status(400).json({ error: 'Court name isn\'t allowed. Choose another.' });
  }

  // Check for duplicate within ~100m radius
  const nearby = await pool.query(`
    SELECT id FROM courts
    WHERE (latitude - $1)^2 + (longitude - $2)^2 < 0.000001
    AND status != 'archived'
  `, [latitude, longitude]);
  if (nearby.rows.length) {
    return res.status(400).json({ error: 'A court already exists at this location.' });
  }

  // Escalating fee: base 25 coins, +25 per additional submission by this crew in last 7 days
  const recentSubs = await pool.query(`
    SELECT COUNT(*) FROM courts
    WHERE submitted_by_crew_id = $1
    AND status = 'pending'
    AND id > (SELECT COALESCE(MAX(id),0) FROM courts WHERE submitted_by_crew_id = $1
              AND (CURRENT_TIMESTAMP - '7 days'::interval) > '2000-01-01'::timestamp)
  `, [crew_id]);
  // Simpler: count submissions by this crew in last 7 days
  const subCount = await pool.query(`
    SELECT COUNT(*) FROM courts WHERE submitted_by_crew_id = $1
  `, [crew_id]);
  const fee = 25 + (parseInt(subCount.rows[0].count) * 25);

  const crew = await pool.query('SELECT coin_balance FROM crews WHERE id = $1', [crew_id]);
  if (!crew.rows.length) return res.status(404).json({ error: 'Crew not found.' });
  if (crew.rows[0].coin_balance < fee) {
    return res.status(400).json({ error: `Not enough coins. Court submission costs ⚡ ${fee}.` });
  }

  await pool.query('UPDATE crews SET coin_balance = coin_balance - $1 WHERE id = $2', [fee, crew_id]);
  await pool.query('INSERT INTO coin_transactions (crew_id, amount, reason) VALUES ($1, $2, $3)',
    [crew_id, -fee, 'court_submission']);

  const court = await pool.query(
    `INSERT INTO courts (name, type, latitude, longitude, submitted_by_crew_id, status)
     VALUES ($1, 'public', $2, $3, $4, 'pending') RETURNING *`,
    [name.trim(), latitude, longitude, crew_id]
  );

  res.json({ success: true, court: court.rows[0], fee_paid: fee });
});

// ── CREW PROFILE (public-ish) ──

app.get('/api/crews/:id/profile', requireAuth, async (req, res) => {
  const { id } = req.params;
  const crew = await pool.query(
    `SELECT c.*, u.username AS boss_username FROM crews c JOIN users u ON u.id = c.boss_id WHERE c.id = $1`, [id]
  );
  if (!crew.rows.length) return res.status(404).json({ error: 'Crew not found' });

  const roster = await pool.query(
    `SELECT u.id, u.username, ps.wins, ps.losses, ps.total_appearances
     FROM crew_rosters cr
     JOIN users u ON u.id = cr.user_id
     LEFT JOIN player_stats ps ON ps.user_id = u.id
     WHERE cr.crew_id = $1`, [id]
  );
  const turf = await pool.query(
    `SELECT id, name, type FROM courts WHERE holding_crew_id = $1 AND status = 'active'`, [id]
  );
  const achievements = await pool.query(
    `SELECT a.name, a.description, ca.earned_at
     FROM crew_achievements ca JOIN achievements a ON a.id = ca.achievement_id
     WHERE ca.crew_id = $1`, [id]
  );
  const matchHistory = await pool.query(
    `SELECT m.id, m.format_type, m.status, m.winner_crew_id, m.wager_amount, m.hype_count,
       m.challenger_crew_id, m.defender_crew_id,
       cc.name AS challenger_name, dc.name AS defender_name, co.name AS court_name
     FROM matches m
     LEFT JOIN crews cc ON cc.id = m.challenger_crew_id
     LEFT JOIN crews dc ON dc.id = m.defender_crew_id
     LEFT JOIN courts co ON co.id = m.court_id
     WHERE (m.challenger_crew_id = $1 OR m.defender_crew_id = $1)
       AND m.status IN ('resolved','voided')
     ORDER BY m.id DESC LIMIT 10`, [id]
  );

  const wins = matchHistory.rows.filter(m => m.winner_crew_id === parseInt(id)).length;
  const losses = matchHistory.rows.filter(m => m.status === 'resolved' && m.winner_crew_id !== parseInt(id)).length;

  const equipped = await pool.query(
    `SELECT si.item_type, si.name FROM crew_inventory ci
     JOIN store_items si ON si.id = ci.item_id
     WHERE ci.crew_id = $1 AND ci.equipped = TRUE`, [id]
  );
  const equippedMap = {};
  for (const e of equipped.rows) equippedMap[e.item_type] = e.name;

  const trophyCase = await pool.query(
    `SELECT * FROM crew_trophy_case WHERE crew_id = $1 ORDER BY win_count DESC`, [id]
  );

  res.json({
    crew: crew.rows[0], roster: roster.rows, turf: turf.rows,
    achievements: achievements.rows, matchHistory: matchHistory.rows,
    record: { wins, losses }, equipped: equippedMap,
    trophyCase: trophyCase.rows
  });
});

// ── COIN LEDGER ──

app.get('/api/crews/:id/coins', requireAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM coin_transactions WHERE crew_id = $1 ORDER BY created_at DESC LIMIT 50',
    [req.params.id]
  );
  res.json({ transactions: result.rows });
});

// ── TOURNAMENTS (TURF WARS) ──

app.get('/api/tournaments', requireAuth, async (req, res) => {
  const result = await pool.query(`
    SELECT t.*,
      co.name AS court_name, v.name AS venue_name,
      (SELECT COUNT(*) FROM tournament_entries te WHERE te.tournament_id = t.id AND te.status != 'refunded') AS entry_count
    FROM tournaments t
    LEFT JOIN courts co ON co.id = t.court_id
    LEFT JOIN venues v ON v.id = t.venue_id
    ORDER BY t.created_at DESC
    LIMIT 50
  `);
  res.json({ tournaments: result.rows });
});

app.post('/api/tournaments', requireAuth, async (req, res) => {
  const { name, bracket_type, court_id, venue_id, format_type, event_start_time, event_end_time } = req.body;
  if (!name || !format_type) return res.status(400).json({ error: 'name and format_type required.' });

  if (venue_id) {
    const user = await pool.query('SELECT tier FROM users WHERE id = $1', [req.session.userId]);
    const venue = await pool.query('SELECT venue_manager_user_id FROM venues WHERE id = $1', [venue_id]);
    const isManager = venue.rows.length && venue.rows[0].venue_manager_user_id === req.session.userId;
    const isAdmin = user.rows[0]?.tier === 'operator';
    if (!isManager && !isAdmin) return res.status(403).json({ error: 'Only the venue manager or platform admin can create venue tournaments.' });
  }

  const t = await pool.query(
    `INSERT INTO tournaments (name, bracket_type, court_id, venue_id, format_type, event_start_time, event_end_time)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [name.trim(), bracket_type || 'bracket', court_id || null, venue_id || null, format_type,
     event_start_time || null, event_end_time || null]
  );
  res.json({ success: true, tournament: t.rows[0] });
});

app.get('/api/tournaments/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const t = await pool.query(`
    SELECT t.*, co.name AS court_name, v.name AS venue_name,
      v.tournament_entry_fee_cents, v.platform_fee_pct
    FROM tournaments t
    LEFT JOIN courts co ON co.id = t.court_id
    LEFT JOIN venues v ON v.id = t.venue_id
    WHERE t.id = $1
  `, [id]);
  if (!t.rows.length) return res.status(404).json({ error: 'Tournament not found' });

  const entries = await pool.query(`
    SELECT te.*, cr.name AS crew_name, cr.map_color_hex
    FROM tournament_entries te JOIN crews cr ON cr.id = te.crew_id
    WHERE te.tournament_id = $1 ORDER BY te.created_at
  `, [id]);

  const matches = await pool.query(`
    SELECT m.*,
      cc.name AS challenger_name, cc.map_color_hex AS challenger_color,
      dc.name AS defender_name, dc.map_color_hex AS defender_color,
      wc.name AS winner_name
    FROM matches m
    LEFT JOIN crews cc ON cc.id = m.challenger_crew_id
    LEFT JOIN crews dc ON dc.id = m.defender_crew_id
    LEFT JOIN crews wc ON wc.id = m.winner_crew_id
    WHERE m.tournament_id = $1 ORDER BY m.tournament_round, m.id
  `, [id]);

  res.json({ tournament: t.rows[0], entries: entries.rows, matches: matches.rows });
});

app.post('/api/tournaments/:id/enter', requireAuth, async (req, res) => {
  const { crew_id } = req.body;
  const tournId = req.params.id;

  const crew = await pool.query('SELECT * FROM crews WHERE id = $1 AND boss_id = $2', [crew_id, req.session.userId]);
  if (!crew.rows.length) return res.status(403).json({ error: 'Only the crew Boss can enter a tournament.' });

  const t = await pool.query(`
    SELECT t.*, v.tournament_entry_fee_cents, v.platform_fee_pct
    FROM tournaments t LEFT JOIN venues v ON v.id = t.venue_id WHERE t.id = $1
  `, [tournId]);
  if (!t.rows.length) return res.status(404).json({ error: 'Tournament not found' });
  const tourn = t.rows[0];

  if (tourn.status !== 'open') return res.status(400).json({ error: 'This tournament is no longer accepting entries.' });

  const alreadyIn = await pool.query(
    'SELECT id FROM tournament_entries WHERE tournament_id = $1 AND crew_id = $2', [tournId, crew_id]
  );
  if (alreadyIn.rows.length) return res.status(400).json({ error: 'Already entered in this tournament.' });

  let amountCents = 0, platformFeeCents = 0, venuePayout = 0;
  let entryStatus = 'paid', stripePaymentIntentId = null;

  if (tourn.venue_id && (tourn.tournament_entry_fee_cents || 0) > 0) {
    const venueCourt = await pool.query(
      'SELECT holding_crew_id FROM courts WHERE venue_id = $1 AND type = $2 LIMIT 1', [tourn.venue_id, 'venue']
    );
    const isExempt = venueCourt.rows.length && venueCourt.rows[0].holding_crew_id === parseInt(crew_id);
    if (isExempt) {
      entryStatus = 'exempt';
    } else {
      amountCents = tourn.tournament_entry_fee_cents;
      platformFeeCents = Math.floor(amountCents * ((tourn.platform_fee_pct || 15) / 100));
      venuePayout = amountCents - platformFeeCents;
      stripePaymentIntentId = `mock_pi_${Date.now()}_${crew_id}`;
    }
  } else if (!tourn.venue_id) {
    // Coin-only public tournament — check for unused priority booking
    const pb = await pool.query(
      `SELECT ci.id FROM crew_inventory ci
       JOIN store_items si ON si.id = ci.item_id
       WHERE ci.crew_id = $1 AND si.item_type = 'priority_booking' AND ci.used_at IS NULL
       LIMIT 1`,
      [crew_id]
    );
    if (pb.rows.length) {
      // Consume the priority booking; entry is free
      await pool.query('UPDATE crew_inventory SET used_at = NOW() WHERE id = $1', [pb.rows[0].id]);
    } else {
      const coinEntry = 50;
      if (crew.rows[0].coin_balance < coinEntry) {
        return res.status(400).json({ error: `Not enough coins. Entry costs ⚡ ${coinEntry}.` });
      }
      await pool.query('UPDATE crews SET coin_balance = coin_balance - $1 WHERE id = $2', [coinEntry, crew_id]);
      await pool.query('INSERT INTO coin_transactions (crew_id, amount, reason) VALUES ($1, $2, $3)',
        [crew_id, -coinEntry, 'tournament_entry']);
      await pool.query('UPDATE tournaments SET coin_prize_pool = coin_prize_pool + $1 WHERE id = $2', [coinEntry * 2, tournId]);
    }
  }

  const entry = await pool.query(`
    INSERT INTO tournament_entries (tournament_id, crew_id, venue_id, amount_cents, platform_fee_cents, venue_payout_cents, stripe_payment_intent_id, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
  `, [tournId, crew_id, tourn.venue_id || null, amountCents, platformFeeCents, venuePayout, stripePaymentIntentId, entryStatus]);

  res.json({ success: true, entry: entry.rows[0], exempt: entryStatus === 'exempt', cost_coins: tourn.venue_id ? 0 : 50 });
});

app.post('/api/tournaments/:id/start', requireAuth, async (req, res) => {
  const tournId = req.params.id;
  const user = await pool.query('SELECT tier FROM users WHERE id = $1', [req.session.userId]);
  const t = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournId]);
  if (!t.rows.length) return res.status(404).json({ error: 'Tournament not found' });
  const tourn = t.rows[0];

  if (tourn.status !== 'open') return res.status(400).json({ error: 'Tournament already started or complete.' });

  const isAdmin = user.rows[0]?.tier === 'operator';
  if (!isAdmin && tourn.venue_id) {
    const venue = await pool.query('SELECT venue_manager_user_id FROM venues WHERE id = $1', [tourn.venue_id]);
    if (!venue.rows.length || venue.rows[0].venue_manager_user_id !== req.session.userId) {
      return res.status(403).json({ error: 'Permission denied.' });
    }
  } else if (!isAdmin && !tourn.venue_id) {
    return res.status(403).json({ error: 'Only an admin can start a public tournament.' });
  }

  const entries = await pool.query(
    `SELECT crew_id FROM tournament_entries WHERE tournament_id = $1 AND status IN ('paid','exempt') ORDER BY RANDOM()`,
    [tournId]
  );
  if (entries.rows.length < 2) return res.status(400).json({ error: 'Need at least 2 crews to start.' });

  const crews = entries.rows.map(r => r.crew_id);
  for (let i = 0; i < crews.length - 1; i += 2) {
    await pool.query(
      `INSERT INTO matches (challenger_crew_id, defender_crew_id, court_id, wager_amount, format_type, tournament_id, tournament_round, status)
       VALUES ($1, $2, $3, 0, $4, $5, 1, 'locked')`,
      [crews[i], crews[i + 1], tourn.court_id, tourn.format_type, tournId]
    );
  }
  // If odd crew count, last crew gets a bye (auto-advance to round 2)
  if (crews.length % 2 !== 0) {
    const byeCrew = crews[crews.length - 1];
    await pool.query(
      `INSERT INTO matches (challenger_crew_id, defender_crew_id, court_id, wager_amount, format_type, tournament_id, tournament_round, status, winner_crew_id, challenger_reported_score, defender_reported_score)
       VALUES ($1, $1, $2, 0, $3, $4, 1, 'resolved', $1, 'BYE', 'BYE')`,
      [byeCrew, tourn.court_id, tourn.format_type, tournId]
    );
  }

  await pool.query('UPDATE tournaments SET status = $1 WHERE id = $2', ['in_progress', tournId]);
  res.json({ success: true });
});

async function advanceTournamentBracket(tournId, completedRound) {
  // Get all matches for this round
  const roundMatches = await pool.query(
    `SELECT * FROM matches WHERE tournament_id = $1 AND tournament_round = $2`,
    [tournId, completedRound]
  );
  const allResolved = roundMatches.rows.every(m => m.status === 'resolved' || m.status === 'voided');
  if (!allResolved) return;

  const winners = roundMatches.rows.map(m => m.winner_crew_id).filter(Boolean);
  if (winners.length < 2) {
    // Tournament over — crown champion
    const tourn = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournId]);
    if (winners.length === 1 && tourn.rows.length) {
      const t = tourn.rows[0];
      if (t.coin_prize_pool > 0) {
        await pool.query('UPDATE crews SET coin_balance = coin_balance + $1 WHERE id = $2', [t.coin_prize_pool, winners[0]]);
        await pool.query('INSERT INTO coin_transactions (crew_id, amount, reason) VALUES ($1, $2, $3)',
          [winners[0], t.coin_prize_pool, 'tournament_win']);
      }
      // Award venue turf to winner if venue tournament
      if (t.court_id) {
        await pool.query(
          'UPDATE courts SET holding_crew_id = $1, holder_decline_count = 0, turf_held_since = NOW() WHERE id = $2',
          [winners[0], t.court_id]
        );
      }
    }
    await pool.query('UPDATE tournaments SET status = $1 WHERE id = $2', ['complete', tournId]);
    return;
  }

  const t = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournId]);
  const tourn = t.rows[0];
  const nextRound = completedRound + 1;

  for (let i = 0; i < winners.length - 1; i += 2) {
    await pool.query(
      `INSERT INTO matches (challenger_crew_id, defender_crew_id, court_id, wager_amount, format_type, tournament_id, tournament_round, status)
       VALUES ($1, $2, $3, 0, $4, $5, $6, 'locked')`,
      [winners[i], winners[i + 1], tourn.court_id, tourn.format_type, tournId, nextRound]
    );
  }
  if (winners.length % 2 !== 0) {
    const byeCrew = winners[winners.length - 1];
    await pool.query(
      `INSERT INTO matches (challenger_crew_id, defender_crew_id, court_id, wager_amount, format_type, tournament_id, tournament_round, status, winner_crew_id, challenger_reported_score, defender_reported_score)
       VALUES ($1, $1, $2, 0, $3, $4, $5, 'resolved', $1, 'BYE', 'BYE')`,
      [byeCrew, tourn.court_id, tourn.format_type, tournId, nextRound]
    );
    // Immediately try to advance next round in case that was the last match
    await advanceTournamentBracket(tournId, nextRound);
  }
}

// ── ROTATION QUEUE ──

app.get('/api/tournaments/:id/queue', requireAuth, async (req, res) => {
  const queue = await pool.query(`
    SELECT rq.*, cr.name AS crew_name, cr.map_color_hex
    FROM rotation_queue rq JOIN crews cr ON cr.id = rq.crew_id
    WHERE rq.tournament_id = $1
    ORDER BY rq.joined_at
  `, [req.params.id]);
  res.json({ queue: queue.rows });
});

app.post('/api/tournaments/:id/queue', requireAuth, async (req, res) => {
  const { crew_id } = req.body;
  const tournId = req.params.id;

  const crew = await pool.query('SELECT * FROM crews WHERE id = $1 AND boss_id = $2', [crew_id, req.session.userId]);
  if (!crew.rows.length) return res.status(403).json({ error: 'Only the crew Boss can join the queue.' });

  const t = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournId]);
  if (!t.rows.length) return res.status(404).json({ error: 'Tournament not found' });
  const tourn = t.rows[0];

  if (tourn.bracket_type !== 'rotation') return res.status(400).json({ error: 'Only rotation tournaments have a queue.' });
  if (tourn.status !== 'in_progress') return res.status(400).json({ error: 'Tournament is not active.' });

  const now = new Date();
  if (tourn.event_end_time && new Date(tourn.event_end_time) < now) {
    return res.status(400).json({ error: 'This rotation event has ended.' });
  }

  // Must be entered in the tournament
  const entry = await pool.query(
    `SELECT id FROM tournament_entries WHERE tournament_id = $1 AND crew_id = $2 AND status IN ('paid','exempt')`,
    [tournId, crew_id]
  );
  if (!entry.rows.length) return res.status(400).json({ error: 'Enter the tournament first.' });

  // Not already in queue
  const existing = await pool.query(
    `SELECT id FROM rotation_queue WHERE tournament_id = $1 AND crew_id = $2 AND status = 'waiting'`,
    [tournId, crew_id]
  );
  if (existing.rows.length) return res.status(400).json({ error: 'Already in the queue.' });

  // Not currently playing
  const playing = await pool.query(
    `SELECT id FROM rotation_queue WHERE tournament_id = $1 AND crew_id = $2 AND status = 'playing'`,
    [tournId, crew_id]
  );
  if (playing.rows.length) return res.status(400).json({ error: 'Already in an active match.' });

  await pool.query(
    `INSERT INTO rotation_queue (tournament_id, crew_id, status) VALUES ($1, $2, 'waiting')`,
    [tournId, crew_id]
  );

  // Try to start a match if 2+ crews are waiting
  await tryStartRotationMatch(tournId, tourn);

  res.json({ success: true });
});

async function tryStartRotationMatch(tournId, tourn) {
  const waiting = await pool.query(
    `SELECT * FROM rotation_queue WHERE tournament_id = $1 AND status = 'waiting' ORDER BY joined_at LIMIT 2`,
    [tournId]
  );
  if (waiting.rows.length < 2) return;

  const [first, second] = waiting.rows;

  // Create the match
  const match = await pool.query(
    `INSERT INTO matches (challenger_crew_id, defender_crew_id, court_id, wager_amount, format_type, tournament_id, status)
     VALUES ($1, $2, $3, 0, $4, $5, 'locked') RETURNING id`,
    [first.crew_id, second.crew_id, tourn.court_id, tourn.format_type, tournId]
  );

  // Mark both as playing
  await pool.query(
    `UPDATE rotation_queue SET status = 'playing' WHERE id = $1 OR id = $2`,
    [first.id, second.id]
  );
}

// Called from resolveMatch when a rotation tournament match resolves
async function handleRotationMatchResolved(match, winnerId, loserId) {
  const tourn = await pool.query('SELECT * FROM tournaments WHERE id = $1', [match.tournament_id]);
  if (!tourn.rows.length) return;
  const t = tourn.rows[0];

  // Remove playing status for both crews
  await pool.query(
    `DELETE FROM rotation_queue WHERE tournament_id = $1 AND crew_id IN ($2, $3) AND status = 'playing'`,
    [match.tournament_id, winnerId, loserId]
  );

  // If event is still running, winner goes back to front of queue
  if (t.event_end_time && new Date(t.event_end_time) > new Date()) {
    // Winner re-queues at the front (earlier timestamp)
    await pool.query(
      `INSERT INTO rotation_queue (tournament_id, crew_id, status, joined_at)
       VALUES ($1, $2, 'waiting', NOW() - INTERVAL '1 year')`,
      [match.tournament_id, winnerId]
    );
    // Loser goes to back of queue
    await pool.query(
      `INSERT INTO rotation_queue (tournament_id, crew_id, status) VALUES ($1, $2, 'waiting')`,
      [match.tournament_id, loserId]
    );
    // Try to start next match
    await tryStartRotationMatch(match.tournament_id, t);
  }
}

// Rotation tournament closer — check every hour
async function closeFinishedRotationTournaments() {
  const finished = await pool.query(`
    SELECT * FROM tournaments
    WHERE bracket_type = 'rotation' AND status = 'in_progress'
    AND event_end_time < NOW()
  `);
  for (const t of finished.rows) {
    // Count wins per crew in this tournament's matches
    const results = await pool.query(`
      SELECT winner_crew_id, COUNT(*) AS wins
      FROM matches
      WHERE tournament_id = $1 AND status = 'resolved' AND winner_crew_id IS NOT NULL
      GROUP BY winner_crew_id ORDER BY wins DESC
    `, [t.id]);
    if (results.rows.length) {
      let winnerId = results.rows[0].winner_crew_id;
      // Tiebreaker: if top two crews share the same win count, check head-to-head
      if (results.rows.length >= 2 && results.rows[0].wins === results.rows[1].wins) {
        const a = results.rows[0].winner_crew_id;
        const b = results.rows[1].winner_crew_id;
        const h2h = await pool.query(`
          SELECT winner_crew_id FROM matches
          WHERE tournament_id = $1 AND status = 'resolved'
          AND ((challenger_crew_id = $2 AND defender_crew_id = $3) OR (challenger_crew_id = $3 AND defender_crew_id = $2))
          ORDER BY id DESC LIMIT 1
        `, [t.id, a, b]);
        if (h2h.rows.length) {
          winnerId = h2h.rows[0].winner_crew_id;
        } else {
          // No h2h — give it to whoever is currently on-court (status='playing' in queue)
          const onCourt = await pool.query(
            `SELECT crew_id FROM rotation_queue WHERE tournament_id = $1 AND status = 'playing' LIMIT 1`,
            [t.id]
          );
          if (onCourt.rows.length) winnerId = onCourt.rows[0].crew_id;
        }
      }
      if (t.court_id) {
        await pool.query(
          'UPDATE courts SET holding_crew_id = $1, holder_decline_count = 0, turf_held_since = NOW() WHERE id = $2',
          [winnerId, t.court_id]
        );
      }
      if (t.coin_prize_pool > 0) {
        await pool.query('UPDATE crews SET coin_balance = coin_balance + $1 WHERE id = $2', [t.coin_prize_pool, winnerId]);
        await pool.query('INSERT INTO coin_transactions (crew_id, amount, reason) VALUES ($1, $2, $3)',
          [winnerId, t.coin_prize_pool, 'tournament_win']);
      }
    }
    await pool.query('UPDATE tournaments SET status = $1 WHERE id = $2', ['complete', t.id]);
  }
}
setInterval(closeFinishedRotationTournaments, 60 * 60 * 1000);

// ── TURF TRICKLE (daily) ──
// Pays coins to every crew currently holding a court.
// Diminishing returns: each additional court held pays less.
async function payTurfTrickle() {
  // Get all crews that hold at least one court
  const holders = await pool.query(`
    SELECT holding_crew_id AS crew_id, COUNT(*) AS court_count
    FROM courts
    WHERE holding_crew_id IS NOT NULL AND status = 'active'
    GROUP BY holding_crew_id
  `);

  for (const row of holders.rows) {
    const crewId = row.crew_id;
    const count = parseInt(row.court_count);
    // Diminishing: 10, 8, 6, 4, 2... minimum 2 per court
    let total = 0;
    for (let i = 0; i < count; i++) {
      total += Math.max(2, 10 - i * 2);
    }
    await pool.query('UPDATE crews SET coin_balance = coin_balance + $1 WHERE id = $2', [total, crewId]);
    await pool.query('INSERT INTO coin_transactions (crew_id, amount, reason) VALUES ($1, $2, $3)',
      [crewId, total, 'turf_trickle']);
  }
  console.log(`[TRICKLE] Paid ${holders.rows.length} crews`);
}

// Run trickle once a day (every 24 hours)
setInterval(payTurfTrickle, 24 * 60 * 60 * 1000);

// ── SEASON CLOSE JOB (daily check) ──
async function checkSeasonClose() {
  const expired = await pool.query(`
    SELECT * FROM seasons WHERE status = 'active' AND end_date < CURRENT_DATE
  `);

  for (const season of expired.rows) {
    // Snapshot standings
    const crews = await pool.query('SELECT id, reputation_score, coin_balance FROM crews');
    const ranked = crews.rows
      .slice()
      .sort((a, b) => b.reputation_score - a.reputation_score);

    for (let i = 0; i < ranked.length; i++) {
      const c = ranked[i];
      await pool.query(`
        INSERT INTO season_results (season_id, crew_id, final_reputation, final_coin_balance, final_rank)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (season_id, crew_id) DO NOTHING
      `, [season.id, c.id, c.reputation_score, c.coin_balance, i + 1]);
    }

    // Undefeated Season — any crew with wins and zero losses this season
    const seasonStart = season.start_date;
    const allCrews = await pool.query('SELECT id FROM crews');
    for (const c of allCrews.rows) {
      const record = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE winner_crew_id = $1) AS wins,
          COUNT(*) FILTER (WHERE winner_crew_id != $1 AND status = 'resolved') AS losses
        FROM matches
        WHERE (challenger_crew_id = $1 OR defender_crew_id = $1)
          AND status = 'resolved'
          AND id >= (SELECT COALESCE(MIN(id), 0) FROM matches)
      `, [c.id]);
      const r = record.rows[0];
      if (parseInt(r.wins) > 0 && parseInt(r.losses) === 0) {
        await awardAchievement(c.id, 'Undefeated Season');
      }
    }

    // Crown Season MVP: crew with highest final_reputation (rank 1)
    if (ranked.length) {
      const mvp = ranked[0];
      await pool.query(
        `UPDATE seasons SET mvp_crew_id = $1 WHERE id = $2`,
        [mvp.id, season.id]
      );
      console.log(`[SEASON] MVP: crew ${mvp.id} (${mvp.reputation_score} rep)`);
    }

    // Soft-reset reputation to 100 for all crews (preserve relative order feeling, fresh start)
    await pool.query('UPDATE crews SET reputation_score = 100, current_win_streak = 0');

    // Reset all court decline counts
    await pool.query('UPDATE courts SET holder_decline_count = 0');

    // Mark season complete
    await pool.query("UPDATE seasons SET status = 'complete' WHERE id = $1", [season.id]);

    // Create next season (6 weeks from today)
    const nextStart = new Date();
    const nextEnd = new Date();
    nextEnd.setDate(nextEnd.getDate() + 42); // 6 weeks
    const seasonNum = season.name.match(/\d+/) ? parseInt(season.name.match(/\d+/)[0]) + 1 : 2;
    await pool.query(`
      INSERT INTO seasons (name, start_date, end_date, status)
      VALUES ($1, $2, $3, 'active')
    `, [`Season ${seasonNum}`, nextStart.toISOString().slice(0, 10), nextEnd.toISOString().slice(0, 10)]);

    console.log(`[SEASON] Closed season "${season.name}", new season started`);
  }
}

setInterval(checkSeasonClose, 24 * 60 * 60 * 1000);

// ── THE STORE ──

app.get('/api/store/items', requireAuth, async (req, res) => {
  const items = await pool.query('SELECT * FROM store_items ORDER BY item_type, cost_coins');
  res.json({ items: items.rows });
});

app.get('/api/store/inventory/:crew_id', requireAuth, async (req, res) => {
  const inventory = await pool.query(`
    SELECT ci.*, si.name AS item_name, si.item_type, si.cost_coins, si.is_consumable
    FROM crew_inventory ci JOIN store_items si ON si.id = ci.item_id
    WHERE ci.crew_id = $1 ORDER BY ci.purchased_at DESC
  `, [req.params.crew_id]);
  res.json({ inventory: inventory.rows });
});

app.post('/api/store/buy', requireAuth, async (req, res) => {
  const { crew_id, item_id } = req.body;

  const crew = await pool.query('SELECT * FROM crews WHERE id = $1 AND boss_id = $2', [crew_id, req.session.userId]);
  if (!crew.rows.length) return res.status(403).json({ error: 'Only the crew Boss can buy items.' });

  const item = await pool.query('SELECT * FROM store_items WHERE id = $1', [item_id]);
  if (!item.rows.length) return res.status(404).json({ error: 'Item not found.' });
  const it = item.rows[0];

  if (crew.rows[0].reputation_score < it.min_reputation) {
    return res.status(400).json({ error: `Need ${it.min_reputation} rep to unlock this item.` });
  }
  if (crew.rows[0].coin_balance < it.cost_coins) {
    return res.status(400).json({ error: `Not enough coins. This costs ⚡ ${it.cost_coins}.` });
  }

  // For non-consumables, check if already owned
  if (!it.is_consumable) {
    const owned = await pool.query(
      'SELECT id FROM crew_inventory WHERE crew_id = $1 AND item_id = $2', [crew_id, item_id]
    );
    if (owned.rows.length) return res.status(400).json({ error: 'Already owned.' });
  }

  await pool.query('UPDATE crews SET coin_balance = coin_balance - $1 WHERE id = $2', [it.cost_coins, crew_id]);
  await pool.query('INSERT INTO coin_transactions (crew_id, amount, reason) VALUES ($1, $2, $3)',
    [crew_id, -it.cost_coins, 'store_purchase']);

  const inv = await pool.query(
    'INSERT INTO crew_inventory (crew_id, item_id) VALUES ($1, $2) RETURNING *', [crew_id, item_id]
  );
  res.json({ success: true, inventory_item: inv.rows[0], coins_spent: it.cost_coins });
});

app.post('/api/store/equip', requireAuth, async (req, res) => {
  const { crew_id, inventory_id } = req.body;
  const crew = await pool.query('SELECT id FROM crews WHERE id = $1 AND boss_id = $2', [crew_id, req.session.userId]);
  if (!crew.rows.length) return res.status(403).json({ error: 'Permission denied.' });

  const inv = await pool.query(
    'SELECT ci.*, si.item_type FROM crew_inventory ci JOIN store_items si ON si.id = ci.item_id WHERE ci.id = $1 AND ci.crew_id = $2',
    [inventory_id, crew_id]
  );
  if (!inv.rows.length) return res.status(404).json({ error: 'Item not in inventory.' });

  // Unequip others of same type first
  await pool.query(`
    UPDATE crew_inventory ci SET equipped = FALSE
    FROM store_items si WHERE si.id = ci.item_id AND ci.crew_id = $1 AND si.item_type = $2
  `, [crew_id, inv.rows[0].item_type]);

  await pool.query('UPDATE crew_inventory SET equipped = TRUE WHERE id = $1', [inventory_id]);
  res.json({ success: true });
});

app.post('/api/store/unequip', requireAuth, async (req, res) => {
  const { crew_id, inventory_id } = req.body;
  const inv = await pool.query(
    'SELECT id FROM crew_inventory WHERE id = $1 AND crew_id = $2', [inventory_id, crew_id]
  );
  if (!inv.rows.length) return res.status(404).json({ error: 'Item not in inventory.' });
  await pool.query('UPDATE crew_inventory SET equipped = FALSE WHERE id = $1', [inventory_id]);
  res.json({ success: true });
});

// Consume a single-use item (rematch_clause or priority_booking)
app.post('/api/store/use', requireAuth, async (req, res) => {
  const { crew_id, inventory_id, match_id } = req.body;

  const crew = await pool.query('SELECT id FROM crews WHERE id = $1 AND boss_id = $2', [crew_id, req.session.userId]);
  if (!crew.rows.length) return res.status(403).json({ error: 'Permission denied.' });

  const inv = await pool.query(
    `SELECT ci.*, si.item_type, si.is_consumable, si.name
     FROM crew_inventory ci JOIN store_items si ON si.id = ci.item_id
     WHERE ci.id = $1 AND ci.crew_id = $2`,
    [inventory_id, crew_id]
  );
  if (!inv.rows.length) return res.status(404).json({ error: 'Item not in inventory.' });
  const item = inv.rows[0];

  if (!item.is_consumable) return res.status(400).json({ error: 'This item is not consumable.' });
  if (item.used_at) return res.status(400).json({ error: 'This item has already been used.' });

  if (item.item_type === 'rematch_clause') {
    // Force-create a rematch: the match must be resolved and the crew must have been a participant
    if (!match_id) return res.status(400).json({ error: 'match_id required for Rematch Clause.' });
    const orig = await pool.query('SELECT * FROM matches WHERE id = $1 AND status = $2', [match_id, 'resolved']);
    if (!orig.rows.length) return res.status(404).json({ error: 'Resolved match not found.' });
    const m = orig.rows[0];
    const isParticipant = m.challenger_crew_id === parseInt(crew_id) || m.defender_crew_id === parseInt(crew_id);
    if (!isParticipant) return res.status(403).json({ error: 'Your crew was not in this match.' });

    // Create a mirrored rematch with same terms, status negotiating
    const rematch = await pool.query(
      `INSERT INTO matches (type, format_type, status, challenger_crew_id, defender_crew_id, wager_amount, court_id, scheduled_time)
       VALUES ('call_out', $1, 'negotiating', $2, $3, $4, $5, $6) RETURNING id`,
      [m.format_type, crew_id, m.challenger_crew_id === parseInt(crew_id) ? m.defender_crew_id : m.challenger_crew_id,
       m.wager_amount, m.court_id, null]
    );
    await pool.query('UPDATE crew_inventory SET used_at = NOW() WHERE id = $1', [inventory_id]);
    return res.json({ success: true, rematch_match_id: rematch.rows[0].id, message: 'Rematch created — awaiting acceptance.' });
  }

  if (item.item_type === 'priority_booking') {
    // Mark the item used; the tournament entry route checks priority_booking to waive coin entry cost
    await pool.query('UPDATE crew_inventory SET used_at = NOW() WHERE id = $1', [inventory_id]);
    return res.json({ success: true, message: 'Priority Booking activated — your next tournament entry coin fee is waived.' });
  }

  return res.status(400).json({ error: 'Unknown consumable type.' });
});

// ── VENUE DASHBOARD ──

app.get('/api/venue/dashboard', requireAuth, async (req, res) => {
  const venue = await pool.query(
    'SELECT * FROM venues WHERE venue_manager_user_id = $1', [req.session.userId]
  );
  if (!venue.rows.length) return res.status(403).json({ error: 'Not a venue manager.' });
  const v = venue.rows[0];

  const tournaments = await pool.query(`
    SELECT t.id, t.name, t.status, t.bracket_type, t.format_type, t.created_at,
      COUNT(te.id) AS total_entries,
      SUM(te.amount_cents) AS gross_revenue_cents,
      SUM(te.venue_payout_cents) AS venue_payout_cents,
      SUM(te.platform_fee_cents) AS platform_fee_cents
    FROM tournaments t
    LEFT JOIN tournament_entries te ON te.tournament_id = t.id AND te.status = 'paid'
    WHERE t.venue_id = $1
    GROUP BY t.id ORDER BY t.created_at DESC
  `, [v.id]);

  res.json({ venue: v, tournaments: tournaments.rows });
});

// ── X CONSOLE (platform admin only) ──

function requireAdmin(req, res, next) {
  pool.query('SELECT tier FROM users WHERE id = $1', [req.session.userId])
    .then(result => {
      if (!result.rows.length || result.rows[0].tier !== 'operator') {
        return res.status(403).json({ error: 'X Console access denied.' });
      }
      next();
    }).catch(() => res.status(500).json({ error: 'Auth check failed.' }));
}

app.get('/api/admin/reports', requireAuth, requireAdmin, async (req, res) => {
  const reports = await pool.query(`
    SELECT r.*,
      ru.username AS reporter_username,
      uu.username AS reported_user_username,
      rc.name AS reported_crew_name
    FROM reports r
    LEFT JOIN users ru ON ru.id = r.reporter_user_id
    LEFT JOIN users uu ON uu.id = r.reported_user_id
    LEFT JOIN crews rc ON rc.id = r.reported_crew_id
    ORDER BY r.created_at DESC LIMIT 100
  `);
  res.json({ reports: reports.rows });
});

app.post('/api/admin/reports/:id/resolve', requireAuth, requireAdmin, async (req, res) => {
  const { note } = req.body;
  await pool.query(
    'UPDATE reports SET status = $1 WHERE id = $2', ['reviewed', req.params.id]
  );
  res.json({ success: true });
});

app.get('/api/admin/matches/disputed', requireAuth, requireAdmin, async (req, res) => {
  const matches = await pool.query(`
    SELECT m.*,
      cc.name AS challenger_name, dc.name AS defender_name
    FROM matches m
    LEFT JOIN crews cc ON cc.id = m.challenger_crew_id
    LEFT JOIN crews dc ON dc.id = m.defender_crew_id
    WHERE m.status = 'disputed'
    ORDER BY m.disputed_at ASC
  `);
  res.json({ matches: matches.rows });
});

app.post('/api/admin/matches/:id/force-resolve', requireAuth, requireAdmin, async (req, res) => {
  const { winner_crew_id } = req.body;
  const match = await pool.query('SELECT * FROM matches WHERE id = $1', [req.params.id]);
  if (!match.rows.length) return res.status(404).json({ error: 'Match not found.' });
  const m = match.rows[0];

  if (!['disputed', 'locked', 'active'].includes(m.status)) {
    return res.status(400).json({ error: 'Match cannot be force-resolved in its current state.' });
  }

  const loserScore = winner_crew_id === m.challenger_crew_id ? '0' : '1';
  const winnerScore = '1';
  const syntheticScore = winner_crew_id === m.challenger_crew_id
    ? `${winnerScore}-${loserScore}` : `${loserScore}-${winnerScore}`;

  await pool.query(
    'UPDATE matches SET challenger_reported_score = $1, defender_reported_score = $1, resolved_by_x_admin_id = $2 WHERE id = $3',
    [syntheticScore, req.session.userId, m.id]
  );
  await pool.query(
    `UPDATE matches SET winner_crew_id = $1 WHERE id = $2`, [winner_crew_id, m.id]
  );

  await pool.query(
    `UPDATE matches SET x_message = $1 WHERE id = $2`,
    ['Score dispute resolved by X after review. — X', m.id]
  );
  const updatedMatch = await pool.query('SELECT * FROM matches WHERE id = $1', [m.id]);
  await resolveMatch(updatedMatch.rows[0]);
  res.json({ success: true });
});

// ── MATCH DETAIL ──
app.get('/api/matches/:id/detail', requireAuth, async (req, res) => {
  const match = await pool.query(`
    SELECT m.*,
      cc.name AS challenger_name, cc.map_color_hex AS challenger_color,
      dc.name AS defender_name,   dc.map_color_hex AS defender_color,
      wc.name AS winner_name,
      co.name AS court_name, co.type AS court_type
    FROM matches m
    LEFT JOIN crews cc ON cc.id = m.challenger_crew_id
    LEFT JOIN crews dc ON dc.id = m.defender_crew_id
    LEFT JOIN crews wc ON wc.id = m.winner_crew_id
    LEFT JOIN courts co ON co.id = m.court_id
    WHERE m.id = $1
  `, [req.params.id]);
  if (!match.rows.length) return res.status(404).json({ error: 'Match not found.' });

  const lineups = await pool.query(`
    SELECT ml.crew_id, u.id AS user_id, u.username,
           COALESCE(ps.wins,0) AS wins, COALESCE(ps.losses,0) AS losses
    FROM match_lineups ml
    JOIN users u ON u.id = ml.user_id
    LEFT JOIN player_stats ps ON ps.user_id = u.id
    WHERE ml.match_id = $1
    ORDER BY ml.crew_id, u.username
  `, [req.params.id]);

  res.json({ match: match.rows[0], lineups: lineups.rows });
});

// ── CREW INVITES ──
app.post('/api/crews/:id/invite', requireAuth, async (req, res) => {
  const crewId = req.params.id;
  const { username } = req.body;

  const crew = await pool.query('SELECT * FROM crews WHERE id = $1 AND boss_id = $2', [crewId, req.session.userId]);
  if (!crew.rows.length) return res.status(403).json({ error: 'Only the Boss can invite.' });

  const target = await pool.query('SELECT id, username FROM users WHERE username ILIKE $1', [username.trim()]);
  if (!target.rows.length) return res.status(404).json({ error: `No player found with handle "${username}".` });

  const targetId = target.rows[0].id;
  if (targetId === req.session.userId) return res.status(400).json({ error: 'You are already on this crew.' });

  const existing = await pool.query('SELECT 1 FROM crew_invites WHERE crew_id = $1 AND invited_user_id = $2 AND status = $3', [crewId, targetId, 'pending']);
  if (existing.rows.length) return res.status(400).json({ error: 'Invite already pending for this player.' });

  const alreadyOn = await pool.query('SELECT 1 FROM crew_rosters WHERE crew_id = $1 AND user_id = $2', [crewId, targetId]);
  if (alreadyOn.rows.length) return res.status(400).json({ error: 'Player is already on the roster.' });

  await pool.query(
    'INSERT INTO crew_invites (crew_id, invited_user_id, invited_by_user_id) VALUES ($1, $2, $3)',
    [crewId, targetId, req.session.userId]
  );
  res.json({ success: true, invited_username: target.rows[0].username });
});

app.get('/api/invites', requireAuth, async (req, res) => {
  const invites = await pool.query(`
    SELECT ci.id, ci.crew_id, ci.status, ci.created_at,
           c.name AS crew_name, c.sport_type, c.map_color_hex,
           u.username AS invited_by_username
    FROM crew_invites ci
    JOIN crews c ON c.id = ci.crew_id
    JOIN users u ON u.id = ci.invited_by_user_id
    WHERE ci.invited_user_id = $1 AND ci.status = 'pending'
    ORDER BY ci.created_at DESC
  `, [req.session.userId]);
  res.json({ invites: invites.rows });
});

app.post('/api/invites/:id/respond', requireAuth, async (req, res) => {
  const { action } = req.body; // 'accept' | 'decline'
  const invite = await pool.query(
    'SELECT * FROM crew_invites WHERE id = $1 AND invited_user_id = $2 AND status = $3',
    [req.params.id, req.session.userId, 'pending']
  );
  if (!invite.rows.length) return res.status(404).json({ error: 'Invite not found.' });
  const inv = invite.rows[0];

  if (action === 'accept') {
    const crew = await pool.query('SELECT * FROM crews WHERE id = $1', [inv.crew_id]);
    const c = crew.rows[0];
    const user = await pool.query('SELECT date_of_birth FROM users WHERE id = $1', [req.session.userId]);
    const dob = new Date(user.rows[0].date_of_birth);
    const now = new Date();
    const ageYears = (now - dob) / (365.25 * 24 * 3600 * 1000);

    if (c.age_class === 'U14' && ageYears >= 14) return res.status(400).json({ error: 'You are too old for this U14 crew.' });
    if (c.age_class === 'U18' && ageYears >= 18) return res.status(400).json({ error: 'You are too old for this U18 crew.' });
    if (c.age_class === 'Adult' && ageYears < 18) return res.status(400).json({ error: 'You must be 18+ for this adult crew.' });

    await pool.query('INSERT INTO crew_rosters (crew_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [inv.crew_id, req.session.userId]);
    await pool.query('INSERT INTO player_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [req.session.userId]);
  }

  await pool.query('UPDATE crew_invites SET status = $1 WHERE id = $2', [action === 'accept' ? 'accepted' : 'declined', inv.id]);
  res.json({ success: true });
});

// Generate a shareable invite link (boss only, no target user required)
app.post('/api/crews/:id/invite-link', requireAuth, async (req, res) => {
  const crewId = req.params.id;
  const crew = await pool.query('SELECT * FROM crews WHERE id = $1 AND boss_id = $2', [crewId, req.session.userId]);
  if (!crew.rows.length) return res.status(403).json({ error: 'Only the Boss can generate an invite link.' });

  const token = crypto.randomBytes(24).toString('hex');
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await pool.query(
    `INSERT INTO crew_invites (crew_id, invited_by_user_id, invite_token, expires_at, status)
     VALUES ($1, $2, $3, $4, 'pending')`,
    [crewId, req.session.userId, token, expires]
  );

  res.json({ token, expires_at: expires });
});

// Stash invite token in session so it survives the signup flow
app.post('/api/invite/:token/claim', async (req, res) => {
  const inv = await pool.query(
    `SELECT ci.id FROM crew_invites ci
     WHERE ci.invite_token = $1 AND ci.status = 'pending' AND ci.expires_at > NOW()`,
    [req.params.token]
  );
  if (!inv.rows.length) return res.status(410).json({ error: 'Invite not found or expired.' });
  req.session.pendingInviteToken = req.params.token;
  res.json({ success: true });
});

// Public — look up invite by token (used on the join/signup page)
app.get('/api/invite/:token', async (req, res) => {
  const inv = await pool.query(
    `SELECT ci.id, ci.crew_id, ci.expires_at, ci.status,
            c.name AS crew_name, c.sport_type, c.age_class, c.gender_class, c.map_color_hex,
            u.username AS invited_by_username
     FROM crew_invites ci
     JOIN crews c ON c.id = ci.crew_id
     JOIN users u ON u.id = ci.invited_by_user_id
     WHERE ci.invite_token = $1`,
    [req.params.token]
  );
  if (!inv.rows.length) return res.status(404).json({ error: 'Invite not found or already used.' });
  const row = inv.rows[0];
  if (row.status !== 'pending') return res.status(410).json({ error: 'This invite has already been used.' });
  if (new Date(row.expires_at) < new Date()) return res.status(410).json({ error: 'This invite link has expired.' });
  res.json({ invite: row });
});

// ── COURT HISTORY ──
app.get('/api/courts/:id/history', requireAuth, async (req, res) => {
  const court = await pool.query(`
    SELECT co.*, cr.name AS holder_name, cr.map_color_hex AS holder_color
    FROM courts co
    LEFT JOIN crews cr ON cr.id = co.holding_crew_id
    WHERE co.id = $1
  `, [req.params.id]);
  if (!court.rows.length) return res.status(404).json({ error: 'Court not found.' });

  // Turf changes inferred from resolved matches at this court
  const turf = await pool.query(`
    SELECT m.id, m.challenger_reported_score, m.scheduled_time, m.status,
           wc.name AS winner_name, wc.map_color_hex AS winner_color,
           cc.name AS challenger_name, dc.name AS defender_name
    FROM matches m
    LEFT JOIN crews wc ON wc.id = m.winner_crew_id
    LEFT JOIN crews cc ON cc.id = m.challenger_crew_id
    LEFT JOIN crews dc ON dc.id = m.defender_crew_id
    WHERE m.court_id = $1 AND m.status = 'resolved'
    ORDER BY m.id DESC LIMIT 20
  `, [req.params.id]);

  res.json({ court: court.rows[0], history: turf.rows });
});

// ── ACCOUNT DELETION ──
app.delete('/api/auth/account', requireAuth, async (req, res) => {
  const userId = req.session.userId;

  // Auto-transfer boss role to longest-tenured member, or archive crew if no one else
  const bossCrews = await pool.query('SELECT id FROM crews WHERE boss_id = $1', [userId]);
  for (const c of bossCrews.rows) {
    const members = await pool.query(
      `SELECT user_id FROM crew_rosters WHERE crew_id = $1 AND user_id != $2 ORDER BY joined_at ASC LIMIT 1`,
      [c.id, userId]
    );
    if (members.rows.length) {
      await pool.query('UPDATE crews SET boss_id = $1 WHERE id = $2', [members.rows[0].user_id, c.id]);
    } else {
      // No members — archive the crew
      await pool.query('UPDATE courts SET holding_crew_id = NULL, turf_held_since = NULL WHERE holding_crew_id = $1', [c.id]);
      await pool.query('DELETE FROM crew_rosters WHERE crew_id = $1', [c.id]);
      await pool.query('DELETE FROM crews WHERE id = $1', [c.id]);
    }
  }

  // Remove from all rosters
  await pool.query('DELETE FROM crew_rosters WHERE user_id = $1', [userId]);

  // Anonymise user record (preserve match history integrity)
  await pool.query(
    `UPDATE users SET username = $1, phone_number = $2 WHERE id = $3`,
    [`[deleted_${userId}]`, `deleted_${userId}`, userId]
  );

  req.session.destroy(() => {});
  res.json({ success: true });
});

// ── SPA fallback ──
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── BOOT ──
async function start() {
  await initSchema();
  await seedData();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`The Street running on http://localhost:${PORT}`));
}

start().catch(console.error);
