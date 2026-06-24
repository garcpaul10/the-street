/* ── THE STREET — CLIENT APP ── */

const App = (() => {
  let state = {
    user: null,
    view: 'login',
    myCrews: [],
    activeCrewId: null,
    courts: [],
    matches: [],
    pendingPhone: null,
    mockOtpCode: null,
  };

  let tournamentsData = [];
  let activeTournamentId = null;
  let activeTournamentDetail = null;
  let storeData = { items: [], inventory: [] };
  let activePlayerData = null;
  let leaderboardData = null;
  let activeMatchDetail = null;
  let activeCourtHistory = null;
  let joinInviteData = null;

  // ── ROUTER ──
  function show(viewId) {
    state.view = viewId;
    render();
  }

  // ── API HELPERS ──
  async function api(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  }

  // ── TOAST ──
  function toast(msg) {
    let el = document.getElementById('app-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'app-toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3000);
  }

  // ── CREW TIER ──
  function crewTier(rep) {
    if (rep < 200) return ['SCRUB', 'tier-scrub'];
    if (rep < 500) return ['UP & COMER', 'tier-upandcomer'];
    if (rep < 1000) return ['BALLER', 'tier-baller'];
    return ['LEGEND', 'tier-legend'];
  }

  // ── RENDER ──
  function render() {
    const root = document.getElementById('app');
    switch (state.view) {
      case 'landing':      root.innerHTML = renderLanding(); bindLanding(); break;
      case 'login':        root.innerHTML = renderLogin(); bindLogin(); break;
      case 'otp':          root.innerHTML = renderOtp(); bindOtp(); break;
      case 'onboarding':   root.innerHTML = renderOnboarding(); bindOnboarding(); break;
      case 'home':         root.innerHTML = renderShell(renderHome()); bindShell(); bindHome(); break;
      case 'wire':         root.innerHTML = renderShell(renderWire()); bindShell(); bindWire(); break;
      case 'crews':        root.innerHTML = renderShell(renderCrews()); bindShell(); bindCrews(); break;
      case 'create-crew':  root.innerHTML = renderShell(renderCreateCrew()); bindShell(); bindCreateCrew(); break;
      case 'crew-detail':  root.innerHTML = renderShell(renderCrewDetail()); bindShell(); bindCrewDetail(); break;
      case 'crew-profile': root.innerHTML = renderShell(renderCrewProfile()); bindShell(); bindCrewProfile(); break;
      case 'matches':      root.innerHTML = renderShell(renderMatches()); bindShell(); bindMatches(); break;
      case 'callout':      root.innerHTML = renderShell(renderCallout()); bindShell(); bindCallout(); break;
      case 'map':          root.innerHTML = renderShell(renderMap()); bindShell(); bindMap(); break;
      case 'quests':       root.innerHTML = renderShell(renderQuests()); bindShell(); bindQuests(); break;
      case 'courts':       root.innerHTML = renderShell(renderCourts()); bindShell(); bindCourts(); break;
      case 'profile':           root.innerHTML = renderShell(renderProfile()); bindShell(); bindProfile(); break;
      case 'turf-wars':         root.innerHTML = renderShell(renderTurfWars()); bindShell(); bindTurfWars(); break;
      case 'tournament-detail': root.innerHTML = renderShell(renderTournamentDetail()); bindShell(); bindTournamentDetail(); break;
      case 'store':             root.innerHTML = renderShell(renderStore()); bindShell(); bindStore(); break;
      case 'venue-dashboard':   root.innerHTML = renderShell(renderVenueDashboard()); bindShell(); bindVenueDashboard(); break;
      case 'x-console':         root.innerHTML = renderShell(renderXConsole()); bindShell(); bindXConsole(); break;
      case 'player-profile':    root.innerHTML = renderShell(renderPlayerProfile()); bindShell(); bindPlayerProfile(); break;
      case 'leaderboard':       root.innerHTML = renderShell(renderLeaderboard()); bindShell(); bindLeaderboard(); break;
      case 'match-detail':      root.innerHTML = renderShell(renderMatchDetail()); bindShell(); bindMatchDetail(); break;
      case 'court-history':     root.innerHTML = renderShell(renderCourtHistory()); bindShell(); break;
      case 'join-crew':         root.innerHTML = renderJoinCrew(); bindJoinCrew(); break;
    }
  }

  // ── SVG SPRAY BORDER ──
  function sprayBorder(w, h) {
    // Rough hand-drawn rectangle using path with slight wobble
    return `<svg class="spray-border" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <filter id="spray">
        <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="2" result="noise"/>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      <rect x="2" y="2" width="${w-4}" height="${h-4}" rx="2"
        fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.5"
        filter="url(#spray)" stroke-dasharray="none"/>
    </svg>`;
  }

  // ── LOGIN VIEW ──
  // ── LANDING / INTRO CAROUSEL (first-time visitors only) ──
  function renderLanding() {
    return `
      <div id="view-landing">
        <div class="landing-track" id="landing-track">

          <!-- Panel 1 — Hero -->
          <section class="landing-panel landing-hero">
            <div class="landing-hero-bg">
              <img class="landing-hero-img" src="login_hero.png" alt="" onerror="this.style.display='none'">
              <div class="lamp-flicker"></div>
              <div class="landing-hero-veil"></div>
            </div>
            <div class="landing-hero-content">
              <div class="landing-eyebrow">Underground Sports Network</div>
              <div class="landing-ticker" id="landing-ticker">—</div>
              <div class="landing-tagline">Your game. Your crew.<br>Your streets.</div>
            </div>
          </section>

          <!-- Panel 2 — The Loop -->
          <section class="landing-panel">
            <div class="landing-panel-inner">
              <div class="landing-kicker">How It Works</div>
              <h2 class="landing-h2">The Loop</h2>
              <div class="loop-steps">
                ${[
                  ['01','🏴','Build a Crew','Rally your squad under one name. Pick your sport, your colors, your turf.'],
                  ['02','⚡','Call Out Rivals','Challenge any crew to a match. Set the wager. Lock the lineup. No backing down.'],
                  ['03','🗺','Win Turf','Beat them on their court and the turf is yours. Hold it and it pays you daily.'],
                  ['04','👑','Run the Block','Stack wins, climb the tiers, become a Legend. The whole city watches The Wire.'],
                ].map(([n,icon,title,desc]) => `
                  <div class="loop-step">
                    <div class="loop-step-num">${n}</div>
                    <div class="loop-step-icon">${icon}</div>
                    <div class="loop-step-body">
                      <div class="loop-step-title">${title}</div>
                      <div class="loop-step-desc">${desc}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </section>

          <!-- Panel 3 — The Code -->
          <section class="landing-panel">
            <div class="landing-panel-inner">
              <div class="landing-kicker">What Makes It Different</div>
              <h2 class="landing-h2">The Code</h2>
              <div class="code-list">
                <div class="code-item">
                  <div class="code-item-head">⚡ Coins are earned, never bought</div>
                  <div class="code-item-desc">No pay-to-win. Every coin comes from winning games, holding turf, and completing quests. Your wallet means nothing here — your record does.</div>
                </div>
                <div class="code-item">
                  <div class="code-item-head">🔥 Reputation is everything</div>
                  <div class="code-item-desc">Win clean, climb from Scrub to Legend. Duck challenges or dispute scores and the street remembers.</div>
                </div>
                <div class="code-item">
                  <div class="code-item-head">🗺 Turf only changes hands by winning</div>
                  <div class="code-item-desc">You can't buy a court. You take it on the blacktop — and you hold it until someone runs you off it.</div>
                </div>
                <div class="code-item code-item-muted">
                  <div class="code-item-head">🚫 No registration walls · No trackers · Pure game</div>
                </div>
              </div>
            </div>
          </section>

          <!-- Panel 4 — CTA -->
          <section class="landing-panel landing-cta-panel">
            <div class="landing-panel-inner landing-cta-inner">
              <div class="landing-cta-logo">The Street</div>
              <div class="landing-cta-line">The court is calling.</div>
              <button class="btn btn-volt btn-full landing-enter" id="btn-enter-street">ENTER THE STREET →</button>
              <button class="landing-skip" id="btn-skip-intro">I already run these streets — skip</button>
            </div>
          </section>

        </div>

        <div class="landing-dots" id="landing-dots">
          ${[0,1,2,3].map(i => `<button class="landing-dot ${i===0?'active':''}" data-idx="${i}" aria-label="Go to panel ${i+1}"></button>`).join('')}
        </div>

        <button class="landing-next" id="landing-next" aria-label="Next">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    `;
  }

  function bindLanding() {
    const track = document.getElementById('landing-track');
    const dots = Array.from(document.querySelectorAll('.landing-dot'));
    const nextBtn = document.getElementById('landing-next');
    const panelCount = 4;

    function enter() {
      try { localStorage.setItem('street_seen_intro', '1'); } catch (_) {}
      show('login');
    }

    function currentIndex() {
      return Math.round(track.scrollLeft / track.clientWidth);
    }
    function goTo(i) {
      const idx = Math.max(0, Math.min(panelCount - 1, i));
      track.scrollTo({ left: idx * track.clientWidth, behavior: 'smooth' });
    }

    // Sync dots + next-button visibility on scroll
    let ticking = false;
    track.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const idx = currentIndex();
        dots.forEach((d, i) => d.classList.toggle('active', i === idx));
        if (nextBtn) nextBtn.style.opacity = idx === panelCount - 1 ? '0' : '1';
        if (nextBtn) nextBtn.style.pointerEvents = idx === panelCount - 1 ? 'none' : 'auto';
      });
    }, { passive: true });

    dots.forEach(d => d.addEventListener('click', () => goTo(parseInt(d.dataset.idx))));
    nextBtn?.addEventListener('click', () => goTo(currentIndex() + 1));
    document.getElementById('btn-enter-street')?.addEventListener('click', enter);
    document.getElementById('btn-skip-intro')?.addEventListener('click', enter);

    // Keyboard arrows (desktop)
    function onKey(e) {
      if (state.view !== 'landing') { document.removeEventListener('keydown', onKey); return; }
      if (e.key === 'ArrowRight') goTo(currentIndex() + 1);
      if (e.key === 'ArrowLeft') goTo(currentIndex() - 1);
    }
    document.addEventListener('keydown', onKey);

    // Live games ticker
    fetch('/api/public/today-matches')
      .then(r => r.json())
      .then(d => {
        const t = document.getElementById('landing-ticker');
        if (t) t.textContent = d.count > 0
          ? `⚡ ${d.count} GAME${d.count !== 1 ? 'S' : ''} GOING DOWN TONIGHT`
          : 'BE THE FIRST GAME TONIGHT';
      }).catch(() => {
        const t = document.getElementById('landing-ticker');
        if (t) t.textContent = 'BE THE FIRST GAME TONIGHT';
      });
  }

  function renderLogin() {
    return `
      <svg class="svg-filters" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <!-- Stone texture filter for the green slab fill -->
          <filter id="stone-texture" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.22 0.18" numOctaves="6" seed="12" stitchTiles="stitch" result="noise"/>
            <feColorMatrix type="matrix" values="0 0 0 0 0.1  0 0 0 0 0.08  0 0 0 0 0  0 0 0 0.85 0" in="noise" result="darkNoise"/>
            <feBlend in="SourceGraphic" in2="darkNoise" mode="multiply" result="textured"/>
            <feComponentTransfer in="textured">
              <feFuncR type="linear" slope="1.1" intercept="-0.02"/>
              <feFuncG type="linear" slope="1.08" intercept="0.02"/>
              <feFuncB type="linear" slope="0.7"/>
            </feComponentTransfer>
          </filter>
          <!-- Rough displacement for jagged stone edges -->
          <filter id="edge-roughen" x="-8%" y="-20%" width="116%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="5" result="disp"/>
            <feDisplacementMap in="SourceGraphic" in2="disp" scale="6" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
        </defs>
      </svg>

      <div id="view-login">
        <div class="hero-wrap">
          <img class="hero-img" src="login_hero.png" alt="The Street" onerror="this.style.display='none';document.querySelector('.hero-wrap').style.background='linear-gradient(to bottom, #0a0a0a 0%, #1a1f0a 50%, #121214 100%)'">
          <div class="lamp-flicker"></div>
          <div class="hero-eyebrow">Underground Sports Network</div>
          <div class="hero-fade"></div>
        </div>

        <div class="activity-bar" id="activity-bar">—</div>

        <div class="login-form-section">
          <div class="identify-divider">
            <span>Identify Yourself</span>
          </div>

          <div id="login-error" class="msg-error" style="display:none"></div>

          <div class="field-group">
            <label class="field-label">📞 Phone Number</label>
            <div class="spray-input-wrap" id="phone-wrap">
              <input class="spray-input" id="login-phone" type="tel" placeholder="YOUR DIGITS" autocomplete="tel" inputmode="tel">
            </div>
          </div>

          <div class="field-group">
            <label class="field-label">👤 Street Name</label>
            <div class="spray-input-wrap" id="handle-wrap">
              <input class="spray-input" id="login-handle" type="text" placeholder="YOUR HANDLE" autocomplete="username">
            </div>
          </div>

          <button class="btn-street" id="btn-hit-street" aria-label="Hit The Street">
            <img src="btn_street.png" alt="Hit The Street" class="btn-street-img">
          </button>

          <p class="login-footer">NO REGISTRATION &bull; NO TRACKERS &bull; PURE GAME</p>
        </div>
      </div>

      ${new URLSearchParams(location.search).get('dev') === '1' ? `
        <div id="dev-panel" style="position:fixed;bottom:0;left:0;right:0;background:#0a0b0d;border-top:1px solid rgba(255,59,78,0.4);padding:12px 16px;z-index:999;">
          <div style="font-family:'Big Shoulders Display',sans-serif;font-size:10px;font-weight:900;letter-spacing:0.15em;color:var(--red);margin-bottom:8px;">🔧 DEV LOGIN</div>
          <div style="display:flex;gap:8px;margin-bottom:8px;">
            <input id="dev-secret" type="password" placeholder="Secret" style="flex:1;background:var(--bg2);border:1px solid var(--border);color:var(--text);padding:6px 10px;border-radius:4px;font-size:12px;">
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${['RivalBoss','RivalPlayer','WildCard'].map(u =>
              `<button class="btn btn-outline btn-sm dev-login-btn" data-username="${u}" style="font-size:11px;">${u}</button>`
            ).join('')}
            <button id="dev-seed-btn" class="btn btn-sm" style="font-size:11px;background:rgba(255,59,78,0.15);color:var(--red);border:1px solid rgba(255,59,78,0.3);">SEED DATA</button>
          </div>
          <div id="dev-msg" style="font-size:11px;color:var(--muted);margin-top:6px;"></div>
        </div>
      ` : ''}
    `;
  }

  function bindLogin() {
    // Draw spray borders after layout
    requestAnimationFrame(() => {
      ['phone-wrap', 'handle-wrap'].forEach(id => {
        const wrap = document.getElementById(id);
        if (wrap) {
          const w = wrap.offsetWidth || 320;
          const h = wrap.offsetHeight || 50;
          const existing = wrap.querySelector('svg.spray-border');
          if (!existing) wrap.insertAdjacentHTML('beforeend', sprayBorder(w, h));
        }
      });
    });

    // Load live activity count
    fetch('/api/public/today-matches')
      .then(r => r.json())
      .then(d => {
        const bar = document.getElementById('activity-bar');
        if (bar) {
          bar.textContent = d.count > 0
            ? `⚡ ${d.count} GAME${d.count !== 1 ? 'S' : ''} TONIGHT`
            : 'NO GAMES TONIGHT — BE THE FIRST';
        }
      }).catch(() => {
        const bar = document.getElementById('activity-bar');
        if (bar) bar.textContent = 'NO GAMES TONIGHT — BE THE FIRST';
      });

    document.getElementById('btn-hit-street').addEventListener('click', async () => {
      const phone = document.getElementById('login-phone').value.trim();
      const handle = document.getElementById('login-handle').value.trim();
      const errEl = document.getElementById('login-error');
      errEl.style.display = 'none';

      if (!phone) { errEl.textContent = 'Enter your phone number.'; errEl.style.display = 'block'; return; }

      try {
        const res = await api('POST', '/api/auth/send-otp', { phone });
        state.pendingPhone = phone;
        state.pendingHandle = handle;
        show('otp');
      } catch (e) {
        errEl.textContent = e.message;
        errEl.style.display = 'block';
      }
    });

    // Dev panel
    if (new URLSearchParams(location.search).get('dev') === '1') {
      const devMsg = () => document.getElementById('dev-msg');
      const devSecret = () => document.getElementById('dev-secret')?.value.trim();

      document.querySelectorAll('.dev-login-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const username = btn.dataset.username;
          const secret = devSecret();
          if (!secret) { devMsg().textContent = 'Enter secret first.'; return; }
          try {
            const res = await api('POST', '/api/dev/login', { username, secret });
            await loadAppState();
            show('wire');
          } catch(e) { devMsg().textContent = e.message; }
        });
      });

      document.getElementById('dev-seed-btn')?.addEventListener('click', async () => {
        const secret = devSecret();
        if (!secret) { devMsg().textContent = 'Enter secret first.'; return; }
        try {
          const res = await api('POST', '/api/dev/seed', { secret });
          devMsg().textContent = `✓ Seeded ${res.users.filter(u => !u.skipped).length} users, crew id ${res.rivalCrewId}`;
        } catch(e) { devMsg().textContent = e.message; }
      });
    }
  }

  // ── OTP VIEW ──
  function renderOtp() {
    return `
      <div id="view-otp">
        <div class="otp-title">Check Your Phone</div>
        <div class="otp-sub">We sent a 6-digit code to<br><strong>${state.pendingPhone}</strong></div>

        <div class="form-wide">
          <div id="otp-error" class="msg-error" style="display:none"></div>
          <div class="form-field">
            <label class="form-label">6-Digit Code</label>
            <input class="form-input" id="otp-input" type="text" inputmode="numeric" placeholder="000000" maxlength="6" autocomplete="one-time-code" style="text-align:center;font-size:24px;letter-spacing:0.3em;">
          </div>
          <button class="btn btn-volt btn-full" id="btn-verify-otp">VERIFY CODE</button>
          <button class="btn btn-outline btn-full" id="btn-back-login">← GO BACK</button>
        </div>
      </div>
    `;
  }

  function bindOtp() {
    document.getElementById('btn-back-login').addEventListener('click', () => show('login'));
    document.getElementById('btn-verify-otp').addEventListener('click', async () => {
      const code = document.getElementById('otp-input').value.trim();
      const errEl = document.getElementById('otp-error');
      errEl.style.display = 'none';
      try {
        const res = await api('POST', '/api/auth/verify-otp', { phone: state.pendingPhone, code });
        if (res.newUser) {
          show('onboarding');
        } else {
          state.user = { username: res.username };
          await loadAppData();
          show('home');
        }
      } catch (e) {
        errEl.textContent = e.message;
        errEl.style.display = 'block';
      }
    });
  }

  // ── ONBOARDING VIEW ──
  function renderOnboarding() {
    const handle = state.pendingHandle || '';
    return `
      <div id="view-onboarding">
        <div class="onboard-title">One More Thing</div>
        <div class="onboard-sub">Tell us a little about yourself.<br>You must be at least 13 to join.</div>

        <div class="form-wide">
          <div id="onboard-error" class="msg-error" style="display:none"></div>

          <div class="form-field">
            <label class="form-label">👤 Street Name (Handle)</label>
            <input class="form-input" id="ob-handle" type="text" placeholder="YOUR HANDLE" value="${handle}" autocomplete="username">
          </div>

          <div class="form-field">
            <label class="form-label">🎂 Date of Birth</label>
            <input class="form-input" id="ob-dob" type="date" max="${new Date().toISOString().split('T')[0]}">
          </div>

          <div class="form-field">
            <label class="form-label">⚧ Gender</label>
            <select class="form-select" id="ob-gender" required>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          <button class="btn btn-volt btn-full" id="btn-complete-signup">JOIN THE STREET</button>
        </div>
      </div>
    `;
  }

  function bindOnboarding() {
    document.getElementById('btn-complete-signup').addEventListener('click', async () => {
      const errEl = document.getElementById('onboard-error');
      errEl.style.display = 'none';
      const username = document.getElementById('ob-handle').value.trim();
      const dob = document.getElementById('ob-dob').value;
      const gender = document.getElementById('ob-gender').value;

      if (!username) { errEl.textContent = 'Choose a street name.'; errEl.style.display = 'block'; return; }
      if (!dob) { errEl.textContent = 'Enter your date of birth.'; errEl.style.display = 'block'; return; }

      try {
        const res = await api('POST', '/api/auth/complete-signup', { username, date_of_birth: dob, gender });
        state.user = { username };
        await loadAppData();
        show('home');
        if (res.joined_crew_id) {
          const crew = state.myCrews.find(c => c.id === res.joined_crew_id);
          toast(`WELCOME TO THE STREET ⚡ — YOU'RE ON ${crew ? crew.name.toUpperCase() : 'THE CREW'}!`);
        } else {
          toast('WELCOME TO THE STREET ⚡');
        }
      } catch (e) {
        errEl.textContent = e.message;
        errEl.style.display = 'block';
      }
    });
  }

  // ── APP DATA ──
  async function loadAppData() {
    const meRes = await api('GET', '/api/auth/me');
    state.user = meRes.user;

    const crewRes = await api('GET', '/api/crews/mine');
    state.myCrews = crewRes.crews;
    if (state.myCrews.length && !state.activeCrewId) {
      state.activeCrewId = state.myCrews[0].id;
    }

    const courtRes = await api('GET', '/api/courts');
    state.courts = courtRes.courts;

    if (state.activeCrewId) {
      const mRes = await api('GET', `/api/matches?crew_id=${state.activeCrewId}`);
      const prevMatches = state.matches;
      state.matches = mRes.matches;
      checkCelebrations(prevMatches, mRes.matches);
    }

    // Refresh wire data in background
    fetch('/api/wire').then(r => r.json()).then(d => { wireData = d; }).catch(() => {});
  }

  function checkCelebrations(prev, next) {
    if (!prev.length) return;
    const crew = state.myCrews.find(c => c.id === state.activeCrewId);
    if (!crew) return;

    next.forEach(m => {
      const old = prev.find(p => p.id === m.id);
      if (!old || old.status === m.status) return;

      if (m.status === 'resolved' && m.winner_crew_id === state.activeCrewId) {
        const streak = crew.current_win_streak;
        if (streak >= 10) showCelebration('🏆 10-WIN STREAK! YOU RUN THE BLOCK!', 'streak');
        else if (streak >= 5) showCelebration('🔥 5-WIN STREAK! ON FIRE!', 'streak');
        else if (streak >= 3) showCelebration('⚡ 3-WIN STREAK!', 'streak');
        else showCelebration('✓ WIN SECURED', 'win');

        // Check if turf changed
        const court = state.courts.find(c => c.id === m.court_id);
        if (court && court.holding_crew_id === state.activeCrewId) {
          setTimeout(() => showCelebration(`🏴 TURF CLAIMED — ${court.name}`, 'turf'), 1800);
        }
      }
    });
  }

  function showCelebration(msg, type) {
    const el = document.createElement('div');
    el.className = 'celebration';
    el.dataset.type = type;
    el.innerHTML = `<div class="celebration-inner">${msg}</div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 500); }, 3500);
  }

  // ── SHELL ──
  function renderShell(content) {
    const crew = state.myCrews.find(c => c.id === state.activeCrewId);
    return `
      <div class="app-shell">
        <div class="top-bar">
          <span class="top-bar-title">The Street</span>
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="top-bar-user">${state.user?.username || ''}</span>
            <button class="logout-btn" id="btn-logout">LEAVE THE STREET</button>
          </div>
        </div>
        <div class="main-content" id="main-content">
          ${content}
        </div>
        <nav class="bottom-nav">
          <button class="nav-btn ${state.view === 'home' ? 'active' : ''}" data-nav="home">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
            HOME
          </button>
          <button class="nav-btn ${state.view === 'wire' ? 'active' : ''}" data-nav="wire">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8 19.79 19.79 0 01.22 1.18 2 2 0 012.18 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.08 6.08l1.08-1.08a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
            WIRE
          </button>
          <button class="nav-btn ${state.view === 'crews' || state.view === 'create-crew' || state.view === 'crew-detail' || state.view === 'crew-profile' ? 'active' : ''}" data-nav="crews">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
            CREWS
          </button>
          <button class="nav-btn ${state.view === 'matches' || state.view === 'callout' ? 'active' : ''}" data-nav="matches">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            CALL-OUT
          </button>
          <button class="nav-btn ${state.view === 'map' ? 'active' : ''}" data-nav="map">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
            MAP
          </button>
          <button class="nav-btn ${state.view === 'profile' ? 'active' : ''}" data-nav="profile">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            PROFILE
          </button>
        </nav>
      </div>
    `;
  }

  function bindShell() {
    // Measure fixed bars and pad content so nothing is hidden underneath
    requestAnimationFrame(() => {
      const topBar = document.querySelector('.top-bar');
      const bottomNav = document.querySelector('.bottom-nav');
      const content = document.getElementById('main-content');
      if (content && topBar && bottomNav) {
        content.style.paddingTop = (topBar.offsetHeight + 12) + 'px';
        content.style.paddingBottom = (bottomNav.offsetHeight + 12) + 'px';
      }
    });

    document.getElementById('btn-logout').addEventListener('click', async () => {
      await api('POST', '/api/auth/logout');
      state.user = null;
      state.myCrews = [];
      state.activeCrewId = null;
      state.matches = [];
      show('login');
    });

    document.querySelectorAll('.nav-btn[data-nav]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const nav = btn.dataset.nav;
        await loadAppData();
        show(nav);
      });
    });
  }

  // ── HOME VIEW ──
  function renderHome() {
    const crew = state.myCrews.find(c => c.id === state.activeCrewId);
    const pending = state.matches.filter(m => m.status === 'negotiating' && m.defender_crew_id === state.activeCrewId);
    const active = state.matches.filter(m => ['locked','active','disputed'].includes(m.status));
    const recent = state.matches.filter(m => m.status === 'resolved').slice(0, 3);

    if (!crew) {
      return `
        <div class="empty-state">
          YOU'RE ON THE STREET<br>BUT YOU GOT NO CREW.<br>
          <br>
          <button class="btn btn-volt" onclick="App.nav('crews')">BUILD YOUR CREW →</button>
        </div>
      `;
    }

    const [tierLabel, tierClass] = crewTier(crew.reputation_score);

    return `
      <div class="section-head">YOUR CREW</div>
      <div class="card" style="border-left: 3px solid ${crew.map_color_hex}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <div class="card-title">${crew.name}</div>
            <div class="card-sub">${crew.sport_type} · ${crew.age_class} · ${crew.gender_class}</div>
          </div>
          <span class="tier-badge ${tierClass}">${tierLabel}</span>
        </div>
        <div style="margin-top:12px;display:flex;gap:16px;flex-wrap:wrap;">
          <div>
            <div style="font-size:10px;color:var(--muted);font-family:'Big Shoulders Display',sans-serif;letter-spacing:0.1em;text-transform:uppercase;">Coins</div>
            <div class="coins-display">⚡ ${crew.coin_balance}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--muted);font-family:'Big Shoulders Display',sans-serif;letter-spacing:0.1em;text-transform:uppercase;">Rep</div>
            <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:14px;">${crew.reputation_score}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--muted);font-family:'Big Shoulders Display',sans-serif;letter-spacing:0.1em;text-transform:uppercase;">Streak</div>
            <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:14px;color:var(--amber);">🔥 ${crew.current_win_streak}</div>
          </div>
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;">
          <button class="btn btn-volt btn-sm" onclick="App.viewCrewProfile(${crew.id})">VIEW PROFILE</button>
          <button class="btn btn-outline btn-sm" onclick="App.viewCrew(${crew.id})">MANAGE</button>
          <button class="btn btn-outline btn-sm" onclick="App.nav('quests')">QUESTS</button>
        </div>
      </div>

      ${pending.length > 0 ? `
        <div class="section-head">⚡ INCOMING CALL-OUTS (${pending.length})</div>
        ${pending.map(m => matchCard(m, true)).join('')}
      ` : ''}

      ${active.length > 0 ? `
        <div class="section-head">ACTIVE MATCHES</div>
        ${active.map(m => matchCard(m, false)).join('')}
      ` : ''}

      ${recent.length > 0 ? `
        <div class="section-head">RECENT RESULTS</div>
        ${recent.map(m => matchCard(m, false)).join('')}
      ` : ''}

      ${pending.length === 0 && active.length === 0 && recent.length === 0 ? `
        <div class="empty-state">NO MATCHES YET.<br>HEAD TO CALL-OUT TO START SOME SMOKE.</div>
      ` : ''}

      <div class="section-head" style="margin-top:20px;">THE STREET</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px;">
        <div class="card" style="cursor:pointer;border:1px solid rgba(68,255,34,0.3);text-align:center;padding:20px 12px;" onclick="App.navTurfWars()">
          <div style="font-size:24px;margin-bottom:6px;">🏆</div>
          <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:13px;letter-spacing:0.1em;color:var(--volt);">TURF WARS</div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px;">Tournaments</div>
        </div>
        <div class="card" style="cursor:pointer;border:1px solid rgba(68,255,34,0.3);text-align:center;padding:20px 12px;" onclick="App.navStore()">
          <div style="font-size:24px;margin-bottom:6px;">🛒</div>
          <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:13px;letter-spacing:0.1em;color:var(--volt);">THE STORE</div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px;">Spend your coins</div>
        </div>
      </div>
    `;
  }

  function matchCard(m, showActions) {
    const statusColors = {
      negotiating: 'tag-amber',
      locked: 'tag-volt',
      active: 'tag-volt',
      disputed: 'tag-red',
      resolved: 'tag-green',
      voided: 'tag-muted',
    };

    const isWinner = m.winner_crew_id === state.activeCrewId;
    const displayVs = m.format_type === '1v1'
      ? `${m.challenger_name} <span class="vs-sep">VS</span> ${m.defender_name}`
      : `${m.challenger_name} <span class="vs-sep">VS</span> ${m.defender_name}`;

    return `
      <div class="match-card" data-match-id="${m.id}">
        <div class="match-vs">${displayVs}</div>
        <div class="match-meta">
          <span class="tag ${statusColors[m.status] || 'tag-muted'}">${m.status.toUpperCase()}</span>
          <span class="tag tag-muted">${m.format_type}</span>
          <span class="tag tag-muted">${m.court_name || 'Court'}</span>
          ${m.wager_amount > 0 ? `<span class="tag tag-volt">⚡ ${m.wager_amount} WAGER</span>` : ''}
          ${m.status === 'resolved' ? `<span class="tag ${isWinner ? 'tag-green' : 'tag-red'}">${isWinner ? 'WIN' : 'LOSS'}</span>` : ''}
        </div>
        ${m.x_message ? `
          <div style="margin-top:8px;font-size:11px;color:var(--muted);font-style:italic;border-top:1px solid var(--border);padding-top:6px;">${m.x_message}</div>
        ` : ''}
        ${showActions ? `
          <div style="margin-top:10px;display:flex;gap:8px;">
            <button class="btn btn-volt btn-sm" onclick="App.openAcceptModal(${m.id})">ACCEPT</button>
            <button class="btn btn-outline btn-sm" onclick="App.declineMatch(${m.id})">DECLINE</button>
          </div>
        ` : ''}
        ${m.status === 'locked' || m.status === 'active' || m.status === 'disputed' ? `
          <div style="margin-top:10px;">
            <button class="btn btn-outline btn-sm" onclick="App.openScoreModal(${m.id})">REPORT SCORE</button>
          </div>
        ` : ''}
        <div style="margin-top:8px;">
          <button class="btn btn-outline btn-sm" style="font-size:10px;padding:3px 8px;" onclick="App.navMatchDetail(${m.id})">VIEW DETAILS →</button>
        </div>
      </div>
    `;
  }

  function bindHome() {
    // matchCard actions bound via onclick= on elements — handled by App.* methods exposed below
  }

  // ── CREWS VIEW ──
  function renderCrews() {
    return `
      <div class="section-head">MY CREWS</div>
      ${state.myCrews.length === 0 ? `<div class="empty-state">NO CREW YET.<br>BUILD YOUR FIRST ONE.</div>` : ''}
      ${state.myCrews.map(c => {
        const [tierLabel, tierClass] = crewTier(c.reputation_score);
        return `
          <div class="card" style="border-left:3px solid ${c.map_color_hex};">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
              <div>
                <div class="card-title">${c.name}</div>
                <div class="card-sub">${c.sport_type} · ${c.age_class}</div>
              </div>
              <span class="tier-badge ${tierClass}">${tierLabel}</span>
            </div>
            <div style="margin-top:10px;display:flex;gap:12px;align-items:center;">
              <span class="coins-display">⚡ ${c.coin_balance}</span>
              <span style="font-family:'Big Shoulders Display',sans-serif;font-size:13px;color:var(--muted);">REP: ${c.reputation_score}</span>
            </div>
            <div style="margin-top:10px;display:flex;gap:8px;">
              <button class="btn btn-outline btn-sm" onclick="App.viewCrewProfile(${c.id})">VIEW PROFILE</button>
              <button class="btn btn-volt btn-sm" onclick="App.viewCrew(${c.id})">MANAGE</button>
            </div>
          </div>
        `;
      }).join('')}
      <button class="btn btn-volt btn-full" style="margin-top:8px;" id="btn-create-crew">+ CREATE NEW CREW</button>

      <div class="section-head" style="margin-top:24px;">FIND A CREW</div>
      <div class="form-field">
        <input class="form-input" id="crew-search-input" type="text" placeholder="SEARCH BY NAME..."
          autocomplete="off" oninput="App.searchCrewsTab(this.value)">
      </div>
      <div id="crew-search-tab-results"></div>
    `;
  }

  function bindCrews() {
    document.getElementById('btn-create-crew')?.addEventListener('click', () => show('create-crew'));
  }

  // ── CREATE CREW ──
  function renderCreateCrew() {
    const colors = ['#44FF22','#FF3B3B','#3B9EFF','#FF8C00','#B44FFF','#00E5FF','#FF69B4'];
    return `
      <div class="section-head">BUILD YOUR CREW</div>
      <div id="crew-error" class="msg-error" style="display:none"></div>
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div class="form-field">
          <label class="form-label">Crew Name</label>
          <input class="form-input" id="cc-name" type="text" placeholder="BLOCK BURNERS">
        </div>
        <div class="form-field">
          <label class="form-label">Sport</label>
          <select class="form-select" id="cc-sport">
            <option value="Basketball">Basketball</option>
            <option value="Soccer">Soccer</option>
            <option value="Football">Football</option>
            <option value="Handball">Handball</option>
            <option value="Tennis">Tennis</option>
            <option value="Volleyball">Volleyball</option>
          </select>
        </div>
        <div class="form-field">
          <label class="form-label">Age Class</label>
          <select class="form-select" id="cc-age">
            <option value="Adult">Adult (18+)</option>
            <option value="U18">U18 (Under 18)</option>
            <option value="U14">U14 (Under 14)</option>
          </select>
        </div>
        <div class="form-field">
          <label class="form-label">Gender Class</label>
          <select class="form-select" id="cc-gender">
            <option value="Open">Open</option>
            <option value="Coed">Coed</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>
        <div class="form-field">
          <label class="form-label">Map Color</label>
          <div style="display:flex;gap:10px;flex-wrap:wrap;" id="color-picker">
            ${colors.map(c => `
              <div onclick="App.selectColor('${c}')" data-color="${c}"
                style="width:32px;height:32px;border-radius:50%;background:${c};cursor:pointer;border:3px solid transparent;transition:border-color 0.15s;"
                class="color-swatch ${c === '#44FF22' ? 'selected' : ''}">
              </div>
            `).join('')}
          </div>
        </div>
        <button class="btn btn-volt btn-full" id="btn-submit-crew">BUILD THIS CREW</button>
        <button class="btn btn-outline btn-full" onclick="App.nav('crews')">CANCEL</button>
      </div>
    `;
  }

  let selectedColor = '#44FF22';
  function bindCreateCrew() {
    selectedColor = '#44FF22';
    document.querySelectorAll('.color-swatch').forEach(s => {
      if (s.dataset.color === selectedColor) s.style.borderColor = '#fff';
    });

    document.getElementById('btn-submit-crew').addEventListener('click', async () => {
      const errEl = document.getElementById('crew-error');
      errEl.style.display = 'none';
      const name = document.getElementById('cc-name').value.trim();
      const sport_type = document.getElementById('cc-sport').value;
      const age_class = document.getElementById('cc-age').value;
      const gender_class = document.getElementById('cc-gender').value;

      if (!name) { errEl.textContent = 'Give your crew a name.'; errEl.style.display = 'block'; return; }

      try {
        const res = await api('POST', '/api/crews', { name, sport_type, age_class, gender_class, map_color_hex: selectedColor });
        state.myCrews.push(res.crew);
        state.activeCrewId = res.crew.id;
        toast(`${name} IS NOW ON THE STREET 🔥`);
        show('crews');
      } catch (e) {
        errEl.textContent = e.message;
        errEl.style.display = 'block';
      }
    });
  }

  // ── CREW DETAIL ──
  let crewDetailData = null;
  function renderCrewDetail() {
    if (!crewDetailData) return '<div class="empty-state">LOADING...</div>';
    const { crew, roster } = crewDetailData;
    const [tierLabel, tierClass] = crewTier(crew.reputation_score);
    const isMyBoss = state.user && crew.boss_id === state.user.id;

    // Turf held
    const turfCourts = state.courts.filter(c => c.holding_crew_id === crew.id);

    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
        <div style="width:14px;height:14px;border-radius:50%;background:${crew.map_color_hex};flex-shrink:0;"></div>
        <div>
          <div style="font-family:'Big Shoulders Display',sans-serif;font-size:22px;font-weight:900;letter-spacing:0.05em;">${crew.name}</div>
          <div style="font-size:12px;color:var(--muted);">${crew.sport_type} · ${crew.age_class} · ${crew.gender_class}</div>
        </div>
      </div>

      <div class="card">
        <div class="stat-row"><span class="stat-label">Tier</span><span class="tier-badge ${tierClass}">${tierLabel}</span></div>
        <div class="stat-row"><span class="stat-label">Coins</span><span class="stat-value coins-display">⚡ ${crew.coin_balance}</span></div>
        <div class="stat-row"><span class="stat-label">Reputation</span><span class="stat-value">${crew.reputation_score}</span></div>
        <div class="stat-row"><span class="stat-label">Win Streak</span><span class="stat-value" style="color:var(--amber)">🔥 ${crew.current_win_streak}</span></div>
        <div class="stat-row"><span class="stat-label">Boss</span><span class="stat-value">${crew.boss_username}</span></div>
      </div>

      <div class="section-head">TURF HELD</div>
      ${turfCourts.length ? turfCourts.map(c => `
        <div class="card">
          <div class="card-title">${c.name}</div>
          <div class="card-sub">${c.type === 'venue' ? 'VENUE' : 'TURF'}</div>
        </div>
      `).join('') : `<div class="empty-state" style="padding:16px 0;">NO TURF HELD</div>`}

      <div class="section-head">ROSTER (${roster.length})</div>
      ${roster.map(p => `
        <div class="card" style="padding:10px 14px;margin-bottom:6px;cursor:pointer;" onclick="App.navPlayerProfile(${p.id})">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <span style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;letter-spacing:0.05em;">${p.username}</span>
              <span style="font-size:11px;color:var(--muted);margin-left:8px;">${p.wins || 0}W · ${p.losses || 0}L</span>
            </div>
            ${p.id === crew.boss_id ? `<span class="tag tag-volt">BOSS</span>` : ''}
          </div>
        </div>
      `).join('')}

      ${isMyBoss ? `
        <div class="section-head">BOSS ACTIONS</div>
        <div class="form-field" style="margin-bottom:8px;">
          <input class="form-input" id="invite-handle" placeholder="PLAYER HANDLE" autocomplete="off">
          <button class="btn btn-volt btn-full btn-sm" id="btn-invite-player" style="margin-top:6px;">INVITE BY HANDLE →</button>
        </div>
        <div id="invite-msg" style="margin-bottom:8px;"></div>
        <button class="btn btn-outline btn-full btn-sm" id="btn-gen-invite-link">GENERATE INVITE LINK</button>
        <div id="invite-link-box" style="display:none;margin-top:8px;"></div>
        <button class="btn btn-outline btn-full btn-sm" id="btn-transfer-boss" style="margin-top:6px;">TRANSFER BOSS STATUS</button>
      ` : state.user && roster.some(p => p.id === state.user.id) ? `
        <div class="section-head">MEMBER ACTIONS</div>
        <button class="btn btn-danger btn-full btn-sm" id="btn-leave-crew">LEAVE CREW</button>
      ` : ''}
    `;
  }

  function bindCrewDetail() {
    document.getElementById('btn-invite-player')?.addEventListener('click', async () => {
      const handle = document.getElementById('invite-handle').value.trim();
      const msgEl = document.getElementById('invite-msg');
      if (!handle) { msgEl.innerHTML = '<div class="msg-error">Enter a handle.</div>'; return; }
      try {
        const res = await api('POST', `/api/crews/${crewDetailData.crew.id}/invite`, { username: handle });
        msgEl.innerHTML = `<div class="msg-success">${res.invited_username} invited!</div>`;
        document.getElementById('invite-handle').value = '';
      } catch(e) { msgEl.innerHTML = `<div class="msg-error">${e.message}</div>`; }
    });

    document.getElementById('btn-gen-invite-link')?.addEventListener('click', async () => {
      try {
        const res = await api('POST', `/api/crews/${crewDetailData.crew.id}/invite-link`);
        const link = `${location.origin}/join/${res.token}`;
        const box = document.getElementById('invite-link-box');
        box.style.display = 'block';
        box.innerHTML = `
          <div style="background:var(--bg2);border:1px solid var(--volt);border-radius:4px;padding:10px;">
            <div style="font-size:10px;color:var(--muted);margin-bottom:6px;font-family:'Big Shoulders Display',sans-serif;letter-spacing:0.1em;">SHARE THIS LINK — EXPIRES IN 7 DAYS</div>
            <div style="font-size:11px;word-break:break-all;color:var(--volt);margin-bottom:8px;">${link}</div>
            <button class="btn btn-volt btn-sm btn-full" id="btn-copy-invite">COPY LINK</button>
          </div>
        `;
        document.getElementById('btn-copy-invite').addEventListener('click', () => {
          navigator.clipboard.writeText(link).then(() => toast('LINK COPIED!')).catch(() => toast(link));
        });
      } catch(e) { toast(e.message); }
    });

    document.getElementById('btn-transfer-boss')?.addEventListener('click', () => {
      const { roster } = crewDetailData;
      const others = roster.filter(p => p.id !== state.user.id);
      if (!others.length) { toast('NO OTHER PLAYERS TO TRANSFER TO'); return; }
      openTransferBossModal(others);
    });

    document.getElementById('btn-leave-crew')?.addEventListener('click', async () => {
      if (!confirm('Leave this crew? You\'ll need to be re-added by the boss.')) return;
      try {
        await api('DELETE', `/api/crews/${crewDetailData.crew.id}/roster`);
        toast('YOU LEFT THE CREW');
        await loadAppData();
        show('crews');
      } catch(e) { toast(e.message); }
    });
  }

  // ── MATCHES VIEW ──
  function renderMatches() {
    const crew = state.myCrews.find(c => c.id === state.activeCrewId);
    if (!crew) return `<div class="empty-state">BUILD A CREW FIRST.</div>`;

    const pending = state.matches.filter(m => m.status === 'negotiating');
    const active = state.matches.filter(m => ['locked','active','disputed'].includes(m.status));
    const resolved = state.matches.filter(m => ['resolved','voided'].includes(m.status));

    return `
      <div class="section-head">
        CALL-OUTS — ${crew.name}
        <button class="btn btn-volt btn-sm" style="float:right;margin-top:-4px;" onclick="App.nav('callout')">+ ISSUE CALL-OUT</button>
      </div>

      ${pending.length ? `<div style="font-family:'Big Shoulders Display',sans-serif;font-size:11px;letter-spacing:0.15em;color:var(--muted);text-transform:uppercase;margin-bottom:8px;">INCOMING (${pending.length})</div>${pending.map(m => matchCard(m, m.defender_crew_id === state.activeCrewId)).join('')}` : ''}

      ${active.length ? `<div style="font-family:'Big Shoulders Display',sans-serif;font-size:11px;letter-spacing:0.15em;color:var(--muted);text-transform:uppercase;margin-bottom:8px;margin-top:16px;">ACTIVE (${active.length})</div>${active.map(m => matchCard(m, false)).join('')}` : ''}

      ${resolved.length ? `<div style="font-family:'Big Shoulders Display',sans-serif;font-size:11px;letter-spacing:0.15em;color:var(--muted);text-transform:uppercase;margin-bottom:8px;margin-top:16px;">HISTORY</div>${resolved.map(m => matchCard(m, false)).join('')}` : ''}

      ${!pending.length && !active.length && !resolved.length ? `<div class="empty-state">NO CALL-OUTS YET.<br>START SOME SMOKE.</div>` : ''}
    `;
  }

  function bindMatches() {}

  // ── CALL-OUT FLOW ──
  let calloutState = {
    defenderCrewId: null,
    defenderCrewName: null,
    selectedLineup: [], // user_id[]
    roster: [],
  };

  function renderCallout() {
    const crew = state.myCrews.find(c => c.id === state.activeCrewId);
    if (!crew) return `<div class="empty-state">BUILD A CREW FIRST.</div>`;
    const publicCourts = state.courts.filter(c => c.type === 'public');

    return `
      <div class="section-head">ISSUE A CALL-OUT</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:16px;">
        Calling out as: <strong style="color:var(--volt)">${crew.name}</strong>
        <span class="coins-display" style="float:right">⚡ ${crew.coin_balance}</span>
      </div>

      <div id="callout-error" class="msg-error" style="display:none"></div>
      <div id="callout-success" class="msg-success" style="display:none"></div>

      <div style="display:flex;flex-direction:column;gap:16px;">

        <!-- STEP 1: Pick opponent -->
        <div class="form-field">
          <label class="form-label">① WHO YOU CALLING OUT?</label>
          <input class="form-input" id="co-search" type="text" placeholder="SEARCH CREW NAME..."
            autocomplete="off" oninput="App.searchCrews(this.value)">
          <div id="co-search-results" style="margin-top:4px;"></div>
          <div id="co-defender-chosen" style="display:none;margin-top:8px;" class="card" style="padding:10px;">
          </div>
        </div>

        <!-- STEP 2: Court -->
        <div class="form-field">
          <label class="form-label">② TURF</label>
          <select class="form-select" id="co-court">
            ${publicCourts.map(c => `
              <option value="${c.id}">${c.name}${c.holder_name ? ` · held by ${c.holder_name}` : ' · up for grabs'}</option>
            `).join('')}
          </select>
        </div>

        <!-- STEP 3: Format -->
        <div class="form-field">
          <label class="form-label">③ FORMAT</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;" id="format-picker">
            ${['1v1','2v2','3v3','4v4','5v5'].map(f => `
              <button class="format-btn ${f === '3v3' ? 'active' : ''}" data-format="${f}"
                onclick="App.pickFormat('${f}')">${f}</button>
            `).join('')}
          </div>
        </div>

        <!-- STEP 4: Lineup -->
        <div class="form-field">
          <label class="form-label">④ YOUR LINEUP <span id="lineup-count" style="color:var(--muted);font-weight:400;font-size:10px;">(pick 3)</span></label>
          <div id="lineup-picker" style="display:flex;flex-direction:column;gap:6px;"></div>
        </div>

        <!-- STEP 5: Wager -->
        <div class="form-field">
          <label class="form-label">⑤ WAGER (COINS)</label>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="btn btn-outline btn-sm" onclick="App.adjustWager(-25)">−25</button>
            <input class="form-input" id="co-wager" type="number" value="0" min="0"
              max="${crew.coin_balance}" style="text-align:center;font-size:18px;font-weight:900;font-family:'Big Shoulders Display',sans-serif;">
            <button class="btn btn-outline btn-sm" onclick="App.adjustWager(25)">+25</button>
          </div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px;">Max: <span style="color:var(--volt)">⚡ ${crew.coin_balance}</span> · 10% rake on winnings</div>
        </div>

        <!-- STEP 6: Time -->
        <div class="form-field">
          <label class="form-label">⑥ WHEN</label>
          <input class="form-input" id="co-time" type="datetime-local">
        </div>

        <button class="btn btn-volt btn-full" id="btn-send-callout" style="margin-top:4px;">⚡ SEND THE SMOKE</button>
        <button class="btn btn-outline btn-full" onclick="App.nav('matches')">CANCEL</button>
      </div>
    `;
  }

  function bindCallout() {
    calloutState = { defenderCrewId: null, defenderCrewName: null, selectedLineup: [], roster: [] };

    // Load roster for lineup picker
    api('GET', `/api/crews/${state.activeCrewId}`)
      .then(res => {
        calloutState.roster = res.roster;
        renderLineupPicker();
      });

    // Set default format
    calloutState.format = '3v3';

    document.getElementById('btn-send-callout').addEventListener('click', async () => {
      const errEl = document.getElementById('callout-error');
      const sucEl = document.getElementById('callout-success');
      errEl.style.display = 'none';
      sucEl.style.display = 'none';

      if (!calloutState.defenderCrewId) {
        errEl.textContent = 'Search and select a crew to call out.';
        errEl.style.display = 'block'; return;
      }

      const formatCount = parseInt(calloutState.format.split('v')[0]);
      if (calloutState.selectedLineup.length !== formatCount) {
        errEl.textContent = `Pick exactly ${formatCount} player${formatCount > 1 ? 's' : ''} for your lineup.`;
        errEl.style.display = 'block'; return;
      }

      const court_id = parseInt(document.getElementById('co-court').value);
      const wager_amount = parseInt(document.getElementById('co-wager').value) || 0;
      const scheduled_time = document.getElementById('co-time').value || null;

      try {
        await api('POST', '/api/matches', {
          challenger_crew_id: state.activeCrewId,
          defender_crew_id: calloutState.defenderCrewId,
          court_id,
          format_type: calloutState.format,
          wager_amount,
          scheduled_time,
          lineup_user_ids: calloutState.selectedLineup,
        });
        sucEl.textContent = `⚡ CALL-OUT SENT TO ${calloutState.defenderCrewName.toUpperCase()}. SMOKE IS IN THE AIR.`;
        sucEl.style.display = 'block';
        toast('CALL-OUT SENT ⚡');
        await loadAppData();
        // Reset form
        calloutState.defenderCrewId = null;
        calloutState.selectedLineup = [];
        document.getElementById('co-search').value = '';
        document.getElementById('co-defender-chosen').style.display = 'none';
        document.getElementById('co-wager').value = '0';
        renderLineupPicker();
      } catch (e) {
        errEl.textContent = e.message;
        errEl.style.display = 'block';
      }
    });
  }

  function renderLineupPicker() {
    const el = document.getElementById('lineup-picker');
    const countEl = document.getElementById('lineup-count');
    if (!el) return;
    const formatCount = parseInt((calloutState.format || '3v3').split('v')[0]);
    if (countEl) countEl.textContent = `(pick ${formatCount})`;

    el.innerHTML = calloutState.roster.map(p => {
      const selected = calloutState.selectedLineup.includes(p.id);
      return `
        <div class="lineup-player ${selected ? 'selected' : ''}" onclick="App.toggleLineup(${p.id})"
          style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;
            background:${selected ? 'rgba(68,255,34,0.1)' : 'rgba(255,255,255,0.03)'};
            border:1px solid ${selected ? 'var(--volt)' : 'var(--border)'};
            border-radius:4px;cursor:pointer;transition:all 0.15s;">
          <span style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;letter-spacing:0.05em;">
            ${p.username}
          </span>
          <span style="font-size:18px;">${selected ? '✓' : '○'}</span>
        </div>
      `;
    }).join('') || `<div style="font-size:12px;color:var(--muted);">No other players on your roster yet.</div>`;
  }

  // ── THE WIRE ──
  let wireData = { upcoming: [], recent: [] };

  function renderWire() {
    const { upcoming, recent } = wireData;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <div class="section-head" style="margin:0;border:none;">THE WIRE</div>
        <button class="btn btn-outline btn-sm" onclick="App.refreshWire()">↻ REFRESH</button>
      </div>

      ${upcoming.length ? `
        <div class="section-head">UPCOMING</div>
        ${upcoming.map(m => wireCard(m, true)).join('')}
      ` : ''}

      ${recent.length ? `
        <div class="section-head" style="margin-top:20px;">RECENT RESULTS</div>
        ${recent.map(m => wireCard(m, false)).join('')}
      ` : ''}

      ${!upcoming.length && !recent.length ? `
        <div class="empty-state">
          THE WIRE IS QUIET.<br>NO SMOKE YET.<br><br>
          <button class="btn btn-volt" onclick="App.nav('callout')">START SOMETHING →</button>
        </div>
      ` : ''}
    `;
  }

  function wireCard(m, isUpcoming) {
    const vsLine = `<span style="color:${m.challenger_color || 'var(--volt)'}">●</span> ${m.challenger_name} <span class="vs-sep">VS</span> <span style="color:${m.defender_color || 'var(--muted)'}">●</span> ${m.defender_name}`;
    const statusColors = { negotiating:'tag-amber', locked:'tag-volt', active:'tag-volt', disputed:'tag-red', resolved:'tag-green', voided:'tag-muted' };

    let timeLabel = '';
    if (m.scheduled_time) {
      const d = new Date(m.scheduled_time);
      const now = new Date();
      const diffH = (d - now) / 3600000;
      if (diffH < 0) timeLabel = '';
      else if (diffH < 1) timeLabel = `<span style="color:var(--volt);font-weight:900;">TONIGHT — ${d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</span>`;
      else if (diffH < 24) timeLabel = `Today ${d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`;
      else timeLabel = d.toLocaleDateString([],{month:'short',day:'numeric'}) + ' · ' + d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
    }

    return `
      <div class="wire-card">
        <div class="match-vs" style="font-size:15px;">${vsLine}</div>
        <div style="font-size:11px;color:var(--muted);margin:4px 0 8px;">
          ${m.court_name || 'Unknown court'} · ${m.format_type}
          ${m.wager_amount > 0 ? ` · <span style="color:var(--volt)">⚡ ${m.wager_amount} ON THE LINE</span>` : ''}
          ${timeLabel ? ` · ${timeLabel}` : ''}
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <span class="tag ${statusColors[m.status] || 'tag-muted'}">${m.status.toUpperCase()}</span>
            ${m.status === 'resolved' && m.winner_name ? `<span class="tag tag-green">W: ${m.winner_name}</span>` : ''}
            ${m.status === 'voided' ? `<span class="tag tag-muted">VOIDED</span>` : ''}
          </div>
          ${isUpcoming ? `
            <button class="hype-btn" onclick="App.hype(${m.id}, this)">
              🔥 <span class="hype-count">${m.hype_count || 0}</span>
            </button>
          ` : `<span style="color:var(--muted);font-size:11px;">🔥 ${m.hype_count || 0}</span>`}
        </div>
        ${m.x_message ? `
          <div style="margin-top:6px;font-size:11px;color:var(--muted);font-style:italic;border-top:1px solid var(--border);padding-top:6px;">${m.x_message}</div>
        ` : ''}
        <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm" style="font-size:10px;" onclick="App.navMatchDetail(${m.id})">VIEW MATCH →</button>
          <button class="btn btn-outline btn-sm" style="font-size:10px;" onclick="App.viewCrewProfile(${m.challenger_crew_id})">${m.challenger_name}</button>
          <button class="btn btn-outline btn-sm" style="font-size:10px;" onclick="App.viewCrewProfile(${m.defender_crew_id})">${m.defender_name}</button>
        </div>
      </div>
    `;
  }

  function bindWire() {
    // Refresh wire data on each navigation to wire
    fetch('/api/wire').then(r => r.json()).then(d => {
      wireData = d;
      const el = document.getElementById('main-content');
      if (el && state.view === 'wire') el.innerHTML = renderWire();
      bindWireContent();
    }).catch(() => {});
  }

  function bindWireContent() {}

  // ── MAP VIEW ──
  let mapInstance = null;

  function renderMap() {
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div class="section-head" style="margin:0;border:none;">THE BLOCK — TURF MAP</div>
        <button class="btn btn-outline btn-sm" id="btn-add-turf">📍 ADD A TURF</button>
      </div>
      <div id="map-container" style="width:100%;height:calc(100vh - 160px);border-radius:6px;overflow:hidden;border:1px solid var(--border);"></div>
      <div style="margin-top:8px;font-size:11px;color:var(--muted);text-align:center;font-family:'Big Shoulders Display',sans-serif;letter-spacing:0.1em;text-transform:uppercase;">
        Color = holding crew · Grey = unclaimed
      </div>

      <!-- Add Turf sheet -->
      <div id="add-turf-sheet" style="display:none;position:fixed;bottom:60px;left:0;right:0;
        background:var(--bg2);border-top:2px solid var(--border);padding:18px 20px 20px;z-index:400;
        box-shadow:0 -8px 32px rgba(0,0,0,0.6);">

        <!-- Step 1: Search -->
        <div id="turf-step-search">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:14px;letter-spacing:0.1em;">FIND THE LOCATION</div>
            <button id="btn-close-turf-sheet" style="background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer;line-height:1;">✕</button>
          </div>
          <input class="form-input" id="turf-address-input" placeholder="ADDRESS OR PLACE NAME..."
            autocomplete="off" style="margin-bottom:8px;">
          <div id="turf-geocode-results"></div>
        </div>

        <!-- Step 2: Confirm + name (hidden until location chosen) -->
        <div id="turf-step-confirm" style="display:none;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:14px;letter-spacing:0.1em;">NAME YOUR TURF</div>
            <button id="btn-back-to-search" style="background:none;border:none;color:var(--muted);font-size:12px;font-family:'Big Shoulders Display',sans-serif;font-weight:700;letter-spacing:0.1em;cursor:pointer;">← BACK</button>
          </div>
          <div id="turf-location-label" style="font-size:12px;color:var(--muted);margin-bottom:10px;"></div>
          <div style="display:flex;gap:8px;">
            <input class="form-input" id="turf-name-input" placeholder="TURF NAME" style="flex:1;">
            <button class="btn btn-volt" id="btn-submit-turf">SUBMIT</button>
          </div>
          <div id="turf-submit-error" class="msg-error" style="display:none;margin-top:8px;"></div>
        </div>
      </div>
    `;
  }

  function bindMap() {
    if (mapInstance) { mapInstance.remove(); mapInstance = null; }
    let droppedPin = null;
    let chosenLatLng = null;
    let geocodeDebounce = null;

    const greenPinIcon = () => L.divIcon({
      className: '',
      html: `<div style="width:22px;height:22px;border-radius:50%;background:#44FF22;border:3px solid #fff;box-shadow:0 0 14px rgba(68,255,34,0.9);"></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });

    fetch('/api/map/courts')
      .then(r => r.json())
      .then(({ courts }) => {
        const el = document.getElementById('map-container');
        if (!el) return;

        const fallback = courts.length
          ? [courts[0].latitude, courts[0].longitude]
          : [40.7305, -74.002];

        mapInstance = L.map('map-container', { zoomControl: true }).setView(fallback, 13);

        // Try to center on user's location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude, longitude } = pos.coords;
              mapInstance.setView([latitude, longitude], 14);
            },
            () => {} // denied or unavailable — stay on fallback
          );
        }

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '© OpenStreetMap © CartoDB',
          subdomains: 'abcd', maxZoom: 19,
        }).addTo(mapInstance);

        courts.forEach(court => {
          const color = court.holder_color || '#555';
          const isHeld = !!court.holding_crew_id;
          const marker = L.circleMarker([court.latitude, court.longitude], {
            radius: court.type === 'venue' ? 10 : 8,
            fillColor: color,
            color: isHeld ? '#fff' : '#444',
            weight: isHeld ? 2 : 1,
            opacity: 1,
            fillOpacity: isHeld ? 0.9 : 0.4,
          }).addTo(mapInstance);

          marker.bindPopup(`
            <div style="font-family:'Big Shoulders Display',sans-serif;min-width:160px;">
              <div style="font-weight:900;font-size:14px;margin-bottom:4px;">${court.name}</div>
              <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.1em;">${court.type === 'venue' ? (court.venue_name || 'VENUE') : 'TURF'}</div>
              <div style="margin-top:6px;font-size:12px;">
                ${isHeld ? `<span style="color:${color};font-weight:900;">● ${court.holder_name}</span> holds this turf` : '<span style="color:#aaa;">Up for grabs</span>'}
              </div>
              ${court.holder_decline_count > 0 ? `<div style="font-size:11px;color:#f5a623;margin-top:4px;">${court.holder_decline_count}/3 declines</div>` : ''}
              <div style="margin-top:8px;">
                <button onclick="App.navCourtHistory(${court.id})" style="background:transparent;border:1px solid #44FF22;color:#44FF22;font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:11px;padding:3px 8px;cursor:pointer;letter-spacing:0.1em;">HISTORY →</button>
              </div>
            </div>
          `, { className: 'street-popup' });
        });

        // ── ADD TURF SHEET ──
        function openSheet() {
          document.getElementById('add-turf-sheet').style.display = 'block';
          document.getElementById('turf-step-search').style.display = 'block';
          document.getElementById('turf-step-confirm').style.display = 'none';
          document.getElementById('turf-address-input').value = '';
          document.getElementById('turf-geocode-results').innerHTML = '';
          setTimeout(() => document.getElementById('turf-address-input')?.focus(), 100);
        }

        function closeSheet() {
          document.getElementById('add-turf-sheet').style.display = 'none';
          if (droppedPin) { mapInstance.removeLayer(droppedPin); droppedPin = null; }
          chosenLatLng = null;
        }

        document.getElementById('btn-add-turf').addEventListener('click', openSheet);
        document.getElementById('btn-close-turf-sheet').addEventListener('click', closeSheet);

        // Back to search step
        document.getElementById('btn-back-to-search').addEventListener('click', () => {
          document.getElementById('turf-step-search').style.display = 'block';
          document.getElementById('turf-step-confirm').style.display = 'none';
          if (droppedPin) { mapInstance.removeLayer(droppedPin); droppedPin = null; }
          chosenLatLng = null;
        });

        // Geocode search via Nominatim
        document.getElementById('turf-address-input').addEventListener('input', (e) => {
          clearTimeout(geocodeDebounce);
          const q = e.target.value.trim();
          const resultsEl = document.getElementById('turf-geocode-results');
          if (q.length < 3) { resultsEl.innerHTML = ''; return; }

          resultsEl.innerHTML = `<div style="font-size:11px;color:var(--muted);padding:8px 0;">Searching...</div>`;

          geocodeDebounce = setTimeout(async () => {
            try {
              const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`,
                { headers: { 'Accept-Language': 'en', 'User-Agent': 'TheStreetApp/1.0' } }
              );
              const results = await res.json();
              if (!results.length) {
                resultsEl.innerHTML = `<div style="font-size:12px;color:var(--muted);padding:8px 0;">No results found.</div>`;
                return;
              }
              resultsEl.innerHTML = results.map((r, i) => `
                <div data-idx="${i}" style="padding:10px 12px;border:1px solid var(--border);border-radius:4px;
                  margin-top:6px;cursor:pointer;background:rgba(255,255,255,0.03);">
                  <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:13px;">${r.display_name.split(',')[0]}</div>
                  <div style="font-size:11px;color:var(--muted);margin-top:2px;">${r.display_name.split(',').slice(1,3).join(',').trim()}</div>
                </div>
              `).join('');

              // Store results for click handler
              resultsEl._geocodeResults = results;

              resultsEl.querySelectorAll('[data-idx]').forEach(el => {
                el.addEventListener('click', () => {
                  const r = resultsEl._geocodeResults[parseInt(el.dataset.idx)];
                  chosenLatLng = { lat: parseFloat(r.lat), lng: parseFloat(r.lon) };

                  // Drop pin and pan map
                  if (droppedPin) mapInstance.removeLayer(droppedPin);
                  droppedPin = L.marker([chosenLatLng.lat, chosenLatLng.lng], { icon: greenPinIcon() }).addTo(mapInstance);
                  mapInstance.flyTo([chosenLatLng.lat, chosenLatLng.lng], 17, { duration: 1 });

                  // Pre-fill turf name with the place name
                  const placeName = r.display_name.split(',')[0];
                  document.getElementById('turf-name-input').value = placeName;
                  document.getElementById('turf-location-label').textContent =
                    r.display_name.split(',').slice(0, 3).join(',');

                  // Move to confirm step
                  document.getElementById('turf-step-search').style.display = 'none';
                  document.getElementById('turf-step-confirm').style.display = 'block';
                  document.getElementById('turf-submit-error').style.display = 'none';
                  setTimeout(() => {
                    const ni = document.getElementById('turf-name-input');
                    ni?.focus(); ni?.select();
                  }, 100);
                });
              });
            } catch(e) {
              resultsEl.innerHTML = `<div style="font-size:12px;color:var(--red);padding:8px 0;">Search failed. Check your connection.</div>`;
            }
          }, 400);
        });

        // Submit
        document.getElementById('btn-submit-turf').addEventListener('click', async () => {
          const crew = state.myCrews.find(c => c.id === state.activeCrewId);
          if (!crew) { toast('SELECT A CREW FIRST'); return; }
          if (!chosenLatLng) return;

          const name = document.getElementById('turf-name-input').value.trim();
          const errEl = document.getElementById('turf-submit-error');
          errEl.style.display = 'none';

          if (!name) { errEl.textContent = 'Give this turf a name.'; errEl.style.display = 'block'; return; }

          // Get device GPS for proximity check
          let client_latitude = null, client_longitude = null;
          try {
            const pos = await new Promise((resolve, reject) =>
              navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
            );
            client_latitude = pos.coords.latitude;
            client_longitude = pos.coords.longitude;
          } catch (_) {
            // GPS unavailable or denied — server will skip the check
          }

          try {
            const res = await api('POST', '/api/courts/submit', {
              name,
              latitude: chosenLatLng.lat,
              longitude: chosenLatLng.lng,
              crew_id: crew.id,
              client_latitude,
              client_longitude,
            });
            toast(`📍 ${name} SUBMITTED — ⚡ ${res.fee_paid} COINS SPENT`);
            closeSheet();
            // Mark pin as pending
            if (droppedPin) {
              droppedPin.setIcon(L.divIcon({
                className: '',
                html: `<div style="width:16px;height:16px;border-radius:50%;background:#555;border:2px solid #888;"></div>`,
                iconSize: [16,16], iconAnchor: [8,8],
              }));
              droppedPin.bindPopup(`<div style="font-family:'Big Shoulders Display',sans-serif;"><strong>${name}</strong><br><span style="color:#aaa;font-size:11px;">PENDING REVIEW</span></div>`, { className: 'street-popup' }).openPopup();
              droppedPin = null;
            }
            await loadAppData();
          } catch(e) {
            errEl.textContent = e.message;
            errEl.style.display = 'block';
          }
        });
      })
      .catch(() => {
        const el = document.getElementById('map-container');
        if (el) el.innerHTML = `<div class="empty-state">COULDN'T LOAD THE MAP.</div>`;
      });
  }

  // ── QUESTS VIEW ──
  let questsData = [];

  function renderQuests() {
    const crew = state.myCrews.find(c => c.id === state.activeCrewId);
    if (!crew) return `<div class="empty-state">BUILD A CREW TO SEE QUESTS.</div>`;

    const crewPicker = state.myCrews.length > 1 ? `
      <select id="quests-crew-select" class="form-select" style="margin-bottom:12px;">
        ${state.myCrews.map(c => `<option value="${c.id}" ${c.id === state.activeCrewId ? 'selected' : ''}>${c.name}</option>`).join('')}
      </select>
    ` : '';

    return `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
        <div class="section-head" style="margin:0;border:none;">QUESTS</div>
        <span class="coins-display">⚡ ${crew.coin_balance}</span>
      </div>
      ${crewPicker}
      <div style="font-size:11px;color:var(--muted);margin-bottom:16px;">Complete objectives, earn coins.</div>

      <div id="quests-error" class="msg-error" style="display:none"></div>
      <div id="quests-success" class="msg-success" style="display:none"></div>

      <div class="section-head">DAILY</div>
      ${questsData.filter(q => q.cadence === 'daily').map(q => questCard(q, crew.id)).join('') || '<div class="empty-state" style="padding:12px 0;">No daily quests active.</div>'}

      <div class="section-head">WEEKLY</div>
      ${questsData.filter(q => q.cadence === 'weekly').map(q => questCard(q, crew.id)).join('') || '<div class="empty-state" style="padding:12px 0;">No weekly quests active.</div>'}
    `;
  }

  function questCard(q, crewId) {
    const pct = Math.min(100, Math.round((q.progress_count / q.requirement_count) * 100));
    const done = !!q.completed_at;
    const claimed = !!q.claimed;

    return `
      <div class="card" style="margin-bottom:10px;${done && !claimed ? 'border-color:var(--volt);' : ''}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
          <div>
            <div class="card-title" style="font-size:14px;">${q.name}</div>
            <div class="card-sub">${q.description}</div>
          </div>
          <span class="coins-display" style="flex-shrink:0;margin-left:8px;">⚡ ${q.coin_reward}</span>
        </div>
        <div class="quest-bar-wrap">
          <div class="quest-bar-fill" style="width:${pct}%"></div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
          <span style="font-size:11px;color:var(--muted);">
            ${q.progress_count} / ${q.requirement_count}
            ${!claimed && !done ? ` · ${q.cadence === 'daily' ? 'Resets tomorrow' : (() => { const now = new Date(); const mon = new Date(now); mon.setDate(now.getDate() + (8 - now.getDay()) % 7 || 7); const days = Math.ceil((mon - now) / 86400000); return `Resets in ${days}d`; })()}` : ''}
          </span>
          ${claimed
            ? `<span class="tag tag-muted">CLAIMED</span>`
            : done
              ? `<button class="btn btn-volt btn-sm" onclick="App.claimQuest(${q.id}, ${crewId})">CLAIM ⚡ ${q.coin_reward}</button>`
              : `<span class="tag tag-muted">${pct}%</span>`
          }
        </div>
      </div>
    `;
  }

  function bindQuests() {
    const crew = state.myCrews.find(c => c.id === state.activeCrewId);
    if (!crew) return;
    api('GET', `/api/quests?crew_id=${crew.id}`)
      .then(res => {
        questsData = res.quests;
        const el = document.getElementById('main-content');
        if (el && state.view === 'quests') {
          el.innerHTML = renderQuests();
          bindQuestsContent();
        }
      })
      .catch(() => {});
  }

  function bindQuestsContent() {
    // Crew switcher — if user has multiple crews, let them pick which to view quests for
    document.getElementById('quests-crew-select')?.addEventListener('change', (e) => {
      state.activeCrewId = parseInt(e.target.value);
      bindQuests();
    });
  }

  // ── CREW PROFILE VIEW ──
  let crewProfileData = null;

  // ── COSMETIC HELPERS ──
  function jerseyStyle(name) {
    if (!name) return '';
    if (name.includes('Volt Runner'))  return 'border:2px solid var(--volt);box-shadow:0 0 10px rgba(68,255,34,0.25);';
    if (name.includes('Legend Gold'))  return 'border:2px solid #ffb02e;box-shadow:0 0 10px rgba(255,176,46,0.25);';
    if (name.includes('Classic White')) return 'border:2px solid rgba(240,240,240,0.4);';
    if (name.includes('Blacktop Black')) return 'border:2px solid rgba(80,80,90,0.6);';
    return '';
  }
  function tagStyleCSS(name) {
    if (!name) return '';
    if (name.includes('Graffiti')) return "font-family:'Permanent Marker',cursive;color:var(--volt);text-shadow:0 0 12px rgba(68,255,34,0.5);";
    if (name.includes('Drip'))     return "font-family:'Permanent Marker',cursive;letter-spacing:0.02em;";
    if (name.includes('Crown'))    return "font-family:'Big Shoulders Display',sans-serif;font-weight:900;letter-spacing:0.12em;";
    return '';
  }
  function tagStylePrefix(name) {
    if (name && name.includes('Crown')) return '👑 ';
    return '';
  }
  function flairBadge(name) {
    if (!name) return '';
    if (name.includes('Legend')) return `<span style="display:inline-block;padding:2px 7px;border-radius:3px;font-size:10px;font-weight:900;font-family:'Big Shoulders Display',sans-serif;letter-spacing:0.08em;background:rgba(255,176,46,0.18);color:#ffb02e;border:1px solid rgba(255,176,46,0.5);margin-left:6px;">👑 LEGEND</span>`;
    if (name.includes('OG'))     return `<span style="display:inline-block;padding:2px 7px;border-radius:3px;font-size:10px;font-weight:900;font-family:'Big Shoulders Display',sans-serif;letter-spacing:0.08em;background:rgba(255,176,46,0.10);color:#ffb02e;border:1px solid rgba(255,176,46,0.3);margin-left:6px;">OG</span>`;
    return '';
  }
  function courtBannerStyle(name) {
    if (!name) return 'border-left:3px solid var(--border);';
    if (name.includes('Volt Glow')) return 'border-left:3px solid var(--volt);box-shadow:-3px 0 10px rgba(68,255,34,0.3);';
    return 'border-left:3px solid var(--volt);';
  }

  function renderCrewProfile() {
    if (!crewProfileData) return `<div class="empty-state">LOADING...</div>`;
    const { crew, roster, turf, achievements, matchHistory, record, equipped = {} } = crewProfileData;
    const [tierLabel, tierClass] = crewTier(crew.reputation_score);
    const isRival = state.myCrews.some(c => c.id !== crew.id);

    // Head-to-head record vs my active crew
    const myId = state.activeCrewId;
    const h2h = matchHistory.filter(m =>
      (m.challenger_crew_id === myId || m.defender_crew_id === myId) &&
      m.status === 'resolved'
    );
    const h2hWins = h2h.filter(m => m.winner_crew_id === crew.id).length;
    const h2hLosses = h2h.filter(m => m.winner_crew_id !== crew.id && m.winner_crew_id !== null).length;

    const _jersey = jerseyStyle(equipped.jersey);
    const _tagCSS  = tagStyleCSS(equipped.tag_style);
    const _tagPre  = tagStylePrefix(equipped.tag_style);
    const _banner  = courtBannerStyle(equipped.court_banner);
    const _flair   = flairBadge(equipped.profile_flair);

    return `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding:14px;border-radius:6px;${_jersey}background:var(--bg2);">
        <div style="width:16px;height:16px;border-radius:50%;background:${crew.map_color_hex};flex-shrink:0;box-shadow:0 0 8px ${crew.map_color_hex}55;"></div>
        <div>
          <div style="font-size:22px;font-weight:900;${_tagCSS || "font-family:'Big Shoulders Display',sans-serif;"}">${_tagPre}${crew.name}${_flair}</div>
          <div style="font-size:12px;color:var(--muted);">${crew.sport_type} · ${crew.age_class} · ${crew.gender_class}</div>
        </div>
      </div>

      <div class="card">
        <div class="stat-row"><span class="stat-label">Tier</span><span class="tier-badge ${tierClass}">${tierLabel}</span></div>
        <div class="stat-row"><span class="stat-label">Reputation</span><span class="stat-value">${crew.reputation_score}</span></div>
        <div class="stat-row"><span class="stat-label">Record</span><span class="stat-value">${record.wins}W – ${record.losses}L</span></div>
        <div class="stat-row"><span class="stat-label">Win Streak</span><span class="stat-value" style="color:var(--amber)">🔥 ${crew.current_win_streak}</span></div>
        <div class="stat-row"><span class="stat-label">Boss</span><span class="stat-value">${crew.boss_username}</span></div>
      </div>

      ${h2h.length > 0 ? `
        <div class="section-head">RIVALRY — VS YOU</div>
        <div class="card" style="text-align:center;padding:20px;">
          <div style="font-family:'Big Shoulders Display',sans-serif;font-size:28px;font-weight:900;letter-spacing:0.05em;">
            <span style="color:var(--volt)">${h2hWins}</span>
            <span style="color:var(--muted);margin:0 12px;">–</span>
            <span style="color:var(--red)">${h2hLosses}</span>
          </div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px;font-family:'Big Shoulders Display',sans-serif;letter-spacing:0.1em;text-transform:uppercase;">Their wins – Your wins</div>
        </div>
      ` : ''}

      ${turf.length ? `
        <div class="section-head">TURF HELD (${turf.length})</div>
        ${turf.map(c => `
          <div class="card" style="padding:10px 14px;margin-bottom:6px;${_banner}">
            <div class="card-title" style="font-size:13px;">${c.name}</div>
          </div>
        `).join('')}
      ` : ''}

      ${achievements.length ? `
        <div class="section-head">ACHIEVEMENTS</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
          ${achievements.map(a => `
            <div title="${a.description}" style="background:rgba(68,255,34,0.08);border:1px solid rgba(68,255,34,0.2);border-radius:4px;padding:6px 10px;">
              <div style="font-family:'Big Shoulders Display',sans-serif;font-size:11px;font-weight:900;color:var(--volt);">${a.name}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="section-head">ROSTER (${roster.length})</div>
      ${roster.map(p => `
        <div class="card" style="padding:10px 14px;margin-bottom:6px;cursor:pointer;" onclick="App.navPlayerProfile(${p.id})">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;">${p.username}</span>
            <span style="font-size:11px;color:var(--muted);">${p.wins || 0}W ${p.losses || 0}L →</span>
          </div>
        </div>
      `).join('')}

      <div class="section-head">RECENT MATCHES</div>
      ${matchHistory.slice(0, 5).map(m => `
        <div class="card" style="padding:10px 14px;margin-bottom:6px;">
          <div style="font-family:'Big Shoulders Display',sans-serif;font-size:13px;font-weight:900;">
            ${m.challenger_name} vs ${m.defender_name}
          </div>
          <div style="display:flex;gap:6px;margin-top:6px;">
            <span class="tag tag-muted">${m.format_type}</span>
            ${m.status === 'resolved' ? `<span class="tag ${m.winner_crew_id === crew.id ? 'tag-green' : 'tag-red'}">${m.winner_crew_id === crew.id ? 'WIN' : 'LOSS'}</span>` : `<span class="tag tag-muted">${m.status}</span>`}
            <span class="tag tag-muted">${m.court_name || ''}</span>
          </div>
        </div>
      `).join('') || '<div class="empty-state" style="padding:12px 0;">No match history yet.</div>'}

      <div style="margin-top:16px;display:flex;gap:8px;">
        <button class="btn btn-volt btn-full" onclick="App.nav('callout')">⚡ CALL THEM OUT</button>
      </div>
    `;
  }

  function bindCrewProfile() {}

  // ── COURTS VIEW ──
  function renderCourts() {
    const publicCourts = state.courts.filter(c => c.type === 'public');
    const venueCourts = state.courts.filter(c => c.type === 'venue');

    return `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
        <div class="section-head" style="margin:0;border:none;">TURFS</div>
        <button class="btn btn-outline btn-sm" onclick="App.openSubmitCourtModal()">+ SUBMIT TURF</button>
      </div>
      <div style="margin-bottom:16px;"></div>

      <div class="section-head">TURFS</div>
      ${publicCourts.map(c => `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div class="card-title">${c.name}</div>
            ${c.holder_color ? `<div style="width:10px;height:10px;border-radius:50%;background:${c.holder_color};margin-top:4px;box-shadow:0 0 6px ${c.holder_color}88;"></div>` : ''}
          </div>
          <div class="card-sub">
            ${c.holder_name ? `Held by <strong style="color:var(--volt)">${c.holder_name}</strong>` : 'UP FOR GRABS'}
            ${c.holder_decline_count > 0 ? `<span class="tag tag-amber" style="margin-left:6px;">${c.holder_decline_count}/3 DECLINES</span>` : ''}
          </div>
        </div>
      `).join('')}

      <div class="section-head">VENUE TURFS</div>
      ${venueCourts.map(c => `
        <div class="card">
          <div class="card-title">${c.name}</div>
          <div class="card-sub">
            ${c.holder_name ? `Held by <strong style="color:var(--volt)">${c.holder_name}</strong>` : 'UP FOR GRABS'}
            <span class="tag tag-amber" style="margin-left:6px;">TURF WARS ONLY</span>
          </div>
        </div>
      `).join('')}
    `;
  }

  function bindCourts() {}

  // ── PROFILE VIEW ──
  function renderProfile() {
    const user = state.user;
    if (!user) return '';
    return `
      <div class="section-head">YOUR PROFILE</div>
      <div class="card">
        <div class="card-title">${user.username}</div>
        <div class="card-sub">Tier: ${user.tier}</div>
      </div>

      <div class="section-head">MY CREWS</div>
      ${state.myCrews.map(c => `
        <div class="card" style="border-left:3px solid ${c.map_color_hex};">
          <div class="card-title">${c.name}</div>
          <div class="card-sub">ID: ${c.id} · ${c.sport_type}</div>
          <div style="margin-top:8px;font-size:11px;color:var(--muted);font-family:'Big Shoulders Display',sans-serif;letter-spacing:0.1em;">USE THIS ID TO RECEIVE CALL-OUTS</div>
        </div>
      `).join('')}

      <div class="section-head">CREW INVITES</div>
      <div id="invites-list"><div style="font-size:12px;color:var(--muted);">Loading...</div></div>

      <div class="section-head">REPORT / BLOCK</div>
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div class="form-field">
          <label class="form-label">Report a User (by ID)</label>
          <input class="form-input" id="report-user-id" type="number" placeholder="User ID">
          <input class="form-input" id="report-reason" type="text" placeholder="REASON" style="margin-top:6px;">
          <button class="btn btn-outline btn-sm btn-full" id="btn-report-user" style="margin-top:6px;">REPORT USER</button>
        </div>
        <div class="form-field">
          <label class="form-label">Block a User (by ID)</label>
          <input class="form-input" id="block-user-id" type="number" placeholder="User ID">
          <button class="btn btn-danger btn-sm btn-full" id="btn-block-user" style="margin-top:6px;">BLOCK USER</button>
        </div>
      </div>
      <div id="profile-msg" style="margin-top:12px;"></div>

      ${state.user?.tier === 'operator' ? `
        <div class="section-head" style="margin-top:20px;">X CONSOLE</div>
        <div class="card" style="cursor:pointer;border:1px solid var(--red);" onclick="App.navXConsole()">
          <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:14px;color:var(--red);">X CONSOLE →</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px;">Reports queue · Dispute review · Account actions</div>
        </div>
      ` : ''}

      <div class="section-head" style="margin-top:12px;">QUICK LINKS</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <button class="btn btn-outline btn-full" onclick="App.navTurfWars()">🏆 TURF WARS</button>
        <button class="btn btn-outline btn-full" onclick="App.navStore()">🛒 THE STORE</button>
        <button class="btn btn-outline btn-full" onclick="App.navLeaderboard()">🏅 LEADERBOARD</button>
        <div id="venue-dash-link"></div>
      </div>

      <div class="section-head" style="margin-top:20px;border-color:var(--red);color:var(--red);">DANGER ZONE</div>
      <button class="btn btn-danger btn-full btn-sm" id="btn-delete-account">DELETE ACCOUNT</button>
    `;
  }

  function bindProfile() {
    // Load invites inbox
    api('GET', '/api/invites').then(data => {
      const el = document.getElementById('invites-list');
      if (!el) return;
      if (!data.invites.length) {
        el.innerHTML = `<div style="font-size:12px;color:var(--muted);padding:4px 0;">No pending invites.</div>`;
        return;
      }
      el.innerHTML = data.invites.map(inv => `
        <div class="card" style="margin-bottom:8px;border-left:3px solid ${inv.map_color_hex};">
          <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:13px;">${inv.crew_name}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">${inv.sport_type} · Invited by ${inv.invited_by_username}</div>
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button class="btn btn-volt btn-sm invite-accept" data-id="${inv.id}">ACCEPT</button>
            <button class="btn btn-outline btn-sm invite-decline" data-id="${inv.id}">DECLINE</button>
          </div>
        </div>
      `).join('');
      el.querySelectorAll('.invite-accept').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await api('POST', `/api/invites/${btn.dataset.id}/respond`, { action: 'accept' });
            toast('WELCOME TO THE CREW!');
            await loadAppData();
            bindProfile();
          } catch(e) { toast(e.message); }
        });
      });
      el.querySelectorAll('.invite-decline').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await api('POST', `/api/invites/${btn.dataset.id}/respond`, { action: 'decline' });
            toast('INVITE DECLINED');
            bindProfile();
          } catch(e) { toast(e.message); }
        });
      });
    }).catch(() => {});

    // Delete account
    document.getElementById('btn-delete-account')?.addEventListener('click', async () => {
      if (!confirm('DELETE YOUR ACCOUNT? This is permanent. Your crews will be transferred or archived.')) return;
      if (!confirm('Are you absolutely sure? Type OK to proceed — this cannot be undone.')) return;
      try {
        await api('DELETE', '/api/auth/account');
        toast('ACCOUNT DELETED');
        state.user = null;
        state.myCrews = [];
        show('login');
      } catch(e) { toast(e.message); }
    });

    // Check if user is a venue manager
    fetch('/api/venue/dashboard', { method: 'GET' })
      .then(r => r.json())
      .then(data => {
        if (data.venue) {
          const el = document.getElementById('venue-dash-link');
          if (el) el.innerHTML = `<button class="btn btn-outline btn-full" onclick="App.navVenueDashboard()">🏟 VENUE DASHBOARD — ${data.venue.name}</button>`;
        }
      }).catch(() => {});

    document.getElementById('btn-report-user')?.addEventListener('click', async () => {
      const uid = parseInt(document.getElementById('report-user-id').value);
      const reason = document.getElementById('report-reason').value.trim();
      const msgEl = document.getElementById('profile-msg');
      if (!uid || !reason) { msgEl.innerHTML = '<div class="msg-error">Enter user ID and reason.</div>'; return; }
      try {
        await api('POST', '/api/reports', { reported_user_id: uid, reason });
        msgEl.innerHTML = '<div class="msg-success">Report submitted. X will review it.</div>';
      } catch (e) {
        msgEl.innerHTML = `<div class="msg-error">${e.message}</div>`;
      }
    });

    document.getElementById('btn-block-user')?.addEventListener('click', async () => {
      const uid = parseInt(document.getElementById('block-user-id').value);
      const msgEl = document.getElementById('profile-msg');
      if (!uid) { msgEl.innerHTML = '<div class="msg-error">Enter user ID to block.</div>'; return; }
      try {
        await api('POST', '/api/blocks', { blocked_user_id: uid });
        msgEl.innerHTML = '<div class="msg-success">User blocked.</div>';
      } catch (e) {
        msgEl.innerHTML = `<div class="msg-error">${e.message}</div>`;
      }
    });
  }

  // ── MODALS ──

  async function openAcceptModal(matchId) {
    const m = state.matches.find(x => x.id === matchId);
    if (!m) return;
    const formatCount = parseInt(m.format_type.split('v')[0]);

    // Load roster
    const crewRes = await api('GET', `/api/crews/${state.activeCrewId}`);
    const roster = crewRes.roster;
    let acceptLineup = [];

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    document.body.appendChild(backdrop);

    function renderAccept() {
      backdrop.innerHTML = `
        <div class="modal-sheet">
          <div class="modal-title">ACCEPT CALL-OUT</div>
          <div class="card-sub" style="margin-bottom:4px;">
            <strong>${m.challenger_name}</strong> wants to run
            <strong style="color:var(--volt)">${m.format_type}</strong> at
            <strong>${m.court_name}</strong>${m.wager_amount > 0
              ? ` for <strong style="color:var(--volt)">⚡ ${m.wager_amount} coins</strong>` : ''}.
          </div>
          <div class="form-label" style="margin-bottom:8px;">
            PICK YOUR ${formatCount} <span style="color:var(--muted);font-weight:400;">(${acceptLineup.length}/${formatCount} selected)</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${roster.map(p => {
              const sel = acceptLineup.includes(p.id);
              return `<div onclick="window._acceptToggle(${p.id})"
                style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;
                  background:${sel ? 'rgba(68,255,34,0.1)' : 'rgba(255,255,255,0.03)'};
                  border:1px solid ${sel ? 'var(--volt)' : 'var(--border)'};
                  border-radius:4px;cursor:pointer;">
                <span style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;">${p.username}</span>
                <span style="font-size:18px;">${sel ? '✓' : '○'}</span>
              </div>`;
            }).join('')}
          </div>
          <div id="accept-error" class="msg-error" style="display:none;margin-top:8px;"></div>
          <button class="btn btn-volt btn-full" id="btn-confirm-accept" style="margin-top:12px;">LOCK IT IN</button>
          <button class="btn btn-outline btn-full" id="btn-cancel-accept">CANCEL</button>
        </div>
      `;
      backdrop.querySelector('#btn-cancel-accept').addEventListener('click', () => {
        delete window._acceptToggle;
        backdrop.remove();
      });
      backdrop.querySelector('#btn-confirm-accept').addEventListener('click', async () => {
        const errEl = backdrop.querySelector('#accept-error');
        errEl.style.display = 'none';
        if (acceptLineup.length !== formatCount) {
          errEl.textContent = `Pick exactly ${formatCount} player${formatCount > 1 ? 's' : ''}.`;
          errEl.style.display = 'block'; return;
        }
        try {
          await api('POST', `/api/matches/${matchId}/respond`, { action: 'accept', lineup_user_ids: acceptLineup });
          delete window._acceptToggle;
          backdrop.remove();
          toast('MATCH LOCKED. GAME ON. 🔥');
          await loadAppData();
          show('matches');
        } catch (e) {
          errEl.textContent = e.message;
          errEl.style.display = 'block';
        }
      });
    }

    window._acceptToggle = (id) => {
      if (acceptLineup.includes(id)) {
        acceptLineup = acceptLineup.filter(x => x !== id);
      } else if (acceptLineup.length < formatCount) {
        acceptLineup.push(id);
      }
      renderAccept();
    };

    renderAccept();
  }

  async function declineMatch(matchId) {
    try {
      await api('POST', `/api/matches/${matchId}/respond`, { action: 'decline' });
      toast('CALL-OUT DECLINED.');
      await loadAppData();
      show('home');
    } catch (e) {
      toast(e.message);
    }
  }

  function openScoreModal(matchId) {
    const m = state.matches.find(x => x.id === matchId);
    if (!m) return;

    const isChallenger = m.challenger_crew_id === state.activeCrewId;
    const myCrew = isChallenger ? m.challenger_name : m.defender_name;
    const theirCrew = isChallenger ? m.defender_name : m.challenger_name;

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-title">REPORT SCORE</div>
        <div class="card-sub" style="margin-bottom:8px;">${myCrew} vs ${theirCrew}</div>
        <div class="form-field">
          <label class="form-label">${myCrew} Score — ${theirCrew} Score</label>
          <div class="score-row">
            <input class="form-input" id="score-us" type="number" min="0" placeholder="0">
            <span class="score-sep">—</span>
            <input class="form-input" id="score-them" type="number" min="0" placeholder="0">
          </div>
        </div>
        <div id="score-error" class="msg-error" style="display:none"></div>
        <button class="btn btn-volt btn-full" id="btn-submit-score">SUBMIT SCORE</button>
        <button class="btn btn-outline btn-full" id="btn-cancel-score">CANCEL</button>
      </div>
    `;
    document.body.appendChild(backdrop);

    backdrop.querySelector('#btn-cancel-score').addEventListener('click', () => backdrop.remove());
    backdrop.querySelector('#btn-submit-score').addEventListener('click', async () => {
      const us = parseInt(backdrop.querySelector('#score-us').value);
      const them = parseInt(backdrop.querySelector('#score-them').value);
      const errEl = backdrop.querySelector('#score-error');
      errEl.style.display = 'none';

      if (isNaN(us) || isNaN(them)) {
        errEl.textContent = 'Enter both scores.'; errEl.style.display = 'block'; return;
      }

      // Score format: challenger_score-defender_score
      const score = isChallenger ? `${us}-${them}` : `${them}-${us}`;

      try {
        const res = await api('POST', `/api/matches/${matchId}/report-score`, {
          score,
          crew_id: state.activeCrewId,
        });
        backdrop.remove();
        if (res.resolved) {
          toast('MATCH RESOLVED! CHECK YOUR COINS. 🔥');
          if (res.tiered_up) {
            const tierNames = { 200: 'UP & COMER', 500: 'BALLER', 1000: 'LEGEND' };
            setTimeout(() => showCelebration(`🏅 TIER UP — ${tierNames[res.tiered_up] || 'NEW TIER'}!`, 'tier'), 1200);
          }
        } else if (res.disputed) {
          toast('SCORES DON\'T MATCH. 48H TO AGREE OR IT\'S VOIDED.');
        } else {
          toast('SCORE SUBMITTED. WAITING ON THE OTHER CREW.');
        }
        await loadAppData();
        show('matches');
      } catch (e) {
        errEl.textContent = e.message;
        errEl.style.display = 'block';
      }
    });
  }

  function openTransferBossModal(players) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-title">TRANSFER BOSS STATUS</div>
        <div class="form-field">
          <label class="form-label">New Boss</label>
          <select class="form-select" id="new-boss-select">
            ${players.map(p => `<option value="${p.id}">${p.username}</option>`).join('')}
          </select>
        </div>
        <div id="transfer-error" class="msg-error" style="display:none"></div>
        <button class="btn btn-volt btn-full" id="btn-confirm-transfer">TRANSFER</button>
        <button class="btn btn-outline btn-full" id="btn-cancel-transfer">CANCEL</button>
      </div>
    `;
    document.body.appendChild(backdrop);

    backdrop.querySelector('#btn-cancel-transfer').addEventListener('click', () => backdrop.remove());
    backdrop.querySelector('#btn-confirm-transfer').addEventListener('click', async () => {
      const new_boss_id = parseInt(backdrop.querySelector('#new-boss-select').value);
      try {
        await api('POST', `/api/crews/${state.activeCrewId}/transfer-boss`, { new_boss_id });
        backdrop.remove();
        toast('BOSS TRANSFERRED.');
        await loadAppData();
        show('crews');
      } catch (e) {
        backdrop.querySelector('#transfer-error').textContent = e.message;
        backdrop.querySelector('#transfer-error').style.display = 'block';
      }
    });
  }

  // ── TURF WARS ──
  function renderTurfWars() {
    const crew = state.myCrews.find(c => c.id === state.activeCrewId);
    const open = tournamentsData.filter(t => t.status === 'open');
    const inProgress = tournamentsData.filter(t => t.status === 'in_progress');
    const complete = tournamentsData.filter(t => t.status === 'complete');

    const tournCard = (t) => `
      <div class="card" style="cursor:pointer;border-left:3px solid var(--volt);" onclick="App.viewTournament(${t.id})">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <div class="card-title">${t.name}</div>
            <div class="card-sub">${t.format_type} · ${t.bracket_type === 'bracket' ? 'ELIMINATION' : 'ROTATION'}${t.venue_name ? ` · ${t.venue_name}` : ' · PUBLIC'}</div>
          </div>
          <span class="tag ${t.status === 'open' ? 'tag-volt' : t.status === 'in_progress' ? 'tag-amber' : 'tag-muted'}">${t.status.toUpperCase().replace('_',' ')}</span>
        </div>
        <div style="margin-top:8px;font-size:12px;color:var(--muted);">
          ${t.entry_count} crew${t.entry_count !== 1 ? 's' : ''} entered
          ${t.coin_prize_pool > 0 ? ` · <span style="color:var(--volt);">⚡ ${t.coin_prize_pool} prize pool</span>` : ''}
          ${t.venue_id ? ` · 💳 Entry fee` : ' · Free entry (⚡ 50 coins)'}
        </div>
      </div>
    `;

    return `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div class="section-head" style="margin:0;border:none;">TURF WARS</div>
        ${crew ? `<button class="btn btn-volt btn-sm" id="btn-create-tournament">+ CREATE</button>` : ''}
      </div>

      ${open.length ? `<div class="section-head">OPEN — JOIN NOW</div>${open.map(tournCard).join('')}` : ''}
      ${inProgress.length ? `<div class="section-head">IN PROGRESS</div>${inProgress.map(tournCard).join('')}` : ''}
      ${complete.length ? `<div class="section-head">COMPLETED</div>${complete.slice(0,5).map(tournCard).join('')}` : ''}
      ${!tournamentsData.length ? `<div class="empty-state">NO TOURNAMENTS YET.<br>BE THE FIRST TO CREATE ONE.</div>` : ''}

      <!-- Create Tournament Modal -->
      <div id="create-tourn-sheet" style="display:none;position:fixed;bottom:60px;left:0;right:0;
        background:var(--bg2);border-top:2px solid var(--border);padding:18px 20px 20px;z-index:400;
        box-shadow:0 -8px 32px rgba(0,0,0,0.6);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:14px;letter-spacing:0.1em;">CREATE TOURNAMENT</div>
          <button id="btn-close-create-tourn" style="background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer;">✕</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <input class="form-input" id="ct-name" placeholder="TOURNAMENT NAME">
          <select class="form-input" id="ct-format">
            <option value="1v1">1v1</option><option value="2v2">2v2</option>
            <option value="3v3" selected>3v3</option><option value="4v4">4v4</option><option value="5v5">5v5</option>
          </select>
          <select class="form-input" id="ct-bracket">
            <option value="bracket">Bracket (Elimination)</option>
            <option value="rotation">Rotation (Winner Stays On)</option>
          </select>
          <select class="form-input" id="ct-court">
            <option value="">— Select a public court —</option>
            ${state.courts.filter(c => c.type === 'public').map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
        <div id="ct-error" class="msg-error" style="display:none;margin-top:8px;"></div>
        <button class="btn btn-volt btn-full" id="btn-submit-tournament" style="margin-top:12px;">CREATE</button>
      </div>
    `;
  }

  function bindTurfWars() {
    fetch('/api/tournaments').then(r => r.json()).then(d => {
      tournamentsData = d.tournaments || [];
      const crew = state.myCrews.find(c => c.id === state.activeCrewId);
      // Re-render with data
      const content = document.getElementById('main-content');
      if (content) content.innerHTML = renderTurfWars();
      bindTurfWarsContent();
    }).catch(() => {});
    bindTurfWarsContent();
  }

  function bindTurfWarsContent() {
    document.getElementById('btn-create-tournament')?.addEventListener('click', () => {
      document.getElementById('create-tourn-sheet').style.display = 'block';
    });
    document.getElementById('btn-close-create-tourn')?.addEventListener('click', () => {
      document.getElementById('create-tourn-sheet').style.display = 'none';
    });
    document.getElementById('btn-submit-tournament')?.addEventListener('click', async () => {
      const name = document.getElementById('ct-name').value.trim();
      const format_type = document.getElementById('ct-format').value;
      const bracket_type = document.getElementById('ct-bracket').value;
      const court_id = document.getElementById('ct-court').value || null;
      const errEl = document.getElementById('ct-error');
      errEl.style.display = 'none';
      if (!name) { errEl.textContent = 'Give the tournament a name.'; errEl.style.display = 'block'; return; }
      try {
        await api('POST', '/api/tournaments', { name, format_type, bracket_type, court_id });
        document.getElementById('create-tourn-sheet').style.display = 'none';
        toast('TOURNAMENT CREATED!');
        const d = await api('GET', '/api/tournaments');
        tournamentsData = d.tournaments;
        const content = document.getElementById('main-content');
        if (content) content.innerHTML = renderTurfWars();
        bindTurfWarsContent();
      } catch(e) { errEl.textContent = e.message; errEl.style.display = 'block'; }
    });
  }

  // ── TOURNAMENT DETAIL ──
  function renderTournamentDetail() {
    if (!activeTournamentDetail) return `<div class="empty-state">LOADING...</div>`;
    const { tournament: t, entries, matches } = activeTournamentDetail;
    const crew = state.myCrews.find(c => c.id === state.activeCrewId);
    const myEntry = crew ? entries.find(e => e.crew_id === crew.id) : null;
    const canEnter = crew && !myEntry && t.status === 'open';

    const rounds = [...new Set(matches.map(m => m.tournament_round))].filter(Boolean).sort((a,b)=>a-b);

    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <button class="btn btn-outline btn-sm" onclick="App.navTurfWars()">← BACK</button>
        <div class="section-head" style="margin:0;border:none;flex:1;">${t.name}</div>
        <span class="tag ${t.status === 'open' ? 'tag-volt' : t.status === 'in_progress' ? 'tag-amber' : 'tag-muted'}">${t.status.toUpperCase().replace('_',' ')}</span>
      </div>

      <div class="card">
        <div class="card-sub">${t.format_type} · ${t.bracket_type === 'bracket' ? 'ELIMINATION BRACKET' : 'ROTATION'}</div>
        ${t.venue_name ? `<div class="card-sub">📍 ${t.venue_name}</div>` : '<div class="card-sub">📍 Public Court</div>'}
        ${t.coin_prize_pool > 0 ? `<div style="margin-top:8px;color:var(--volt);font-family:'Big Shoulders Display',sans-serif;font-weight:900;">⚡ ${t.coin_prize_pool} PRIZE POOL</div>` : ''}
        ${canEnter ? `<button class="btn btn-volt btn-sm" id="btn-enter-tournament" style="margin-top:10px;">ENTER${t.venue_id ? ' (ENTRY FEE APPLIES)' : ' (⚡ 50 COINS)'}</button>` : ''}
        ${myEntry ? `<div style="margin-top:8px;color:var(--volt);font-size:12px;font-family:'Big Shoulders Display',sans-serif;">✓ YOU'RE IN${myEntry.status === 'exempt' ? ' (EXEMPT)' : ''}</div>` : ''}
        ${myEntry && t.bracket_type === 'rotation' && t.status === 'in_progress' ? `
          <button class="btn btn-outline btn-sm" id="btn-join-queue" style="margin-top:8px;">JOIN THE QUEUE →</button>
        ` : ''}
        ${t.status === 'open' && entries.length >= 2 && state.user && state.myCrews.some(c => c.boss_id === state.user.id) ? `
          <button class="btn btn-outline btn-sm" id="btn-start-tournament" style="margin-top:8px;border-color:var(--volt);color:var(--volt);">START TOURNAMENT →</button>
        ` : ''}
      </div>

      ${t.bracket_type === 'rotation' && t.status === 'in_progress' ? `
        <div class="section-head">ROTATION QUEUE</div>
        <div id="rotation-queue-list"><div style="font-size:12px;color:var(--muted);padding:8px 0;">Loading queue...</div></div>
      ` : ''}

      <div class="section-head">ENTERED CREWS (${entries.length})</div>
      ${entries.map(e => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:4px;margin-bottom:6px;">
          <div style="width:10px;height:10px;border-radius:50%;background:${e.map_color_hex};flex-shrink:0;"></div>
          <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:13px;flex:1;">${e.crew_name}</div>
          ${e.status === 'exempt' ? `<span class="tag tag-volt">EXEMPT</span>` : ''}
        </div>
      `).join('') || '<div class="empty-state" style="padding:12px 0;">No crews entered yet.</div>'}

      ${rounds.length > 0 ? `
        <div class="section-head">BRACKET</div>
        ${rounds.map(round => {
          const roundMatches = matches.filter(m => m.tournament_round === round);
          return `
            <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:11px;letter-spacing:0.15em;color:var(--muted);text-transform:uppercase;margin:10px 0 6px;">ROUND ${round}</div>
            ${roundMatches.map(m => `
              <div class="card" style="margin-bottom:8px;border-left:3px solid ${m.winner_name ? 'var(--volt)' : 'var(--border)'};">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:13px;">
                    <span style="${m.winner_crew_id === m.challenger_crew_id ? 'color:var(--volt)' : ''}">${m.challenger_name || 'BYE'}</span>
                    <span style="color:var(--muted);margin:0 6px;">VS</span>
                    <span style="${m.winner_crew_id === m.defender_crew_id ? 'color:var(--volt)' : ''}">${m.challenger_crew_id === m.defender_crew_id ? 'BYE' : (m.defender_name || 'TBD')}</span>
                  </div>
                  <span class="tag ${m.status === 'resolved' ? 'tag-green' : m.status === 'locked' ? 'tag-amber' : 'tag-muted'}">${m.status.toUpperCase()}</span>
                </div>
                ${m.winner_name ? `<div style="font-size:12px;color:var(--volt);margin-top:6px;font-family:'Big Shoulders Display',sans-serif;">WINNER: ${m.winner_name}</div>` : ''}
                ${m.challenger_reported_score && m.status === 'resolved' ? `<div style="font-size:12px;color:var(--muted);margin-top:4px;">${m.challenger_reported_score}</div>` : ''}
              </div>
            `).join('')}
          `;
        }).join('')}
      ` : ''}
    `;
  }

  function bindTournamentDetail() {
    // Load rotation queue if applicable
    const queueEl = document.getElementById('rotation-queue-list');
    if (queueEl && activeTournamentId) {
      api('GET', `/api/tournaments/${activeTournamentId}/queue`).then(data => {
        const q = data.queue || [];
        queueEl.innerHTML = q.length ? q.map((row, i) => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:4px;margin-bottom:6px;">
            <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:13px;color:var(--muted);min-width:20px;">${i + 1}</div>
            <div style="width:10px;height:10px;border-radius:50%;background:${row.map_color_hex};flex-shrink:0;"></div>
            <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:13px;flex:1;">${row.crew_name}</div>
            <span class="tag ${row.status === 'playing' ? 'tag-volt' : 'tag-amber'}">${row.status.toUpperCase()}</span>
          </div>
        `).join('') : `<div style="font-size:12px;color:var(--muted);padding:8px 0;">Queue is empty — join to play!</div>`;
      }).catch(() => {});
    }

    document.getElementById('btn-join-queue')?.addEventListener('click', async () => {
      const crew = state.myCrews.find(c => c.id === state.activeCrewId);
      if (!crew) { toast('SELECT A CREW FIRST'); return; }
      try {
        await api('POST', `/api/tournaments/${activeTournamentId}/queue`, { crew_id: crew.id });
        toast('IN THE QUEUE — WAIT FOR YOUR MATCH');
        const d = await api('GET', `/api/tournaments/${activeTournamentId}`);
        activeTournamentDetail = d;
        show('tournament-detail');
      } catch(e) { toast(e.message); }
    });

    document.getElementById('btn-start-tournament')?.addEventListener('click', async () => {
      if (!confirm('Start the tournament? No more entries will be accepted.')) return;
      try {
        await api('POST', `/api/tournaments/${activeTournamentId}/start`);
        toast('TOURNAMENT STARTED — BRACKET LOCKED');
        const d = await api('GET', `/api/tournaments/${activeTournamentId}`);
        activeTournamentDetail = d;
        show('tournament-detail');
      } catch(e) { toast(e.message); }
    });

    document.getElementById('btn-enter-tournament')?.addEventListener('click', async () => {
      const crew = state.myCrews.find(c => c.id === state.activeCrewId);
      if (!crew) { toast('SELECT A CREW FIRST'); return; }
      try {
        const res = await api('POST', `/api/tournaments/${activeTournamentId}/enter`, { crew_id: crew.id });
        toast(res.exempt ? '✓ ENTERED (TURF HOLDER EXEMPTION)' : `✓ ENTERED${res.cost_coins ? ` — ⚡ ${res.cost_coins} COINS SPENT` : ''}`);
        const d = await api('GET', `/api/tournaments/${activeTournamentId}`);
        activeTournamentDetail = d;
        await loadAppData();
        show('tournament-detail');
      } catch(e) { toast(e.message); }
    });
  }

  // ── THE STORE ──
  const UNLOCK_LABELS = {
    win_streak_10:    'Win 10 matches in a row',
    hold_3_courts:    'Hold 3 courts at the same time',
    defender_wins_3:  'Win 3 times as the called-out crew',
    quests_claimed_5: 'Complete 5 quests',
  };

  const ITEM_TYPE_LABELS = {
    jersey: '👕 JERSEYS',
    tag_style: '🎨 TAG STYLES',
    court_banner: '🚩 COURT BANNERS',
    profile_flair: '✨ PROFILE FLAIR',
    rematch_clause: '🔄 REMATCH CLAUSE',
    priority_booking: '⚡ PRIORITY BOOKING',
  };

  function renderStore() {
    const crew = state.myCrews.find(c => c.id === state.activeCrewId);
    const { items, inventory } = storeData;
    const ownedIds = new Set(inventory.filter(i => !i.is_consumable || !i.used_at).map(i => i.item_id));
    const grouped = {};
    items.forEach(item => {
      if (!grouped[item.item_type]) grouped[item.item_type] = [];
      grouped[item.item_type].push(item);
    });

    return `
      <div class="section-head">THE STORE</div>
      ${crew ? `<div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:12px;color:var(--volt);margin-bottom:12px;">YOUR BALANCE: ⚡ ${crew.coin_balance} COINS</div>` : ''}

      ${Object.entries(grouped).map(([type, typeItems]) => `
        <div class="section-head" style="font-size:11px;margin-top:16px;">${ITEM_TYPE_LABELS[type] || type.toUpperCase()}</div>
        ${typeItems.map(item => {
          const invEntry = inventory.find(i => i.item_id === item.id);
          const isEarned = item.unlock_type === 'achievement';
          const owned = invEntry && (!item.is_consumable || !invEntry.used_at);
          const locked = !owned && (isEarned || (crew && crew.reputation_score < item.min_reputation));
          const equipped = invEntry && invEntry.equipped;
          const used = invEntry && item.is_consumable && invEntry.used_at;
          return `
            <div class="card" style="margin-bottom:8px;display:flex;align-items:center;gap:12px;${equipped ? 'border-left:3px solid var(--volt);' : used ? 'opacity:0.5;' : ''}">
              <div style="flex:1;">
                <div style="display:flex;align-items:center;gap:6px;">
                  <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:13px;">${item.name}</div>
                  ${isEarned ? `<span style="font-size:9px;font-weight:900;font-family:'Big Shoulders Display',sans-serif;letter-spacing:0.08em;padding:2px 5px;border-radius:3px;background:rgba(255,176,46,0.12);color:#ffb02e;border:1px solid rgba(255,176,46,0.3);">EARNED</span>` : ''}
                </div>
                <div style="font-size:11px;color:var(--muted);margin-top:2px;">
                  ${isEarned
                    ? (owned ? 'Unlocked · Equip to activate' : (UNLOCK_LABELS[item.unlock_requirement] || ''))
                    : `${item.min_reputation > 0 ? `REP ${item.min_reputation}+ · ` : ''}${item.is_consumable ? 'Single-use · ' : ''}⚡ ${item.cost_coins}`}
                </div>
                ${item.item_type === 'rematch_clause' && owned ? `<div style="font-size:10px;color:var(--muted);margin-top:3px;">Use from a resolved match card to force a rematch.</div>` : ''}
                ${item.item_type === 'priority_booking' && owned ? `<div style="font-size:10px;color:var(--muted);margin-top:3px;">Auto-applied on next tournament entry — no coins charged.</div>` : ''}
                ${!isEarned && item.item_type === 'jersey' ? `<div style="font-size:10px;color:var(--muted);margin-top:3px;">Shows on your crew profile header. Equip to activate.</div>` : ''}
                ${!isEarned && item.item_type === 'tag_style' ? `<div style="font-size:10px;color:var(--muted);margin-top:3px;">Changes your crew name style on your profile. Equip to activate.</div>` : ''}
                ${!isEarned && item.item_type === 'profile_flair' ? `<div style="font-size:10px;color:var(--muted);margin-top:3px;">Badge shown next to your crew name on profiles. Equip to activate.</div>` : ''}
                ${!isEarned && item.item_type === 'court_banner' ? `<div style="font-size:10px;color:var(--muted);margin-top:3px;">Decorates your turf listings on your crew profile. Equip to activate.</div>` : ''}
              </div>
              ${used ? `<span class="tag tag-muted">USED</span>` :
                owned && item.is_consumable && item.item_type === 'priority_booking' ? `<span class="tag tag-volt">READY</span>` :
                owned && item.is_consumable ? `<button class="btn btn-outline btn-sm store-use-btn" data-inv-id="${invEntry.id}" data-item-type="${item.item_type}">USE</button>` :
                owned && equipped ? `<button class="btn btn-outline btn-sm store-unequip-btn" data-inv-id="${invEntry.id}">UNEQUIP</button>` :
                owned ? `<button class="btn btn-outline btn-sm store-equip-btn" data-inv-id="${invEntry.id}">EQUIP</button>` :
                locked && isEarned ? `<span class="tag tag-muted">🔒 LOCKED</span>` :
                locked ? `<span class="tag tag-muted">🔒 ${item.min_reputation} REP</span>` :
                `<button class="btn btn-volt btn-sm store-buy-btn" data-item-id="${item.id}">BUY</button>`}
            </div>
          `;
        }).join('')}
      `).join('')}

      ${!items.length ? `<div class="empty-state">LOADING STORE...</div>` : ''}
      <div id="store-msg" style="margin-top:8px;"></div>
    `;
  }

  function bindStore() {
    const crew = state.myCrews.find(c => c.id === state.activeCrewId);
    if (!crew) return;

    // Load store data
    Promise.all([
      api('GET', '/api/store/items'),
      api('GET', `/api/store/inventory/${crew.id}`),
    ]).then(([itemsRes, invRes]) => {
      storeData = { items: itemsRes.items, inventory: invRes.inventory };
      const content = document.getElementById('main-content');
      if (content) content.innerHTML = renderStore();
      bindStoreContent();
    }).catch(() => {});
    bindStoreContent();
  }

  function bindStoreContent() {
    const crew = state.myCrews.find(c => c.id === state.activeCrewId);
    if (!crew) return;

    document.querySelectorAll('.store-buy-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const itemId = parseInt(btn.dataset.itemId);
        try {
          const res = await api('POST', '/api/store/buy', { crew_id: crew.id, item_id: itemId });
          toast(`BOUGHT! ⚡ ${res.coins_spent} COINS SPENT`);
          const [itemsRes, invRes] = await Promise.all([
            api('GET', '/api/store/items'),
            api('GET', `/api/store/inventory/${crew.id}`),
          ]);
          storeData = { items: itemsRes.items, inventory: invRes.inventory };
          await loadAppData();
          const content = document.getElementById('main-content');
          if (content) content.innerHTML = renderStore();
          bindStoreContent();
        } catch(e) { toast(e.message); }
      });
    });

    document.querySelectorAll('.store-use-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const invId = parseInt(btn.dataset.invId);
        const itemType = btn.dataset.itemType;
        let matchId = null;
        if (itemType === 'rematch_clause') {
          const input = prompt('Enter the Match ID you want to rematch:');
          if (!input) return;
          matchId = parseInt(input);
          if (isNaN(matchId)) { toast('INVALID MATCH ID'); return; }
        }
        try {
          const res = await api('POST', '/api/store/use', { crew_id: crew.id, inventory_id: invId, match_id: matchId });
          toast(res.message || 'DONE!');
          const invRes = await api('GET', `/api/store/inventory/${crew.id}`);
          storeData.inventory = invRes.inventory;
          const content = document.getElementById('main-content');
          if (content) content.innerHTML = renderStore();
          bindStoreContent();
        } catch(e) { toast(e.message); }
      });
    });

    document.querySelectorAll('.store-equip-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const invId = parseInt(btn.dataset.invId);
        try {
          await api('POST', '/api/store/equip', { crew_id: crew.id, inventory_id: invId });
          toast('EQUIPPED!');
          const invRes = await api('GET', `/api/store/inventory/${crew.id}`);
          storeData.inventory = invRes.inventory;
          const content = document.getElementById('main-content');
          if (content) content.innerHTML = renderStore();
          bindStoreContent();
        } catch(e) { toast(e.message); }
      });
    });

    document.querySelectorAll('.store-unequip-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const invId = parseInt(btn.dataset.invId);
        try {
          await api('POST', '/api/store/unequip', { crew_id: crew.id, inventory_id: invId });
          toast('UNEQUIPPED');
          const invRes = await api('GET', `/api/store/inventory/${crew.id}`);
          storeData.inventory = invRes.inventory;
          const content = document.getElementById('main-content');
          if (content) content.innerHTML = renderStore();
          bindStoreContent();
        } catch(e) { toast(e.message); }
      });
    });
  }

  // ── VENUE DASHBOARD ──
  function renderVenueDashboard() {
    return `
      <div class="section-head">VENUE DASHBOARD</div>
      <div id="venue-dash-content"><div class="empty-state">LOADING...</div></div>
    `;
  }

  function bindVenueDashboard() {
    api('GET', '/api/venue/dashboard')
      .then(data => {
        const { venue, tournaments } = data;
        const totalGross = tournaments.reduce((sum, t) => sum + (parseInt(t.gross_revenue_cents) || 0), 0);
        const totalPayout = tournaments.reduce((sum, t) => sum + (parseInt(t.venue_payout_cents) || 0), 0);

        const el = document.getElementById('venue-dash-content');
        if (!el) return;
        el.innerHTML = `
          <div class="card" style="border-left:3px solid var(--volt);margin-bottom:16px;">
            <div class="card-title">${venue.name}</div>
            <div class="card-sub">${venue.address || ''}</div>
            <div style="margin-top:10px;display:flex;gap:20px;">
              <div>
                <div style="font-size:10px;color:var(--muted);font-family:'Big Shoulders Display',sans-serif;letter-spacing:0.1em;">TOTAL REVENUE</div>
                <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:18px;color:var(--volt);">$${(totalGross / 100).toFixed(2)}</div>
              </div>
              <div>
                <div style="font-size:10px;color:var(--muted);font-family:'Big Shoulders Display',sans-serif;letter-spacing:0.1em;">YOUR PAYOUT</div>
                <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:18px;color:var(--amber);">$${(totalPayout / 100).toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div class="section-head">TOURNAMENTS</div>
          ${tournaments.map(t => `
            <div class="card" style="margin-bottom:8px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div>
                  <div class="card-title" style="font-size:13px;">${t.name}</div>
                  <div class="card-sub">${t.format_type} · ${new Date(t.created_at).toLocaleDateString()}</div>
                </div>
                <span class="tag ${t.status === 'complete' ? 'tag-green' : t.status === 'in_progress' ? 'tag-amber' : 'tag-volt'}">${t.status.toUpperCase().replace('_',' ')}</span>
              </div>
              <div style="margin-top:8px;display:flex;gap:16px;flex-wrap:wrap;">
                <div style="font-size:12px;"><span style="color:var(--muted);">Entries:</span> ${t.total_entries}</div>
                <div style="font-size:12px;"><span style="color:var(--muted);">Gross:</span> <span style="color:var(--volt);">$${((parseInt(t.gross_revenue_cents)||0)/100).toFixed(2)}</span></div>
                <div style="font-size:12px;"><span style="color:var(--muted);">Your cut:</span> <span style="color:var(--amber);">$${((parseInt(t.venue_payout_cents)||0)/100).toFixed(2)}</span></div>
              </div>
            </div>
          `).join('') || '<div class="empty-state" style="padding:12px 0;">No tournaments yet.</div>'}
        `;
      })
      .catch(e => {
        const el = document.getElementById('venue-dash-content');
        if (el) el.innerHTML = `<div class="empty-state">NOT A VENUE MANAGER.</div>`;
      });
  }

  // ── X CONSOLE ──
  function renderXConsole() {
    return `
      <div class="section-head" style="color:var(--red);">⚠ X CONSOLE</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:16px;font-family:'Big Shoulders Display',sans-serif;letter-spacing:0.05em;">PLATFORM ADMIN — HANDLE WITH CARE</div>
      <div id="xconsole-content"><div class="empty-state">LOADING...</div></div>
    `;
  }

  function bindXConsole() {
    Promise.all([
      api('GET', '/api/admin/reports'),
      api('GET', '/api/admin/matches/disputed'),
    ]).then(([reportsRes, matchesRes]) => {
      const el = document.getElementById('xconsole-content');
      if (!el) return;

      const openReports = reportsRes.reports.filter(r => r.status === 'open');
      const allReports = reportsRes.reports;
      const disputed = matchesRes.matches;

      el.innerHTML = `
        <div class="section-head">DISPUTED MATCHES (${disputed.length})</div>
        ${disputed.map(m => `
          <div class="card" style="margin-bottom:8px;border-left:3px solid var(--red);">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
              <div>
                <div class="card-title" style="font-size:13px;">${m.challenger_name} <span style="color:var(--muted);">VS</span> ${m.defender_name}</div>
                <div class="card-sub">Disputed: ${new Date(m.disputed_at).toLocaleString()}</div>
                <div style="font-size:12px;color:var(--muted);margin-top:4px;">
                  Challenger says: <strong>${m.challenger_reported_score || '—'}</strong> · Defender says: <strong>${m.defender_reported_score || '—'}</strong>
                </div>
              </div>
            </div>
            <div style="display:flex;gap:8px;margin-top:10px;">
              <button class="btn btn-outline btn-sm xc-force-btn" data-match-id="${m.id}" data-winner="${m.challenger_crew_id}" style="font-size:10px;">GIVE TO CHALLENGER</button>
              <button class="btn btn-outline btn-sm xc-force-btn" data-match-id="${m.id}" data-winner="${m.defender_crew_id}" style="font-size:10px;">GIVE TO DEFENDER</button>
            </div>
          </div>
        `).join('') || '<div class="empty-state" style="padding:12px 0;">No disputed matches.</div>'}

        <div class="section-head" style="margin-top:20px;">OPEN REPORTS (${openReports.length})</div>
        ${allReports.slice(0, 30).map(r => `
          <div class="card" style="margin-bottom:8px;${r.status === 'reviewed' ? 'opacity:0.5;' : 'border-left:3px solid var(--amber);'}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
              <div>
                <div style="font-size:12px;font-family:'Big Shoulders Display',sans-serif;font-weight:900;">${r.reason}</div>
                <div class="card-sub">
                  By: ${r.reporter_username || 'unknown'} ·
                  ${r.reported_user_username ? `User: ${r.reported_user_username}` : ''}
                  ${r.reported_crew_name ? `Crew: ${r.reported_crew_name}` : ''}
                </div>
                ${r.note ? `<div style="font-size:12px;color:var(--muted);margin-top:4px;">"${r.note}"</div>` : ''}
              </div>
              <span class="tag ${r.status === 'open' ? 'tag-amber' : 'tag-muted'}">${r.status.toUpperCase()}</span>
            </div>
            ${r.status === 'open' ? `<button class="btn btn-outline btn-sm xc-resolve-report-btn" data-report-id="${r.id}" style="margin-top:8px;font-size:10px;">MARK REVIEWED</button>` : ''}
          </div>
        `).join('') || '<div class="empty-state" style="padding:12px 0;">No reports.</div>'}

        <div id="xconsole-msg" style="margin-top:8px;"></div>
      `;

      document.querySelectorAll('.xc-force-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const matchId = btn.dataset.matchId;
          const winner = parseInt(btn.dataset.winner);
          if (!confirm('Force-resolve this match? This is permanent.')) return;
          try {
            await api('POST', `/api/admin/matches/${matchId}/force-resolve`, { winner_crew_id: winner });
            toast('MATCH FORCE-RESOLVED BY X.');
            bindXConsole();
          } catch(e) { toast(e.message); }
        });
      });

      document.querySelectorAll('.xc-resolve-report-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await api('POST', `/api/admin/reports/${btn.dataset.reportId}/resolve`);
            toast('REPORT MARKED REVIEWED.');
            bindXConsole();
          } catch(e) { toast(e.message); }
        });
      });
    }).catch(e => {
      const el = document.getElementById('xconsole-content');
      if (el) el.innerHTML = `<div class="empty-state">ACCESS DENIED.</div>`;
    });
  }

  // ── MATCH DETAIL ──
  function renderMatchDetail() {
    if (!activeMatchDetail) return `<div class="empty-state">LOADING...</div>`;
    const { match: m, lineups } = activeMatchDetail;
    const statusColors = { negotiating:'tag-amber', locked:'tag-volt', active:'tag-volt', disputed:'tag-red', resolved:'tag-green', voided:'tag-muted' };
    const challengerLineup = lineups.filter(p => p.crew_id === m.challenger_crew_id);
    const defenderLineup = lineups.filter(p => p.crew_id === m.defender_crew_id);

    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <button class="btn btn-outline btn-sm" onclick="App.nav('matches')">← BACK</button>
        <div class="section-head" style="margin:0;border:none;flex:1;">MATCH #${m.id}</div>
        <span class="tag ${statusColors[m.status] || 'tag-muted'}">${m.status.toUpperCase()}</span>
      </div>

      <div class="card" style="margin-bottom:12px;">
        <div style="display:flex;align-items:center;justify-content:space-around;padding:12px 0;">
          <div style="text-align:center;">
            <div style="width:12px;height:12px;border-radius:50%;background:${m.challenger_color};margin:0 auto 4px;"></div>
            <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:15px;${m.winner_crew_id === m.challenger_crew_id ? 'color:var(--volt)' : ''}">${m.challenger_name}</div>
          </div>
          <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:13px;color:var(--muted);">VS</div>
          <div style="text-align:center;">
            <div style="width:12px;height:12px;border-radius:50%;background:${m.defender_color};margin:0 auto 4px;"></div>
            <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:15px;${m.winner_crew_id === m.defender_crew_id ? 'color:var(--volt)' : ''}">${m.defender_name}</div>
          </div>
        </div>
        ${m.challenger_reported_score && m.status === 'resolved' ? `
          <div style="text-align:center;font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:22px;color:var(--volt);padding:8px 0;">${m.challenger_reported_score}</div>
        ` : ''}
        <div class="stat-row"><span class="stat-label">Format</span><span class="stat-value">${m.format_type}</span></div>
        <div class="stat-row"><span class="stat-label">Court</span><span class="stat-value">${m.court_name || '—'}</span></div>
        ${m.wager_amount > 0 ? `<div class="stat-row"><span class="stat-label">Wager</span><span class="stat-value coins-display">⚡ ${m.wager_amount}</span></div>` : ''}
        ${m.scheduled_time ? `<div class="stat-row"><span class="stat-label">Scheduled</span><span class="stat-value">${new Date(m.scheduled_time).toLocaleString()}</span></div>` : ''}
        ${m.disputed_at ? `<div class="stat-row"><span class="stat-label">Disputed</span><span class="stat-value" style="color:var(--red)">${new Date(m.disputed_at).toLocaleString()}</span></div>` : ''}
        ${m.winner_name ? `<div class="stat-row"><span class="stat-label">Winner</span><span class="stat-value" style="color:var(--volt)">${m.winner_name}</span></div>` : ''}
        ${m.hype_count > 0 ? `<div class="stat-row"><span class="stat-label">Hype</span><span class="stat-value" style="color:var(--amber)">🔥 ${m.hype_count}</span></div>` : ''}
      </div>

      ${m.x_message ? `
        <div class="card" style="border-color:var(--muted);margin-bottom:12px;">
          <div style="font-size:12px;color:var(--muted);font-style:italic;">${m.x_message}</div>
        </div>
      ` : ''}

      ${lineups.length ? `
        <div class="section-head">LINEUPS</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div>
            <div style="font-family:'Big Shoulders Display',sans-serif;font-size:11px;letter-spacing:0.1em;color:var(--muted);margin-bottom:6px;">${m.challenger_name}</div>
            ${challengerLineup.map(p => `
              <div style="padding:6px 10px;background:var(--bg2);border:1px solid var(--border);border-radius:4px;margin-bottom:4px;cursor:pointer;" onclick="App.navPlayerProfile(${p.user_id})">
                <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:12px;">${p.username}</div>
                <div style="font-size:10px;color:var(--muted);">${p.wins}W · ${p.losses}L</div>
              </div>
            `).join('')}
          </div>
          <div>
            <div style="font-family:'Big Shoulders Display',sans-serif;font-size:11px;letter-spacing:0.1em;color:var(--muted);margin-bottom:6px;">${m.defender_name}</div>
            ${defenderLineup.map(p => `
              <div style="padding:6px 10px;background:var(--bg2);border:1px solid var(--border);border-radius:4px;margin-bottom:4px;cursor:pointer;" onclick="App.navPlayerProfile(${p.user_id})">
                <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:12px;">${p.username}</div>
                <div style="font-size:10px;color:var(--muted);">${p.wins}W · ${p.losses}L</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;
  }

  function bindMatchDetail() {}

  // ── COURT HISTORY ──
  function renderCourtHistory() {
    if (!activeCourtHistory) return `<div class="empty-state">LOADING...</div>`;
    const { court, history } = activeCourtHistory;
    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <button class="btn btn-outline btn-sm" onclick="App.nav('map')">← MAP</button>
        <div class="section-head" style="margin:0;border:none;flex:1;">${court.name}</div>
      </div>

      <div class="card" style="margin-bottom:12px;">
        <div class="stat-row"><span class="stat-label">Type</span><span class="stat-value">${court.type.toUpperCase()}</span></div>
        ${court.holder_name ? `
          <div class="stat-row"><span class="stat-label">Current Holder</span>
            <span class="stat-value" style="color:${court.holder_color}">${court.holder_name}</span>
          </div>
          ${court.turf_held_since ? `<div class="stat-row"><span class="stat-label">Held Since</span><span class="stat-value">${new Date(court.turf_held_since).toLocaleDateString()}</span></div>` : ''}
        ` : `<div class="stat-row"><span class="stat-label">Holder</span><span class="stat-value" style="color:var(--muted)">UNCLAIMED</span></div>`}
        <div class="stat-row"><span class="stat-label">Decline Count</span><span class="stat-value">${court.holder_decline_count}/3</span></div>
      </div>

      <div class="section-head">MATCH HISTORY</div>
      ${history.length ? history.map(m => `
        <div class="card" style="margin-bottom:6px;border-left:3px solid ${m.winner_color || 'var(--border)'};">
          <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:13px;">
            ${m.challenger_name} <span style="color:var(--muted)">VS</span> ${m.defender_name}
          </div>
          ${m.winner_name ? `<div style="font-size:12px;color:var(--volt);margin-top:4px;">Winner: ${m.winner_name}</div>` : ''}
          ${m.challenger_reported_score ? `<div style="font-size:11px;color:var(--muted);margin-top:2px;">${m.challenger_reported_score}</div>` : ''}
        </div>
      `).join('') : `<div class="empty-state" style="padding:12px 0;">No matches played here yet.</div>`}
    `;
  }

  // ── PLAYER PROFILE ──
  function renderPlayerProfile() {
    if (!activePlayerData) return `<div class="empty-state">LOADING...</div>`;
    const { player, crews, recentMatches, crewFlair = {} } = activePlayerData;
    const winPct = player.total_appearances > 0 ? Math.round((player.wins / player.total_appearances) * 100) : 0;
    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <button class="btn btn-outline btn-sm" onclick="history.back()">← BACK</button>
        <div class="section-head" style="margin:0;border:none;flex:1;">${player.username}</div>
        <span class="tag tag-muted">${player.tier.toUpperCase()}</span>
      </div>

      <div class="card">
        <div class="stat-row"><span class="stat-label">Appearances</span><span class="stat-value">${player.total_appearances}</span></div>
        <div class="stat-row"><span class="stat-label">Wins</span><span class="stat-value" style="color:var(--volt)">${player.wins}</span></div>
        <div class="stat-row"><span class="stat-label">Losses</span><span class="stat-value" style="color:var(--red)">${player.losses}</span></div>
        <div class="stat-row"><span class="stat-label">Win %</span><span class="stat-value">${winPct}%</span></div>
      </div>

      <div class="section-head">CREWS</div>
      ${crews.map(c => `
        <div class="card" style="margin-bottom:6px;border-left:3px solid ${c.map_color_hex};cursor:pointer;" onclick="App.viewCrewProfile(${c.id})">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:14px;">${c.name}${flairBadge(crewFlair[c.id])}</div>
              <div style="font-size:11px;color:var(--muted);">${c.sport_type}</div>
            </div>
            ${c.is_boss ? `<span class="tag tag-volt">BOSS</span>` : ''}
          </div>
        </div>
      `).join('') || `<div class="empty-state" style="padding:12px 0;">Not on any crews.</div>`}

      <div class="section-head">RECENT MATCHES</div>
      ${recentMatches.map(m => `
        <div class="card" style="margin-bottom:6px;border-left:3px solid ${m.winner_crew_id ? 'var(--volt)' : 'var(--border)'};">
          <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:13px;">
            ${m.challenger_name || '?'} <span style="color:var(--muted)">VS</span> ${m.defender_name || '?'}
          </div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px;">
            ${m.format_type} · ${m.status.toUpperCase()}
            ${m.winner_name ? ` · <span style="color:var(--volt)">W: ${m.winner_name}</span>` : ''}
          </div>
        </div>
      `).join('') || `<div class="empty-state" style="padding:12px 0;">No matches yet.</div>`}

      ${state.user && player.id !== state.user.id ? `
        <div class="section-head" style="margin-top:20px;border-color:var(--red);color:var(--red);">ACTIONS</div>
        <div id="player-action-msg" style="margin-bottom:8px;"></div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-outline btn-sm" id="btn-report-player" style="flex:1;">REPORT</button>
          <button class="btn btn-danger btn-sm" id="btn-block-player" style="flex:1;">BLOCK</button>
        </div>
      ` : ''}
    `;
  }

  function bindPlayerProfile() {
    const { player } = activePlayerData;
    if (!state.user || player.id === state.user.id) return;

    document.getElementById('btn-report-player')?.addEventListener('click', async () => {
      const reason = prompt('Reason for report:');
      if (!reason) return;
      const msgEl = document.getElementById('player-action-msg');
      try {
        await api('POST', '/api/reports', { reported_user_id: player.id, reason });
        msgEl.innerHTML = '<div class="msg-success">Report submitted.</div>';
      } catch(e) { msgEl.innerHTML = `<div class="msg-error">${e.message}</div>`; }
    });

    document.getElementById('btn-block-player')?.addEventListener('click', async () => {
      if (!confirm(`Block ${player.username}? They won't be able to challenge you.`)) return;
      const msgEl = document.getElementById('player-action-msg');
      try {
        await api('POST', '/api/blocks', { blocked_user_id: player.id });
        msgEl.innerHTML = '<div class="msg-success">User blocked.</div>';
      } catch(e) { msgEl.innerHTML = `<div class="msg-error">${e.message}</div>`; }
    });
  }

  // ── LEADERBOARD ──
  function renderLeaderboard() {
    if (!leaderboardData) return `<div class="section-head">LEADERBOARD</div><div class="empty-state">LOADING...</div>`;
    const { currentSeason, standings, pastSeasons } = leaderboardData;

    return `
      <div class="section-head">LEADERBOARD</div>
      ${currentSeason ? `<div style="font-size:11px;color:var(--muted);margin-bottom:12px;">Season: ${currentSeason.name} · Ends ${new Date(currentSeason.end_date).toLocaleDateString()}</div>` : ''}

      <div class="section-head" style="font-size:11px;">CURRENT STANDINGS</div>
      ${standings.map((c, i) => `
        <div class="card" style="margin-bottom:6px;display:flex;align-items:center;gap:10px;border-left:3px solid ${i < 3 ? 'var(--volt)' : 'var(--border)'};cursor:pointer;" onclick="App.viewCrewProfile(${c.id})">
          <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:16px;color:var(--muted);min-width:24px;">${i + 1}</div>
          <div style="width:10px;height:10px;border-radius:50%;background:${c.map_color_hex};flex-shrink:0;"></div>
          <div style="flex:1;">
            <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:13px;">${c.name}</div>
            <div style="font-size:11px;color:var(--muted);">${c.season_wins}W · ${c.season_losses}L · 🔥${c.current_win_streak}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
            <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:13px;color:var(--volt);">${c.reputation_score} REP</div>
            <div style="font-size:10px;color:var(--muted);">VIEW →</div>
          </div>
        </div>
      `).join('') || `<div class="empty-state" style="padding:12px 0;">No crews yet.</div>`}

      ${Object.values(pastSeasons).map(({ season, results }) => `
        <div class="section-head" style="margin-top:20px;font-size:11px;">${season.name.toUpperCase()} — FINAL STANDINGS</div>
        ${results[0] ? `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg2);border:2px solid var(--volt);border-radius:4px;margin-bottom:6px;">
            <div style="font-size:18px;">🏆</div>
            <div style="width:10px;height:10px;border-radius:50%;background:${results[0].map_color_hex};flex-shrink:0;"></div>
            <div style="flex:1;">
              <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:14px;color:var(--volt);">${results[0].crew_name}</div>
              <div style="font-size:11px;color:var(--muted);">SEASON MVP · ${results[0].final_reputation} REP</div>
            </div>
          </div>
        ` : ''}
        ${results.slice(1).map((r) => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:4px;margin-bottom:4px;">
            <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:14px;color:var(--muted);min-width:24px;">${r.final_rank}</div>
            <div style="width:10px;height:10px;border-radius:50%;background:${r.map_color_hex};flex-shrink:0;"></div>
            <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:13px;flex:1;">${r.crew_name}</div>
            <div style="font-size:12px;color:var(--muted);">${r.final_reputation} REP</div>
          </div>
        `).join('')}
      `).join('')}
    `;
  }

  function bindLeaderboard() {
    api('GET', '/api/seasons/leaderboard').then(data => {
      leaderboardData = data;
      const el = document.getElementById('main-content');
      if (el && state.view === 'leaderboard') el.innerHTML = renderLeaderboard();
    }).catch(() => {});
  }

  // ── INIT ──
  // ── JOIN CREW (invite link landing) ──
  function renderJoinCrew() {
    const inv = joinInviteData;
    if (!inv) return `<div class="empty-state">INVALID INVITE LINK</div>`;
    return `
      <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;">
        <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:28px;letter-spacing:0.05em;color:var(--volt);margin-bottom:8px;">YOU'RE INVITED</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:24px;">by ${inv.invited_by_username}</div>
        <div style="width:16px;height:16px;border-radius:50%;background:${inv.map_color_hex};margin:0 auto 12px;"></div>
        <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:22px;margin-bottom:6px;">${inv.crew_name}</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:24px;">${inv.sport_type} · ${inv.age_class} · ${inv.gender_class}</div>
        <button class="btn btn-volt btn-full" id="btn-join-signup" style="max-width:320px;">JOIN THE CREW →</button>
        <button class="btn btn-outline btn-full" id="btn-join-login" style="max-width:320px;margin-top:10px;">I ALREADY HAVE AN ACCOUNT</button>
      </div>
    `;
  }

  function bindJoinCrew() {
    document.getElementById('btn-join-signup')?.addEventListener('click', () => show('login'));
    document.getElementById('btn-join-login')?.addEventListener('click', async () => {
      // Already logged in — join directly
      if (state.user) {
        try {
          const token = joinInviteData._token;
          await api('POST', `/api/invite/${token}/claim`);
          // Trigger accept via the existing invite flow by reloading invites
          toast('INVITE CLAIMED — CHECK YOUR PROFILE TO ACCEPT');
          await loadAppData();
          show('profile');
        } catch(e) { toast(e.message); }
      } else {
        show('login');
      }
    });
  }

  async function init() {
    // Detect /join/:token URL
    const joinMatch = location.pathname.match(/^\/join\/([a-f0-9]{48})$/);
    if (joinMatch) {
      const token = joinMatch[1];
      try {
        const data = await api('GET', `/api/invite/${token}`);
        joinInviteData = { ...data.invite, _token: token };
        // Stash token in session for post-signup auto-join
        await api('POST', `/api/invite/${token}/claim`);
        show('join-crew');
        return;
      } catch(e) {
        // Invalid/expired — fall through to normal flow
      }
    }

    try {
      const me = await api('GET', '/api/auth/me');
      if (me.authenticated) {
        state.user = me.user;
        await loadAppData();
        show('home');
      } else {
        // First-time visitors get the intro; returning visitors go straight to login
        let seenIntro = false;
        try { seenIntro = localStorage.getItem('street_seen_intro') === '1'; } catch (_) {}
        show(seenIntro ? 'login' : 'landing');
      }
    } catch (e) {
      show('login');
    }
  }

  // ── WIRE ACTIONS ──
  async function refreshWire() {
    try {
      const res = await fetch('/api/wire');
      const data = await res.json();
      wireData = data;
      render();
    } catch(e) {}
  }

  async function hype(matchId, btn) {
    try {
      const res = await api('POST', `/api/matches/${matchId}/hype`);
      if (res.already_hyped) { btn.disabled = true; btn.style.opacity = '0.5'; return; }
      const countEl = btn.querySelector('.hype-count');
      if (countEl) countEl.textContent = res.hype_count;
      btn.style.color = 'var(--amber)';
      btn.disabled = true;
      if (res.hype_count === 10) toast('🔥 HYPE THRESHOLD HIT! BOTH CREWS GOT BONUS COINS.');
    } catch(e) {}
  }

  // ── QUEST ACTIONS ──
  async function claimQuest(questId, crewId) {
    const errEl = document.getElementById('quests-error');
    const sucEl = document.getElementById('quests-success');
    if (errEl) errEl.style.display = 'none';
    if (sucEl) sucEl.style.display = 'none';
    try {
      const res = await api('POST', `/api/quests/${questId}/claim`, { crew_id: crewId });
      toast(`⚡ +${res.coins_earned} COINS CLAIMED!`);
      await loadAppData();
      bindQuests();
    } catch(e) {
      if (errEl) { errEl.textContent = e.message; errEl.style.display = 'block'; }
    }
  }

  // ── CREW PROFILE NAVIGATION ──
  async function viewCrewProfile(crewId) {
    try {
      const res = await api('GET', `/api/crews/${crewId}/profile`);
      crewProfileData = res;
      show('crew-profile');
    } catch(e) { toast('Could not load crew profile.'); }
  }

  // ── SUBMIT TURF MODAL ──
  function openSubmitCourtModal() {
    const crew = state.myCrews.find(c => c.id === state.activeCrewId);
    if (!crew) { toast('BUILD A CREW FIRST.'); return; }

    let chosenLatLng = null;
    let geocodeDebounce = null;

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-title">SUBMIT A TURF</div>
        <div id="sc-fee-preview" style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:12px;color:var(--volt);margin-bottom:12px;">Loading fee...</div>

        <!-- Step 1: search -->
        <div id="sc-step-search">
          <div class="form-field" style="margin-bottom:8px;">
            <label class="form-label">FIND THE LOCATION</label>
            <input class="form-input" id="sc-address" placeholder="ADDRESS OR PLACE NAME..." autocomplete="off">
          </div>
          <div id="sc-geo-results"></div>
        </div>

        <!-- Step 2: confirm (hidden until location picked) -->
        <div id="sc-step-confirm" style="display:none;">
          <div style="font-size:11px;color:var(--muted);margin-bottom:8px;" id="sc-location-label"></div>
          <div class="form-field">
            <label class="form-label">TURF NAME</label>
            <input class="form-input" id="sc-name" placeholder="WEST SIDE TURF">
          </div>
          <button class="btn btn-outline btn-sm" id="btn-sc-back" style="margin-bottom:8px;">← CHANGE LOCATION</button>
        </div>

        <div id="sc-error" class="msg-error" style="display:none;margin-top:8px;"></div>
        <button class="btn btn-volt btn-full" id="btn-submit-court" style="margin-top:12px;display:none;">SUBMIT TURF</button>
        <button class="btn btn-outline btn-full" id="btn-cancel-sc" style="margin-top:8px;">CANCEL</button>
      </div>
    `;
    document.body.appendChild(backdrop);

    api('GET', `/api/courts/submit/fee?crew_id=${crew.id}`).then(feeRes => {
      const el = backdrop.querySelector('#sc-fee-preview');
      if (el) {
        el.textContent = feeRes.can_afford
          ? `SUBMISSION FEE: ⚡ ${feeRes.fee} COINS (balance: ${feeRes.balance})`
          : `⚡ ${feeRes.fee} COINS REQUIRED — YOU HAVE ${feeRes.balance}`;
        if (!feeRes.can_afford) el.style.color = 'var(--red)';
      }
    }).catch(() => {});

    backdrop.querySelector('#btn-cancel-sc').addEventListener('click', () => backdrop.remove());

    backdrop.querySelector('#btn-sc-back')?.addEventListener('click', () => {
      chosenLatLng = null;
      backdrop.querySelector('#sc-step-search').style.display = 'block';
      backdrop.querySelector('#sc-step-confirm').style.display = 'none';
      backdrop.querySelector('#btn-submit-court').style.display = 'none';
      backdrop.querySelector('#sc-address').value = '';
      backdrop.querySelector('#sc-geo-results').innerHTML = '';
    });

    backdrop.querySelector('#sc-address').addEventListener('input', (e) => {
      clearTimeout(geocodeDebounce);
      const q = e.target.value.trim();
      const resultsEl = backdrop.querySelector('#sc-geo-results');
      if (q.length < 3) { resultsEl.innerHTML = ''; return; }
      resultsEl.innerHTML = `<div style="font-size:11px;color:var(--muted);padding:6px 0;">Searching...</div>`;
      geocodeDebounce = setTimeout(async () => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`, {
            headers: { 'Accept-Language': 'en', 'User-Agent': 'TheStreetApp/1.0' }
          });
          const results = await res.json();
          if (!results.length) { resultsEl.innerHTML = `<div style="font-size:12px;color:var(--muted);padding:6px 0;">No results.</div>`; return; }
          resultsEl.innerHTML = results.map((r, i) => `
            <div data-idx="${i}" style="padding:10px 12px;border:1px solid var(--border);border-radius:4px;margin-top:6px;cursor:pointer;background:rgba(255,255,255,0.03);">
              <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;font-size:13px;">${r.display_name.split(',')[0]}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px;">${r.display_name.split(',').slice(1,3).join(',').trim()}</div>
            </div>
          `).join('');
          resultsEl._results = results;
          resultsEl.querySelectorAll('[data-idx]').forEach(el => {
            el.addEventListener('click', () => {
              const r = resultsEl._results[parseInt(el.dataset.idx)];
              chosenLatLng = { lat: parseFloat(r.lat), lng: parseFloat(r.lon) };
              const placeName = r.display_name.split(',')[0];
              backdrop.querySelector('#sc-name').value = placeName;
              backdrop.querySelector('#sc-location-label').textContent = r.display_name.split(',').slice(0,3).join(',');
              backdrop.querySelector('#sc-step-search').style.display = 'none';
              backdrop.querySelector('#sc-step-confirm').style.display = 'block';
              backdrop.querySelector('#btn-submit-court').style.display = 'block';
              setTimeout(() => { const ni = backdrop.querySelector('#sc-name'); ni?.focus(); ni?.select(); }, 80);
            });
          });
        } catch(_) { resultsEl.innerHTML = `<div style="font-size:12px;color:var(--red);padding:6px 0;">Search failed.</div>`; }
      }, 400);
    });

    backdrop.querySelector('#btn-submit-court').addEventListener('click', async () => {
      const name = backdrop.querySelector('#sc-name').value.trim();
      const errEl = backdrop.querySelector('#sc-error');
      errEl.style.display = 'none';
      if (!name) { errEl.textContent = 'Give this turf a name.'; errEl.style.display = 'block'; return; }
      if (!chosenLatLng) { errEl.textContent = 'Pick a location first.'; errEl.style.display = 'block'; return; }
      try {
        const res = await api('POST', '/api/courts/submit', { name, latitude: chosenLatLng.lat, longitude: chosenLatLng.lng, crew_id: crew.id });
        toast(`📍 ${name} SUBMITTED — ⚡ ${res.fee_paid} COINS SPENT`);
        backdrop.remove();
        await loadAppData();
      } catch(e) { errEl.textContent = e.message; errEl.style.display = 'block'; }
    });
  }

  // ── CREW SEARCH (crews tab) ──
  let tabSearchDebounce = null;
  function searchCrewsTab(q) {
    clearTimeout(tabSearchDebounce);
    const el = document.getElementById('crew-search-tab-results');
    if (!el) return;
    if (!q || q.trim().length < 2) { el.innerHTML = ''; return; }
    tabSearchDebounce = setTimeout(async () => {
      try {
        const res = await api('GET', `/api/crews/search?q=${encodeURIComponent(q)}`);
        if (!res.crews.length) {
          el.innerHTML = `<div style="font-size:12px;color:var(--muted);padding:8px 0;">No crews found.</div>`;
          return;
        }
        el.innerHTML = res.crews.map(c => {
          const [tierLabel, tierClass] = crewTier(c.reputation_score);
          return `
            <div class="card" style="border-left:3px solid ${c.map_color_hex};cursor:pointer;margin-bottom:8px;"
              onclick="App.viewCrewProfile(${c.id})">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <div class="card-title" style="font-size:14px;">${c.name}</div>
                  <div class="card-sub">${c.sport_type} · ${c.age_class} · REP ${c.reputation_score}</div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
                  <span class="tier-badge ${tierClass}">${tierLabel}</span>
                  <span style="color:var(--volt);font-size:14px;">→</span>
                </div>
              </div>
            </div>
          `;
        }).join('');
      } catch(e) {}
    }, 280);
  }

  // ── CREW SEARCH (for callout view) ──
  let searchDebounce = null;
  async function searchCrews(q) {
    clearTimeout(searchDebounce);
    const resultsEl = document.getElementById('co-search-results');
    if (!resultsEl) return;
    if (!q || q.trim().length < 2) { resultsEl.innerHTML = ''; return; }
    searchDebounce = setTimeout(async () => {
      try {
        const res = await api('GET', `/api/crews/search?q=${encodeURIComponent(q)}`);
        const crews = res.crews.filter(c => c.id !== state.activeCrewId);
        if (!crews.length) {
          resultsEl.innerHTML = `<div style="font-size:12px;color:var(--muted);padding:8px 0;">No crews found.</div>`;
          return;
        }
        resultsEl.innerHTML = crews.map(c => `
          <div onclick="App.selectDefender(${c.id}, '${c.name.replace(/'/g,"\\'")}', '${c.map_color_hex}')"
            style="display:flex;align-items:center;gap:10px;padding:10px 12px;
              background:var(--bg2);border:1px solid var(--border);border-radius:4px;
              margin-top:4px;cursor:pointer;">
            <div style="width:10px;height:10px;border-radius:50%;background:${c.map_color_hex};flex-shrink:0;"></div>
            <div style="flex:1;">
              <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;letter-spacing:0.05em;">${c.name}</div>
              <div style="font-size:11px;color:var(--muted);">${c.sport_type} · ${c.age_class} · REP ${c.reputation_score}</div>
            </div>
            <span style="color:var(--volt);font-size:18px;">→</span>
          </div>
        `).join('');
      } catch (e) {}
    }, 280);
  }

  function selectDefender(id, name, color) {
    calloutState.defenderCrewId = id;
    calloutState.defenderCrewName = name;
    const resultsEl = document.getElementById('co-search-results');
    const chosenEl = document.getElementById('co-defender-chosen');
    const searchEl = document.getElementById('co-search');
    if (resultsEl) resultsEl.innerHTML = '';
    if (searchEl) searchEl.value = '';
    if (chosenEl) {
      chosenEl.style.display = 'block';
      chosenEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;"></div>
          <span style="font-family:'Big Shoulders Display',sans-serif;font-weight:900;">${name}</span>
          <button onclick="App.clearDefender()" style="margin-left:auto;background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;">✕</button>
        </div>
      `;
    }
  }

  function clearDefender() {
    calloutState.defenderCrewId = null;
    calloutState.defenderCrewName = null;
    const chosenEl = document.getElementById('co-defender-chosen');
    if (chosenEl) chosenEl.style.display = 'none';
  }

  function pickFormat(fmt) {
    calloutState.format = fmt;
    calloutState.selectedLineup = [];
    document.querySelectorAll('.format-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.format === fmt);
    });
    renderLineupPicker();
  }

  function toggleLineup(userId) {
    const formatCount = parseInt((calloutState.format || '3v3').split('v')[0]);
    if (calloutState.selectedLineup.includes(userId)) {
      calloutState.selectedLineup = calloutState.selectedLineup.filter(id => id !== userId);
    } else if (calloutState.selectedLineup.length < formatCount) {
      calloutState.selectedLineup.push(userId);
    }
    renderLineupPicker();
  }

  function adjustWager(delta) {
    const el = document.getElementById('co-wager');
    if (!el) return;
    const crew = state.myCrews.find(c => c.id === state.activeCrewId);
    const max = crew?.coin_balance || 0;
    const newVal = Math.max(0, Math.min(max, (parseInt(el.value) || 0) + delta));
    el.value = newVal;
  }

  // Public API for onclick= handlers in templates
  return {
    nav: async (view) => { await loadAppData(); show(view); },
    viewCrew: async (id) => {
      state.activeCrewId = id;
      const res = await api('GET', `/api/crews/${id}`);
      crewDetailData = res;
      show('crew-detail');
    },
    selectColor: (color) => {
      selectedColor = color;
      document.querySelectorAll('.color-swatch').forEach(s => {
        s.style.borderColor = s.dataset.color === color ? '#fff' : 'transparent';
      });
    },
    searchCrewsTab,
    searchCrews,
    selectDefender,
    clearDefender,
    pickFormat,
    toggleLineup,
    adjustWager,
    openAcceptModal,
    declineMatch,
    openScoreModal,
    refreshWire,
    hype,
    claimQuest,
    viewCrewProfile,
    openSubmitCourtModal,
    navTurfWars: async () => {
      await loadAppData();
      const d = await api('GET', '/api/tournaments');
      tournamentsData = d.tournaments;
      show('turf-wars');
    },
    viewTournament: async (id) => {
      activeTournamentId = id;
      const d = await api('GET', `/api/tournaments/${id}`);
      activeTournamentDetail = d;
      show('tournament-detail');
    },
    navStore: async () => {
      await loadAppData();
      show('store');
    },
    navVenueDashboard: () => show('venue-dashboard'),
    navXConsole: () => show('x-console'),
    navLeaderboard: async () => {
      try {
        const data = await api('GET', '/api/seasons/leaderboard');
        leaderboardData = data;
      } catch (_) {}
      show('leaderboard');
    },
    navPlayerProfile: async (userId) => {
      try {
        const data = await api('GET', `/api/players/${userId}`);
        activePlayerData = data;
        show('player-profile');
      } catch(e) { toast(e.message); }
    },
    navMatchDetail: async (matchId) => {
      try {
        const data = await api('GET', `/api/matches/${matchId}/detail`);
        activeMatchDetail = data;
        show('match-detail');
      } catch(e) { toast(e.message); }
    },
    navCourtHistory: async (courtId) => {
      try {
        const data = await api('GET', `/api/courts/${courtId}/history`);
        activeCourtHistory = data;
        show('court-history');
      } catch(e) { toast(e.message); }
    },
    nav: (viewId) => show(viewId),
    init,
  };
})();

App.init();
