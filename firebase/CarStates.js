// CarStates.js - 状態クラス（Car.js から分離）

import * as C from './CarConstants.js';

// Car.pathDelta のローカルコピー
function pathDelta(from, to) {
    let d = to - from;
    if (d > 0.5) d -= 1;
    if (d < -0.5) d += 1;
    return d;
}

// --- 状態クラス ---

export class CarState {
    constructor(car) { this.car = car; }
    get name() { return 'unknown'; }
    enter(params) {}
    exit() {}
    update(cars) {}
}

export class NormalState extends CarState {
    get name() { return 'normal'; }

    enter() {
        this._approachJudged = false;
        this._approachTarget = null;
    }

    update(cars) {
        const { car: aheadCar, gap: aheadGap } = this.car.findCarAhead(cars);
        const carsCloselyBehind = this.car._countCarsCloselyBehind(cars);

        if (!aheadCar) {
            this.car.fadeOvertakeOffset();
            return;
        }

        // 前方busy車 → 無条件TANDEM（後方詰まりなし & 自分が速い場合）
        if (aheadGap < C.GAP.AHEAD_BUSY && carsCloselyBehind === 0 && this.car.speed >= aheadCar.speed) {
            if (this.car._isCarBusy(aheadCar)) {
                this.car.transitionTo(TandemState);
                return;
            }
        }

        // 接近判定（1回限り）
        this._updateApproachJudgement(cars, aheadCar, aheadGap, carsCloselyBehind);

        // 超接近 → 強制TANDEM（パス距離ベース）
        if (aheadGap < C.GAP.FORCE_TANDEM) {
            this.car.transitionTo(TandemState, { from: aheadGap });
            return;
        }

        // 3D距離で超接近 → 強制TANDEM（パス距離では検知できないケースを補完）
        if (aheadCar.object && this.car.object) {
            const dx = aheadCar.object.position.x - this.car.object.position.x;
            const dz = aheadCar.object.position.z - this.car.object.position.z;
            const dist3D = Math.sqrt(dx * dx + dz * dz);
            if (dist3D < C.COLLISION.FORCE_TANDEM_3D) {
                this.car.transitionTo(TandemState);
                return;
            }
        }
        // 減速は avoidCollision() に一本化（ここでは状態遷移のみ）
    }

    // 接近時のTANDEM/PASS判定（1回限り評価）
    _updateApproachJudgement(cars, aheadCar, aheadGap, carsCloselyBehind) {
        // 判定対象が変わったらリセット
        if (this._approachTarget && this._approachTarget !== aheadCar) {
            this._approachJudged = false;
            this._approachTarget = null;
        }

        // 判定対象から離れたらリセット
        if (this._approachJudged && this._approachTarget) {
            const targetGap = pathDelta(this.car.position, this._approachTarget.position);
            if (targetGap < C.GAP.OVERTAKE_COMPLETE || targetGap > C.GAP.OVERTAKE_LOST) {
                this._approachJudged = false;
                this._approachTarget = null;
            }
        }

        // 判定発動条件: 接近距離内 & 未判定 & 自分が速い
        if (aheadGap >= C.GAP.APPROACH || this._approachJudged || this.car.speed < aheadCar.speed * 0.95) {
            return;
        }

        this._approachJudged = true;
        this._approachTarget = aheadCar;

        const isAlreadyBeingOvertaken = cars.some(c => c.isOvertaking && c.overtakeTargetCar === aheadCar);

        // 他車が既に抜き中 → TANDEM
        if (isAlreadyBeingOvertaken) {
            this.car.transitionTo(TandemState, { from: aheadGap });
            return;
        }

        // 後方詰まり → 100% PASS（速度差に関わらずブーストで抜く）
        if (carsCloselyBehind >= 1) {
            this.car.transitionTo(PassState, { target: aheadCar });
            return;
        }

        // 自分が遅い → TANDEM
        if (this.car.speed <= aheadCar.speed) {
            this.car.transitionTo(TandemState, { from: aheadGap });
            return;
        }

        // 通常判定: TANDEM(40%) / PASS(60%)
        if (Math.random() < 0.4) {
            this.car.transitionTo(TandemState, { from: aheadGap });
        } else {
            this.car.transitionTo(PassState, { target: aheadCar });
        }
    }
}

export class TandemState extends CarState {
    get name() { return 'tandem'; }

    enter({ slipstreamCharge = 0 } = {}) {
        this.duration = 0;
        // tandemPatience に応じて TANDEM 維持時間を設定
        // せっかち(0): 60-150f (1-2.5秒) / 普通(0.5): 150-300f (2.5-5秒) / 辛抱強い(1): 240-450f (4-7.5秒)
        const patience = this.car.drivingStyle.tandemPatience;
        const baseMin = 60 + Math.floor(patience * 180);
        const baseRange = 90 + Math.floor(patience * 210);
        this.maxDuration = baseMin + Math.floor(Math.random() * baseRange);
        this.targetGap = 0.003 + Math.random() * 0.002;
        // スリップストリーム蓄積（前回からの引き継ぎ対応）
        this.slipstreamCharge = slipstreamCharge;
    }

    update(cars) {
        this.duration++;

        const { car: ahead, gap } = this.car.findCarAhead(cars);

        // 前方車なし or 距離異常 → NORMAL
        // 下位ほどTANDEM維持距離を広げる（1位: 0.08, 最下位: 0.14）
        const rank = this.car.raceRank || 0;
        const total = this.car.totalCars || 1;
        const rf = rank > 0 ? (rank - 1) / Math.max(1, total - 1) : 0;
        const tandemFar = C.GAP.TANDEM_FAR + rf * 0.06;
        if (!ahead || gap < C.GAP.TANDEM_BEHIND || gap > tandemFar) {
            this.car.transitionTo(NormalState);
            return;
        }

        // スリップストリーム蓄積（近いほど速く溜まる）
        if (gap < this.targetGap * 2) {
            this.slipstreamCharge = Math.min(1.0, this.slipstreamCharge + C.SLIPSTREAM.CHARGE_RATE);
        }

        // スリップストリームMAX → 即PASS発動
        if (this.slipstreamCharge >= 1.0 && ahead) {
            this.car.transitionTo(PassState, {
                target: ahead,
                initialProgress: 0.3,
                slipstreamCharge: this.slipstreamCharge,
            });
            return;
        }

        // 時間切れ → 終了判定
        if (this.duration > this.maxDuration) {
            this._endTandem(cars);
            return;
        }

        // 速度制御: 前方車が近い場合のみキャップ
        if (gap <= this.targetGap) {
            this.car.speed = Math.min(this.car.speed, ahead.speed);
        }

        this.car.fadeOvertakeOffset();
    }

    _endTandem(cars) {
        // 順位ベースのアグレッシブ度（0=1位, 1=最下位）
        const rank = this.car.raceRank || 0;
        const total = this.car.totalCars || 1;
        const rankFactor = rank > 0 ? (rank - 1) / Math.max(1, total - 1) : 0;

        // 前方車を再チェックして即座に次のモードへ遷移
        const { car: aheadCar, gap: aheadGap } = this.car.findCarAhead(cars);
        // 下位ほどgapチェックを緩和（1位: 0.02, 最下位: 0.06）
        const endTandemCheck = C.GAP.ENDTANDEM_CHECK + rankFactor * 0.04;
        if (!aheadCar || aheadGap > endTandemCheck) {
            this.car.transitionTo(NormalState);
            return;
        }
        // 下位ほど速度差があってもPASSを仕掛ける（1位: 1.10, 最下位: 1.25）
        const speedThreshold = 1.10 + rankFactor * 0.15;
        if (aheadCar.speed > this.car.speed * speedThreshold) {
            this.car.transitionTo(NormalState);
            return;
        }

        // 順位に応じたPASS確率（busy/non-busy問わず適用）
        // 1位: 10%, 最下位: 95%
        const passChance = 0.1 + rankFactor * 0.85;

        if (Math.random() > passChance) {
            this.car.transitionTo(TandemState, { slipstreamCharge: this.slipstreamCharge });
        } else {
            this.car.transitionTo(PassState, {
                target: aheadCar,
                initialProgress: 0.3,
                slipstreamCharge: this.slipstreamCharge,
            });
        }
    }
}

export class PassState extends CarState {
    get name() { return 'pass'; }

    enter({ target, initialProgress = 0, slipstreamCharge = 0 } = {}) {
        this.target = target;
        this.duration = 0;
        this.slipstreamCharge = slipstreamCharge;
        // initialProgress は控えめに（滑らかな開始のため）
        this.car.overtakeProgress = Math.min(1.0, Math.min(initialProgress, 0.1) + C.OVERTAKE.PHASE_SPEED);
        this.car.overtakeDirection = this._calculateDirection(target);
    }

    exit() {
        this.car.speed = Math.min(this.car.speed, this.car.MAX_SPEED);
        this.target = null;
    }

    update(cars) {
        const { car: aheadCar, gap: aheadGap } = this.car.findCarAhead(cars);
        const carsCloselyBehind = this.car._countCarsCloselyBehind(cars);

        // 前方busy車チェック（横にずれきってから判定）→ 滑らかに戻してからTANDEMへ
        if (this.duration > 30 && aheadCar && aheadGap < C.GAP.AHEAD_BUSY && carsCloselyBehind === 0 && this.car.speed >= aheadCar.speed) {
            if (this.car._isCarBusy(aheadCar)) {
                this.car.transitionTo(ReturningState, { nextState: TandemState });
                return;
            }
        }

        this.duration++;
        const targetGap = pathDelta(this.car.position, this.target.position);
        const forceReturn = this.duration > C.OVERTAKE.MAX_DURATION * 2;

        if (targetGap < C.GAP.OVERTAKE_COMPLETE || targetGap > C.GAP.OVERTAKE_LOST) {
            // 抜き切った or 離されすぎた → 戻り先が空くまでPASS継続
            if (forceReturn || !this.car.isReturnPathBlocked(cars)) {
                this.car.transitionTo(ReturningState);
            }
        } else if (this.duration > C.OVERTAKE.MAX_DURATION) {
            // 時間切れ → TANDEM or ライン戻し（戻り先チェック付き）
            if (aheadCar && aheadGap < C.GAP.ENDTANDEM_PASS_START) {
                this.car.transitionTo(TandemState);
            } else if (forceReturn || !this.car.isReturnPathBlocked(cars)) {
                this.car.transitionTo(ReturningState);
            }
        } else {
            // 継続 → スリップストリーム蓄積量に応じたブースト
            const slip = this.slipstreamCharge;
            if (slip > 0.01) {
                const turboProgress = Math.min(1.0, this.duration / C.TURBO.DURATION);
                // 蓄積量がブースト倍率を決める（0→等速、1→最大加速）
                const boostMult = 1.0 + slip * C.TURBO.SLIPSTREAM_BONUS - turboProgress * C.TURBO.DECAY * slip;
                const boostSpeed = Math.min(
                    this.car.MAX_SPEED * (1.0 + slip * (C.TURBO.MAX_SPEED_RATIO - 1.0)),
                    this.target.speed * boostMult
                );
                const rampRatio = Math.min(1.0, this.duration / C.TURBO.RAMP_UP);
                const blendFactor = rampRatio * 0.3 * slip;
                const blendedSpeed = this.car.speed + (boostSpeed - this.car.speed) * blendFactor;
                this.car.speed = Math.max(this.car.speed, blendedSpeed);
            }
            this.car.overtakeProgress = Math.min(1.0, this.car.overtakeProgress + C.OVERTAKE.PHASE_SPEED);
        }
    }

    // 追い抜き方向を計算（-1: 左, 1: 右）
    _calculateDirection(targetCar) {
        const myDirection = this.car._pool.v3[0];
        this.car.object.getWorldDirection(myDirection);
        const rightVector = this.car._pool.v3[1].set(-myDirection.z, 0, myDirection.x);
        const dx = targetCar.object.position.x - this.car.object.position.x;
        const dz = targetCar.object.position.z - this.car.object.position.z;
        const lateralDot = rightVector.dot(this.car._pool.v3[2].set(dx, 0, dz));
        return lateralDot > 0 ? -1 : 1;
    }
}

export class ReturningState extends CarState {
    get name() { return 'returning'; }

    enter({ nextState = NormalState } = {}) {
        this.blockedFrames = 0;
        this.nextState = nextState;
    }

    update(cars) {
        // 戻り先に車がいる間はfadeを一時停止
        if (this.car.isReturnPathBlocked(cars)) {
            this.blockedFrames++;
            // 長時間ブロックされたら強制fade（約5秒）
            if (this.blockedFrames < 300) return;
        }
        this.blockedFrames = 0;
        this.car.fadeOvertakeOffset();
        if (this.car.overtakeProgress <= 0) {
            this.car.transitionTo(this.nextState);
        }
    }
}
