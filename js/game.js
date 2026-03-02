/**
 * CROW'S DESTINY — ゲームループ・状態・当たり判定・描画
 */
(function (global) {
'use strict';

const CFG = global.CrowDestiny.CFG;
const STAGES = global.CrowDestiny.STAGES;
const IMG = global.CrowDestiny.IMG;
const clamp = global.CrowDestiny.clamp;
const dist = global.CrowDestiny.dist;
const rr = global.CrowDestiny.rr;
const ri = global.CrowDestiny.ri;
const Crow = global.CrowDestiny.Crow;
const Enemy = global.CrowDestiny.Enemy;
const Boss = global.CrowDestiny.Boss;
const Relic = global.CrowDestiny.Relic;
const Background = global.CrowDestiny.Background;
const FX = global.CrowDestiny.FX;
const TextOverlay = global.CrowDestiny.TextOverlay;
const EffectOverlay = global.CrowDestiny.EffectOverlay;
const SoundManager = global.CrowDestiny.SoundManager;
const loadAssets = global.CrowDestiny.loadAssets;
const drawHUD = global.CrowDestiny.drawHUD;
const VirtualJoystick = global.CrowDestiny.VirtualJoystick;
const STATE = global.CrowDestiny.STATE;
const PAUSABLE_STATES = global.CrowDestiny.PAUSABLE_STATES;
const checkCollisions = global.CrowDestiny.checkCollisions;
const spawnEnemies = global.CrowDestiny.spawnEnemies;
const spawnObstacles = global.CrowDestiny.spawnObstacles;
const setupTouch = global.CrowDestiny.setupTouch;
const setupJoystickSettingsUI = global.CrowDestiny.setupJoystickSettingsUI;
const drawInstructionsScene = global.CrowDestiny.drawInstructionsScene;
const drawTitleScene = global.CrowDestiny.drawTitleScene;
const drawGameOverScene = global.CrowDestiny.drawGameOverScene;
const drawVictoryScene = global.CrowDestiny.drawVictoryScene;
const drawLastBoss2To3CutsceneScene = global.CrowDestiny.drawLastBoss2To3CutsceneScene;
const drawPauseOverlay = global.CrowDestiny.drawPauseOverlay;
const createGameBulletPool = global.CrowDestiny.createGameBulletPool;
const updateSpecialBullets = global.CrowDestiny.updateSpecialBullets;
const processBulletSplits = global.CrowDestiny.processBulletSplits;
const processExplosiveBullets = global.CrowDestiny.processExplosiveBullets;
const removeInactive = global.CrowDestiny.removeInactive;

/** 1秒あたりの論理フレーム数（dt をかけると「フレーム換算」になる） */
const FPS_BASE = 60;
/** dt の上限（秒）。スパイク吸収で大きなフレーム落ち時に飛びすぎを防ぐ */
const DT_CAP = 0.05;
/** 描画カリング: このマージン（px）外のオブジェクトは描画しない（iOS 描画負荷軽減） */
const CULL_MARGIN = 80;
/** ステージクリア前フリーズ時間（フレーム）。この間は攻撃・残像を止めてから弾・残像をクリアする */
const STAGE_CLEAR_FREEZE_DUR = 30;

class Game {
    constructor() {
        this.cvs = document.getElementById('gameCanvas');
        this.c = this.cvs.getContext('2d');
        this.cvs.width = CFG.W; this.cvs.height = CFG.H;
        this.keys = {};
        this.state = STATE.INSTRUCTIONS;
        this.sound = new SoundManager();
        this.sound.loadSettings();
        this.crow = new Crow(this.sound);
        this.bg = new Background();
        /** FPS に応じた品質（0.25〜1）。adaptiveQualityControl で更新 */
        /* iOS/Android はゲーム開始時から低品質設定でスタートし、FPS が安定したら徐々に上げる */
        const _startQ = global.CrowDestiny.IS_MOBILE ? 0.3 : 1;
        this.qualityParticle = _startQ;
        this.qualityEffect = _startQ;
        this._lastLoopTime = 0;
        /** FPS計測（DEBUG_FPS または #fps で画面表示・最適化検証用） */
        this._fpsFrameCount = 0;
        this._fpsLastTime = 0;
        this._fpsValue = 0;
        /** 毎秒のFPSを溜めて最小・最大・平均を計算（以前 vs 今回の比較用） */
        this._fpsHistory = [];
        this._fpsMin = 0;
        this._fpsMax = 0;
        this._fpsSum = 0;
        this._fpsSamples = 0;
        this.fx = new FX(this);
        this.txt = new TextOverlay();
        this.efx = new EffectOverlay();
        const bulletState = createGameBulletPool(200);
        this.bulletPool = bulletState.pool;
        this.eBullets = bulletState.adapter;
        this.enemies = []; this.relics = []; this.obstacles = [];
        this.flockCrows = [];
        this.grayOrbs = [];
        this.snowParticles = [];
        this.boss = null; this.score = 0; this.frame = 0;
        this.stageIdx = 0; this.blueK = 0; this.blueCD = 0; this.eCD = 0;
        this.stateT = 0; this.fadeA = 0; this.fadeD = 0; this.slowT = 0; this.arena = false; this.obsCD = 0;
        this.paused = false;
        this._lastBossBGMForm = -1;
        /** ボス3 MIRROR WALK 用: 直近3秒のプレイヤー座標（約180フレーム） */
        this.playerPathHistory = [];
        /** フローティングジョイスティック（画面左半分タッチで移動） */
        this.joystick = new VirtualJoystick(this.cvs, (fx, fy) => {
            if (fx === undefined) {
                /* 離指: joystickキーを削除してキーボード入力モードへ即復帰 */
                delete this.keys['JoystickX'];
                delete this.keys['JoystickY'];
            } else {
                this.keys['JoystickX'] = fx;
                this.keys['JoystickY'] = fy;
            }
        });
        /* タッチデバイス(iOS/Android)では左パネルHTMLジョイスティックを使用 */
        const isTouch = ('ontouchstart' in window || navigator.maxTouchPoints > 0);
        if (isTouch) document.body.classList.add('touch-device');
        const joystickZone = document.getElementById('joystick-zone');
        if (joystickZone && isTouch) {
            this.joystick.setupHTMLMode(joystickZone);
        } else {
            this.joystick.setup(); /* PC: キャンバス上フローティング */
        }
        setupJoystickSettingsUI(this);

        window.addEventListener('keydown', e => {
            if (e.code === 'Escape') {
                this.togglePauseIfAllowed();
                e.preventDefault();
                return;
            }
            this.keys[e.code] = true;
            if (e.code === 'Space' || e.key === ' ') this.keys['Space'] = true;
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyX', 'KeyZ', 'KeyC', 'ShiftLeft', 'ShiftRight', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7'].includes(e.code)) e.preventDefault();
            if (e.key === ' ') e.preventDefault();
            if (!this.sound.initialized) this.sound.init();
            if (this.state === STATE.TITLE) this.sound.playBGM('opening');
        });
        window.addEventListener('keyup', e => {
            this.keys[e.code] = false;
            if (e.code === 'Space' || e.key === ' ') this.keys['Space'] = false;
        });
        setupTouch(this);

        document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
        let lastTap = 0;
        document.addEventListener('touchend', e => {
            const now = Date.now(); if (now - lastTap <= 300) e.preventDefault(); lastTap = now;
            if (!this.sound.initialized) this.sound.init();
            if (this.state === 'TITLE') this.sound.playBGM('opening');
        }, false);
        document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
        document.addEventListener('gesturechange', e => e.preventDefault(), { passive: false });
        document.addEventListener('gestureend', e => e.preventDefault(), { passive: false });

        const showFpsUi = (typeof global.CrowDestiny !== 'undefined' && global.CrowDestiny.DEBUG_FPS) || (typeof location !== 'undefined' && location.hash === '#fps');
        if (showFpsUi) {
            const wrap = document.createElement('div');
            wrap.id = 'fps-record-wrap';
            wrap.style.cssText = 'position:absolute;top:36px;left:8px;z-index:9999;display:flex;gap:6px;pointer-events:auto;';
            const btnSave = document.createElement('button');
            btnSave.type = 'button';
            btnSave.textContent = 'FPS記録';
            btnSave.title = '今回の最小・最大・平均を「以前」として保存（最適化前の計測を上書き）';
            btnSave.style.cssText = 'padding:4px 8px;font-size:11px;cursor:pointer;background:#2a2;color:#fff;border:none;border-radius:4px;';
            btnSave.addEventListener('click', () => {
                const avg = this._fpsSamples > 0 ? Math.round(this._fpsSum / this._fpsSamples) : 0;
                try {
                    localStorage.setItem('crow_fps_before', JSON.stringify({ min: this._fpsMin, max: this._fpsMax, avg: avg }));
                    btnSave.textContent = '記録した';
                    setTimeout(() => { btnSave.textContent = 'FPS記録'; }, 1500);
                } catch (e) { btnSave.textContent = 'Err'; }
            });
            const btnClear = document.createElement('button');
            btnClear.type = 'button';
            btnClear.textContent = 'クリア';
            btnClear.title = '「以前」の記録を削除';
            btnClear.style.cssText = 'padding:4px 8px;font-size:11px;cursor:pointer;background:#633;color:#fff;border:none;border-radius:4px;';
            btnClear.addEventListener('click', () => {
                try { localStorage.removeItem('crow_fps_before'); } catch (e) {}
                btnClear.textContent = '削除した';
                setTimeout(() => { btnClear.textContent = 'クリア'; }, 1000);
            });
            wrap.appendChild(btnSave);
            wrap.appendChild(btnClear);
            const container = document.getElementById('game-container');
            if (container) {
                container.style.position = 'relative';
                container.appendChild(wrap);
            }
        }

        loadAssets().then(() => {
            const ls = document.getElementById('loading-screen');
            if (ls) { ls.style.opacity = '0'; ls.style.pointerEvents = 'none'; }
            setTimeout(() => { if (ls) ls.style.display = 'none'; }, 1500);
        });
        requestAnimationFrame(t => this.loop(t));
    }

    togglePauseIfAllowed() {
        if (!PAUSABLE_STATES.includes(this.state)) return;
        this.paused = !this.paused;
    }

    get sd() { return STAGES[this.stageIdx] || STAGES[0]; }
    get scrollSpd() { return this.bg.scrolling ? this.bg.speed : 0; }

    startStage() {
        this.sound.stopBGM();
        this.state = STATE.NARRATION; this.stateT = 0;
        this.enemies = []; this.bulletPool.releaseAll(); this.relics = []; this.obstacles = [];
        this.flockCrows = []; this.grayOrbs = []; this.snowParticles = [];
        this.boss = null; this.blueK = 0; this.blueCD = ri(180, 320); this.eCD = 0; this.arena = false; this.obsCD = ri(60, 120);
        this._narrationShown = false;
        this.bg.scrolling = true; this.bg.setStage(this.sd); this.fadeA = 0; this.fadeD = 0; this.slowT = 0;
        if (this.crow) {
            this.crow.hp = this.crow.maxHp;
            this.crow.feathers = [];
            this.crow.dashTrail = [];
        }
    }

    restart() {
        this.sound.stopBGM();
        this.crow = new Crow(this.sound); this.enemies = []; this.bulletPool.releaseAll(); this.relics = []; this.obstacles = []; this.flockCrows = []; this.grayOrbs = []; this.snowParticles = []; this.boss = null;
        this.score = 0; this.frame = 0; this.stageIdx = 0; this.blueK = 0; this.blueCD = 0;
        this.fx = new FX(this); this.txt = new TextOverlay(); this.efx = new EffectOverlay();
        this.bg = new Background(); this.state = STATE.TITLE; this.stateT = 0; this.fadeA = 0; this.slowT = 0; this._lastBossBGMForm = -1; this.lastBossForm = undefined;
    }

    /** ゲームオーバー時: 現在のステージの始めから再挑戦（スコア・解放スキルは維持） */
    retryCurrentStage() {
        this.sound.stopBGM();
        this.enemies = []; this.bulletPool.releaseAll(); this.relics = []; this.obstacles = []; this.flockCrows = []; this.grayOrbs = []; this.snowParticles = []; this.boss = null;
        if (this.crow) {
            this.crow.hp = this.crow.maxHp;
            this.crow.feathers = [];
            this.crow.dashTrail = [];
            this.crow.anim.set('FLY');
        }
        this.state = STATE.NARRATION;
        this.stateT = 0;
        this._narrationShown = false;
        this.startStage();
    }

    applyRelic(r) {
        this.sound.playItem();
        const e = r.type.effect;
        if (e === "HEAL") { this.crow.hp = Math.min(this.crow.maxHp, this.crow.hp + 30); this.efx.add("HEAL", "#44ff44", 50); }
        else if (e === "BARRIER") { this.crow.barrier = 480; this.efx.add("BARRIER", "#aaeeff", 480); }
        else if (e === "SLOW") { this.slowT = 480; this.efx.add("SLOW", "#cc88ff", 50); }
        else if (e === "BOMB") {
            this.efx.add("BOMB", "#ff4400", 50);
            this.enemies.forEach(en => { if (en.active) { en.hp = 0; en.anim.set('DEATH'); this.fx.burst(en.x, en.y, en.color, 12); this.score += 100; } });
            this.bulletPool.releaseAll(); if (this.boss && this.boss.active && this.boss.arrived && !(this.boss.idx === 4 && this.boss.domeShieldT > 0)) this.boss.takeDamage(40, this.fx); this.fx.big(this.crow.cx, this.crow.cy, "#ff4400");
        }
        this.fx.burst(r.x, r.y, r.type.color, 18, 4);
    }

    /** iOS スキルボタンのテキストを現在のスキル状態に合わせて更新 */
    _updateSkillButton() {
        const btn = document.getElementById('btn-skill');
        if (!btn) return;
        const cr = this.crow;
        if (!cr || !cr.unlockedBossAbilities) { btn.textContent = 'スキル'; return; }
        const unlockedIndices = [0,1,2,3,4,5,6].filter(i => cr.unlockedBossAbilities[i]);
        const nUnlocked = unlockedIndices.length;
        if (nUnlocked === 0) { btn.textContent = 'SKILL'; return; }
        const slotIdx = Math.min(cr.currentSkillSlotIndex ?? 0, nUnlocked - 1);
        const currentBossIdx = unlockedIndices[slotIdx];
        const cd = (cr.bossAbilityCD && cr.bossAbilityCD[currentBossIdx]) || 0;
        const cdSec = cd > 0 ? Math.ceil(cd / 60) : 0;
        /* 丸ボタン向けコンパクト表示 */
        if (cdSec > 0) {
            btn.textContent = `${slotIdx + 1}/${nUnlocked}\nCD:${cdSec}s`;
            btn.style.color = '#aa88bb';
            btn.classList.remove('charging');
        } else {
            btn.textContent = `SKILL\n${slotIdx + 1}/${nUnlocked}`;
            btn.style.color = '#cc88ff';
        }
    }

    /** スキル: タップで取得済みスキルを順に切替、長押し/Zキーで選択中スキル発動。Cキーで切替。1〜7キーは従来どおりその面のスキルを直接発動。 */
    tryTriggerBossAbility() {
        const cr = this.crow;
        if (!cr) return;
        const unlockedIndices = [0, 1, 2, 3, 4, 5, 6].filter(i => cr.unlockedBossAbilities[i]);
        const nUnlocked = unlockedIndices.length;
        if (nUnlocked > 0) {
            cr.currentSkillSlotIndex = Math.min(cr.currentSkillSlotIndex, nUnlocked - 1);
        }

        /* スキル切替: タップ or Cキー */
        if (this.keys['TouchSkillCycle'] || this.keys['KeyC']) {
            if (nUnlocked > 0) {
                cr.currentSkillSlotIndex = (cr.currentSkillSlotIndex + 1) % nUnlocked;
            }
            this.keys['TouchSkillCycle'] = false;
            this.keys['KeyC'] = false;
        }

        /* 発動するスキル idx を決定: 長押し/Zキー＝選択中、1〜7キー＝その面を直接 */
        let idx = -1;
        if (this.keys['TouchSkillFire'] || this.keys['KeyZ']) {
            if (nUnlocked > 0) idx = unlockedIndices[cr.currentSkillSlotIndex];
            this.keys['TouchSkillFire'] = false;
            this.keys['KeyZ'] = false;
        } else {
            for (let i = 0; i < 7; i++) {
                if (this.keys['Digit' + (i + 1)]) {
                    idx = i;
                    break;
                }
            }
        }
        if (idx < 0 || !cr.unlockedBossAbilities[idx] || cr.bossAbilityCD[idx] > 0) return;

        cr.bossAbilityCD[idx] = 300;
        if (this.sound.playItem) this.sound.playItem();
        const cx = cr.x + cr.w / 2 + cr.facing * 12;
        const cy = cr.y + cr.h / 2 - 3;
        const W = CFG.W;
        const H = CFG.H;
        if (idx === 0) {
            /* スキル1: 紫スキル 3本の剣（威力1 < 2 < 3 < 4 のうち最弱） */
            const swordOffsets = [{ yo: -14, vy: 0 }, { yo: 0, vy: 0 }, { yo: 14, vy: 0 }];
            for (const s of swordOffsets) {
                cr.feathers.push({ x: cx, y: cy + s.yo, vx: cr.facing * 16, vy: s.vy, active: true, life: 0, isBeam: true, color: '#9B59D6', isPurpleSword: true, damage: 10 });
            }
            this.fx.burst(cx, cy, '#9B59D6', 20, 5);
        } else if (idx === 1) {
            /* スキル2: 緑スキル 8方向感電（威力2） */
            const spd = 17;
            for (let i = 0; i < 8; i++) {
                const a = (Math.PI / 4) * i;
                cr.feathers.push({ x: cx, y: cy, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, life: 0, isBeam: true, color: '#2ECC71', isGreenArrow: true, damage: 13 });
            }
            /* 感電バースト演出: 緑スパーク + 白コア + 軽い画面フラッシュ */
            this.fx.burst(cx, cy, '#00ff88', 35, 9, 35);
            this.fx.burst(cx, cy, '#aaffcc', 18, 5, 22);
            this.fx.burst(cx, cy, '#ffffff', 10, 4, 15);
            this.fx.flash = 5; this.fx.fCol = '#00ff66';
            this.fx.shake = 4;
        } else if (idx === 2) {
            /* スキル3: 灰スキル 10個の弾（威力3） */
            const numOrbs = 10;
            const startRadius = 52;
            const spreadSpd = 0.38;
            const rotSpd = 0.022;
            for (let i = 0; i < numOrbs; i++) {
                const a = (i / numOrbs) * Math.PI * 2;
                this.grayOrbs.push({
                    x: cx + Math.cos(a) * startRadius,
                    y: cy + Math.sin(a) * startRadius,
                    angle: a,
                    rot: a,
                    spreadSpd,
                    rotSpd,
                    damage: 16,
                    active: true,
                    life: 0,
                    maxLife: 200
                });
            }
            this.efx.add("ORBIT", "#95a5a6", 60);
            this.fx.burst(cx, cy, '#7F8C8D', 16, 5);
        } else if (idx === 3) {
            /* スキル4: 群れカラス 9羽 — 上下に激しく動きながら進む、スピード40% */
            const baseY = cr.y + cr.h / 2;
            for (let row = 0; row < 3; row++) {
                for (let col = 0; col < 3; col++) {
                    this.flockCrows.push({
                        x: cr.x - 50 - col * 22,
                        y: baseY - 25 + row * 22 + (col % 2) * 6,
                        vx: 8,
                        vy: 0,
                        life: 0,
                        active: true,
                        damage: 20
                    });
                }
            }
            this.fx.burst(cx, cy, '#E74C3C', 26, 7);
        } else if (idx === 4) {
            /* 青スキル: バリア3ヒット耐久に強化 */
            cr.barrier = Math.max(cr.barrier, 20 * 60);
            cr.barrierHits = 3;
            this.efx.add("BARRIER", "#3498DB", 80);
            this.fx.burst(cx, cy, '#aaeeff', 28, 7);
        } else if (idx === 5) {
            /* 白スキル: 100粒（モバイルは40粒）・3秒(180f)・damage5・ゆっくり漂う */
            const snowCount = global.CrowDestiny.IS_MOBILE ? 40 : 100;
            for (let i = 0; i < snowCount; i++) {
                this.snowParticles.push({
                    x: Math.random() * (W + 100) - 50,
                    y: Math.random() * (H + 50) - 25,
                    vx: (Math.random() - 0.5) * 5,
                    vy: (Math.random() - 0.5) * 3.5,
                    active: true,
                    life: 0,
                    maxLife: 180,
                    damage: 5
                });
            }
            this.fx.burst(cx, cy, '#ECF0F1', 35, 8);
        } else if (idx === 6) {
            /* ラスボス解放スキル: ヴォイドスプレッド — スキル3と同じダメージ（16） */
            const n = 12;
            const spreadAngle = Math.PI * 0.55;
            const baseAngle = -spreadAngle / 2;
            const spd = 18;
            for (let i = 0; i < n; i++) {
                const a = baseAngle + (spreadAngle * i) / (n - 1 || 1) + (cr.facing < 0 ? Math.PI : 0);
                cr.feathers.push({
                    x: cx, y: cy,
                    vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
                    active: true, life: 0, isBeam: true, color: '#ff44ff', isVoidSpread: true, damage: 16
                });
            }
            this.fx.burst(cx, cy, '#ff44ff', 40, 10, 30);
            this.fx.flash = 8; this.fx.fCol = '#cc44ff';
            this.fx.shake = 6;
        }
    }

    _updateFeathersAndSkills(d) {
        if (d == null) d = 1;
        const cr = this.crow;
        const W = CFG.W;
        const H = CFG.H;
        cr.feathers.forEach(f => {
            f.x += f.vx * d;
            f.y += f.vy * d;
            f.life += d;
            if (f.x < -30 || f.x > W + 30 || f.y < -30 || f.y > H + 30) f.active = false;
            if (f.isPurpleSword && f.active) {
                let tx = f.x + f.vx * 30;
                let ty = f.y + f.vy * 30;
                let best = Infinity;
                this.enemies.forEach(e => {
                    if (!e.active || e.anim.state === 'DEATH') return;
                    const d2 = (e.x - f.x) ** 2 + (e.y - f.y) ** 2;
                    if (d2 < best) { best = d2; tx = e.x + (e.w || 20) / 2; ty = e.y + (e.h || 16) / 2; }
                });
                if (this.boss && this.boss.active && this.boss.arrived) {
                    const d2 = (this.boss.x - f.x) ** 2 + (this.boss.y - f.y) ** 2;
                    if (d2 < best) { tx = this.boss.x; ty = this.boss.y; }
                }
                const dx = tx - f.x;
                const dy = ty - f.y;
                const dist = Math.hypot(dx, dy) || 1;
                const spd = 14;
                const turn = 0.08;
                f.vx += (dx / dist * spd - f.vx) * turn;
                f.vy += (dy / dist * spd - f.vy) * turn;
                const s = Math.hypot(f.vx, f.vy);
                if (s > 0.5) { f.vx *= spd / s; f.vy *= spd / s; }
            }
        });
    }

    triggerBoss() {
        this.sound.stopBGM();
        if (this.stageIdx === 6) this.lastBossForm = 0;
        this.state = STATE.BOSS_INTRO; this.stateT = 0; this.bg.scrolling = false; this.arena = true;
        this.enemies.forEach(e => { if (e.active && e.anim.state !== 'DEATH') e.active = false; });
        this.bulletPool.releaseAll(); this.obstacles = []; this.txt.show(`「${this.sd.bossName}」が現れた…`, "#ff0000", 150, 36, CFG.W / 2, CFG.H / 2);
    }

    update(dt) {
        if (this.paused) return;
        if (dt == null || dt <= 0) dt = 1 / FPS_BASE;
        const d = Math.min(dt, DT_CAP) * FPS_BASE;
        this.frame++; this.stateT += d;
        /* ジョイスティック: 左パネルDOMジョイスティックがあれば優先、なければキャンバス左半分の仮想ジョイスティックのみ使用 */
        delete this.keys['JoystickX'];
        delete this.keys['JoystickY'];
        this.joystick.update();
        this.fx.update(d); this.txt.update(d); this.efx.update(d); this.bg.update(d);
        /** 覚醒レベル: Lv.2=10000, Lv.3=25000, Lv.4=55000, Lv.5=80000, Lv.6=100000。レベルアップ時は「LEVEL UP!」表示＋SE */
        if (this.crow) {
            const oldLv = this.crow.weaponLevel;
            const LEVEL_THRESHOLDS = [0, 10000, 25000, 55000, 80000, 100000];
            let newLv = 1;
            for (let i = LEVEL_THRESHOLDS.length - 1; i >= 1; i--) {
                if (this.score >= LEVEL_THRESHOLDS[i]) { newLv = i + 1; break; }
            }
            this.crow.weaponLevel = newLv;
            if (newLv > oldLv) {
                this.txt.show("LEVEL UP!", "#ffcc00", 100, 64, CFG.W / 2, CFG.H / 2);
                this.sound.playLevelUp();
            }
        }
        if (this.slowT > 0) this.slowT -= d;
        if (this.fadeD !== 0) this.fadeA = clamp(this.fadeA + this.fadeD * 0.02 * d, 0, 1);

        const start = this.keys['Space'] || this.keys['Enter'] || this.keys['TouchStart'];
        if (start) { this.keys['Space'] = false; this.keys['Enter'] = false; this.keys['TouchStart'] = false; }

        if (this.state === STATE.INSTRUCTIONS) {
            if (start) {
                if (!this.sound.initialized) this.sound.init();
                this.state = STATE.TITLE;
                this.stateT = 0;
                this.sound.playBGM('opening');
            }
            return;
        }
        if (this.state === STATE.TITLE) {
            if (start) { this.sound.playTitleStart(); this.startStage(); }
            return;
        }
        if (this.state === STATE.NARRATION) {
            if (!this._narrationShown) { this._narrationShown = true; this.txt.show(`— 第${this.stageIdx + 1}章 : ${this.sd.name} —`, "#ff4d00", 200, 38, CFG.W / 2, CFG.H / 2 - 60); this.sd.desc.split('\n').forEach((l, i) => this.txt.show(l, "#e0cda7", 200, 26, CFG.W / 2, CFG.H / 2 + i * 40)); }
            if (this.stateT > 220 || (this.stateT > 40 && start)) {
                this.state = STATE.PLAYING; this.stateT = 0;
                this.sound.playBGM('stage' + (this.stageIdx + 1));
            }
            return;
        }
        if (this.state === STATE.PLAYING) {
            const effD = this.slowT > 0 ? d * 0.5 : d;
            this.crow.update(this.keys, d); this.tryTriggerBossAbility(); this._updateSkillButton(); this.eCD -= d; this.blueCD -= d; this.obsCD -= d; spawnEnemies(this); spawnObstacles(this);
            const ss = this.scrollSpd; this.enemies.forEach(e => e.update(this.crow.cx, this.crow.cy, this.eBullets, ss, this.fx, effD));
            updateSpecialBullets(this.eBullets);
            if (processBulletSplits) processBulletSplits(this.eBullets);
            this.eBullets.forEach(b => { b.x += b.vx * effD; b.y += b.vy * effD; if (b.x < -30 || b.x > CFG.W + 30 || b.y < -30 || b.y > CFG.H + 30) b.active = false; });
            if (processExplosiveBullets) processExplosiveBullets(this.eBullets, this);
            this._updateFeathersAndSkills(d);
            this.flockCrows.forEach(fc => {
                fc.life = (fc.life || 0) + d;
                fc.x += fc.vx * d;
                const wave = Math.sin(fc.life * 0.25) * 12 * d;
                fc.y += (fc.vy || 0) * d + wave;
                if (fc.x > CFG.W + 60) fc.active = false;
            });
            this.grayOrbs.forEach(o => {
                o.life += d;
                o.x += Math.cos(o.angle) * (o.spreadSpd || 0.38) * d;
                o.y += Math.sin(o.angle) * (o.spreadSpd || 0.38) * d;
                o.rot += (o.rotSpd || 0.022) * d;
                if (o.life > (o.maxLife || 200) || o.x < -50 || o.x > CFG.W + 50 || o.y < -50 || o.y > CFG.H + 50) o.active = false;
            });
            this.snowParticles.forEach(s => { s.x += s.vx * d; s.y += s.vy * d; s.life += d; if (s.life > (s.maxLife || 120) || s.x < -20 || s.x > CFG.W + 20 || s.y < -20 || s.y > CFG.H + 20) s.active = false; });
            this.relics.forEach(r => r.update(ss, d)); this.obstacles.forEach(o => o.update(ss, effD)); checkCollisions(this);
            removeInactive(this.enemies, e => e.active); removeInactive(this.crow.feathers, f => f.active); removeInactive(this.flockCrows, fc => fc.active); removeInactive(this.grayOrbs, o => o.active); removeInactive(this.snowParticles, s => s.active); this.bulletPool.releaseInactive(); removeInactive(this.relics, r => r.active); removeInactive(this.obstacles, o => o.active);
            if (this.crow.hp <= 0) { this.state = STATE.GAME_OVER; this.stateT = 0; this.sound.stopBGM(); this.sound.playGameOver(); this.sound.playBGM('gameover'); return; }
            if (this.blueK >= 3) this.triggerBoss();
            return;
        }
        if (this.state === STATE.BOSS_INTRO) {
            this.crow.update(this.keys, d); this.crow.feathers.forEach(f => { f.x += f.vx * d; f.y += f.vy * d; f.life += d; if (f.x < -30 || f.x > CFG.W + 30) f.active = false; }); removeInactive(this.crow.feathers, f => f.active);
            if (this.stateT > 120) {
                const form = this.stageIdx === 6 ? (this.lastBossForm ?? 0) : undefined;
                this.boss = new Boss(this.sd, this.stageIdx, form);
                this.state = STATE.BOSS_FIGHT; this.stateT = 0;
                if (this.stageIdx <= 5) this.sound.playBGM('boss');
                else { this._lastBossBGMForm = 0; this.sound.playBGM('boss7'); }
            }
            return;
        }
        if (this.state === STATE.LAST_BOSS_2TO3_CUTSCENE) {
            const CUTSCENE_DUR = 360;
            if (this.stateT >= CUTSCENE_DUR) {
                this.boss = new Boss(this.sd, 6, 2);
                this._lastBossBGMForm = 2;
                this.sound.playBGM('lastboss2');
                this.state = STATE.BOSS_FIGHT;
                this.stateT = 0;
                this.txt.show("第3形態 — 猫神", "#ff4466", 120, 32, CFG.W / 2, CFG.H / 2 - 30);
            }
            return;
        }
        if (this.state === STATE.BOSS_FIGHT) {
            const effD = this.slowT > 0 ? d * 0.5 : d;
            /* ラスボスBGM: 第1形態=boss7, 第2形態=lastboss1(lastboss.mp3), 第3形態=lastboss2(lastboss2.mp3) */
            if (this.stageIdx === 6 && this.boss && this.boss.active) {
                const form = this.boss.form;
                if (form !== this._lastBossBGMForm) {
                    this._lastBossBGMForm = form;
                    if (form === 0) this.sound.playBGM('boss7');
                    else if (form === 1) this.sound.playBGM('lastboss1');
                    else this.sound.playBGM('lastboss2');
                }
            }
            let keys = this.keys;
            if (this.boss && this.boss.idx === 3 && this.boss.mirrorActiveT > 0) {
                keys = { ...this.keys, ArrowLeft: this.keys['ArrowRight'], ArrowRight: this.keys['ArrowLeft'], KeyA: this.keys['KeyD'], KeyD: this.keys['KeyA'], TouchLeft: this.keys['TouchRight'], TouchRight: this.keys['TouchLeft'] };
            }
            this.crow.update(keys, d); this.tryTriggerBossAbility(); this._updateSkillButton();
            this._updateFeathersAndSkills(d);
            this.flockCrows.forEach(fc => {
                fc.life = (fc.life || 0) + d;
                fc.x += fc.vx * d;
                const wave = Math.sin(fc.life * 0.25) * 12 * d;
                fc.y += (fc.vy || 0) * d + wave;
                if (fc.x > CFG.W + 60) fc.active = false;
            });
            this.grayOrbs.forEach(o => {
                o.life += d;
                o.x += Math.cos(o.angle) * (o.spreadSpd || 0.38) * d;
                o.y += Math.sin(o.angle) * (o.spreadSpd || 0.38) * d;
                o.rot += (o.rotSpd || 0.022) * d;
                if (o.life > (o.maxLife || 200) || o.x < -50 || o.x > CFG.W + 50 || o.y < -50 || o.y > CFG.H + 50) o.active = false;
            });
            this.snowParticles.forEach(s => { s.x += s.vx * d; s.y += s.vy * d; s.life += d; if (s.life > (s.maxLife || 120) || s.x < -20 || s.x > CFG.W + 20 || s.y < -20 || s.y > CFG.H + 20) s.active = false; });
            if (this.boss && this.boss.idx === 3) {
                this.playerPathHistory.push({ x: this.crow.cx, y: this.crow.cy });
                if (this.playerPathHistory.length > 180) this.playerPathHistory.shift();
            }
            const bossOpts = { sound: this.sound };
            if (this.boss && this.boss.idx === 3) bossOpts.playerPath = this.playerPathHistory;
            this.boss.update(this.crow.cx, this.crow.cy, this.eBullets, this.enemies, this.fx, this.sd, bossOpts, d);
            if (this.boss && this.boss.idx === 3) {
                this.crow.aimOffset = 0;
                if (this.boss.glitchFieldRect) {
                    const r = this.boss.glitchFieldRect;
                    if (this.crow.cx >= r.x && this.crow.cx <= r.x + r.w && this.crow.cy >= r.y && this.crow.cy <= r.y + r.h)
                        this.crow.aimOffset = this.boss.aimOffsetRad;
                }
            }
            this.enemies.forEach(e => e.update(this.crow.cx, this.crow.cy, this.eBullets, 0, this.fx, effD));
            updateSpecialBullets(this.eBullets);
            if (processBulletSplits) processBulletSplits(this.eBullets);
            this.eBullets.forEach(b => {
                if (b.homing) {
                    const dx = this.crow.cx - b.x; const dy = this.crow.cy - b.y; const dist = Math.hypot(dx, dy) || 1;
                    const wantA = Math.atan2(dy, dx); const curA = Math.atan2(b.vy, b.vx);
                    let da = wantA - curA; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
                    const turn = (15 * Math.PI / 180) / 60; const newA = curA + Math.max(-turn, Math.min(turn, da));
                    const spd = Math.hypot(b.vx, b.vy);
                    b.vx = Math.cos(newA) * spd; b.vy = Math.sin(newA) * spd;
                }
                b.x += b.vx * effD; b.y += b.vy * effD;
                if (b.x < -30 || b.x > CFG.W + 30 || b.y < -30 || b.y > CFG.H + 30) b.active = false;
            });
            if (processExplosiveBullets) processExplosiveBullets(this.eBullets, this);
            this.relics.forEach(r => r.update(0, d)); checkCollisions(this); removeInactive(this.enemies, e => e.active); removeInactive(this.crow.feathers, f => f.active); removeInactive(this.flockCrows, fc => fc.active); removeInactive(this.grayOrbs, o => o.active); removeInactive(this.snowParticles, s => s.active); this.bulletPool.releaseInactive(); removeInactive(this.relics, r => r.active);
            if (this.crow.hp <= 0) { this.state = STATE.GAME_OVER; this.stateT = 0; this.sound.stopBGM(); this.sound.playGameOver(); this.sound.playBGM('gameover'); return; }
            if (this.boss && !this.boss.active && this.boss.anim && this.boss.anim.done) {
                if (this.stageIdx === 6 && this.lastBossForm !== undefined && this.lastBossForm < 2) {
                    this.lastBossForm++;
                    if (this.lastBossForm === 2) {
                        this.state = STATE.LAST_BOSS_2TO3_CUTSCENE;
                        this.stateT = 0;
                        this.boss = null;
                    } else {
                        this.boss = new Boss(this.sd, 6, this.lastBossForm);
                        this.txt.show(`第${this.lastBossForm + 1}形態 —`, "#ff4466", 120, 32, CFG.W / 2, CFG.H / 2 - 30);
                    }
                } else {
                    this.score += 1000 * (this.stageIdx + 1); for (let i = 0; i < 3; i++) this.relics.push(new Relic(this.boss.x + rr(-40, 40), this.boss.y + rr(-20, 20)));
                    this.crow.unlockedBossAbilities[this.boss.idx] = true;
                    this.state = STATE.STAGE_CLEAR_FREEZE; this.stateT = 0; this.sound.stopBGM(); this.sound.playStageClear();
                }
            } return;
        }
        if (this.state === STATE.STAGE_CLEAR_FREEZE) {
            if (this.stateT >= STAGE_CLEAR_FREEZE_DUR) {
                this.crow.feathers = [];
                this.crow.dashTrail = [];
                this.state = STATE.STAGE_CLEAR; this.stateT = 0; this._stageClearSoundTick = 0;
                this.txt.show("STAGE CLEAR", "#ffcc00", 180, 48, CFG.W / 2, CFG.H / 2 - 40); this.txt.show(`— ${this.sd.name} 浄化完了 —`, "#e0cda7", 180, 24, CFG.W / 2, CFG.H / 2 + 10);
            }
            return;
        }
        if (this.state === STATE.STAGE_CLEAR) {
            const stageClearDash = this.stateT > 45;
            this.crow.update(this.keys, d, { canShoot: false, noClampRight: stageClearDash });
            this.relics.forEach(r => r.update(0, d)); this.relics.forEach(r => { if (r.active && dist(r.x, r.y, this.crow.cx, this.crow.cy) < CFG.RELIC_PICKUP_RADIUS) { r.active = false; this.applyRelic(r); } }); removeInactive(this.relics, r => r.active);
            if (stageClearDash) {
                this.crow.x += 14 * d;
                this.crow.anim.set('DASH');
                this._stageClearSoundTick = (this._stageClearSoundTick || 0) + d;
                if (this._stageClearSoundTick >= 20) {
                    if (this.sound.playSEProcedural) this.sound.playSEProcedural('dash');
                    this._stageClearSoundTick = 0;
                }
            }
            if (this.stateT > 180) this.fadeD = 1;
            if (this.stateT > 250) {
                if (this.stageIdx < STAGES.length - 1) {
                    this.sound.playStageTransition();
                    this.stageIdx++; this.crow.x = 100; this.crow.y = CFG.H / 2 - 4; this.fadeD = -1; this.startStage();
                } else { this.state = STATE.VICTORY; this.stateT = 0; this.fadeD = -1; this.sound.playBGM('ending'); }
            } return;
        }
        if (this.state === STATE.GAME_OVER) { if (this.stateT > 90 && start) this.retryCurrentStage(); return; }
        if (this.state === STATE.VICTORY) { if (this.stateT > 150 && start) this.restart(); return; }
    }

    draw() {
        const c = this.c; c.save(); this.fx.applyShake(c); this.bg.draw(c);
        if (this.state === STATE.INSTRUCTIONS) { drawInstructionsScene(c, this); c.restore(); return; }
        if (this.state === STATE.TITLE) { drawTitleScene(c, this); c.restore(); return; }
        if (this.state === STATE.LAST_BOSS_2TO3_CUTSCENE) {
            drawLastBoss2To3CutsceneScene(c, this);
            this.txt.draw(c);
            c.restore();
            return;
        }
        const mirror = this.state === STATE.BOSS_FIGHT && this.boss && this.boss.idx === 3 && this.boss.mirrorActiveT > 0;
        if (mirror) { c.save(); c.translate(CFG.W, 0); c.scale(-1, 1); c.translate(-CFG.W, 0); }
        const qEff = this.qualityEffect != null ? this.qualityEffect : 1;
        const inView = (x, y) => x >= -CULL_MARGIN && x <= CFG.W + CULL_MARGIN && y >= -CULL_MARGIN && y <= CFG.H + CULL_MARGIN;
        this.obstacles.forEach(o => { if (inView(o.x, o.y)) o.draw(c); });
        this.relics.forEach(r => { if (inView(r.x, r.y)) r.draw(c); });
        this.enemies.forEach(e => { if (inView(e.x, e.y)) e.draw(c, this); });
        this.eBullets.forEach(b => { if (!b.active || !inView(b.x, b.y)) return; c.save(); c.globalAlpha = 0.85; c.fillStyle = b.color; const bx = Math.floor(b.x), by = Math.floor(b.y); c.beginPath(); c.arc(bx, by, b.r || 5, 0, Math.PI * 2); c.fill(); c.globalAlpha = 0.3; c.beginPath(); c.arc(bx, by, (b.r || 5) + 4, 0, Math.PI * 2); c.fill(); c.restore(); });
        this.crow.drawFeathers(c); this.crow.drawTrail(c);
        if (this.crow.cloneCrowT > 0 && this.crow.posHistory.length > 0) {
            /* 0.3秒遅延位置に分身を描画（本体との差分オフセット） */
            const dx = this.crow.cloneX - this.crow.x;
            const dy = this.crow.cloneY - this.crow.y;
            /* 残り時間が少なくなったらフェードアウト（最後3秒で点滅） */
            const t = this.crow.cloneCrowT;
            const alpha = t < 180 ? (t % 20 < 10 ? 0.3 : 0.55) : 0.55;
            c.save(); c.globalAlpha = alpha; c.translate(Math.floor(dx), Math.floor(dy)); c.scale(0.9, 0.9); this.crow.draw(c); c.restore();
        }
        this.flockCrows.forEach(fc => {
            if (!fc.active || !inView(fc.x, fc.y)) return;
            c.save();
            c.translate(Math.floor(fc.x), Math.floor(fc.y));
            if (qEff >= 0.5) { c.shadowColor = '#E74C3C'; c.shadowBlur = 10; }
            /* 胴体 */
            c.fillStyle = '#c0392b';
            c.beginPath(); c.ellipse(0, 0, 9, 6, 0, 0, Math.PI * 2); c.fill();
            /* 翼（上下）*/
            c.fillStyle = '#E74C3C';
            c.beginPath(); c.moveTo(-4, 0); c.quadraticCurveTo(-2, -12, 8, -6); c.quadraticCurveTo(4, -4, -4, 0); c.fill();
            c.beginPath(); c.moveTo(-4, 0); c.quadraticCurveTo(-2, 12, 8, 6); c.quadraticCurveTo(4, 4, -4, 0); c.fill();
            /* くちばし */
            c.fillStyle = '#ff6644';
            c.beginPath(); c.moveTo(9, 0); c.lineTo(14, -2); c.lineTo(14, 2); c.closePath(); c.fill();
            c.restore();
        });
        this.grayOrbs.forEach(o => {
            if (!o.active || !inView(o.x, o.y)) return;
            c.save();
            c.translate(Math.floor(o.x), Math.floor(o.y));
            c.rotate(o.rot || 0);
            if (qEff >= 0.5) { c.shadowColor = '#95a5a6'; c.shadowBlur = 6; }
            c.fillStyle = 'rgba(149, 165, 166, 0.88)';
            c.strokeStyle = 'rgba(180, 190, 192, 0.7)';
            c.lineWidth = 1;
            c.beginPath();
            c.ellipse(0, 0, 8, 5, 0, 0, Math.PI * 2);
            c.fill();
            c.stroke();
            c.shadowBlur = 0;
            c.restore();
        });
        this.snowParticles.forEach(s => {
            if (!s.active || !inView(s.x, s.y)) return;
            const prog = 1 - s.life / (s.maxLife || 180);
            const alpha = 0.35 + 0.5 * prog;
            const r = 2 + prog * 2;
            c.save();
            if (qEff >= 0.5) { c.shadowColor = '#aaddff'; c.shadowBlur = 5; }
            c.fillStyle = `rgba(220,240,255,${alpha})`;
            c.beginPath(); c.arc(Math.floor(s.x), Math.floor(s.y), r, 0, Math.PI * 2); c.fill();
            c.restore();
        });
        this.crow.draw(c); if (this.boss) this.boss.draw(c); this.fx.draw(c); this.fx.drawArenaEffects(c); this.fx.drawFlash(c); this.efx.draw(c, this.crow);
        if (mirror) c.restore();
        if (this.boss && this.boss.idx === 3 && this.boss.berserk) {
            c.save(); c.globalAlpha = 0.6 + Math.sin(this.frame * 0.3) * 0.2; c.fillStyle = '#FF00FF'; c.font = 'bold 28px monospace'; c.textAlign = 'center';
            c.fillText('ＳＹＳＴＥＭ　ＢＲＥＡＫ', CFG.W / 2 + (this.frame % 3 - 1) * 2, 60); c.restore();
        }
        if (mirror) {
            c.save(); c.fillStyle = 'rgba(61,0,128,0.8)'; c.fillRect(0, 0, CFG.W, 32);
            c.fillStyle = '#FF00FF'; c.font = 'bold 18px monospace'; c.textAlign = 'center'; c.fillText('MIRROR ACTIVE', CFG.W / 2, 22);
            c.globalAlpha = 0.6; c.fillStyle = '#fff'; c.fillRect(0, (this.frame % 60) * (CFG.H / 60) % 32, CFG.W, 2); c.restore();
        }
        if (this.slowT > 0) { c.save(); c.globalAlpha = 0.05; c.fillStyle = "#cc88ff"; c.fillRect(0, 0, CFG.W, CFG.H); c.restore(); }
        if (this.state !== STATE.NARRATION) drawHUD(c, this.crow, this.score, this.stageIdx, this.blueK); this.txt.draw(c);
        if ([STATE.PLAYING, STATE.BOSS_FIGHT, STATE.BOSS_INTRO, STATE.STAGE_CLEAR_FREEZE, STATE.STAGE_CLEAR].includes(this.state)) this.joystick.draw(c);
        if (this.state === STATE.GAME_OVER) drawGameOverScene(c, this);
        if (this.state === STATE.VICTORY) drawVictoryScene(c, this);
        if (this.fadeA > 0) { c.fillStyle = `rgba(0,0,0,${this.fadeA})`; c.fillRect(0, 0, CFG.W, CFG.H); }
        if (this.paused) drawPauseOverlay(c);
        if ((typeof global.CrowDestiny !== 'undefined' && global.CrowDestiny.DEBUG_FPS) || (typeof location !== 'undefined' && location.hash === '#fps')) {
            c.save();
            const avg = this._fpsSamples > 0 ? Math.round(this._fpsSum / this._fpsSamples) : 0;
            const prev = (function () {
                try {
                    const s = localStorage.getItem('crow_fps_before');
                    return s ? JSON.parse(s) : null;
                } catch (e) { return null; }
            })();
            c.font = 'bold 13px monospace';
            c.fillStyle = 'rgba(0,0,0,0.7)';
            c.fillRect(6, 4, 200, prev ? 72 : 42);
            c.strokeStyle = 'rgba(0,255,100,0.9)';
            c.lineWidth = 1;
            c.strokeRect(6, 4, 200, prev ? 72 : 42);
            c.fillStyle = 'rgba(0,255,100,0.95)';
            c.fillText('今回  FPS: ' + (this._fpsValue || '-') + '  |  最小: ' + this._fpsMin + '  最大: ' + this._fpsMax + '  平均: ' + avg, 10, 20);
            if (prev) {
                c.fillStyle = 'rgba(255,200,80,0.95)';
                c.fillText('以前  FPS: 最小: ' + (prev.min || '-') + '  最大: ' + (prev.max || '-') + '  平均: ' + (prev.avg || '-'), 10, 38);
                c.fillStyle = 'rgba(180,180,255,0.9)';
                c.font = '11px monospace';
                c.fillText('記録更新 = 今回の値を「以前」に上書き', 10, 54);
                c.fillText('クリア = 以前の記録を削除', 10, 66);
            } else {
                c.fillStyle = 'rgba(180,180,255,0.9)';
                c.font = '11px monospace';
                c.fillText('「以前」を記録: 画面上の「FPS記録」ボタン', 10, 38);
            }
            c.restore();
        }
        c.restore();
    }

    /** FPS に応じてパーティクル・エフェクト品質を加減し、低スペックでもプレイ可能に。
     *  iOS/低FPS 時は shadowBlur も無効化（iOS Safari では最大の負荷要因）。 */
    _adaptiveQuality(deltaMs) {
        if (deltaMs <= 0 || deltaMs > 500) return;
        const fps = 1000 / deltaMs;
        if (fps < 25) {
            /* 25fps 未満: 品質を急速に落として復帰を優先。shadowBlur も無効化 */
            this.qualityParticle *= 0.88;
            this.qualityEffect *= 0.90;
            global.CrowDestiny.noShadow = true;
        } else if (fps < 40) {
            this.qualityParticle *= 0.94;
            this.qualityEffect *= 0.96;
        } else if (fps > 55) {
            this.qualityParticle = Math.min(1, this.qualityParticle * 1.04);
            this.qualityEffect = Math.min(1, this.qualityEffect * 1.02);
            /* デスクトップ限定: FPS 安定後に shadowBlur を再解放 */
            if (!global.CrowDestiny.IS_MOBILE && this.qualityEffect >= 0.9) {
                global.CrowDestiny.noShadow = false;
            }
        }
        this.qualityParticle = clamp(this.qualityParticle, 0.25, 1);
        this.qualityEffect = clamp(this.qualityEffect, 0.25, 1);
    }

    /** 1フレームの例外でループが止まり「画面が落ちる」のを防ぐ。コンソールに [CROW] で原因が出る。 */
    loop(timestamp) {
        const deltaMs = this._lastLoopTime > 0 ? timestamp - this._lastLoopTime : 0;
        if (deltaMs > 0) this._adaptiveQuality(deltaMs);
        this._lastLoopTime = timestamp;
        const showFps = (typeof global.CrowDestiny !== 'undefined' && global.CrowDestiny.DEBUG_FPS) || (typeof location !== 'undefined' && location.hash === '#fps');
        if (showFps) {
            this._fpsFrameCount++;
            if (timestamp - this._fpsLastTime >= 1000) {
                this._fpsValue = this._fpsFrameCount;
                this._fpsHistory.push(this._fpsValue);
                if (this._fpsHistory.length > 120) this._fpsHistory.shift();
                this._fpsMin = this._fpsSamples === 0 ? this._fpsValue : Math.min(this._fpsMin, this._fpsValue);
                this._fpsMax = this._fpsSamples === 0 ? this._fpsValue : Math.max(this._fpsMax, this._fpsValue);
                this._fpsSum += this._fpsValue;
                this._fpsSamples++;
                this._fpsFrameCount = 0;
                this._fpsLastTime = timestamp;
            }
        }
        const dt = deltaMs > 0 ? Math.min(deltaMs / 1000, DT_CAP) : 1 / FPS_BASE;
        try {
            this.update(dt);
        } catch (e) {
            console.error('[CROW] update error:', e);
        }
        try {
            this.draw();
        } catch (e) {
            console.error('[CROW] draw error:', e);
        }
        requestAnimationFrame((t) => this.loop(t));
    }
}

global.CrowDestiny = global.CrowDestiny || {};
global.CrowDestiny.Game = Game;

})(typeof window !== 'undefined' ? window : this);
