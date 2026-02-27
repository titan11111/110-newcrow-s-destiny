/**
 * CROW'S DESTINY — 敵エンティティ（本体・更新・描画の振り分け）
 */
(function (global) {
'use strict';

const CFG = global.CrowDestiny.CFG;
const Anim = global.CrowDestiny.Anim;
const ri = global.CrowDestiny.ri;
const Config = global.CrowDestiny.EnemyConfig;
const B = global.CrowDestiny.EnemyBehaviors;
const drawEnemy = global.CrowDestiny.EnemyDraw;

class Enemy {
    constructor(x, y, sd, isBlue = false, stageIdx = undefined) {
        this.x = x;
        this.y = y;
        this.isBlue = isBlue;
        this.color = isBlue ? sd.blueColor : sd.eColor;
        const mul = sd.enemyHpMul || 1;
        this.hp = Math.round((isBlue ? 45 : 16) * mul);
        this.maxHp = this.hp;
        this.active = true;
        this.w = 56;
        this.h = 48;
        this.vx = -1.5 - Math.random() * 1;
        this.vy = 0;
        this.timer = 0;
        this.hitFlash = 0;
        this.shootCD = ri(sd.enemyShootMin || 60, sd.enemyShootMax || 130);
        this.bulletSpd = sd.enemyBulletSpd || 3.0;
        this.sd = sd;
        this.anim = new Anim({
            FLOAT: { frames: 4, loop: true, speed: 0.55 },
            ATTACK: { frames: 4, loop: false, speed: 0.55 },
            HIT: { frames: 3, loop: false, speed: 1 },
            DEATH: { frames: 4, loop: false, speed: 1 }
        });
        this.baseY = y;
        this.glow = Math.random() * 6.28;
        const useSprite = arguments.length > 5 && arguments[5] === true;
        this.spriteKey = (stageIdx !== undefined && Config.STAGE_SPRITE_KEYS[stageIdx] && useSprite)
            ? Config.STAGE_SPRITE_KEYS[stageIdx] : null;
        const si = stageIdx !== undefined ? Math.min(stageIdx, 6) : 0;
        const pool = Config.BEHAVIOR_POOL[si] || Config.BEHAVIOR_POOL[0];
        this.behaviorType = pool[ri(0, pool.length - 1)];
        this.usePrediction = !isBlue && si >= 3 && Math.random() < 0.5;
        this.posHistory = [];
        if (this.isBlue) {
            const maxIdx = Config.getBluePatternMaxIndex(si);
            this.blueMoveType = ri(0, maxIdx);
        }
        const isStage1 = (this.sd && this.sd.id === 1);
        this.emergeT = (isStage1 && (this.behaviorType === 'CHARGE' || this.behaviorType === 'ZIGZAG'))
            ? (this.behaviorType === 'CHARGE' ? 42 : 28) : 0;
    }

    update(px, py, bullets, scrollSpd, fx) {
        if (this.anim.state === 'DEATH') {
            this.anim.update();
            if (this.anim.done) this.active = false;
            return;
        }
        this.timer++;
        this.anim.update();
        this.posHistory.push({ x: px, y: py });
        if (this.posHistory.length > 30) this.posHistory.shift();

        if (this.isBlue) B.updateBlue(this, px, py, bullets, scrollSpd);
        else if (this.spriteKey === 'enemy2') B.updateGargoyle(this, px, py, bullets, scrollSpd, fx);
        else if (this.spriteKey === 'enemy3') B.updateGhost(this, px, py, bullets, scrollSpd);
        else if (this.spriteKey === 'steam_wolf') B.updateSteamWolf(this, px, py, bullets, scrollSpd);
        else if (this.spriteKey === 'mechanical_bat') B.updateMechanicalBat(this, px, py, bullets, scrollSpd);
        else if (this.spriteKey === 'enemy5') B.updateCyborg(this, px, py, bullets, scrollSpd);
        else if (this.spriteKey === 'enemy6') B.updateBeast(this, px, py, bullets, scrollSpd, fx);
        else if (this.spriteKey === 'enemy7') B.updateCosmic(this, px, py, bullets, scrollSpd);
        else B.updateNormal(this, px, py, bullets, scrollSpd, fx);

        if (this.anim.state === 'ATTACK' && this.anim.done) this.anim.set('FLOAT');
        if (this.hitFlash > 0) this.hitFlash--;
        if (this.x < -80) this.active = false;
    }

    takeDamage(amt, fx) {
        this.hp -= amt;
        this.hitFlash = 4;
        if (this.hp <= 0) {
            this.anim.set('DEATH');
            fx.burst(this.x, this.y, this.color, this.isBlue ? 30 : 15, this.isBlue ? 6 : 4);
        }
    }

    draw(c) {
        if (drawEnemy) drawEnemy(this, c);
    }

    get cx() { return this.x; }
    get cy() { return this.y; }
}

global.CrowDestiny = global.CrowDestiny || {};
global.CrowDestiny.Enemy = Enemy;

})(typeof window !== 'undefined' ? window : this);
