/**
 * CROW'S DESTINY — 敵・障害物のスポーン
 * 出現位置・間隔は config と stages データに依存する。
 */
(function (global) {
'use strict';

const CFG = global.CrowDestiny.CFG;
const STAGES = global.CrowDestiny.STAGES;
const rr = global.CrowDestiny.rr;
const ri = global.CrowDestiny.ri;
const Enemy = global.CrowDestiny.Enemy;
const spawnObstacle = global.CrowDestiny.spawnObstacle;

const SPAWN_RIGHT = CFG.W + (CFG.SPAWN_OFFSET_RIGHT ?? 40);
const SPAWN_Y_MIN = CFG.SPAWN_Y_MIN ?? 60;
const SPAWN_Y_MAX = CFG.H - (CFG.SPAWN_Y_MAX_OFFSET ?? 80);
const BLUE_Y_MIN = CFG.BLUE_SPAWN_Y_MIN ?? 80;
const BLUE_Y_MAX = CFG.H - (CFG.BLUE_SPAWN_Y_MAX_OFFSET ?? 100);
const STAGES_WITH_SPRITE = [1, 2, 3, 4, 5, 6];
const SPRITE_CHANCE = 0.3;
/** 4面( stageIdx 3 ): スチームウルフ30% / 通常60% / 青穢10% */
const STAGE3_STEAM_WOLF_RATIO = 0.3;
const STAGE3_BLUE_RATIO = 0.1;

/**
 * 敵をスポーンする。通常敵は右端から、青穢も右端から。出現間隔はステージデータで制御。
 */
function spawnEnemies(game) {
    if (game.arena) return;
    const sd = game.sd;

    game.eCD--;
    if (game.eCD <= 0) {
        game.eCD = ri(sd.spawnMin || 40, sd.spawnMax || 80);
        let useSprite;
        if (game.stageIdx === 3) {
            const r = Math.random();
            if (r < STAGE3_BLUE_RATIO && game.blueK < 3) {
                const blueY = rr(BLUE_Y_MIN, BLUE_Y_MAX);
                game.enemies.push(new Enemy(SPAWN_RIGHT, blueY, sd, true, game.stageIdx, false));
                return;
            }
            useSprite = r < STAGE3_BLUE_RATIO + STAGE3_STEAM_WOLF_RATIO;
        } else {
            useSprite = STAGES_WITH_SPRITE.indexOf(game.stageIdx) >= 0 && (game.stageIdx === 4 || Math.random() < SPRITE_CHANCE);
        }
        const isStage6Enemy7 = game.stageIdx === 6 && useSprite;
        const spawnSwarm = isStage6Enemy7 && Math.random() < 0.25;

        if (spawnSwarm) {
            const groupId = Date.now();
            const groupY = rr(SPAWN_Y_MIN, SPAWN_Y_MAX);
            for (let i = 0; i < 3; i++) {
                const e = new Enemy(SPAWN_RIGHT + 50 + i * 20, groupY, sd, false, game.stageIdx, true);
                e.behaviorType = 'SWARM';
                e.groupId = groupId;
                e.groupPhase = i / 3;
                game.enemies.push(e);
            }
        } else if (game.stageIdx === 2 && Math.random() < 0.42) {
            /** 3面: 3体並んで大きな波のような動きで襲ってくる。キャラの4分の1以上距離をあける */
            const waveY = rr(SPAWN_Y_MIN, SPAWN_Y_MAX);
            const waveSpacing = 56 + Math.floor(56 / 4); /* キャラ幅 + 4分の1 ≈ 70 */
            for (let i = 0; i < 3; i++) {
                const e = new Enemy(SPAWN_RIGHT + i * waveSpacing, waveY, sd, false, game.stageIdx, useSprite);
                e.formation = 'WAVE';
                e.groupPhase = i / 3;
                e.baseY = waveY;
                game.enemies.push(e);
            }
        } else {
            const y = rr(SPAWN_Y_MIN, SPAWN_Y_MAX);
            game.enemies.push(new Enemy(SPAWN_RIGHT, y, sd, false, game.stageIdx, useSprite));
        }
    }

    if (game.blueK < 3 && game.stageIdx !== 3) {
        game.blueCD--;
        if (game.blueCD <= 0) {
            game.blueCD = ri(280, 480);
            /** 2面では青穢にガーゴイル(enemy2)スプライトを使わない。ガーゴイル＝通常敵のみ。4面は10%ロールでスポーン済み。 */
            const useSpriteBlue = game.stageIdx !== 1 && STAGES_WITH_SPRITE.indexOf(game.stageIdx) >= 0 && Math.random() < SPRITE_CHANCE;
            const blueY = rr(BLUE_Y_MIN, BLUE_Y_MAX);
            game.enemies.push(new Enemy(SPAWN_RIGHT, blueY, sd, true, game.stageIdx, useSpriteBlue));
        }
    }
}

/**
 * 障害物をスポーンする。
 * @param {Object} game - Game インスタンス
 */
function spawnObstacles(game) {
    if (game.arena) return;
    game.obsCD--;
    if (game.obsCD <= 0) {
        game.obsCD = ri(80, 180);
        game.obstacles.push(spawnObstacle(game.stageIdx));
    }
}

global.CrowDestiny = global.CrowDestiny || {};
global.CrowDestiny.spawnEnemies = spawnEnemies;
global.CrowDestiny.spawnObstacles = spawnObstacles;

})(typeof window !== 'undefined' ? window : this);
