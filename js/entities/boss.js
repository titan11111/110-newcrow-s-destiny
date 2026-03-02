/**
 * CROW'S DESTINY — ボス（多様な攻撃パターン）
 * 演出・動き強化の設計は docs/boss-enhancement-design.md を参照。
 */
(function (global) {
'use strict';

const CFG = global.CrowDestiny.CFG;
const Anim = global.CrowDestiny.Anim;
const IMG = global.CrowDestiny.IMG;
const rr = global.CrowDestiny.rr;
const Enemy = global.CrowDestiny.Enemy;
const clamp = global.CrowDestiny.clamp;
/** shadowBlur 禁止フラグ参照（iOS / 低FPS 時 true） */
const ns = () => global.CrowDestiny.noShadow;
/** 全ボス共通: 表示・当たり判定を60%に縮小（その代わり画面内を動き回る） */
const BOSS_SIZE_SCALE = 0.6;

/** 3面ボス・ガーディアン用SVG（周回するオブジェクトの描画）。1回だけ読み込み */
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
            /* form0: ×1.4, form1: ×2, form2: ×3。全形態とも防御力1.2倍（裂け目＝本体のためform0も1.2倍） */
            const formMul = this.form === 0 ? 1.4 : (this.form === 1 ? 2 : 3);
            const defMul = 1.2;
            this.maxHp = Math.floor(baseHp * formMul * hpScale * defMul);
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
        const formSpd = idx === 6 && this.form === 1 ? 2 * 1.15 : idx === 6 && this.form === 2 ? 3 * 1.15 : 1;
        this.atkSpd = (sd.bossAtkSpd || 1.0) * formSpd * (idx === 1 ? 1.1 : 1);
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
            this.ironWingSeq = ['patrol', 'spread', 'patrol', 'dive_prep', 'patrol', 'spiral'];
            this.ironWingSeqIdx = 0; this.ironWingRage = false;
            this.ironWingFrameSequence = [0, 1, 4, 7, 8, 7, 4, 1];
            this.ironWingFrameDurationsTicks = [11, 7, 7, 8, 12, 8, 7, 7];
            this.ironWingSeqIndex = 0; this.ironWingFrameTimer = 0; this.ironWingFlipX = true;
            this.ironWingWaveT = 0; this.ironWingShootTimer = 0; this.ironWingShootRate = 40;
            this.ironWingDiveTargetX = 0; this.ironWingDiveTargetY = 0; this.ironWingDiveSpeed = 18;
            this.ironWingSpiralAngle = 0; this.ironWingVx = 0; this.ironWingVy = 0;
            this.ironWingTrail = []; this.ironWingBatSwarmCD = 0; this.deathRollT = 0; this.outOfControlT = 0;
            this.ironWingDashCooldown = 0; this.ironWingDashT = 0; this.ironWingBreakdownTriggered = false;
            this.ironWingLastGaspActive = false;
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
            this.snowQueenActionT = 0; this.snowQueenActionInterval = 90;
            this.snowQueenMoveTargetX = 0; this.snowQueenMoveTargetY = 0; this.snowQueenMoveT = 0; this.snowQueenMoveInterval = 180;
            this.iceTrail = []; this.angularPhase = 0;
            this.snowQueenPrismBurstActive = false; this.snowQueenPrismBurstT = 0;
            this.snowQueenDiamondDustActive = false; this.snowQueenDiamondDustT = 0; this.snowQueenDiamondDustCount = 0;
        }
        if (idx === 6) {
            this.voidTeleportCD = 0; this.voidAfterimages = []; this.VOID_AFTERIMAGE_LIFE = 180;
            if (this.form === 1 || this.form === 2) this._voidSpeedMul = 1.15;
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
    update(px, py, bullets, enemies, fx, sd, opts, d) {
        if (d == null || d <= 0) d = 1;
        if (this.anim.state === 'DEATH') { this.deathT += d; this.anim.update(d); if (this.anim.done) this.active = false; return; }
        this.berserk = this.hp <= this.maxHp * 0.3;
        this.timer += d; this.anim.update(d);
        if (!this.arrived) {
            if (this.idx === 1) {
                this.x = this.tx; this.y = Math.min(this.ty, this.y + 3.5 * d);
                if (this.y >= this.ty) { this.y = this.ty; this.arrived = true; }
            } else {
                this.x += (this.tx - this.x) * 0.03 * d; this.y += (this.ty - this.y) * 0.03 * d;
                if (Math.abs(this.x - this.tx) < 5) this.arrived = true;
            }
            return;
        }
        if (!this.introDone) { this.introT += d; if (this.introT >= this.INTRO_DUR) this.introDone = true; return; }
        if (this.lastStandFreezeT > 0) { this.lastStandFreezeT -= d; return; }
        this._bossShotCD = Math.max(0, (this._bossShotCD || 0) - d);
        opts = opts || {};
        if (this.idx === 0) { this.updateBoss1(px, py, bullets, fx, opts, d); if (this.hitFlash > 0) this.hitFlash -= d; return; }
        if (this.idx === 1) { this.updateBoss2(px, py, bullets, enemies, fx, sd, opts, d); if (this.hitFlash > 0) this.hitFlash -= d; return; }
        if (this.idx === 2) { this.updateBossMimic(px, py, bullets, fx, opts, d); if (this.hitFlash > 0) this.hitFlash -= d; return; }
        if (this.idx === 3) { this.updateBossIronWing(px, py, bullets, fx, opts, d); if (this.hitFlash > 0) this.hitFlash -= d; return; }
        if (this.idx === 4) { this.updateBossGuardian(px, py, bullets, fx, opts, d); if (this.hitFlash > 0) this.hitFlash -= d; return; }
        if (this.idx === 5) { this.updateBossBluecore(px, py, bullets, fx, opts, d); if (this.hitFlash > 0) this.hitFlash -= d; return; }
        if (this.idx === 6) { this.updateBossVoid(px, py, bullets, fx, opts, d); if (this.hitFlash > 0) this.hitFlash -= d; return; }
        const formStatMul = (this.idx === 6 && this.form === 1) ? 2 : (this.idx === 6 && this.form === 2) ? 3 : 1;
        this.phaseT += d;
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
            this.atkCD -= d; const intv = Math.max(6, Math.round((22 - this.idx * 2) / this.atkSpd));
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
            const dx = this.chargeTarget.x - this.x, dy = this.chargeTarget.y - this.y, dist = Math.hypot(dx, dy) || 1, cSpd = 7 + this.idx * 0.6;
            if (dist > 30) { this.x += (dx / dist) * cSpd * d; this.y += (dy / dist) * cSpd * d; this.anim.set('CHARGE'); }
            else {
                this.chargeTarget = null; fx.burst(this.x, this.y, this.color, 18 + this.idx * 2, 5);
                const burst = 10 + this.idx * 3, spd = (2.6 + this.idx * 0.2) * bulletMul;
                for (let i = 0; i < burst; i++) { const a = (Math.PI * 2 / burst) * i; bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: bulletColor, r: 4 }); }
                if (this.idx >= 4) for (let i = 0; i < burst; i++) { const a = (Math.PI * 2 / burst) * i + 0.2; bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * spd * 0.85, vy: Math.sin(a) * spd * 0.85, active: true, color: bulletColor, r: 3 }); }
            }
        } else if (this.phase === 2) {
            const spawnIntv = Math.max(50, 110 - this.idx * 12);
            if (Math.floor(this.phaseT / spawnIntv) > Math.floor((this.phaseT - d) / spawnIntv)) { enemies.push(new Enemy(CFG.W + 30, rr(60, CFG.H - 80), sd, false, this.idx)); if (this.idx >= 5) enemies.push(new Enemy(CFG.W + 40, rr(80, CFG.H - 100), sd, false, this.idx)); }
            this.atkCD -= d; const intv2 = Math.max(12, Math.round((45 - this.idx * 4) / this.atkSpd));
            if (this.atkCD <= 0) {
                this.atkCD = intv2; const dx = px - this.x, dy = py - this.y, d = Math.hypot(dx, dy) || 1, spd = (3.2 + this.idx * 0.35) * bulletMul;
                const rays = 1 + Math.min(this.idx, 3);
                for (let r = 0; r < rays; r++) {
                    const off = (r - (rays - 1) / 2) * 0.12; const ax = Math.atan2(dy, dx) + off;
                    bullets.push({ x: this.x, y: this.y, vx: Math.cos(ax) * spd, vy: Math.sin(ax) * spd, active: true, color: bulletColor, r: 5 });
                }
            }
        } else if (this.phase === 3) {
            this.atkCD -= d; const spiralIntv = Math.max(2, 5 - Math.floor(this.idx / 2));
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
        if (this.idx === 6 && (this.form === 0 || this.form === 1 || this.form === 2)) actual = Math.floor(amt * (1 / 1.2));
        if (this.idx === 5 && this.snowQueenGuard) actual = Math.floor(actual * (1 - 0.85));
        const wasAbove10 = this.hp > this.maxHp * 0.1;
        this.hp -= actual;
        this.hitFlash = 4;
        if (this.anim.state !== 'DEATH') this.anim.set('HIT');
        if (this.hp <= 0) {
            if (this.idx === 3 && !this.ironWingLastGaspActive) {
                this.ironWingLastGaspActive = true;
                this.hp = 1;
                this.ironWingPhase = 'last_gasp';
                this.ironWingPhaseT = 0;
                return;
            }
            this.anim.set('DEATH'); this.deathT = 0; fx.big(this.x, this.y, this.color); return;
        }
        // ボス4「追い詰めで左下へ行く」分岐は無効化（breakdown 遷移を削除）
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

    /** ボス1: 穢れの先兵・彷徨う巨骸 — 骨弾バースト / 骨の指弾 / テイルスウィング / 紫炎噴射 / 突進。攻撃派手・120%サイズ */
    updateBoss1(px, py, bullets, fx, opts, d) {
        if (d == null) d = 1;
        const W = CFG.W; const H = CFG.H;
        const purple = '#9B59B6'; const purpleGlow = '#D7BDE2'; const flame = '#F39C12';
        const lrSpeed = (this.berserk ? 1.4 : 1) * (2.2 / 60 * 10);

        // 突進中：自機に向かって突っ込み、軌跡に弾・シェイク
        if (this.rushT > 0) {
            this.rushT--;
            fx.shake = Math.max(fx.shake || 0, this.berserk ? 18 : 12);
            const dx = px - this.x; const dy = py - this.y; const d = Math.hypot(dx, dy) || 1;
            const rushSpd = this.berserk ? 11 : 8;
            this.x += (dx / d) * rushSpd; this.y += (dy / d) * rushSpd;
            this.x = clamp(this.x, 80, W - 80); this.y = clamp(this.y, 80, H - 80);
            if (this.rushT % 3 === 0) {
                fx.burst(this.x, this.y, purple, 8, 3);
                for (let i = 0; i < 2; i++) {
                    const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.2;
                    const spd = 2 + Math.random() * 2;
                    bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: purpleGlow, r: 6 });
                }
            }
            if (this.rushT <= 0) { this.rushCD = this.berserk ? 180 : 260; fx.burst(this.x, this.y, purple, 28, 8); this._playBossSE(opts, 'big'); }
            this.anim.set('CHARGE');
            return;
        }

        // 紫炎噴射：1面ボスとして読み合いが成立するよう追従は遅め（約1秒で自機方向へ収束）。初見でも避けやすく、慣れればギリギリで抜ける。
        if (this.purpleBeamActive > 0) {
            this.purpleBeamActive--;
            fx.shake = Math.max(fx.shake || 0, 4);
            const wantA = Math.atan2(py - this.y, px - this.x);
            const trackSpeed = 0.055;
            this.purpleBeamAngle += (wantA - this.purpleBeamAngle) * trackSpeed;
            const spd = this.berserk ? 7 : 5.5; const r = this.berserk ? 12 : 10;
            const rays = Math.max(2, Math.floor((this.berserk ? 7 : 5) * 0.5));
            for (let i = 0; i < rays; i++) {
                const a = this.purpleBeamAngle + (i - (rays - 1) / 2) * 0.14;
                bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: purple, r });
            }
            if (this.purpleBeamActive <= 0) { this.purpleBeamCD = this.berserk ? 150 : 240; fx.burst(this.x, this.y, purple, 22, 6); }
            if (this.anim.state !== 'IDLE' && this.anim.done) this.anim.set('IDLE');
            return;
        }

        // 紫炎の前兆（目が約2秒かけて明るくなる＝120フレーム）。発動角度を確定させ、照射60フレーム＝約1秒で読み合い可能に。
        if (this.purpleBeamTelegraph > 0) {
            this.purpleBeamTelegraph--;
            if (this.purpleBeamTelegraph === 0) {
                this.purpleBeamAngle = Math.atan2(py - this.y, px - this.x);
                this.purpleBeamActive = this.berserk ? 70 : 60;
                this._playBossSE(opts, 'big');
                fx.burst(this.x, this.y, purple, 30, 8);
                this.anim.set('ATTACK');
            }
            return;
        }

        // 予兆→発動の遅延処理（骨弾・テイル・骨格崩壊・派手に）
        if (this.telegraphT > 0) {
            this.telegraphT--;
            if (this.telegraphT === 0 && this.pendingAttack) {
                const atk = this.pendingAttack; this.pendingAttack = null;
                if (atk === 'bone') {
                    this._playBossSE(opts, 'shot');
                    const n = Math.max(3, Math.floor((this.berserk ? 11 : 9) * 0.5));
                    const spreadHalf = (Math.PI / 180) * (this.berserk ? 65 : 55);
                    const baseAngle = Math.atan2(py - this.y, px - this.x);
                    for (let i = 0; i < n; i++) {
                        const t = (i / (n - 1 || 1)) - 0.5;
                        const a = baseAngle + t * spreadHalf;
                        const spd = 2.8 + (this.berserk ? 0.5 : 0);
                        bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: purple, r: 10 });
                    }
                    fx.burst(this.x, this.y, purple, 20, 6);
                    this.anim.set('ATTACK');
                } else if (atk === 'tail') {
                    this._playBossSE(opts, 'shot');
                    for (let i = 0; i < 9; i++) {
                        const a = Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 0.9;
                        const spd = 3.5 + Math.random() * 2.5;
                        bullets.push({ x: this.x, y: this.y + 20, vx: Math.cos(a) * spd * 0.35, vy: Math.sin(a) * spd, active: true, color: purpleGlow, r: 7 });
                    }
                    fx.burst(this.x, this.y, purple, 24, 7);
                    fx.shake = Math.max(fx.shake || 0, 25);
                    if (fx.addFloorCrack) fx.addFloorCrack(this.x, H - 5, 55);
                    this.anim.set('ATTACK');
                } else if (atk === 'scatter') {
                    this._playBossSE(opts, 'big');
                    for (let i = 0; i < 19; i++) {
                        const a = Math.atan2(H / 2 - this.y, W / 2 - this.x) + (Math.random() - 0.5) * Math.PI * 0.9;
                        const spd = 3.5 + Math.random() * 3.5;
                        bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: purpleGlow, r: 6 });
                    }
                    fx.burst(this.x, this.y, purple, 28, 8);
                    fx.shake = Math.max(fx.shake || 0, 40);
                }
            }
            return;
        }

        // 通常移動：イージング付き往復（端で減速→折り返し）＋縦にゆっくり漂う。巨骸の重量感を演出。
        const centerX = W * 0.5;
        const moveRange = (this.hp <= this.maxHp * 0.5) ? W * 0.52 : W * 0.38;
        const normalizedX = Math.sin(this.timer * 0.015);
        const easedX = Math.sign(normalizedX) * Math.pow(Math.abs(normalizedX), 0.6);
        this.x = centerX + easedX * moveRange;
        this.moveDir = easedX >= 0 ? 1 : -1;
        this.y = this.ty + Math.sin(this.timer * 0.02) * (H * 0.22) + Math.sin(this.timer * 0.013) * (H * 0.08);
        this.y = clamp(this.y, H * 0.12, H * 0.55);
        if (Math.abs(normalizedX) > 0.97 && !this.boss1TurnFlashTriggered) {
            this.boss1TurnFlashTriggered = true;
            fx.shake = Math.max(fx.shake || 0, 35);
            fx.burst(this.x, this.y, purple, 28, 8);
            if (fx.addFloorCrack) fx.addFloorCrack(this.x, H - 5, 55);
            for (let i = 0; i < 6; i++) {
                if (fx.addArenaDebris) fx.addArenaDebris(rr(0, W), -10, rr(-1, 1), 2 + Math.random() * 3, 90, purpleGlow, 8, 5);
            }
            this._playBossSE(opts, 'big');
            /* 折り返し＝壁を割って突き返してきた脅威：プレイヤー方向に衝撃波的な弾を放つ */
            const baseAngle = Math.atan2(py - this.y, px - this.x);
            const spread = (Math.PI / 180) * 55;
            const n = 7;
            for (let i = 0; i < n; i++) {
                const t = (i / (n - 1 || 1)) - 0.5;
                const a = baseAngle + t * spread;
                const spd = this.berserk ? 4.2 : 3.5;
                bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: purpleGlow, r: 8 });
            }
            bullets.push({ x: this.x, y: this.y, vx: Math.cos(baseAngle) * 4, vy: Math.sin(baseAngle) * 4, active: true, color: purple, r: 10 });
        } else if (Math.abs(normalizedX) < 0.9) {
            this.boss1TurnFlashTriggered = false;
        }
        this._prevMoveDir = this.moveDir;

        this.boneBulletCD--; this.fingerBulletCD--; this.tailSwingCD--; this.purpleBeamCD--; this.scatterBurstCD--; this.rushCD--;

        // 突進 — 自機に向かって突っ込む（クールダウンで発動）
        if (this.rushCD <= 0 && this.telegraphT <= 0 && this.purpleBeamTelegraph <= 0 && this.purpleBeamActive <= 0) {
            this.rushT = this.berserk ? 55 : 45;
            this._playBossSE(opts, 'charge');
            fx.burst(this.x, this.y, purple, 20, 6);
            return;
        }

        // ピンチ専用：骨格崩壊散弾
        if (this.berserk && this.scatterBurstCD <= 0) {
            this.scatterBurstCD = 200;
            this.telegraphT = 30; this.pendingAttack = 'scatter';
            return;
        }

        // 骨弾バースト — 3秒間隔（通常）/ 2秒（ピンチ）
        if (this.boneBulletCD <= 0) {
            this.boneBulletCD = this.berserk ? 120 : 180;
            this.telegraphT = 20; this.pendingAttack = 'bone';
            return;
        }

        // 骨の指弾 — 弾数50%で4発/3発
        if (this.fingerBulletCD <= 0) {
            const fingerMax = Math.max(3, Math.floor((this.berserk ? 9 : 7) * 0.5));
            if (this.fingerBulletCount < fingerMax) {
                this._playBossSE(opts, 'shot');
                const dx = px - this.x; const dy = py - this.y; const d = Math.hypot(dx, dy) || 1;
                const spd = this.berserk ? 3.5 : 3.2;
                bullets.push({ x: this.x - 18, y: this.y, vx: (dx / d) * spd, vy: (dy / d) * spd, active: true, color: purpleGlow, r: 7, homing: true });
                this.fingerBulletCount++; this.fingerBulletCD = 6;
            } else {
                this.fingerBulletCount = 0; this.fingerBulletCD = 200;
            }
        }

        // テイルスウィング — 尾の薙ぎ払い＋骨破片18個
        if (this.tailSwingCD <= 0) {
            this.tailSwingCD = 260;
            this.telegraphT = 25; this.pendingAttack = 'tail';
            return;
        }

        // 紫炎噴射 — 前兆2秒ののち照射
        if (this.purpleBeamCD <= 0 && this.purpleBeamTelegraph <= 0 && this.purpleBeamActive <= 0) {
            this.purpleBeamTelegraph = 120;
            this.purpleBeamCD = 340;
            this._playBossSE(opts, 'charge');
        }

        if (this.anim.state !== 'IDLE' && this.anim.done) this.anim.set('IDLE');
    }

    /** ボス2: 三角ロボ — 3フェーズ(降下→normal→enraged)。回転アニメ・3way/5way/追尾/8方向スプレッド */
    updateBoss2(px, py, bullets, enemies, fx, sd, opts, d) {
        if (d == null) d = 1;
        const W = CFG.W; const H = CFG.H;
        const green = '#00ff44'; const greenGlow = '#66ff88'; const rage = '#ff4400'; const orange = '#ff8800';

        if (this.boss2Phase === 'intro') this.boss2Phase = 'normal';

        const baseX = this.boss2BaseX ?? this.tx;
        const baseY = this.boss2BaseY ?? this.ty;
        this.boss2BaseX = baseX; this.boss2BaseY = baseY;

        const isEnraged = this.boss2Phase === 'enraged';
        const moveRangeX = isEnraged ? 150 : 120;
        const moveSpeed = isEnraged ? 0.03 : 0.018;

        this.boss2MoveT = (this.boss2MoveT || 0) + moveSpeed;
        if (isEnraged) {
            /** 暴走時: 画面の斜め隅を点と点で結ぶように動く（追い込まれた落ち着きのなさ） */
            const margin = 90;
            const corners = [
                [margin, margin],
                [W - margin, margin],
                [W - margin, H - margin],
                [margin, H - margin]
            ];
            const t = ((this.boss2MoveT * 0.8) % 4 + 4) % 4;
            const i0 = Math.floor(t) % 4;
            const i1 = (i0 + 1) % 4;
            const u = t - i0;
            this.x = corners[i0][0] + (corners[i1][0] - corners[i0][0]) * u;
            this.y = corners[i0][1] + (corners[i1][1] - corners[i0][1]) * u;
        } else {
            this.x = baseX + Math.sin(this.boss2MoveT) * moveRangeX;
            this.y = baseY + Math.sin(this.boss2MoveT * 0.6) * 30;
            this.x = clamp(this.x, 100, W - 100);
            this.y = clamp(this.y, 80, H - 120);
        }

        if (this.hp < this.maxHp * 0.5 && this.boss2Phase === 'normal') {
            this.boss2Phase = 'enraged';
            this.boss2RotFrameRate = 4;
            this.boss2AttackCooldown = 60;
            this.boss2RageCooldown = 45;
            this._playBossSE(opts, 'big');
        }

        const rotRate = this.boss2RotFrameRate ?? 10;
        this.boss2RotFrameTick = (this.boss2RotFrameTick || 0) + 1;
        if (this.boss2RotFrameTick >= rotRate) {
            this.boss2RotFrameTick = 0;
            const seq = this.boss2RotSeq || [{ col: 0, row: 0 }, { col: 1, row: 0 }, { col: 2, row: 0 }];
            this.boss2RotSeqIdx = (this.boss2RotSeqIdx + (this.boss2RotDir >= 0 ? 1 : -1) + seq.length) % seq.length;
            this.boss2Frame = seq[this.boss2RotSeqIdx];
            if (this.boss2RotSeqIdx === 0 && Math.random() < 0.3) this.boss2RotDir *= -1;
        }

        this.boss2FireEffectT = Math.max(0, (this.boss2FireEffectT || 0) - 1);
        this.boss2AttackTimer = (this.boss2AttackTimer || 0) + 1;
        this.boss2RageTimer = (this.boss2RageTimer || 0) + 1;

        if (this.boss2FireEffectT > 0) this.boss2Frame = { col: 2, row: 1 };

        /** 50％以下: ひかる単発レーザー（予兆→1発） */
        if (this.hp < this.maxHp * 0.5) {
            this.boss2LaserCD = (this.boss2LaserCD || 0) - 1;
            if (this.boss2LaserWarnT > 0) {
                this.boss2LaserWarnT--;
                if (this.boss2LaserWarnT === 0) {
                    const la = Math.atan2(py - this.y, px - this.x);
                    const spd = 9;
                    bullets.push({ x: this.x, y: this.y, vx: Math.cos(la) * spd, vy: Math.sin(la) * spd, active: true, color: '#88ffcc', r: 10 });
                    fx.burst(this.x, this.y, '#88ffcc', 16, 5);
                    this._playBossSE(opts, 'shot');
                }
            } else if (this.boss2LaserCD <= 0) {
                this.boss2LaserCD = 100;
                this.boss2LaserWarnT = 25;
                this.boss2LaserAngle = Math.atan2(py - this.y, px - this.x);
            }
        }

        if (this.boss2AttackTimer >= this.boss2AttackCooldown) {
            this.boss2AttackTimer = 0;
            this._playBossSE(opts, 'shot');
            this.boss2FireEffectT = 8;
            const pattern = (this.timer + this.boss2AttackTimer) % 4;
            if (pattern === 0) {
                for (const a of [-0.35, 0, 0.35]) {
                    const spd = isEnraged ? 4.5 : 4;
                    bullets.push({ x: this.x, y: this.y + 35, vx: Math.sin(a) * spd, vy: Math.cos(a) * spd, active: true, color: green, r: isEnraged ? 8 : 6 });
                }
            } else if (pattern === 1) {
                const baseA = Math.atan2(py - this.y, px - this.x);
                for (let i = -1; i <= 1; i++) {
                    const a = baseA + i * 0.25;
                    const spd = 3.8;
                    bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: greenGlow, r: 6 });
                }
            } else if (pattern === 2) {
                const n = 5;
                const spread = (Math.PI / 180) * 50;
                const baseA = Math.atan2(py - this.y, px - this.x) - spread / 2;
                for (let i = 0; i < n; i++) {
                    const a = baseA + (spread / (n - 1 || 1)) * i;
                    const spd = 3.5;
                    bullets.push({ x: this.x, y: this.y + 25, vx: Math.sin(a) * spd, vy: Math.cos(a) * spd, active: true, color: green, r: 6 });
                }
            } else {
                const dx = px - this.x; const dy = py - this.y; const d = Math.hypot(dx, dy) || 1;
                const spd = 3.2;
                bullets.push({ x: this.x, y: this.y, vx: (dx / d) * spd, vy: (dy / d) * spd, active: true, color: greenGlow, r: 7, homing: true });
                if (isEnraged) {
                    for (let i = -1; i <= 1; i += 2) {
                        const a = Math.atan2(dy, dx) + i * 0.2;
                        bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * spd * 0.9, vy: Math.sin(a) * spd * 0.9, active: true, color: greenGlow, r: 5, homing: true });
                    }
                }
            }
            fx.burst(this.x, this.y + 20, green, 10, 4);
        }

        if (isEnraged && this.boss2RageTimer >= this.boss2RageCooldown) {
            this.boss2RageTimer = 0;
            this._playBossSE(opts, 'big');
            this.boss2Frame = { col: 1, row: 1 };
            const count = 10;
            const speed = 4;
            for (let i = 0; i < count; i++) {
                const a = (Math.PI * 2 / count) * i + this.timer * 0.02;
                bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, active: true, color: rage, r: 6 });
            }
            fx.burst(this.x, this.y, rage, 22, 6);
            fx.shake = Math.max(fx.shake || 0, 15);
        }

        if (this.timer % 120 === 60 && isEnraged) {
            for (let side = -1; side <= 1; side += 2) {
                const baseA = Math.PI * 0.5 + side * 0.4;
                for (let i = 0; i < 4; i++) {
                    const a = baseA + (i - 1.5) * 0.15;
                    bullets.push({ x: this.x + side * 30, y: this.y, vx: Math.cos(a) * 3.5, vy: Math.sin(a) * 3.5, active: true, color: orange, r: 5 });
                }
            }
        }

        if (this.anim.state !== 'IDLE' && this.anim.done) this.anim.set('IDLE');
    }

    /** ボス3面: 擬態する知性・ミミック — テレポート・ノイズ・サンダー・ミラー・データ侵食波・紫赤青ジグザグビーム・4旋回コア・追い詰め体当たり→後退 */
    updateBossMimic(px, py, bullets, fx, opts, d) {
        if (d == null) d = 1;
        const W = CFG.W; const H = CFG.H;
        const purple = '#7B00FF'; const purpleLight = '#C39BFF';
        const red = '#FF4444'; const blue = '#4488FF';

        this.teleportCD = (this.teleportCD || 0) - 1;
        this.noiseCD--; this.thunderCD--; this.mirrorCD--; this.dataWaveCD--;
        this.thunderWarnT = Math.max(0, (this.thunderWarnT || 0) - 1);
        this.thunderActive = Math.max(0, (this.thunderActive || 0) - 1);
        this.paranoiaT = Math.max(0, (this.paranoiaT || 0) - 1);
        this.mimicZigzagCD = (this.mimicZigzagCD || 0) - 1;

        // 4つのコア初期化（旋回・攻撃・破壊可能）— 1回だけ
        if (!this.mimicCores) {
            this.mimicCores = [
                { baseAngle: 0, hp: 2, shootCD: 0 },
                { baseAngle: Math.PI / 2, hp: 2, shootCD: 40 },
                { baseAngle: Math.PI, hp: 2, shootCD: 80 },
                { baseAngle: Math.PI * 1.5, hp: 2, shootCD: 120 }
            ];
        }

        // 追い詰め体当たりフェーズ: 高速回転→体当たり→下がる
        const mimicChargePhase = this.mimicChargePhase;
        if (mimicChargePhase === 'spin') {
            this.mimicChargeT++;
            this.mimicSpinAngle += 0.35;
            if (this.mimicChargeT >= 50) {
                this.mimicChargePhase = 'charge';
                this.mimicChargeT = 0;
                const dx = px - this.x; const dy = py - this.y;
                const dist = Math.hypot(dx, dy) || 1;
                const spd = 14;
                this.mimicChargeVx = (dx / dist) * spd;
                this.mimicChargeVy = (dy / dist) * spd;
            }
            this._updateMimicCoresOnly(bullets, px, py, purpleLight);
            return;
        }
        if (mimicChargePhase === 'charge') {
            this.mimicChargeT++;
            this.x += this.mimicChargeVx;
            this.y += this.mimicChargeVy;
            this.x = clamp(this.x, 70, W - 70);
            this.y = clamp(this.y, 60, H * 0.65);
            const distToPlayer = Math.hypot(px - this.x, py - this.y);
            if (distToPlayer < 55 || this.mimicChargeT >= 45) {
                this.mimicChargePhase = 'retreat';
                this.mimicChargeT = 0;
                this.mimicChargeVx = 8;
                this.mimicChargeVy = 0;
            }
            this._updateMimicCoresOnly(bullets, px, py, purpleLight);
            return;
        }
        if (mimicChargePhase === 'retreat') {
            this.mimicChargeT++;
            this.x += this.mimicChargeVx;
            this.x = clamp(this.x, 70, W + 100);
            if (this.mimicChargeT >= 70 || this.x >= W - 30) {
                this.mimicChargePhase = null;
                this.mimicSpinAngle = 0;
            }
            this._updateMimicCoresOnly(bullets, px, py, purpleLight);
            return;
        }
        if (this.hp < this.maxHp * 0.3 && !mimicChargePhase && this.teleportCD < 60 && Math.random() < 0.008) {
            this.mimicChargePhase = 'spin';
            this.mimicChargeT = 0;
            this.mimicSpinAngle = 0;
        }

        // パラノイアフィールド（ピンチ専用）：画面全体に微細グリッチ弾
        if (this.paranoiaT > 0) {
            if (this.paranoiaT % 3 === 0) {
                for (let i = 0; i < 6; i++) {
                    const x = rr(0, W); const y = rr(0, H);
                    const a = Math.random() * Math.PI * 2; const spd = 1.5 + Math.random() * 1.5;
                    bullets.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: purpleLight, r: 3 });
                }
            }
            if (this.paranoiaT <= 0) this.dataWaveCD = 120;
            this._updateMimicClones(bullets, px, py, purple, purpleLight, true);
            return;
        }

        // テレポート（HP60%以下でCD半減、HP30%以下で20%フェイクテレポート）— 画面内どこへでも
        if (this.teleportCD <= 0) {
            const cdBase = (this.hp <= this.maxHp * 0.6) ? (this.berserk ? 38 : 75) : (this.berserk ? 75 : 150);
            const fakeTeleport = this.hp <= this.maxHp * 0.3 && Math.random() < 0.2;
            if (this.afterimages) this.afterimages.push({ x: this.x, y: this.y, opacity: 0.5, t: 25 });
            if (!fakeTeleport) {
                const nx = rr(80, W - 80); const ny = rr(70, H * 0.6);
                this.portalResidue = { x: nx, y: ny, t: 30, maxT: 30 };
                if (typeof fx.arenaDarkCorners === 'number') fx.arenaDarkCorners = 45;
                this.x = nx; this.y = ny;
            }
            this.teleportCD = cdBase;
            if (this.berserk && this.noiseCD <= 0 && !fakeTeleport) {
                this.noiseCD = 30; this._playBossSE(opts, 'shot');
                for (let i = 0; i < 8; i++) {
                    const a = Math.atan2(py - this.y, px - this.x) + (Math.random() - 0.5) * 1.2;
                    const spd = 2 + Math.random() * 1.5;
                    bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: purple, r: 5 });
                }
            }
        }
        if (this.portalResidue) { this.portalResidue.t--; if (this.portalResidue.t <= 0) this.portalResidue = null; }

        // 通常浮遊：画面を不規則に漂う＋グリッチ強度でジッター（GlitchScientist 的・現実不安定）
        const glitchIntensity = 1 - this.hp / this.maxHp;
        this.x += Math.sin(this.timer * 0.02) * 1.2 + Math.cos(this.timer * 0.011) * 0.6 + (Math.random() - 0.5) * glitchIntensity * 14;
        this.y += Math.cos(this.timer * 0.015) * 0.8 + Math.sin(this.timer * 0.019) * 0.4 + (Math.random() - 0.5) * glitchIntensity * 14;
        this.x = clamp(this.x, 70, W - 70); this.y = clamp(this.y, 60, H * 0.65);

        // 4つのコア：旋回しつつプレイヤーへ弾を撃つ
        this._updateMimicCores(bullets, px, py, purpleLight);

        // 紫・赤・青の3色スペクトラムのジグザグビーム
        if (this.mimicZigzagCD <= 0) {
            this.mimicZigzagCD = this.berserk ? 140 : 220;
            this._playBossSE(opts, 'shot');
            const colors = [purple, red, blue];
            const segs = 18;
            const baseAngle = Math.atan2(py - this.y, px - this.x);
            const amp = 35;
            const segLen = 28;
            for (let i = 0; i < segs; i++) {
                const t = i / segs;
                const zig = (i % 2 === 0 ? 1 : -1) * amp * Math.sin(i * 0.7);
                const a = baseAngle + zig * 0.15;
                const sx = this.x + Math.cos(baseAngle) * (i * segLen) + Math.cos(baseAngle + Math.PI / 2) * zig;
                const sy = this.y + Math.sin(baseAngle) * (i * segLen) + Math.sin(baseAngle + Math.PI / 2) * zig;
                const spd = 5.5;
                bullets.push({
                    x: sx, y: sy, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
                    active: true, color: colors[i % 3], r: 6
                });
            }
        }

        // ノイズバレット：不規則軌道の弾8発
        if (this.noiseCD <= 0) {
            this.noiseCD = this.berserk ? 50 : 90; this._playBossSE(opts, 'shot');
            for (let i = 0; i < 8; i++) {
                const a = Math.atan2(py - this.y, px - this.x) + (Math.random() - 0.5) * 1.0;
                const spd = 2.2 + Math.random() * 1.2;
                bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: purple, r: 6 });
            }
            this._mimicShootFromClones(bullets, px, py, purple);
        }

        // サンダーボルト：前兆1.5秒→直下に雷撃3本
        if (this.thunderWarnT > 0 && this.thunderActive <= 0) return;
        if (this.thunderActive > 0) {
            this.thunderActive--;
            const spacing = W / 4; const spd = 10;
            for (let i = -1; i <= 1; i++) {
                const tx = this.x + i * spacing;
                bullets.push({ x: tx, y: 0, vx: 0, vy: spd, active: true, color: '#FFDD00', r: 8 });
            }
            if (this.thunderActive <= 0) this.dataWaveCD = 100;
            return;
        }
        if (this.thunderCD <= 0 && this.thunderWarnT <= 0 && this.thunderActive <= 0) {
            this.thunderWarnT = 90; this.thunderCD = 280;
        }
        if (this.thunderWarnT === 1) {
            this._playBossSE(opts, 'big'); this.thunderActive = 45; fx.burst(this.x, this.y, '#FFDD00', 20, 6);
        }

        // データ侵食波：横一列の波動を上下2段、間に隙間
        if (this.dataWaveCD <= 0 && this.thunderWarnT <= 0) {
            this._playBossSE(opts, 'shot'); this.dataWaveCD = 200;
            const row1 = H * 0.35; const row2 = H * 0.7;
            for (let step = 0; step < W + 40; step += 22) {
                bullets.push({ x: step - 20, y: row1, vx: 8, vy: 0, active: true, color: purpleLight, r: 5 });
                bullets.push({ x: step - 20, y: row2, vx: 8, vy: 0, active: true, color: purpleLight, r: 5 });
            }
        }

        // ミラーダブル：コピー1体（ピンチで2体）、体力1で破壊可能、同じく弾を撃つ
        if (this.mirrorCD <= 0) {
            this.mirrorCD = 350;
            const n = this.berserk ? 2 : 1;
            for (let i = 0; i < n; i++) {
                this.mirrorClones.push({ x: this.x + rr(-60, 60), y: this.y + rr(-30, 30), hp: 1 });
            }
        }
        this._updateMimicClones(bullets, px, py, purple, purpleLight, false);

        // リアリティクラッシュ：現実崩壊攻撃（ポリゴン状の紫灰弾が放射）
        this.realityCrashCD = Math.max(0, (this.realityCrashCD || 0) - 1);
        if (this.realityCrashCD <= 0 && this.thunderWarnT <= 0 && this.dataWaveCD > 30) {
            this.realityCrashCD = this.berserk ? 180 : 320;
            this._playBossSE(opts, 'big');
            if (typeof fx.arenaDarkCorners === 'number') fx.arenaDarkCorners = 25;
            const polygonCount = this.berserk ? 32 : 20;
            const crashColor = '#6644aa';
            for (let i = 0; i < polygonCount; i++) {
                const angle = (Math.PI * 2 / polygonCount) * i + Math.random() * 0.5;
                const speed = 3.5 + Math.random() * 4;
                bullets.push({
                    x: this.x, y: this.y,
                    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                    active: true, color: crashColor, r: 5 + Math.random() * 2
                });
            }
        }

        // ピンチ：パラノイアフィールド
        if (this.berserk && this.paranoiaT <= 0 && this.dataWaveCD <= 30 && Math.random() < 0.006) {
            this._playBossSE(opts, 'big'); this.paranoiaT = 300;
        }

        if (this.anim.state !== 'IDLE' && this.anim.done) this.anim.set('IDLE');
    }

    _updateMimicCores(bullets, px, py, purpleLight) {
        if (!this.mimicCores || this.mimicCores.length === 0) return;
        /** ガーディアンはボス周囲を約1cm（約38px）離れて周回 */
        const orbitR = 38;
        const orbitSpeed = 0.032;
        for (let i = this.mimicCores.length - 1; i >= 0; i--) {
            const core = this.mimicCores[i];
            if (core.hp <= 0) continue;
            core.angle = (core.baseAngle || i * Math.PI / 2) + this.timer * orbitSpeed;
            core.x = this.x + Math.cos(core.angle) * orbitR;
            core.y = this.y + Math.sin(core.angle) * orbitR;
            core.shootCD = (core.shootCD || 0) - 1;
            if (core.shootCD <= 0) {
                core.shootCD = 70 + rr(-15, 25);
                const dx = px - core.x; const dy = py - core.y; const d = Math.hypot(dx, dy) || 1;
                bullets.push({ x: core.x, y: core.y, vx: (dx / d) * 3.5, vy: (dy / d) * 3.5, active: true, color: purpleLight, r: 5 });
            }
        }
    }

    _updateMimicCoresOnly(bullets, px, py, purpleLight) {
        if (!this.mimicCores || this.mimicCores.length === 0) return;
        const orbitR = 38;
        const orbitSpeed = 0.032;
        for (let i = this.mimicCores.length - 1; i >= 0; i--) {
            const core = this.mimicCores[i];
            if (core.hp <= 0) continue;
            core.angle = (core.baseAngle || i * Math.PI / 2) + this.timer * orbitSpeed;
            core.x = this.x + Math.cos(core.angle) * orbitR;
            core.y = this.y + Math.sin(core.angle) * orbitR;
            core.shootCD = (core.shootCD || 0) - 1;
            if (core.shootCD <= 0) {
                core.shootCD = 55;
                const dx = px - core.x; const dy = py - core.y; const d = Math.hypot(dx, dy) || 1;
                bullets.push({ x: core.x, y: core.y, vx: (dx / d) * 3.5, vy: (dy / d) * 3.5, active: true, color: purpleLight, r: 5 });
            }
        }
    }

    _updateMimicClones(bullets, px, py, purple, purpleLight, paranoia) {
        const W = CFG.W; const H = CFG.H;
        for (let i = this.mirrorClones.length - 1; i >= 0; i--) {
            const c = this.mirrorClones[i];
            if (c.hp <= 0) { this.mirrorClones.splice(i, 1); continue; }
            c.x += (this.x - c.x) * 0.06; c.y += (this.y - c.y) * 0.06;
            if (!paranoia && Math.random() < 0.02) {
                const dx = px - c.x; const dy = py - c.y; const d = Math.hypot(dx, dy) || 1;
                const spd = 2.5;
                bullets.push({ x: c.x, y: c.y, vx: (dx / d) * spd, vy: (dy / d) * spd, active: true, color: purpleLight, r: 4, noDamage: false });
            }
        }
    }

    _mimicShootFromClones(bullets, px, py, purple) {
        (this.mirrorClones || []).forEach(c => {
            if (c.hp <= 0) return;
            for (let i = 0; i < 5; i++) {
                const a = Math.atan2(py - c.y, px - c.x) + (Math.random() - 0.5) * 0.8;
                const spd = 2 + Math.random() * 1;
                bullets.push({ x: c.x, y: c.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: purple, r: 4 });
            }
        });
    }

    /** ボス4面: 鉄の翼 Iron Wing — PATROL(突進付き) / SPREAD / DIVE_PREP→DIVE→BOUNCE / SPIRAL / BREAKDOWN→TAUNT→RIPOSTE / LAST_GASP */
    updateBossIronWing(px, py, bullets, fx, opts, d) {
        if (d == null) d = 1;
        const W = CFG.W; const H = CFG.H;
        const red = '#dc1e1e'; const darkRed = '#8c0000'; const orange = '#ff8c00'; const yellow = '#ffff00';

        if (this.hp < this.maxHp * 0.5 && !this.ironWingRage) {
            this.ironWingRage = true;
            this.ironWingShootRate = 20;
            this.ironWingDiveSpeed = 34;
        } else if (!this.ironWingRage) {
            this.ironWingDiveSpeed = 26;
        }
        this.ironWingPhaseT += d;
        this.ironWingWaveT += 0.03 * d;
        this.ironWingFrameTimer += d;
        const dur = (this.ironWingFrameDurationsTicks || [11, 7, 7, 8, 12, 8, 7, 7])[this.ironWingSeqIndex];
        if (this.ironWingFrameTimer >= dur) {
            this.ironWingFrameTimer = 0;
            this.ironWingSeqIndex = (this.ironWingSeqIndex + 1) % (this.ironWingFrameSequence || [0, 1, 4, 7, 8, 7, 4, 1]).length;
        }

        const phase = this.ironWingPhase;
        const rage = this.ironWingRage;

        // ----- LAST_GASP: 死に際の特攻（HP0時に発動）
        if (phase === 'last_gasp') {
            if (this.ironWingPhaseT <= 60) {
                this.ironWingVx *= 0.9; this.ironWingVy *= 0.9;
                this.x += this.ironWingVx; this.y += this.ironWingVy;
                if (this.ironWingPhaseT % 4 === 0) fx.burst(this.x + (Math.random() - 0.5) * 40, this.y, yellow, 8, 2);
            } else if (this.ironWingPhaseT === 61) {
                const ang = Math.atan2(py - this.y, px - this.x);
                this.ironWingVx = Math.cos(ang) * 32;
                this.ironWingVy = Math.sin(ang) * 32;
                this._playBossSE(opts, 'big');
            } else {
                this.x += this.ironWingVx; this.y += this.ironWingVy;
                if (this.ironWingPhaseT % 6 === 0) {
                    for (let i = 0; i < 5; i++) {
                        const a = Math.random() * Math.PI * 2;
                        const spd = 4 + Math.random() * 4;
                        bullets.push({ x: this.x + (Math.random() - 0.5) * 40, y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: Math.random() > 0.5 ? red : orange, r: 5 });
                    }
                }
            }
            if (this.ironWingPhaseT >= 180 || this.x < -80 || this.x > W + 80 || this.y < -80 || this.y > H + 80) {
                this.hp = 0;
                this.anim.set('DEATH');
                this.deathT = 0;
                fx.big(this.x, this.y, this.color);
            }
            return;
        }

        if (phase === 'enter') {
            const targetX = W * 0.75; const targetY = H * 0.25;
            this.x += (targetX - this.x) * 0.02;
            this.y += (targetY - this.y) * 0.02;
            if (Math.abs(this.x - targetX) < 5) {
                this.ironWingPhase = 'patrol';
                this.ironWingPhaseT = 0;
            }
        } else if (phase === 'patrol') {
            this.ironWingDashCooldown = Math.max(0, (this.ironWingDashCooldown || 0) - 1);
            const dashCD = rage ? 60 : 80;
            const dashSpeed = rage ? 18 : 15;
            if (this.ironWingDashCooldown <= 0 && this.ironWingPhaseT > 15) {
                this.ironWingDashCooldown = dashCD;
                this.ironWingDashT = 5;
                const ang = Math.atan2(py - this.y, px - this.x);
                this.ironWingVx = Math.cos(ang) * dashSpeed;
                this.ironWingVy = Math.sin(ang) * dashSpeed;
                this._playBossSE(opts, 'shot');
            } else if (this.ironWingDashT > 0) {
                this.ironWingDashT--;
                this.ironWingFlipX = this.ironWingVx < 0;
                this.x += this.ironWingVx; this.y += this.ironWingVy;
            } else {
                const speedX = rage ? 1.8 : 1.2; const speedY = rage ? 1.4 : 0.9;
                this.ironWingVx = Math.sin(this.ironWingWaveT * 0.4) * speedX;
                this.ironWingVy = Math.sin(this.ironWingWaveT * 0.7) * speedY;
                if (this.berserk) {
                    this.ironWingVx += Math.sin(this.timer * 0.13) * 1.5 + Math.cos(this.timer * 0.11) * 1;
                    this.ironWingVy += Math.cos(this.timer * 0.09) * 1.2 + Math.sin(this.timer * 0.07) * 0.8;
                }
                this.ironWingFlipX = this.ironWingVx < 0;
                this.x += this.ironWingVx; this.y += this.ironWingVy;
            }
            if (this.ironWingDashT <= 0) {
                this.ironWingShootTimer++;
                if (this.ironWingShootTimer >= this.ironWingShootRate) {
                    this.ironWingShootTimer = 0;
                    this._playBossSE(opts, 'shot');
                    const baseAngle = Math.atan2(py - this.y, px - this.x);
                    const spd = rage ? 7.2 : 5.2;
                    for (const da of [-0.2, 0, 0.2]) {
                        const a = baseAngle + da;
                        bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: darkRed, r: 5 });
                    }
                }
            }
            const limit = rage ? 60 : 90;
            if (this.ironWingPhaseT >= limit) this._ironWingNextPhase();
        } else if (phase === 'dive_prep') {
            const targetX = px; const targetY = H * 0.15;
            this.ironWingVx += (targetX - this.x) * 0.12 - this.ironWingVx * 0.15;
            this.ironWingVy += (targetY - this.y) * 0.12 - this.ironWingVy * 0.15;
            this.x += this.ironWingVx; this.y += this.ironWingVy;
            this.ironWingFlipX = px < this.x;
            if (this.ironWingPhaseT % 8 === 0) fx.burst(this.x, this.y, orange, 10, 2);
            if (this.ironWingPhaseT >= 30) {
                this.ironWingDiveTargetX = px;
                this.ironWingDiveTargetY = H * 0.75;
                this.ironWingPhase = 'dive';
                this.ironWingPhaseT = 0;
                this._playBossSE(opts, 'big');
            }
        } else if (phase === 'dive') {
            const dx = this.ironWingDiveTargetX - this.x; const dy = this.ironWingDiveTargetY - this.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 8) {
                const ratio = this.ironWingDiveSpeed / dist;
                this.ironWingVx = dx * ratio; this.ironWingVy = dy * ratio;
                this.ironWingFlipX = this.ironWingVx < 0;
                this.x += this.ironWingVx; this.y += this.ironWingVy;
            } else {
                this._playBossSE(opts, 'big');
                for (let i = 0; i < 8; i++) {
                    const a = (Math.PI * 2 / 8) * i;
                    bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * 6, vy: Math.sin(a) * 6, active: true, color: yellow, r: 5 });
                }
                for (let i = 0; i < 12; i++) {
                    const a = (Math.PI * 2 / 12) * i;
                    bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * 2, vy: Math.sin(a) * 2, active: true, color: orange, r: 5, accel: 1.08, accelMax: 6 });
                }
                fx.burst(this.x, this.y, orange, 20, 5);
                if (fx.addFloorCrack) fx.addFloorCrack(this.x, H - 20, 25);
                this.ironWingVx = 0; this.ironWingVy = 0;
                this.ironWingPhase = 'bounce';
                this.ironWingPhaseT = 0;
            }
        } else if (phase === 'bounce') {
            if (this.ironWingPhaseT === 1) {
                const targetX = W * 0.7; const targetY = H * 0.2;
                const ang = Math.atan2(targetY - this.y, targetX - this.x);
                this.ironWingVx = Math.cos(ang) * 22;
                this.ironWingVy = Math.sin(ang) * 22;
                this._playBossSE(opts, 'shot');
            }
            this.ironWingVx *= 0.92; this.ironWingVy *= 0.92;
            this.x += this.ironWingVx; this.y += this.ironWingVy;
            this.ironWingFlipX = this.ironWingVx < 0;
            if (this.ironWingPhaseT >= 35) this._ironWingNextPhase();
        } else if (phase === 'spread') {
            this.ironWingVx *= 0.85; this.ironWingVy *= 0.85;
            this.x += this.ironWingVx; this.y += this.ironWingVy;
            const n = rage ? 11 : 9;
            if ([15, 35, 55].indexOf(this.ironWingPhaseT) >= 0) {
                this._playBossSE(opts, 'shot');
                const base = Math.PI; const spd = rage ? 5.5 : 4;
                for (let i = 0; i < n; i++) {
                    const a = base - Math.PI / 3 + (Math.PI * 2 / 3 / (n - 1 || 1)) * i;
                    bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: red, r: 7 });
                }
                fx.burst(this.x, this.y, red, 12, 3);
            }
            if (this.ironWingPhaseT >= 80) this._ironWingNextPhase();
        } else if (phase === 'spiral') {
            const r = 80; const spd = rage ? 0.03 : 0.02;
            const cx = W * 0.65; const cy = H * 0.35;
            const angle = this.ironWingPhaseT * spd;
            const tx = cx + Math.cos(angle) * r; const ty = cy + Math.sin(angle) * r;
            this.ironWingVx += (tx - this.x) * 0.08 * 0.15 - this.ironWingVx * 0.15;
            this.ironWingVy += (ty - this.y) * 0.08 * 0.15 - this.ironWingVy * 0.15;
            this.x += this.ironWingVx; this.y += this.ironWingVy;
            this.ironWingFlipX = this.ironWingVx < 0;
            this.ironWingSpiralAngle += rage ? 0.18 : 0.12;
            for (const offset of [0, Math.PI]) {
                const a = this.ironWingSpiralAngle + offset;
                bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * 5, vy: Math.sin(a) * 5, active: true, color: orange, r: 6 });
            }
            if (this.ironWingPhaseT >= (rage ? 120 : 150)) this._ironWingNextPhase();
        } else if (phase === 'breakdown') {
            this.ironWingVx *= 0.6; this.ironWingVy *= 0.6;
            this.x += this.ironWingVx + (Math.random() - 0.5) * 12;
            this.y += this.ironWingVy + (Math.random() - 0.5) * 12;
            this.x = clamp(this.x, 80, W - 80);
            this.y = clamp(this.y, 50, H - 80);
            if (this.ironWingPhaseT % 3 === 0) fx.burst(this.x + (Math.random() - 0.5) * 60, this.y + (Math.random() - 0.5) * 40, yellow, 6, 2);
            if (this.ironWingPhaseT >= 30) {
                this.ironWingPhase = 'taunt';
                this.ironWingPhaseT = 0;
                this.x = clamp(this.x, 100, W - 100);
                this.y = clamp(this.y, 80, H / 2);
            }
        } else if (phase === 'taunt') {
            this.ironWingVx = 0; this.ironWingVy = 0;
            this.ironWingFlipX = px < this.x;
            if (this.ironWingPhaseT === 15) this._playBossSE(opts, 'big');
            if (this.ironWingPhaseT >= 30) {
                this.ironWingPhase = 'riposte';
                this.ironWingPhaseT = 0;
            }
        } else if (phase === 'riposte') {
            if (this.ironWingPhaseT === 1) {
                this._playBossSE(opts, 'big');
                for (let i = 0; i < 24; i++) {
                    const a = (Math.PI * 2 / 24) * i;
                    bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * 6, vy: Math.sin(a) * 6, active: true, color: red, r: 6 });
                }
            }
            if (this.ironWingPhaseT === 18) {
                const ang = Math.atan2(py - this.y, px - this.x);
                this.ironWingVx = Math.cos(ang) * 28;
                this.ironWingVy = Math.sin(ang) * 28;
                this.ironWingFlipX = this.ironWingVx < 0;
            }
            this.x += this.ironWingVx; this.y += this.ironWingVy;
            this.ironWingVx *= 0.98; this.ironWingVy *= 0.98;
            if (this.ironWingPhaseT >= 90) this._ironWingNextPhase();
        }

        // 翼残像（last_gasp・breakdown以外）
        if (phase !== 'last_gasp' && phase !== 'breakdown') {
            if (!this.ironWingTrail) this.ironWingTrail = [];
            const trailInterval = rage ? 2 : 4;
            if (this.ironWingPhaseT % trailInterval === 0) {
                this.ironWingTrail.push({ x: this.x, y: this.y, t: 28 });
                if (this.ironWingTrail.length > 20) this.ironWingTrail.shift();
            }
            this.ironWingTrail.forEach(tr => { tr.t--; });
            this.ironWingTrail = this.ironWingTrail.filter(tr => tr.t > 0);
        }

        // バットスウォーム（patrol / spread のみ、breakdown/taunt/riposte/last_gasp 以外）
        this.ironWingBatSwarmCD = Math.max(0, (this.ironWingBatSwarmCD || 0) - 1);
        if (this.ironWingBatSwarmCD <= 0 && (phase === 'patrol' || phase === 'spread') && this.ironWingPhaseT > 20) {
            this.ironWingBatSwarmCD = rage ? 120 : 180;
            this._playBossSE(opts, 'shot');
            const swarmCount = rage ? 14 : 8;
            const colors = [orange, '#FF4500', darkRed];
            for (let i = 0; i < swarmCount; i++) {
                const a = (Math.PI * 2 / swarmCount) * i + Math.random() * 0.2;
                const spd = 3.5 + Math.random() * 1.5;
                bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: colors[i % 3], r: 5 });
            }
            fx.burst(this.x, this.y, orange, 14, 4);
        }

        if (phase !== 'last_gasp' && phase !== 'breakdown') {
            if (phase === 'riposte') {
                this.x = clamp(this.x, 100, W - 100);
                this.y = clamp(this.y, 60, H - 60);
            } else {
                this.x = clamp(this.x, 60, W - 60);
                this.y = clamp(this.y, 40, H - 40);
            }
        }
    }
    _ironWingNextPhase() {
        if (this.ironWingPhase === 'bounce') {
            this.ironWingPhase = 'patrol';
            this.ironWingSeqIdx = 4;
            this.ironWingPhaseT = 0;
            return;
        }
        this.ironWingSeqIdx = (this.ironWingSeqIdx + 1) % this.ironWingSeq.length;
        const next = this.ironWingSeq[this.ironWingSeqIdx];
        this.ironWingPhase = next;
        this.ironWingPhaseT = 0;
        if (next === 'dive_prep') {
            this.ironWingDiveTargetX = 0;
            this.ironWingDiveTargetY = 0;
        }
        if (next === 'spiral') this.ironWingSpiralAngle = 0;
    }

    /** ボス5面: 鋼甲蟲 SCARABOT — 3×2スプライト / IDLE→PATROL(3way散弾)→ENRAGED(50%以下・5way+レーザー)＋虫らしい縄張り移動・ドームシールド・狂乱ダッシュ */
    updateBossGuardian(px, py, bullets, fx, opts, d) {
        if (d == null) d = 1;
        const W = CFG.W; const H = CFG.H;
        const cyan = '#00ffff';

        /** HP30%以下で全ボス共通の berserk フラグが立つ。機械虫はこのとき「追い詰められた虫」のような挙動を強める。 */
        if (this.hp / this.maxHp <= 0.5 && !this.scarabotEnraged) {
            this.scarabotEnraged = true;
            this.scarabotPhase = 'ENRAGED';
            this.scarabotAnimState = 'trigger';
            this.scarabotTriggerT = 0;
            this._playBossSE(opts, 'big');
            if (fx.shake !== undefined) fx.shake = Math.max(fx.shake || 0, 15);
        }

        /** ドームシールド（ガード＋電撃フィールド）カウントダウン */
        this.domeShieldT = Math.max(0, (this.domeShieldT || 0) - 1);
        this.domeShieldCD = Math.max(0, (this.domeShieldCD || 0) - 1);

        this.scarabotAttackCD = Math.max(0, (this.scarabotAttackCD || 0) - 1);
        this.scarabotAnimTimer++;
        const walkFrames = [0, 1, 2, 1]; const triggerFrames = [2, 3]; const enrageFrames = this.berserk ? [4, 5] : [3, 4]; const burstFrames = [4, 5, 4, 5];

        if (this.scarabotAnimState === 'trigger') {
            this.scarabotAnimFrames = triggerFrames;
            this.scarabotAnimSpeed = 8;
            this.scarabotTriggerT = (this.scarabotTriggerT || 0) + 1;
            if (this.scarabotTriggerT >= 16) {
                this.scarabotAnimState = 'burst';
                this.scarabotBurstT = 0;
            }
        } else if (this.scarabotAnimState === 'burst') {
            this.scarabotAnimFrames = burstFrames;
            this.scarabotAnimSpeed = 14;
            this.scarabotBurstT = (this.scarabotBurstT || 0) + 1;
            if (this.scarabotBurstT >= 24) {
                this.scarabotAnimState = 'enrage';
            }
        } else if (this.scarabotEnraged && this.domeShieldT <= 0) {
            this.scarabotAnimState = 'enrage';
            this.scarabotAnimFrames = enrageFrames;
            this.scarabotAnimSpeed = 10;
        } else if (this.domeShieldT > 0) {
            /** ガードポーズ（右上スプライト）: 体を固め、電撃フィールドを張る */
            this.scarabotAnimFrames = [3];
            this.scarabotAnimSpeed = 12;
        } else {
            this.scarabotAnimFrames = walkFrames;
            this.scarabotAnimSpeed = 6;
        }
        if (this.scarabotAnimTimer >= this.scarabotAnimSpeed) {
            this.scarabotAnimTimer = 0;
            this.scarabotAnimIndex = (this.scarabotAnimIndex + 1) % this.scarabotAnimFrames.length;
        }

        /** 虫らしい「一定範囲内での巡回」と縄張り意識による押し戻し */
        const dist = Math.hypot(px - this.x, py - this.y);
        const moveMul = this.berserk ? 1.6 : 1;
        const ampX = W * 0.36 * moveMul;
        const ampY1 = H * 0.2;
        const ampY2 = H * 0.06;

        // プレイヤーが下に潜り込むほど、虫が前進して押し返してくる（縄張り意識）。
        const territoryLineY = H * 0.6;
        const baseTy = this.scarabotBaseTy != null ? this.scarabotBaseTy : this.ty;
        const targetTy = py > territoryLineY ? baseTy + 80 : baseTy;
        this.ty += (targetTy - this.ty) * 0.03;

        /* ===== 突進フェーズ管理（発狂時: 右にタメ→左へ突込み）===== */
        if (this.berserk && this.domeShieldT <= 0) {
            this.scarabotRushCD = Math.max(0, (this.scarabotRushCD || 0) - 1);
            if (!this.scarabotRushState) this.scarabotRushState = 'IDLE';

            if (this.scarabotRushState === 'IDLE' && this.scarabotRushCD <= 0 && Math.random() < 0.016) {
                this.scarabotRushState = 'WINDUP';
                this.scarabotWindupT = 0;
                this._playBossSE(opts, 'charge');
            }
            if (this.scarabotRushState === 'WINDUP') {
                this.scarabotWindupT++;
                /* 右端へ素早く移動（タメ演出） */
                this.x += (W - 120 - this.x) * 0.14;
                this.y += (clamp(py, H * 0.2, H * 0.5) - this.y) * 0.06;
                if (this.scarabotWindupT >= 42) {
                    this.scarabotRushState = 'RUSH';
                    this.scarabotRushT = 0;
                    if (fx.shake !== undefined) fx.shake = Math.max(fx.shake || 0, 22);
                }
            } else if (this.scarabotRushState === 'RUSH') {
                this.scarabotRushT++;
                this.x -= 15; /* 右から左へ一気に突進 */
                if (this.scarabotRushT >= 52 || this.x <= 100) {
                    this.scarabotRushState = 'IDLE';
                    this.scarabotRushCD = 280;
                }
            } else {
                /* IDLE中は小刻みダッシュ（空中で暴れる） */
                this.scarabotDashT = Math.max(0, (this.scarabotDashT || 0) - 1);
                if (this.scarabotDashT === 0 && Math.random() < 0.018) {
                    const dashTargetY = clamp(py, H * 0.15, H * 0.55);
                    const ddx = px - this.x; const ddy = dashTargetY - this.y;
                    const dd = Math.hypot(ddx, ddy) || 1;
                    this.scarabotDashVx = (ddx / dd) * 5;
                    this.scarabotDashVy = (ddy / dd) * 5;
                    this.scarabotDashT = 22;
                }
            }
        } else {
            this.scarabotDashT = Math.max(0, (this.scarabotDashT || 0) - 1);
        }

        /* ===== 移動計算 ===== */
        const inRush = this.berserk && (this.scarabotRushState === 'WINDUP' || this.scarabotRushState === 'RUSH');
        if (inRush) {
            /* 突進フェーズ: 上記ブロックで x/y を直接更新済み */
        } else if (this.scarabotDashT > 0 && this.berserk) {
            this.x += this.scarabotDashVx;
            this.y += this.scarabotDashVy;
        } else if (this.domeShieldT > 0) {
            /* ガード中はその場で踏ん張る */
            this.x += (this.tx - this.x) * 0.1;
            this.y += (this.ty + 40 - this.y) * 0.1;
        } else {
            /* 空中ジグザグ巡回: X は正弦波、Y は三角波で鋭角反転（空の敵らしい俊敏な動き） */
            const zigSpeed = this.berserk ? 0.045 : 0.028;
            const zigT = this.timer * zigSpeed;
            const zigAmp = this.berserk ? H * 0.3 : H * 0.24;
            /* 三角波 (0→1→0): Y方向に鋭角ジグザグ */
            const zigV = ((zigT % 2) < 1 ? (zigT % 1) : (1 - zigT % 1)) - 0.5;
            this.x = this.tx + Math.sin(this.timer * 0.015) * ampX;
            this.y = this.ty + zigV * zigAmp + Math.sin(this.timer * 0.031) * ampY2;
        }

        /* コーナー脱出: 壁に近づいたら tx/ty を中心方向へ引き戻す（スタック防止） */
        if (this.x < 120) this.tx = Math.min(this.tx + 4, W * 0.62);
        if (this.x > W - 120) this.tx = Math.max(this.tx - 4, W * 0.38);
        if (this.y < H * 0.18) this.ty = Math.min(this.ty + 2, H * 0.38);
        if (this.y > H * 0.5) this.ty = Math.max(this.ty - 2, H * 0.28);

        this.x = clamp(this.x, 80, W - 80);
        this.y = clamp(this.y, H * 0.12, H * 0.55);
        this.scarabotFlipX = px < this.x;

        if (dist < 400) this.scarabotPhase = this.scarabotPhase === 'IDLE' ? 'PATROL' : this.scarabotPhase;

        // ENRAGED かつ HP がさらに減ると、一定間隔でドームシールド＋電撃フィールドを展開
        if (this.scarabotEnraged && this.hp <= this.maxHp * 0.35 && this.domeShieldT <= 0 && this.domeShieldCD <= 0 && Math.random() < 0.02) {
            this.domeShieldT = 180;          // 約3秒無敵
            this.domeShieldCD = 600;         // 再展開までのクールダウン
            this._playBossSE(opts, 'charge');
            if (fx.shake !== undefined) fx.shake = Math.max(fx.shake || 0, 18);
        }

        this.thunderPulseCD = Math.max(0, (this.thunderPulseCD || 0) - 1);

        if (this.scarabotPhase === 'PATROL' && this.scarabotAttackCD <= 0 && this.domeShieldT <= 0) {
            this.scarabotAttackCD = 120;
            this._playBossSE(opts, 'shot');
            this._scarabotFireSpread(px, py, bullets, 3, 20);
        }
        if (this.scarabotPhase === 'ENRAGED' && this.scarabotAnimState === 'enrage' && this.scarabotAttackCD <= 0 && this.domeShieldT <= 0) {
            this.scarabotAttackCD = 60;
            this._playBossSE(opts, 'shot');
            this._scarabotFireSpread(px, py, bullets, 5, 15);
            this._scarabotFireLaser(px, py, bullets, fx);
        }
        // サンダーパルス：地面を叩くようにリング状の電撃波を展開（発狂時は頻度アップ）
        if (this.scarabotPhase === 'ENRAGED' && this.thunderPulseCD <= 0 && this.domeShieldT <= 0) {
            this.thunderPulseCD = this.berserk ? 150 : 260;
            this._playBossSE(opts, 'big');
            if (fx.shake !== undefined) fx.shake = Math.max(fx.shake || 0, 14);
            if (fx.addFloorCrack) fx.addFloorCrack(this.x, H - 5, 38);
            const n = 16;
            const spd = this.berserk ? 5.5 : 4.2;
            for (let i = 0; i < n; i++) {
                const a = (Math.PI * 2 / n) * i + this.timer * 0.01;
                bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: this.berserk ? '#88eeff' : '#00ffff', r: 6 });
            }
        }

        if (this.timer % 5 === 0 && this.energyTrail) {
            this.energyTrail.push({ x: this.x, y: this.y, t: 120 });
            if (this.energyTrail.length > 24) this.energyTrail.shift();
        }
        if (this.energyTrail && this.energyTrail.length) {
            this.energyTrail.forEach(tr => { tr.t--; });
            this.energyTrail = this.energyTrail.filter(tr => tr.t > 0);
        }
    }
    _scarabotFireSpread(px, py, bullets, count, spreadDeg) {
        const baseAngle = Math.atan2(py - this.y, px - this.x);
        const step = (spreadDeg * Math.PI / 180) / (count - 1 || 1);
        const offset = ((count - 1) / 2) * step;
        for (let i = 0; i < count; i++) {
            const a = baseAngle - offset + step * i;
            const spd = 5.8;
            bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: '#00ffff', r: 5 });
        }
    }
    _scarabotFireLaser(px, py, bullets, fx) {
        const dx = px - this.x; const dy = py - this.y; const d = Math.hypot(dx, dy) || 1;
        const n = 12; const spd = 8;
        for (let i = -n / 2; i <= n / 2; i++) {
            const a = Math.atan2(dy, dx) + i * 0.03;
            bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: '#00eeff', r: 4 });
        }
    }

    /** ボス6面: 雪の女王 Snow Queen — 猛攻撃化。Phase1(90f間隔) / Phase2(60f・プリズム/分裂/ダイヤモンドダスト)。ガード85%軽減・CD400 */
    updateBossBluecore(px, py, bullets, fx, opts, d) {
        if (d == null) d = 1;
        const W = CFG.W; const H = CFG.H;
        const ice = '#64C8FF'; const iceLight = '#C8EBFF';

        if (this.hp <= this.maxHp * 0.4 && !this.snowQueenEnraged) {
            this.snowQueenEnraged = true;
            this.snowQueenPhase = 2;
            this.snowQueenSpriteState = 'ENRAGE';
            this.snowQueenFrameIndex = 0;
            this.snowQueenActionInterval = 60;
            this._playBossSE(opts, 'big');
        }

        this.snowQueenGuardCD = Math.max(0, (this.snowQueenGuardCD || 0) - 1);
        this.snowQueenStateEndT = Math.max(0, (this.snowQueenStateEndT || 0) - 1);
        if (this.snowQueenStateEndT === 1 && !this.snowQueenGuard) this.snowQueenSpriteState = 'IDLE';
        if (this.snowQueenGuard) {
            this.snowQueenGuardT = Math.max(0, (this.snowQueenGuardT || 0) - 1);
            if (this.snowQueenGuardT <= 0) {
                this.snowQueenGuard = false;
                this.snowQueenGuardCD = 400;
                this.snowQueenSpriteState = 'IDLE';
            }
        }

        this.snowQueenMoveT++;
        if (this.snowQueenMoveT >= this.snowQueenMoveInterval) {
            this.snowQueenMoveT = 0;
            this.snowQueenMoveTargetX = rr(150, W - 150);
            this.snowQueenMoveTargetY = rr(150, H / 2);
        }
        const mdx = this.snowQueenMoveTargetX - this.x; const mdy = this.snowQueenMoveTargetY - this.y;
        const mdist = Math.hypot(mdx, mdy) || 1;
        const moveSpd = (this.snowQueenPhase === 2 ? 1.6 : 1) * 1.5 * (1 / 60);
        this.x += (mdx / mdist) * moveSpd * 60;
        this.y += (mdy / mdist) * moveSpd * 60;
        this.x = clamp(this.x, 100, W - 100);
        this.y = clamp(this.y, 80, H / 2);

        this.snowQueenFrameTimer++;
        const stateFps = { IDLE: 4, SHOOT: 10, ENRAGE: 12, BLIZZARD: 14, SHIELD: 8, BURST: 16 }[this.snowQueenSpriteState] || 4;
        const frameLen = this.snowQueenSpriteState === 'IDLE' ? 1 : (this.snowQueenSpriteState === 'ENRAGE' ? 2 : 2);
        if (this.snowQueenFrameTimer >= Math.max(1, Math.floor(60 / stateFps))) {
            this.snowQueenFrameTimer = 0;
            this.snowQueenFrameIndex = (this.snowQueenFrameIndex + 1) % frameLen;
        }

        if (this.snowQueenSpriteState === 'ENRAGE' && this.snowQueenPhase === 2) return;

        if (this.snowQueenPrismBurstActive) {
            const T = this.snowQueenPrismBurstT;
            if (T === 0 || T === 8 || T === 16) {
                const wave = Math.floor(T / 8);
                const angleOffset = (Math.PI / 12) * wave;
                const hueBase = wave * 120;
                const spd = 5.5 + wave * 0.8;
                for (let i = 0; i < 24; i++) {
                    const a = (Math.PI * 2 / 24) * i + angleOffset;
                    const hue = (hueBase + i * 15) % 360;
                    bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: `hsl(${hue}, 100%, 70%)`, r: 6, hue: hue });
                }
                if (T === 0) this._playBossSE(opts, 'big');
            }
            this.snowQueenPrismBurstT++;
            if (this.snowQueenPrismBurstT >= 24) {
                this.snowQueenPrismBurstActive = false;
                this.snowQueenActionT = 0;
            }
            this.snowQueenSpriteState = 'BURST';
            this.snowQueenStateEndT = 100;
            return;
        }
        if (this.snowQueenDiamondDustActive) {
            for (let s = 0; s < 2; s++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = 50 + Math.random() * 100;
                const startX = this.x + Math.cos(angle) * dist;
                const startY = this.y + Math.sin(angle) * dist;
                const spiralA = angle + this.snowQueenDiamondDustT * 0.05;
                const spd = 3 + Math.random() * 2;
                const hue = (this.snowQueenDiamondDustCount * 4) % 360;
                bullets.push({ x: startX, y: startY, vx: Math.cos(spiralA) * spd, vy: Math.sin(spiralA) * spd, active: true, color: `hsl(${hue}, 100%, 70%)`, r: 3, hue: hue });
            }
            this.snowQueenDiamondDustCount += 2;
            this.snowQueenDiamondDustT++;
            if (this.snowQueenDiamondDustCount >= 80) {
                this.snowQueenDiamondDustActive = false;
                this.snowQueenActionT = 0;
            }
            this.snowQueenSpriteState = 'BLIZZARD';
            this.snowQueenStateEndT = 120;
            return;
        }

        this.snowQueenActionT++;
        if (this.snowQueenActionT < this.snowQueenActionInterval) return;
        this.snowQueenActionT = 0;

        const weights1 = { ice_shot: 30, spread_shot: 20, blizzard: 20, shield_guard: 20, burst: 10 };
        const weights2 = { ice_shot: 10, spread_shot: 15, blizzard: 15, prism_burst: 30, crystal_shard: 20, diamond_dust: 8, shield_guard: 2 };
        const w = this.snowQueenPhase === 2 ? weights2 : weights1;
        const sum2 = w.ice_shot + w.spread_shot + w.blizzard + (w.prism_burst || 0) + (w.crystal_shard || 0) + (w.diamond_dust || 0) + w.shield_guard + (w.burst || 0);
        const r = Math.random() * sum2;
        let action = 'ice_shot';
        let acc = 0;
        for (const k of Object.keys(w)) { acc += w[k]; if (r <= acc) { action = k; break; } }

        if (action === 'ice_shot') {
            this.snowQueenSpriteState = 'SHOOT';
            this._playBossSE(opts, 'shot');
            const dx = px - this.x; const dy = py - this.y; const d = Math.hypot(dx, dy) || 1;
            const spd = 6.5;
            const n = this.snowQueenPhase === 2 ? 4 : 4;
            for (let i = 0; i < n; i++) {
                const off = (i - (n - 1) / 2) * 0.08 + (Math.random() - 0.5) * 0.05;
                const nx = dx / d; const ny = dy / d;
                const cos = Math.cos(off); const sin = Math.sin(off);
                const vx = (nx * cos - ny * sin) * spd; const vy = (nx * sin + ny * cos) * spd;
                bullets.push({ x: this.x, y: this.y, vx, vy, active: true, color: ice, r: 5 });
            }
        } else if (action === 'spread_shot') {
            this.snowQueenSpriteState = 'SHOOT';
            this._playBossSE(opts, 'shot');
            const baseAngle = Math.atan2(py - this.y, px - this.x);
            const n = this.snowQueenPhase === 2 ? 10 : 10;
            const spread = Math.PI / 2.5;
            for (let i = 0; i < n; i++) {
                const a = baseAngle - spread / 2 + (spread / (n - 1 || 1)) * i;
                const spd = 5.2;
                bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: iceLight, r: 4 });
            }
        } else if (action === 'blizzard') {
            this.snowQueenSpriteState = 'BLIZZARD';
            this._playBossSE(opts, 'big');
            const count = this.snowQueenPhase === 2 ? 36 : 30;
            for (let i = 0; i < count; i++) {
                const a = Math.random() * Math.PI * 2;
                const spd = 3 + Math.random() * 5;
                bullets.push({ x: this.x + rr(-40, 40), y: this.y + rr(-40, 40), vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: iceLight, r: 3 });
            }
        } else if (action === 'shield_guard') {
            if (this.snowQueenGuardCD <= 0 && !this.snowQueenGuard) {
                this.snowQueenGuard = true;
                this.snowQueenGuardT = 150;
                this.snowQueenSpriteState = 'SHIELD';
                this._playBossSE(opts, 'charge');
            }
        } else if (action === 'burst') {
            this.snowQueenSpriteState = 'BURST';
            this._playBossSE(opts, 'big');
            const count = this.snowQueenPhase === 2 ? 24 : 20;
            const spd = 5.8;
            for (let i = 0; i < count; i++) {
                const a = (Math.PI * 2 / count) * i;
                bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: ice, r: 6 });
            }
            fx.burst(this.x, this.y, ice, 20, 5);
        } else if (action === 'prism_burst') {
            this.snowQueenPrismBurstActive = true;
            this.snowQueenPrismBurstT = 0;
            this.snowQueenSpriteState = 'BURST';
            this.snowQueenStateEndT = 100;
        } else if (action === 'crystal_shard') {
            this.snowQueenSpriteState = 'SHOOT';
            this._playBossSE(opts, 'shot');
            const baseAngle = Math.atan2(py - this.y, px - this.x);
            for (let i = 0; i < 5; i++) {
                const a = baseAngle + (i - 2) * 0.2;
                const spd = 4.5;
                const hue = (i * 72) % 360;
                bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: `hsl(${hue}, 100%, 70%)`, r: 5, hue: hue, splitAt: 40, splitCount: 3 });
            }
            this.snowQueenStateEndT = 80;
        } else if (action === 'diamond_dust') {
            this.snowQueenDiamondDustActive = true;
            this.snowQueenDiamondDustT = 0;
            this.snowQueenDiamondDustCount = 0;
            this._playBossSE(opts, 'big');
            this.snowQueenSpriteState = 'BLIZZARD';
            this.snowQueenStateEndT = 120;
        }
        if (['SHOOT', 'BLIZZARD', 'BURST'].indexOf(this.snowQueenSpriteState) >= 0) this.snowQueenStateEndT = Math.max(this.snowQueenStateEndT || 0, 80);
    }

    /** ボス7面: 裂け目そのもの・ヴォイド — オムニウスゲイズ / ボイドフラグメント / ネオンクラック / ディメンショナルパルス / アイスパウン。ピンチでヴォイドアポカリプス */
    updateBossVoid(px, py, bullets, fx, opts, d) {
        if (d == null) d = 1;
        const W = CFG.W; const H = CFG.H;
        const voidColor = '#8E44AD'; const neon = '#BB8FCE'; const fragmentColor = '#1A1A2E';

        const formMul = this.form === 0 ? 1 : (this.form === 1 ? 1.3 : 1.6);
        this.berserk = this.hp <= this.maxHp * 0.3;

        this.voidPhaseT = (this.voidPhaseT || 0) + 1;
        const phaseLen = Math.max(80, 140 - this.form * 25);
        if (this.voidPhaseT > phaseLen) { this.voidPhaseT = 0; this.voidPhase = ((this.voidPhase || 0) + 1) % 6; }

        this.omniusCD = (this.omniusCD || 0) - 1; this.fragmentCD = (this.fragmentCD || 0) - 1;
        this.neonCrackCD = (this.neonCrackCD || 0) - 1; this.dimensionalPulseCD = (this.dimensionalPulseCD || 0) - 1;
        this.iceSpawnCD = (this.iceSpawnCD || 0) - 1; this.apocalypseT = Math.max(0, (this.apocalypseT || 0) - 1);
        /* ラスボス1専用CD（初回は余裕ある遅延で開始） */
        if (this.blueLaserCD == null) this.blueLaserCD = 220; else this.blueLaserCD--;
        if (this.voidChargeCD == null) this.voidChargeCD = 180; else this.voidChargeCD--;
        this.blackHoleT = Math.max(0, (this.blackHoleT || 0) - 1);
        /* ラスボス2専用CD（初回は余裕ある遅延で開始） */
        if (this.colorSprayCD == null) this.colorSprayCD = 60; else this.colorSprayCD--;
        if (this.mobBurstCD == null) this.mobBurstCD = 120; else this.mobBurstCD--;

        if (this.form === 2) {
            this.voidTeleportCD = (this.voidTeleportCD || 0) - 1;
            if (this.voidTeleportCD <= 0) {
                this.voidAfterimages = this.voidAfterimages || [];
                const LIFE = this.VOID_AFTERIMAGE_LIFE ?? 180;
                this.voidAfterimages.push({
                    x: this.x, y: this.y, t: LIFE,
                    frame: Math.floor(this.timer / 8) % 6
                });
                if (this.voidAfterimages.length > 5) this.voidAfterimages.shift();
                this.x = rr(90, W - 90);
                this.y = rr(80, H * 0.6);
                this.tx = this.x; this.ty = this.y;
                this.voidTeleportCD = this.berserk ? 45 : 75;
            }
            (this.voidAfterimages || []).forEach(a => { a.t--; });
            this.voidAfterimages = (this.voidAfterimages || []).filter(a => a.t > 0);
        }

        const spdMul = (this._voidSpeedMul != null) ? this._voidSpeedMul : 1;
        if (this.form === 1) {
            /* ラスボス2: ぴょんぴょん跳ねる移動（重力＋バウンス）。スピード15%アップ */
            this.bounceVy = (this.bounceVy || 0) + 0.28 * spdMul;
            this.ty += this.bounceVy;
            if (this.ty > H * 0.56) { this.ty = H * 0.56; this.bounceVy = -(6 + Math.random() * 3) * spdMul; if (fx.shake !== undefined) fx.shake = Math.max(fx.shake || 0, 8); }
            if (this.ty < H * 0.14) { this.ty = H * 0.14; this.bounceVy = Math.abs(this.bounceVy) * 0.5; }
            /* 左右もゆっくりプレイヤーへ寄る */
            this.tx += (clamp(px, 120, W - 120) - this.tx) * 0.006 * spdMul;
            this.x = this.tx + Math.sin(this.timer * 0.018) * (50 * formMul);
            this.y = this.ty + Math.sin(this.timer * 0.03) * 12;
        } else if (this.form === 0) {
            /* ラスボス1: 突進（どすんどすん）中は直進 */
            if (this.voidChargeT > 0) {
                this.voidChargeT--;
                this.tx += this.voidChargeDx;
                this.ty += this.voidChargeDy;
            }
            this.x = this.tx + Math.sin(this.timer * 0.01) * (60 * formMul);
            this.y = this.ty + Math.cos(this.timer * 0.012) * (35 * formMul);
        } else {
            this.x = this.tx + Math.sin(this.timer * 0.01) * (60 * formMul);
            this.y = this.ty + Math.cos(this.timer * 0.012) * (35 * formMul);
        }
        if (this.form === 2) {
            const t = this.timer * 0.01 * spdMul;
            const chaos = (a, b, c) => Math.sin(a * t) * Math.cos(b * t + 1.3) + Math.sin(c * t * 0.7) * 0.5;
            this.x = this.tx + chaos(0.012, 0.017, 0.023) * (W * 0.32) + chaos(0.008, 0.011, 0.013) * (W * 0.1);
            this.y = this.ty + chaos(0.014, 0.019, 0.007) * (H * 0.2) + chaos(0.01, 0.016, 0.022) * (H * 0.08);
            this.x = clamp(this.x, 90, W - 90); this.y = clamp(this.y, 80, H * 0.6);
        }

        if (this.apocalypseT > 0) {
            const n = 12; const centerX = px; const centerY = py;
            for (let i = 0; i < n; i++) {
                const a = (Math.PI * 2 / n) * i + this.timer * 0.02;
                const dist = 20 + (this.apocalypseT % 30) * 2;
                const sx = centerX + Math.cos(a) * (W * 0.6); const sy = centerY + Math.sin(a) * (H * 0.6);
                const dx = centerX - sx; const dy = centerY - sy; const d = Math.hypot(dx, dy) || 1;
                bullets.push({ x: sx, y: sy, vx: (dx / d) * 2, vy: (dy / d) * 2, active: true, color: voidColor, r: 5 });
            }
            if (this.apocalypseT <= 0) { this.omniusCD = 60; this.fragmentCD = 80; }
            return;
        }

        if (this.omniusCD <= 0) {
            this._playBossSE(opts, 'big'); this.omniusCD = 200;
            const beamAngle = Math.atan2(py - this.y, px - this.x);
            const spd = 5 * formMul;
            for (let i = -2; i <= 2; i++) {
                const a = beamAngle + i * 0.06; const count = this.berserk ? 2 : 1;
                for (let c = 0; c < count; c++) {
                    bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: '#ff00ff', r: 6, homing: true });
                }
            }
        }

        if (this.fragmentCD <= 0) {
            this._playBossSE(opts, 'shot'); this.fragmentCD = 180;
            const n = this.berserk ? 20 : 10;
            for (let i = 0; i < n; i++) {
                const a = Math.random() * Math.PI * 2; const spd = 2 + Math.random() * 2;
                bullets.push({ x: this.x + rr(-30, 30), y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: neon, r: 6 });
            }
        }

        if (this.neonCrackCD <= 0) {
            this._playBossSE(opts, 'shot'); this.neonCrackCD = 150;
            const lines = this.berserk ? 5 : 3;
            for (let L = 0; L < lines; L++) {
                const y = H * (0.2 + (L / (lines + 1)) * 0.6) + rr(-20, 20);
                for (let x = 0; x < W + 20; x += 15) {
                    bullets.push({ x, y, vx: 10, vy: 0, active: true, color: voidColor, r: 4 });
                }
            }
        }

        if (this.dimensionalPulseCD <= 0) {
            this._playBossSE(opts, 'charge'); this.dimensionalPulseCD = 220;
            const holes = 5; const n = 24;
            for (let i = 0; i < n; i++) {
                if (i % Math.ceil(n / holes) === 0) continue;
                const a = (Math.PI * 2 / n) * i + Math.random() * 0.1;
                const spd = 2.5;
                bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: neon, r: 6 });
            }
        }

        if (this.iceSpawnCD <= 0) {
            this._playBossSE(opts, 'shot'); this.iceSpawnCD = 250;
            const corners = [{ x: 30, y: 30 }, { x: W - 30, y: 30 }, { x: W - 30, y: H - 30 }, { x: 30, y: H - 30 }];
            corners.forEach(c => {
                for (let i = 0; i < 3; i++) {
                    const dx = px - c.x; const dy = py - c.y; const d = Math.hypot(dx, dy) || 1;
                    const spd = 3;
                    bullets.push({ x: c.x, y: c.y, vx: (dx / d) * spd, vy: (dy / d) * spd, active: true, color: '#aaaaff', r: 4, homing: true });
                }
            });
        }

        if (this.berserk && this.apocalypseT <= 0 && Math.random() < 0.003) {
            this._playBossSE(opts, 'big'); this.apocalypseT = 600;
        }

        /* ============================================================
           ラスボス1 (form 0) 専用攻撃
           ============================================================ */
        if (this.form === 0) {
            /* 青い太いレーザービーム: 球体が出現→そこからビームを3発放つ */
            if (this.blueLaserCD <= 0) {
                this.blueLaserCD = this.berserk ? 200 : 310;
                this._playBossSE(opts, 'charge');
                if (fx.shake !== undefined) fx.shake = Math.max(fx.shake || 0, 10);
                if (fx.flash !== undefined) { fx.flash = 8; fx.fCol = '#0099ff'; }
                /* 球体出現位置（ボスの前方） */
                const sx = this.x + 60; const sy = this.y;
                /* 球体に向けてプレイヤーへ3発ビーム */
                const baseAngle = Math.atan2(py - sy, px - sx);
                for (let i = -1; i <= 1; i++) {
                    const a = baseAngle + i * 0.15;
                    bullets.push({ x: sx, y: sy, vx: Math.cos(a) * 14, vy: Math.sin(a) * 14, active: true, color: '#0088ff', r: 11, isBlueLaser: true });
                }
                /* 球体のバーストエフェクト */
                if (fx.burst) { fx.burst(sx, sy, '#0099ff', 20, 7, 25); fx.burst(sx, sy, '#ffffff', 8, 4, 15); }
            }

            /* どすんどすん突進: たまに素早くプレイヤーへ迫ってくる */
            if (this.voidChargeCD <= 0 && !this.voidChargeT) {
                this.voidChargeCD = this.berserk ? 160 : 240;
                const ddx = px - this.tx; const ddy = py - this.ty;
                const dd = Math.hypot(ddx, ddy) || 1;
                const spd = 6;
                this.voidChargeDx = (ddx / dd) * spd;
                this.voidChargeDy = (ddy / dd) * spd;
                this.voidChargeT = 18;
                this._playBossSE(opts, 'big');
                if (fx.shake !== undefined) fx.shake = Math.max(fx.shake || 0, 14);
            }

            /* 発狂時: ブラックホール予告（画面に大穴→四隅に出現） */
            if (this.berserk && this.blackHoleT <= 0 && Math.random() < 0.004) {
                this.blackHoleT = 160;
                this._playBossSE(opts, 'big');
                if (fx.shake !== undefined) fx.shake = Math.max(fx.shake || 0, 20);
                if (fx.flash !== undefined) { fx.flash = 12; fx.fCol = '#000033'; }
                /* 四隅のどこかに大量弾を出現させる */
                const corners = [[90, 60], [W - 90, 60], [90, H - 60], [W - 90, H - 60]];
                const corner = corners[Math.floor(Math.random() * corners.length)];
                this.tx = corner[0]; this.ty = corner[1];
                /* ブラックホール弾幕（放射状） */
                const n = 20;
                for (let i = 0; i < n; i++) {
                    const a = (Math.PI * 2 / n) * i;
                    bullets.push({ x: corner[0], y: corner[1], vx: Math.cos(a) * 3.5, vy: Math.sin(a) * 3.5, active: true, color: '#3300aa', r: 7 });
                }
                if (fx.burst) fx.burst(corner[0], corner[1], '#6600ff', 30, 9, 40);
            }
        }

        /* ============================================================
           ラスボス2 (form 1) 専用攻撃
           ============================================================ */
        if (this.form === 1) {
            /* カラフル乱射（一定間隔で虹色弾幕） */
            if (this.colorSprayCD <= 0) {
                this.colorSprayCD = this.berserk ? 40 : 60;
                const rainbow = ['#ff4444','#ff9900','#ffff00','#44ff44','#00aaff','#cc44ff'];
                const n = this.berserk ? 12 : 8;
                for (let i = 0; i < n; i++) {
                    const a = (Math.PI * 2 / n) * i + this.timer * 0.04;
                    const col = rainbow[i % rainbow.length];
                    const spd = 3.5 + Math.random() * 2;
                    bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: col, r: 5 });
                }
                this._playBossSE(opts, 'shot');
            }

            /* 発狂時: 雑魚弾幕を吐き出す（ランダム方向に小弾群） */
            if (this.berserk && this.mobBurstCD <= 0) {
                this.mobBurstCD = 90;
                this._playBossSE(opts, 'shot');
                if (fx.shake !== undefined) fx.shake = Math.max(fx.shake || 0, 6);
                const n = 6 + Math.floor(Math.random() * 5);
                for (let i = 0; i < n; i++) {
                    const a = Math.random() * Math.PI * 2;
                    const spd = 1.5 + Math.random() * 2.5;
                    const col = ['#ff6666','#ff9933','#ffcc44'][Math.floor(Math.random() * 3)];
                    bullets.push({ x: this.x + rr(-20, 20), y: this.y + rr(-15, 15), vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: col, r: 6 + Math.random() * 4 });
                }
                if (fx.burst) fx.burst(this.x, this.y, '#ff8800', 16, 6, 20);
            }

            /* 苦しみの表現: berserk 時に激しい画面揺れ＋サイズ脈動フラグ */
            if (this.berserk && this.timer % 45 === 0) {
                if (fx.shake !== undefined) fx.shake = Math.max(fx.shake || 0, 5);
                this.voidSizePulse = (this.voidSizePulse || 0) + 1;
            }
        }

        if (this.anim.state !== 'IDLE' && this.anim.done) this.anim.set('IDLE');
    }

    /** 旧ボス4面: CHAOS（未使用・idx3は鉄翼に変更済み） */
    updateBoss3(px, py, bullets, fx, sd, opts) {
        const W = CFG.W; const H = CFG.H;
        const purple = '#7B00FF'; const purpleLight = '#C39BFF';
        const teleportCDMax = this.berserk ? 48 : 150;
        const phantomCount = this.berserk ? 5 : 1 + Math.floor(this.timer / 200) % 3;
        if (this.phantoms.length > phantomCount) this.phantoms.length = phantomCount;
        while (this.phantoms.length < phantomCount) {
            this.phantoms.push({ x: this.x + rr(-80, 80), y: this.y + rr(-60, 60), vx: rr(-0.3, 0.3), vy: rr(-0.3, 0.3) });
        }

        this.afterimages.forEach(a => { a.t--; a.opacity = (a.t / 30) * 0.4; });
        this.afterimages = this.afterimages.filter(a => a.t > 0);

        this.phantoms.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            p.x = clamp(p.x, W * 0.2, W * 0.9); p.y = clamp(p.y, H * 0.15, H * 0.85);
            p.vx += rr(-0.02, 0.02); p.vy += rr(-0.02, 0.02); p.vx = clamp(p.vx, -0.5, 0.5); p.vy = clamp(p.vy, -0.5, 0.5);
        });

        this.teleportCD--;
        if (this.teleportCD <= 0) {
            this.teleportCD = teleportCDMax;
            this.afterimages.push({ x: this.x, y: this.y, opacity: 0.4, t: 30 });
            this.x = rr(W * 0.35, W * 0.85); this.y = rr(H * 0.2, H * 0.8);
            this.trueBodyIndex = rr(0, Math.max(0, this.phantoms.length));
        }

        this.chaosPhaseT = (this.chaosPhaseT || 0) + 1;
        const phaseLen = 100;
        if (this.chaosPhaseT > phaseLen) { this.chaosPhaseT = 0; this.chaosPhase = (this.chaosPhase + 1) % (this.berserk ? 5 : 4); }

        this.glitchFieldT = Math.max(0, (this.glitchFieldT || 0) - 1);
        if (this.glitchFieldT <= 0) this.glitchFieldRect = null;
        this.aimOffsetRad = 0;

        this.mirrorActiveT = Math.max(0, (this.mirrorActiveT || 0) - 1);
        this.bladeRealityT = Math.max(0, (this.bladeRealityT || 0) - 1);

        const playerPath = opts.playerPath || [];

        if (this.chaosPhase === 0 && this.chaosPhaseT === 1) {
            const baseAngle = Math.atan2(py - this.y, px - this.x);
            bullets.push({ x: this.x, y: this.y, vx: Math.cos(baseAngle) * 3.5, vy: Math.sin(baseAngle) * 3.5, active: true, color: purple, r: 7 });
            for (let j = 0; j < 4; j++) {
                const a = baseAngle + (j - 1.5) * 0.15;
                bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * 3.5, vy: Math.sin(a) * 3.5, active: true, color: purple, r: 7 });
            }
            this.phantoms.forEach(p => {
                const pa = Math.atan2(py - p.y, px - p.x);
                for (let j = 0; j < 5; j++) {
                    const a = pa + (j - 2) * 0.12;
                    const spd = 3.5;
                    bullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, active: true, color: purple, r: 7, noDamage: true });
                }
            });
        }

        if (this.chaosPhase === 1) {
            const facing = (px > this.x) ? 1 : -1;
            if (this.chaosPhaseT === 1) {
                this.bladeRealityT = 24;
                this.chargeTarget = { x: px + facing * 80, y: py };
            }
            if (this.bladeRealityT > 0) {
                const dx = (this.chargeTarget.x - this.x); const dy = (this.chargeTarget.y - this.y); const d = Math.hypot(dx, dy) || 1;
                this.x += (dx / d) * 6; this.y += (dy / d) * 6;
                if (this.bladeRealityT === 20) {
                    const baseA = Math.atan2(py - this.y, px - this.x);
                    for (let i = 0; i < 5; i++) {
                        const a = baseA - 0.52 + (0.52 * 2 / 4) * i;
                        bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * 5, vy: Math.sin(a) * 5, active: true, color: purpleLight, r: 6 });
                    }
                }
            }
        }

        if (this.chaosPhase === 2) {
            if (this.chaosPhaseT === 1) {
                const fw = this.berserk ? W * 0.5 : W * 0.35; const fh = this.berserk ? H * 0.4 : H * 0.3;
                this.glitchFieldRect = { x: rr(50, W - fw - 50), y: rr(80, H - fh - 80), w: fw, h: fh };
                this.glitchFieldT = 180;
            }
            this.aimOffsetRad = this.berserk ? 0.52 : 0.26;
        }

        if (this.chaosPhase === 3 && this.chaosPhaseT === 1 && playerPath.length >= 30) {
            this.mirrorWalkPath = playerPath.slice(-90);
            this.mirrorWalkT = this.mirrorWalkPath.length + 30;
        }
        if (this.mirrorWalkT > 0) {
            this.mirrorWalkT--;
            const idx = this.mirrorWalkPath.length - this.mirrorWalkT;
            if (idx >= 0 && idx < this.mirrorWalkPath.length) {
                const p = this.mirrorWalkPath[idx];
                this.x += (p.x - this.x) * 0.15; this.y += (p.y - this.y) * 0.15;
            }
        }

        if (this.berserk && this.chaosPhase === 4 && this.chaosPhaseT === 1) {
            this.mirrorActiveT = 300;
        }

        if (this.anim.state !== 'IDLE' && this.anim.done) this.anim.set('IDLE');
    }

    draw(c) {
        if (!this.active && this.anim.state !== 'DEATH') return;
        const f = this.anim.frame, t = this.timer, sc = 2.2 + Math.sin(t * 0.04) * 0.15, deathScale = this.anim.state === 'DEATH' ? 1 - f / 5 : 1;
        if (this.phase === 4 && this.laserWarn > 0 && this.laserWarn <= 60 && this.arrived) {
            c.save(); const warn = this.laserWarn / 60; c.globalAlpha = warn * 0.6; c.strokeStyle = "#ff2200"; c.lineWidth = 2 + warn * 4; c.setLineDash([8, 8]);
            c.beginPath(); c.moveTo(this.x, this.y); c.lineTo(this.x + Math.cos(this.laserAngle) * CFG.W, this.y + Math.sin(this.laserAngle) * CFG.W); c.stroke(); c.setLineDash([]); c.restore();
        }
        if (this.idx === 1 && this.boss2Phase === 'enraged' && IMG.boss2) {
            c.save();
            c.globalAlpha = 0.25 + Math.sin(this.timer * 0.2) * 0.15;
            if (!ns()) { c.shadowColor = '#00ff44'; c.shadowBlur = 20 + Math.sin(this.timer * 0.15) * 8; }
            c.fillStyle = '#00ff4433';
            c.beginPath(); c.arc(0, 0, 70, 0, Math.PI * 2); c.fill();
            c.restore();
        }
        if (this.idx === 1 && this.boss2LaserWarnT > 0) {
            const la = this.boss2LaserAngle != null ? this.boss2LaserAngle : 0;
            const warn = 1 - this.boss2LaserWarnT / 25;
            const len = CFG.W * 1.2;
            c.save();
            c.strokeStyle = '#88ffcc';
            if (!ns()) { c.shadowColor = '#88ffcc'; c.shadowBlur = 12; }
            c.globalAlpha = 0.4 + warn * 0.5;
            c.lineWidth = 2 + warn * 4;
            c.setLineDash([6, 8]);
            c.beginPath(); c.moveTo(this.x, this.y); c.lineTo(this.x + Math.cos(la) * len, this.y + Math.sin(la) * len); c.stroke();
            c.setLineDash([]); c.restore();
        }
        if (this.idx === 2) {
            if (this.portalResidue && this.portalResidue.t > 0) {
                c.save();
                c.globalAlpha = this.portalResidue.t / (this.portalResidue.maxT || 30);
                c.strokeStyle = '#BB8FCE';
                c.lineWidth = 2;
                c.setLineDash([4, 4]);
                c.beginPath(); c.arc(this.portalResidue.x, this.portalResidue.y, 25 + (1 - this.portalResidue.t / (this.portalResidue.maxT || 30)) * 15, 0, Math.PI * 2); c.stroke();
                c.setLineDash([]); c.restore();
            }
            (this.mirrorClones || []).forEach(cl => {
                if (cl.hp <= 0) return;
                c.save(); c.globalAlpha = 0.7; c.fillStyle = '#7B00FF'; c.strokeStyle = '#C39BFF'; c.lineWidth = 1;
                c.beginPath(); c.ellipse(cl.x, cl.y, 24, 18, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.restore();
            });
            (this.mimicCores || []).forEach(core => {
                if (core.hp <= 0) return;
                const guardImg = getMimicGuardianSvgImage();
                const gSize = 36;
                if (guardImg.complete && guardImg.naturalWidth) {
                    c.save();
                    c.globalAlpha = 0.9;
                    c.drawImage(guardImg, Math.floor(core.x - gSize / 2), Math.floor(core.y - gSize / 2), gSize, gSize);
                    c.restore();
                } else {
                    c.save(); c.globalAlpha = 0.85; c.fillStyle = '#5A2D8A'; c.strokeStyle = '#C39BFF'; c.lineWidth = 2;
                    c.beginPath(); c.arc(core.x, core.y, 18, 0, Math.PI * 2); c.fill(); c.stroke(); c.restore();
                }
            });
            if (this.thunderWarnT > 0) {
                c.save(); c.strokeStyle = '#FFDD00'; c.lineWidth = 2; c.globalAlpha = 0.4 + (this.thunderWarnT % 15 < 8 ? 0.3 : 0); c.setLineDash([6, 6]);
                c.beginPath(); c.moveTo(this.x - 60, this.y - 40); c.lineTo(this.x + 60, this.y - 40); c.stroke(); c.restore();
            }
        }
        if (this.idx === 0 && this.purpleBeamTelegraph > 0) {
            c.save();
            const t = 1 - this.purpleBeamTelegraph / 120;
            c.globalAlpha = 0.4 + t * 0.5; c.fillStyle = '#9B59B6'; c.strokeStyle = '#D7BDE2';
            c.beginPath(); c.arc(this.x - 12, this.y - 18, 6 + t * 4, 0, Math.PI * 2); c.fill(); c.stroke();
            c.beginPath(); c.arc(this.x + 12, this.y - 18, 6 + t * 4, 0, Math.PI * 2); c.fill(); c.stroke();
            c.restore();
        }
        if (this.idx === 5) {
            (this.iceTrail || []).forEach(tr => {
                c.save();
                c.globalAlpha = (tr.t / 90) * 0.4;
                c.strokeStyle = '#AED6F1';
                c.lineWidth = 1.5;
                c.beginPath(); c.arc(tr.x, tr.y, 12, 0, Math.PI * 2); c.stroke();
                c.restore();
            });
        }
        if (this.idx === 3 && this.outOfControlT > 0) {
            c.save();
            c.globalAlpha = 0.6 + Math.sin(this.timer * 0.2) * 0.2;
            for (let i = 0; i < 6; i++) {
                const a = (this.timer * 0.15 + i * 1.1) % (Math.PI * 2);
                const len = 20 + (this.timer + i * 7) % 15;
                c.strokeStyle = '#ffaa00'; c.lineWidth = 1;
                c.beginPath(); c.moveTo(this.x, this.y); c.lineTo(this.x + Math.cos(a) * len, this.y + Math.sin(a) * len); c.stroke();
            }
            c.restore();
        }
        if (this.idx === 6 && this.form === 2 && this.voidAfterimages && this.voidAfterimages.length && IMG.lastboss3) {
            const sheet = IMG.lastboss3;
            const iw = sheet.naturalWidth || 384, ih = sheet.naturalHeight || 64;
            const LASTBOSS3_FRAMES = 6, fw = iw / LASTBOSS3_FRAMES;
            const BOSS_DISPLAY_MAX = 440, maxDim = Math.max(fw, ih, 1);
            const baseScale = (BOSS_DISPLAY_MAX / maxDim) * 1.5 * BOSS_SIZE_SCALE;
            const drawW = fw * baseScale, drawH = ih * baseScale;
            const LIFE = this.VOID_AFTERIMAGE_LIFE ?? 180;
            this.voidAfterimages.forEach(a => {
                c.save();
                c.globalAlpha = (a.t / LIFE) * 0.72;
                c.translate(Math.floor(a.x), Math.floor(a.y)); c.scale(-1, 1);
                const _dx = Math.floor(-drawW / 2), _dy = Math.floor(-drawH / 2);
                c.drawImage(sheet, (a.frame || 0) * fw, 0, fw, ih, _dx, _dy, drawW, drawH);
                c.restore();
            });
        }
        const jitterX = 0;
        const jitterY = 0;
        c.save(); c.translate(Math.floor(this.x + jitterX), Math.floor(this.y + jitterY));
        if (this.idx === 2 && (this.mimicChargePhase === 'spin' || this.mimicChargePhase === 'charge')) c.rotate(this.mimicSpinAngle || 0);
        if (this.idx === 6) c.scale(-1, 1);
        if (this.idx === 0) c.scale(-1, 1); /* BOSS1: カラス方向（左）を向くよう左右反転 */
        if (this.idx === 4 && (this.energyTrail || []).length) {
            (this.energyTrail || []).forEach(tr => {
                c.save();
                c.globalAlpha = (tr.t / 120) * 0.35;
                c.strokeStyle = '#00dddd';
                c.lineWidth = 2;
                c.beginPath(); c.arc(tr.x - this.x, tr.y - this.y, 18, 0, Math.PI * 2); c.stroke();
                c.restore();
            });
        }
        if (this.anim.state === 'DEATH') c.globalAlpha = deathScale;
        const isLastBossForm2 = this.idx === 6 && this.form === 2;
        const isLastBossForm1 = this.idx === 6 && this.form === 1;
        const bossImgSheet = isLastBossForm2 && IMG.lastboss3 ? IMG.lastboss3 : null;
        const bossImg = !bossImgSheet && isLastBossForm1 && IMG.lastboss2 ? IMG.lastboss2 : (!bossImgSheet ? IMG['boss' + (this.idx + 1)] : null);
        const useIntroPixel = !this.introDone && this.introT < this.INTRO_DUR;
        const useDeathPixel = this.anim.state === 'DEATH' && this.deathT < 80;
        const deathPixelScale = useDeathPixel ? 1 + Math.min(1, this.deathT / 60) * 7 : 1;
        const pixelScale = useIntroPixel ? Math.max(1, 8 - 7 * this.introT / this.INTRO_DUR) : (useDeathPixel ? deathPixelScale : 1);
        if (bossImgSheet) {
            const iw = bossImgSheet.naturalWidth || 384, ih = bossImgSheet.naturalHeight || 64;
            const LASTBOSS3_FRAMES = 6;
            const fw = iw / LASTBOSS3_FRAMES;
            const frameIndex = this.anim.state === 'DEATH' ? 0 : Math.floor(this.timer / 8) % LASTBOSS3_FRAMES;
            const sx = frameIndex * fw;
            const BOSS_DISPLAY_MAX = 440;
            const maxDim = Math.max(fw, ih, 1);
            let baseScale = (BOSS_DISPLAY_MAX / maxDim) * (1 + Math.sin(t * 0.04) * 0.03) * deathScale * BOSS_SIZE_SCALE;
            if (this.idx === 3) baseScale *= 1.4;
            if (this.idx === 6) baseScale *= 1.5;
            const drawW = fw * baseScale; const drawH = ih * baseScale;
            this._drawW = drawW; this._drawH = drawH;
            if (useIntroPixel || useDeathPixel) {
                const smallW = Math.max(4, Math.floor(drawW / pixelScale)); const smallH = Math.max(4, Math.floor(drawH / pixelScale));
                if (!this._pixBuf || this._pixBuf.width !== smallW || this._pixBuf.height !== smallH) { this._pixBuf = document.createElement('canvas'); this._pixBuf.width = smallW; this._pixBuf.height = smallH; }
                const buf = this._pixBuf.getContext('2d'); buf.drawImage(bossImgSheet, sx, 0, fw, ih, 0, 0, smallW, smallH);
                if (!useDeathPixel) { buf.globalCompositeOperation = 'multiply'; buf.globalAlpha = 0.35; buf.fillStyle = this.color; buf.fillRect(0, 0, smallW, smallH); buf.globalAlpha = 1; buf.globalCompositeOperation = 'source-over'; }
                const _dwx = Math.floor(-drawW / 2), _dwy = Math.floor(-drawH / 2);
                c.imageSmoothingEnabled = false; c.drawImage(this._pixBuf, 0, 0, smallW, smallH, _dwx, _dwy, drawW, drawH); c.imageSmoothingEnabled = true;
            } else {
                const _dwx = Math.floor(-drawW / 2), _dwy = Math.floor(-drawH / 2);
                c.drawImage(bossImgSheet, sx, 0, fw, ih, _dwx, _dwy, drawW, drawH);
            }
            if (!useIntroPixel && !useDeathPixel) {
                const _dwx = Math.floor(-drawW / 2), _dwy = Math.floor(-drawH / 2);
                if (this.hitFlash > 0) {
                    c.globalCompositeOperation = 'source-over';
                    c.globalAlpha = 0.5; c.fillStyle = '#ffffff'; c.fillRect(_dwx, _dwy, drawW, drawH); c.globalAlpha = 1;
                } else {
                    c.globalCompositeOperation = 'multiply';
                    c.globalAlpha = 0.35; c.fillStyle = this.color; c.fillRect(_dwx, _dwy, drawW, drawH); c.globalAlpha = 1;
                    c.globalCompositeOperation = 'source-over';
                }
            }
        } else if (this.idx === 1 && IMG.boss2) {
            /* BOSS2: 三角ロボ 3×2グリッド 6フレーム [前面左/側面/前面右, 後面左/前面正面/発射] */
            const img = IMG.boss2;
            const BOSS2_COLS = 3; const BOSS2_ROWS = 2;
            const BOSS2_CELL_W = Math.floor((img.naturalWidth || 384) / BOSS2_COLS);
            const BOSS2_CELL_H = Math.floor((img.naturalHeight || 256) / BOSS2_ROWS);
            const f = this.boss2Frame || { col: 1, row: 1 };
            const col = f.col ?? 1; const row = f.row ?? 1;
            const sx = (col % BOSS2_COLS) * BOSS2_CELL_W;
            const sy = Math.min(row, BOSS2_ROWS - 1) * BOSS2_CELL_H;
            const BOSS_DISPLAY_MAX = 380;
            const maxDim = Math.max(BOSS2_CELL_W, BOSS2_CELL_H, 1);
            let baseScale = (BOSS_DISPLAY_MAX / maxDim) * (1 + Math.sin(t * 0.04) * 0.02) * deathScale * BOSS_SIZE_SCALE;
            const drawW = BOSS2_CELL_W * baseScale; const drawH = BOSS2_CELL_H * baseScale;
            this._drawW = drawW; this._drawH = drawH;
            const _b2x = Math.floor(-drawW / 2), _b2y = Math.floor(-drawH / 2);
            c.drawImage(img, sx, sy, BOSS2_CELL_W, BOSS2_CELL_H, _b2x, _b2y, drawW, drawH);
            if (this.hitFlash > 0) {
                c.globalCompositeOperation = 'source-over';
                c.globalAlpha = 0.5; c.fillStyle = '#ffffff'; c.fillRect(_b2x, _b2y, drawW, drawH); c.globalAlpha = 1;
            } else {
                c.globalCompositeOperation = 'multiply';
                c.globalAlpha = 0.3; c.fillStyle = this.color; c.fillRect(_b2x, _b2y, drawW, drawH); c.globalAlpha = 1;
                c.globalCompositeOperation = 'source-over';
            }
        } else if (this.idx === 0 && IMG.boss1) {
            /* BOSS1: 骸骨剣士 3×3グリッド 9フレーム (0:idle, 1:windup, 2:thrust, 3:guard, 4:slash, 5:charge_ready, 6:taunt, 7:run, 8:hurt) */
            const img = IMG.boss1;
            const BOSS1_COLS = 3;
            const BOSS1_CELL_W = Math.floor((img.naturalWidth || 1011) / BOSS1_COLS);
            const BOSS1_CELL_H = Math.floor((img.naturalHeight || 1011) / BOSS1_COLS);
            const BOSS1_DRAW_W = 312, BOSS1_DRAW_H = 312; /* 120% (260×1.2) */
            const frameFromState = { IDLE: 0, CHARGE: 7, ATTACK: 4, HIT: 8, DEATH: 8 };
            let frameN = frameFromState[this.anim.state];
            if (frameN === undefined) frameN = 0;
            const col = frameN % BOSS1_COLS, row = Math.floor(frameN / BOSS1_COLS);
            const sx = col * BOSS1_CELL_W, sy = row * BOSS1_CELL_H;
            const drawW = BOSS1_DRAW_W * deathScale, drawH = BOSS1_DRAW_H * deathScale;
            this._drawW = drawW; this._drawH = drawH;
            const dx = 0, dy = 0;
            const _b1x = Math.floor(-drawW / 2 + dx), _b1y = Math.floor(-drawH / 2 + dy);
            if (useIntroPixel || useDeathPixel) {
                const smallW = Math.max(4, Math.floor(drawW / pixelScale)); const smallH = Math.max(4, Math.floor(drawH / pixelScale));
                if (!this._pixBuf || this._pixBuf.width !== smallW || this._pixBuf.height !== smallH) { this._pixBuf = document.createElement('canvas'); this._pixBuf.width = smallW; this._pixBuf.height = smallH; }
                const buf = this._pixBuf.getContext('2d'); buf.drawImage(IMG.boss1, sx, sy, BOSS1_CELL_W, BOSS1_CELL_H, 0, 0, smallW, smallH);
                if (!useDeathPixel) { buf.globalCompositeOperation = 'multiply'; buf.globalAlpha = 0.35; buf.fillStyle = this.color; buf.fillRect(0, 0, smallW, smallH); buf.globalAlpha = 1; buf.globalCompositeOperation = 'source-over'; }
                c.imageSmoothingEnabled = false; c.drawImage(this._pixBuf, 0, 0, smallW, smallH, _b1x, _b1y, drawW, drawH); c.imageSmoothingEnabled = true;
            } else {
                c.drawImage(IMG.boss1, sx, sy, BOSS1_CELL_W, BOSS1_CELL_H, _b1x, _b1y, drawW, drawH);
            }
            if (!useIntroPixel && !useDeathPixel) {
                if (this.hitFlash > 0) {
                    c.globalCompositeOperation = 'source-over';
                    c.globalAlpha = 0.5; c.fillStyle = '#ffffff'; c.fillRect(_b1x, _b1y, drawW, drawH); c.globalAlpha = 1;
                } else {
                    c.globalCompositeOperation = 'multiply';
                    c.globalAlpha = 0.35; c.fillStyle = this.color; c.fillRect(_b1x, _b1y, drawW, drawH); c.globalAlpha = 1;
                    c.globalCompositeOperation = 'source-over';
                }
            }
        } else if (this.idx === 2 && IMG.boss3) {
            /* BOSS3: ミミック / GlitchScientist — 単一画像＋グリッチ強度でRGBずれ・データ崩壊表現 */
            const img = IMG.boss3;
            const iw = img.naturalWidth || 256, ih = img.naturalHeight || 256;
            const BOSS_DISPLAY_MAX = 440;
            const maxDim = Math.max(iw, ih, 1);
            const baseScale = (BOSS_DISPLAY_MAX / maxDim) * (1 + Math.sin(t * 0.04) * 0.03) * deathScale * BOSS_SIZE_SCALE;
            const drawW = iw * baseScale, drawH = ih * baseScale;
            this._drawW = drawW; this._drawH = drawH;
            const glitchIntensity = 1 - this.hp / this.maxHp;
            const _b3x = Math.floor(-drawW / 2), _b3y = Math.floor(-drawH / 2);
            if (useIntroPixel || useDeathPixel) {
                const smallW = Math.max(4, Math.floor(drawW / pixelScale)); const smallH = Math.max(4, Math.floor(drawH / pixelScale));
                if (!this._pixBuf || this._pixBuf.width !== smallW || this._pixBuf.height !== smallH) { this._pixBuf = document.createElement('canvas'); this._pixBuf.width = smallW; this._pixBuf.height = smallH; }
                const buf = this._pixBuf.getContext('2d'); buf.drawImage(img, 0, 0, iw, ih, 0, 0, smallW, smallH);
                if (!useDeathPixel) { buf.globalCompositeOperation = 'multiply'; buf.globalAlpha = 0.35; buf.fillStyle = this.color; buf.fillRect(0, 0, smallW, smallH); buf.globalAlpha = 1; buf.globalCompositeOperation = 'source-over'; }
                c.imageSmoothingEnabled = false; c.drawImage(this._pixBuf, 0, 0, smallW, smallH, _b3x, _b3y, drawW, drawH); c.imageSmoothingEnabled = true;
            } else {
                if (glitchIntensity > 0.25) {
                    c.save();
                    c.globalAlpha = 0.2 * glitchIntensity;
                    c.drawImage(img, 0, 0, iw, ih, _b3x - 5, _b3y, drawW, drawH);
                    c.drawImage(img, 0, 0, iw, ih, _b3x + 5, _b3y, drawW, drawH);
                    c.restore();
                }
                c.drawImage(img, 0, 0, iw, ih, _b3x, _b3y, drawW, drawH);
            }
            if (!useIntroPixel && !useDeathPixel) {
                if (this.hitFlash > 0) {
                    c.globalCompositeOperation = 'source-over';
                    c.globalAlpha = 0.5; c.fillStyle = '#ffffff'; c.fillRect(_b3x, _b3y, drawW, drawH); c.globalAlpha = 1;
                } else {
                    c.globalCompositeOperation = 'multiply';
                    c.globalAlpha = 0.35; c.fillStyle = this.color; c.fillRect(_b3x, _b3y, drawW, drawH); c.globalAlpha = 1;
                    c.globalCompositeOperation = 'source-over';
                }
            }
        } else if (this.idx === 3 && IMG.boss4) {
            /* BOSS4: 鉄の翼 / InfernalBatDemon 3×3グリッド 9フレーム。羽ばたきループ・翼残像（オレンジ〜赤）・影・胸部コア発光 */
            const img = IMG.boss4;
            if (this.ironWingTrail && this.ironWingTrail.length > 0 && !ns()) {
                /* radialGradient は iOS で重いため noShadow=true（モバイル/低FPS）時はスキップ */
                c.save();
                c.setTransform(1, 0, 0, 1, 0, 0);
                this.ironWingTrail.forEach((tr, i) => {
                    const alpha = (tr.t / 28) * 0.35;
                    const r = 18 + (1 - tr.t / 28) * 10;
                    const grad = c.createRadialGradient(tr.x, tr.y, 0, tr.x, tr.y, r);
                    grad.addColorStop(0, 'rgba(255,140,0,' + alpha * 0.9 + ')');
                    grad.addColorStop(0.6, 'rgba(255,69,0,' + alpha * 0.4 + ')');
                    grad.addColorStop(1, 'rgba(255,0,0,0)');
                    c.fillStyle = grad;
                    c.beginPath();
                    c.arc(tr.x, tr.y, r, 0, Math.PI * 2);
                    c.fill();
                });
                c.restore();
            }
            const COLS = 3, ROWS = 3;
            const cellW = Math.floor((img.naturalWidth || 384) / COLS);
            const cellH = Math.floor((img.naturalHeight || 384) / ROWS);
            const seq = this.ironWingFrameSequence || [0, 1, 4, 7, 8, 7, 4, 1];
            const frameIdx = seq[this.ironWingSeqIndex % seq.length];
            const col = frameIdx % COLS; const row = Math.floor(frameIdx / COLS);
            const sx = col * cellW; const sy = row * cellH;
            const BOSS_DISPLAY_MAX = 300;
            let baseScale = (BOSS_DISPLAY_MAX / Math.max(cellW, cellH, 1)) * (1 + Math.sin(t * 0.04) * 0.02) * deathScale * BOSS_SIZE_SCALE;
            baseScale *= 1.68; /* 4面ボス 1.4×1.2 */
            const drawW = cellW * baseScale; const drawH = cellH * baseScale;
            this._drawW = drawW; this._drawH = drawH;
            const floatY = Math.sin(t * 0.015) * 12;
            const shadowY = CFG.H - 60;
            const heightFactor = (this.y - (CFG.H * 0.25) + 40) / 80;
            const shadowScale = 0.75 + heightFactor * 0.25;
            const shadowAlpha = 0.35 - heightFactor * 0.08;
            c.save();
            c.setTransform(1, 0, 0, 1, 0, 0);
            c.fillStyle = 'rgba(0,0,0,' + Math.max(0.1, shadowAlpha) + ')';
            c.beginPath();
            c.ellipse(this.x, shadowY, 55 * shadowScale, 14 * shadowScale, 0, 0, Math.PI * 2);
            c.fill();
            c.restore();
            c.save();
            c.translate(0, Math.floor(floatY));
            if (this.ironWingFlipX) c.scale(-1, 1);
            const _b4x = Math.floor(-drawW / 2), _b4y = Math.floor(-drawH / 2);
            c.drawImage(img, sx, sy, cellW, cellH, _b4x, _b4y, drawW, drawH);
            if (this.hitFlash > 0) { c.globalCompositeOperation = 'source-over'; c.globalAlpha = 0.5; c.fillStyle = '#ffffff'; c.fillRect(_b4x, _b4y, drawW, drawH); c.globalAlpha = 1; }
            else if (this.ironWingRage && t % 20 < 10) { c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.5; c.fillStyle = '#ff3c3c'; c.fillRect(_b4x, _b4y, drawW, drawH); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
            else { c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.35; c.fillStyle = this.color; c.fillRect(_b4x, _b4y, drawW, drawH); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
            c.globalCompositeOperation = 'lighter';
            const leftEyeX = -drawW / 2 + drawW * 0.35; const rightEyeX = -drawW / 2 + drawW * 0.65; const eyeY = -drawH / 2 + drawH * 0.28;
            const eyeGlow = 0.6 + Math.sin(t * 0.12) * 0.25;
            [leftEyeX, rightEyeX].forEach(ex => {
                if (!ns()) {
                    /* radialGradient は iOS で重いため noShadow 時はシンプルな塗りで代替 */
                    const grad = c.createRadialGradient(ex, eyeY, 0, ex, eyeY, 14);
                    grad.addColorStop(0, 'rgba(255,50,50,' + eyeGlow + ')');
                    grad.addColorStop(1, 'transparent');
                    c.fillStyle = grad;
                } else {
                    c.fillStyle = 'rgba(255,50,50,' + (eyeGlow * 0.6) + ')';
                }
                c.beginPath();
                c.arc(ex, eyeY, 14, 0, Math.PI * 2);
                c.fill();
            });
            c.restore();
        } else if (this.idx === 4 && IMG.boss5) {
            /* BOSS5: 鋼甲蟲 SCARABOT 3×2グリッド 6フレーム walk/trigger/enrage/burst */
            const img = IMG.boss5;
            const COLS = 3, ROWS = 2;
            const cellW = Math.floor((img.naturalWidth || 384) / COLS);
            const cellH = Math.floor((img.naturalHeight || 256) / ROWS);
            const frames = this.scarabotAnimFrames || [0, 1, 2, 1];
            const frameIdx = frames[this.scarabotAnimIndex % frames.length] % 6;
            const col = frameIdx % COLS; const row = Math.floor(frameIdx / COLS);
            const sx = col * cellW; const sy = row * cellH;
            const BOSS_DISPLAY_MAX = 360;
            let baseScale = (BOSS_DISPLAY_MAX / Math.max(cellW, cellH, 1)) * (1 + Math.sin(t * 0.04) * 0.02) * deathScale * BOSS_SIZE_SCALE * 1.1;
            const drawW = cellW * baseScale; const drawH = cellH * baseScale;
            this._drawW = drawW; this._drawH = drawH;
            const _b5x = Math.floor(-drawW / 2), _b5y = Math.floor(-drawH / 2);
            if (this.scarabotFlipX) c.scale(-1, 1);
            c.drawImage(img, sx, sy, cellW, cellH, _b5x, _b5y, drawW, drawH);
            if (this.scarabotFlipX) c.scale(-1, 1);
            if (this.hitFlash > 0) { c.globalCompositeOperation = 'source-over'; c.globalAlpha = 0.5; c.fillStyle = '#ffffff'; c.fillRect(_b5x, _b5y, drawW, drawH); c.globalAlpha = 1; }
            else { c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.3; c.fillStyle = this.color; c.fillRect(_b5x, _b5y, drawW, drawH); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
        } else if (this.idx === 6 && this.form === 0 && IMG.boss7) {
            /* ラスボス第1形態＝裂け目そのもの: 裂け目演出を描画してからスプライト */
            const riftPhase = (this.timer || 0) * 0.05;
            const riftAlpha = 0.45 + Math.sin(riftPhase) * 0.15;
            c.save();
            c.globalAlpha = riftAlpha;
            c.strokeStyle = 'rgba(30,0,60,0.95)';
            c.lineWidth = 3;
            const riftRayCount = 7;
            const riftLen = 95 + Math.sin(riftPhase * 1.3) * 15;
            for (let i = 0; i < riftRayCount; i++) {
                const baseAngle = (i / riftRayCount) * Math.PI * 2 + riftPhase * 0.3;
                const jitter = Math.sin(i * 1.7 + riftPhase * 2) * 0.15;
                const a1 = baseAngle - jitter;
                const a2 = baseAngle + jitter;
                c.beginPath();
                c.moveTo(0, 0);
                c.lineTo(Math.cos(a1) * riftLen, Math.sin(a1) * riftLen);
                c.moveTo(0, 0);
                c.lineTo(Math.cos(a2) * riftLen * 0.6, Math.sin(a2) * riftLen * 0.6);
                c.stroke();
            }
            c.strokeStyle = 'rgba(80,20,120,0.7)';
            c.lineWidth = 1.5;
            for (let i = 0; i < riftRayCount; i++) {
                const baseAngle = (i / riftRayCount) * Math.PI * 2 + riftPhase * 0.2 + 0.5;
                const len = riftLen * (0.4 + Math.sin(riftPhase + i) * 0.2);
                c.beginPath();
                c.moveTo(0, 0);
                c.lineTo(Math.cos(baseAngle) * len, Math.sin(baseAngle) * len);
                c.stroke();
            }
            c.restore();
            /* BOSS7（ラスボス第1形態）: 2列×3行 6フレーム。idle [0,1] / charge [0,1,2] / burst 3 / discharge [4,5] / full [0..5] */
            const img = IMG.boss7;
            const BOSS7_COLS = 2, BOSS7_ROWS = 3, BOSS7_TOTAL = 6;
            const cellW = Math.floor((img.naturalWidth || 384) / BOSS7_COLS);
            const cellH = Math.floor((img.naturalHeight || 576) / BOSS7_ROWS);
            const sequences = { idle: [0, 1], charge: [0, 1, 2], burst: [3], discharge: [4, 5], full: [0, 1, 2, 3, 4, 5] };
            const stateToSequence = { IDLE: 'idle', CHARGE: 'charge', ATTACK: 'burst', HIT: 'discharge', DEATH: 'full' };
            const seqName = stateToSequence[this.anim.state] || 'idle';
            const seq = sequences[seqName];
            const seqIdx = Math.floor(this.timer / 10) % seq.length;
            const frameIdx = seq[seqIdx];
            const col = frameIdx % BOSS7_COLS;
            const row = Math.floor(frameIdx / BOSS7_COLS);
            const sx = col * cellW;
            const sy = row * cellH;
            const BOSS_DISPLAY_MAX = 380;
            const maxDim = Math.max(cellW, cellH, 1);
            let baseScale = (BOSS_DISPLAY_MAX / maxDim) * (1 + Math.sin(t * 0.04) * 0.02) * deathScale * BOSS_SIZE_SCALE;
            baseScale *= 1.5;
            const drawW = cellW * baseScale;
            const drawH = cellH * baseScale;
            this._drawW = drawW;
            this._drawH = drawH;
            const _b7x = Math.floor(-drawW / 2), _b7y = Math.floor(-drawH / 2);
            if (useIntroPixel || useDeathPixel) {
                const smallW = Math.max(4, Math.floor(drawW / pixelScale)); const smallH = Math.max(4, Math.floor(drawH / pixelScale));
                if (!this._pixBuf || this._pixBuf.width !== smallW || this._pixBuf.height !== smallH) { this._pixBuf = document.createElement('canvas'); this._pixBuf.width = smallW; this._pixBuf.height = smallH; }
                const buf = this._pixBuf.getContext('2d'); buf.drawImage(img, sx, sy, cellW, cellH, 0, 0, smallW, smallH);
                if (!useDeathPixel) { buf.globalCompositeOperation = 'multiply'; buf.globalAlpha = 0.35; buf.fillStyle = this.color; buf.fillRect(0, 0, smallW, smallH); buf.globalAlpha = 1; buf.globalCompositeOperation = 'source-over'; }
                c.imageSmoothingEnabled = false; c.drawImage(this._pixBuf, 0, 0, smallW, smallH, _b7x, _b7y, drawW, drawH); c.imageSmoothingEnabled = true;
            } else {
                c.drawImage(img, sx, sy, cellW, cellH, _b7x, _b7y, drawW, drawH);
            }
            if (!useIntroPixel && !useDeathPixel) {
                if (this.hitFlash > 0) {
                    c.globalCompositeOperation = 'source-over';
                    c.globalAlpha = 0.5; c.fillStyle = '#ffffff'; c.fillRect(_b7x, _b7y, drawW, drawH); c.globalAlpha = 1;
                } else {
                    c.globalCompositeOperation = 'multiply';
                    c.globalAlpha = 0.35; c.fillStyle = this.color; c.fillRect(_b7x, _b7y, drawW, drawH); c.globalAlpha = 1;
                    c.globalCompositeOperation = 'source-over';
                }
            }
        } else if (this.idx === 5 && IMG.boss6) {
            /* BOSS6: 雪の女王 3×2グリッド 6フレーム IDLE/SHOOT/ENRAGE/BLIZZARD/SHIELD/BURST。向き修正で左向き、表示130％ */
            const img = IMG.boss6;
            const COLS = 3, ROWS = 2;
            const cellW = Math.floor((img.naturalWidth || 384) / COLS);
            const cellH = Math.floor((img.naturalHeight || 256) / ROWS);
            const stateToFrame = { IDLE: 0, SHOOT: 1, ENRAGE: 2, BLIZZARD: 3, SHIELD: 4, BURST: 5 };
            let frameIdx = stateToFrame[this.snowQueenSpriteState];
            if (frameIdx === undefined) frameIdx = 0;
            frameIdx = Math.min(5, frameIdx);
            const col = frameIdx % COLS; const row = Math.floor(frameIdx / COLS);
            const sx = col * cellW; const sy = row * cellH;
            const BOSS_DISPLAY_MAX = 400;
            let baseScale = (BOSS_DISPLAY_MAX / Math.max(cellW, cellH, 1)) * (1 + Math.sin(t * 0.04) * 0.02) * deathScale * BOSS_SIZE_SCALE * 1.56; /* 6面ボス 1.3×1.2 */
            const drawW = cellW * baseScale; const drawH = cellH * baseScale;
            this._drawW = drawW; this._drawH = drawH;
            const _b6x = Math.floor(-drawW / 2), _b6y = Math.floor(-drawH / 2);
            c.scale(-1, 1);
            c.drawImage(img, sx, sy, cellW, cellH, _b6x, _b6y, drawW, drawH);
            c.scale(-1, 1);
            if (this.hitFlash > 0) { c.globalCompositeOperation = 'source-over'; c.globalAlpha = 0.5; c.fillStyle = '#ffffff'; c.fillRect(_b6x, _b6y, drawW, drawH); c.globalAlpha = 1; }
            else { c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.35; c.fillStyle = this.color; c.fillRect(_b6x, _b6y, drawW, drawH); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
        } else if (this.idx === 6 && this.form === 1 && IMG.lastboss2) {
            /* ラスボス第2形態: lastboss2.png を 3列×2行（6フレーム）スプライトとして再生 */
            const img = IMG.lastboss2;
            const LASTBOSS2_COLS = 3, LASTBOSS2_ROWS = 2, LASTBOSS2_TOTAL = LASTBOSS2_COLS * LASTBOSS2_ROWS;
            const cellW = Math.floor((img.naturalWidth || 384) / LASTBOSS2_COLS);
            const cellH = Math.floor((img.naturalHeight || 256) / LASTBOSS2_ROWS);
            const currentFrame = this.anim.state === 'DEATH' ? 0 : Math.floor(this.timer / 8) % LASTBOSS2_TOTAL;
            const col = currentFrame % LASTBOSS2_COLS;
            const row = Math.floor(currentFrame / LASTBOSS2_COLS);
            const sx = col * cellW, sy = row * cellH;
            const BOSS_DISPLAY_MAX = 440;
            const maxDim = Math.max(cellW, cellH, 1);
            /* ラスボス2: 苦しみのサイズ脈動（発狂時は激しく大小変化） */
            const sizeOscAmp = this.berserk ? 0.22 : 0.08;
            const sizeOscSpeed = this.berserk ? 0.11 : 0.06;
            let baseScale = (BOSS_DISPLAY_MAX / maxDim) * (1 + Math.sin(t * sizeOscSpeed) * sizeOscAmp) * deathScale * BOSS_SIZE_SCALE;
            baseScale *= 1.5;
            const drawW = cellW * baseScale, drawH = cellH * baseScale;
            this._drawW = drawW; this._drawH = drawH;
            const _lb2x = Math.floor(-drawW / 2), _lb2y = Math.floor(-drawH / 2);
            if (useIntroPixel || useDeathPixel) {
                const smallW = Math.max(4, Math.floor(drawW / pixelScale)); const smallH = Math.max(4, Math.floor(drawH / pixelScale));
                if (!this._pixBuf || this._pixBuf.width !== smallW || this._pixBuf.height !== smallH) { this._pixBuf = document.createElement('canvas'); this._pixBuf.width = smallW; this._pixBuf.height = smallH; }
                const buf = this._pixBuf.getContext('2d'); buf.drawImage(img, sx, sy, cellW, cellH, 0, 0, smallW, smallH);
                if (!useDeathPixel) { buf.globalCompositeOperation = 'multiply'; buf.globalAlpha = 0.35; buf.fillStyle = this.color; buf.fillRect(0, 0, smallW, smallH); buf.globalAlpha = 1; buf.globalCompositeOperation = 'source-over'; }
                c.imageSmoothingEnabled = false; c.drawImage(this._pixBuf, 0, 0, smallW, smallH, _lb2x, _lb2y, drawW, drawH); c.imageSmoothingEnabled = true;
            } else {
                c.drawImage(img, sx, sy, cellW, cellH, _lb2x, _lb2y, drawW, drawH);
            }
            if (!useIntroPixel && !useDeathPixel) {
                if (this.hitFlash > 0) {
                    c.globalCompositeOperation = 'source-over';
                    c.globalAlpha = 0.5; c.fillStyle = '#ffffff'; c.fillRect(_lb2x, _lb2y, drawW, drawH); c.globalAlpha = 1;
                } else {
                    c.globalCompositeOperation = 'multiply';
                    c.globalAlpha = 0.35; c.fillStyle = this.color; c.fillRect(_lb2x, _lb2y, drawW, drawH); c.globalAlpha = 1;
                    c.globalCompositeOperation = 'source-over';
                }
            }
        } else if (bossImg) {
            const iw = bossImg.naturalWidth || 64, ih = bossImg.naturalHeight || 64;
            const BOSS_DISPLAY_MAX = 440;
            const maxDim = Math.max(iw, ih, 1);
            let baseScale = (BOSS_DISPLAY_MAX / maxDim) * (1 + Math.sin(t * 0.04) * 0.03) * deathScale * BOSS_SIZE_SCALE;
            if (this.idx === 3) baseScale *= 1.4;
            if (this.idx === 6) baseScale *= 1.5;
            const drawW = iw * baseScale, drawH = ih * baseScale;
            this._drawW = drawW; this._drawH = drawH;
            const _bix = Math.floor(-drawW / 2), _biy = Math.floor(-drawH / 2);
            if (useIntroPixel || useDeathPixel) {
                const smallW = Math.max(4, Math.floor(drawW / pixelScale)); const smallH = Math.max(4, Math.floor(drawH / pixelScale));
                if (!this._pixBuf || this._pixBuf.width !== smallW || this._pixBuf.height !== smallH) { this._pixBuf = document.createElement('canvas'); this._pixBuf.width = smallW; this._pixBuf.height = smallH; }
                const buf = this._pixBuf.getContext('2d'); buf.drawImage(bossImg, 0, 0, iw, ih, 0, 0, smallW, smallH);
                if (!useDeathPixel) { buf.globalCompositeOperation = 'multiply'; buf.globalAlpha = 0.35; buf.fillStyle = this.color; buf.fillRect(0, 0, smallW, smallH); buf.globalAlpha = 1; buf.globalCompositeOperation = 'source-over'; }
                c.imageSmoothingEnabled = false; c.drawImage(this._pixBuf, 0, 0, smallW, smallH, _bix, _biy, drawW, drawH); c.imageSmoothingEnabled = true;
            } else {
                c.drawImage(bossImg, 0, 0, iw, ih, _bix, _biy, drawW, drawH);
            }
            if (!useIntroPixel && !useDeathPixel) {
                if (this.hitFlash > 0) {
                    c.globalCompositeOperation = 'source-over';
                    c.globalAlpha = 0.5; c.fillStyle = '#ffffff'; c.fillRect(_bix, _biy, drawW, drawH); c.globalAlpha = 1;
                } else {
                    c.globalCompositeOperation = 'multiply';
                    c.globalAlpha = 0.35; c.fillStyle = this.color; c.fillRect(_bix, _biy, drawW, drawH); c.globalAlpha = 1;
                    c.globalCompositeOperation = 'source-over';
                }
            }
        } else {
            const fallbackSize = 32 * sc * deathScale * BOSS_SIZE_SCALE;
            this._drawW = fallbackSize * 2; this._drawH = fallbackSize * 2;
            c.scale(sc * deathScale * BOSS_SIZE_SCALE, sc * deathScale * BOSS_SIZE_SCALE);
            const cl = this.hitFlash > 0 ? "#fff" : this.color; c.fillStyle = cl; c.strokeStyle = cl; c.lineWidth = 1; const wb = Math.sin(t * 0.08 + f) * 2;
            c.beginPath(); c.ellipse(0, wb, 16, 12, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.beginPath(); c.moveTo(-12, -12); c.lineTo(0, -24 + f * 2); c.lineTo(12, -12); c.closePath(); c.fill();
            const ca = 0.4 + Math.sin(t * 0.1) * 0.3; c.save(); c.globalAlpha = ca; c.fillStyle = "#fff"; c.beginPath(); c.arc(0, 0, 5 + Math.sin(t * 0.15) * 2, 0, Math.PI * 2); c.fill(); c.restore();
            c.fillStyle = "#ff0000"; c.beginPath(); c.arc(-6, -8, 3, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(6, -8, 3, 0, Math.PI * 2); c.fill();
            c.strokeStyle = cl; c.lineWidth = 1.5; for (let i = 0; i < 6; i++) { const angle = (i / 6) * Math.PI * 0.8 + Math.PI * 0.1, len = 14 + Math.sin(t * 0.06 + i) * 4, tx2 = Math.cos(angle + Math.PI / 2) * len, ty2 = 12 + Math.sin(angle) * len * 0.5 + Math.sin(t * 0.08 + i * 2) * 3; c.beginPath(); c.moveTo(i < 3 ? -8 : 8, 8); c.quadraticCurveTo(tx2 * 0.5, ty2 * 0.8, tx2, ty2); c.stroke(); }
        }
        c.restore();
        if (this.arrived) {
            /* ボスHP: 画面上部中央に配置（左=カラスゲージ、右=スコアと干渉しない幅280px） */
            const bw = 280, bx = CFG.W / 2 - bw / 2;
            /* ボス名 */
            c.fillStyle = this.color; c.font = "bold 13px serif"; c.textAlign = "center";
            if (!ns()) { c.shadowColor = this.color; c.shadowBlur = 8; }
            c.fillText(this.name, CFG.W / 2, 12);
            c.shadowBlur = 0;
            /* HP バー背景 */
            c.fillStyle = "rgba(0,0,0,0.65)"; c.fillRect(bx - 2, 14, bw + 4, 14);
            c.fillStyle = "#330000"; c.fillRect(bx, 15, bw, 12);
            /* HP バー本体 */
            const ratio = clamp(this.hp / this.maxHp, 0, 1);
            c.fillStyle = this.color; c.fillRect(bx, 15, bw * ratio, 12);
            /* HP % 表示 */
            c.fillStyle = "rgba(255,255,255,0.75)"; c.font = "10px serif";
            c.fillText(Math.ceil(ratio * 100) + '%', CFG.W / 2, 24);
            c.textAlign = "left";
        }
    }
    get cx() { return this.x; }
    get cy() { return this.y; }
}

global.CrowDestiny = global.CrowDestiny || {};
global.CrowDestiny.Boss = Boss;

})(typeof window !== 'undefined' ? window : this);
