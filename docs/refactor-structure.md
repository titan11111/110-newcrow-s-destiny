# リファクタリング構成（役割別）

## ディレクトリ・役割

| パス | 役割 |
|------|------|
| `js/core/` | 設定(config)・ユーティリティ(utils)・オブジェクトプール |
| `js/data/` | ステージデータ(stages) |
| `js/load/` | アセット読み込み(assets) |
| `js/audio/` | 音声(sound) — BGM/SE、iOS 対応 |
| `js/render/` | 描画 — anim, fx, background, hud |
| `js/entities/` | エンティティ — crow, enemy( config + behaviors + draw ), obstacle, boss, relic |
| `js/entities/boss/` | ボス基底 — BossBase.js（コンストラクタ・update 振り分け・takeDamage） |
| `js/input/` | ジョイスティック（仮想・タッチ） |
| `js/game/` | ゲームロジック — constants, bullets(敵弾特殊挙動), collision, spawn, scenes, input, game.js |

## 500 行超の分割方針

- **game.js**: 469 行。`updateSpecialBullets` を `js/game/bullets.js` に分離済み。
- **boss**: `BossBase.js`（269 行）で基底を分離。実装は `js/entities/boss.js`（約 1748 行）。  
  さらに 500 行以下にする場合は、例: `bossUpdates1.js`（ボス1・2）、`bossUpdates2.js`（ミミック・鉄翼・ガーディアン）、`bossUpdates3.js`（雪の女王・ヴォイド・旧ボス3）、`bossDraw.js`（draw）に分割可能。

## 読み込み順（index.html）

1. core → data → load → audio → render → entities（crow → enemy 系 → obstacle → **boss/BossBase.js** → boss.js → relic）→ input  
2. game: constants → **bullets** → collision → spawn → scenes → input → game.js  
3. main.js

## iOS 設定

`docs/ios-setup-checklist.md` を参照。
