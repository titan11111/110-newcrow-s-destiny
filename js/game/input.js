/**
 * CROW'S DESTINY — ゲーム入力（タッチ・キー・設定UI）
 * ボタン・タッチバインドとジョイスティック設定オーバーレイの初期化。
 */
(function (global) {
'use strict';

const saveJoystickSettings = global.CrowDestiny.saveJoystickSettings;
const applyDeadZoneAndSensitivity = global.CrowDestiny.applyDeadZoneAndSensitivity;

/**
 * オンスクリーンボタンとタッチ入力をゲームの keys にバインドする。
 * @param {Object} game - Game インスタンス（keys, togglePauseIfAllowed, paused を参照）
 */
function setupTouch(game) {
    const k = (key, val) => { game.keys[key] = val; };
    /** 打感: 振動（Android）＋タップ時クラス（iOS含む）で押下感を出す */
    const tapFeedback = (el) => {
        if (!el) return;
        try { navigator.vibrate?.(20); } catch (_) {}
        el.classList.add('tap-press');
        clearTimeout(el._tapPressT);
        el._tapPressT = setTimeout(() => { el.classList.remove('tap-press'); }, 120);
    };
    const bind = (id, key) => {
        const el = document.getElementById(id);
        if (!el) return;
        const down = (e) => {
            e.preventDefault();
            e.stopPropagation();
            tapFeedback(el);
            k(key, true);
        };
        const up = () => k(key, false);
        el.addEventListener('pointerdown', down, { passive: false });
        el.addEventListener('pointerup', up);
        el.addEventListener('pointerleave', up);
        el.addEventListener('pointercancel', up);
        el.addEventListener('touchstart', down, { passive: false });
        el.addEventListener('touchend', (e) => { e.preventDefault(); up(); }, { passive: false });
        el.addEventListener('touchcancel', up);
        el.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    bind('btn-left', 'TouchLeft');
    bind('btn-right', 'TouchRight');
    bind('btn-up', 'TouchUp');
    bind('btn-down', 'TouchDown');
    bind('btn-dash', 'TouchDash');
    bind('btn-start', 'TouchStart');

    /* スキルボタン: 短押し＝取得済みスキルを順に切替、長押し(250ms以上)＝選択中スキル発動 */
    const btnSkill = document.getElementById('btn-skill');
    if (btnSkill) {
        let skillDownAt = 0;
        const LONG_PRESS_MS = 250;
        const down = (e) => {
            e.preventDefault();
            e.stopPropagation();
            tapFeedback(btnSkill);
            skillDownAt = Date.now();
        };
        const up = (e) => {
            e.preventDefault();
            const duration = Date.now() - skillDownAt;
            if (duration >= LONG_PRESS_MS) {
                game.keys['TouchSkillFire'] = true;
            } else {
                game.keys['TouchSkillCycle'] = true;
            }
        };
        btnSkill.addEventListener('pointerdown', down, { passive: false });
        btnSkill.addEventListener('pointerup', up);
        btnSkill.addEventListener('pointerleave', up);
        btnSkill.addEventListener('pointercancel', up);
        btnSkill.addEventListener('touchstart', down, { passive: false });
        btnSkill.addEventListener('touchend', (e) => { e.preventDefault(); up(e); }, { passive: false });
        btnSkill.addEventListener('touchcancel', up);
        btnSkill.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    const btnPause = document.getElementById('btn-pause');
    if (btnPause) {
        const toggle = (e) => {
            e.preventDefault();
            e.stopPropagation();
            tapFeedback(btnPause);
            game.togglePauseIfAllowed();
        };
        btnPause.addEventListener('pointerdown', toggle, { passive: false });
        btnPause.addEventListener('touchstart', toggle, { passive: false });
    }
}

/**
 * ジョイスティック設定オーバーレイ（感度・デッドゾーン・音量・テストエリア）を初期化する。
 * @param {Object} game - Game インスタンス（sound, joystick を参照）
 */
function setupJoystickSettingsUI(game) {
    const overlay = document.getElementById('joystick-settings-overlay');
    const backBtn = document.getElementById('btn-settings-back');
    const sensInput = document.getElementById('joystick-sensitivity');
    const deadInput = document.getElementById('joystick-deadzone');
    const outSens = document.getElementById('out-sensitivity');
    const outDead = document.getElementById('out-deadzone');
    const testArea = document.getElementById('joystick-test-area');
    const outTest = document.getElementById('out-test-xy');
    const volBgm = document.getElementById('volume-bgm');
    const volSe = document.getElementById('volume-se');
    const outBgm = document.getElementById('out-bgm-volume');
    const outSe = document.getElementById('out-se-volume');

    if (volBgm && outBgm && game.sound) {
        volBgm.value = Math.round(game.sound.bgmVolume * 100);
        outBgm.textContent = volBgm.value;
        volBgm.addEventListener('input', () => {
            const v = parseInt(volBgm.value, 10) / 100;
            game.sound.setBGMVolume(v);
            outBgm.textContent = volBgm.value;
        });
    }
    if (volSe && outSe && game.sound) {
        volSe.value = Math.round(game.sound.seVolume * 100);
        outSe.textContent = volSe.value;
        volSe.addEventListener('input', () => {
            const v = parseInt(volSe.value, 10) / 100;
            game.sound.setSEVolume(v);
            outSe.textContent = volSe.value;
        });
    }
    if (backBtn && overlay) {
        const close = (e) => {
            e.preventDefault();
            try { navigator.vibrate?.(15); } catch (_) {}
            overlay.classList.remove('is-open');
            overlay.setAttribute('aria-hidden', 'true');
            game.paused = false;
        };
        backBtn.addEventListener('pointerdown', close, { passive: false });
        backBtn.addEventListener('touchstart', close, { passive: false });
    }
    if (sensInput && outSens) {
        sensInput.value = game.joystick.settings.sensitivity;
        outSens.textContent = sensInput.value;
        sensInput.addEventListener('input', () => {
            const v = parseFloat(sensInput.value);
            game.joystick.settings.sensitivity = v;
            outSens.textContent = v.toFixed(1);
            saveJoystickSettings(game.joystick.settings);
        });
    }
    if (deadInput && outDead) {
        deadInput.value = game.joystick.settings.deadZone;
        outDead.textContent = deadInput.value;
        deadInput.addEventListener('input', () => {
            const v = parseFloat(deadInput.value);
            game.joystick.settings.deadZone = v;
            outDead.textContent = v.toFixed(2);
            saveJoystickSettings(game.joystick.settings);
        });
    }
    if (testArea && outTest) {
        const TEST_MAX_R = 80;
        let testTouchId = null;
        let testOriginX = 0;
        let testOriginY = 0;
        const show = (x, y) => { outTest.textContent = `X: ${x.toFixed(2)}  Y: ${y.toFixed(2)}`; };
        const end = () => {
            testTouchId = null;
            show(0, 0);
        };
        testArea.addEventListener('touchstart', (e) => {
            for (const t of e.changedTouches) {
                if (testTouchId === null) {
                    testTouchId = t.identifier;
                    testOriginX = t.clientX;
                    testOriginY = t.clientY;
                    e.preventDefault();
                }
            }
        }, { passive: false });
        testArea.addEventListener('touchmove', (e) => {
            for (const t of e.changedTouches) {
                if (t.identifier !== testTouchId) continue;
                e.preventDefault();
                const dx = t.clientX - testOriginX;
                const dy = t.clientY - testOriginY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const r = dist > 0 ? Math.min(dist, TEST_MAX_R) / TEST_MAX_R : 0;
                const angle = dist > 0 ? Math.atan2(dy, dx) : 0;
                const rawX = r * Math.cos(angle);
                const rawY = r * Math.sin(angle);
                const { deadZone, sensitivity } = game.joystick.settings;
                const fx = applyDeadZoneAndSensitivity(rawX, deadZone, sensitivity);
                const fy = applyDeadZoneAndSensitivity(rawY, deadZone, sensitivity);
                const mag = Math.sqrt(fx * fx + fy * fy);
                const outX = mag > 1 && mag > 0 ? fx / mag : fx;
                const outY = mag > 1 && mag > 0 ? fy / mag : fy;
                show(outX, outY);
            }
        }, { passive: false });
        testArea.addEventListener('touchend', (e) => {
            for (const t of e.changedTouches) if (t.identifier === testTouchId) end();
        });
        testArea.addEventListener('touchcancel', (e) => {
            for (const t of e.changedTouches) if (t.identifier === testTouchId) end();
        });
    }
}

global.CrowDestiny = global.CrowDestiny || {};
global.CrowDestiny.setupTouch = setupTouch;
global.CrowDestiny.setupJoystickSettingsUI = setupJoystickSettingsUI;

})(typeof window !== 'undefined' ? window : this);
