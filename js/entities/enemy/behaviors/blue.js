/**
 * CROW'S DESTINY — 蒼穢（青敵）の移動・射撃
 */
(function (global) {
'use strict';

const CFG = global.CrowDestiny.CFG;
const ri = global.CrowDestiny.ri;
const rr = global.CrowDestiny.rr;
const BLUE_MOVE_PATTERNS = global.CrowDestiny.EnemyConfig.BLUE_MOVE_PATTERNS;

function updateBlue(e, px, py, bullets, scrollSpd) {
    const pt = BLUE_MOVE_PATTERNS[e.blueMoveType ?? 0] || 'STRAIGHT';
    const smin = e.sd.enemyShootMin || 50;
    const smax = e.sd.enemyShootMax || 100;
    let vx = -1.8, vy = 0, sinAmp = 0, sinFreq = 0.04;
    switch (pt) {
        case 'STRAIGHT': vx = -2.0; break;
        case 'SINE': vx = -1.8; sinAmp = 22; sinFreq = 0.05; break;
        case 'DIAG_DOWN': vx = -1.9; vy = 0.8; break;
        case 'DIAG_UP': vx = -1.9; vy = -0.8; break;
        case 'ZIGZAG': vx = -1.6; sinAmp = 38; sinFreq = 0.08; break;
        case 'ACCEL': vx = -1.2 - Math.min(1.2, e.timer / 45); break;
        case 'PAUSE_RUSH': vx = e.timer < 25 ? -0.3 : -2.8; break;
        case 'WAVE': vx = -1.7; sinAmp = 45; sinFreq = 0.04; break;
        case 'TRACK':
            vx = -1.6;
            e.baseY = e.baseY + (py - (e.y + e.h / 2)) * 0.012;
            e.baseY = Math.max(CFG.MARGIN, Math.min(CFG.H - e.h - CFG.MARGIN, e.baseY));
            e.y = e.baseY;
            break;
        case 'SCATTER_MOVE':
            vx = -1.5 + Math.sin(e.timer * 0.15) * 0.4;
            e.y = e.baseY + Math.sin(e.timer * 0.07) * 28 + Math.sin(e.timer * 0.12) * 14;
            break;
        default: break;
    }
    e.vx = vx;
    e.x += e.vx;
    if (vy !== 0) e.y += vy;
    if (sinAmp !== 0 && pt !== 'TRACK' && pt !== 'SCATTER_MOVE') e.y = e.baseY + Math.sin(e.timer * sinFreq) * sinAmp;
    e.x -= scrollSpd;
    e.shootCD--;
    if (e.shootCD <= 0) {
        e.shootCD = ri(smin, smax);
        e.anim.set('ATTACK');
        const dx = px - e.x, dy = py - e.y, d = Math.hypot(dx, dy) || 1, spd = e.bulletSpd;
        bullets.push({ x: e.x, y: e.y, vx: dx / d * spd, vy: dy / d * spd, active: true, color: e.color, r: 4 });
        if ((e.sd.id || 1) >= 5) {
            const ang = Math.atan2(dy, dx) + rr(-0.2, 0.2);
            bullets.push({ x: e.x, y: e.y, vx: Math.cos(ang) * spd * 0.9, vy: Math.sin(ang) * spd * 0.9, active: true, color: e.color, r: 3 });
        }
    }
}

global.CrowDestiny.EnemyBehaviors = global.CrowDestiny.EnemyBehaviors || {};
global.CrowDestiny.EnemyBehaviors.updateBlue = updateBlue;

})(typeof window !== 'undefined' ? window : this);
