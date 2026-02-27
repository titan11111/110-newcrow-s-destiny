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
    });
}

global.CrowDestiny = global.CrowDestiny || {};
global.CrowDestiny.updateSpecialBullets = updateSpecialBullets;

})(typeof window !== 'undefined' ? window : this);
