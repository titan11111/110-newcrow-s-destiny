/**
 * CROW'S DESTINY — HUD（スコア・HP・ダッシュCD・ステージ表示）
 */
(function (global) {
'use strict';

const CFG = global.CrowDestiny.CFG;
const STAGES = global.CrowDestiny.STAGES;
const clamp = global.CrowDestiny.clamp;

function drawHUD(c, crow, score, stIdx, blueK) {
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
