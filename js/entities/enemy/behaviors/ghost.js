/**
 * CROW'S DESTINY — enemy3 残像（データの亡霊）TELEPORT / MIRROR
 * ゆっくりぐるぐる回転しながら移動。奇妙さを強調。紫のビームをランダムで発射。
 */
(function (global) {
'use strict';

const CFG = global.CrowDestiny.CFG;
const clamp = global.CrowDestiny.clamp;
const ri = global.CrowDestiny.ri;
const rr = global.CrowDestiny.rr;
const PURPLE_BEAM = '#7B00FF';

function updateGhost(e, px, py, bullets, scrollSpd) {
    const bt = e.behaviorType || 'TELEPORT';
    const smin = e.sd.enemyShootMin || 60;
    const smax = e.sd.enemyShootMax || 130;
    let vx = -2.0, sinAmp = 20, sinFreq = 0.04;
    /** ゆっくりぐるぐる回転（奇妙さ強調） */
    e.rotationAngle = (e.rotationAngle || 0) + 0.014;
    if ((e.ghostAlphaRestoreIn || 0) > 0) {
        e.ghostAlphaRestoreIn--;
        if (e.ghostAlphaRestoreIn === 0) e.ghostAlpha = 1.0;
    }
    /** 奇妙さ: たまにアルファをわずかに揺らす */
    if (e.timer % 23 === 0 && e.ghostAlpha > 0.5) e.ghostAlpha = 0.72 + Math.random() * 0.2;
    if (bt === 'TELEPORT') {
        const existPhase = e.timer % 60;
        e.ghostAlpha = existPhase < 30 ? 1.0 : 0.3 + Math.sin((existPhase - 30) / 30 * Math.PI) * 0.4;
        if (existPhase === 29) {
            e.ghostPrevY = e.y;
            e.baseY = clamp(e.baseY + rr(-60, 60), CFG.MARGIN + 20, CFG.H - e.h - CFG.MARGIN - 20);
        }
        if (existPhase >= 29 && existPhase < 50 && e.ghostPrevY !== undefined) {
            const t = (existPhase - 29) / 21;
            e.y = e.ghostPrevY + (e.baseY - e.ghostPrevY) * t;
        } else if (existPhase < 29) {
            e.y = e.baseY + Math.sin(e.timer * 0.04) * sinAmp;
        }
    } else {
        vx = -1.5; sinFreq = -0.04; sinAmp = 30;
        if (e.timer % 20 === 0) {
            e.glitchOffsetX = rr(-8, 8);
            e.glitchT = 3;
        }
        if ((e.glitchT || 0) > 0) {
            e.glitchT--;
            e.x += e.glitchOffsetX;
        }
        e.y = e.baseY + Math.sin(e.timer * sinFreq) * sinAmp;
    }
    e.x += vx;
    e.x -= scrollSpd;
    e.shootCD--;
    /** 紫のビームをランダムで発射（奇妙さ・不気味さ） */
    if (Math.random() < 0.013) shootPurpleBeam(e, px, py, bullets);
    if (e.shootCD <= 0) {
        const fired = shootMirror(e, px, py, bullets);
        if (fired) e.shootCD = ri(smin, smax);
    }
}

function shootPurpleBeam(e, px, py, bullets) {
    const dx = px - e.x; const dy = py - e.y; const d = Math.hypot(dx, dy) || 1;
    const spd = (e.bulletSpd || 3) * 1.1;
    bullets.push({
        x: e.x, y: e.y, vx: (dx / d) * spd, vy: (dy / d) * spd,
        active: true, color: PURPLE_BEAM, r: 5, glitch: true, glitchAngle: rr(-0.2, 0.2)
    });
    e.ghostAlpha = 0.5;
    e.ghostAlphaRestoreIn = 8;
    e.anim.set('ATTACK');
}

function shootMirror(e, px, py, bullets) {
    const dx = px - e.x, dy = py - e.y, d = Math.hypot(dx, dy) || 1;
    e.ghostAlpha = 0.2;
    e.ghostAlphaRestoreIn = 6;
    bullets.push({
        x: e.x, y: e.y, vx: dx / d * e.bulletSpd, vy: dy / d * e.bulletSpd,
        active: true, color: '#00ff88', r: 4, glitch: true, glitchAngle: rr(-0.3, 0.3), phaseAt: 15
    });
    e.anim.set('ATTACK');
    return true;
}

global.CrowDestiny.EnemyBehaviors = global.CrowDestiny.EnemyBehaviors || {};
global.CrowDestiny.EnemyBehaviors.updateGhost = updateGhost;
global.CrowDestiny.EnemyBehaviors.shootMirror = shootMirror;

})(typeof window !== 'undefined' ? window : this);
