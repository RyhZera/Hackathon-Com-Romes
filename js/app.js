(() => {
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');

    // HUD
    const hud = {
        timer: document.getElementById('hud-timer'),
        score: document.getElementById('hud-score'),
        best: document.getElementById('hud-best'),
        startBtn: document.getElementById('btn-start'),
        restartBtn: document.getElementById('btn-restart'),
        overlayLose: document.getElementById('overlay-lose'),
        tryAgain: document.getElementById('btn-try-again')
    };

    const store = {
        read(k, f) { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } },
        write(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
    };

    const W = canvas.width, H = canvas.height;
    let walls = [], doors = [], rooms = [];
    const labels = ['A', 'B', 'C', 'D'];
    let corridor;

    function buildWorld() {
        walls = []; doors = []; rooms = [];
        corridor = { x: 100, y: 210, w: W - 200, h: 100 };

        // Paredes externas
        walls.push({ x: 20, y: 20, w: W - 40, h: 10 });
        walls.push({ x: 20, y: H - 30, w: W - 40, h: 10 });
        walls.push({ x: 20, y: 20, w: 10, h: H - 40 });
        walls.push({ x: W - 30, y: 20, w: 10, h: H - 40 });

        const topY = 60, botY = H - (topY + 120);
        const roomW = 300, roomH = 120, gap = 60;
        const startX = (W - (roomW * 2 + gap)) / 2;

        function makeRoom(x, y, label, openToDown) {
            rooms.push({ x, y, w: roomW, h: roomH, label });
            // paredes laterais
            walls.push({ x, y, w: 8, h: roomH }); // esquerda
            walls.push({ x: x + roomW - 8, y: y, w: 8, h: roomH }); // direita

            const doorW = 56, doorX = x + roomW / 2 - doorW / 2;

            if (openToDown) { // topo: abertura na base (sempre aberta)
                const seg = (roomW - doorW) / 2;
                walls.push({ x, y, w: roomW, h: 8 });                           // topo
                walls.push({ x, y: y + roomH - 8, w: seg, h: 8 });                   // base esq
                walls.push({ x: x + roomW - seg, y: y + roomH - 8, w: seg, h: 8 });      // base dir
                doors.push({ x: doorX, y: y + roomH - 8, w: doorW, h: 8, label });
            } else { // fundo: abertura no topo (sempre aberta)
                const seg = (roomW - doorW) / 2;
                walls.push({ x, y, w: seg, h: 8 });                              // topo esq
                walls.push({ x: x + roomW - seg, y: y, w: seg, h: 8 });              // topo dir
                walls.push({ x, y: y + roomH - 8, w: roomW, h: 8 });                 // base
                doors.push({ x: doorX, y: y, w: doorW, h: 8, label });
            }
        }

        // Top: A, B
        makeRoom(startX + 0 * (roomW + gap), topY, 'A', true);
        makeRoom(startX + 1 * (roomW + gap), topY, 'B', true);
        // Bottom: C, D
        makeRoom(startX + 0 * (roomW + gap), botY, 'C', false);
        makeRoom(startX + 1 * (roomW + gap), botY, 'D', false);
    }

    // Player
    const player = { x: W / 2, y: H / 2, r: 10, speed: 3, color: '#0d6efd' };
    let keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, w: false, a: false, s: false, d: false };

    // Estado
    const state = {
        running: false,
        target: null,     // sala correta (oculta)
        timeLeft: 20,
        score: 0,
        best: store.read('best-score-hidden', 0),
        lastTick: 0
    };

    function randChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function circleRectCollide(cx, cy, r, rect) {
        const testX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
        const testY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
        const dx = cx - testX, dy = cy - testY;
        return (dx * dx + dy * dy) <= r * r;
    }

    function newObjective() {
        state.target = randChoice(labels);
        state.timeLeft = 20;
    }

    function resetGame() {
        state.running = false;
        state.score = 0;
        player.x = W / 2; player.y = H / 2;
        hud.score.textContent = state.score;
        hud.timer.textContent = '00';
        hud.overlayLose.classList.add('d-none');
        buildWorld();
    }

    function startGame() {
        if (!state.running) {
            state.running = true;
            player.x = W / 2; player.y = H / 2;
            newObjective();
            state.lastTick = performance.now();
            requestAnimationFrame(loop);
        }
    }

    window.addEventListener('keydown', e => { if (e.key in keys) { keys[e.key] = true; e.preventDefault(); } });
    window.addEventListener('keyup', e => { if (e.key in keys) { keys[e.key] = false; e.preventDefault(); } });

    hud.startBtn.addEventListener('click', startGame);
    hud.restartBtn.addEventListener('click', () => { resetGame(); startGame(); });
    hud.tryAgain.addEventListener('click', () => { resetGame(); startGame(); });

    function tryMove(dx, dy) {
        const nx = player.x + dx, ny = player.y + dy;
        const collides = walls.some(w => circleRectCollide(nx, ny, player.r, w));
        if (!collides) { player.x = nx; player.y = ny; }
    }

    function handleInput() {
        let dx = 0, dy = 0, sp = player.speed;
        if (keys.ArrowUp || keys.w) dy -= sp;
        if (keys.ArrowDown || keys.s) dy += sp;
        if (keys.ArrowLeft || keys.a) dx -= sp;
        if (keys.ArrowRight || keys.d) dx += sp;
        if (dx || dy) tryMove(dx, dy);
    }

    function checkRooms() {
        // verifica se o player entrou em alguma sala
        for (const r of rooms) {
            const inner = { x: r.x + 10, y: r.y + 10, w: r.w - 20, h: r.h - 20 };
            if (player.x > inner.x && player.x < inner.x + inner.w && player.y > inner.y && player.y < inner.y + inner.h) {
                if (r.label === state.target) {
                    // acerto: pontua e nova rodada com alvo oculto
                    const gained = 100 + Math.ceil(state.timeLeft * 5);
                    state.score += gained;
                    hud.score.textContent = state.score;
                    if (state.score > state.best) { state.best = state.score; store.write('best-score-hidden', state.best); hud.best.textContent = state.best; }
                    player.x = W / 2; player.y = H / 2;
                    newObjective();
                } else {
                    // errou: perde
                    lose();
                }
                return;
            }
        }
    }

    function draw() {
        // fundo
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);

        // corredor
        ctx.fillStyle = '#e9ecef';
        ctx.fillRect(corridor.x, corridor.y, corridor.w, corridor.h);

        // salas e portas (todas abertas visualmente)
        rooms.forEach(r => {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(r.x, r.y, r.w, r.h);
            ctx.fillStyle = '#000';
            ctx.font = 'bold 20px system-ui, -apple-system, Segoe UI, Roboto';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`Sala ${r.label}`, r.x + r.w / 2, r.y + r.h / 2);
        });

        // portas (todas abertas)
        ctx.fillStyle = '#198754';
        doors.forEach(d => ctx.fillRect(d.x, d.y, d.w, d.h));

        // paredes
        ctx.fillStyle = '#212529';
        walls.forEach(w => ctx.fillRect(w.x, w.y, w.w, w.h));

        // player
        ctx.beginPath();
        ctx.fillStyle = '#0d6efd';
        ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
    }

    function lose() {
        state.running = false;
        hud.overlayLose.classList.remove('d-none');
    }

    function loop(ts) {
        if (!state.running) return;
        const dt = (ts - state.lastTick) / 1000;
        state.lastTick = ts;

        state.timeLeft -= dt;
        if (state.timeLeft <= 0) {
            hud.timer.textContent = '00';
            draw();
            lose();
            return;
        }
        hud.timer.textContent = String(Math.ceil(state.timeLeft)).padStart(2, '0');

        handleInput();
        checkRooms();
        draw();
        requestAnimationFrame(loop);
    }

    // inicializa
    buildWorld();
    hud.best.textContent = store.read('best-score-hidden', 0);
    (function initialDraw() { draw(); })();
})();