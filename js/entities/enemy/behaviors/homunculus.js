/**
 * CROW'S DESTINY — enemy4 ホムンクルス（Dark Noel）ORBIT / SPIT
 */
(function (global) {
'use strict';

const CFG = global.CrowDestiny.CFG;
const clamp = global.CrowDestiny.clamp;
const ri = global.CrowDestiny.ri;
const rr = global.CrowDestiny.rr;

function updateHomunculus(e, px, py, bullets, scrollSpd, d) {
    if (d == null) d = 1;
    const bt = e.behaviorType || 'ORBIT';
    const smin = e.sd.enemyShootMin || 60;
    const smax = e.sd.enemyShootMax || 130;
    let vx = bt === 'SPIT' ? -1.8 : -1.0, sinAmp = bt === 'SPIT' ? 18 : 35;
    /** 3面: 3体並んで大きな波のような動きで襲ってくる */
    if (e.formation === 'WAVE') {
        const waveAmp = 62;
        const waveFreq = 0.022;
        const phase = (e.groupPhase != null ? e.groupPhase : 0) * Math.PI * 2;
        e.y = (e.baseY != null ? e.baseY : e.y) + Math.sin(e.timer * waveFreq + phase) * waveAmp;
        e.y = clamp(e.y, CFG.MARGIN, CFG.H - e.h - CFG.MARGIN);
        vx = -1.4;
    } else if (bt === 'ORBIT') {
        const diffY = py - e.y;
        const trackStrength = Math.abs(diffY) > 80 ? 0.008 : 0;
        e.baseY += diffY * trackStrength;
        e.baseY = clamp(e.baseY, CFG.MARGIN, CFG.H - e.h - CFG.MARGIN);
        e.y = e.baseY + Math.sin(e.timer * 0.03) * 35 + Math.sin(e.timer * 0.07) * 8;
    } else {
        if ((e.spitRecoilT || 0) > 0) {
            e.spitRecoilT -= d;
            vx = -0.6;
        }
        e.y = e.baseY + Math.sin(e.timer * 0.04) * sinAmp;
    }
    e.x += vx * d;
    e.x -= scrollSpd * d;
    if ((e.haloGlowT || 0) > 0) e.haloGlowT -= d;
    e.shootCD -= d;
    if (e.shootCD <= 0) {
        const fired = shootHomunculus(e, px, py, bullets);
        if (fired) e.shootCD = bt === 'SPIT' ? ri(Math.max(20, Math.floor(smin / 2)), Math.floor(smax * 0.6)) : ri(smin, smax);
    }
}

function shootHomunculus(e, px, py, bullets) {
    e.haloGlow = true;
    e.haloGlowT = 8;
    const dx = px - e.x, dy = py - e.y, d = Math.hypot(dx, dy) || 1, spd = e.bulletSpd;
    bullets.push({
        x: e.x, y: e.y + 10, vx: dx / d * spd, vy: dy / d * spd,
        active: true, color: '#22ddff', r: 5, drag: 0.97
    });
    if (e.behaviorType === 'SPIT') {
        e.spitRecoilT = 30;
        const ang = Math.atan2(dy, dx) + rr(-0.15, 0.15);
        bullets.push({
            x: e.x, y: e.y + 10, vx: Math.cos(ang) * spd * 0.85, vy: Math.sin(ang) * spd * 0.85,
            active: true, color: '#22ddff', r: 4, drag: 0.96
        });
    }
    e.anim.set('ATTACK');
    return true;
}

global.CrowDestiny.EnemyBehaviors = global.CrowDestiny.EnemyBehaviors || {};
global.CrowDestiny.EnemyBehaviors.updateHomunculus = updateHomunculus;
global.CrowDestiny.EnemyBehaviors.shootHomunculus = shootHomunculus;

})(typeof window !== 'undefined' ? window : this);
