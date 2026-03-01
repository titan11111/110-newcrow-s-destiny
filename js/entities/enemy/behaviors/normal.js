/**
 * CROW'S DESTINY — 通常敵（スプライトなし／汎用）振る舞い
 */
(function (global) {
'use strict';

const CFG = global.CrowDestiny.CFG;
const ri = global.CrowDestiny.ri;
const rr = global.CrowDestiny.rr;

function updateNormal(e, px, py, bullets, scrollSpd, fx, d) {
    if (d == null) d = 1;
    const bt = e.behaviorType || 'CHARGE';
    const smin = e.sd.enemyShootMin || 60;
    const smax = e.sd.enemyShootMax || 130;
    const isStage1 = e.sd && e.sd.id === 1;

    if (isStage1 && e.emergeT > 0 && (bt === 'CHARGE' || bt === 'ZIGZAG')) {
        e.emergeT -= d;
        const total = bt === 'CHARGE' ? 42 : 28;
        const r = 1 - e.emergeT / total;
        if (bt === 'CHARGE') {
            const wobble = Math.sin(e.timer * 0.12) * 18 + Math.sin(e.timer * 0.07) * 10;
            e.y = e.baseY + wobble;
            e.vx = e.emergeT <= 0 ? -2.6 : (-0.15 - r * 0.5);
        } else {
            const wobble = Math.sin(e.timer * 0.1) * 28 + Math.sin(e.timer * 0.05) * 14;
            e.y = e.baseY + wobble;
            e.vx = -0.2 - r * 0.4;
        }
        e.x += e.vx * d;
        e.x -= scrollSpd * d;
        e.shootCD -= d;
        if (e.shootCD <= 0) {
            e.shootCD = ri(smin, smax);
            e.anim.set('ATTACK');
            const dx = px - e.x, dy = py - e.y, d = Math.hypot(dx, dy) || 1;
            bullets.push({ x: e.x, y: e.y, vx: dx / d * e.bulletSpd, vy: dy / d * e.bulletSpd, active: true, color: '#ff4d00', r: 4 });
        }
        return;
    }

    let vx = -1.5, sinAmp = 25, sinFreq = 0.04, vy = 0;
    switch (bt) {
        case 'CHARGE': vx = -2.5 - Math.random() * 0.5; sinAmp = 8; break;
        case 'ZIGZAG': vx = -1.2; sinAmp = 45; sinFreq = 0.07; break;
        case 'ORBIT': vx = -1.0; sinAmp = 35; sinFreq = 0.03; break;
        case 'SPIT': vx = -1.8; sinAmp = 18; break;
        case 'TELEPORT': vx = -2.0; sinAmp = 20; if (e.timer % 20 === 10) e.baseY = e.y; break;
        case 'MIRROR': vx = -1.5; sinAmp = 30; sinFreq = -0.04; break;
        case 'DIVE': vx = -1.6; sinAmp = 40; sinFreq = 0.05; e.baseY = (e.baseY || e.y) + Math.sin(e.timer * 0.02) * 0.8; break;
        case 'SCATTER': vx = -1.4; sinAmp = 28; break;
        case 'STOMP': vx = (e.timer % 60 < 35) ? -2.2 : -0.4; sinAmp = 12; break;
        case 'LASER': vx = -1.5; sinAmp = 15; break;
        case 'SWARM': vx = -1.2; sinAmp = 22; sinFreq = 0.06; break;
        case 'SHIELD': vx = -0.9; sinAmp = 18; break;
        case 'VOID': vx = -1.0; sinAmp = 10; sinFreq = 0.02; break;
        case 'PHASE': vx = -1.4; sinAmp = 32; sinFreq = 0.05 + Math.sin(e.timer * 0.01) * 0.02; break;
        default: break;
    }
    e.vx = vx;
    e.x += e.vx * d;
    e.y = e.baseY + Math.sin(e.timer * sinFreq) * sinAmp;
    e.x -= scrollSpd * d;
    e.shootCD -= d;
    if (e.shootCD <= 0) {
        e.anim.set('ATTACK');
        const spd = e.bulletSpd;
        let tx = px, ty = py;
        if (e.usePrediction && e.posHistory.length >= 30) {
            const p0 = e.posHistory[0], p1 = e.posHistory[1], p2 = e.posHistory[2];
            tx = (p0.x + p1.x + p2.x) / 3;
            ty = (p0.y + p1.y + p2.y) / 3;
        }
        const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
        if (bt === 'SCATTER') {
            for (let i = -1; i <= 1; i++) {
                const ang = Math.atan2(dy, dx) + i * 0.25;
                bullets.push({ x: e.x, y: e.y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, active: true, color: '#ff4d00', r: 3 });
            }
        } else {
            bullets.push({ x: e.x, y: e.y, vx: dx / d * spd, vy: dy / d * spd, active: true, color: '#ff4d00', r: 4 });
        }
        e.shootCD = (bt === 'SPIT') ? ri(Math.max(20, Math.floor(smin / 2)), Math.floor(smax * 0.6)) : ri(smin, smax);
    }
}

global.CrowDestiny.EnemyBehaviors = global.CrowDestiny.EnemyBehaviors || {};
global.CrowDestiny.EnemyBehaviors.updateNormal = updateNormal;

})(typeof window !== 'undefined' ? window : this);
