# "The Street" — Master Specification

This document is the binding architecture for "The Street," a brand-new concept being built from scratch.

---

## Section 1: Visual Design Direction

### 1.1 The Concept
"The Street" is a hyper-local street sports network — pickup-game culture, crew rivalries, court ownership. The visual identity needs to feel like an underground alleyway, not a corporate app. Default UI patterns — crisp borders, stark white backgrounds, generic utility text — would work against the rebellious, high-stakes, "my crew runs this block" energy the concept is built on.

### 1.2 The Direction
- Dark, weathered concrete backdrop with a single hanging lightbulb casting a dramatic overhead glow.
- A graffiti-style wordmark in Hazard Volt Green (`#CCFF00`) with a heavy spray-paint glow effect.
- Hand-drawn, white spray-painted borders on form inputs instead of clean rectangles.
- Stencil-style typography for buttons and headers — looks stamped/painted on, not typeset.
- No background clutter, no extra tags or watermarks — the texture and lighting carry the mood, the UI stays readable on a small screen.

### 1.3 Core Architecture Decisions
Before any code gets written, the following calls have been made:

1. **Auth:** Phone + OTP via **Twilio Verify** (not full A2P 10DLC — Verify's OTP/2FA use case skips the carrier brand/campaign review). Handle chosen at signup.
2. **Age floor:** Platform minimum age is **13**. No U13 division, no guardian/parent_id system. This keeps the platform outside COPPA's verifiable-parental-consent requirements. U14 is the youngest division.
3. **Coin economy:** Coins are **earned only** — through wins, attendance, and hype activity — never purchased with real money. This keeps the core "my crew vs. your crew" stakes mechanic fully real for players while keeping actual monetization (subscriptions, venue fees, tournament entries) in a separate, clean layer with no real-money-wagering exposure.
4. **Venues:** Both **public courts** (free location tags, anyone can call out a match there) and **partnered venues with their own staff dashboard** ship together from Phase 1, since there's a live venue partner ready to onboard at launch.
5. **Court ownership ("Turf"):** Each court tracks which Crew currently holds it (last Crew to win a Call-Out there). Reinforces the "run the block" identity of the concept.
6. **Turf Wars:** Built as a thin tournament wrapper around the Call-Out match primitive — not a separate match-resolution system. A Turf Wars event generates a bracket of Call-Outs and tracks rounds.
7. **Match resolution:** Both Crew Bosses self-report; matching scores auto-resolve immediately. A mismatch puts the match in `disputed` and starts a 48-hour clock — either Boss can correct/resubmit their score during that window, and a match still auto-resolves the moment the two reports agree. If 48 hours pass with no agreement, the match auto-**voids**: any coin wager is refunded to both crews and the match is treated as if it never happened (no reputation, streak, player_stats, or turf change). A venue booking fee already paid is **never refunded**, void or not — the venue provided the court time regardless of the outcome. "X" no longer arbitrates routine score disputes; X Console (Phase 3) exists for genuine exceptions — repeated bad-faith disputes, abuse, appeals — not day-to-day mismatches.
8. **Multi-crew membership:** Allowed by default — a player can roster on multiple Crews (matches real street-ball culture). Open to revisiting once there's usage data.
9. **Coins have real utility, not just wager value:** spendable on cosmetic flair (jerseys, tag styles, court banners) and utility unlocks (Turf Wars entry, rematch clauses, priority booking) — see Section 2 for the item/inventory model.
10. **Earning is multi-source:** match wins, turf-holding trickle, attendance, clean-play (no-dispute) bonus, and hype received — not just wager outcomes. See "Economy logic" below Section 2.
11. **Social/competitive layers added:** head-to-head Rivalries (computed, no new table), Crew Tiers (read off `reputation_score`, no new table), Seasons (periodic reputation/turf reset with archived standings, default length 6 weeks, admin-configurable per season), and Achievements (crew-level badges).
12. **Turf forfeiture on repeated declines.** If a crew holding a court declines 3 challenges at that specific court within the current season, they automatically forfeit it — `holding_crew_id` clears and the court goes up for grabs (first crew to win a Call-Out there claims it). The decline count is tracked per court (not per crew overall), and resets to 0 either when the court changes hands or at season close — so a holder who survives into a new season gets a fresh 3 declines.
13. **Spectator prediction-for-coins is explicitly NOT included.** Letting spectators stake coins on someone else's match outcome is a meaningfully different mechanic than crews wagering on their own games — closer to outsiders betting on a contest, not players competing. Deliberately left out of this version; revisit only with its own dedicated review.
14. **"X" — the platform's public face.** Every system-originated message — dispute rulings, account actions, automated notifications — is signed by a single anonymous in-universe persona, "X." No real staff names, no "Support Team," no venue name attached to platform communications. Venues themselves ARE referred to by their real names everywhere a location is shown (court listings, booking confirmations) — only the platform's own administrative voice is anonymized.
15. **Venues monetize through Turf Wars only — never Call-Outs.** Call-Outs are restricted to public courts; venue-type courts can only host matches that are part of a tournament (`tournament_id` set). This avoids the venue ever effectively donating free court time to Street users while charging the general public — the only way onto a partnered court is through a paid Turf Wars entry. The venue never pays anything (no monthly fee, no risk if their courts sit unused); they only ever receive a share of entry fees, and only when a tournament actually runs at their location. Whoever currently holds that venue's turf is exempt from the entry fee for that venue's next Turf Wars — only challenging crews pay. Since Call-Outs never happen at venue courts, venue turf can only change hands by winning an actual tournament there, making it meaningfully rarer/more prestigious than public-court turf, which flips constantly from everyday Call-Outs.
16. **No age-mixing on a roster.** A crew's roster must be entirely minors or entirely adults — never both. Enforced by making the existing age_class guardrail symmetric: `U14` crews reject anyone 14+, `U18` crews reject anyone 18+, and `Adult` crews now also reject anyone under 18 (this last check is new — previously only the youth-side limit was enforced).
17. **Basic content filter, launch-blocking.** Crew names, handles, and user-submitted court names all run through a basic profanity/slur blocklist at creation time, rejected with a clear message if flagged. Lightweight for v1 (a maintained blocklist, not ML moderation), but in place before launch given minors are on the platform.
18. **Report & block, shipped in Phase 1.** Any user can report another user or crew (reason + optional note) or block them outright. Reports feed the X Console queue; a block prevents being challenged by or matched against that user/crew going forward.
19. **Crew continuity.** A Boss can transfer Boss status to another rostered player. If a Boss deletes their account, Boss status auto-transfers to the longest-tenured remaining roster member; a crew with no remaining members is archived, not deleted (preserves match history).
20. **Map view is a first-class screen.** Courts render on an actual map of the local area, color-coded by whichever crew currently holds each one (`crews.map_color_hex`, assigned at crew creation). This is the single most important addition for making the platform feel like a real-world game board rather than a results feed — ships in Phase 2 alongside The Wire, once there's real turf/match data to show on it.
21. **Quests give a reason to open the app on days with no scheduled match.** Lightweight daily/weekly objectives ("hold 3 courts by Sunday," "play a new venue this week") pay out coins on completion. Ships in Phase 2.
22. **Celebratory "feel" moments are a deliberate front-end layer, not an afterthought.** Taking turf, hitting a win streak, leveling up a Crew Tier — these already fire real backend events (coin_transactions, reputation/streak updates, holding_crew_id changes); each needs an actual on-screen celebratory moment tied to it, not just a silent data update. No new backend needed, just don't let this get skipped during UI build.
23. **Proximity-aware notifications ("a crew is challenging your turf two blocks away") are deferred to Phase 4.** Needs push notification infrastructure and a location-permission flow that don't exist yet — noted as a real goal, not dropped, just sequenced after the core loop and map are solid.
24. **Crew rosters can exceed any single match format.** A crew isn't "a 5v5 crew" — it's a roster pool that can field 1v1 up to 5v5 depending on what's being played. Format is chosen per match (Call-Out or Turf Wars round) via Lock Lineup, not fixed at crew creation. A 1v1 match displays as the two players head-to-head by handle (with crew shown as a secondary tag); 2v2 and larger displays as standard Crew vs Crew.
25. **Rotation Turf Wars — a second tournament format, venue-specific.** Alongside the existing bracket format, a venue can host a live, time-boxed "winner stays on" event (`tournaments.bracket_type='rotation'`): crews queue and play short matches during a set window (e.g. a 2-hour block), and whichever crew has the most wins when `event_end_time` hits takes the venue's turf. Tiebreaker default: head-to-head result between the tied crews if they played each other during the event; otherwise whichever crew is on the court when time expires. A turf holder who doesn't show up doesn't auto-forfeit, but risks losing it to whoever wins among the crews that did — no separate no-show penalty needed, the event format itself creates the "use it or lose it" pressure. For v1, these events are created manually by the venue/admin each week from the Operator dashboard — true automatic weekly recurrence is a later enhancement, not required for launch.

---

## Section 2: Core Data Architecture (PostgreSQL)

```sql
-- 1. Users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255) UNIQUE NOT NULL,
    date_of_birth DATE NOT NULL CHECK (date_of_birth <= CURRENT_DATE - INTERVAL '13 years'),
    gender VARCHAR(50),
    tier VARCHAR(50) DEFAULT 'free', -- 'free', 'street_pass', 'operator' (platform admin/"X" role — NOT a venue role)
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Venues (partnered, real-world businesses — referred to by real name everywhere)
CREATE TABLE venues (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    venue_manager_user_id INTEGER REFERENCES users(id), -- facility staff: sees tournament revenue only, ZERO rule/dispute authority
    address VARCHAR(255),
    tournament_entry_fee_cents INTEGER DEFAULT 0, -- per-crew real-money entry fee the venue sets for ITS Turf Wars (never charged for Call-Outs — those don't happen here)
    platform_fee_pct INTEGER DEFAULT 15, -- platform's facilitation cut of tournament_entry_fee_cents
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Courts (public courts + venue-attached courts share one table)
CREATE TABLE courts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'public', -- 'public', 'venue'
    venue_id INTEGER REFERENCES venues(id) NULL, -- null if public; venue-type courts can ONLY host matches with a tournament_id set (Turf Wars) — standalone Call-Outs are public-court only
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    holding_crew_id INTEGER REFERENCES crews(id) NULL, -- current "turf" holder; NEVER set on creation, only via a resolved Call-Out win against a different crew
    holder_decline_count INTEGER NOT NULL DEFAULT 0, -- declines by the CURRENT holder at this court within the current season; 3rd decline forfeits the turf and resets this to 0; also reset to 0 on any holder change or season close
    submitted_by_crew_id INTEGER REFERENCES crews(id) NULL, -- null for admin/venue-seeded courts
    status VARCHAR(20) NOT NULL DEFAULT 'active' -- 'pending' for user submissions until GPS-verified, 'active' once live
);

-- 4. Crews
CREATE TABLE crews (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    boss_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    coin_balance INTEGER DEFAULT 100,
    reputation_score INTEGER DEFAULT 100,
    sport_type VARCHAR(100) NOT NULL,
    -- format_type intentionally removed from here: a crew's roster can be
    -- larger than any single match format and flex across 1v1 up to 5v5;
    -- format now lives on the match itself (see matches table below)
    age_class VARCHAR(20) NOT NULL,     -- 'U14','U18','Adult'
    gender_class VARCHAR(50) NOT NULL,  -- 'Open','Coed','Male','Female'
    map_color_hex VARCHAR(7) NOT NULL DEFAULT '#CCFF00', -- assigned at creation; how this crew's held courts render on the map
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Crew Rosters (player can belong to multiple crews)
CREATE TABLE crew_rosters (
    crew_id INTEGER REFERENCES crews(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (crew_id, user_id)
);

-- 6. Matches (Call-Outs; Turf Wars references these, doesn't replace them)
CREATE TABLE matches (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL DEFAULT 'call_out', -- 'call_out' (turf wars rounds use this too)
    format_type VARCHAR(20) NOT NULL, -- '1v1','2v2','3v3','4v4','5v5' — set per match, not per crew; a roster can flex across formats
    status VARCHAR(50) NOT NULL DEFAULT 'negotiating', -- negotiating, locked, active, resolved, disputed, voided
    challenger_crew_id INTEGER REFERENCES crews(id),
    defender_crew_id INTEGER REFERENCES crews(id),
    wager_amount INTEGER NOT NULL DEFAULT 0,
    court_id INTEGER REFERENCES courts(id),
    scheduled_time TIMESTAMP,
    challenger_reported_score VARCHAR(50),
    defender_reported_score VARCHAR(50),
    disputed_at TIMESTAMP NULL, -- set the moment scores first mismatch; starts the 48hr auto-void clock
    resolved_by_x_admin_id INTEGER REFERENCES users(id) NULL, -- set only for genuine exceptions (abuse/appeals) — NOT used for routine disputes, those self-resolve or auto-void
    winner_crew_id INTEGER REFERENCES crews(id) NULL,
    tournament_id INTEGER NULL -- set when this match is a Turf Wars round
);

-- 7. Match Lineups
CREATE TABLE match_lineups (
    match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
    crew_id INTEGER REFERENCES crews(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (match_id, crew_id, user_id)
);

-- 7b. Tournament Entries (real-money fee, only exists for venue-hosted Turf Wars)
CREATE TABLE tournament_entries (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,
    crew_id INTEGER REFERENCES crews(id),
    venue_id INTEGER REFERENCES venues(id) NULL, -- null for a public-court (coin-only) Turf Wars
    amount_cents INTEGER NOT NULL DEFAULT 0, -- 0 for public/coin-based tournaments or for the turf-exempt crew
    platform_fee_cents INTEGER NOT NULL DEFAULT 0,
    venue_payout_cents INTEGER NOT NULL DEFAULT 0,
    stripe_payment_intent_id VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending', -- pending, paid, exempt, refunded
    created_at TIMESTAMP DEFAULT NOW()
);

-- 8. Coin Ledger (auditable earn/spend log, not just a balance mutation)
CREATE TABLE coin_transactions (
    id SERIAL PRIMARY KEY,
    crew_id INTEGER REFERENCES crews(id),
    amount INTEGER NOT NULL, -- positive = earned, negative = spent/lost
    reason VARCHAR(100) NOT NULL, -- 'match_win', 'match_wager', 'rake', 'hype_bonus'
    match_id INTEGER REFERENCES matches(id) NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 9. Turf Wars Tournaments (wrapper, not a separate match engine)
CREATE TABLE tournaments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    bracket_type VARCHAR(20) NOT NULL DEFAULT 'bracket', -- 'bracket' (elimination rounds) or 'rotation' (live winner-stays-on event; most wins when time expires takes the venue's turf)
    court_id INTEGER REFERENCES courts(id) NULL, -- primary/anchor court if relevant
    venue_id INTEGER REFERENCES venues(id) NULL, -- set if this is a venue-hosted (real-money entry) Turf Wars; null for a public, coin-only one. A venue's tournament can still span several of its own courts via individual matches' own court_id.
    format_type VARCHAR(20) NOT NULL,
    status VARCHAR(50) DEFAULT 'open', -- open, in_progress, complete
    coin_prize_pool INTEGER DEFAULT 0,
    event_start_time TIMESTAMP NULL, -- 'rotation' type only: the live window start
    event_end_time TIMESTAMP NULL,   -- 'rotation' type only: the live window end — most-wins crew at this moment takes the turf
    created_at TIMESTAMP DEFAULT NOW()
);

-- 10. Cosmetic & Utility Items (the coin "store")
CREATE TABLE store_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    item_type VARCHAR(30) NOT NULL, -- 'jersey','tag_style','court_banner','profile_flair','rematch_clause','priority_booking'
    cost_coins INTEGER NOT NULL,
    min_reputation INTEGER DEFAULT 0, -- gates higher-tier cosmetics behind reputation
    is_consumable BOOLEAN DEFAULT FALSE -- true for rematch_clause/priority_booking (single-use)
);

-- 11. Crew Inventory (what a crew owns / has equipped)
CREATE TABLE crew_inventory (
    id SERIAL PRIMARY KEY,
    crew_id INTEGER REFERENCES crews(id) ON DELETE CASCADE,
    item_id INTEGER REFERENCES store_items(id),
    equipped BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP NULL, -- set when a consumable is spent
    purchased_at TIMESTAMP DEFAULT NOW()
);

-- 12. Seasons (periodic reset + archived standings; default length 6 weeks, admin sets end_date to override per season)
CREATE TABLE seasons (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL, -- e.g. 'Summer 2026'
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(20) DEFAULT 'active' -- active, complete
);

CREATE TABLE season_results (
    season_id INTEGER REFERENCES seasons(id),
    crew_id INTEGER REFERENCES crews(id),
    final_reputation INTEGER,
    final_coin_balance INTEGER,
    final_rank INTEGER,
    PRIMARY KEY (season_id, crew_id)
);

-- 13. Achievements (crew-level badges)
CREATE TABLE achievements (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL, -- 'Giant Killer', 'Undefeated Season', 'First Blood'
    description VARCHAR(500)
);

CREATE TABLE crew_achievements (
    crew_id INTEGER REFERENCES crews(id) ON DELETE CASCADE,
    achievement_id INTEGER REFERENCES achievements(id),
    earned_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (crew_id, achievement_id)
);

-- 14. Player Stats (individual, cross-crew)
CREATE TABLE player_stats (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    total_appearances INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0
);

-- 15. Reports (feeds the X Console queue)
CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    reporter_user_id INTEGER REFERENCES users(id),
    reported_user_id INTEGER REFERENCES users(id) NULL,
    reported_crew_id INTEGER REFERENCES crews(id) NULL,
    reason VARCHAR(100) NOT NULL,
    note VARCHAR(500),
    status VARCHAR(20) DEFAULT 'open', -- open, reviewed
    created_at TIMESTAMP DEFAULT NOW()
);

-- 16. Blocks (prevents being challenged/matched against)
CREATE TABLE blocks (
    blocker_user_id INTEGER REFERENCES users(id),
    blocked_user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (blocker_user_id, blocked_user_id)
);

-- 17. Quests (daily/weekly objectives)
CREATE TABLE quests (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(500),
    cadence VARCHAR(20) NOT NULL, -- 'daily', 'weekly'
    requirement_type VARCHAR(50) NOT NULL, -- 'win_match','hold_courts','play_new_venue','win_streak', etc.
    requirement_count INTEGER NOT NULL DEFAULT 1,
    coin_reward INTEGER NOT NULL,
    active_from DATE NOT NULL,
    active_until DATE NOT NULL
);

-- 18. Crew Quest Progress
CREATE TABLE crew_quest_progress (
    crew_id INTEGER REFERENCES crews(id) ON DELETE CASCADE,
    quest_id INTEGER REFERENCES quests(id),
    progress_count INTEGER NOT NULL DEFAULT 0,
    completed_at TIMESTAMP NULL,
    claimed BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (crew_id, quest_id)
);
```

**Streaks & turf trickle:** add `current_win_streak INTEGER DEFAULT 0` to `crews`, and `turf_held_since TIMESTAMP NULL` to `courts` — both updated on match resolution, and read by a scheduled job that pays the daily turf-holding trickle.

**Rivalries & Crew Tiers are intentionally NOT new tables.** A head-to-head Rivalry is just a query over `matches` filtered to a specific pair of `crew_id`s. A Crew Tier (Scrub/Up-and-Comer/Baller/Legend) is just a threshold read off `reputation_score` at render time. Both are computed, not stored — keeps them free to retune without a migration.

**Economy logic:** Wager resolution writes two `coin_transactions` rows (loser's stake out, winner's pot in) and a rake transaction — the 10% rake always goes fully to the platform's virtual ledger, at any court type, since coins have no cash value and there's no real venue revenue to split here. If a match instead auto-voids (disputed 48+ hours with no agreement), the original wager stake is refunded to both crews via `coin_transactions` rows (`reason='match_void_refund'`) and nothing else about the match touches reputation, streaks, player_stats, or `holding_crew_id` — it's treated as if it never happened. Beyond wagers, coins also flow in via: turf-holding trickle (daily job, paid to whoever holds `holding_crew_id` on each court), clean-play bonus (both sides' reported scores matched with no dispute), hype-received bonus (match crosses a Hype-count threshold on The Wire), and win streaks (escalating bonus at 3/5/10 consecutive wins). Coins flow out via the `store_items` purchases logged in `crew_inventory`, and via the escalating coin fee for public court submissions.

**Real venue revenue is entirely separate from coins, and only ever comes from Turf Wars.** Call-Outs never carry a real-money charge regardless of court type. Entering a venue-hosted Turf Wars creates a `tournament_entries` row per crew, charged via Stripe — except the crew currently holding that venue's turf, whose row is marked `status='exempt'` with `amount_cents=0`. The venue receives `amount_cents` minus `platform_fee_cents` only when crews actually pay to enter; the venue never pays anything itself, monthly or otherwise.

---

## Section 3: Phase Plan

### Phase 1 — Auth, Crews, Courts, Call-Outs
- Twilio Verify OTP login + handle. Collect DOB + gender right after first successful OTP (enforces the 13+ check before letting them past onboarding). Handle runs through the basic profanity/slur blocklist at signup.
- Crew creation (name, sport, age_class, gender_class — no format chosen here; format is selected per match, see Lock Lineup below). Boss = creator. Crew name also runs through the blocklist. Boss can transfer Boss status to another rostered player; if a Boss deletes their account, Boss auto-transfers to the longest-tenured remaining roster member, or the crew is archived (not deleted) if no members remain.
- Draft Player guardrail is symmetric: `U14` crews reject anyone 14+, `U18` crews reject anyone 18+, and `Adult` crews reject anyone under 18 — a roster is never mixed-age.
- Courts seeded: the partnered venue's multiple courts (several `courts` rows, all sharing one `venue_id`, type='venue') + an initial set of public courts (manually entered for launch market).
- Lock Lineup: when proposing or accepting a Call-Out, the Boss picks the match's `format_type` (1v1 up to 5v5) and checks off exactly that many active roster members to field — e.g. a 1v1 match locks exactly 1 player per crew, a 3v3 match locks exactly 3. This writes `match_lineups` rows and freezes those specific players from being lineup-locked into any other simultaneous match until the current one resolves or voids. Locking the wrong number of players for the chosen `format_type` is rejected.
- Match display naming: a 1v1 match displays as the two individual players' handles head-to-head (e.g. "Ghost vs Dragon"), with each player's crew shown alongside as a tag — not buried, but secondary to the personal matchup. Any format_type of 2v2 or larger displays as standard Crew vs Crew (e.g. "Block Burners vs West 4th Kings") rather than listing every player.
- Call-Out flow (public courts only — venue-type courts can never host a standalone Call-Out, only tournament rounds; see Phase 3): challenger proposes a wager_amount, defender can only accept or decline (no counter-offer in v1). If the defender currently holds the chosen court's turf and declines, increment that court's `holder_decline_count`; on the 3rd decline within the current season, clear `holding_crew_id` and reset the counter to 0 — the turf is open until someone wins a Call-Out there. Locking the match checks both crews' `coin_balance >= wager_amount` first and rejects if either is short. → scheduled → both sides report score → auto-resolve if scores match. A mismatch sets `disputed_at` and gives both Bosses 48 hours to correct/resubmit and reach agreement — still auto-resolves the moment reports match. A daily/hourly scheduled job auto-voids any match still disputed past 48 hours: refund the wager to both crews, leave reputation/streak/turf/player_stats untouched.
- On resolution: update `coin_balance` via `coin_transactions` (win/loss + clean-play bonus), update `reputation_score`, update `current_win_streak`, update `player_stats`, and update the court's `holding_crew_id`/`turf_held_since` to the winner.
- Report & Block: any user can report another user/crew (writes a `reports` row, status `open`) or block them outright (writes a `blocks` row) — a block prevents future challenges/matchmaking between the two.
- All system-originated messages (OTP confirmations aside) are signed "X" — never a real name, never "Support," never the venue's name.
- Global "Leave The Street" logout, clears session.

### Phase 2 — The Wire, Map, Quests, Hype, Rivalries, Tiers & Public Court Submission
- Spectator feed of upcoming/recent matches (now there's real match data from Phase 1 to show).
- **Map view**: an actual map of the local area with courts plotted on it, color-coded by `crews.map_color_hex` for whichever crew currently holds each one. This is the platform's real-world game board — open the app and see who controls what, where, not just a list of results.
- **Quests**: daily/weekly objectives from the `quests` table, progress tracked per crew in `crew_quest_progress`, paying out `coin_reward` to `coin_balance` via a `coin_transactions` row on completion. Gives crews a reason to open the app even with no match currently scheduled.
- "Hype / Pull Up" counter per match card; crossing a threshold triggers the hype-received coin bonus.
- Crew/court profile pages showing current turf held, reputation, win/loss record, computed Crew Tier badge, and head-to-head Rivalry record against any crew they've played before.
- **Celebratory moments**: taking turf, hitting a win streak, leveling up a Crew Tier — each gets an actual on-screen celebratory beat (animation/toast/banner) tied to its existing backend event, not a silent data update.
- Daily scheduled job: pays turf-holding trickle to every court's current holder, with diminishing payout the more courts that crew simultaneously holds (keeps the map contestable even for a dominant crew).
- **Public court submission** (crews only — venue staff never create public courts, they only manage their own venue's courts): a crew submits a new public court's name + location; the name runs through the same blocklist filter as handles/crew names. Requires the submitting device's GPS to be near the claimed coordinates, and rejects duplicates within a set radius of an existing court. New submissions are `status='pending'` and not visible/playable until that check clears. Costs an escalating coin fee — a flat base cost for a crew's first submission, rising for each additional submission by that same crew within a rolling 7-day window — logged as a `coin_transactions` row (`reason='court_submission'`). Creating a court never sets `holding_crew_id`; turf can only be claimed by winning a resolved Call-Out there against a different crew.

### Phase 3 — Turf Wars, Dashboards & The Store
- Tournament creation, two formats: **Bracket** generates a bracket of `matches` rows linked via `tournament_id`, auto-advances winners round to round, funds `coin_prize_pool`. **Rotation** (venue-specific, manually created each week for v1) sets `event_start_time`/`event_end_time`; crews queue and play matches during that live window, and at `event_end_time` the crew with the most wins (tiebreaker: head-to-head if they played, else whoever's on the court) becomes the venue's new `holding_crew_id`. If `tournaments.venue_id` is set (either format), entering creates a `tournament_entries` row per crew, charged via Stripe — except the crew currently holding that venue's turf, whose entry is `status='exempt'`, `amount_cents=0`. A tournament with no `venue_id` (public court) is coin-only, no real money involved.
- Venue dashboard (for venue staff): their own tournament revenue history and payout totals from `tournament_entries`. No dispute queue, no rule-related data — staff have no authority there.
- X Console (platform admin only): handles genuine exceptions only — repeated bad-faith disputes, abuse reports, account moderation, appeals. Routine score mismatches never reach this; they self-resolve or auto-void per Phase 1. Fully separate surface from the venue dashboard.
- The Store: `store_items` catalog (jerseys, tag styles, court banners, profile flair, rematch clauses, priority booking), purchase flow writes to `crew_inventory` and a negative `coin_transactions` row.
- Achievements engine: checks against match/season history on resolution, awards `crew_achievements`.

### Phase 4 — Seasons, Proximity Notifications & Monetization Layer
- Season close job: snapshots every crew's reputation/coin standing into `season_results`, then soft-resets `reputation_score` (and optionally `coin_balance`) for the new season. Also resets `courts.holder_decline_count` to 0 across every court, regardless of its current value, so no holder carries decline history into the new season. Crowns a Season MVP crew. New seasons default to 6 weeks but an admin can set a different `end_date` when creating one.
- Proximity-aware notifications: with push infrastructure and a location-permission flow in place, notify crews when a challenge or rival activity is happening near their last known location ("a crew is challenging your turf two blocks away").
- `street_pass` subscription tier (cosmetics, stats, priority scheduling).
- Real-money Turf Wars entry fees (if ever introduced) ship as a clearly separate "tournament entry" product feeding a prize pool — never blended with the everyday coin-wager mechanic.

---

## Section 4: Master Replit Launch Blueprint

```
PROJECT: "The Street" — Underground Sports Network PWA

STEP 0 — CONTEXT LOAD
Read /the_street_specification.md in full before writing any code. Section 1.3
holds the binding architecture decisions. Build in the order below.

IMPORTANT — VISUAL FIDELITY: the attached reference screenshot (attach the
login-wall image directly in this prompt, not just the written description
below) is the literal target for VIEW 1. Match it exactly — layout,
spacing, type treatment, colors, textures. Do not "improve," genericize,
or restyle it.

STEP 1 — STACK
- Backend: Node.js + Express (server.js)
- DB: Replit's built-in PostgreSQL (use DATABASE_URL — already provisioned)
- Auth: Twilio Verify for OTP (use TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
  TWILIO_VERIFY_SERVICE_SID from env — do not hardcode or ask me for them
  in chat, use Replit Secrets)
- Payments: Stripe for real-money Turf Wars tournament entry fees only (use
  STRIPE_SECRET_KEY from Replit Secrets) — never used for coins, coins
  are earned in-game only and never touch Stripe
- Frontend: Single static PWA — public/index.html, public/style.css,
  public/app.js, client-side view routing (no full page reloads)
- Session: express-session + connect-pg-simple
- Fonts: 'Permanent Marker', 'Special Elite', 'Big Shoulders Display' (900)
  via Google Fonts

STEP 2 — DATABASE INIT
Run all 21 CREATE TABLE statements from Section 2 idempotently
(CREATE TABLE IF NOT EXISTS) on boot, plus the `current_win_streak` column
on crews and `turf_held_since` column on courts. Do not simplify the schema.

STEP 3 — PHASE 1 BUILD
- VIEW 1 (Login Wall): pixel-match the reference screenshot exactly —
  radial-gradient concrete background, hanging bulb glow, "UNDERGROUND
  SPORTS NETWORK" eyebrow, "THE STREET" graffiti wordmark in #CCFF00 with
  spray-glow text-shadow, "IDENTIFY YOURSELF" subhead, Phone Number +
  Street Name inputs with white spray-glow box-shadow + asymmetric
  border-radius, "HIT THE STREET" button as an eroded concrete block with
  a lightning-bolt icon, footer "NO REGISTRATION • NO TRACKERS • PURE GAME".
  No "TST" or "RUNNING" text.
- Phone field triggers POST /api/auth/send-otp (Twilio Verify). On code
  entry, POST /api/auth/check-otp. On first-ever login, show a short
  Step 2 onboarding screen collecting date_of_birth + gender before
  proceeding — reject if under 13 with a clear, kind message.
- Build Crew creation, Court seeding (public + the partnered venue's
  court), and the full Call-Out flow per Section 3 Phase 1, including
  coin_transactions writes and court holding_crew_id updates on
  resolution.
- Persistent "Leave The Street" logout button.

STEP 4 — STOP AND SHOW ME
After Phase 1 is working end-to-end (signup → crew → call-out → resolved
match → coin/reputation/turf updates all correct in the DB), stop and
show me before starting Phase 2 (The Wire).
```

---

## Section 5: VIEW 1 Visual Direction (Login Wall) — Hero Image + Live Form

**This supersedes the diagonal-split SVG illustration plan entirely.**
A finished hero artwork now exists (`login_hero.png`) — basketball on a
US blacktop blending into street soccer in a favela alley, lit by a
central street lamp, with "The Street" wordmark already rendered into
the image in glowing green. This image is used as-is. None of the
street light, silhouette panels, wordmark glow, or drip marks need to be
separately built in SVG/CSS anymore — they're already finished pixels in
this one asset.

**Critical structural difference from the earlier (failed) image-overlay
approach:** this image has NO functional elements positioned relative to
specific pixels inside it. It is purely a hero banner occupying the top
portion of the screen. Every interactive element (inputs, button) lives
independently below it in normal page flow, built with real responsive
CSS. There is nothing to misalign, because nothing is locked to the
image's coordinates.

1. **Hero image**: `login_hero.png`, sized to roughly the top 45-50% of
   the viewport, `object-fit: cover`, `object-position` biased to keep
   the street lamp and the baked-in wordmark in frame across different
   phone widths.
2. **Light flicker overlay**: the lamp in the photo is static, so a
   separate animated overlay simulates the flicker — a small
   radial-gradient "glow" element positioned directly over the lamp's
   light source in the image (roughly centered horizontally, upper
   portion of the hero banner), with opacity/brightness animated via
   CSS `@keyframes` on irregular, uneven timing (a couple of quick dips
   and recoveries, not a smooth steady pulse) so it reads as a real
   flickering bulb rather than an even sine-wave animation. Subtle —
   ambient atmosphere, not a distraction.
3. **Eyebrow label**, overlaid near the top of the image (there's open
   dark sky/skyline space there): "UNDERGROUND SPORTS NETWORK" — small,
   light grey, uppercase, wide letter-spacing, centered.
4. **Fade transition**: an absolutely-positioned gradient layer over
   roughly the bottom quarter of the hero image —
   `linear-gradient(to bottom, transparent, [page background color] 90%)`
   — so the photo dissolves into the page rather than cutting off with a
   hard edge. The gradient's end color must exactly match the solid
   background color used below it, or the seam will be visible.
5. **Live activity banner** (added during build, keeping it — good
   addition): a thin horizontal bar sitting between the fade and the
   "IDENTIFY YOURSELF" divider, in warm amber/gold text matching the
   streetlight's glow. Dynamic based on today's real match count from
   the backend: if there's at least one match scheduled today, show a
   count/teaser (e.g. "3 GAMES TONIGHT"); if there are none, show "NO
   GAMES TONIGHT — BE THE FIRST" as a soft call-to-action. This needs a
   lightweight public endpoint (no auth required, since this renders on
   the pre-login screen) returning today's scheduled match count.
6. **Below the fade**, solid dark background (~#121214), normal
   responsive flow, nothing positioned relative to the image above:
   - Divider: thin grey horizontal rule with a center gap holding
     "IDENTIFY YOURSELF" in white stencil-caps, letter-spaced, centered.
   - Two real `<input>` elements, left-aligned labels above each (icon +
     uppercase volt-green text: "📞 PHONE NUMBER", "👤 STREET NAME"),
     dark/transparent fill, light grey uppercase placeholders ("YOUR
     DIGITS", "YOUR HANDLE"), inline SVG rough-rectangle border (uneven
     line weight/corners, hand-sprayed look) instead of a standard CSS
     border.
   - Primary button, full-width within page margins: mottled olive-lime
     green with an SVG `feTurbulence` noise texture over the base color
     — not a flat gradient. Distressed darker border, slightly uneven
     edges, black bold stencil text "⚡ HIT THE STREET".
   - Footer tagline, centered, small grey uppercase letter-spaced text:
     "NO REGISTRATION • NO TRACKERS • PURE GAME".

**Consistent margins** on every element below the fade — nothing touches
screen edges.

**Self-check after building:** the fade reads as a seamless dissolve,
not a hard cut or a visible color mismatch; the hero image's wordmark
and street lamp stay in frame at common phone widths; the flicker
overlay is subtle and irregular, not a steady pulse or a distraction;
inputs and button still read hand-painted, not vector-clean; nothing
about the form's layout shifts or breaks regardless of hero image load
timing.

**Out of scope for this pass:** OTP screen redesign, any backend/auth
logic changes, PWA/mobile app work, validation error styling.

**Relevant files** (per the current build): `artifacts/api-server/public/app.js`,
`artifacts/api-server/public/style.css`, `artifacts/api-server/public/login_hero.png`
(new asset, replaces the deleted `login-wall.png`), `artifacts/api-server/public/index.html`.
