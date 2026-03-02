/**
 * CROW'S DESTINY — 敵の描画（スプライト・enemy2〜7 専用演出）
 */
(function (global) {
'use strict';

const SPRITE_LAYOUTS = global.CrowDestiny.EnemyConfig.SPRITE_LAYOUTS;
const HORIZONTAL_FLOAT_6 = global.CrowDestiny.EnemyConfig.HORIZONTAL_FLOAT_6;
const FLOAT_FRAME_INTERVAL = global.CrowDestiny.EnemyConfig.FLOAT_FRAME_INTERVAL;
const ENEMY6_TOTAL_FRAMES = global.CrowDestiny.EnemyConfig.ENEMY6_TOTAL_FRAMES || 5;
/** shadowBlur 禁止フラグ参照 */
const ns = () => global.CrowDestiny.noShadow;

function drawEnemy(e, c, qualityEffect) {
    if (!e.active) return;
    if (qualityEffect == null) qualityEffect = 1;
    /* noShadow が true の場合は useHeavyEffect を強制 false にして shadowBlur を一切使わせない */
    const useHeavyEffect = qualityEffect >= 0.5 && !ns();
    const IMG = global.CrowDestiny && global.CrowDestiny.IMG;
    const f = e.anim.frame;
    const s = e.anim.state;
    const t = e.timer;
    const cx = e.x + e.w / 2;
    const cy = e.y + e.h / 2;

    if (e.spriteKey && IMG && IMG[e.spriteKey]) {
        const layout = SPRITE_LAYOUTS[e.spriteKey];
        if (!layout) return;
        const sh = IMG[e.spriteKey];
        /* 画像未読み込み・破損時はスプライト描画をスキップしフォールバックへ（ステージ6等の白いE化を防ぐ） */
        if (!sh.naturalWidth || !sh.naturalHeight) {
            /* fall through to fallback below */
        } else {
        const sw = sh.naturalWidth || layout.fallbackW || 1584;
        const shh = sh.naturalHeight || layout.fallbackH || 672;
        const COLS = layout.cols;
        const ROWS = layout.rows;
        const fw = sw / COLS;
        const fh = shh / ROWS;
        const scale = 0.25;
        const dispW = fw * scale;
        const dispH = fh * scale;
        const inset = layout.inset !== undefined ? layout.inset : 0.06;
        const cropW = fw * (1 - inset * 2);
        const cropH = fh * (1 - inset * 2);

        if (e.spriteKey === 'enemy3') {
            const alpha = e.ghostAlpha !== undefined ? e.ghostAlpha : 1.0;
            const isGhosting = alpha < 0.8;
            const frameIndex = isGhosting ? Math.floor(e.timer / 4) % 2 : 2 + Math.floor(e.timer / 9) % 4;
            const col = frameIndex % COLS;
            const row = Math.floor(frameIndex / COLS);
            const srcX = col * fw + fw * inset;
            const srcY = row * fh + fh * inset;
            c.save();
            c.globalAlpha = alpha;
            c.translate(Math.floor(cx), Math.floor(cy));
            c.rotate(e.rotationAngle || 0);
            if (e.anim.state === 'DEATH') {
                c.globalAlpha = alpha * (1 - f / 4);
                c.scale(-(1 - f / 4) * scale, (1 - f / 4) * scale);
            } else {
                if (e.hitFlash > 0) c.globalAlpha = alpha * (0.5 + 0.5 * (e.hitFlash / 4));
                c.scale(-scale, scale);
            }
            const gx = Math.floor(-fw / 2), gy = Math.floor(-fh / 2);
            if (isGhosting) {
                c.globalAlpha = alpha * 0.5;
                c.drawImage(sh, srcX, srcY, cropW, cropH, gx - 3, gy, fw, fh);
                c.drawImage(sh, srcX, srcY, cropW, cropH, gx + 3, gy, fw, fh);
                c.globalAlpha = alpha;
            }
            c.drawImage(sh, srcX, srcY, cropW, cropH, gx, gy, fw, fh);
            if (e.anim.state !== 'DEATH' && useHeavyEffect) {
                c.globalCompositeOperation = 'screen';
                c.globalAlpha = 0.15;
                c.fillStyle = '#00ff88';
                c.fillRect(-fw / 2, -fh / 2, fw, fh);
                c.globalCompositeOperation = 'source-over';
            }
            c.restore();
            return;
        }

        /** enemy6: 5フレーム横並び。ずれなく整数座標で切り出し（参考: adjustFramePositions） */
        if (e.spriteKey === 'enemy6') {
            const totalFrames = ENEMY6_TOTAL_FRAMES;
            const frameWidth = Math.floor(sw / totalFrames);
            const frameHeight = shh;
            let frameIndex = e.anim.state === 'DEATH' ? 0 : (e.stompFrame !== undefined ? Math.min(e.stompFrame, totalFrames - 1) : Math.floor(e.timer / FLOAT_FRAME_INTERVAL) % totalFrames);
            const sourceX = frameIndex * frameWidth;
            const scale = 0.25;
            c.save();
            c.translate(Math.floor(cx), Math.floor(cy));
            if (e.anim.state === 'DEATH') {
                const ds = 1 - f / 4;
                c.globalAlpha = ds;
                c.scale(-ds * scale, ds * scale);
            } else {
                if (e.hitFlash > 0) c.globalAlpha = 0.5 + 0.5 * (e.hitFlash / 4);
                c.scale(-scale, scale);
            }
            const dx6 = Math.floor(-frameWidth / 2), dy6 = Math.floor(-frameHeight / 2);
            c.drawImage(sh, sourceX, 0, frameWidth, frameHeight, dx6, dy6, frameWidth, frameHeight);
            if (e.anim.state !== 'DEATH' && useHeavyEffect) {
                c.globalCompositeOperation = 'screen';
                c.shadowColor = '#4488ff';
                c.shadowBlur = 6;
                c.globalAlpha = 0.08;
                c.drawImage(sh, sourceX, 0, frameWidth, frameHeight, dx6, dy6, frameWidth, frameHeight);
                c.globalAlpha = 1;
                c.shadowBlur = 0;
                c.globalCompositeOperation = 'source-over';
            }
            if (e.beastChargeT > 0) {
                const intensity = 1 - e.beastChargeT / 12;
                c.save();
                c.globalCompositeOperation = 'screen';
                c.globalAlpha = intensity * 0.5;
                c.fillStyle = '#aa44ff';
                c.beginPath();
                c.arc(0, 0, 20 + intensity * 15, 0, Math.PI * 2);
                c.fill();
                c.restore();
            }
            c.restore();
            return;
        }

        /** steam_wolf / mechanical_bat: 3x3スプライト（e.spriteFrame で col/row 指定） */
        if (e.spriteKey === 'steam_wolf' || e.spriteKey === 'mechanical_bat') {
            const sf = e.spriteFrame || { col: 0, row: 0 };
            const col = Math.min(2, Math.max(0, sf.col || 0));
            const row = Math.min(2, Math.max(0, sf.row || 0));
            const srcX = col * fw;
            const srcY = row * fh;
            const scale = e.spriteKey === 'steam_wolf' ? 0.28 * 1.3 : 0.28;
            const tension = (e.spriteKey === 'steam_wolf' && e.steamWolfTension > 0) ? e.steamWolfTension : 0;
            const shakeX = tension * (Math.random() - 0.5) * 2;
            const shakeY = tension * (Math.random() - 0.5) * 2;
            c.save();
            c.translate(Math.floor(cx + shakeX), Math.floor(cy + shakeY));
            if (e.anim.state === 'DEATH') {
                const ds = 1 - f / 4;
                c.globalAlpha = ds;
                c.scale(-ds * scale, ds * scale);
            } else {
                if (e.hitFlash > 0) c.globalAlpha = 0.5 + 0.5 * (e.hitFlash / 4);
                c.scale(-scale, scale);
            }
            const sx2 = Math.floor(-fw / 2), sy2 = Math.floor(-fh / 2);
            c.drawImage(sh, srcX, srcY, fw, fh, sx2, sy2, fw, fh);
            if (e.anim.state !== 'DEATH' && useHeavyEffect) {
                c.globalCompositeOperation = 'screen';
                c.shadowColor = e.spriteKey === 'steam_wolf' ? '#ff8844' : '#00cc88';
                c.shadowBlur = 6;
                c.globalAlpha = 0.06;
                c.drawImage(sh, srcX, srcY, fw, fh, sx2, sy2, fw, fh);
                c.globalAlpha = 1;
                c.shadowBlur = 0;
                c.globalCompositeOperation = 'source-over';
            }
            c.restore();
            return;
        }

        const totalFrames = COLS * ROWS;
        let frameIndex;
        if (e.anim.state === 'DEATH') frameIndex = 0;
        else if (e.spriteKey === 'enemy2' && e.useAttackRow) frameIndex = COLS;
        else if (HORIZONTAL_FLOAT_6[e.spriteKey]) frameIndex = Math.floor(e.timer / FLOAT_FRAME_INTERVAL) % totalFrames;
        else frameIndex = Math.floor(e.timer / 9) % totalFrames;
        let row = ROWS > 1 && s === 'ATTACK' ? 1 : Math.floor(frameIndex / COLS);
        if (e.spriteKey === 'enemy2' && e.useAttackRow) row = 1;
        const col = frameIndex % COLS;
        const srcX = col * fw + fw * inset;
        const srcY = row * fh + fh * inset;
        c.save();
        c.translate(Math.floor(cx), Math.floor(cy));
        if (e.anim.state === 'DEATH') {
            const ds = 1 - f / 4;
            c.globalAlpha = ds;
            c.scale(-ds * scale, ds * scale);
        } else {
            if (e.hitFlash > 0) c.globalAlpha = 0.5 + 0.5 * (e.hitFlash / 4);
            c.scale(-scale, scale);
        }
        const dx = Math.floor(-fw / 2), dy = Math.floor(-fh / 2);
        c.drawImage(sh, srcX, srcY, cropW, cropH, dx, dy, fw, fh);
        if (e.anim.state !== 'DEATH' && useHeavyEffect) {
            c.globalCompositeOperation = 'screen';
            c.shadowColor = '#4488ff';
            c.shadowBlur = 6;
            c.globalAlpha = 0.08;
            c.drawImage(sh, srcX, srcY, cropW, cropH, dx, dy, fw, fh);
            c.globalAlpha = 1;
            c.shadowBlur = 0;
            c.globalCompositeOperation = 'source-over';
        }
        if (e.spriteKey === 'enemy5' && e.showError) {
            c.save();
            c.setTransform(1, 0, 0, 1, 0, 0);
            c.font = 'bold 9px monospace';
            c.fillStyle = '#00ffff';
            c.globalAlpha = 0.8 + Math.sin(e.timer * 0.5) * 0.2;
            c.fillText('ERROR', Math.floor(e.x + 2), Math.floor(e.y - 6));
            c.translate(Math.floor(cx), Math.floor(cy));
            c.globalCompositeOperation = 'screen';
            c.globalAlpha = 0.25;
            c.fillStyle = '#aaddff';
            c.fillRect(-fw / 2, -fh / 2, fw, fh);
            c.restore();
        }
        if (e.spriteKey === 'enemy7') {
            const baseR = 22 + (e.ringPulse || 0) * 12;
            const glow = 0.5 + Math.sin(e.timer * 0.08) * 0.3;
            c.save();
            c.strokeStyle = e.isBlue ? '#00ccff' : '#ff44ff';
            c.lineWidth = 2.5;
            c.globalAlpha = glow;
            if (!ns()) { c.shadowColor = e.color; c.shadowBlur = 10; }
            c.beginPath();
            c.ellipse(0, 0, baseR, baseR * 0.35, Math.PI * 0.15, 0, Math.PI * 2);
            c.stroke();
            if (e.sd && e.sd.id === 7 && e.timer % 30 < 8) {
                c.globalAlpha = 0.9;
                c.strokeStyle = '#ffffff';
                c.lineWidth = 1;
                c.beginPath();
                c.ellipse(0, 0, baseR, baseR * 0.35, Math.PI * 0.15, e.timer * 0.05, e.timer * 0.05 + 0.8);
                c.stroke();
            }
            if (e.shieldFlare && (e.shieldFlareT || 0) > 0) {
                c.globalAlpha = (e.shieldFlareT / 12) * 0.6;
                c.fillStyle = '#00ccff';
                c.beginPath();
                c.ellipse(0, 0, baseR * 1.4, baseR * 0.5, Math.PI * 0.15, 0, Math.PI * 2);
                c.fill();
            }
            c.restore();
        }
        if (e.isBlue) {
            e.glow += 0.08;
            c.globalAlpha = 0.25 + Math.sin(e.glow) * 0.15;
            c.strokeStyle = e.color;
            c.lineWidth = 2;
            const r = Math.max(dispW, dispH) / 2 + Math.sin(e.glow * 2) * 3;
            c.beginPath();
            c.arc(0, 0, r, 0, Math.PI * 2);
            c.stroke();
        }
        c.restore();
        return;
        }
    }

    c.save();
    c.translate(Math.floor(e.x), Math.floor(e.y));
    if (e.isBlue) {
        e.glow += 0.08;
        c.save();
        c.globalAlpha = 0.2 + Math.sin(e.glow) * 0.15;
        c.fillStyle = e.color;
        c.beginPath();
        c.arc(0, 0, 14 + Math.sin(e.glow * 2) * 2, 0, Math.PI * 2);
        c.fill();
        c.restore();
    }
    const cl = e.hitFlash > 0 ? '#fff' : e.color;
    c.fillStyle = cl;
    c.strokeStyle = cl;
    c.lineWidth = 1.5;
    if (e.anim.state === 'DEATH') {
        const ds = 1 - f / 4;
        c.scale(ds, ds);
        c.globalAlpha = ds;
    }
    c.scale(2.16, 1.24);
    const wb = Math.sin(t * 0.1 + f) * 2;
    c.beginPath();
    c.ellipse(0, -2 + wb, 13, 10, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.beginPath();
    c.ellipse(0, -12 + wb * 0.5, 9, 7, 0, Math.PI, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = e.isBlue ? '#fff' : '#ffcc00';
    c.beginPath();
    c.arc(-4, -12, 2.5, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(4, -12, 2.5, 0, Math.PI * 2);
    c.fill();
    if (f % 2 === 0) {
        c.beginPath();
        c.arc(0, -15, 2, 0, Math.PI * 2);
        c.fill();
    }
    c.strokeStyle = cl;
    c.lineWidth = 2;
    const ta = [[0.3, 0.6, -0.3, -0.6], [0.5, 0.3, -0.5, -0.3], [0.2, 0.7, -0.2, -0.7], [0.6, 0.4, -0.6, -0.4]][f];
    for (let i = 0; i < 4; i++) {
        const bx = (i < 2 ? -8 : 8) + (i % 2 === 0 ? -3 : 3);
        c.beginPath();
        c.moveTo(bx, 6);
        c.quadraticCurveTo(bx + ta[i] * 12, 16 + Math.sin(t * 0.1 + i) * 3, bx + ta[i] * 8, 24);
        c.stroke();
    }
    c.restore();
}

global.CrowDestiny.EnemyDraw = drawEnemy;

})(typeof window !== 'undefined' ? window : this);
