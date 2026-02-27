/**
 * CROW'S DESTINY — ボス基底クラス（コンストラクタ・update 振り分け・takeDamage・共通定数）
 * 個別ボスの update/draw は bossUpdates*.js / bossDraw.js で Boss.prototype に追加。
 */
(function (global) {
'use strict';

const CFG = global.CrowDestiny.CFG;
const Anim = global.CrowDestiny.Anim;
const Enemy = global.CrowDestiny.Enemy;
const clamp = global.CrowDestiny.clamp;
const rr = global.CrowDestiny.rr;
/** 全ボス共通: 表示・当たり判定を60%に縮小 */
const BOSS_SIZE_SCALE = 0.6;

/** 3面ボス・ミミック用SVG（周回コア描画）。1回だけ読み込み */
let _mimicGuardianSvgImg = null;
function getMimicGuardianSvgImage() {
    if (_mimicGuardianSvgImg && _mimicGuardianSvgImg.complete && _mimicGuardianSvgImg.naturalWidth) return _mimicGuardianSvgImg;
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">' +
        '<circle cx="18" cy="18" r="15" fill="#5A2D8A" stroke="#C39BFF" stroke-width="2"/>' +
        '<path d="M18 6 L24 18 L18 30 L12 18 Z" fill="#8B5CF6" stroke="#C39BFF" stroke-width="1.2"/>' +
        '</svg>';
    const img = new Image();
    img.src = 'data:image/svg+xml,' + encodeURIComponent(svg);
    _mimicGuardianSvgImg = img;
    return img;
}

class Boss {
    constructor(sd, idx, form) {
        this.x = CFG.W + 80; this.y = 200; this.tx = CFG.W * 0.68; this.ty = CFG.H / 2 - 30;
        this.sd = sd; this.idx = idx; this.form = (idx === 6 && form != null) ? form : 0;
        const hpScale = 2 * Math.pow(1.1, idx);
        if (idx === 6) {
            const baseHp = Math.floor((sd.bossHpBase || 660) / 3);
            const formMul = this.form === 0 ? 1 : (this.form === 1 ? 2 : 3);
            this.maxHp = Math.floor(baseHp * formMul * hpScale);
            this.hp = this.maxHp;
        } else {
            const base = sd.bossHpBase || 220;
            const boss2Mul = idx === 1 ? 1.1 : 1;
            this.maxHp = Math.floor(base * hpScale * boss2Mul);
            this.hp = this.maxHp;
        }
        this.active = true; this.arrived = false; this.timer = 0; this.phaseT = 0; this.phase = 0; this.maxPhases = 3 + Math.min(idx, 2);
        this.name = sd.bossName; this.color = sd.bossColor; this.hitFlash = 0;
        this.anim = new Anim({ IDLE: { frames: 4, loop: true, speed: 0.7 }, CHARGE: { frames: 4, loop: false, speed: 1.5 }, ATTACK: { frames: 4, loop: false, speed: 1.2 }, HIT: { frames: 3, loop: false, speed: 1 }, DEATH: { frames: 4, loop: false, speed: 0.6 } });
        this.atkCD = 0; this.chargeTarget = null;
        this.atkSpd = (sd.bossAtkSpd || 1.0) * (idx === 6 && this.form === 1 ? 2 : idx === 6 && this.form === 2 ? 3 : 1) * (idx === 1 ? 1.1 : 1);
        this.laserWarn = 0; this.laserAngle = 0; this.clones = []; this.cloneCD = 0;
        this._drawW = 80; this._drawH = 80;
        this.introT = 0; this.introDone = false; this.INTRO_DUR = 60;
        this.deathT = 0; this._pixBuf = null;
        this.berserk = false;
        this.lastStandTriggered = false; this.lastStandFreezeT = 0;
        if (idx === 0) {
            this.moveDir = 1; this._prevMoveDir = 1; this.telegraphT = 0; this.pendingAttack = null;
            this.boss1TurnFlashTriggered = false;
            this.boneBulletCD = 0; this.fingerBulletCD = 0; this.fingerBulletCount = 0;
            this.tailSwingCD = 0; this.purpleBeamCD = 0; this.purpleBeamTelegraph = 0; this.purpleBeamActive = 0; this.purpleBeamAngle = 0;
            this.scatterBurstCD = 0; this.grenadeLandings = []; this.rushT = 0; this.rushCD = 0;
        }
        if (idx === 1) {
            this.boss2Phase = 'intro';
            this.boss2BaseX = CFG.W / 2; this.boss2BaseY = CFG.H / 2 - 30;
            this.x = CFG.W / 2; this.y = -120; this.tx = CFG.W / 2; this.ty = CFG.H / 2 - 30;
            this.boss2MoveT = 0; this.boss2RotDir = 1;
            this.boss2Frame = { col: 1, row: 1 };
            this.boss2RotSeq = [{ col: 0, row: 0 }, { col: 1, row: 0 }, { col: 2, row: 0 }];
            this.boss2RotSeqIdx = 0; this.boss2RotFrameTick = 0; this.boss2RotFrameRate = 10;
            this.boss2AttackTimer = 0; this.boss2AttackCooldown = 90;
            this.boss2RageTimer = 0; this.boss2RageCooldown = 60; this.boss2FireEffectT = 0;
            this.boss2LaserCD = 0; this.boss2LaserWarnT = 0;
        }
        if (idx === 2) {
            this.teleportCD = 0; this.afterimages = [];
            this.noiseCD = 0; this.thunderCD = 0; this.thunderWarnT = 0; this.thunderActive = 0;
            this.mirrorClones = []; this.mirrorCD = 0;
            this.dataWaveCD = 0; this.paranoiaT = 0; this.portalResidue = null;
            this.mimicZigzagCD = 0; this.mimicCores = null;
            this.mimicChargePhase = null; this.mimicChargeT = 0; this.mimicSpinAngle = 0; this.mimicChargeVx = 0; this.mimicChargeVy = 0;
        }
        if (idx === 3) {
            this.ironWingPhase = 'enter'; this.ironWingPhaseT = 0;
            this.ironWingSeq = ['patrol', 'spread', 'patrol', 'dive', 'patrol', 'spiral'];
            this.ironWingSeqIdx = 0; this.ironWingRage = false;
            this.ironWingFrameSequence = [0, 1, 4, 7, 8, 7, 4, 1];
            this.ironWingFrameDurationsTicks = [11, 7, 7, 8, 12, 8, 7, 7];
            this.ironWingSeqIndex = 0; this.ironWingFrameTimer = 0; this.ironWingFlipX = true;
            this.ironWingWaveT = 0; this.ironWingShootTimer = 0; this.ironWingShootRate = 40;
            this.ironWingDiveTargetX = 0; this.ironWingDiveTargetY = 0; this.ironWingDiveSpeed = 18;
            this.ironWingSpiralAngle = 0; this.ironWingVx = 0; this.ironWingVy = 0;
            this.ironWingTrail = []; this.ironWingBatSwarmCD = 0; this.deathRollT = 0; this.outOfControlT = 0;
        }
        if (idx === 4) {
            this.scarabotPhase = 'IDLE'; this.scarabotEnraged = false;
            this.scarabotAnimFrames = [0, 1, 2, 1]; this.scarabotAnimIndex = 0; this.scarabotAnimTimer = 0; this.scarabotAnimSpeed = 6;
            this.scarabotFlipX = true; this.scarabotAttackCD = 0; this.scarabotAnimState = 'walk';
            this.scarabotBaseTx = this.tx; this.scarabotBaseTy = this.ty;
            this.domeShieldT = 0; this.domeShieldCD = 0;
            this.scarabotDashT = 0; this.scarabotDashVx = 0; this.scarabotDashVy = 0;
            this.energyTrail = [];
        }
        if (idx === 5) {
            this.snowQueenPhase = 1; this.snowQueenEnraged = false; this.snowQueenSpriteState = 'IDLE';
            this.snowQueenFrameIndex = 0; this.snowQueenFrameTimer = 0;
            this.snowQueenGuard = false; this.snowQueenGuardT = 0; this.snowQueenGuardCD = 0;
            this.snowQueenActionT = 0; this.snowQueenActionInterval = 120;
            this.snowQueenMoveTargetX = 0; this.snowQueenMoveTargetY = 0; this.snowQueenMoveT = 0; this.snowQueenMoveInterval = 180;
            this.iceTrail = []; this.angularPhase = 0;
        }
        if (idx === 6) {
            this.voidTeleportCD = 0; this.voidAfterimages = []; this.VOID_AFTERIMAGE_LIFE = 180;
        }
    }
    get hitRadius() {
        if (!this.introDone) return 0;
        let r = Math.max(this._drawW, this._drawH) / 2 * 0.95;
        if (this.idx === 3 && this.deathRollT > 0) r *= 1.3;
        return r;
    }
    get playerHitRadius() {
        if (!this.introDone) return 0;
        return Math.max(this._drawW, this._drawH) / 2 * 0.95;
    }
    _playBossSE(opts, kind) {
        if (!opts || !opts.sound) return;
        if (kind === 'shot') {
            if ((this._bossShotCD || 0) > 0) return;
            this._bossShotCD = 12;
            opts.sound.playBossShot();
        } else if (kind === 'big') { opts.sound.playBossBig(); }
        else if (kind === 'charge') { opts.sound.playBossCharge(); }
    }
    update(px, py, bullets, enemies, fx, sd) {
        if (this.anim.state === 'DEATH') { this.deathT++; this.anim.update(); if (this.anim.done) this.active = false; return; }
        this.berserk = this.hp <= this.maxHp * 0.3;
        this.timer++; this.anim.update();
        if (!this.arrived) {
            if (this.idx === 1) {
                this.x = this.tx; this.y = Math.min(this.ty, this.y + 3.5);
                if (this.y >= this.ty) { this.y = this.ty; this.arrived = true; }
            } else {
                this.x += (this.tx - this.x) * 0.03; this.y += (this.ty - this.y) * 0.03;
                if (Math.abs(this.x - this.tx) < 5) this.arrived = true;
            }
            return;
        }
        if (!this.introDone) { this.introT++; if (this.introT >= this.INTRO_DUR) this.introDone = true; return; }
        if (this.lastStandFreezeT > 0) { this.lastStandFreezeT--; return; }
        this._bossShotCD = Math.max(0, (this._bossShotCD || 0) - 1);
        const opts = arguments[6] || {};
        if (this.idx === 0) { this.updateBoss1(px, py, bullets, fx, opts); if (this.hitFlash > 0) this.hitFlash--; return; }
        if (this.idx === 1) { this.updateBoss2(px, py, bullets, enemies, fx, sd, opts); if (this.hitFlash > 0) this.hitFlash--; return; }
        if (this.idx === 2) { this.updateBossMimic(px, py, bullets, fx, opts); if (this.hitFlash > 0) this.hitFlash--; return; }
        if (this.idx === 3) { this.updateBossIronWing(px, py, bullets, fx, opts); if (this.hitFlash > 0) this.hitFlash--; return; }
        if (this.idx === 4) { this.updateBossGuardian(px, py, bullets, fx, opts); if (this.hitFlash > 0) this.hitFlash--; return; }
        if (this.idx === 5) { this.updateBossBluecore(px, py, bullets, fx, opts); if (this.hitFlash > 0) this.hitFlash--; return; }
        if (this.idx === 6) { this.updateBossVoid(px, py, bullets, fx, opts); if (this.hitFlash > 0) this.hitFlash--; return; }
        const formStatMul = (this.idx === 6 && this.form === 1) ? 2 : (this.idx === 6 && this.form === 2) ? 3 : 1;
        this.phaseT++;
        const phaseDurBase = Math.max(160, 280 - this.idx * 18);
        let phaseDur = this.berserk ? Math.floor(phaseDurBase * 0.6) : phaseDurBase;
        if (this.idx === 6 && formStatMul > 1) phaseDur = Math.max(40, Math.floor(phaseDur / formStatMul));
        if (this.phaseT > phaseDur) { this.phase = (this.phase + 1) % this.maxPhases; this.phaseT = 0; this.chargeTarget = null; this.laserWarn = 0; }
        const ampX = 45 + this.idx * 14, ampY = 22 + this.idx * 10;
        const moveMul = this.berserk ? 1.55 : 1;
        this.x = this.tx + (Math.sin(this.timer * 0.015) * ampX + Math.cos(this.timer * 0.023) * (ampX * 0.45)) * moveMul;
        this.y = this.ty + (Math.sin(this.timer * 0.02) * ampY + Math.sin(this.timer * 0.031) * (ampY * 0.55)) * moveMul;
        const bulletMul = (1 + this.idx * 0.15) * (this.berserk ? 1.35 : 1) * formStatMul;
        const bulletColor = this.berserk ? "#ff4466" : this.color;
        if (this.phase === 0) {
            this.atkCD--; const intv = Math.max(6, Math.round((22 - this.idx * 2) / this.atkSpd));
            if (this.atkCD <= 0) {
                this.atkCD = intv; this.anim.set('ATTACK');
                const n = 6 + this.idx * 2, baseAngle = this.timer * 0.025;
                for (let i = 0; i < n; i++) {
                    const a = (Math.PI * 2 / n) * i + baseAngle, spd = (2.6 + this.idx * 0.25) * bulletMul;
                    bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: bulletColor, r: 5 });
                }
                if (this.idx >= 3) for (let i = 0; i < n; i++) {
                    const a = (Math.PI * 2 / n) * i + baseAngle + 0.15, spd = (2.2 + this.idx * 0.2) * bulletMul;
                    bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: bulletColor, r: 4 });
                }
            }
        } else if (this.phase === 1) {
            if (!this.chargeTarget) this.chargeTarget = { x: px, y: py };
            const dx = this.chargeTarget.x - this.x, dy = this.chargeTarget.y - this.y, d = Math.hypot(dx, dy) || 1, cSpd = 7 + this.idx * 0.6;
            if (d > 30) { this.x += dx / d * cSpd; this.y += dy / d * cSpd; this.anim.set('CHARGE'); }
            else {
                this.chargeTarget = null; fx.burst(this.x, this.y, this.color, 18 + this.idx * 2, 5);
                const burst = 10 + this.idx * 3, spd = (2.6 + this.idx * 0.2) * bulletMul;
                for (let i = 0; i < burst; i++) { const a = (Math.PI * 2 / burst) * i; bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: bulletColor, r: 4 }); }
                if (this.idx >= 4) for (let i = 0; i < burst; i++) { const a = (Math.PI * 2 / burst) * i + 0.2; bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * spd * 0.85, vy: Math.sin(a) * spd * 0.85, active: true, color: bulletColor, r: 3 }); }
            }
        } else if (this.phase === 2) {
            if (this.phaseT % Math.max(50, 110 - this.idx * 12) === 0) { enemies.push(new Enemy(CFG.W + 30, rr(60, CFG.H - 80), sd, false, this.idx)); if (this.idx >= 5) enemies.push(new Enemy(CFG.W + 40, rr(80, CFG.H - 100), sd, false, this.idx)); }
            this.atkCD--; const intv2 = Math.max(12, Math.round((45 - this.idx * 4) / this.atkSpd));
            if (this.atkCD <= 0) {
                this.atkCD = intv2; const dx = px - this.x, dy = py - this.y, d = Math.hypot(dx, dy) || 1, spd = (3.2 + this.idx * 0.35) * bulletMul;
                const rays = 1 + Math.min(this.idx, 3);
                for (let r = 0; r < rays; r++) {
                    const off = (r - (rays - 1) / 2) * 0.12; const ax = Math.atan2(dy, dx) + off;
                    bullets.push({ x: this.x, y: this.y, vx: Math.cos(ax) * spd, vy: Math.sin(ax) * spd, active: true, color: bulletColor, r: 5 });
                }
            }
        } else if (this.phase === 3) {
            this.atkCD--; const spiralIntv = Math.max(2, 5 - Math.floor(this.idx / 2));
            if (this.atkCD <= 0) {
                this.atkCD = spiralIntv; const baseSpd = (2.2 + this.idx * 0.18) * bulletMul;
                const spirals = this.idx >= 2 ? 2 : 1;
                for (let s = 0; s < spirals; s++) {
                    const a = this.timer * (0.08 + s * 0.05) + s * Math.PI;
                    bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * baseSpd, vy: Math.sin(a) * baseSpd, active: true, color: bulletColor, r: 4 });
                    if (this.idx >= 5) bullets.push({ x: this.x, y: this.y, vx: Math.cos(a + 0.4) * baseSpd * 0.9, vy: Math.sin(a + 0.4) * baseSpd * 0.9, active: true, color: bulletColor, r: 3 });
                }
            }
        } else if (this.phase === 4) {
            if (this.laserWarn < 55) { this.laserWarn++; this.laserAngle = Math.atan2(py - this.y, px - this.x); }
            else if (this.laserWarn === 55) {
                this.laserWarn++; const la = this.laserAngle, spd = (5 + this.idx * 0.4) * bulletMul;
                const beamCount = 7 + this.idx * 2, spread = 0.055 + this.idx * 0.008;
                for (let i = -Math.floor(beamCount / 2); i <= Math.floor(beamCount / 2); i++) {
                    const a = la + i * spread; bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: "#ff2200", r: 6 });
                }
                fx.burst(this.x, this.y, "#ff2200", 24 + this.idx * 2, 6);
                this.laserWarn = 0;
            }
        }
        if (this.anim.state !== 'IDLE' && this.anim.done) this.anim.set('IDLE');
        if (this.hitFlash > 0) this.hitFlash--;
    }
    takeDamage(amt, fx) {
        let actual = amt;
        if (this.idx === 5 && this.snowQueenGuard) actual = Math.floor(amt * (1 - 0.85));
        const wasAbove10 = this.hp > this.maxHp * 0.1;
        this.hp -= actual;
        this.hitFlash = 4;
        if (this.anim.state !== 'DEATH') this.anim.set('HIT');
        if (this.hp <= 0) { this.anim.set('DEATH'); this.deathT = 0; fx.big(this.x, this.y, this.color); return; }
        if (wasAbove10 && this.hp <= this.maxHp * 0.1 && !this.lastStandTriggered) {
            this.lastStandTriggered = true;
            this.lastStandFreezeT = 90;
        }
        if (this.idx === 1 && fx.addArenaDebris) {
            for (let i = 0; i < 3; i++)
                fx.addArenaDebris(this.x + rr(-20, 20), this.y, (Math.random() - 0.5) * 4, -1 - Math.random() * 2, 80, '#8B4513', 12, 5);
        }
        if (this.idx === 4) {
            this.armorPeelLevel = Math.min(3, (this.armorPeelLevel || 0) + 0.25);
            if (fx.addArenaDebris) {
                const debrisCount = Math.max(1, Math.floor(actual / 10));
                for (let i = 0; i < debrisCount; i++) {
                    fx.addArenaDebris(this.x + rr(-30, 30), this.y + rr(-10, 10), (Math.random() - 0.5) * 3, -1 - Math.random() * 2, 70, '#4A9B8E', 10, 4);
                }
            }
        }
    }
    get cx() { return this.x; }
    get cy() { return this.y; }
}

global.CrowDestiny = global.CrowDestiny || {};
global.CrowDestiny.Boss = Boss;
global.CrowDestiny.BOSS_SIZE_SCALE = BOSS_SIZE_SCALE;
global.CrowDestiny.getMimicGuardianSvgImage = getMimicGuardianSvgImage;

})(typeof window !== 'undefined' ? window : this);
