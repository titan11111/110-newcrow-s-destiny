/**
 * CROW'S DESTINY — enemy2 ガーゴイル（守護者の残滓）CHARGE / ZIGZAG
 */
(function (global) {
'use strict';

const CFG = global.CrowDestiny.CFG;
const clamp = global.CrowDestiny.clamp;
const ri = global.CrowDestiny.ri;
const rr = global.CrowDestiny.rr;

function updateGargoyle(e, px, py, bullets, scrollSpd, fx) {
    const bt = e.behaviorType || 'CHARGE';
    const smin = e.sd.enemyShootMin || 60;
    const smax = e.sd.enemyShootMax || 130;
    let vx = -1.5, sinAmp = 8;
    if (bt === 'CHARGE') {
        const emergeRatio = Math.min(1, e.timer / 20);
        const stoneEase = Math.pow(emergeRatio, 3);
        vx = -0.3 - stoneEase * 2.2;
        sinAmp = 6;
        if (e.timer % 40 === 0) e.gargoyleJumpT = 8;
        if ((e.gargoyleJumpT || 0) > 0) {
            e.gargoyleJumpT--;
            const jumpPhase = 1 - e.gargoyleJumpT / 8;
            e.y = e.baseY - Math.sin(jumpPhase * Math.PI) * 18;
            if (e.gargoyleJumpT === 1 && fx) fx.shake = Math.max(fx.shake || 0, 4);
        } else {
            e.y = clamp(e.baseY + Math.sin(e.timer * 0.04) * sinAmp, CFG.MARGIN, CFG.H - e.h - CFG.MARGIN);
        }
    } else {
        vx = -1.4;
        const zigDir = Math.floor(e.timer / 28) % 2 === 0 ? 1 : -1;
        const t = e.timer % 28;
        const dist = (Math.min(t, 4) * 3.5 + Math.max(0, t - 4) * 1.2);
        e.y = clamp(e.baseY + zigDir * dist, CFG.MARGIN, CFG.H - e.h - CFG.MARGIN);
    }
    e.x += vx;
    e.x -= scrollSpd;
    e.shootCD--;
    if (e.shootCD <= 0) {
        const fired = shootGargoyle(e, px, py, bullets);
        if (fired) e.shootCD = ri(smin, smax);
    }
}

function shootGargoyle(e, px, py, bullets) {
    if (!e.gargoyleWindupT) {
        e.gargoyleWindupT = 18;
        e.useAttackRow = true;
        return false;
    }
    e.gargoyleWindupT--;
    if (e.gargoyleWindupT > 0) return false;
    e.useAttackRow = false;
    e.gargoyleWindupT = null;
    const dx = px - e.x, dy = py - e.y, d = Math.hypot(dx, dy) || 1, spd = e.bulletSpd;
    bullets.push({ x: e.x, y: e.y, vx: dx / d * spd, vy: dy / d * spd, active: true, color: '#5544bb', r: 6 });
    e.anim.set('ATTACK');
    return true;
}

global.CrowDestiny.EnemyBehaviors = global.CrowDestiny.EnemyBehaviors || {};
global.CrowDestiny.EnemyBehaviors.updateGargoyle = updateGargoyle;
global.CrowDestiny.EnemyBehaviors.shootGargoyle = shootGargoyle;

})(typeof window !== 'undefined' ? window : this);
