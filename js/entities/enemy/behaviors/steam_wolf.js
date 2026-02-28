/**
 * CROW'S DESTINY — スチーム・ウルフ（4面）強化版
 * 距離別4種攻撃・獣らしい動き・1.3倍サイズ用パラメータ
 */
(function (global) {
'use strict';

const CFG = global.CrowDestiny.CFG;
const clamp = global.CrowDestiny.clamp;
const ri = global.CrowDestiny.ri;

const WALK_FRAME_DUR = 6;
const COLS = 3;
const ROWS = 3;
const DIST_CLAW = 70;
const DIST_RUSH = 130;
const DIST_FIRE = 220;
const DIST_LAUNCHER = 350;

function updateSteamWolf(e, px, py, bullets, scrollSpd) {
    if (!e.spriteFrame) e.spriteFrame = { col: 0, row: 0 };
    const sf = e.spriteFrame;
    const smin = e.sd.enemyShootMin || 60;
    const smax = e.sd.enemyShootMax || 130;

    if (!e.steamWolfState) e.steamWolfState = 'PATROL';
    if (!e.steamWolfTimer) e.steamWolfTimer = 0;
    if (e.attackCooldown == null) e.attackCooldown = 0;
    if (e.steamWolfConsecutiveClaw == null) e.steamWolfConsecutiveClaw = 0;
    if (e.steamWolfBreathTimer == null) e.steamWolfBreathTimer = 0;
    if (e.steamWolfTension == null) e.steamWolfTension = 0;
    if (e.steamWolfVy == null) e.steamWolfVy = 0;
    e.groundY = e.groundY != null ? e.groundY : e.y;
    e.attackCooldown--;
    e.steamWolfBreathTimer += 0.1;
    e.steamWolfTension *= 0.95;

    const dist = Math.hypot(px - e.x, py - e.y);
    const moveSpeed = 0.9;
    const groundY = Math.min(e.groundY, CFG.H - e.h - CFG.MARGIN);

    switch (e.steamWolfState) {
        case 'PATROL':
            sf.row = 0;
            sf.col = Math.floor(e.timer / WALK_FRAME_DUR) % COLS;
            e.x -= moveSpeed;
            e.x -= scrollSpd;
            e.y = groundY + Math.sin(e.steamWolfBreathTimer) * 2;
            e.y = clamp(e.y, CFG.MARGIN, CFG.H - e.h - CFG.MARGIN);

            if (e.attackCooldown <= 0) {
                if (dist < DIST_CLAW) {
                    e.steamWolfState = 'CLAW_PREP';
                    e.steamWolfTimer = 0;
                    e.steamWolfTension = 1;
                } else if (dist < DIST_RUSH) {
                    e.steamWolfState = 'RUSH_PREP';
                    e.steamWolfTimer = 0;
                    e.steamWolfTension = 1;
                } else if (dist >= DIST_RUSH && dist < DIST_FIRE) {
                    e.steamWolfState = 'FIRE_PREP';
                    e.steamWolfTimer = 0;
                } else if (dist >= DIST_FIRE && dist < DIST_LAUNCHER) {
                    e.steamWolfState = 'LAUNCHER_PREP';
                    e.steamWolfTimer = 0;
                }
            }
            break;

        case 'CLAW_PREP':
            sf.row = 2;
            sf.col = 0;
            e.x -= scrollSpd;
            e.steamWolfTimer++;
            if (e.steamWolfTimer >= 8) {
                e.steamWolfState = 'CLAW_ATTACK';
                e.steamWolfTimer = 0;
            }
            break;

        case 'CLAW_ATTACK':
            sf.row = 2;
            sf.col = 1;
            if (e.steamWolfTimer === 0) e.x -= 4;
            e.x -= scrollSpd;
            e.steamWolfTimer++;
            if (e.steamWolfTimer >= 6) {
                e.steamWolfConsecutiveClaw = (e.steamWolfConsecutiveClaw || 0) + 1;
                if (e.steamWolfConsecutiveClaw < 3 && Math.random() < 0.3) {
                    e.steamWolfState = 'CLAW_PREP';
                    e.steamWolfTimer = 0;
                    e.steamWolfTension = 1;
                } else {
                    e.steamWolfState = 'COOLDOWN';
                    e.steamWolfTimer = 0;
                    e.steamWolfConsecutiveClaw = 0;
                    e.attackCooldown = 60 + ri(0, 50);
                }
            }
            break;

        case 'RUSH_PREP':
            sf.row = 2;
            sf.col = 0;
            e.x -= 0.3;
            e.x -= scrollSpd;
            e.y += (groundY + 8 - e.y) * 0.2;
            e.steamWolfTimer++;
            if (e.steamWolfTimer >= 15) {
                e.steamWolfState = 'RUSH_ATTACK';
                e.steamWolfTimer = 0;
                e.steamWolfVy = -2.5;
            }
            break;

        case 'RUSH_ATTACK':
            sf.row = 2;
            sf.col = 1;
            if (e.steamWolfTimer === 0) e.x -= 2.5;
            e.x -= scrollSpd;
            e.steamWolfVy += 0.25;
            e.y += e.steamWolfVy;
            if (e.y >= groundY) { e.y = groundY; e.steamWolfVy = 0; }
            e.steamWolfTimer++;
            if (e.steamWolfTimer >= 20) {
                e.steamWolfState = 'COOLDOWN';
                e.steamWolfTimer = 0;
                e.attackCooldown = 50 + ri(0, 40);
            }
            break;

        case 'FIRE_PREP':
            sf.row = 1;
            sf.col = Math.min(1, Math.floor(e.steamWolfTimer / 6));
            e.x -= moveSpeed * 0.3;
            e.x -= scrollSpd;
            e.steamWolfTimer++;
            if (e.steamWolfTimer >= 12) {
                e.steamWolfState = 'FIRE_ATTACK';
                e.steamWolfTimer = 0;
            }
            break;

        case 'FIRE_ATTACK':
            sf.row = 1;
            sf.col = 2;
            e.x -= moveSpeed * 0.3;
            e.x -= scrollSpd;
            if (e.steamWolfTimer === 3) shootSteamWolfFanFire(e, px, py, bullets);
            e.steamWolfTimer++;
            if (e.steamWolfTimer >= 18) {
                e.steamWolfState = 'COOLDOWN';
                e.steamWolfTimer = 0;
                e.attackCooldown = 70 + ri(0, 50);
            }
            break;

        case 'LAUNCHER_PREP':
            sf.row = 1;
            sf.col = 0;
            e.x -= 0.2;
            e.x -= scrollSpd;
            e.steamWolfTimer++;
            if (e.steamWolfTimer >= 24) {
                e.steamWolfState = 'LAUNCHER_ATTACK';
                e.steamWolfTimer = 0;
            }
            break;

        case 'LAUNCHER_ATTACK':
            sf.row = 1;
            sf.col = Math.min(2, Math.floor(e.steamWolfTimer / 4) + 1);
            e.x -= 0.4;
            e.x -= scrollSpd;
            if (e.steamWolfTimer === 5) shootSteamWolfLauncher(e, px, py, bullets);
            e.steamWolfTimer++;
            if (e.steamWolfTimer >= 16) {
                e.steamWolfState = 'COOLDOWN';
                e.steamWolfTimer = 0;
                e.attackCooldown = 80 + ri(0, 60);
            }
            break;

        case 'COOLDOWN':
            sf.row = 2;
            sf.col = 2;
            e.x -= moveSpeed * 0.5;
            e.x -= scrollSpd;
            e.y = groundY + Math.sin(e.steamWolfBreathTimer) * 2;
            e.steamWolfTimer++;
            if (e.steamWolfTimer >= 14) {
                e.attackCooldown = e.attackCooldown > 0 ? e.attackCooldown : ri(smin, smax);
                e.steamWolfState = 'PATROL';
                e.steamWolfTimer = 0;
            }
            break;
    }

    e.y = clamp(e.y, CFG.MARGIN, CFG.H - e.h - CFG.MARGIN);
}

function shootSteamWolfFanFire(e, px, py, bullets) {
    const spd = (e.bulletSpd || 3) * 1.5;
    const baseAngle = Math.atan2(py - (e.y + e.h / 2), px - (e.x + e.w / 2 - 30));
    for (let i = -1; i <= 1; i++) {
        const a = baseAngle + i * 0.35;
        bullets.push({
            x: e.x + e.w / 2 - 30,
            y: e.y + e.h / 2,
            vx: Math.cos(a) * spd,
            vy: Math.sin(a) * spd,
            active: true, color: '#ff6600', r: 12, drag: 0.98
        });
    }
    e.anim.set('ATTACK');
}

function shootSteamWolfLauncher(e, px, py, bullets) {
    const dx = px - (e.x - 15);
    const dy = py - (e.y - 10);
    const angle = Math.atan2(dy, dx) - 0.3;
    const speed = 6.5;
    bullets.push({
        x: e.x - 15,
        y: e.y - 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        active: true,
        color: '#cc8800',
        r: 16,
        gravity: 0.15,
        explosive: true,
        explosionRadius: 60,
        explosionDamage: 15,
        noDamage: true
    });
}

global.CrowDestiny.EnemyBehaviors = global.CrowDestiny.EnemyBehaviors || {};
global.CrowDestiny.EnemyBehaviors.updateSteamWolf = updateSteamWolf;

})(typeof window !== 'undefined' ? window : this);
