/**
 * CROW'S DESTINY — 敵弾の特殊挙動（drag/accel/glitch/phase/curve）
 * 毎フレーム b.x += b.vx の前に呼ぶ。
 */
(function (global) {
'use strict';

/** 敵弾の特殊挙動を適用 */
function updateSpecialBullets(bullets) {
    bullets.forEach(b => {
        if (!b.active) return;
        b.life = (b.life || 0) + 1;
        if (b.drag) {
            b.vx *= b.drag;
            b.vy *= b.drag;
        }
        if (b.accel && b.accelMax) {
            const spd = Math.hypot(b.vx, b.vy);
            if (spd < b.accelMax) {
                b.vx *= b.accel;
                b.vy *= b.accel;
            }
        }
        if (b.glitch && b.glitchAngle !== undefined && b.life >= (b.phaseAt ?? 15)) {
            const ang = Math.atan2(b.vy, b.vx) + b.glitchAngle;
            const spd = Math.hypot(b.vx, b.vy);
            b.vx = Math.cos(ang) * spd;
            b.vy = Math.sin(ang) * spd;
            b.glitch = false;
        }
        if (b.phase && b.phaseAt !== undefined && b.life === b.phaseAt) {
            b.x = b.phaseTargetX;
            b.y = b.phaseTargetY;
            b.vx *= -0.8;
            b.vy *= -0.8;
            b.phase = false;
        }
        if (b.curve !== undefined && b.curveDecay !== undefined) {
            const a = Math.atan2(b.vy, b.vx);
            b.vx += Math.cos(a + Math.PI / 2) * b.curve;
            b.vy += Math.sin(a + Math.PI / 2) * b.curve;
            b.curve *= b.curveDecay;
        }
        if (b.hue !== undefined) {
            b.hue = (b.hue + 2) % 360;
            b.color = `hsl(${b.hue}, 100%, 70%)`;
        }
        if (b.gravity != null) b.vy += b.gravity;
    });
}

/** 爆発弾: 着地または画面外で爆発し範囲ダメージ。スチーム・ウルフ ランチャー用 */
function processExplosiveBullets(bullets, game) {
    if (!game || !game.crow || !game.fx) return;
    const H = (game.CFG && game.CFG.H) ? game.CFG.H : 540;
    const groundY = H - 80;
    bullets.forEach(b => {
        if (!b.active || !b.explosive) return;
        if (b.y >= groundY || b.x < -50 || (b.life || 0) > 180) {
            const ex = b.x;
            const ey = Math.min(b.y, groundY);
            game.fx.burst(ex, ey, '#ff6600', 35, 8);
            if (game.fx.addFloorCrack) game.fx.addFloorCrack(ex, groundY, 30);
            const r = b.explosionRadius || 60;
            const dx = game.crow.cx - ex;
            const dy = game.crow.cy - ey;
            if (Math.hypot(dx, dy) < r) game.crow.takeDamage(b.explosionDamage != null ? b.explosionDamage : 12, game.fx);
            b.active = false;
        }
    });
}

/** 分裂弾: splitAt フレームで 3 方向に分裂。BOSS6 クリスタルシャード用。adapter は [i] 非対応のため forEach で反復 */
function processBulletSplits(bullets) {
    bullets.forEach(b => {
        if (!b || !b.active || b.splitAt == null || b.splitCount == null || b.splitCount <= 0) return;
        if ((b.life || 0) < b.splitAt) return;
        const a = Math.atan2(b.vy, b.vx);
        const spd = 6;
        for (let j = -1; j <= 1; j++) {
            const splitA = a + j * 0.4;
            const hue = ((b.hue != null ? b.hue + j * 60 : 200) % 360 + 360) % 360;
            bullets.push({
                x: b.x, y: b.y,
                vx: Math.cos(splitA) * spd, vy: Math.sin(splitA) * spd,
                active: true, color: `hsl(${hue}, 100%, 70%)`, r: b.r || 4,
                hue: hue
            });
        }
        b.active = false;
    });
}

global.CrowDestiny = global.CrowDestiny || {};
global.CrowDestiny.updateSpecialBullets = updateSpecialBullets;
global.CrowDestiny.processBulletSplits = processBulletSplits;
global.CrowDestiny.processExplosiveBullets = processExplosiveBullets;

})(typeof window !== 'undefined' ? window : this);
