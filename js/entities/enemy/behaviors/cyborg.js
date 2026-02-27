/**
 * CROW'S DESTINY — enemy5 魔導士（アイスサイボーグ）DIVE / SCATTER
 */
(function (global) {
'use strict';

const CFG = global.CrowDestiny.CFG;
const ri = global.CrowDestiny.ri;
const rr = global.CrowDestiny.rr;

function updateCyborg(e, px, py, bullets, scrollSpd) {
    const bt = e.behaviorType || 'DIVE';
    const smin = e.sd.enemyShootMin || 60;
    const smax = e.sd.enemyShootMax || 130;
    let vx = -1.6, sinAmp = 20;
    if (bt === 'DIVE') {
        if (!e.divePhase) e.divePhase = 'walk';
        if (e.divePhase === 'walk') {
            vx = -1.6;
            e.baseY += Math.sin(e.timer * 0.02) * 0.8;
            e.y = e.baseY + Math.sin(e.timer * 0.04) * sinAmp;
            if (e.timer % 35 === 0) { e.divePhase = 'error'; e.errorT = 8; }
        } else if (e.divePhase === 'error') {
            e.errorT--;
            vx = 0;
            e.x += rr(-2, 2);
            e.y += rr(-2, 2);
            if (e.errorT <= 0) {
                e.divePhase = 'dive';
                e.diveTargetY = e.y + rr(40, 80);
                e.diveT = 15;
            }
        } else {
            e.diveT--;
            vx = -2.8;
            e.y += (e.diveTargetY - e.y) * 0.25;
            if (e.diveT <= 0) { e.baseY = e.y; e.divePhase = 'walk'; }
        }
    } else {
        vx = -1.4; sinAmp = 28;
        if (e.timer % 12 === 0) e.freezeT = 2;
        if ((e.freezeT || 0) > 0) {
            e.freezeT--;
            vx = 0;
            e.showError = true;
        } else e.showError = false;
        e.y = e.baseY + Math.sin(e.timer * 0.04) * sinAmp;
    }
    e.x += vx;
    e.x -= scrollSpd;
    e.shootCD--;
    if (e.shootCD <= 0) {
        const fired = shootCyborg(e, px, py, bullets);
        if (fired) e.shootCD = ri(smin, smax);
    }
}

function shootCyborg(e, px, py, bullets) {
    const isError = Math.random() < 0.1;
    let tx = px, ty = py;
    if (!isError && e.usePrediction && e.posHistory.length >= 30) {
        const p0 = e.posHistory[e.posHistory.length - 1], p1 = e.posHistory[e.posHistory.length - 2], p2 = e.posHistory[e.posHistory.length - 3];
        tx = (p0.x + p1.x + p2.x) / 3;
        ty = (p0.y + p1.y + p2.y) / 3;
    } else if (isError) {
        tx = e.x + rr(-CFG.W * 0.4, CFG.W * 0.4);
        ty = rr(CFG.MARGIN, CFG.H - CFG.MARGIN);
        e.showError = true;
        e.freezeT = 4;
    }
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1, spd = e.bulletSpd;
    if (e.behaviorType === 'SCATTER') {
        for (let i = -1; i <= 1; i++) {
            const ang = Math.atan2(dy, dx) + i * 0.25;
            bullets.push({ x: e.x, y: e.y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, active: true, color: '#44aaff', r: 4 });
        }
    } else {
        bullets.push({ x: e.x, y: e.y, vx: dx / d * spd, vy: dy / d * spd, active: true, color: '#44aaff', r: 5 });
    }
    e.anim.set('ATTACK');
    return true;
}

global.CrowDestiny.EnemyBehaviors = global.CrowDestiny.EnemyBehaviors || {};
global.CrowDestiny.EnemyBehaviors.updateCyborg = updateCyborg;
global.CrowDestiny.EnemyBehaviors.shootCyborg = shootCyborg;

})(typeof window !== 'undefined' ? window : this);
