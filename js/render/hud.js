/**
 * CROW'S DESTINY — HUD（スコア・HP・ダッシュCD・ステージ表示・BOSS能力スロット）
 */
(function (global) {
'use strict';

const CFG = global.CrowDestiny.CFG;
const STAGES = global.CrowDestiny.STAGES;
const clamp = global.CrowDestiny.clamp;

/** BOSS1〜6 対応スキルスロットの色（紫・緑・灰・赤・青・白） */
const ABILITY_SLOT_COLORS = ['#9B59D6', '#2ECC71', '#7F8C8D', '#E74C3C', '#3498DB', '#ECF0F1'];
const ABILITY_SLOT_COUNT = 6;
const ABILITY_SLOT_WIDTH = 62;
const ABILITY_SLOT_HEIGHT = 20;   /* 12→20: iOSで縮小表示されても視認できる高さ */
const ABILITY_SLOT_GAP = 10;
const ABILITY_SLOT_Y = 8;        /* 38→8: 画面最上部に配置、SCOREテキストと干渉しない */

function lightenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, Math.max(0, (num >> 16) + amt));
    const G = Math.min(255, Math.max(0, (num >> 8 & 0xFF) + amt));
    const B = Math.min(255, Math.max(0, (num & 0xFF) + amt));
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

function drawAbilitySlots(c, crow) {
    const W = CFG.W;
    const totalWidth = (ABILITY_SLOT_WIDTH * ABILITY_SLOT_COUNT) + (ABILITY_SLOT_GAP * (ABILITY_SLOT_COUNT - 1));
    const startX = (W - totalWidth) / 2;
    const unlocked = crow.unlockedBossAbilities || [];
    const unlockedIndices = [0, 1, 2, 3, 4, 5].filter(i => unlocked[i] === true);
    const nUnlocked = unlockedIndices.length;
    const slotIdx = nUnlocked > 0 ? Math.min(crow.currentSkillSlotIndex ?? 0, nUnlocked - 1) : -1;
    const selectedSlot = nUnlocked > 0 ? unlockedIndices[slotIdx] : -1;
    for (let i = 0; i < ABILITY_SLOT_COUNT; i++) {
        const x = startX + i * (ABILITY_SLOT_WIDTH + ABILITY_SLOT_GAP);
        const y = ABILITY_SLOT_Y;
        const isUnlocked = unlocked[i] === true;
        const isSelected = i === selectedSlot;
        if (isUnlocked) {
            const color = ABILITY_SLOT_COLORS[i];
            c.shadowBlur = isSelected ? 20 : 12;
            c.shadowColor = isSelected ? '#ffffff' : color;
            c.fillStyle = color;
            c.fillRect(x, y, ABILITY_SLOT_WIDTH, ABILITY_SLOT_HEIGHT);
            c.shadowBlur = 0;
            c.strokeStyle = lightenColor(color, 35);
            c.lineWidth = 2;
            c.strokeRect(x, y, ABILITY_SLOT_WIDTH, ABILITY_SLOT_HEIGHT);
            if (isSelected) {
                c.strokeStyle = 'rgba(255, 255, 255, 0.95)';
                c.lineWidth = 3;
                c.strokeRect(x - 1, y - 1, ABILITY_SLOT_WIDTH + 2, ABILITY_SLOT_HEIGHT + 2);
            }
        } else {
            /* 未解放スロット: 暗い塗り＋明るめの枠線でiOSでも視認できるよう改善 */
            c.fillStyle = 'rgba(20, 15, 30, 0.55)';
            c.fillRect(x, y, ABILITY_SLOT_WIDTH, ABILITY_SLOT_HEIGHT);
            c.strokeStyle = 'rgba(160, 148, 180, 0.55)';
            c.lineWidth = 2;
            c.strokeRect(x, y, ABILITY_SLOT_WIDTH, ABILITY_SLOT_HEIGHT);
        }
    }
}

function drawHUD(c, crow, score, stIdx, blueK) {
    drawAbilitySlots(c, crow);
    const sd = STAGES[stIdx];
    c.fillStyle = "#e0cda7"; c.font = "22px serif"; c.fillText(`SCORE: ${score}`, 20, 32);
    c.font = "15px serif"; c.fillStyle = "#aa8866"; c.fillText(`— ${sd.name} —`, 20, 54);
    c.fillStyle = "rgba(0,0,0,0.5)"; c.fillRect(18, 60, 164, 12);
    const hpR = clamp(crow.hp / crow.maxHp, 0, 1); c.fillStyle = hpR > 0.5 ? "#cc2222" : hpR > 0.25 ? "#cc6600" : "#ff0000"; c.fillRect(20, 62, 160 * hpR, 8);
    /* ダッシュチャージ（2本・回復ゲージ） */
    { const maxCh = CFG.DASH_CHARGES ?? 2; const cdMax = CFG.DASH_CHARGE_CD ?? 26; const fill = crow.dashCharges != null ? (crow.dashCharges / maxCh) + (crow.dashCharges < maxCh && crow.dashChargeCD != null ? (1 - crow.dashChargeCD / cdMax) / maxCh : 0) : 1; c.fillStyle = "rgba(0,0,0,0.5)"; c.fillRect(18, 76, 164, 6); c.fillStyle = (crow.dashCharges != null && crow.dashCharges > 0) ? "#6688cc" : "#4466aa"; c.fillRect(20, 77, Math.min(160, 160 * fill), 4); }
    c.fillStyle = "#e0cda7"; c.font = "13px serif"; c.fillText(`覚醒: Lv.${crow.weaponLevel}`, 20, 100);
    if (crow.barrier > 0) { c.fillStyle = "#aaeeff"; c.fillText(`障壁: ${Math.ceil(crow.barrier / 60)}s`, 20, 116); }
    if (crow.unlockedBossAbilities && crow.unlockedBossAbilities.some(Boolean)) {
        const unlockedIndices = [0, 1, 2, 3, 4, 5, 6].filter(i => crow.unlockedBossAbilities[i]);
        const nUnlocked = unlockedIndices.length;
        const slotIdx = Math.min(crow.currentSkillSlotIndex ?? 0, nUnlocked - 1);
        const currentIdx = nUnlocked > 0 ? unlockedIndices[slotIdx] : -1;
        c.fillStyle = "#cc88ff"; c.font = "11px serif";
        c.fillText(`スキル ${slotIdx + 1}/${nUnlocked}${currentIdx >= 0 ? " (面" + (currentIdx + 1) + ")" : ""}`, 20, 118);
        if (currentIdx >= 0) {
            const cdMax = 300;
            const cd = (crow.bossAbilityCD && crow.bossAbilityCD[currentIdx]) || 0;
            const barW = 80; const barH = 6; const y = 122;
            c.fillStyle = "rgba(0,0,0,0.5)"; c.fillRect(20, y, barW, barH);
            const ratio = 1 - cd / cdMax;
            c.fillStyle = cd > 0 ? "#6644aa" : "#cc88ff";
            c.fillRect(21, y + 1, Math.max(0, (barW - 2) * ratio), barH - 2);
        }
    }
    c.fillStyle = "#44aaff"; c.font = "18px serif"; c.fillText(`蒼穢: ${blueK} / 3`, CFG.W - 140, 32);
    c.fillStyle = "#aa8866"; c.font = "13px serif"; c.fillText(`STAGE ${stIdx + 1} / ${STAGES.length}`, CFG.W - 140, 52);
}

global.CrowDestiny = global.CrowDestiny || {};
global.CrowDestiny.drawHUD = drawHUD;

})(typeof window !== 'undefined' ? window : this);
