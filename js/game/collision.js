/**
 * CROW'S DESTINY — 当たり判定
 * プレイヤー弾・敵弾・敵・ボス・障害物・聖遺物の衝突判定を一括で行う。
 */
(function (global) {
'use strict';

const CFG = global.CrowDestiny.CFG;
const distSquared = global.CrowDestiny.distSquared;
const Relic = global.CrowDestiny.Relic;

/**
 * ゲーム内の全衝突判定を実行する。
 * @param {Object} game - Game インスタンス（crow, enemies, eBullets, boss, obstacles, relics, fx, txt, sound を参照）
 */
function checkCollisions(game) {
    const cr = game.crow;
    const { enemies, eBullets, boss, obstacles, relics, fx, txt, sound } = game;

    // 自弾 → 敵
    for (let fi = cr.feathers.length - 1; fi >= 0; fi--) {
        const f = cr.feathers[fi];
        if (!f.active) continue;
        for (const en of enemies) {
            if (!en.active || en.anim.state === 'DEATH') continue;
            const bulletR = (f.isBeam || f.isGalaxy) ? (f.isGalaxy ? 64 : 56) : 48;
            if (distSquared(f.x, f.y, en.x, en.y) < bulletR * bulletR) {
                const dmg = f.damage != null ? f.damage : (f.isBeam || f.isGalaxy) ? 14 + (cr.weaponLevel - 1) * 2 : 8 + (cr.weaponLevel - 1) * 2;
                en.takeDamage(dmg, fx);
                sound.playHit();
                f.active = false;
                if (en.hp <= 0) {
                    game.score += en.isBlue ? 500 : 100;
                    /** ガーゴイル(enemy2)は青穢ではない。スプライトがenemy2の場合は蒼穢カウントしない。 */
                    if (en.isBlue && en.spriteKey !== 'enemy2') {
                        game.blueK++;
                        fx.burst(en.x, en.y, "#44aaff", 30, 7);
                        sound.playBluePurify();
                        txt.show(`蒼穢 浄化 (${game.blueK}/3)`, "#44aaff", 80, 24, CFG.W / 2, 100);
                    }
                    if (Math.random() < (en.isBlue ? 0.5 : 0.15)) relics.push(new Relic(en.x, en.y));
                }
                break;
            }
        }
        // 自弾 → ボス
        if (boss && boss.active && boss.arrived && f.active && distSquared(f.x, f.y, boss.x, boss.y) < boss.hitRadius * boss.hitRadius) {
            if (boss.idx === 4 && boss.domeShieldT > 0) {
                f.active = false;
            } else {
                const bossDmg = f.damage != null ? f.damage : (f.isBeam || f.isGalaxy) ? 10 + cr.weaponLevel : 6 + cr.weaponLevel;
                boss.takeDamage(bossDmg, fx);
                sound.playHit();
                f.active = false;
            }
        }
        // 自弾 → ボス3 分身
        if (boss && boss.idx === 2 && boss.mirrorClones && f.active) {
            const bulletR = (f.isBeam || f.isGalaxy) ? (f.isGalaxy ? 64 : 56) : 48;
            const bulletR2 = bulletR * bulletR;
            for (const clone of boss.mirrorClones) {
                if (clone.hp <= 0) continue;
                if (distSquared(f.x, f.y, clone.x, clone.y) < bulletR2) {
                    clone.hp = 0;
                    sound.playHit();
                    f.active = false;
                    fx.burst(clone.x, clone.y, '#7B00FF', 12, 4);
                    break;
                }
            }
        }
        // 自弾 → ボス3 旋回コア（破壊可能）
        if (boss && boss.idx === 2 && boss.mimicCores && f.active) {
            const bulletR = (f.isBeam || f.isGalaxy) ? (f.isGalaxy ? 64 : 56) : 48;
            const coreR = 22;
            const hitR2 = (bulletR * 0.5 + coreR) * (bulletR * 0.5 + coreR);
            for (const core of boss.mimicCores) {
                if (core.hp <= 0) continue;
                if (distSquared(f.x, f.y, core.x, core.y) < hitR2) {
                    core.hp--;
                    sound.playHit();
                    f.active = false;
                    fx.burst(core.x, core.y, '#C39BFF', 10, 3);
                    if (core.hp <= 0) fx.burst(core.x, core.y, '#7B00FF', 16, 5);
                    break;
                }
            }
        }
    }

    // 群れカラス（赤スキル）→ 敵・ボス
    const flockR = 28;
    const flockR2 = flockR * flockR;
    const flockCrows = game.flockCrows || [];
    for (const fc of flockCrows) {
        if (!fc.active) continue;
        for (const en of enemies) {
            if (!en.active || en.anim.state === 'DEATH') continue;
            if (distSquared(fc.x, fc.y, en.x + (en.w || 20) / 2, en.y + (en.h || 16) / 2) < flockR2) {
                en.takeDamage(fc.damage || 12, fx);
                sound.playHit();
                fc.active = false;
                if (en.hp <= 0) {
                    game.score += en.isBlue ? 500 : 100;
                    if (en.isBlue && en.spriteKey !== 'enemy2') {
                        game.blueK++;
                        fx.burst(en.x, en.y, "#44aaff", 30, 7);
                        sound.playBluePurify();
                        txt.show(`蒼穢 浄化 (${game.blueK}/3)`, "#44aaff", 80, 24, CFG.W / 2, 100);
                    }
                    if (Math.random() < (en.isBlue ? 0.5 : 0.15)) relics.push(new Relic(en.x, en.y));
                }
                break;
            }
        }
        if (!fc.active) continue;
        if (boss && boss.active && boss.arrived && distSquared(fc.x, fc.y, boss.x, boss.y) < (boss.hitRadius + flockR) * (boss.hitRadius + flockR)) {
            if (boss.idx !== 4 || boss.domeShieldT <= 0) {
                boss.takeDamage(fc.damage || 12, fx);
                sound.playHit();
            }
            fc.active = false;
        }
    }

    // 灰オーブ（灰スキル3）→ 敵・ボス（小ダメージ・ゆっくり回転拡散）
    const grayOrbR = 14;
    const grayOrbR2 = grayOrbR * grayOrbR;
    const grayOrbs = game.grayOrbs || [];
    for (const o of grayOrbs) {
        if (!o.active) continue;
        for (const en of enemies) {
            if (!en.active || en.anim.state === 'DEATH') continue;
            if (distSquared(o.x, o.y, en.x + (en.w || 20) / 2, en.y + (en.h || 16) / 2) < grayOrbR2) {
                en.takeDamage(o.damage != null ? o.damage : 3, fx);
                sound.playHit();
                o.active = false;
                if (en.hp <= 0) {
                    game.score += en.isBlue ? 500 : 100;
                    if (en.isBlue && en.spriteKey !== 'enemy2') {
                        game.blueK++;
                        fx.burst(en.x, en.y, "#44aaff", 30, 7);
                        txt.show(`蒼穢 浄化 (${game.blueK}/3)`, "#44aaff", 80, 24, CFG.W / 2, 100);
                    }
                    if (Math.random() < (en.isBlue ? 0.5 : 0.15)) relics.push(new Relic(en.x, en.y));
                }
                break;
            }
        }
        if (!o.active) continue;
        if (boss && boss.active && boss.arrived && distSquared(o.x, o.y, boss.x, boss.y) < (boss.hitRadius + grayOrbR) * (boss.hitRadius + grayOrbR)) {
            if (boss.idx !== 4 || boss.domeShieldT <= 0) {
                boss.takeDamage(o.damage != null ? o.damage : 3, fx);
                sound.playHit();
            }
            o.active = false;
        }
    }

    // 雪（白スキル）→ 敵・ボス
    const snowR = 14;
    const snowR2 = snowR * snowR;
    const snowParticles = game.snowParticles || [];
    for (const s of snowParticles) {
        if (!s.active || Math.floor(s.life) % 4 !== 0) continue;
        const dmg = s.damage != null ? s.damage : 3;
        for (const en of enemies) {
            if (!en.active || en.anim.state === 'DEATH') continue;
            if (distSquared(s.x, s.y, en.x + (en.w || 20) / 2, en.y + (en.h || 16) / 2) < snowR2) {
                en.takeDamage(dmg, fx);
                if (en.hp <= 0) {
                    game.score += en.isBlue ? 500 : 100;
                    if (en.isBlue && en.spriteKey !== 'enemy2') {
                        game.blueK++;
                        fx.burst(en.x, en.y, "#44aaff", 30, 7);
                        sound.playBluePurify();
                        txt.show(`蒼穢 浄化 (${game.blueK}/3)`, "#44aaff", 80, 24, CFG.W / 2, 100);
                    }
                    if (Math.random() < (en.isBlue ? 0.5 : 0.15)) relics.push(new Relic(en.x, en.y));
                }
                break;
            }
        }
        if (boss && boss.active && boss.arrived && distSquared(s.x, s.y, boss.x, boss.y) < (boss.hitRadius + snowR) * (boss.hitRadius + snowR)) {
            if (boss.idx !== 4 || boss.domeShieldT <= 0) boss.takeDamage(dmg, fx);
        }
    }

    // 敵弾 → プレイヤー
    const playerBulletR = 11;
    const satelliteR = 18;
    for (const b of eBullets) {
        if (!b.active || b.noDamage) continue;
        const r = b.satellite ? satelliteR : playerBulletR;
        if (distSquared(b.x, b.y, cr.cx, cr.cy) < r * r) {
            cr.takeDamage(b.satellite ? 12 : 8, fx);
            if (b.satellite) fx.burst(b.x, b.y, '#00FFAA', 14, 5);
            b.active = false;
        }
    }

    // 敵 → プレイヤー（体当たり）
    const enemyHitR = 33;
    const enemyHitR2 = enemyHitR * enemyHitR;
    for (const en of enemies) {
        if (!en.active || en.anim.state === 'DEATH') continue;
        if (distSquared(en.x, en.y, cr.cx, cr.cy) < enemyHitR2) cr.takeDamage(10, fx);
    }

    // ボス → プレイヤー（体当たり）
        if (boss && boss.active && boss.arrived && distSquared(boss.x, boss.y, cr.cx, cr.cy) < boss.playerHitRadius * boss.playerHitRadius) {
        if (boss.idx === 0 && boss.dashT > 0) fx.shake = Math.max(fx.shake || 0, 25);
        // ボス5 電撃虫：発狂時は全身帯電で接触即死級の高ダメージ。ラスボスform1/2は攻撃力10%アップ
        let contactDmg = (boss.idx === 4 && boss.berserk) ? 28 : 15;
        if (boss.idx === 6 && (boss.form === 1 || boss.form === 2)) contactDmg = Math.ceil(contactDmg * 1.1);
        cr.takeDamage(contactDmg, fx);
        if (boss.idx === 4 && boss.berserk) fx.shake = Math.max(fx.shake || 0, 20);
        // ボス4 鉄の翼：回復なし（ヴァンパイアバイト削除）
    }

    // ボス5: 電撃虫ガーディアン — ドームシールド中の電撃フィールド＋発狂時は全身帯電（近づくだけでダメージ）
    if (boss && boss.active && boss.arrived && boss.idx === 4) {
        const fieldR2 = (boss.hitRadius * 2) * (boss.hitRadius * 2);
        const auraR2 = (boss.hitRadius * 2.2) * (boss.hitRadius * 2.2);
        const dist2 = distSquared(boss.x, boss.y, cr.cx, cr.cy);
        if (boss.domeShieldT > 0 && dist2 < fieldR2) cr.takeDamage(4, fx);
        if (boss.berserk && dist2 < auraR2) {
            boss.scarabotAuraTick = (boss.scarabotAuraTick || 0) + 1;
            if (boss.scarabotAuraTick % 6 === 0) cr.takeDamage(6, fx);
        }
    }

    // 障害物 → プレイヤー
    for (const ob of obstacles) {
        if (!ob.active) continue;
        if (ob.hits(cr.x, cr.y, cr.w, cr.h)) cr.takeDamage(6, fx);
    }

    // 聖遺物 → プレイヤー（取得）
    const relicR2 = CFG.RELIC_PICKUP_RADIUS * CFG.RELIC_PICKUP_RADIUS;
    for (const r of relics) {
        if (!r.active) continue;
        if (distSquared(r.x, r.y, cr.cx, cr.cy) < relicR2) {
            r.active = false;
            game.applyRelic(r);
        }
    }
}

global.CrowDestiny = global.CrowDestiny || {};
global.CrowDestiny.checkCollisions = checkCollisions;

})(typeof window !== 'undefined' ? window : this);
