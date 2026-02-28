/**
 * CROW'S DESTINY — HUD 3カラム構成
 *  左: カラスゲージ（HP / DASH / 覚醒 / 障壁 / スキルスロット）
 *  中: ボスHP（boss.jsで描画）
 *  右: SCORE / STAGE / 蒼穢撃破数
 */
(function (global) {
'use strict';

const CFG = global.CrowDestiny.CFG;
const STAGES = global.CrowDestiny.STAGES;
const clamp = global.CrowDestiny.clamp;

/** スキルスロットの色（紫・緑・灰・赤・青・白） */
const ABILITY_SLOT_COLORS = ['#9B59D6', '#2ECC71', '#7F8C8D', '#E74C3C', '#3498DB', '#ECF0F1'];
const ABILITY_SLOT_COUNT  = 6;
const ABILITY_SLOT_WIDTH  = 42;   /* 左寄せに合わせてコンパクト化 */
const ABILITY_SLOT_HEIGHT = 18;
const ABILITY_SLOT_GAP    = 6;
const ABILITY_SLOT_X      = 14;   /* 左端から開始 */
const ABILITY_SLOT_Y      = 64;   /* HP/DASHバーの下 */

function lightenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, Math.max(0, (num >> 16) + amt));
    const G = Math.min(255, Math.max(0, (num >> 8 & 0xFF) + amt));
    const B = Math.min(255, Math.max(0, (num & 0xFF) + amt));
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

function drawAbilitySlots(c, crow) {
    const unlocked = crow.unlockedBossAbilities || [];
    const unlockedIndices = [0,1,2,3,4,5].filter(i => unlocked[i] === true);
    const nUnlocked = unlockedIndices.length;
    const slotIdx = nUnlocked > 0 ? Math.min(crow.currentSkillSlotIndex ?? 0, nUnlocked - 1) : -1;
    const selectedSlot = nUnlocked > 0 ? unlockedIndices[slotIdx] : -1;

    for (let i = 0; i < ABILITY_SLOT_COUNT; i++) {
        const x = ABILITY_SLOT_X + i * (ABILITY_SLOT_WIDTH + ABILITY_SLOT_GAP);
        const y = ABILITY_SLOT_Y;
        const isUnlocked = unlocked[i] === true;
        const isSelected = i === selectedSlot;
        if (isUnlocked) {
            const color = ABILITY_SLOT_COLORS[i];
            c.shadowBlur   = isSelected ? 18 : 10;
            c.shadowColor  = isSelected ? '#ffffff' : color;
            c.fillStyle    = color;
            c.fillRect(x, y, ABILITY_SLOT_WIDTH, ABILITY_SLOT_HEIGHT);
            c.shadowBlur   = 0;
            c.strokeStyle  = lightenColor(color, 35);
            c.lineWidth    = 2;
            c.strokeRect(x, y, ABILITY_SLOT_WIDTH, ABILITY_SLOT_HEIGHT);
            if (isSelected) {
                c.strokeStyle = 'rgba(255,255,255,0.95)';
                c.lineWidth   = 2;
                c.strokeRect(x - 1, y - 1, ABILITY_SLOT_WIDTH + 2, ABILITY_SLOT_HEIGHT + 2);
            }
        } else {
            c.fillStyle   = 'rgba(20,15,30,0.55)';
            c.fillRect(x, y, ABILITY_SLOT_WIDTH, ABILITY_SLOT_HEIGHT);
            c.strokeStyle = 'rgba(160,148,180,0.45)';
            c.lineWidth   = 1.5;
            c.strokeRect(x, y, ABILITY_SLOT_WIDTH, ABILITY_SLOT_HEIGHT);
        }
    }
}

function drawHUD(c, crow, score, stIdx, blueK) {
    const BAR_W = 200;  /* HP/DASHバーの幅 */
    const LX    = 14;   /* 左列 x 開始位置 */

    /* =====================================================
       左列: カラスゲージ
       ===================================================== */

    /* HP バー */
    c.fillStyle = 'rgba(180,160,140,0.55)'; c.font = '10px serif';
    c.fillText('HP', LX, 10);
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(LX, 12, BAR_W, 11);
    const hpR = clamp(crow.hp / crow.maxHp, 0, 1);
    c.fillStyle = hpR > 0.5 ? '#cc2222' : hpR > 0.25 ? '#cc6600' : '#ff0000';
    c.fillRect(LX + 1, 13, (BAR_W - 2) * hpR, 9);

    /* DASH チャージバー */
    c.fillStyle = 'rgba(180,160,140,0.55)'; c.font = '10px serif';
    c.fillText('DASH', LX, 30);
    const maxCh  = CFG.DASH_CHARGES ?? 2;
    const cdMax  = CFG.DASH_CHARGE_CD ?? 26;
    const dashFill = crow.dashCharges != null
        ? (crow.dashCharges / maxCh) + (crow.dashCharges < maxCh && crow.dashChargeCD != null
            ? (1 - crow.dashChargeCD / cdMax) / maxCh : 0) : 1;
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(LX, 32, BAR_W, 7);
    c.fillStyle = (crow.dashCharges != null && crow.dashCharges > 0) ? '#6688cc' : '#4466aa';
    c.fillRect(LX + 1, 33, Math.min(BAR_W - 2, (BAR_W - 2) * dashFill), 5);

    /* 覚醒レベル */
    c.fillStyle = '#e0cda7'; c.font = '11px serif';
    c.fillText(`覚醒 Lv.${crow.weaponLevel}`, LX, 50);

    /* 障壁（バリア残時間） */
    if (crow.barrier > 0) {
        const hits = crow.barrierHits || 1;
        const bCol = hits >= 3 ? '#aaeeff' : hits === 2 ? '#44aaff' : '#ff88cc';
        c.fillStyle = bCol; c.font = '11px serif';
        c.fillText(`障壁: ${Math.ceil(crow.barrier / 60)}s  ×${hits}`, LX, 62);
    }

    /* スキルスロット（左寄せ） */
    drawAbilitySlots(c, crow);

    /* スキル CD 情報（スロットの下） */
    if (crow.unlockedBossAbilities && crow.unlockedBossAbilities.some(Boolean)) {
        const unlockedIndices = [0,1,2,3,4,5,6].filter(i => crow.unlockedBossAbilities[i]);
        const nUnlocked   = unlockedIndices.length;
        const slotIdx     = Math.min(crow.currentSkillSlotIndex ?? 0, nUnlocked - 1);
        const currentIdx  = nUnlocked > 0 ? unlockedIndices[slotIdx] : -1;
        const yTxt        = ABILITY_SLOT_Y + ABILITY_SLOT_HEIGHT + 11;
        c.fillStyle = '#cc88ff'; c.font = '10px serif';
        c.fillText(`スキル ${slotIdx + 1}/${nUnlocked}`, LX, yTxt);
        if (currentIdx >= 0) {
            const cd   = (crow.bossAbilityCD && crow.bossAbilityCD[currentIdx]) || 0;
            const bW   = 80; const bH = 4; const yBar = yTxt + 3;
            c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(LX, yBar, bW, bH);
            c.fillStyle = cd > 0 ? '#6644aa' : '#cc88ff';
            c.fillRect(LX + 1, yBar + 1, Math.max(0, (bW - 2) * (1 - cd / 300)), bH - 2);
        }
    }

    /* =====================================================
       右列: スコア / ステージ / 蒼穢撃破数
       ===================================================== */
    c.textAlign = 'right';
    const RX = CFG.W - 12;

    c.fillStyle = '#e0cda7'; c.font = '20px serif';
    c.fillText(`SCORE: ${score}`, RX, 22);

    c.fillStyle = '#aa8866'; c.font = '13px serif';
    c.fillText(`STAGE  ${stIdx + 1} / ${STAGES.length}`, RX, 40);

    c.fillStyle = '#44aaff'; c.font = '16px serif';
    c.fillText(`蒼穢  ${blueK} / 3`, RX, 60);

    c.textAlign = 'left';
}

global.CrowDestiny = global.CrowDestiny || {};
global.CrowDestiny.drawHUD = drawHUD;

})(typeof window !== 'undefined' ? window : this);
