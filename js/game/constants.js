/**
 * CROW'S DESTINY — ゲーム状態定数
 * 状態名を一箇所で管理し、typo を防ぐ。
 */
(function (global) {
'use strict';

const STATE = {
    INSTRUCTIONS: 'INSTRUCTIONS',
    TITLE: 'TITLE',
    NARRATION: 'NARRATION',
    PLAYING: 'PLAYING',
    BOSS_INTRO: 'BOSS_INTRO',
    BOSS_FIGHT: 'BOSS_FIGHT',
    /** 撃破直後の戦闘フリーズ（弾・残像を止めてからクリア→STAGE_CLEARへ） */
    STAGE_CLEAR_FREEZE: 'STAGE_CLEAR_FREEZE',
    STAGE_CLEAR: 'STAGE_CLEAR',
    GAME_OVER: 'GAME_OVER',
    VICTORY: 'VICTORY',
    LAST_BOSS_2TO3_CUTSCENE: 'LAST_BOSS_2TO3_CUTSCENE'
};

/** 一時停止が可能な状態 */
const PAUSABLE_STATES = [
    STATE.PLAYING,
    STATE.BOSS_INTRO,
    STATE.BOSS_FIGHT,
    STATE.STAGE_CLEAR_FREEZE,
    STATE.STAGE_CLEAR,
    STATE.LAST_BOSS_2TO3_CUTSCENE
];

global.CrowDestiny = global.CrowDestiny || {};
global.CrowDestiny.STATE = STATE;
global.CrowDestiny.PAUSABLE_STATES = PAUSABLE_STATES;

})(typeof window !== 'undefined' ? window : this);
