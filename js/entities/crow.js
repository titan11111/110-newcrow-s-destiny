/**
 * CROW'S DESTINY — プレイヤー（カラス）
 */
(function (global) {
'use strict';

const CFG = global.CrowDestiny.CFG;
const IMG = global.CrowDestiny.IMG;
const Anim = global.CrowDestiny.Anim;
const clamp = global.CrowDestiny.clamp;

class Crow {
    constructor(soundManager = null) {
        this.soundManager = soundManager;
        this.x = 120; this.y = CFG.H / 2 - 4; this.vx = 0; this.vy = 0;
        this.w = 9; this.h = 8; this.hp = 100; this.maxHp = 100; this.inv = 0; this.facing = 1;
        this.weaponLevel = 1; this.barrier = 0;
        /** ダッシュ: チャージ数（最大2）、1チャージ回復までの残りフレーム */
        this.dashCharges = CFG.DASH_CHARGES ?? 2;
        this.dashChargeCD = 0;
        this.dashing = false; this.dashT = 0;
        this.anim = new Anim({ FLY: { frames: 4, loop: true, speed: 1 }, DASH: { frames: 4, loop: false, speed: 2 }, HIT: { frames: 4, loop: false, speed: 1 }, KO: { frames: 4, loop: false, speed: 0.5 } });
        this.shootT = 0; this.feathers = [];
        /** ボス3 GLITCH FIELD 用: 照準オフセット（ラジアン、±でランダムにずれる） */
        this.aimOffset = 0;
        /** ダッシュ後の軌跡（約1秒＝60フレームでフェードアウト） */
        this.dashTrail = [];
        this.DASH_TRAIL_LIFE = 60;
        /** ボス撃破で解放した能力（idx 0〜6）。クールダウンは能力ごと */
        this.unlockedBossAbilities = [false, false, false, false, false, false, false];
        this.bossAbilityCD = [0, 0, 0, 0, 0, 0, 0];
        /** スキルボタンで切り替える「現在選択中のスキル」の番号（取得済みスキル内で 0, 1, 2, …） */
        this.currentSkillSlotIndex = 0;
        /** 分身カラス（灰スキル）の残りフレーム。15秒＝900 */
        this.cloneCrowT = 0;
        /** 分身位置履歴（0.3秒＝18フレーム遅延用） */
        this.posHistory = [];
        /** 分身カラスの描画・射撃用の遅延位置 */
        this.cloneX = 0; this.cloneY = 0;
    }
    update(keys, dt, opts) {
        if (dt == null || dt <= 0) dt = 1;
        const canShoot = !opts || opts.canShoot !== false;
        const noClampRight = opts && opts.noClampRight === true;
        if (this.anim.state === 'KO') return;
        if (this.anim.state === 'HIT' && !this.anim.done) { this.anim.update(dt); return; }
        let mx = 0, my = 0;
        if (keys['JoystickX'] !== undefined && keys['JoystickY'] !== undefined) {
            mx = keys['JoystickX'];
            my = keys['JoystickY'];
        } else {
            if (keys['ArrowLeft'] || keys['KeyA'] || keys['TouchLeft']) mx = -1;
            if (keys['ArrowRight'] || keys['KeyD'] || keys['TouchRight']) mx = 1;
            if (keys['ArrowUp'] || keys['KeyW'] || keys['TouchUp']) my = -1;
            if (keys['ArrowDown'] || keys['KeyS'] || keys['TouchDown']) my = 1;
        }
        /* WEBプレイ: スペース / Shift / X でダッシュ。2チャージで連続ダッシュ可能 */
        const maxCharges = CFG.DASH_CHARGES ?? 2;
        const chargeCD = CFG.DASH_CHARGE_CD ?? 26;
        if ((keys['Space'] || keys['ShiftLeft'] || keys['ShiftRight'] || keys['KeyX'] || keys['TouchDash']) && this.dashCharges > 0 && !this.dashing) {
            this.dashing = true; this.dashT = 12; this.dashCharges--; this.anim.set('DASH'); this.inv = Math.max(this.inv, 12);
            if (this.dashChargeCD <= 0) this.dashChargeCD = chargeCD;
            if (this.soundManager && this.soundManager.playDash) this.soundManager.playDash();
        }
        if (this.dashing) {
            this.dashT -= dt;
            this.vx = this.facing * CFG.DASH_SPD; this.vy = my * CFG.DASH_SPD * 0.5;
            this.dashTrail.push({ x: this.x + this.w / 2, y: this.y + this.h / 2, life: this.DASH_TRAIL_LIFE, vx: this.vx, vy: this.vy });
            if (this.dashT <= 0) this.dashing = false;
        } else {
            /* iOS向けスムーズ移動: ジョイスティック入力時はlerpで補間（慣性感をなくしつつカクつきを抑制）
               キー入力時は即座に反映（レスポンス重視） */
            const targetVx = mx * CFG.PLAYER_SPD;
            const targetVy = my * CFG.PLAYER_SPD;
            const isJoystick = keys['JoystickX'] !== undefined;
            if (isJoystick) {
                /* 0.82: ほぼ即応しつつフレーム間のカクつきだけ抑制 */
                const lerpF = 0.82;
                this.vx = this.vx + (targetVx - this.vx) * lerpF;
                this.vy = this.vy + (targetVy - this.vy) * lerpF;
            } else {
                this.vx = targetVx;
                this.vy = targetVy;
            }
        }
        this.dashTrail.forEach(p => { if (p && typeof p.life === 'number') p.life -= dt; });
        const removeInactive = global.CrowDestiny.removeInactive;
        if (removeInactive) removeInactive(this.dashTrail, p => p && typeof p.life === 'number' && p.life > 0);
        else this.dashTrail = this.dashTrail.filter(p => p && typeof p.life === 'number' && p.life > 0);
        if (this.dashCharges < maxCharges) {
            if (this.dashChargeCD > 0) { this.dashChargeCD -= dt; if (this.dashChargeCD <= 0) { this.dashCharges++; if (this.dashCharges < maxCharges) this.dashChargeCD = chargeCD; } }
        }
        for (let i = 0; i < 7; i++) if (this.bossAbilityCD[i] > 0) this.bossAbilityCD[i] -= dt;
        if (this.cloneCrowT > 0) {
            this.cloneCrowT -= dt;
            /* 位置履歴を蓄積（最大20フレーム保持） */
            this.posHistory.push({ x: this.x, y: this.y });
            if (this.posHistory.length > 20) this.posHistory.shift();
            /* 18フレーム（0.3秒）前の位置を取得 */
            const delayedPos = this.posHistory.length >= 18
                ? this.posHistory[this.posHistory.length - 18]
                : this.posHistory[0];
            /* カラス一個分（40px）右にオフセットして遅延位置を確定 */
            this.cloneX = delayedPos.x + 40;
            this.cloneY = delayedPos.y;
        } else {
            this.posHistory = [];
        }
        /* 左右どちらの入力でも向きは変えない（常に右向き） */
        this.x += this.vx * dt; this.y += this.vy * dt;
        if (noClampRight) {
            this.x = Math.max(CFG.MARGIN, this.x);
            this.y = clamp(this.y, CFG.MARGIN, CFG.H - this.h - CFG.MARGIN);
        } else {
            this.x = clamp(this.x, CFG.MARGIN, CFG.W - this.w - CFG.MARGIN);
            this.y = clamp(this.y, CFG.MARGIN, CFG.H - this.h - CFG.MARGIN);
        }
        if (this.inv > 0) this.inv -= dt; if (this.barrier > 0) this.barrier -= dt;
        if (!this.dashing) this.anim.set('FLY');
        this.anim.update(dt);
        if (canShoot) {
            this.shootT += dt;
            const intv = Math.max(4, 14 - this.weaponLevel * 2);
            if (this.shootT >= intv) {
                this.shootT = 0;
                this.shoot();
                /* 分身カラス（灰スキル）: 本体と同タイミングで自動射撃 */
                if (this.cloneCrowT > 0) this._cloneShoot();
                if (this.soundManager && this.soundManager.playShoot) this.soundManager.playShoot();
            }
        }
        /* HP30%以下は赤ビーム攻撃（回復で通常に戻る） */
        if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + 0.005);
    }
    _cloneShoot() {
        /* 分身カラスの射撃: 遅延位置（0.3秒前）から発射。weaponLevelに応じて弾数増加 */
        const cx = this.cloneX + this.w / 2 + this.facing * 11;
        const cy = this.cloneY + this.h / 2 - 3;
        const lvl = Math.min(this.weaponLevel, 3);
        for (let i = 0; i < lvl; i++) {
            const spread = (i - (lvl - 1) / 2) * 0.18;
            this.feathers.push({
                x: cx, y: cy + i * 3 - (lvl - 1) / 2 * 3,
                vx: this.facing * 13, vy: spread * 2.5,
                active: true, life: 0, isCloneShot: true
            });
        }
    }
    shoot() {
        const lowHp = this.hp <= this.maxHp * 0.3;
        if (lowHp) {
            const cx = this.x + this.w / 2 + this.facing * 12; const cy = this.y + this.h / 2 - 3;
            this.feathers.push({ x: cx, y: cy, vx: this.facing * 18, vy: 0, active: true, life: 0, isBeam: true });
        } else {
            const lvl = Math.min(this.weaponLevel, 5);
            for (let i = 0; i < lvl; i++) {
                const spread = (i - (lvl - 1) / 2) * 0.18;
                this.feathers.push({ x: this.x + this.w / 2 + this.facing * 12, y: this.y + this.h / 2 - 3 + i * 3 - (lvl - 1) / 2 * 3, vx: this.facing * 14, vy: spread * 2.8, active: true, life: 0 });
            }
            if (this.aimOffset) {
                const off = (Math.random() - 0.5) * 2 * this.aimOffset;
                for (let i = this.feathers.length - lvl; i < this.feathers.length; i++) {
                    const f = this.feathers[i];
                    const a = Math.atan2(f.vy, f.vx) + off;
                    const s = Math.hypot(f.vx, f.vy);
                    f.vx = Math.cos(a) * s; f.vy = Math.sin(a) * s;
                }
            }
            // Lv.6: ギャラクシー砲（手前に光る球＋一直線レーザー・浄化の青いほむら）
            if (this.weaponLevel >= 6) {
                const cx = this.x + this.w / 2 + this.facing * 12;
                const cy = this.y + this.h / 2 - 3;
                this.feathers.push({ x: cx, y: cy, vx: this.facing * 20, vy: 0, active: true, life: 0, isGalaxy: true });
            }
        }
    }
    takeDamage(amt, fx) {
        if (this.inv > 0) return false;
        if (this.barrier > 0) {
            this.barrierHits = (this.barrierHits || 3) - 1;
            fx.burst(this.cx, this.cy, "#aaeeff", this.barrierHits > 0 ? 12 : 22, 5);
            if (this.barrierHits <= 0) { this.barrier = 0; this.barrierHits = 0; }
            this.inv = 20; return false;
        }
        this.hp -= amt; this.inv = 90; this.anim.set('HIT'); if (this.soundManager && this.soundManager.playHit) this.soundManager.playHit(); fx.burst(this.cx, this.cy, "#ff3333", 18, 5); fx.shake = 10;
        if (this.hp <= 0) { this.anim.set('KO'); return true; }
        return false;
    }
    drawTrail(c) {
        if (this.dashTrail.length === 0) return;
        const maxLife = this.DASH_TRAIL_LIFE;
        for (let i = 0; i < this.dashTrail.length; i++) {
            const p = this.dashTrail[i];
            const a = p.life / maxLife;
            const vx = p.vx != null ? p.vx : 14;
            const vy = p.vy != null ? p.vy : 0;
            const angle = Math.atan2(vy, vx);
            const len = 12 + (1 - a) * 8;
            c.save();
            c.translate(p.x, p.y);
            c.rotate(angle);
            /* 後方に伸びる炎/水流のストリーク（青白・ムテキ） */
            const g = c.createLinearGradient(-len, 0, len, 0);
            g.addColorStop(0, `rgba(100,200,255,${a * 0.45})`);
            g.addColorStop(0.4, `rgba(60,160,255,${a * 0.35})`);
            g.addColorStop(0.8, `rgba(30,100,220,${a * 0.2})`);
            g.addColorStop(1, 'rgba(20,80,200,0)');
            c.fillStyle = g;
            c.beginPath();
            c.ellipse(0, 0, len, 6, 0, 0, Math.PI * 2);
            c.fill();
            /* コアの光（白に近い） */
            c.globalAlpha = a * 0.7;
            c.fillStyle = `rgba(200,230,255,${a})`;
            c.beginPath();
            c.ellipse(-len * 0.3, 0, len * 0.4, 3, 0, 0, Math.PI * 2);
            c.fill();
            c.restore();
            /* 残像の薄い楕円（従来の雰囲気も残す） */
            c.save();
            c.globalAlpha = a * 0.35;
            c.fillStyle = "#1a2a3a";
            c.beginPath();
            c.ellipse(p.x, p.y, 7, 5, angle, 0, Math.PI * 2);
            c.fill();
            c.restore();
        }
    }
    draw(c) {
        c.save();
        const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
        /* ダッシュ中: カラスが光る（青白のグロー＋輪郭） */
        if (this.dashing) {
            c.save();
            c.translate(cx, cy);
            const pulse = 0.6 + Math.sin(this.dashT * 0.8) * 0.2;
            c.globalAlpha = pulse * 0.5;
            c.strokeStyle = '#aaddff';
            c.lineWidth = 3;
            c.beginPath();
            c.arc(0, 0, 20, 0, Math.PI * 2);
            c.stroke();
            c.globalAlpha = pulse * 0.25;
            c.fillStyle = 'rgba(170,220,255,0.4)';
            c.fill();
            c.restore();
        }
        if (this.inv > 0 && this.inv % 4 > 1) c.globalAlpha = 0.35;
        c.translate(cx, cy); c.scale(this.facing / 3, 1 / 3);
        const f = this.anim.frame, s = this.anim.state;
        if (IMG.crowSheet) {
            const sh = IMG.crowSheet, sw = sh.naturalWidth || 128, shh = sh.naturalHeight || 96, cw = sw / 4, ch = shh / 4;
            const rowMap = { FLY: 2, DASH: 3, HIT: 2, KO: 3 }; const row = rowMap[s] !== undefined ? rowMap[s] : 2; const col = Math.min(f, 3);
            c.drawImage(sh, col * cw, row * ch, cw, ch, -cw / 2, -ch / 2, cw, ch);
        } else {
            const wingA = { FLY: [-0.5, -0.1, 0.3, 0.5], DASH: [0.5, 0.5, 0.4, 0.3], HIT: [-0.3, 0, 0.1, 0], KO: [0.6, 0.6, 0.6, 0.6] }; const wa = (wingA[s] || wingA['FLY'])[f];
            c.fillStyle = "#111"; c.strokeStyle = "#333"; c.lineWidth = 1.5;
            c.save(); c.rotate(-wa); c.beginPath(); c.moveTo(-2, -5); c.lineTo(-24, -16 + f * 2); c.lineTo(-19, -9); c.closePath(); c.fill(); c.stroke(); c.restore();
            c.save(); c.rotate(wa * 0.6); c.beginPath(); c.moveTo(-2, 5); c.lineTo(-22, 14 - f * 1.5); c.lineTo(-17, 8); c.closePath(); c.fill(); c.stroke(); c.restore();
            c.beginPath(); c.ellipse(0, 0, 13, 10, 0, 0, Math.PI * 2); c.fill(); c.stroke();
            c.beginPath(); c.ellipse(9, -5, 8, 7, 0.2, 0, Math.PI * 2); c.fill(); c.stroke();
            c.fillStyle = "#554422"; c.beginPath(); c.moveTo(15, -6); c.lineTo(22, -3); c.lineTo(15, -2); c.closePath(); c.fill();
            c.fillStyle = "#ff0000"; c.beginPath(); c.arc(12, -7, 2.5, 0, Math.PI * 2); c.fill(); c.fillStyle = "rgba(255,0,0,0.35)"; c.beginPath(); c.arc(12, -7, 5, 0, Math.PI * 2); c.fill();
            c.fillStyle = "#111"; const tOff = s === 'DASH' ? 8 : f * 1.5;
            c.beginPath(); c.moveTo(-11, 3); c.lineTo(-24 + tOff, 7); c.lineTo(-20 + tOff, 2); c.closePath(); c.fill();
            c.beginPath(); c.moveTo(-11, 5); c.lineTo(-26 + tOff, 11); c.lineTo(-22 + tOff, 6); c.closePath(); c.fill();
        }
        if (this.barrier > 0) {
            const hits = this.barrierHits || 3;
            const pulse = 0.18 + Math.sin(this.barrier * 0.15) * 0.1;
            /* 残ヒット数に応じた色: 3=青白 2=青 1=赤紫 */
            const bCol = hits >= 3 ? "#aaeeff" : hits === 2 ? "#44aaff" : "#ff88cc";
            c.globalAlpha = pulse + (hits >= 3 ? 0 : 0.06);
            c.strokeStyle = bCol; c.lineWidth = 2 + (3 - hits);
            c.shadowColor = bCol; c.shadowBlur = 8 + (3 - hits) * 4;
            c.beginPath(); c.arc(0, 0, 22, 0, Math.PI * 2); c.stroke();
            /* 残数を小さな点で表示 */
            for (let hi = 0; hi < hits; hi++) {
                const a = (Math.PI / 2) + hi * (Math.PI * 2 / 3);
                c.globalAlpha = 0.85; c.fillStyle = bCol;
                c.beginPath(); c.arc(Math.cos(a) * 24, Math.sin(a) * 24, 3, 0, Math.PI * 2); c.fill();
            }
        }
        c.restore();
    }
    drawFeathers(c) {
        for (let i = this.feathers.length - 1; i >= 0; i--) {
            const f = this.feathers[i];
            if (f.x < -30 || f.x > CFG.W + 30 || f.y < -30 || f.y > CFG.H + 30) f.active = false;
            if (!f.active) { this.feathers.splice(i, 1); continue; }
            if (f.isBeam || f.isPurpleSword) {
                c.save(); c.translate(f.x, f.y); c.rotate(Math.atan2(f.vy, f.vx));
                if (f.isPurpleSword) {
                    /* ===== 紫の誘導剣: ホーミングスキル専用描画 ===== */
                    const len = 52;
                    const pulse = 0.75 + Math.sin(f.life * 0.28) * 0.25;
                    /* 剣身（先端に向けて細くなる形状） */
                    c.shadowBlur = 20 * pulse;
                    c.shadowColor = '#cc44ff';
                    c.fillStyle = 'rgba(172, 68, 252, 0.93)';
                    c.beginPath();
                    c.moveTo(len, 0);           /* 剣先 */
                    c.lineTo(len * 0.2, -5);    /* 刃・上 */
                    c.lineTo(-len * 0.5, -3.5); /* 柄元・上 */
                    c.lineTo(-len * 0.5, 3.5);  /* 柄元・下 */
                    c.lineTo(len * 0.2, 5);     /* 刃・下 */
                    c.closePath();
                    c.fill();
                    /* 鍔（クロスガード） */
                    c.shadowBlur = 12;
                    c.fillStyle = 'rgba(215, 155, 255, 0.97)';
                    c.fillRect(-len * 0.48, -10, 9, 20);
                    /* 刃の中央輝きライン */
                    c.shadowBlur = 16;
                    c.strokeStyle = 'rgba(235, 190, 255, 0.88)';
                    c.lineWidth = 1.8;
                    c.beginPath();
                    c.moveTo(len * 0.85, 0);
                    c.lineTo(-len * 0.35, 0);
                    c.stroke();
                    /* 剣先の輝き点 */
                    c.shadowBlur = 24 * pulse;
                    c.fillStyle = 'rgba(245, 210, 255, 0.97)';
                    c.beginPath();
                    c.arc(len * 0.88, 0, 4, 0, Math.PI * 2);
                    c.fill();
                    c.shadowBlur = 0;
                } else if (f.isGreenArrow) {
                    /* ===== 感電ライトニングボルト ===== */
                    const len = 32;
                    const pulse = 0.6 + Math.sin(f.life * 0.6) * 0.4;
                    /* フレームごとにジグザグ形状をランダム変化（ちらつき） */
                    const flick = Math.floor(f.life / 2) % 2;
                    const jY = flick ? 1 : -1; /* ジグザグ方向反転 */
                    /* ジグザグ頂点セット */
                    const pts = [
                        [-len,       0],
                        [-len*0.62,  jY * 9],
                        [-len*0.25,  jY * -6],
                        [ len*0.12,  jY * 10],
                        [ len*0.48,  jY * -7],
                        [ len*0.75,  jY * 5],
                        [ len,       0]
                    ];
                    /* 外側グロー（太い・薄緑） */
                    c.shadowColor = '#00ff88';
                    c.shadowBlur = 30 * pulse;
                    c.strokeStyle = `rgba(0,255,120,0.35)`;
                    c.lineWidth = 8;
                    c.beginPath();
                    pts.forEach(([px,py], i) => i===0 ? c.moveTo(px,py) : c.lineTo(px,py));
                    c.stroke();
                    /* メインボルト（黄緑） */
                    c.shadowBlur = 18 * pulse;
                    c.shadowColor = '#88ffcc';
                    c.strokeStyle = `rgba(100,255,170,0.92)`;
                    c.lineWidth = 2.8;
                    c.beginPath();
                    pts.forEach(([px,py], i) => i===0 ? c.moveTo(px,py) : c.lineTo(px,py));
                    c.stroke();
                    /* コア（白） */
                    c.shadowBlur = 8;
                    c.shadowColor = '#ffffff';
                    c.strokeStyle = 'rgba(220,255,235,0.98)';
                    c.lineWidth = 1.2;
                    c.beginPath();
                    pts.forEach(([px,py], i) => i===0 ? c.moveTo(px,py) : c.lineTo(px,py));
                    c.stroke();
                    /* 分岐フォーク1（ランダム枝） */
                    c.shadowBlur = 14 * pulse;
                    c.shadowColor = '#00ff88';
                    c.strokeStyle = `rgba(80,255,150,${0.55 + pulse*0.2})`;
                    c.lineWidth = 1.5;
                    c.beginPath();
                    c.moveTo(-len*0.25, jY * -6);
                    c.lineTo(-len*0.05, jY * -20);
                    c.lineTo( len*0.15, jY * -14);
                    c.stroke();
                    /* 分岐フォーク2 */
                    c.beginPath();
                    c.moveTo(len*0.48, jY * -7);
                    c.lineTo(len*0.62, jY * -19);
                    c.stroke();
                    /* 先端輝き（白球） */
                    c.shadowBlur = 26 * pulse;
                    c.shadowColor = '#ffffff';
                    c.fillStyle = 'rgba(230,255,245,0.99)';
                    c.beginPath();
                    c.arc(len, 0, 4, 0, Math.PI * 2);
                    c.fill();
                    /* 後端グロー球 */
                    c.shadowBlur = 14;
                    c.shadowColor = '#00ff88';
                    c.fillStyle = 'rgba(0,255,130,0.75)';
                    c.beginPath();
                    c.arc(-len, 0, 2.8, 0, Math.PI * 2);
                    c.fill();
                    c.shadowBlur = 0;
                } else {
                    const col = f.color || '#ff2222';
                    c.strokeStyle = col;
                    if (f.color && f.color.length >= 7) {
                        const r = parseInt(f.color.slice(1, 3), 16), g = parseInt(f.color.slice(3, 5), 16), b = parseInt(f.color.slice(5, 7), 16);
                        c.fillStyle = `rgba(${r},${g},${b},0.85)`;
                    } else c.fillStyle = 'rgba(255,80,80,0.7)';
                    c.lineWidth = 2;
                    const len = 20;
                    c.beginPath(); c.moveTo(-len, 0); c.lineTo(len, 0); c.stroke();
                    c.fillRect(-len, -4, len * 2, 8);
                }
                c.restore();
            } else if (f.isCloneShot) {
                /* 分身弾: グレーの羽根型 */
                c.save();
                c.translate(f.x, f.y);
                c.rotate(Math.atan2(f.vy, f.vx));
                c.globalAlpha = 0.78;
                c.shadowBlur = 7;
                c.shadowColor = '#aaaaaa';
                c.fillStyle = '#bdc3c7';
                c.beginPath();
                c.moveTo(13, 0); c.lineTo(-7, -4); c.lineTo(-7, 4); c.closePath();
                c.fill();
                c.shadowBlur = 0;
                c.restore();
            } else if (f.isGalaxy) {
                // ギャラクシー砲: 手前に光る球＋一直線レーザー（青白・浄化の青いほむら）
                c.save();
                c.translate(f.x, f.y);
                c.rotate(Math.atan2(f.vy, f.vx));
                const beamLen = 90;
                const orbR = 14;
                c.globalAlpha = 0.95;
                c.strokeStyle = "#aaddff";
                c.fillStyle = "rgba(170,220,255,0.85)";
                c.lineWidth = 4;
                c.beginPath(); c.moveTo(-beamLen, 0); c.lineTo(0, 0); c.stroke();
                c.fillRect(-beamLen, -4, beamLen, 8);
                c.fillStyle = "rgba(204,238,255,0.95)";
                c.beginPath(); c.arc(0, 0, orbR, 0, Math.PI * 2); c.fill();
                c.strokeStyle = "#cceeff";
                c.lineWidth = 2;
                c.stroke();
                c.globalAlpha = 0.6 + Math.sin(f.life * 0.2) * 0.25;
                c.fillStyle = "rgba(255,255,255,0.8)";
                c.beginPath(); c.arc(0, 0, orbR * 0.6, 0, Math.PI * 2); c.fill();
                c.globalAlpha = 1;
                c.restore();
            } else {
                c.fillStyle = "#e0cda7";
                c.save(); c.translate(f.x, f.y); c.rotate(Math.atan2(f.vy, f.vx)); c.scale(0.55, 0.55); c.globalAlpha = 0.9;
                c.beginPath(); c.moveTo(12, 0); c.lineTo(-7, -4); c.lineTo(-7, 4); c.closePath(); c.fill(); c.restore();
            }
        }
    }
    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }
}

global.CrowDestiny = global.CrowDestiny || {};
global.CrowDestiny.Crow = Crow;

})(typeof window !== 'undefined' ? window : this);
