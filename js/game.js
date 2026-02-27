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
        this.qualityParticle = 1;
        this.qualityEffect = 1;
        this._lastLoopTime = 0;
        this.fx = new FX(this);
        this.txt = new TextOverlay();
        this.efx = new EffectOverlay();
        const bulletState = createGameBulletPool(200);
        this.bulletPool = bulletState.pool;
        this.eBullets = bulletState.adapter;
        this.enemies = []; this.relics = []; this.obstacles = [];
        this.boss = null; this.score = 0; this.frame = 0;
        this.stageIdx = 0; this.blueK = 0; this.blueCD = 0; this.eCD = 0;
        this.stateT = 0; this.fadeA = 0; this.fadeD = 0; this.slowT = 0; this.arena = false; this.obsCD = 0;
        this.paused = false;
        this._lastBossBGMForm = -1;
        /** ボス3 MIRROR WALK 用: 直近3秒のプレイヤー座標（約180フレーム） */
        this.playerPathHistory = [];
        /** フローティングジョイスティック（画面左半分タッチで移動） */
        this.joystick = new VirtualJoystick(this.cvs, (fx, fy) => {
            this.keys['JoystickX'] = fx;
            this.keys['JoystickY'] = fy;
        });
        this.joystick.setup();
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

        loadAssets().then(() => {
            const ls = document.getElementById('loading-screen');
            if (ls) { ls.style.opacity = '0'; ls.style.pointerEvents = 'none'; }
            setTimeout(() => { if (ls) ls.style.display = 'none'; }, 1500);
        });
        this.loop();
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
        this.boss = null; this.blueK = 0; this.blueCD = ri(180, 320); this.eCD = 0; this.arena = false; this.obsCD = ri(60, 120);
        this.bg.scrolling = true; this.bg.setStage(this.sd); this.fadeA = 0; this.fadeD = 0; this.slowT = 0;
        // ステージ移行時はHPを全回復（1面で瀕死クリア→2面開始で即ゲームオーバーになるのを防ぐ）
        if (this.crow) this.crow.hp = this.crow.maxHp;
    }

    restart() {
        this.sound.stopBGM();
        this.crow = new Crow(this.sound); this.enemies = []; this.bulletPool.releaseAll(); this.relics = []; this.obstacles = []; this.boss = null;
        this.score = 0; this.frame = 0; this.stageIdx = 0; this.fx = new FX(this); this.txt = new TextOverlay(); this.efx = new EffectOverlay();
        this.bg = new Background(); this.state = STATE.TITLE; this.stateT = 0; this.fadeA = 0; this.slowT = 0; this._lastBossBGMForm = -1; this.lastBossForm = undefined;
    }

    applyRelic(r) {
        this.sound.playItem();
        const e = r.type.effect;
        if (e === "HEAL") { this.crow.hp = Math.min(this.crow.maxHp, this.crow.hp + 30); this.efx.add("HEAL", "#44ff44", 50); }
        else if (e === "BARRIER") { this.crow.barrier = 480; this.efx.add("BARRIER", "#aaeeff", 50); }
        else if (e === "SLOW") { this.slowT = 360; this.efx.add("SLOW", "#cc88ff", 50); }
        else if (e === "BOMB") {
            this.efx.add("BOMB", "#ff4400", 50);
            this.enemies.forEach(en => { if (en.active) { en.hp = 0; en.anim.set('DEATH'); this.fx.burst(en.x, en.y, en.color, 12); this.score += 100; } });
            this.bulletPool.releaseAll(); if (this.boss && this.boss.active && this.boss.arrived && !(this.boss.idx === 4 && this.boss.domeShieldT > 0)) this.boss.takeDamage(40, this.fx); this.fx.big(this.crow.cx, this.crow.cy, "#ff4400");
        }
        this.fx.burst(r.x, r.y, r.type.color, 18, 4);
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
        if (idx === 0) {
            cr.feathers.push({ x: cx, y: cy, vx: cr.facing * 20, vy: 0, active: true, life: 0, isBeam: true, color: '#9B59B6' });
            this.fx.burst(cx, cy, '#9B59B6', 12, 4);
        } else if (idx === 1) {
            cr.barrier = Math.max(cr.barrier, 60); this.efx.add("BARRIER", "#00ffaa", 40);
        } else if (idx === 2) {
            for (let i = 0; i < 3; i++) {
                const spread = (Math.random() - 0.5) * 0.5;
                cr.feathers.push({ x: cx, y: cy, vx: cr.facing * 14 * Math.cos(spread), vy: Math.sin(spread) * 14, active: true, life: 0, color: '#7B00FF' });
            }
            this.fx.burst(cx, cy, '#7B00FF', 10, 3);
        } else if (idx === 3) {
            for (let i = -2; i <= 2; i++) {
                const a = i * 0.2; const spd = 12;
                cr.feathers.push({ x: cx, y: cy, vx: cr.facing * Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, life: 0, color: '#ff6644' });
            }
            this.fx.burst(cx, cy, '#ff6644', 14, 4);
        } else if (idx === 4) {
            cr.barrier = Math.max(cr.barrier, 90); this.efx.add("BARRIER", "#00dddd", 50);
        } else if (idx === 5) {
            cr.feathers.push({ x: cx, y: cy, vx: cr.facing * 18, vy: 0, active: true, life: 0, isBeam: true, color: '#AED6F1' });
            this.fx.burst(cx, cy, '#AED6F1', 12, 4);
        } else if (idx === 6) {
            const n = 12; for (let i = 0; i < n; i++) {
                const a = (Math.PI * 2 / n) * i; const spd = 10;
                cr.feathers.push({ x: cx, y: cy, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, life: 0, color: '#ff00ff' });
            }
            this.fx.burst(cx, cy, '#ff00ff', 16, 5);
        }
    }

    triggerBoss() {
        this.sound.stopBGM();
        if (this.stageIdx === 6) this.lastBossForm = 0;
        this.state = STATE.BOSS_INTRO; this.stateT = 0; this.bg.scrolling = false; this.arena = true;
        this.enemies.forEach(e => { if (e.active && e.anim.state !== 'DEATH') e.active = false; });
        this.bulletPool.releaseAll(); this.obstacles = []; this.txt.show(`「${this.sd.bossName}」が現れた…`, "#ff0000", 150, 36, CFG.W / 2, CFG.H / 2);
    }

    update() {
        if (this.paused) return;
        this.frame++; this.stateT++;
        /* ジョイスティック: 左パネルDOMジョイスティックがあれば優先、なければキャンバス左半分の仮想ジョイスティック */
        delete this.keys['JoystickX'];
        delete this.keys['JoystickY'];
        /* 左パネルDOMジョイスティックは廃止。タッチ時にキャンバス上に出現する仮想ジョイスティックのみ使用 */
        this.joystick.update();
        this.fx.update(); this.txt.update(); this.efx.update(); this.bg.update();
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
        if (this.slowT > 0) this.slowT--;
        if (this.fadeD !== 0) this.fadeA = clamp(this.fadeA + this.fadeD * 0.02, 0, 1);

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
            if (this.stateT === 1) { this.txt.show(`— 第${this.stageIdx + 1}章 : ${this.sd.name} —`, "#ff4d00", 200, 38, CFG.W / 2, CFG.H / 2 - 60); this.sd.desc.split('\n').forEach((l, i) => this.txt.show(l, "#e0cda7", 200, 26, CFG.W / 2, CFG.H / 2 + i * 40)); }
            if (this.stateT > 220 || (this.stateT > 40 && start)) {
                this.state = STATE.PLAYING; this.stateT = 0;
                this.sound.playBGM('stage' + (this.stageIdx + 1));
            }
            return;
        }
        if (this.state === STATE.PLAYING) {
            this.crow.update(this.keys); this.tryTriggerBossAbility(); spawnEnemies(this); spawnObstacles(this);
            const ss = this.scrollSpd; this.enemies.forEach(e => e.update(this.crow.cx, this.crow.cy, this.eBullets, ss, this.fx));
            updateSpecialBullets(this.eBullets);
            this.eBullets.forEach(b => { b.x += b.vx; b.y += b.vy; if (b.x < -30 || b.x > CFG.W + 30 || b.y < -30 || b.y > CFG.H + 30) b.active = false; });
            this.relics.forEach(r => r.update(ss)); this.obstacles.forEach(o => o.update(ss)); checkCollisions(this);
            this.enemies = this.enemies.filter(e => e.active); this.crow.feathers = this.crow.feathers.filter(f => f.active); this.bulletPool.releaseInactive(); this.relics = this.relics.filter(r => r.active); this.obstacles = this.obstacles.filter(o => o.active);
            if (this.crow.hp <= 0) { this.state = STATE.GAME_OVER; this.stateT = 0; this.sound.stopBGM(); this.sound.playGameOver(); this.sound.playBGM('gameover'); return; }
            if (this.blueK >= 3) this.triggerBoss();
            return;
        }
        if (this.state === STATE.BOSS_INTRO) {
            this.crow.update(this.keys); this.crow.feathers.forEach(f => { f.x += f.vx; f.y += f.vy; f.life++; if (f.x < -30 || f.x > CFG.W + 30) f.active = false; }); this.crow.feathers = this.crow.feathers.filter(f => f.active);
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
            this.crow.update(keys); this.tryTriggerBossAbility();
            if (this.boss && this.boss.idx === 3) {
                this.playerPathHistory.push({ x: this.crow.cx, y: this.crow.cy });
                if (this.playerPathHistory.length > 180) this.playerPathHistory.shift();
            }
            const bossOpts = { sound: this.sound };
            if (this.boss && this.boss.idx === 3) bossOpts.playerPath = this.playerPathHistory;
            this.boss.update(this.crow.cx, this.crow.cy, this.eBullets, this.enemies, this.fx, this.sd, bossOpts);
            if (this.boss && this.boss.idx === 3) {
                this.crow.aimOffset = 0;
                if (this.boss.glitchFieldRect) {
                    const r = this.boss.glitchFieldRect;
                    if (this.crow.cx >= r.x && this.crow.cx <= r.x + r.w && this.crow.cy >= r.y && this.crow.cy <= r.y + r.h)
                        this.crow.aimOffset = this.boss.aimOffsetRad;
                }
            }
            this.enemies.forEach(e => e.update(this.crow.cx, this.crow.cy, this.eBullets, 0, this.fx));
            updateSpecialBullets(this.eBullets);
            this.eBullets.forEach(b => {
                if (b.homing) {
                    const dx = this.crow.cx - b.x; const dy = this.crow.cy - b.y; const d = Math.hypot(dx, dy) || 1;
                    const wantA = Math.atan2(dy, dx); const curA = Math.atan2(b.vy, b.vx);
                    let da = wantA - curA; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
                    const turn = (15 * Math.PI / 180) / 60; const newA = curA + Math.max(-turn, Math.min(turn, da));
                    const spd = Math.hypot(b.vx, b.vy);
                    b.vx = Math.cos(newA) * spd; b.vy = Math.sin(newA) * spd;
                }
                b.x += b.vx; b.y += b.vy;
                if (b.x < -30 || b.x > CFG.W + 30 || b.y < -30 || b.y > CFG.H + 30) b.active = false;
            });
            this.relics.forEach(r => r.update(0)); checkCollisions(this); this.enemies = this.enemies.filter(e => e.active); this.crow.feathers = this.crow.feathers.filter(f => f.active); this.bulletPool.releaseInactive(); this.relics = this.relics.filter(r => r.active);
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
                    this.state = STATE.STAGE_CLEAR; this.stateT = 0; this.sound.stopBGM(); this.sound.playStageClear();
                    this.txt.show("STAGE CLEAR", "#ffcc00", 180, 48, CFG.W / 2, CFG.H / 2 - 40); this.txt.show(`— ${this.sd.name} 浄化完了 —`, "#e0cda7", 180, 24, CFG.W / 2, CFG.H / 2 + 10);
                }
            } return;
        }
        if (this.state === STATE.STAGE_CLEAR) {
            this.crow.update(this.keys); this.relics.forEach(r => r.update(0)); this.relics.forEach(r => { if (r.active && dist(r.x, r.y, this.crow.cx, this.crow.cy) < CFG.RELIC_PICKUP_RADIUS) { r.active = false; this.applyRelic(r); } }); this.relics = this.relics.filter(r => r.active);
            if (this.stateT > 150) { this.crow.x += 8; this.crow.anim.set('DASH'); } if (this.stateT > 180) this.fadeD = 1;
            if (this.stateT > 230) {
                if (this.stageIdx < STAGES.length - 1) {
                    this.sound.playStageTransition();
                    this.stageIdx++; this.crow.x = 100; this.crow.y = CFG.H / 2 - 4; this.fadeD = -1; this.startStage();
                } else { this.state = STATE.VICTORY; this.stateT = 0; this.fadeD = -1; this.sound.playBGM('ending'); }
            } return;
        }
        if (this.state === STATE.GAME_OVER) { if (this.stateT > 90 && start) this.restart(); return; }
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
        this.obstacles.forEach(o => o.draw(c)); this.relics.forEach(r => r.draw(c)); this.enemies.forEach(e => e.draw(c));
        this.eBullets.forEach(b => { if (!b.active) return; c.save(); c.globalAlpha = 0.85; c.fillStyle = b.color; c.beginPath(); c.arc(b.x, b.y, b.r || 5, 0, Math.PI * 2); c.fill(); c.globalAlpha = 0.3; c.beginPath(); c.arc(b.x, b.y, (b.r || 5) + 4, 0, Math.PI * 2); c.fill(); c.restore(); });
        this.crow.drawFeathers(c); this.crow.drawTrail(c); this.crow.draw(c); if (this.boss) this.boss.draw(c); this.fx.draw(c); this.fx.drawArenaEffects(c); this.fx.drawFlash(c); this.efx.draw(c, this.crow);
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
        if ([STATE.PLAYING, STATE.BOSS_FIGHT, STATE.BOSS_INTRO, STATE.STAGE_CLEAR].includes(this.state)) this.joystick.draw(c);
        if (this.state === STATE.GAME_OVER) drawGameOverScene(c, this);
        if (this.state === STATE.VICTORY) drawVictoryScene(c, this);
        if (this.fadeA > 0) { c.fillStyle = `rgba(0,0,0,${this.fadeA})`; c.fillRect(0, 0, CFG.W, CFG.H); }
        if (this.paused) drawPauseOverlay(c);
        c.restore();
    }

    /** FPS に応じてパーティクル・エフェクト品質を加減し、低スペックでもプレイ可能に。 */
    _adaptiveQuality(deltaMs) {
        if (deltaMs <= 0 || deltaMs > 500) return;
        const fps = 1000 / deltaMs;
        if (fps < 30) {
            this.qualityParticle *= 0.92;
            this.qualityEffect *= 0.95;
        } else if (fps > 55) {
            this.qualityParticle = Math.min(1, this.qualityParticle * 1.04);
            this.qualityEffect = Math.min(1, this.qualityEffect * 1.02);
        }
        this.qualityParticle = clamp(this.qualityParticle, 0.25, 1);
        this.qualityEffect = clamp(this.qualityEffect, 0.25, 1);
    }

    /** 1フレームの例外でループが止まり「画面が落ちる」のを防ぐ。コンソールに [CROW] で原因が出る。 */
    loop(timestamp) {
        if (this._lastLoopTime > 0) this._adaptiveQuality(timestamp - this._lastLoopTime);
        this._lastLoopTime = timestamp;
        try {
            this.update();
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
