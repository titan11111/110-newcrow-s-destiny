/**
 * CROW'S DESTINY — enemy6 成獣（ヴォイドビースト）STOMP / LASER
 */
(function (global) {
'use strict';

const ri = global.CrowDestiny.ri;
const rr = global.CrowDestiny.rr;

function updateBeast(e, px, py, bullets, scrollSpd, fx, d) {
    if (d == null) d = 1;
    const bt = e.behaviorType || 'STOMP';
    const smin = e.sd.enemyShootMin || 60;
    const smax = e.sd.enemyShootMax || 130;
    let vx = -1.5, sinAmp = 8;
    if (bt === 'STOMP') {
        const cycle = e.timer % 70;
        if (cycle < 35) {
            vx = -2.2;
            e.stompFrame = Math.floor(e.timer / 6) % 2;
            e.y = e.baseY + Math.sin(e.timer * 0.04) * sinAmp;
        } else if (cycle < 45) {
            vx = 0;
            const stompPhase = (cycle - 35) / 10;
            e.y = e.baseY + Math.sin(stompPhase * Math.PI * 2) * 12;
            e.stompFrame = 2;
            if (cycle === 39 && fx) fx.shake = Math.max(fx.shake || 0, 5);
        } else {
            vx = -0.4;
            sinAmp = 5;
            e.stompFrame = 0;
            e.y = e.baseY + Math.sin(e.timer * 0.04) * sinAmp;
        }
    } else {
        if (!e.territoryY) e.territoryY = e.baseY;
        const deviation = e.y - e.territoryY;
        if (Math.abs(deviation) > 15) e.y -= deviation * 0.15;
        e.y = e.territoryY + Math.sin(e.timer * 0.04) * 6;
        e.stompFrame = 0;
    }
    e.x += vx * d;
    e.x -= scrollSpd * d;
    e.shootCD -= d;
    if (e.shootCD <= 0) {
        const fired = shootBeast(e, px, py, bullets, d);
        if (fired) e.shootCD = ri(smin, smax);
    }
}

function shootBeast(e, px, py, bullets, delta) {
    if (!e.beastChargeT) {
        e.beastChargeT = 12;
        e.stompFrame = 2;
        return false;
    }
    const dt = delta != null ? delta : 1;
    e.beastChargeT -= dt;
    if (e.beastChargeT > 0) return false;
    e.beastChargeT = null;
    e.stompFrame = 3;
    const dx = px - e.x, dy = py - e.y, hyp = Math.hypot(dx, dy) || 1;
    if (e.behaviorType === 'STOMP') {
        let tx = px, ty = py;
        if (e.usePrediction && e.posHistory.length >= 30) {
            const p0 = e.posHistory[e.posHistory.length - 1], p1 = e.posHistory[e.posHistory.length - 2], p2 = e.posHistory[e.posHistory.length - 3];
            tx = (p0.x + p1.x + p2.x) / 3;
            ty = (p0.y + p1.y + p2.y) / 3;
        }
        const tdx = tx - e.x, tdy = ty - e.y, td = Math.hypot(tdx, tdy) || 1;
        bullets.push({
            x: e.x, y: e.y, vx: tdx / td * e.bulletSpd, vy: tdy / td * e.bulletSpd,
            active: true, color: '#8844ff', r: 7, accel: 1.05, accelMax: e.bulletSpd * 1.8
        });
    } else {
        bullets.push({
            x: e.x, y: e.y, vx: -e.bulletSpd * 1.2, vy: 0,
            active: true, color: '#6622ff', r: 5
        });
    }
    e.anim.set('ATTACK');
    return true;
}

global.CrowDestiny.EnemyBehaviors = global.CrowDestiny.EnemyBehaviors || {};
global.CrowDestiny.EnemyBehaviors.updateBeast = updateBeast;
global.CrowDestiny.EnemyBehaviors.shootBeast = shootBeast;

})(typeof window !== 'undefined' ? window : this);
