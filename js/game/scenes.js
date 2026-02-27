/**
 * CROW'S DESTINY — シーン描画
 * タイトル・説明・ゲームオーバー・クリア・カットシーン・ポーズの描画を担当する。
 */
(function (global) {
'use strict';

const CFG = global.CrowDestiny.CFG;
const IMG = global.CrowDestiny.IMG;
const RELIC_TYPES = global.CrowDestiny.RELIC_TYPES || [];

/**
 * 取り扱い説明（アイテム・操作）画面を描画
 */
function drawInstructions(c, game) {
    c.fillStyle = "rgba(0,0,0,0.82)";
    c.fillRect(0, 0, CFG.W, CFG.H);
    const titleFont = "Cinzel, Georgia, serif";
    c.textAlign = "center";
    c.font = `bold 32px ${titleFont}`;
    c.fillStyle = "#e0cda7";
    c.fillText("取り扱い説明 — アイテム", CFG.W / 2, 72);
    c.font = `16px ${titleFont}`;
    c.fillStyle = "#8a7a5c";
    c.fillText("敵を倒すと聖遺物が落ちることがあります。取得すると以下の効果が発動します。", CFG.W / 2, 108);
    c.font = "15px serif";
    c.fillStyle = "#c9b896";
    c.fillText("【PC】 十字/WASD: 移動 ／ スペース/Shift/X: ダッシュ ／ C: スキル切替 Z: 発動 ／ 1〜7: その面のスキル", CFG.W / 2, 126);
    c.font = "14px serif";
    c.fillText("【スマホ】 左: ジョイスティック ／ 右: Ⅱスタート スキル ダッシュ 設定（スキルはタップで切替・長押しで発動）", CFG.W / 2, 146);
    c.fillStyle = "#8a7a5c";
    c.font = "13px serif";
    c.fillText("攻撃は自動。ボスを倒すとスキルが1つ解放され、スキルボタンで順に切り替えて発動できます。", CFG.W / 2, 164);
    const iconScale = 0.6;
    const baseIconSize = 44;
    const iconSize = Math.round(baseIconSize * iconScale);
    const rowH = 92;
    const startY = 182;
    const iconX = 100;
    const textX = 175;
    for (let i = 0; i < RELIC_TYPES.length; i++) {
        const t = RELIC_TYPES[i];
        const cy = startY + i * rowH + rowH / 2;
        c.save();
        c.translate(iconX, cy);
        c.scale(iconSize / 80, iconSize / 80);
        if (IMG.items && t.iconIndex !== undefined) {
            const sh = IMG.items, sw = sh.naturalWidth || 400, shh = sh.naturalHeight || 100, sliceW = sw / 4, sx = t.iconIndex * sliceW;
            c.globalAlpha = 0.95;
            c.drawImage(sh, sx, 0, sliceW, shh, -sliceW / 2, -shh / 2, sliceW, shh);
            c.globalAlpha = 1;
        } else {
            c.globalAlpha = 0.9;
            c.fillStyle = t.color;
            c.beginPath(); c.arc(0, 0, 18, 0, Math.PI * 2); c.fill();
            c.globalAlpha = 1;
            c.strokeStyle = t.color; c.lineWidth = 2.5;
            if (t.icon === "cross") { c.fillStyle = t.color; c.fillRect(-2.5, -10, 5, 20); c.fillRect(-10, -2.5, 20, 5); }
            else if (t.icon === "shield") { c.beginPath(); c.moveTo(0, -10); c.quadraticCurveTo(12, -6, 10, 4); c.quadraticCurveTo(6, 12, 0, 14); c.quadraticCurveTo(-6, 12, -10, 4); c.quadraticCurveTo(-12, -6, 0, -10); c.closePath(); c.stroke(); }
            else if (t.icon === "hourglass") { c.beginPath(); c.moveTo(-7, -10); c.lineTo(7, -10); c.lineTo(0, 0); c.lineTo(7, 10); c.lineTo(-7, 10); c.lineTo(0, 0); c.closePath(); c.stroke(); }
            else if (t.icon === "explosion") { c.beginPath(); for (let k = 0; k < 8; k++) { const a = (Math.PI * 2 / 8) * k, r = k % 2 === 0 ? 10 : 5, px = Math.cos(a) * r, py = Math.sin(a) * r; if (k === 0) c.moveTo(px, py); else c.lineTo(px, py); } c.closePath(); c.stroke(); c.fillStyle = t.color; c.globalAlpha = 0.4; c.fill(); }
        }
        c.restore();
        c.textAlign = "left";
        c.font = `bold 17px ${titleFont}`;
        c.fillStyle = t.color;
        c.fillText(t.name, textX, cy - 4);
        c.font = "14px serif";
        c.fillStyle = "#b8a88a";
        c.fillText(t.desc || "", textX, cy + 16);
        c.textAlign = "center";
    }
    const subY = CFG.H - 52;
    c.font = `bold 18px ${titleFont}`;
    c.globalAlpha = 0.88 + Math.sin(game.frame * 0.06) * 0.12;
    c.strokeStyle = "rgba(0,0,0,0.8)";
    c.lineWidth = 3;
    c.lineJoin = "round";
    c.strokeText("— 下の START でオープニングへ —", CFG.W / 2, subY);
    c.fillStyle = "#f2e6d0";
    c.fillText("— 下の START でオープニングへ —", CFG.W / 2, subY);
    c.globalAlpha = 1;
    c.textAlign = "left";
}

/**
 * タイトル画面を描画
 */
function drawTitle(c, game) {
    if (IMG.title) {
        const img = IMG.title, iw = img.naturalWidth || 800, ih = img.naturalHeight || 600;
        const scale = Math.max(CFG.W / iw, CFG.H / ih);
        c.drawImage(img, 0, 0, iw, ih, 0, 0, iw * scale, ih * scale);
        c.fillStyle = "rgba(0,0,0,0.45)";
        c.fillRect(0, 0, CFG.W, CFG.H);
    } else {
        c.fillStyle = "rgba(0,0,0,0.5)";
        c.fillRect(0, 0, CFG.W, CFG.H);
    }
    c.textAlign = "center";
    const titleFont = "Cinzel, Georgia, serif";
    c.font = `bold 58px ${titleFont}`;
    c.fillStyle = "rgba(0,0,0,0.6)";
    c.fillText("CROW'S DESTINY", CFG.W / 2 + 3, 173);
    c.fillStyle = "#ff4d00";
    c.fillText("CROW'S DESTINY", CFG.W / 2, 170);
    c.font = `600 22px ${titleFont}`;
    c.fillStyle = "#c9b896";
    c.fillText("THE RITUAL OF TWILIGHT", CFG.W / 2, 218);
    if (!IMG.crowSheet) {
        c.save();
        c.translate(CFG.W / 2, 300);
        const s = 2.8 + Math.sin(game.frame * 0.03) * 0.3;
        c.scale(s, s);
        c.fillStyle = "#111";
        c.strokeStyle = "#ff4d00";
        c.lineWidth = 1;
        c.beginPath(); c.ellipse(0, 0, 13, 10, 0, 0, Math.PI * 2); c.fill(); c.stroke();
        c.beginPath(); c.ellipse(9, -5, 8, 7, 0.2, 0, Math.PI * 2); c.fill(); c.stroke();
        c.fillStyle = "#ff0000";
        c.beginPath(); c.arc(12, -7, 2.5, 0, Math.PI * 2); c.fill();
        const wa = Math.sin(game.frame * 0.08) * 0.5;
        c.save(); c.rotate(-wa); c.fillStyle = "#111";
        c.beginPath(); c.moveTo(-2, -5); c.lineTo(-24, -16); c.lineTo(-19, -9); c.closePath(); c.fill(); c.stroke(); c.restore();
        c.save(); c.rotate(wa * 0.6); c.fillStyle = "#111";
        c.beginPath(); c.moveTo(-2, 5); c.lineTo(-22, 14); c.lineTo(-17, 8); c.closePath(); c.fill(); c.stroke(); c.restore();
        c.restore();
    }
    c.font = `16px ${titleFont}`;
    c.fillStyle = "#8a7a5c";
    c.fillText("七つの穢れし地を浄化せよ。黒きカラスよ、翼を広げよ。", CFG.W / 2, 400);
    const subY = 455;
    c.font = `bold 20px ${titleFont}`;
    c.globalAlpha = 0.85 + Math.sin(game.frame * 0.06) * 0.15;
    c.strokeStyle = "rgba(0,0,0,0.9)";
    c.lineWidth = 4;
    c.lineJoin = "round";
    c.strokeText("— SPACE / START で儀式を開始 —", CFG.W / 2, subY);
    c.fillStyle = "#f2e6d0";
    c.fillText("— SPACE / START で儀式を開始 —", CFG.W / 2, subY);
    c.globalAlpha = 1;
    c.textAlign = "left";
}

/**
 * ゲームオーバー画面を描画
 */
function drawGameOver(c, game) {
    c.fillStyle = "rgba(0,0,0,0.75)";
    c.fillRect(0, 0, CFG.W, CFG.H);
    c.textAlign = "center";
    c.fillStyle = "#ff0000";
    c.font = "60px serif";
    c.fillText("THE NIGHT ENDURES", CFG.W / 2, CFG.H / 2 - 20);
    c.fillStyle = "#e0cda7";
    c.font = "22px serif";
    c.fillText(`浄化された魂: ${game.score}`, CFG.W / 2, CFG.H / 2 + 20);
    if (game.stateT > 90) {
        c.globalAlpha = 0.5 + Math.sin(game.frame * 0.05) * 0.3;
        c.font = "18px serif";
        c.fillText("— SPACE / START で再挑戦 —", CFG.W / 2, CFG.H / 2 + 60);
    }
    c.textAlign = "left";
}

/**
 * クリア（エンディング）画面を描画
 */
function drawVictory(c, game) {
    if (IMG.title) {
        const img = IMG.title, iw = img.naturalWidth || 800, ih = img.naturalHeight || 600;
        const scale = Math.max(CFG.W / iw, CFG.H / ih);
        c.drawImage(img, 0, 0, iw, ih, 0, 0, iw * scale, ih * scale);
        c.fillStyle = "rgba(0,0,0,0.5)";
        c.fillRect(0, 0, CFG.W, CFG.H);
    } else {
        c.fillStyle = "rgba(0,0,0,0.7)";
        c.fillRect(0, 0, CFG.W, CFG.H);
    }
    c.textAlign = "center";
    c.fillStyle = "#ffcc00";
    c.font = "50px serif";
    c.fillText("浄化の儀式、完遂せり", CFG.W / 2, CFG.H / 2 - 50);
    c.fillStyle = "#e0cda7";
    c.font = "24px serif";
    c.fillText("全ての穢れは祓われた。", CFG.W / 2, CFG.H / 2);
    c.fillText("黒きカラスは夜明けの空へ還る。", CFG.W / 2, CFG.H / 2 + 35);
    c.font = "20px serif";
    c.fillText(`最終スコア: ${game.score}`, CFG.W / 2, CFG.H / 2 + 75);
    if (game.stateT > 150) {
        c.globalAlpha = 0.5 + Math.sin(game.frame * 0.05) * 0.3;
        c.font = "18px serif";
        c.fillText("— SPACE / START で再び —", CFG.W / 2, CFG.H / 2 + 120);
    }
    c.textAlign = "left";
}

/**
 * ラスボス 第二形態→第三形態（猫神）移行カットシーンを描画
 * スプライトシート lastbossadvance2to3.png: 5フレーム横並び（各200×330）、ずれなく steps で再生
 */
function drawLastBoss2To3Cutscene(c, game) {
    const CUTSCENE_DUR = 360;
    const t = game.stateT;
    const TOTAL_FRAMES = 5;
    const FRAME_DURATION = 42;  // 1コマ表示フレーム数（約0.7秒で5コマ＝約3.5秒）
    const ANIM_START_T = 30;

    c.fillStyle = "rgba(0,0,0,0.92)";
    c.fillRect(0, 0, CFG.W, CFG.H);
    const img = IMG.lastbossadvance2to3;
    if (img && img.naturalWidth) {
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        const frameWidth = iw / TOTAL_FRAMES;
        const frameHeight = ih;
        const elapsed = Math.max(0, t - ANIM_START_T);
        const currentFrame = Math.min(TOTAL_FRAMES - 1, Math.floor(elapsed / FRAME_DURATION));
        const sourceX = currentFrame * frameWidth;
        const scale = CFG.H / frameHeight;
        const drawW = frameWidth * scale;
        const drawH = CFG.H;
        const dx = CFG.W / 2 - drawW / 2;
        c.save();
        c.drawImage(
            img,
            sourceX, 0, frameWidth, frameHeight,
            dx, 0, drawW, drawH
        );
        c.restore();
    }
    if (t >= 50) {
        const line1 = "第二形態を打ち破った！だが…これは終わりではない。";
        const line2 = "残骸から生まれし、真の支配者が君臨する——猫神、覚醒。";
        const fade = Math.min(1, (t - 50) / 40);
        c.save();
        c.globalAlpha = fade * (t > CUTSCENE_DUR - 50 ? Math.max(0, (CUTSCENE_DUR - t) / 50) : 1);
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillStyle = "#e8c8ff";
        c.font = "bold 26px Cinzel, Georgia, serif";
        c.fillText(line1, CFG.W / 2, CFG.H / 2 + 180);
        c.fillStyle = "#ff4466";
        c.font = "bold 28px Cinzel, Georgia, serif";
        c.fillText(line2, CFG.W / 2, CFG.H / 2 + 218);
        c.restore();
    }
}

/**
 * ポーズオーバーレイを描画
 */
function drawPauseOverlay(c) {
    c.fillStyle = 'rgba(0,0,0,0.6)';
    c.fillRect(0, 0, CFG.W, CFG.H);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#e0cda7';
    c.font = 'bold 36px Cinzel, Georgia, serif';
    c.fillText('PAUSED', CFG.W / 2, CFG.H / 2 - 20);
    c.font = '18px serif';
    c.fillStyle = 'rgba(224,205,167,0.9)';
    c.fillText('— ESC / Ⅱ で再開 —', CFG.W / 2, CFG.H / 2 + 20);
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
}

global.CrowDestiny = global.CrowDestiny || {};
global.CrowDestiny.drawInstructionsScene = drawInstructions;
global.CrowDestiny.drawTitleScene = drawTitle;
global.CrowDestiny.drawGameOverScene = drawGameOver;
global.CrowDestiny.drawVictoryScene = drawVictory;
global.CrowDestiny.drawLastBoss2To3CutsceneScene = drawLastBoss2To3Cutscene;
global.CrowDestiny.drawPauseOverlay = drawPauseOverlay;

})(typeof window !== 'undefined' ? window : this);
