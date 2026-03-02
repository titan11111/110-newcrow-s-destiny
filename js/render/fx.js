/**
 * CROW'S DESTINY — パーティクル・テキスト・エフェクトオーバーレイ
 */
(function (global) {
'use strict';

const CFG = global.CrowDestiny.CFG;
const rr = global.CrowDestiny.rr;
const ri = global.CrowDestiny.ri;
const ObjectPool = global.CrowDestiny.ObjectPool;

class Particle {
    constructor(x, y, vx, vy, col, life, sz) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.col = col; this.life = life; this.ml = life;
        this.sz = sz || rr(3, 7); this.on = true;
    }
    update(d) {
        if (d == null) d = 1;
        this.x += this.vx * d; this.y += this.vy * d; this.vy += 0.015 * d;
        this.life -= d;
        if (this.life <= 0) this.on = false;
    }
    draw(c) {
        c.save();
        c.globalAlpha = this.life / this.ml;
        c.fillStyle = this.col;
        c.fillRect(this.x - this.sz / 2, this.y - this.sz / 2, this.sz, this.sz);
        c.restore();
    }
}

function createParticle() {
    return new Particle(0, 0, 0, 0, '#fff', 1, 3);
}
function resetParticle(p) {
    p.on = true;
    p.x = 0; p.y = 0; p.vx = 0; p.vy = 0;
    p.col = '#fff'; p.life = 1; p.ml = 1; p.sz = 3;
}

class FX {
    constructor(gameRef) {
        this.gameRef = gameRef || null;
        this.particlePool = new ObjectPool(createParticle, resetParticle, 80);
        this.p = this.particlePool.active;
        this.shake = 0;
        this.flash = 0;
        this.fCol = "#fff";
        /** ボス演出: 床ひび（反転時など） */
        this.floorCracks = [];
        /** 暗転フラッシュ（四隅が暗くなる・ミミックテレポート等） */
        this.arenaDarkCorners = 0;
        /** デブリ（外殻剥離・骨片等） */
        this.arenaDebris = [];
        /** 画面端凍結（ブルーコアピンチ） */
        this.arenaFreeze = 0;
    }
    burst(x, y, col, n = 15, spd = 4, life = 25) {
        const q = (this.gameRef && this.gameRef.qualityParticle != null) ? this.gameRef.qualityParticle : 1;
        n = Math.max(2, Math.floor(n * q));
        if (q < 0.5) n = Math.min(n, 20);
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = Math.random() * spd;
            const pt = this.particlePool.get();
            pt.x = x; pt.y = y; pt.vx = Math.cos(a) * s; pt.vy = Math.sin(a) * s;
            pt.col = col; pt.life = life + ri(0, 15); pt.ml = pt.life; pt.sz = rr(3, 7); pt.on = true;
        }
    }
    big(x, y, col) {
        this.burst(x, y, col, 50, 7, 40);
        this.shake = 25;
        this.flash = 12;
        this.fCol = col;
    }
    /** 床ひびエフェクトを追加（ボス反転時など） */
    addFloorCrack(x, y, duration = 40) {
        this.floorCracks.push({ x, y, t: duration, maxT: duration });
    }
    /** アリーナ用デブリ（横切る破片） */
    addArenaDebris(x, y, vx, vy, life, col, w = 8, h = 4) {
        this.arenaDebris.push({ x, y, vx, vy, life, maxL: life, col, w, h });
    }
    update(d) {
        if (d == null) d = 1;
        const removeInactive = global.CrowDestiny && global.CrowDestiny.removeInactive;
        let i = this.p.length - 1;
        while (i >= 0) {
            this.p[i].update(d);
            if (!this.p[i].on) {
                this.particlePool.release(this.p[i]);
            }
            /* release で swap+pop すると length が減る。末尾を release したときは i が配列外になるため必ず i を進める */
            i--;
        }
        if (this.shake > 0) this.shake *= Math.pow(0.9, d);
        if (this.flash > 0) this.flash -= d;
        this.floorCracks.forEach(f => { f.t -= d; });
        if (removeInactive) removeInactive(this.floorCracks, f => f.t > 0);
        else this.floorCracks = this.floorCracks.filter(f => f.t > 0);
        if (this.arenaDarkCorners > 0) this.arenaDarkCorners -= d;
        this.arenaDebris.forEach(o => { o.x += o.vx * d; o.y += o.vy * d; o.life -= d; });
        if (removeInactive) removeInactive(this.arenaDebris, o => o.life > 0);
        else this.arenaDebris = this.arenaDebris.filter(o => o.life > 0);
        if (this.arenaFreeze > 0) this.arenaFreeze -= d;
    }
    draw(c) { this.particlePool.active.forEach(p => p.draw(c)); }
    applyShake(c) {
        if (this.shake > 0.5) c.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }
    drawFlash(c) {
        if (this.flash > 0) {
            c.save();
            c.globalAlpha = this.flash / 15;
            c.fillStyle = this.fCol;
            c.fillRect(0, 0, CFG.W, CFG.H);
            c.restore();
        }
    }
    /** 床ひび・暗転・デブリ・凍結を描画（ゲーム側で呼ぶ） */
    drawArenaEffects(c) {
        const W = CFG.W, H = CFG.H;
        this.floorCracks.forEach(f => {
            c.save();
            c.globalAlpha = f.t / f.maxT * 0.6;
            c.strokeStyle = '#4a3728';
            c.lineWidth = 2;
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2 + f.t * 0.02;
                const len = 15 + (1 - f.t / f.maxT) * 25;
                c.beginPath();
                c.moveTo(f.x, f.y);
                c.lineTo(f.x + Math.cos(a) * len, f.y + Math.sin(a) * len);
                c.stroke();
            }
            c.restore();
        });
        if (this.arenaDarkCorners > 0) {
            c.save();
            const a = Math.min(1, this.arenaDarkCorners / 45) * 0.5;
            c.fillStyle = `rgba(0,0,0,${a})`;
            const corner = 80;
            c.beginPath();
            c.moveTo(0, 0); c.lineTo(corner, 0); c.lineTo(0, corner); c.closePath(); c.fill();
            c.beginPath();
            c.moveTo(W, 0); c.lineTo(W - corner, 0); c.lineTo(W, corner); c.closePath(); c.fill();
            c.beginPath();
            c.moveTo(0, H); c.lineTo(0, H - corner); c.lineTo(corner, H); c.closePath(); c.fill();
            c.beginPath();
            c.moveTo(W, H); c.lineTo(W, H - corner); c.lineTo(W - corner, H); c.closePath(); c.fill();
            c.restore();
        }
        this.arenaDebris.forEach(d => {
            c.save();
            c.globalAlpha = d.life / d.maxL;
            c.fillStyle = d.col;
            c.fillRect(d.x - d.w / 2, d.y - d.h / 2, d.w, d.h);
            c.restore();
        });
        if (this.arenaFreeze > 0) {
            c.save();
            c.globalAlpha = Math.min(1, this.arenaFreeze / 60) * 0.35;
            c.fillStyle = '#aaddff';
            c.fillRect(0, 0, W, 4);
            c.fillRect(0, H - 4, W, 4);
            c.fillRect(0, 0, 4, H);
            c.fillRect(W - 4, 0, 4, H);
            c.restore();
        }
    }
}

class TextOverlay {
    constructor() { this.m = []; }
    show(t, col, dur, sz, x, y) {
        this.m.push({ t, col: col || "#e0cda7", dur, md: dur, sz: sz || 28, x: x ?? CFG.W / 2, y: y || CFG.H / 2 });
    }
    update(d) {
        if (d == null) d = 1;
        for (let i = this.m.length - 1; i >= 0; i--) {
            this.m[i].dur -= d;
            if (this.m[i].dur <= 0) this.m.splice(i, 1);
        }
    }
    draw(c) {
        this.m.forEach(m => {
            const a = Math.min(1, m.dur / 30, (m.md - m.dur + 1) / 30);
            c.save();
            c.globalAlpha = a;
            c.fillStyle = m.col;
            c.font = `${m.sz}px serif`;
            c.textAlign = "center";
            c.fillText(m.t, m.x, m.y);
            c.restore();
        });
    }
}

class EffectOverlay {
    constructor() { this.fx = []; }
    add(type, col, dur) { this.fx.push({ type, col, dur, md: dur, t: 0 }); }
    update(d) {
        if (d == null) d = 1;
        for (let i = this.fx.length - 1; i >= 0; i--) {
            this.fx[i].t += d;
            if (this.fx[i].t >= this.fx[i].md) this.fx.splice(i, 1);
        }
    }
    draw(c, crow) {
        this.fx.forEach(e => {
            const p = e.t / e.md;
            const a = 1 - p;
            c.save();
            if (e.type === "HEAL") {
                c.globalAlpha = a * 0.7;
                for (let i = 0; i < 6; i++) {
                    const px = crow.cx + Math.sin(e.t * 0.12 + i * 1.05) * 55;
                    const py = crow.cy - e.t * 1.8 + i * 22;
                    c.fillStyle = "#44ff44";
                    c.fillRect(px - 2, py - 8, 4, 16); c.fillRect(px - 8, py - 2, 16, 4);
                }
                c.globalAlpha = a * 0.15; c.strokeStyle = "#44ff44"; c.lineWidth = 8;
                c.strokeRect(0, 0, CFG.W, CFG.H);
            } else if (e.type === "BARRIER") {
                const remain = e.md - e.t;
                const alpha = remain <= 20 ? (remain / 20) * 0.6 : 0.6;
                c.globalAlpha = alpha; c.strokeStyle = "#aaeeff"; c.lineWidth = 3;
                c.beginPath(); c.arc(crow.cx, crow.cy, 32, 0, Math.PI * 2); c.stroke();
                c.strokeStyle = "rgba(170,238,255,0.2)"; c.lineWidth = 10;
                c.beginPath(); c.arc(crow.cx, crow.cy, 38, 0, Math.PI * 2); c.stroke();
            } else if (e.type === "SLOW") {
                c.globalAlpha = a * 0.2; c.fillStyle = "#cc88ff"; c.fillRect(0, 0, CFG.W, CFG.H);
                c.globalAlpha = a * 0.8; c.translate(CFG.W / 2, CFG.H / 2); c.scale(2.5 - p * 1.5, 2.5 - p * 1.5);
                c.strokeStyle = "#cc88ff"; c.lineWidth = 3;
                c.beginPath(); c.moveTo(-12, -18); c.lineTo(12, -18); c.lineTo(0, 0);
                c.lineTo(12, 18); c.lineTo(-12, 18); c.lineTo(0, 0); c.closePath(); c.stroke();
            } else if (e.type === "BOMB") {
                const r = p * 450;
                c.globalAlpha = a * 0.5; c.strokeStyle = "#ff4400"; c.lineWidth = 8 * a;
                c.beginPath(); c.arc(crow.cx, crow.cy, r, 0, Math.PI * 2); c.stroke();
                c.globalAlpha = a * 0.08; c.fillStyle = "#ff4400";
                c.beginPath(); c.arc(crow.cx, crow.cy, r, 0, Math.PI * 2); c.fill();
            }
            c.restore();
        });
    }
}

global.CrowDestiny = global.CrowDestiny || {};
global.CrowDestiny.Particle = Particle;
global.CrowDestiny.FX = FX;
global.CrowDestiny.TextOverlay = TextOverlay;
global.CrowDestiny.EffectOverlay = EffectOverlay;

})(typeof window !== 'undefined' ? window : this);
