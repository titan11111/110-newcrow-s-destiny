# ファイル構成（役割ごとの整理）

プログラミング的思考に基づき、**責務（役割）**ごとにフォルダとファイルを整理した構成です。

---

## ディレクトリ構成

```
109-カラスの逆襲/
├── index.html          # エントリHTML（script の読み込み順は依存関係に従う）
├── style.css           # スタイル
├── script.js           # モノリシック版（1ファイル版・別構成）
├── js/
│   ├── core/           # 基盤：設定・定数・汎用関数
│   │   ├── config.js   # CFG, ASSETS, AUDIO_ASSETS, ANIM_FPS, FRAME_DUR
│   │   └── utils.js    # clamp, dist, rr, ri, lerp, hex2rgb, rgb, lerpC
│   ├── data/           # ゲームデータ
│   │   └── stages.js   # ステージ定義（7章分の難易度・色・ボス名など）
│   ├── load/           # アセット読み込み
│   │   └── assets.js   # 画像プリロード、IMG 格納、loadAssets()
│   ├── audio/          # 音声
│   │   └── sound.js    # SE（効果音）— SoundManager
│   ├── render/         # 描画・ビジュアル
│   │   ├── anim.js     # アニメーション状態 — Anim
│   │   ├── fx.js       # パーティクル・テキスト・エフェクト — FX, TextOverlay, EffectOverlay
│   │   ├── background.js # 背景（パララックス・ステージ別）— Background
│   │   └── hud.js      # HUD 描画 — drawHUD
│   ├── entities/       # ゲーム内オブジェクト
│   │   ├── crow.js     # プレイヤー — Crow
│   │   ├── enemy.js    # 敵 — Enemy
│   │   ├── obstacle.js # 障害物 — Obstacle, spawnObstacle
│   │   ├── boss.js     # ボス — Boss
│   │   └── relic.js    # 聖遺物（アイテム）— Relic, RELIC_TYPES
│   ├── game/           # ゲームロジック（役割ごと分割）
│   │   ├── constants.js # 状態定数 — STATE, PAUSABLE_STATES
│   │   ├── collision.js # 当たり判定 — checkCollisions(game)
│   │   ├── spawn.js    # 敵・障害物スポーン — spawnEnemies, spawnObstacles
│   │   ├── scenes.js   # シーン描画 — draw*Scene(c, game), drawPauseOverlay
│   │   └── input.js    # タッチ・設定UI — setupTouch, setupJoystickSettingsUI
│   ├── game.js         # ゲームループ・状態機械・描画オーケストレーション — Game
│   └── main.js         # エントリポイント（load で new Game()）
├── images/             # 画像アセット
├── audio/              # 音声アセット（SE等。ファイルは残す）
└── docs/               # 仕様・設計メモ
    ├── item-effects.md # 聖遺物（アイテム）効果一覧
    ├── scene-list.md  # シーン・ステージ一覧
    └── ...
```

---

## 役割と依存関係

| フォルダ | 役割 | 依存するもの |
|----------|------|----------------|
| **core** | 定数・設定・汎用関数。他モジュールの土台。 | なし |
| **data** | ステージやコンテンツの「データ」のみ。 | なし（config の ASSETS 等とは別） |
| **load** | 画像の読み込みとキャッシュ。 | core (config: ASSETS) |
| **audio** | SE の再生制御。 | core (config: AUDIO_ASSETS) |
| **render** | 描画に必要なアニメ・エフェクト・背景・HUD。 | core, data (STAGES), load (IMG) |
| **entities** | プレイヤー・敵・障害物・ボス・アイテムのロジックと描画。 | core, data, load, render (Anim), audio は game 経由 |
| **game/** | 状態定数・当たり判定・スポーン・シーン描画・入力。 | core, data, entities, render, input (joystick) |
| **game.js** | 状態機械・ループ・描画オーケストレーション。game/ と全モジュールを組み合わせる。 | 上記すべて |
| **main.js** | ウィンドウ load で Game を 1 つだけ起動。 | game.js |

---

## 読み込み順（index.html）

1. **core** — config → utils  
2. **data** — stages  
3. **load** — assets  
4. **audio** — sound  
5. **render** — anim → fx → background → hud  
6. **entities** — crow → enemy → obstacle → boss → relic  
7. **input** — joystick  
8. **game/** — constants → collision → spawn → scenes → input  
9. **game** → **main**

この順序で、各スクリプトが参照する `global.CrowDestiny.*` が必ず定義済みになります。

---

## 運用上の注意

- **新規モジュールを足すとき**: 役割に合わせて上記いずれかのフォルダに置き、依存関係を満たす位置に `<script>` を 1 行追加する。
- **script.js**: ルートにある 1 ファイル版。index.html では読んでいない。モジュール版（js/ 配下）と役割が重複するため、参照用・フォールバック用として残している。
