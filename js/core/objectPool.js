/**
 * CROW'S DESTINY — オブジェクトプール
 * 弾・パーティクル等の生成/破棄を減らし GC を抑えてフレームの安定化を図る。
 */
(function (global) {
'use strict';

/**
 * 汎用オブジェクトプール
 * @param {Function} createFn - 新規オブジェクトを返す関数
 * @param {Function} resetFn - プールに返す前にオブジェクトをリセットする関数
 * @param {number} initialSize - 初期プール数
 */
function ObjectPool(createFn, resetFn, initialSize) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.pool = [];
    this.active = [];
    const size = Math.max(0, initialSize || 100);
    for (let i = 0; i < size; i++) this.pool.push(this.createFn());
}

ObjectPool.prototype.get = function () {
    const obj = this.pool.length > 0 ? this.pool.pop() : this.createFn();
    this.active.push(obj);
    return obj;
};

ObjectPool.prototype.release = function (obj) {
    const i = this.active.indexOf(obj);
    if (i !== -1) {
        this.active.splice(i, 1);
        this.resetFn(obj);
        this.pool.push(obj);
    }
};

/** active のうち active フラグが false のものをプールに返す */
ObjectPool.prototype.releaseInactive = function () {
    for (let i = this.active.length - 1; i >= 0; i--) {
        if (!this.active[i].active) this.release(this.active[i]);
    }
};

/** すべての active をプールに返す（ステージ開始・リスタート時） */
ObjectPool.prototype.releaseAll = function () {
    while (this.active.length > 0) this.release(this.active[0]);
};

/** 敵弾の同時存在上限（ステージ6等で画面が弾だらけになるのを防ぐ） */
const MAX_ACTIVE_BULLETS = 220;

/** 敵弾用: プールから取得して props をマージ。bullets.push({...}) の代わりに使う配列風アダプタ */
function createBulletPoolAdapter(pool) {
    return {
        _pool: pool,
        push: function (props) {
            if (this._pool.active.length >= MAX_ACTIVE_BULLETS) return null;
            const b = this._pool.get();
            b.x = 0; b.y = 0; b.vx = 0; b.vy = 0; b.active = true; b.color = '#fff'; b.r = 5;
            if (props) Object.assign(b, props);
            return b;
        },
        get length() { return this._pool.active.length; },
        forEach: function (f) { this._pool.active.forEach(f); },
        filter: function (f) { return this._pool.active.filter(f); },
        [Symbol.iterator]: function () { return this._pool.active[Symbol.iterator](); }
    };
}

function createBullet() {
    return { x: 0, y: 0, vx: 0, vy: 0, active: false, color: '#fff', r: 5 };
}

function resetBullet(b) {
    b.active = false;
    b.x = 0; b.y = 0; b.vx = 0; b.vy = 0;
    b.color = '#fff'; b.r = 5;
    delete b.homing; delete b.noDamage; delete b.satellite;
    delete b.life; delete b.drag; delete b.accel; delete b.accelMax;
    delete b.glitch; delete b.glitchAngle; delete b.phaseAt; delete b.phase; delete b.phaseTargetX; delete b.phaseTargetY;
    delete b.curve; delete b.curveDecay;
    delete b.hue; delete b.splitAt; delete b.splitCount;
    delete b.gravity; delete b.explosive; delete b.explosionRadius; delete b.explosionDamage;
}

/** ゲーム用の敵弾プールとアダプタを生成 */
function createGameBulletPool(initialSize) {
    const pool = new ObjectPool(createBullet, resetBullet, initialSize || 200);
    return { pool, adapter: createBulletPoolAdapter(pool) };
}

global.CrowDestiny = global.CrowDestiny || {};
global.CrowDestiny.ObjectPool = ObjectPool;
global.CrowDestiny.createBulletPoolAdapter = createBulletPoolAdapter;
global.CrowDestiny.createGameBulletPool = createGameBulletPool;

})(typeof window !== 'undefined' ? window : this);
