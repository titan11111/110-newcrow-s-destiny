# BGM iOS 対応・切り替え監査メモ

## 1. iOS でボス戦 BGM が再生されない原因と対応

### 原因
- iOS Safari では、**ユーザージェスチャー（タップ等）の直後**に開始した音声再生のみ許可される。
- ステージ BGM はタイトル画面の「START」タップ後に開始されるため問題なし。
- ボス戦 BGM は **ゲームループ内**（`requestAnimationFrame` の延長、`stateT > 120` で `playBGM('boss')`）で呼ばれるため、ユーザージェスチャーから時間が経過しており、**新規 `new Audio()` で作成した要素の `.play()` がブロックされていた**。

### 対応（実装済み）
- **BGM 用に 1本の `Audio` 要素だけを用意し、切り替え時は `src` を差し替えて再利用**するように変更（`js/audio/sound.js`）。
- 一度ユーザージェスチャー内で再生を開始した同じ要素を再利用するため、iOS が後続の `play()` を許可しやすくなる。
- `stopBGM()` では `pause()` と `currentTime = 0` のみ行い、要素は破棄しない。

## 2. BGM 切り替えの全箇所チェック結果

| 箇所（game.js） | 処理 | 次の BGM | 判定 |
|----------------|------|----------|------|
| `startStage()` | stopBGM → NARRATION | PLAYING で playBGM('stageN') | ✅ |
| `restart()` | stopBGM → TITLE | 次タップで playBGM('opening') | ✅ |
| `triggerBoss()` | stopBGM → BOSS_INTRO | stateT>120 で playBGM('boss'/'boss7') | ✅ |
| PLAYING ゲームオーバー | stopBGM → playBGM('gameover') | 即時 | ✅ |
| BOSS_INTRO 終了 | playBGM('boss' or 'boss7') | 即時 | ✅ |
| LAST_BOSS_2TO3_CUTSCENE 終了 | playBGM('lastboss2') | 即時 | ✅ |
| BOSS_FIGHT 形態変化 | playBGM('boss7'/'lastboss1'/'lastboss2') | 即時 | ✅ |
| BOSS_FIGHT ゲームオーバー | stopBGM → playBGM('gameover') | 即時 | ✅ |
| ボス撃破 → STAGE_CLEAR | stopBGM → playStageClear() | stateT>230 で startStage → stageN、または VICTORY → ending | ✅ |
| STAGE_CLEAR → VICTORY | playBGM('ending') | 即時 | ✅ |

**結論**: 切り替え後に BGM が鳴らないままになる経路はない。ステージクリア後は意図的に BGM なしで SE のみの区間があり、その後に `startStage()` または `playBGM('ending')` で再開している。
