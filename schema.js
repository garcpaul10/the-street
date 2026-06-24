const pool = require('./db');

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      phone_number VARCHAR(255) UNIQUE NOT NULL,
      username VARCHAR(255) UNIQUE NOT NULL,
      date_of_birth DATE NOT NULL CHECK (date_of_birth <= CURRENT_DATE - INTERVAL '13 years'),
      gender VARCHAR(50),
      tier VARCHAR(50) DEFAULT 'free',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS venues (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      venue_manager_user_id INTEGER REFERENCES users(id),
      address VARCHAR(255),
      tournament_entry_fee_cents INTEGER DEFAULT 0,
      platform_fee_pct INTEGER DEFAULT 15,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS crews (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      boss_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      coin_balance INTEGER DEFAULT 100,
      reputation_score INTEGER DEFAULT 100,
      sport_type VARCHAR(100) NOT NULL,
      age_class VARCHAR(20) NOT NULL,
      gender_class VARCHAR(50) NOT NULL,
      map_color_hex VARCHAR(7) NOT NULL DEFAULT '#44FF22',
      current_win_streak INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS courts (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL DEFAULT 'public',
      venue_id INTEGER REFERENCES venues(id) NULL,
      latitude DECIMAL(9,6),
      longitude DECIMAL(9,6),
      holding_crew_id INTEGER REFERENCES crews(id) NULL,
      holder_decline_count INTEGER NOT NULL DEFAULT 0,
      turf_held_since TIMESTAMP NULL,
      submitted_by_crew_id INTEGER REFERENCES crews(id) NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS crew_rosters (
      crew_id INTEGER REFERENCES crews(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (crew_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS matches (
      id SERIAL PRIMARY KEY,
      type VARCHAR(50) NOT NULL DEFAULT 'call_out',
      format_type VARCHAR(20) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'negotiating',
      challenger_crew_id INTEGER REFERENCES crews(id),
      defender_crew_id INTEGER REFERENCES crews(id),
      wager_amount INTEGER NOT NULL DEFAULT 0,
      court_id INTEGER REFERENCES courts(id),
      scheduled_time TIMESTAMP,
      challenger_reported_score VARCHAR(50),
      defender_reported_score VARCHAR(50),
      disputed_at TIMESTAMP NULL,
      resolved_by_x_admin_id INTEGER REFERENCES users(id) NULL,
      winner_crew_id INTEGER REFERENCES crews(id) NULL,
      tournament_id INTEGER NULL
    );

    CREATE TABLE IF NOT EXISTS match_lineups (
      match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
      crew_id INTEGER REFERENCES crews(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (match_id, crew_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS tournaments (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      bracket_type VARCHAR(20) NOT NULL DEFAULT 'bracket',
      court_id INTEGER REFERENCES courts(id) NULL,
      venue_id INTEGER REFERENCES venues(id) NULL,
      format_type VARCHAR(20) NOT NULL,
      status VARCHAR(50) DEFAULT 'open',
      coin_prize_pool INTEGER DEFAULT 0,
      event_start_time TIMESTAMP NULL,
      event_end_time TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tournament_entries (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,
      crew_id INTEGER REFERENCES crews(id),
      venue_id INTEGER REFERENCES venues(id) NULL,
      amount_cents INTEGER NOT NULL DEFAULT 0,
      platform_fee_cents INTEGER NOT NULL DEFAULT 0,
      venue_payout_cents INTEGER NOT NULL DEFAULT 0,
      stripe_payment_intent_id VARCHAR(255),
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS coin_transactions (
      id SERIAL PRIMARY KEY,
      crew_id INTEGER REFERENCES crews(id),
      amount INTEGER NOT NULL,
      reason VARCHAR(100) NOT NULL,
      match_id INTEGER REFERENCES matches(id) NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS store_items (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      item_type VARCHAR(30) NOT NULL,
      cost_coins INTEGER NOT NULL,
      min_reputation INTEGER DEFAULT 0,
      is_consumable BOOLEAN DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS crew_inventory (
      id SERIAL PRIMARY KEY,
      crew_id INTEGER REFERENCES crews(id) ON DELETE CASCADE,
      item_id INTEGER REFERENCES store_items(id),
      equipped BOOLEAN DEFAULT FALSE,
      used_at TIMESTAMP NULL,
      purchased_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS seasons (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE,
      status VARCHAR(20) DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS season_results (
      season_id INTEGER REFERENCES seasons(id),
      crew_id INTEGER REFERENCES crews(id),
      final_reputation INTEGER,
      final_coin_balance INTEGER,
      final_rank INTEGER,
      PRIMARY KEY (season_id, crew_id)
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description VARCHAR(500)
    );

    CREATE TABLE IF NOT EXISTS crew_achievements (
      crew_id INTEGER REFERENCES crews(id) ON DELETE CASCADE,
      achievement_id INTEGER REFERENCES achievements(id),
      earned_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (crew_id, achievement_id)
    );

    CREATE TABLE IF NOT EXISTS player_stats (
      user_id INTEGER PRIMARY KEY REFERENCES users(id),
      total_appearances INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      reporter_user_id INTEGER REFERENCES users(id),
      reported_user_id INTEGER REFERENCES users(id) NULL,
      reported_crew_id INTEGER REFERENCES crews(id) NULL,
      reason VARCHAR(100) NOT NULL,
      note VARCHAR(500),
      status VARCHAR(20) DEFAULT 'open',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS blocks (
      blocker_user_id INTEGER REFERENCES users(id),
      blocked_user_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (blocker_user_id, blocked_user_id)
    );

    CREATE TABLE IF NOT EXISTS quests (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description VARCHAR(500),
      cadence VARCHAR(20) NOT NULL,
      requirement_type VARCHAR(50) NOT NULL,
      requirement_count INTEGER NOT NULL DEFAULT 1,
      coin_reward INTEGER NOT NULL,
      active_from DATE NOT NULL,
      active_until DATE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS crew_quest_progress (
      crew_id INTEGER REFERENCES crews(id) ON DELETE CASCADE,
      quest_id INTEGER REFERENCES quests(id),
      progress_count INTEGER NOT NULL DEFAULT 0,
      completed_at TIMESTAMP NULL,
      claimed BOOLEAN DEFAULT FALSE,
      PRIMARY KEY (crew_id, quest_id)
    );
  `);

  await pool.query(`ALTER TABLE seasons ADD COLUMN IF NOT EXISTS mvp_crew_id INTEGER REFERENCES crews(id) NULL;`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS crew_invites (
      id SERIAL PRIMARY KEY,
      crew_id INTEGER REFERENCES crews(id) ON DELETE CASCADE,
      invited_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NULL,
      invited_by_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      invite_token VARCHAR(64) UNIQUE NULL,
      expires_at TIMESTAMP NULL,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await pool.query(`ALTER TABLE crew_invites ALTER COLUMN invited_user_id DROP NOT NULL;`);
  await pool.query(`ALTER TABLE crew_invites ADD COLUMN IF NOT EXISTS invite_token VARCHAR(64) UNIQUE NULL;`);
  await pool.query(`ALTER TABLE crew_invites ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP NULL;`);
  await pool.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS hype_count INTEGER NOT NULL DEFAULT 0;`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS match_hypes (
      match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (match_id, user_id)
    );
  `);
  await pool.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS x_message TEXT NULL;`);
  await pool.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS tournament_round INTEGER NULL;`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS store_items_name_unique ON store_items(name);`);
  await pool.query(`ALTER TABLE crew_quest_progress ADD COLUMN IF NOT EXISTS period_start DATE NULL;`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rotation_queue (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,
      crew_id INTEGER REFERENCES crews(id) ON DELETE CASCADE,
      joined_at TIMESTAMP DEFAULT NOW(),
      status VARCHAR(20) DEFAULT 'waiting'
    );
  `);

  await pool.query(`ALTER TABLE store_items ADD COLUMN IF NOT EXISTS unlock_type VARCHAR(20) NOT NULL DEFAULT 'purchase'`);
  await pool.query(`ALTER TABLE store_items ADD COLUMN IF NOT EXISTS unlock_requirement VARCHAR(50) NULL`);

  // Normalize existing phone numbers to E.164
  await pool.query(`
    UPDATE users SET phone_number =
      CASE
        WHEN phone_number LIKE '+%' THEN phone_number
        WHEN length(regexp_replace(phone_number, '\\D', '', 'g')) = 11
          THEN '+' || regexp_replace(phone_number, '\\D', '', 'g')
        ELSE '+1' || regexp_replace(phone_number, '\\D', '', 'g')
      END
    WHERE phone_number NOT LIKE '+%'
  `);

  console.log('Schema initialized');
}

module.exports = { initSchema };
