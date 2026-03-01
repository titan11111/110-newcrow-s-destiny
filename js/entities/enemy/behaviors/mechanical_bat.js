/**
 * CROW'S DESTINY — メカニカル・バット（5面）3x3スプライト
 * fly / move / charge / attack / recover
 */
(function (global) {
'use strict';

const CFG = global.CrowDestiny.CFG;
const clamp = global.CrowDestiny.clamp;
const ri = global.CrowDestiny.ri;

const FLY_FRAME_DUR = 5;
const MOVE_FRAME_DUR = 4;
const COLS = 3;
const ROWS = 3;

function updateMechanicalBat(e, px, py, bullets, scrollSpd, d) {
    if (d == null) d = 1;
    if (!e.spriteFrame) e.spriteFrame = { col: 0, row: 0 };
    const sf = e.spriteFrame;
    const smin = e.sd.enemyShootMin || 60;
    const smax = e.sd.enemyShootMax || 130;

    if (!e.mechBatState) e.mechBatState = 'PATROL';
    if (!e.mechBatTimer) e.mechBatTimer = 0;
    if (e.attackCooldown == null) e.attackCooldown = 0;
    e.baseY = e.baseY != null ? e.baseY : e.y;
    e.attackCooldown -= d;

    const moveSpeed = 1.8;
    const waveAmp = 28;
    const wavePeriod = 2.2;
    const waveFreq = (Math.PI * 2) / wavePeriod;

    e.x -= moveSpeed * d;
    e.x -= scrollSpd * d;
    e.y = e.baseY + Math.sin(e.timer * 0.04 * wavePeriod) * waveAmp;
    e.y = clamp(e.y, CFG.MARGIN, CFG.H - e.h - CFG.MARGIN);

    const dist = Math.hypot(px - e.x, py - e.y);
    const attackRange = 220;

    switch (e.mechBatState) {
        case 'PATROL':
            sf.row = 0;
            sf.col = Math.floor(e.timer / FLY_FRAME_DUR) % COLS;
            if (dist < attackRange) e.mechBatState = 'APPROACH';
            break;

        case 'APPROACH':
            sf.row = 1;
            sf.col = Math.floor(e.timer / MOVE_FRAME_DUR) % COLS;
            if (e.attackCooldown <= 0) {
                e.mechBatState = 'CHARGE';
                e.mechBatTimer = 10;
            }
            break;

        case 'CHARGE':
            sf.row = 2;
            sf.col = 0;
            e.mechBatTimer -= d;
            if (e.mechBatTimer <= 0) {
                e.mechBatState = 'ATTACK';
                e.mechBatTimer = 4;
                shootMechanicalBat(e, px, py, bullets);
            }
            break;

        case 'ATTACK':
            sf.row = 2;
            sf.col = 1;
            e.mechBatTimer -= d;
            if (e.mechBatTimer <= 0) {
                e.mechBatState = 'RECOVER';
                e.mechBatTimer = 8;
            }
            break;

        case 'RECOVER':
            sf.row = 2;
            sf.col = 2;
            e.mechBatTimer -= d;
            if (e.mechBatTimer <= 0) {
                e.attackCooldown = ri(smin, smax);
                e.mechBatState = 'PATROL';
            }
            break;
    }
}

function shootMechanicalBat(e, px, py, bullets) {
    const dx = px - (e.x + e.w / 2);
    const dy = py - (e.y + e.h / 2);
    const len = Math.hypot(dx, dy) || 1;
    const spd = (e.bulletSpd || 3) * 1.5;
    bullets.push({
        x: e.x + e.w / 2, y: e.y + e.h / 2,
        vx: (dx / len) * spd, vy: (dy / len) * spd,
        active: true, color: '#00dd88', r: 6, drag: 0.99
    });
    e.anim.set('ATTACK');
}

global.CrowDestiny.EnemyBehaviors = global.CrowDestiny.EnemyBehaviors || {};
global.CrowDestiny.EnemyBehaviors.updateMechanicalBat = updateMechanicalBat;

})(typeof window !== 'undefined' ? window : this);
