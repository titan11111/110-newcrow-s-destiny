/**
 * CROW'S DESTINY — ゲーム設定・定数
 */
(function (global) {
'use strict';

/** iOS/Retina でキャンバスを window サイズでリサイズする場合の devicePixelRatio 上限（描画負荷軽減） */
const MAX_DEVICE_PIXEL_RATIO = 1.5;
/** true または URL に #fps があるとき FPS を画面左上に表示（最適化検証用） */
const DEBUG_FPS = false;

const CFG = {
    W: 960,
    H: 540,
    SCROLL: 2.5,
    PLAYER_SPD: 6.6,   /* 5.5 × 1.2 = 6.6 (iOS向け速度調整) */
    DASH_SPD: 21,  /* 1.5倍（14*1.5）でダッシュ距離を延長 */
    /** ダッシュチャージ数（連続ダッシュ用） */
    DASH_CHARGES: 2,
    /** 1チャージ回復にかかるフレーム数 */
    DASH_CHARGE_CD: 26,
    MARGIN: 30,
    /** 聖遺物取得：プレイヤー中心とアイテム中心の距離がこの値未満で取得（ピクセル） */
    RELIC_PICKUP_RADIUS: 20,
    /** 敵スポーン：画面右端からのオフセット（前方＝右から出現） */
    SPAWN_OFFSET_RIGHT: 40,
    /** 通常敵の出現 Y 範囲 */
    SPAWN_Y_MIN: 60,
    SPAWN_Y_MAX_OFFSET: 80,
    /** 青穢の出現 Y 範囲 */
    BLUE_SPAWN_Y_MIN: 80,
    BLUE_SPAWN_Y_MAX_OFFSET: 100
};

const ANIM_FPS = 12;
const FRAME_DUR = Math.floor(60 / ANIM_FPS);

const ASSETS = {
    title: 'images/Bauhaus-inspired_ending_illustration_with_hopeful_-1771383063897.png',
    bg: 'images/Remove_background_from_this_image_to_create_transp-1771383320321.png',
    crowSheet: 'images/Remove_background_from_this_image_to_create_transp-1771383241042.png',
    enemySheet: 'images/Remove_background_from_this_image_to_create_transp-1771383161769.png',
    /* 敵スプライト（ステージ2・3・4・5・6・7で30%出現。左向き） */
    enemy2: 'images/enemy2.png',
    enemy3: 'images/enemy3.png',
    steam_wolf: 'images/Remove_background_from_this_wolf_beast_sprite_shee-1772196324122.png',
    mechanical_bat: 'images/Remove_background_from_this_bat_beast_sprite_sheet-1772196311756.png',
    enemy5: 'images/enemy5.png',
    enemy6: 'images/enemy6.png',
    enemy7: 'images/enemy7.png',
    /* ボスの画像（ステージ1〜7に対応） */
    /* BOSS1: 骸骨剣士 3×3グリッド 9フレーム, 各セル約337×337px (idle/windup/thrust/guard/slash/charge_ready/taunt/run/hurt) */
    boss1: 'images/boss1.png',
    /* BOSS2: 三角ロボ 3×2グリッド 6フレーム (前面左/側面/前面右, 後面左/前面正面/発射) */
    boss2: 'images/boss2.png',
    /* BOSS3: ミミックスター 差し替え用単一画像（1枚絵） */
    boss3: 'images/boss3.png',
    /* BOSS4: 鉄の翼 Iron Wing 3×2グリッド 6フレーム (FLAP/GLIDE/DIVE) */
    boss4: 'images/boss4.png',
    /* BOSS5: 鋼甲蟲 SCARABOT 3×2グリッド 6フレーム (walk/trigger/enrage/burst) */
    boss5: 'images/boss5.png',
    /* BOSS6: 雪の女王 Snow Queen 3×2グリッド 6フレーム (IDLE/SHOOT/ENRAGE/BLIZZARD/SHIELD/BURST) */
    boss6: 'images/boss6.png',
    /* BOSS7: ラスボス第1形態（ヴォイド）2列×3行 6フレーム (idle [0,1] / charge [0,1,2] / burst 3 / discharge [4,5] / full) */
    boss7: 'images/boss7.png',
    /* ラスボス第2形態: 3列×2行 6フレームのスプライトシート */
    lastboss2: 'images/lastboss2.png',
    lastboss3: 'images/lastboss3.png',
    /** ラスボス 第二形態→第三形態（猫神）移行演出用・左から右に変化する5段階画像 */
    lastbossadvance2to3: 'images/lastbossadvance2to3.png',
    items: 'images/Remove_background_from_this_image_to_create_transp-1771383091874.png'
};

const AUDIO_ASSETS = {
    seItem: null
};

/** BGM: ステージ1-7、通常ボス(1-6用1本)、ラスボス3形態(boss7→lastboss→lastboss2)、オープニング、エンディング。ゲームオーバーは別用意。 */
const BGM_ASSETS = {
    opening: 'audio/opening.mp3',
    stage1: 'audio/stage1.mp3', stage2: 'audio/stage2.mp3', stage3: 'audio/stage3.mp3',
    stage4: 'audio/stage4.mp3', stage5: 'audio/stage5.mp3', stage6: 'audio/stage6.mp3', stage7: 'audio/stage7.mp3',
    boss: 'audio/boss.mp3',
    boss7: 'audio/boss7.mp3',
    lastboss1: 'audio/lastboss.mp3',
    lastboss2: 'audio/lastboss2.mp3',
    ending: 'audio/endding.mp3',
    gameover: 'audio/gameover.mp3'
};

global.CrowDestiny = global.CrowDestiny || {};
global.CrowDestiny.CFG = CFG;
global.CrowDestiny.MAX_DEVICE_PIXEL_RATIO = MAX_DEVICE_PIXEL_RATIO;
global.CrowDestiny.DEBUG_FPS = DEBUG_FPS;
global.CrowDestiny.ANIM_FPS = ANIM_FPS;
global.CrowDestiny.FRAME_DUR = FRAME_DUR;
global.CrowDestiny.ASSETS = ASSETS;
global.CrowDestiny.AUDIO_ASSETS = AUDIO_ASSETS;
global.CrowDestiny.BGM_ASSETS = BGM_ASSETS;

})(typeof window !== 'undefined' ? window : this);
