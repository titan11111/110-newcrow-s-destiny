/**
 * CROW'S DESTINY — 敵まわり定数（面・振る舞い・スプライトレイアウト）
 */
(function (global) {
'use strict';

/**
 * stageIdx(0〜6) → スプライト
 * - エネミー2：1面・2面（stageIdx 0,1）
 * - エネミー3：3面（stageIdx 2）
 * - スチームウルフ：4面（stageIdx 3）
 * - メカニカルバット：5面（stageIdx 4）
 * - エネミー6：6面（stageIdx 5）
 * - エネミー7：7面（stageIdx 6）
 */
const STAGE_SPRITE_KEYS = {
    0: 'enemy2',
    1: 'enemy2',
    2: 'enemy3',
    3: 'steam_wolf',
    4: 'mechanical_bat',
    5: 'enemy6',
    6: 'enemy7'
};

const BEHAVIOR_POOL = {
    0: ['CHARGE', 'ZIGZAG'],
    1: ['TELEPORT', 'MIRROR'],
    2: ['ORBIT', 'SPIT'],
    3: ['DIVE', 'SCATTER'],
    4: ['STOMP', 'LASER'],
    5: ['SWARM', 'SHIELD'],
    6: ['VOID', 'PHASE']
};

const BLUE_MOVE_PATTERNS = [
    'STRAIGHT', 'SINE', 'DIAG_DOWN', 'DIAG_UP', 'ZIGZAG', 'ACCEL',
    'PAUSE_RUSH', 'WAVE', 'TRACK', 'SCATTER_MOVE'
];

function getBluePatternMaxIndex(stageIdx) {
    return Math.min(9, 2 + (stageIdx !== undefined ? stageIdx : 0));
}

/** enemy6: 5フレーム横並び（約180×300/フレーム）。ずれ防止のためフレーム幅は floor(画像幅/5) で算出 */
const ENEMY6_TOTAL_FRAMES = 5;
const SPRITE_LAYOUTS = {
    enemy2: { cols: 4, rows: 2 },
    enemy3: { cols: 6, rows: 1 },
    steam_wolf: { cols: 3, rows: 3 },
    mechanical_bat: { cols: 3, rows: 3 },
    enemy5: { cols: 6, rows: 1 },
    enemy6: { cols: ENEMY6_TOTAL_FRAMES, rows: 1, inset: 0, fallbackW: 900, fallbackH: 300 },
    enemy7: { cols: 3, rows: 2 }
};

const FLOAT_FRAME_INTERVAL = 8;
const HORIZONTAL_FLOAT_6 = { enemy5: true, enemy6: true };

global.CrowDestiny = global.CrowDestiny || {};
global.CrowDestiny.EnemyConfig = {
    STAGE_SPRITE_KEYS,
    BEHAVIOR_POOL,
    BLUE_MOVE_PATTERNS,
    getBluePatternMaxIndex,
    SPRITE_LAYOUTS,
    ENEMY6_TOTAL_FRAMES,
    FLOAT_FRAME_INTERVAL,
    HORIZONTAL_FLOAT_6
};

})(typeof window !== 'undefined' ? window : this);
