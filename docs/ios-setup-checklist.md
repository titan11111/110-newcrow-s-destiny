# CROW'S DESTINY — iOS 対応チェックリスト

PWA・Safari で動作させるための設定の抜け漏れ確認用です。

## 1. HTML / メタタグ

| 項目 | 場所 | 状態 |
|------|------|------|
| viewport（幅・スケール固定・ズーム無効） | `index.html` `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">` | ✅ |
| viewport-fit=cover（ノッチ対応） | 上記に含む | ✅ |
| charset UTF-8 | `index.html` | ✅ |

## 2. CSS（タッチ・バウンス・Safe Area）

| 項目 | 場所 | 状態 |
|------|------|------|
| touch-action: manipulation | `style.css` 全体・* と html, body | ✅ |
| -webkit-touch-callout: none | body | ✅ |
| overscroll-behavior: none | html, body | ✅ |
| -ms-touch-action: manipulation | body | ✅ |
| user-select: none | body | ✅ |
| Safe Area（padding-top/bottom env/constant） | #game-container | ✅ |
| ボタン touch-action: none | 打感用クラス | ✅ |

## 3. 音声（iOS Safari 制約）

| 項目 | 場所 | 状態 |
|------|------|------|
| ユーザージェスチャー内で init() | game.js: touchstart/touchend で sound.init() | ✅ |
| BGM: 1本の Audio 要素を再利用 | sound.js: _bgmEl を破棄せず src 差し替え | ✅ |
| playsinline / webkit-playsinline | sound.js: setAttribute | ✅ |
| 再生失敗時の catch | sound.js: el.play().catch(...) | ✅ |

## 4. タッチイベント（パッシブ・ジェスチャー）

| 項目 | 場所 | 状態 |
|------|------|------|
| touchmove preventDefault（スクロール抑止） | game.js: document touchmove passive:false | ✅ |
| ダブルタップズーム防止（300ms 内 2 回 touchend で preventDefault） | game.js: lastTap で touchend preventDefault | ✅ |
| gesturestart/change/end preventDefault | game.js | ✅ |
| ボタン・ジョイスティック: touchstart/touchend/touchcancel | game/input.js, joystick.js | ✅ |
| タッチ時に passive: false で登録 | 上記 | ✅ |

## 5. ジョイスティック・操作

| 項目 | 場所 | 状態 |
|------|------|------|
| 仮想ジョイスティック（タッチで表示） | joystick.js: キャンバス上タッチ | ✅ |
| changedTouches と identifier で複数タッチ対応 | joystick.js | ✅ |
| touchcancel で stick リセット | joystick.js | ✅ |
| 設定パネル内テストエリア（タッチ） | game/input.js | ✅ |

## 6. 縦向き・表示

| 項目 | 場所 | 状態 |
|------|------|------|
| 縦向き時「横にしてください」表示 | index.html + orientationchange/resize | ✅ |
| 100dvh / min-height: 100dvh | style.css body, #game-container | ✅ |

## 7. 抜け漏れリスクの多いポイント

- **音声**: 必ずユーザー操作（タップ/START）のあとで `sound.init()` および BGM/SE 再生を行う。
- **フォーカス**: ボタンに `aria-label` を付与済み。必要なら `tabindex` でフォーカス順を調整。
- **ローカルストレージ**: 音量設定などは `localStorage` 使用。Private Relay 等で無効化される場合あり。
- **requestAnimationFrame**: バックグラウンドやタブ非表示で止まる仕様はそのまま。必要なら Page Visibility API で一時停止。

## 8. 確認推奨環境

- iOS Safari 14+
- iPadOS Safari（横画面）
- 実機でのタッチ・音声・縦横切替の動作確認を推奨。
