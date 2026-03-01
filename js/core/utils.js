/**
 * CROW'S DESTINY — ユーティリティ
 */
(function (global) {
'use strict';

const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v));
const dist  = (a, b, c, d) => Math.hypot(c - a, d - b);
/** 距離の2乗（当たり判定で sqrt を避けて高速化する用） */
const distSquared = (x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; };
const rr    = (a, b) => Math.random() * (b - a) + a;
const ri    = (a, b) => Math.floor(rr(a, b));
const lerp  = (a, b, t) => a + (b - a) * t;
const hex2rgb = h => [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)];
const rgb    = r => `rgb(${r[0] | 0},${r[1] | 0},${r[2] | 0})`;
const lerpC  = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** 配列から inactive な要素を in-place で削除（GC 負荷軽減・iOS 対策） */
function removeInactive(arr, isActiveFn) {
    let i = arr.length - 1;
    while (i >= 0) {
        if (!isActiveFn(arr[i])) {
            arr[i] = arr[arr.length - 1];
            arr.pop();
        } else {
            i--;
        }
    }
}

global.CrowDestiny = global.CrowDestiny || {};
global.CrowDestiny.clamp = clamp;
global.CrowDestiny.dist = dist;
global.CrowDestiny.distSquared = distSquared;
global.CrowDestiny.rr = rr;
global.CrowDestiny.ri = ri;
global.CrowDestiny.lerp = lerp;
global.CrowDestiny.hex2rgb = hex2rgb;
global.CrowDestiny.rgb = rgb;
global.CrowDestiny.lerpC = lerpC;
global.CrowDestiny.removeInactive = removeInactive;

})(typeof window !== 'undefined' ? window : this);
