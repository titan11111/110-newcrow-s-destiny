/**
 * CROW'S DESTINY — フローティングバーチャルジョイスティック（iOS向け）
 * 画面をタッチした位置にジョイスティックが出現。親指でドラッグして操作。デッドゾーン・感度を再マッピングで適用。
 */
(function (global) {
'use strict';

const CFG = global.CrowDestiny && global.CrowDestiny.CFG;

/* 2.0倍サイズ（一回り大きく、iOS親指でより操作しやすく） */
const JOYSTICK_SCALE = 2.0;
const JOYSTICK_MAX_RADIUS = 60 * JOYSTICK_SCALE;   /* 120 */
const JOYSTICK_BASE_RADIUS = 52 * JOYSTICK_SCALE;  /* 104 */
const JOYSTICK_KNOB_RADIUS = 22 * JOYSTICK_SCALE;  /* 44 */
/** ジョイスティック出現ゾーン：キャンバス幅の左側この割合まで（0.9＝左90%。右端10%はボタン用）。左親指が届きやすいよう広めに取る */
const JOYSTICK_LEFT_ZONE_RATIO = 0.9;
const JOYSTICK_ALPHA_IDLE = 0.45;
const JOYSTICK_ALPHA_ACTIVE = 0.75;
const JOYSTICK_FADE_FRAMES = 9;

const SETTINGS_KEY = 'crowDestiny_joystick_settings';
const DEFAULT_SETTINGS = { deadZone: 0.15, sensitivity: 1.0 };

function loadJoystickSettings() {
    try {
        const saved = localStorage.getItem(SETTINGS_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            return {
                deadZone: clamp(parsed.deadZone ?? DEFAULT_SETTINGS.deadZone, 0, 0.4),
                sensitivity: clamp(parsed.sensitivity ?? DEFAULT_SETTINGS.sensitivity, 0.5, 2.0)
            };
        }
    } catch (_) {}
    return { ...DEFAULT_SETTINGS };
}

function saveJoystickSettings(settings) {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (_) {}
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

/**
 * デッドゾーン＋感度を再マッピングで適用（段差なし）
 */
function applyDeadZoneAndSensitivity(rawInput, deadZone, sensitivity) {
    const absInput = Math.abs(rawInput);
    if (absInput < deadZone) return 0;
    const remapped = (absInput - deadZone) / (1.0 - deadZone);
    return Math.sign(rawInput) * Math.min(1.0, remapped * sensitivity);
}

/**
 * ジョイスティック状態とタッチ処理を保持するクラス
 */
class VirtualJoystick {
    constructor(canvas, onKeysUpdate) {
        this.canvas = canvas;
        this.onKeysUpdate = onKeysUpdate;
        this.settings = loadJoystickSettings();
        this.joystickTouchId = null;
        this.stickOrigin = null;
        this.knobPos = null;
        this.rawInputX = 0;
        this.rawInputY = 0;
        this.joystickAlpha = 0;
        this.joystickFadeFrames = 0;
        this._boundTouchStart = this.handleTouchStart.bind(this);
        this._boundTouchMove = this.handleTouchMove.bind(this);
        this._boundTouchEnd = this.handleTouchEnd.bind(this);
    }

    getCanvasCoords(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    handleTouchStart(e) {
        for (const touch of e.changedTouches) {
            if (this.joystickTouchId === null) {
                const pos = this.getCanvasCoords(touch.clientX, touch.clientY);
                /* 左側ゾーン（幅の90%）内のタッチのみジョイスティック出現。右端10%はボタン用。左親指が届きやすいよう広めに取る */
                const leftZoneLimit = this.canvas.width * JOYSTICK_LEFT_ZONE_RATIO;
                if (pos.x > leftZoneLimit) continue;
                e.preventDefault();
                this.joystickTouchId = touch.identifier;
                this.stickOrigin = { x: pos.x, y: pos.y };
                this.knobPos = { x: pos.x, y: pos.y };
                this.rawInputX = 0;
                this.rawInputY = 0;
                this.joystickAlpha = JOYSTICK_ALPHA_IDLE;
                this.joystickFadeFrames = 0;
                break;
            }
        }
    }

    handleTouchMove(e) {
        for (const touch of e.changedTouches) {
            if (touch.identifier !== this.joystickTouchId) continue;
            e.preventDefault();
            const pos = this.getCanvasCoords(touch.clientX, touch.clientY);
            const ox = this.stickOrigin.x;
            const oy = this.stickOrigin.y;
            let dx = pos.x - ox;
            let dy = pos.y - oy;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const clampedDist = Math.min(distance, JOYSTICK_MAX_RADIUS);
            const angle = distance > 0 ? Math.atan2(dy, dx) : 0;
            this.knobPos = {
                x: ox + Math.cos(angle) * clampedDist,
                y: oy + Math.sin(angle) * clampedDist
            };
            this.rawInputX = distance > 0 ? clamp(dx / JOYSTICK_MAX_RADIUS, -1, 1) : 0;
            this.rawInputY = distance > 0 ? clamp(dy / JOYSTICK_MAX_RADIUS, -1, 1) : 0;
            this.joystickAlpha = JOYSTICK_ALPHA_ACTIVE;
            break;
        }
    }

    handleTouchEnd(e) {
        for (const touch of e.changedTouches) {
            if (touch.identifier !== this.joystickTouchId) continue;
            this.joystickTouchId = null;
            this.rawInputX = 0;
            this.rawInputY = 0;
            if (this.stickOrigin) this.knobPos = { ...this.stickOrigin };
            this.joystickFadeFrames = JOYSTICK_FADE_FRAMES;
            break;
        }
    }

    setup() {
        this.canvas.addEventListener('touchstart', this._boundTouchStart, { passive: false });
        this.canvas.addEventListener('touchmove', this._boundTouchMove, { passive: false });
        this.canvas.addEventListener('touchend', this._boundTouchEnd, { passive: false });
        this.canvas.addEventListener('touchcancel', this._boundTouchEnd, { passive: false });
    }

    /**
     * HTMLモード: 左パネルdivでタッチ取得、HTML要素でビジュアル表示（canvas描画なし）
     * @param {HTMLElement} zoneEl - #joystick-zone div
     */
    setupHTMLMode(zoneEl) {
        this._htmlMode = true;
        this._zoneEl = zoneEl;
        this._baseEl = document.getElementById('joystick-base');
        this._stickEl = document.getElementById('joystick-stick');
        this._htmlMaxRadius = 80; /* CSS px: ノブ可動範囲 */

        /* 起動時は非表示 */
        if (this._baseEl) this._baseEl.style.opacity = '0';

        zoneEl.addEventListener('touchstart', (e) => this._htmlTouchStart(e), { passive: false });
        zoneEl.addEventListener('touchmove',  (e) => this._htmlTouchMove(e),  { passive: false });
        zoneEl.addEventListener('touchend',   (e) => this._htmlTouchEnd(e),   { passive: false });
        zoneEl.addEventListener('touchcancel',(e) => this._htmlTouchEnd(e),   { passive: false });
    }

    _htmlTouchStart(e) {
        if (this.joystickTouchId !== null) return;
        const touch = e.changedTouches[0];
        e.preventDefault();
        this.joystickTouchId = touch.identifier;
        const rect = this._zoneEl.getBoundingClientRect();
        const tx = touch.clientX - rect.left;
        const ty = touch.clientY - rect.top;
        this.stickOrigin = { x: tx, y: ty };
        this.rawInputX = 0;
        this.rawInputY = 0;
        this._positionHTMLJoystick(tx, ty, tx, ty);
        if (this._baseEl) this._baseEl.style.opacity = '0.75';
    }

    _htmlTouchMove(e) {
        for (const touch of e.changedTouches) {
            if (touch.identifier !== this.joystickTouchId) continue;
            e.preventDefault();
            const rect = this._zoneEl.getBoundingClientRect();
            const tx = touch.clientX - rect.left;
            const ty = touch.clientY - rect.top;
            const ox = this.stickOrigin.x, oy = this.stickOrigin.y;
            const dx = tx - ox, dy = ty - oy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxR = this._htmlMaxRadius;
            const clampedDist = Math.min(dist, maxR);
            const angle = dist > 0 ? Math.atan2(dy, dx) : 0;
            const kx = ox + Math.cos(angle) * clampedDist;
            const ky = oy + Math.sin(angle) * clampedDist;
            this.rawInputX = dist > 0 ? clamp(dx / maxR, -1, 1) : 0;
            this.rawInputY = dist > 0 ? clamp(dy / maxR, -1, 1) : 0;
            this._positionHTMLJoystick(ox, oy, kx, ky);
            break;
        }
    }

    _htmlTouchEnd(e) {
        for (const touch of e.changedTouches) {
            if (touch.identifier !== this.joystickTouchId) continue;
            this.joystickTouchId = null;
            this.rawInputX = 0;
            this.rawInputY = 0;
            this.stickOrigin = null;
            if (this._baseEl) this._baseEl.style.opacity = '0';
            break;
        }
    }

    /** ベースとノブのCSS位置を更新 */
    _positionHTMLJoystick(baseX, baseY, knobX, knobY) {
        if (!this._baseEl || !this._stickEl) return;
        const baseR = 80;  /* joystick-base の半径(px): width/2 */
        const knobR = 35;  /* joystick-stick の半径(px): width/2 */
        this._baseEl.style.position = 'absolute';
        this._baseEl.style.left = (baseX - baseR) + 'px';
        this._baseEl.style.top  = (baseY - baseR) + 'px';
        this._stickEl.style.position = 'absolute';
        this._stickEl.style.transform = 'none';
        this._stickEl.style.left = (knobX - baseX + baseR - knobR) + 'px';
        this._stickEl.style.top  = (knobY - baseY + baseR - knobR) + 'px';
    }

    update() {
        if (this.joystickFadeFrames > 0) {
            this.joystickFadeFrames--;
            this.joystickAlpha = Math.max(0, this.joystickAlpha - (JOYSTICK_ALPHA_IDLE / JOYSTICK_FADE_FRAMES));
            if (this.joystickFadeFrames <= 0) this.stickOrigin = null;
        }
        const { deadZone, sensitivity } = this.settings;
        let fx = applyDeadZoneAndSensitivity(this.rawInputX, deadZone, sensitivity);
        let fy = applyDeadZoneAndSensitivity(this.rawInputY, deadZone, sensitivity);
        const mag = Math.sqrt(fx * fx + fy * fy);
        if (mag > 1.0 && mag > 0) {
            fx /= mag;
            fy /= mag;
        }
        /* タッチ中のみコールバックを呼ぶ。未タッチ時は game 側で JoystickX/Y を未定義にし、キーボード・D-pad が使われる */
        if (this.joystickTouchId !== null) this.onKeysUpdate(fx, fy);
    }

    draw(c) {
        if (this._htmlMode) return; /* HTMLモード: canvas描画なし */
        if (!this.stickOrigin || this.joystickAlpha <= 0) return;
        const o = this.stickOrigin;
        const k = this.knobPos || o;
        c.save();
        c.globalAlpha = this.joystickAlpha;
        c.strokeStyle = 'rgba(224,205,167,0.9)';
        c.fillStyle = 'rgba(61,43,31,0.5)';
        c.lineWidth = 3;
        c.beginPath();
        c.arc(o.x, o.y, JOYSTICK_BASE_RADIUS, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.fillStyle = 'rgba(224,205,167,0.95)';
        c.beginPath();
        c.arc(k.x, k.y, JOYSTICK_KNOB_RADIUS, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = 'rgba(180,160,120,0.8)';
        c.lineWidth = 2;
        c.stroke();
        c.restore();
    }

    getFinalInputForTest() {
        const { deadZone, sensitivity } = this.settings;
        const fx = applyDeadZoneAndSensitivity(this.rawInputX, deadZone, sensitivity);
        const fy = applyDeadZoneAndSensitivity(this.rawInputY, deadZone, sensitivity);
        const mag = Math.sqrt(fx * fx + fy * fy);
        if (mag > 1.0 && mag > 0) return { x: fx / mag, y: fy / mag };
        return { x: fx, y: fy };
    }
}

global.CrowDestiny = global.CrowDestiny || {};
global.CrowDestiny.VirtualJoystick = VirtualJoystick;
global.CrowDestiny.loadJoystickSettings = loadJoystickSettings;
global.CrowDestiny.saveJoystickSettings = saveJoystickSettings;
global.CrowDestiny.applyDeadZoneAndSensitivity = applyDeadZoneAndSensitivity;
global.CrowDestiny.JOYSTICK_DEFAULT_SETTINGS = DEFAULT_SETTINGS;

})(typeof window !== 'undefined' ? window : this);
