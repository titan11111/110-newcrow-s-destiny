/**
 * CROW'S DESTINY — スチーム・ウルフ（4面）3x3スプライト
 * walk / attackPrep / fire / clawUp / clawDown / cooldown
 */
(function (global) {
'use strict';

const CFG = global.CrowDestiny.CFG;
const clamp = global.CrowDestiny.clamp;
const ri = global.CrowDestiny.ri;

const WALK_FRAME_DUR = 6;
const COLS = 3;
const ROWS = 3;

function updateSteamWolf(e, px, py, bullets, scrollSpd) {
    if (!e.spriteFrame) e.spriteFrame = { col: 0, row: 0 };
    const sf = e.spriteFrame;
    const smin = e.sd.enemyShootMin || 60;
    const smax = e.sd.enemyShootMax || 130;

    if (!e.steamWolfState) e.steamWolfState = 'PATROL';
    if (!e.steamWolfTimer) e.steamWolfTimer = 0;
    if (e.attackCooldown == null) e.attackCooldown = 0;
    e.groundY = e.groundY != null ? e.groundY : e.y;
    e.attackCooldown--;

    const dist = Math.hypot(px - e.x, py - e.y);
    const moveSpeed = 0.9;

    switch (e.steamWolfState) {
        case 'PATROL':
            sf.row = 0;
            sf.col = Math.floor(e.timer / WALK_FRAME_DUR) % COLS;
            e.x -= moveSpeed;
            e.x -= scrollSpd;
            e.y = clamp(e.groundY, CFG.MARGIN, CFG.H - e.h - CFG.MARGIN);

            if (e.attackCooldown <= 0) {
                if (dist < 90) {
                    e.steamWolfState = 'CLAW_PREP';
                    e.steamWolfTimer = 8;
                } else if (dist < 200) {
                    e.steamWolfState = 'FIRE_PREP';
                    e.steamWolfTimer = 12;
                }
            }
            break;

        case 'CLAW_PREP':
            sf.row = 2;
            sf.col = 0;
            e.x -= moveSpeed * 0.3;
            e.x -= scrollSpd;
            e.steamWolfTimer--;
            if (e.steamWolfTimer <= 0) {
                e.steamWolfState = 'CLAW_ATTACK';
                e.steamWolfTimer = 6;
            }
            break;

        case 'CLAW_ATTACK':
            sf.row = 2;
            sf.col = 1;
            e.x -= moveSpeed * 0.3;
            e.x -= scrollSpd;
            e.steamWolfTimer--;
            if (e.steamWolfTimer <= 0) {
                e.steamWolfState = 'COOLDOWN';
                e.steamWolfTimer = 14;
            }
            break;

        case 'FIRE_PREP':
            sf.row = 1;
            sf.col = Math.min(1, Math.floor((12 - e.steamWolfTimer) / 6));
            e.x -= moveSpeed * 0.3;
            e.x -= scrollSpd;
            e.steamWolfTimer--;
            if (e.steamWolfTimer <= 0) {
                e.steamWolfState = 'FIRE_ATTACK';
                e.steamWolfTimer = 18;
                shootSteamWolfFire(e, px, py, bullets);
            }
            break;

        case 'FIRE_ATTACK':
            sf.row = 1;
            sf.col = 2;
            e.x -= moveSpeed * 0.3;
            e.x -= scrollSpd;
            e.steamWolfTimer--;
            if (e.steamWolfTimer <= 0) {
                e.steamWolfState = 'COOLDOWN';
                e.steamWolfTimer = 14;
            }
            break;

        case 'COOLDOWN':
            sf.row = 2;
            sf.col = 2;
            e.x -= moveSpeed * 0.5;
            e.x -= scrollSpd;
            e.steamWolfTimer--;
            if (e.steamWolfTimer <= 0) {
                e.attackCooldown = ri(smin, smax);
                e.steamWolfState = 'PATROL';
            }
            break;
    }

    e.y = clamp(e.y, CFG.MARGIN, CFG.H - e.h - CFG.MARGIN);
}

function shootSteamWolfFire(e, px, py, bullets) {
    const spd = (e.bulletSpd || 3) * 1.2;
    bullets.push({
        x: e.x + e.w / 2 - 30, y: e.y + e.h / 2,
        vx: -spd * 0.7, vy: 0,
        active: true, color: '#ff6600', r: 12, drag: 0.98
    });
    e.anim.set('ATTACK');
}

global.CrowDestiny.EnemyBehaviors = global.CrowDestiny.EnemyBehaviors || {};
global.CrowDestiny.EnemyBehaviors.updateSteamWolf = updateSteamWolf;

})(typeof window !== 'undefined' ? window : this);
