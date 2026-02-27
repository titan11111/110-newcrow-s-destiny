/**
 * CROW'S DESTINY — enemy7 土星（コズミックエンティティ）SWARM / SHIELD / VOID / PHASE
 */
(function (global) {
'use strict';

const ri = global.CrowDestiny.ri;
const rr = global.CrowDestiny.rr;

function updateCosmic(e, px, py, bullets, scrollSpd) {
    const bt = e.behaviorType || 'SWARM';
    const smin = e.sd.enemyShootMin || 60;
    const smax = e.sd.enemyShootMax || 130;
    let vx = -1.0, sinAmp = 12, sinFreq = 0.04;
    if (bt === 'SWARM') {
        vx = -0.8 - Math.sin(e.timer * 0.02) * 0.4;
        const phase = e.groupPhase || 0;
        const convergence = Math.min(1, e.timer / 120);
        e.y = e.baseY + Math.sin(e.timer * 0.025 + phase * Math.PI * 2) * 40 * (1 - convergence * 0.5);
    } else if (bt === 'SHIELD') {
        vx = -0.9; sinAmp = 12;
        if (e.hitFlash > 0) {
            vx = 0;
            e.shieldFlare = true;
            e.shieldFlareT = 12;
        }
        if ((e.shieldFlareT || 0) > 0) {
            e.shieldFlareT--;
            if (e.shieldFlareT <= 0) e.shieldFlare = false;
        }
        e.y = e.baseY + Math.sin(e.timer * sinFreq) * sinAmp;
    } else if (bt === 'VOID') {
        vx = -1.0 + Math.sin(e.timer * 0.013) * 0.3;
        sinAmp = 10; sinFreq = 0.02;
        if (e.timer % 45 === 22) e.voidStopT = 8;
        if ((e.voidStopT || 0) > 0) {
            e.voidStopT--;
            vx = 0;
            e.ringPulse = 1 - e.voidStopT / 8;
        } else e.ringPulse = 0;
        e.y = e.baseY + Math.sin(e.timer * sinFreq) * sinAmp;
    } else {
        vx = -1.4;
        sinFreq = 0.055 + Math.sin(e.timer * 0.01) * 0.025;
        sinAmp = 32;
        if (e.timer % 60 === 0) e.phaseOffset = (e.phaseOffset || 0) + rr(0.8, 1.6);
        e.y = e.baseY + Math.sin(e.timer * sinFreq + (e.phaseOffset || 0)) * sinAmp;
    }
    e.x += vx;
    e.x -= scrollSpd;
    e.shootCD--;
    if (e.shootCD <= 0) {
        const fired = shootCosmicEntity(e, px, py, bullets);
        if (fired) e.shootCD = ri(smin, smax);
    }
}

function shootCosmicEntity(e, px, py, bullets) {
    const dx = px - e.x, dy = py - e.y, d = Math.hypot(dx, dy) || 1;
    const stageId = (e.sd && e.sd.id) ? e.sd.id : 6;
    if (stageId === 6) {
        const baseAng = Math.atan2(dy, dx);
        bullets.push({
            x: e.x, y: e.y, vx: Math.cos(baseAng) * e.bulletSpd, vy: Math.sin(baseAng) * e.bulletSpd,
            active: true, color: '#00ccff', r: 5, curve: 0.018, curveDecay: 0.998
        });
        const ang2 = baseAng + rr(-0.2, 0.2);
        bullets.push({
            x: e.x, y: e.y, vx: Math.cos(ang2) * e.bulletSpd * 0.9, vy: Math.sin(ang2) * e.bulletSpd * 0.9,
            active: true, color: '#0088cc', r: 3
        });
    } else {
        const targetX = px + rr(-30, 30), targetY = py + rr(-30, 30);
        bullets.push({
            x: e.x, y: e.y, vx: dx / d * e.bulletSpd, vy: dy / d * e.bulletSpd,
            active: true, color: '#ff44ff', r: 5, phase: true, phaseAt: 15, phaseTargetX: targetX, phaseTargetY: targetY
        });
    }
    e.anim.set('ATTACK');
    return true;
}

global.CrowDestiny.EnemyBehaviors = global.CrowDestiny.EnemyBehaviors || {};
global.CrowDestiny.EnemyBehaviors.updateCosmic = updateCosmic;
global.CrowDestiny.EnemyBehaviors.shootCosmicEntity = shootCosmicEntity;

})(typeof window !== 'undefined' ? window : this);
