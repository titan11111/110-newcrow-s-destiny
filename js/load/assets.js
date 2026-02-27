/**
 * CROW'S DESTINY — 画像アセット読み込み
 */
(function (global) {
'use strict';

const ASSETS = global.CrowDestiny.ASSETS;
const IMG = {};

function loadAssets() {
    const entries = Object.entries(ASSETS);
    const promises = entries.map(([key, src]) => {
        return new Promise((resolve) => {
            const img = new Image();
            if (typeof src === 'string' && (src.startsWith('http://') || src.startsWith('https://'))) img.crossOrigin = 'anonymous';
            img.onload = () => {
                IMG[key] = img;
                resolve();
            };
            img.onerror = () => { console.warn('Asset failed:', src); resolve(); };
            img.src = src;
        });
    });
    return Promise.all(promises);
}

global.CrowDestiny = global.CrowDestiny || {};
global.CrowDestiny.IMG = IMG;
global.CrowDestiny.loadAssets = loadAssets;

})(typeof window !== 'undefined' ? window : this);
