# BOSS4（鉄の翼）挙動調査・改善案

## 調査結果

### 現象
- 追い詰められると**左下付近に移動して止まる**
- **攻撃しても回復して倒せない**

### 原因の特定

#### 1. 回復（倒せない原因）
- **場所**: `js/game/collision.js` 181–184 行目  
- **内容**: ボス4が **dive フェーズ**のときにプレイヤーと接触すると、  
  `boss.hp = Math.min(boss.maxHp, (boss.hp || 0) + 8)` で **+8 回復** している（ヴァンパイアバイト）。
- **結果**: ダイブ突進中にプレイヤーが当たるたびに回復し、HP が減らず倒せない。

#### 2. 左下に止まる（追い詰め時の分岐）
- **場所**: `js/entities/boss.js`  
  - `takeDamage`: 259–262 行目（breakdown への遷移）  
  - `updateBossIronWing`: breakdown / taunt / riposte フェーズ（1090–1127 行付近）
- **流れ**:
  1. HP ≤ 20% かつ 1発の被弾量 > 80 で **breakdown** に強制遷移。
  2. **breakdown** 中: 速度を 0.6 倍しつつランダムに揺れ、  
     `clamp(this.x, 80, W-80)`, `clamp(this.y, 50, H-80)` で **左端 x=80・下寄り** に張り付く。
  3. 30 フレームで **taunt** → 30 フレームで **riposte** と進み、riposte 後に通常シーケンス（dive_prep 等）に戻る。
- **結果**: 「追い詰められた」と判定されると左端・下寄りに移動し、そこで breakdown → taunt → riposte が繰り返され、**左下付近に止まって見える**。

#### 3. その他（last_gasp）
- **場所**: `boss.js` 249–255 行目（takeDamage 内）  
- HP が 0 になったとき、**last_gasp 未使用なら `hp = 1` で蘇生**し、フェーズを `last_gasp` にしている。  
- これにより「一度死んだように見えて復活」し、上記の breakdown と合わせて「倒せない」印象になる。

---

## 改善案 3 つ

### 改善案 1: 参照方針どおり「追い詰め分岐＋回復」を完全にやめる（推奨）

- **やること**
  - **breakdown への遷移を無効化**  
    `takeDamage` 内の  
    `if (this.idx === 3 && this.hp <= this.maxHp * 0.2 && actual > 80 && !this.ironWingBreakdownTriggered) { ... }`  
    のブロックを**削除**する。
  - **ダイブ時の接触回復を削除**  
    `collision.js` の  
    `if (boss.idx === 3 && boss.ironWingPhase === 'dive') { boss.hp = Math.min(...) + 8; }`  
    を**削除**する。
- **効果**
  - 左下に逃げる分岐がなくなる。
  - 回復なしで、攻撃すればそのまま倒せる。
- **パターン**: 参照の「A: isCornered 判定ブロックを削除」「回復も削除」に相当。

---

### 改善案 2: breakdown は残すが「左下」に寄せない＋回復だけ削除

- **やること**
  - **回復は削除**（改善案 1 と同じ、collision.js の +8 を削除）。
  - **breakdown の位置制限を変更**  
    breakdown 中の `clamp(this.x, 80, W - 80)`, `clamp(this.y, 50, H - 80)` を、  
    通常の patrol などと同様の範囲（例: `clamp(this.x, 60, W - 60)`, `clamp(this.y, 40, H - 40)`）に変更する。
- **効果**
  - 「ピンチ時の breakdown 演出」は残るが、左端・下に張り付かなくなる。
  - 回復はなくなるので倒せる。
- **パターン**: 参照の「安全策」の「左下固定ではなく、挙動を穏やかにする」に相当。

---

### 改善案 3: last_gasp 蘇生もやめて「即死亡」にする

- **やること**
  - 改善案 1 に加え、**last_gasp 蘇生をやめる**。  
    `takeDamage` 内の  
    `if (this.idx === 3 && !this.ironWingLastGaspActive) { this.ironWingLastGaspActive = true; this.hp = 1; this.ironWingPhase = 'last_gasp'; ... return; }`  
    を**削除**し、HP ≤ 0 のときは他ボスと同様に  
    `this.anim.set('DEATH'); this.deathT = 0; fx.big(...); return;` だけ実行する。
- **効果**
  - ボス4も HP 0 で即死亡し、last_gasp 特攻がなくなる。
  - 参照の「回復なし」と合わせると、一貫して「追い詰め特殊処理なし・回復なし」になる。

---

## 結論（参照方針）

- **追い詰められたら左下へ行く分岐** → **完全に無効化**（breakdown 遷移を削除）。
- **それに紐づく回復** → **削除**（ダイブ時の接触 +8 回復を削除）。
- 実装としては **改善案 1** を適用し、必要なら **改善案 3**（last_gasp 削除）も行う。
