// Car.js - Car クラス本体（physics, drift, AI, collision, dispose）
import * as C from './CarConstants.js';
import { SpeedLineRenderer } from './SpeedLineRenderer.js';
import { DriftSmokeRenderer } from './DriftSmokeRenderer.js';
import { buildCarModel } from './CarModelBuilder.js';
import { NormalState, TandemState, PassState, ReturningState } from './CarStates.js';
import { countryCodeToFlag } from './FirebaseSync.js';

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

export class Car {
  // static 定数を CarConstants から再公開（外部からの Car.DRIFT 等の参照用）
  static DRIVER_NAMES = C.DRIVER_NAMES;
  static GAP = C.GAP;
  static TURBO = C.TURBO;
  static LINE_STRATEGY = C.LINE_STRATEGY;
  static STRATEGY_LOOK_AHEAD = C.STRATEGY_LOOK_AHEAD;
  static LINE = C.LINE;
  static DRIFT = C.DRIFT;
  static SPEED_TO_KMH = C.SPEED_TO_KMH;
  static SLIPSTREAM = C.SLIPSTREAM;
  static COLLISION = C.COLLISION;
  static AVOIDANCE = C.AVOIDANCE;
  static OVERTAKE = C.OVERTAKE;

  // 全インスタンスで共有（calculateCurvature()は同期実行のため安全）
  static _tmpVec2_0 = new THREE.Vector2();
  static _tmpVec2_1 = new THREE.Vector2();
  static _UP = new THREE.Vector3(0, 1, 0);

  static pickDriverName() {
      return C.pickDriverName();
  }

  // パス上の距離差を計算（ループ対応、正=前方）
  static pathDelta(from, to) {
      let d = to - from;
      if (d > 0.5) d -= 1;
      if (d < -0.5) d += 1;
      return d;
  }

  constructor(carPath) {
      this.carPath = carPath;
      this.position = 0;
      this.speed = 0.2;
      this.targetSpeed = 0.2;
      this.object = null;
      this.wheels = [];
      this.wheelGroups = [];
      this.upVector = new THREE.Vector3(0, 1, 0);
      this.lastPosition = new THREE.Vector3();
      this.lastRotation = new THREE.Quaternion();
      this.lastTiltAngle = 0;
      this.lastDriftAngle = 0;
      this.currentDriftStrength = 0;
      this.lastDriftDirection = 0;
      this.targetDriftDirection = 0;

      // ヘッドライト関連
      this.leftHeadlight = null;
      this.rightHeadlight = null;
      this.headlightIntensity = 5.5;

      // スペックを生成
      this.specs = this.generateRandomSpecs();

      // ラインどり特性を生成
      this.drivingStyle = this.generateDrivingStyle();

      // スペックに基づいて速度制限を設定
      this.MIN_SPEED = 0.22 * this.specs.acceleration;
      this.MAX_SPEED = 0.4 * this.specs.topSpeed;
      this.ACCELERATION_RATE = 0.002 * this.specs.acceleration;
      this.DECELERATION_RATE = 0.004 * this.specs.handling;

      // 追い抜き関連
      this.overtakeDirection = 0;
      this.overtakeProgress = 0;

      // ステートパターン
      this._state = new NormalState(this);

      this.frozen = false;
      this.gridLateralOffset = 0;
      this._avoidanceOffset = 0;
      this._frameFwd = new THREE.Vector3(0, 0, -1);
      this._frameRight = new THREE.Vector3(1, 0, 0);
      // update()用の一時オブジェクトプール
      this._pool = {
          v3: [
              new THREE.Vector3(), // [0] calcTargetPos: flatTangent / PassState: myDirection
              new THREE.Vector3(), // [1] calcTargetPos: lineDir / updateRotation: rightVec
              new THREE.Vector3(), // [2] calcTargetPos: gridLineDir / updateRotation: correctedUp
              new THREE.Vector3(), // [3] calcTargetPos: overtakeVec / updateRotation: adjRight
              new THREE.Vector3(), // [4] calcTargetPos: avoidVec / updateRotation: adjUp
              new THREE.Vector3(), // [5] calcTargetPos: pushVec
          ],
          mat4: new THREE.Matrix4(),
          quat: new THREE.Quaternion(),
      };
      this._driftForward = new THREE.Vector3();
      this._driftSide = new THREE.Vector3();
      this._speedLineRenderer = new SpeedLineRenderer();
      this._driftSmokeRenderer = new DriftSmokeRenderer();
      this._curvatureCache = new Map();
      this.raceRank = 0;
      this.totalCars = 0;
  }

  setOtherCars(otherCars) {
    this.otherCars = otherCars;
  }

  generateRandomSpecs() {
      const specRanges = {
          topSpeed: { min: 0.8, max: 1.2 },
          acceleration: { min: 0.7, max: 1.3 },
          handling: { min: 0.8, max: 1.2 },
          grip: { min: 0.8, max: 1.2 }
      };
      const randomInRange = (min, max) => min + Math.random() * (max - min);
      const specs = {
          topSpeed: randomInRange(specRanges.topSpeed.min, specRanges.topSpeed.max),
          acceleration: randomInRange(specRanges.acceleration.min, specRanges.acceleration.max),
          handling: randomInRange(specRanges.handling.min, specRanges.handling.max),
          grip: randomInRange(specRanges.grip.min, specRanges.grip.max)
      };
      return specs;
  }

  generateDrivingStyle() {
      const style = {
          linePreference: Math.random(),
          cornerEntryAggression: Math.random(),
          cornerExitAggression: Math.random(),
          brakingTiming: Math.random(),
          lineTransitionTiming: Math.random(),
          lineConsistency: Math.random(),
          outInOutStrength: Math.random(),
          tandemPatience: Math.random(),
          useDrift: true,
          lineStrategy: this.selectLineStrategy(),
          // ファジーな挙動パラメータ（車ごとの個性）
          lineWobbleAmount: 0.3 + Math.random() * 0.7,   // 蛇行の振幅（0.3〜1.0）
          lineWobbleSpeed: 0.5 + Math.random() * 1.5,     // 蛇行の周期（0.5〜2.0）
          lineWobblePhase: Math.random() * Math.PI * 2,    // 蛇行の位相（車ごとにずらす）
          apexPrecision: 0.6 + Math.random() * 0.4,        // エイペックス精度（0.6〜1.0）
      };
      return style;
  }

  applyCustomConfig(specPreset, stylePreset, lineStrategy) {
      const randomInRange = (min, max) => min + Math.random() * (max - min);

      // スペックプリセット適用
      if (specPreset && C.SPEC_PRESETS[specPreset]) {
          const preset = C.SPEC_PRESETS[specPreset];
          this.specs.topSpeed = randomInRange(preset.topSpeed.min, preset.topSpeed.max);
          this.specs.acceleration = randomInRange(preset.acceleration.min, preset.acceleration.max);
          this.specs.handling = randomInRange(preset.handling.min, preset.handling.max);
          this.specs.grip = randomInRange(preset.grip.min, preset.grip.max);

          this.MIN_SPEED = 0.22 * this.specs.acceleration;
          this.MAX_SPEED = 0.4 * this.specs.topSpeed;
          this.ACCELERATION_RATE = 0.002 * this.specs.acceleration;
          this.DECELERATION_RATE = 0.004 * this.specs.handling;
      }

      // スタイルプリセット適用
      if (stylePreset && C.STYLE_PRESETS[stylePreset]) {
          const preset = C.STYLE_PRESETS[stylePreset];
          this.drivingStyle.cornerEntryAggression = randomInRange(preset.cornerEntry.min, preset.cornerEntry.max);
          this.drivingStyle.cornerExitAggression = randomInRange(preset.cornerExit.min, preset.cornerExit.max);
          this.drivingStyle.brakingTiming = randomInRange(preset.braking.min, preset.braking.max);
          this.drivingStyle.tandemPatience = randomInRange(preset.patience.min, preset.patience.max);
          this.drivingStyle.useDrift = preset.drift;
      }

      // ライン戦略適用
      if (lineStrategy && C.LINE_STRATEGY[lineStrategy]) {
          this.drivingStyle.lineStrategy = lineStrategy;
      }
  }

  createDetailedCar() {
      return buildCarModel(this);
  }

  createObject(scene) {
      const result = this.createDetailedCar();
      this.object = result.car;
      this.wheels = result.wheels;
      this.wheelGroups = result.wheelGroups;
      this.upVector = result.upVector;
      this.leftHeadlight = result.leftHeadlight;
      this.rightHeadlight = result.rightHeadlight;

      this.object.position.copy(this.carPath.getPointAt(this.position));
      this.object.position.y = 1.0;

      const initialTangent = this.carPath.getTangentAt(this.position);
      const initialDirection = new THREE.Vector3(initialTangent.x, 0, initialTangent.z).normalize();
      const initialTarget = new THREE.Vector3().addVectors(this.object.position, initialDirection);
      this.object.lookAt(initialTarget);

      this.lastPosition.copy(this.object.position);
      this.lastRotation.copy(this.object.quaternion);

      scene.add(this.object);
      this.createSpeedLines(scene);
      this._driftSmokeRenderer.create(scene);
  }

  // 車の上に国旗スプライトを設定
  setFlagSprite(countryCode) {
      if (!this.object || !countryCode) return;
      if (this._flagSprite) return; // 既に設定済み
      const flag = countryCodeToFlag(countryCode);
      if (!flag) return;

      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const c = canvas.getContext('2d');
      c.font = '48px serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(flag, 32, 32);

      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(1.44, 1.44, 1);
      sprite.position.set(0, 3.0, 0);
      this.object.add(sprite);

      this._flagSprite = sprite;
  }

  createSpeedLines(scene) {
      this._speedLineRenderer.create(scene);
  }

  updateSpeedLines() {
      this._speedLineRenderer.update(this);
      this._driftSmokeRenderer.update(this);
  }

  update(deltaTime) {
      if (this.frozen) { this.updateHeadlights(); return; }
      this.updateHeadlights();

      this._curvatureCache.clear();

      this.updateSpeed();
      this.handleOvertaking(this.otherCars);

      const speedKmh = this.speed * C.SPEED_TO_KMH;
      const speedScalingFactor = this._calcDriftScalingFactor(speedKmh);

      this.position += this.speed * 0.001;
      if (this.position >= 1) this.position -= 1;

      const point = this.carPath.getPointAt(this.position);
      const tangent = this.carPath.getTangentAt(this.position).normalize();
      const flatTangent = this._pool.v3[0].set(tangent.x, 0, tangent.z).normalize();

      this._frameFwd.copy(flatTangent);
      this._frameRight.set(-flatTangent.z, 0, flatTangent.x);

      this.avoidCollision(this.otherCars);

      const curvatureData = this.calculateCurvature(this.position);
      const curveAngle = curvatureData.angle;

      const dirSampleDist = C.DRIFT.DIR_SAMPLE_DIST;
      const dirP0 = this.carPath.getPointAt((this.position - dirSampleDist + 1) % 1);
      const dirP1 = this.carPath.getPointAt(this.position);
      const dirP2 = this.carPath.getPointAt((this.position + dirSampleDist) % 1);
      const dirV1x = dirP1.x - dirP0.x, dirV1z = dirP1.z - dirP0.z;
      const dirV2x = dirP2.x - dirP1.x, dirV2z = dirP2.z - dirP1.z;
      const curveTiltDirection = Math.sign(dirV1x * dirV2z - dirV1z * dirV2x) || 0;

      const baseLineOffset = C.LINE.BASE_OFFSET;
      const outInOutStrength = this.drivingStyle.outInOutStrength;
      const lineOffset = baseLineOffset * (0.7 + outInOutStrength * 0.6);

      const lineDirection = this._pool.v3[1].crossVectors(flatTangent, Car._UP).normalize();

      const nextCurveNear = this.calculateCurvature((this.position + 0.05) % 1);
      const nextCurveFar = this.calculateCurvature((this.position + 0.10) % 1);
      const nextCurveDirection = nextCurveNear.direction || nextCurveFar.direction;

      const cornerPhase = this.getCornerPhase(this.position, curveAngle);
      this._currentPhase = cornerPhase.phase;

      const strategyOffset = this.calculateStrategyOffset(
          cornerPhase.phase, cornerPhase.progress, curveAngle, curveTiltDirection, nextCurveDirection, lineOffset
      );

      if (this._lastLineOffset === undefined) this._lastLineOffset = 0;
      const diff = strategyOffset - this._lastLineOffset;
      const smoothed = Math.abs(diff) > C.LINE.MAX_CHANGE_PER_FRAME
          ? this._lastLineOffset + Math.sign(diff) * C.LINE.MAX_CHANGE_PER_FRAME
          : this._lastLineOffset + diff * C.LINE.SMOOTH_FACTOR;
      this._lastLineOffset = smoothed;

      // ファジーな蛇行を加える（車ごとの個性）
      if (!this._wobbleTime) this._wobbleTime = 0;
      this._wobbleTime += 0.016; // 約60fps想定
      const wobble = this.drivingStyle.lineWobbleAmount *
          Math.sin(this._wobbleTime * this.drivingStyle.lineWobbleSpeed * 2 +
                   this.drivingStyle.lineWobblePhase) *
          (1.0 - curveAngle * 3) * // カーブ中は蛇行を抑える
          0.8;
      const finalLineOffset = smoothed + wobble;

      point.add(lineDirection.multiplyScalar(finalLineOffset));

      if (Math.abs(this.gridLateralOffset) > 0.01) {
          const gridLineDir = this._pool.v3[2].crossVectors(flatTangent, Car._UP).normalize();
          point.add(gridLineDir.multiplyScalar(this.gridLateralOffset));
          this.gridLateralOffset *= 0.97;
      } else {
          this.gridLateralOffset = 0;
      }

      if (this.isOvertaking || this.overtakeProgress > 0) {
          const overtakeVector = this._pool.v3[3].set(-flatTangent.z, 0, flatTangent.x).normalize();
          const t = this.overtakeProgress;
          const eased = t * t * (3 - 2 * t);
          point.add(overtakeVector.multiplyScalar(C.OVERTAKE.OFFSET * this.overtakeDirection * eased));
      }

      const avoidanceOffset = this.calcLateralAvoidance();
      if (Math.abs(avoidanceOffset) > 0.001) {
          const avoidVec = this._pool.v3[4].set(-flatTangent.z, 0, flatTangent.x);
          point.add(avoidVec.multiplyScalar(avoidanceOffset));
      }

      if (this._emergencyPush && Math.abs(this._emergencyPush) > 0.01) {
          const pushVec = this._pool.v3[5].set(-flatTangent.z, 0, flatTangent.x);
          point.add(pushVec.multiplyScalar(this._emergencyPush));
      }
      this._emergencyPush *= 0.7;

      const carHeight = point.y + 0.3;
      const speedFactor = Math.min(1.0, this.speed / 0.7);

      const forwardVector = flatTangent;
      const upVector = Car._UP;
      const rightVector = this._pool.v3[1].crossVectors(forwardVector, upVector).normalize();
      const correctedUpVector = this._pool.v3[2].crossVectors(rightVector, forwardVector).normalize();

      const adjustedForwardVector = this.updateDrift(curveAngle, curveTiltDirection, forwardVector, speedScalingFactor);

      const adjustedRightVector = this._pool.v3[3].crossVectors(adjustedForwardVector, upVector).normalize();
      const adjustedUpVector = this._pool.v3[4].crossVectors(adjustedRightVector, adjustedForwardVector).normalize();

      const rotationMatrix = this._pool.mat4.makeBasis(
          adjustedRightVector,
          adjustedUpVector,
          adjustedForwardVector.clone().negate()
      );

      const targetRotation = this._pool.quat.setFromRotationMatrix(rotationMatrix);
      this.object.quaternion.copy(targetRotation);
      this.object.rotateX(this.lastTiltAngle * 1.5);

      const baseTilt = this.currentDriftStrength > C.DRIFT.TILT_DRIFT_THRESHOLD ? C.DRIFT.TILT_BASE_DRIFT : C.DRIFT.TILT_BASE_NORMAL;
      const driftTiltBoost = this.currentDriftStrength * C.DRIFT.TILT_DRIFT_BOOST;
      const tiltSpeedScale = Math.max(C.DRIFT.TILT_SPEED_SCALE_MIN, speedScalingFactor * C.DRIFT.TILT_SPEED_SCALE_MULT);
      const maxTilt = (baseTilt + driftTiltBoost) * tiltSpeedScale;
      const baseTiltMultiplier = C.DRIFT.TILT_BASE_MULT + this.currentDriftStrength * C.DRIFT.TILT_DRIFT_MULT;
      const tiltMultiplier = baseTiltMultiplier * speedScalingFactor * C.DRIFT.TILT_SPEED_MULT;
      const tiltFactor = Math.min(maxTilt, curveAngle * this.speed * tiltMultiplier);
      const finalTiltFactor = tiltFactor * (1.0 + this.currentDriftStrength * speedScalingFactor * C.DRIFT.TILT_DRIFT_FINAL);
      this.object.rotateZ(-finalTiltFactor * curveTiltDirection * C.DRIFT.TILT_CURVE_MULT);

      this.object.position.set(point.x, carHeight, point.z);
      this.updateWheels(curveTiltDirection, curveAngle, finalTiltFactor);
      this.updateSpeedLines();
  }

  updateSpeed() {
      const currentCurvature = this.calculateCurvature(this.position).angle;
      const lookAhead = C.STRATEGY_LOOK_AHEAD[this.drivingStyle.lineStrategy] || 0.05;
      const upcomingCurvature = this.predictUpcomingCurve(this.position, lookAhead);

      const effectiveCurvature = Math.max(currentCurvature, upcomingCurvature);
      const maxCurveAngle = 0.3;
      const curvatureToSpeedRatio = 0.55 * (1 / this.specs.grip);
      const cornerAggression = this.drivingStyle.cornerEntryAggression * 0.15;
      const brakingAdjustment = this.drivingStyle.brakingTiming * 0.1;
      const normalizedCurvature = Math.min(1.0, effectiveCurvature / maxCurveAngle);
      const curvatureSpeedFactor = 1.0 -
          normalizedCurvature * normalizedCurvature *
          curvatureToSpeedRatio *
          (1.0 - cornerAggression);

      this.targetSpeed = Math.max(this.MIN_SPEED * 1.2, this.MAX_SPEED * (curvatureSpeedFactor + brakingAdjustment));

      // ラバーバンド補正（順位に応じて速度を調整し、差がつきにくくする）
      if (this.totalCars > 1 && this.raceRank > 0) {
          // rankRatio: 1位=0.0, 最下位=1.0
          const rankRatio = (this.raceRank - 1) / (this.totalCars - 1);
          // 1位: -8%減速, 最下位: +8%加速
          const rubberBand = 1.0 + (rankRatio - 0.5) * 0.16;
          this.targetSpeed *= rubberBand;
      }

      const accelerationBoost = this.drivingStyle.cornerExitAggression * 0.2;
      if (this.speed < this.targetSpeed) {
          this.speed = Math.min(this.targetSpeed,
              this.speed + (this.ACCELERATION_RATE * (1 + accelerationBoost)));
      } else if (this.speed > this.targetSpeed) {
          const brakingForce = this.DECELERATION_RATE * (1 + normalizedCurvature * 0.8);
          this.speed = Math.max(this.targetSpeed, this.speed - brakingForce);
      }
  }

  calculateCurvature(t, samplePoints = 8, sampleDistance = 0.005) {
    const key = Math.round(t * 10000);
    if (this._curvatureCache && this._curvatureCache.has(key)) {
        return this._curvatureCache.get(key);
    }

    const v1 = Car._tmpVec2_0;
    const v2 = Car._tmpVec2_1;
    let angleSum = 0;
    let totalDist = 0;

    for (let i = 0; i < samplePoints - 1; i++) {
        const currentPos = (t + i * sampleDistance) % 1;
        const nextPos = (currentPos + sampleDistance) % 1;
        const nextNextPos = (nextPos + sampleDistance) % 1;

        const point = this.carPath.getPointAt(currentPos);
        const nextPoint = this.carPath.getPointAt(nextPos);
        const nextNextPoint = this.carPath.getPointAt(nextNextPos);

        const dx1 = nextPoint.x - point.x, dz1 = nextPoint.z - point.z;
        const dx2 = nextNextPoint.x - nextPoint.x, dz2 = nextNextPoint.z - nextPoint.z;
        const segDist = Math.sqrt(dx1 * dx1 + dz1 * dz1);

        v1.set(dx1, dz1).normalize();
        v2.set(dx2, dz2).normalize();

        const angle = Math.acos(Math.min(1, Math.max(-1, v1.dot(v2))));
        angleSum += angle;
        totalDist += segDist;
    }

    // 単位距離あたりの曲率に正規化（基準距離で統一）
    const REF_DIST = 17.0;
    const avgAngle = totalDist > 0 ? (angleSum / totalDist) * REF_DIST : 0;

    const middleIndex = Math.floor(samplePoints / 2);
    const currentPos = (t + middleIndex * sampleDistance) % 1;
    const nextPos = (currentPos + sampleDistance) % 1;
    const nextNextPos = (nextPos + sampleDistance) % 1;

    const pointStart = this.carPath.getPointAt(currentPos);
    const pointNext = this.carPath.getPointAt(nextPos);
    const pointNextNext = this.carPath.getPointAt(nextNextPos);

    v1.set(pointNext.x - pointStart.x, pointNext.z - pointStart.z).normalize();
    v2.set(pointNextNext.x - pointNext.x, pointNextNext.z - pointNext.z).normalize();

    const crossProduct = v1.x * v2.y - v1.y * v2.x;
    const tiltDirection = Math.sign(crossProduct);

    const result = { angle: avgAngle, direction: tiltDirection };
    if (this._curvatureCache) this._curvatureCache.set(key, result);
    return result;
  }

  predictUpcomingCurve(currentPosition, lookAheadDistance = 0.05) {
    const upcomingPos = (currentPosition + lookAheadDistance) % 1;
    const curvatureData = this.calculateCurvature(upcomingPos);
    return curvatureData.angle;
  }

  selectLineStrategy() {
      const roll = Math.random();
      if (roll < 0.35) return C.LINE_STRATEGY.OUT_IN_OUT;
      if (roll < 0.60) return C.LINE_STRATEGY.LATE_APEX;
      if (roll < 0.80) return C.LINE_STRATEGY.IN_IN_IN;
      return C.LINE_STRATEGY.WIDE_ENTRY;
  }

  getCornerPhase(position, curveAngle) {
      const CURVE_THRESHOLD = 0.03;
      const transitionTiming = 0.04 + this.drivingStyle.lineTransitionTiming * 0.06;

      const aheadFar = this.predictUpcomingCurve(position, transitionTiming);
      const aheadNear = this.predictUpcomingCurve(position, transitionTiming * 0.5);
      const behindCurve = this.calculateCurvature((position - transitionTiming + 1) % 1).angle;

      if (curveAngle < CURVE_THRESHOLD && aheadFar > CURVE_THRESHOLD) {
          const progress = Math.min(1, aheadNear / 0.2);
          return { phase: 'approach', progress };
      }
      if (curveAngle >= CURVE_THRESHOLD && behindCurve < CURVE_THRESHOLD) {
          const progress = Math.min(1, curveAngle / 0.2);
          return { phase: 'entry', progress };
      }
      if (curveAngle >= CURVE_THRESHOLD) {
          const progress = Math.min(1, curveAngle / 0.2);
          return { phase: 'mid', progress };
      }
      if (curveAngle < CURVE_THRESHOLD && behindCurve >= CURVE_THRESHOLD) {
          const progress = 1 - Math.min(1, behindCurve / 0.2);
          return { phase: 'exit', progress };
      }
      return { phase: 'straight', progress: 0 };
  }

  calculateStrategyOffset(phase, progress, curveAngle, curveDirection, nextCurveDirection, lineOffset) {
      const strategy = this.drivingStyle.lineStrategy;
      const strength = 0.5 + this.drivingStyle.outInOutStrength * 0.5;
      const consistency = 0.5 + this.drivingStyle.lineConsistency * 0.5;
      const pref = this.drivingStyle.linePreference;
      const baseOffset = lineOffset * (pref * 2 - 1) * Math.min(1, curveAngle * 10) * consistency * 0.3;
      const dir = curveDirection || nextCurveDirection;
      const curveScale = Math.min(1, curveAngle / 0.08);
      const phaseOffsets = this._getStrategyPhaseOffsets(strategy, dir, lineOffset, strength, baseOffset);
      const currentOffset = phaseOffsets[phase] ?? baseOffset;
      const nextPhase = this._getNextPhase(phase);
      const nextOffset = phaseOffsets[nextPhase] ?? baseOffset;
      const rawOffset = currentOffset + (nextOffset - currentOffset) * progress;

      // エイペックス精度：精度が低い車ほどコーナーでラインがばらつく
      const precision = this.drivingStyle.apexPrecision ?? 1.0;
      const imprecision = (1.0 - precision) * lineOffset * 0.5 *
          Math.sin(this.position * 200 + (this.drivingStyle.lineWobblePhase || 0));

      if ((phase === 'mid' || phase === 'entry') && strategy !== C.LINE_STRATEGY.IN_IN_IN) {
          return rawOffset * curveScale + imprecision;
      }
      return rawOffset + imprecision * 0.3;
  }

  _getStrategyPhaseOffsets(strategy, dir, offset, strength, baseOffset) {
      switch (strategy) {
          case C.LINE_STRATEGY.OUT_IN_OUT:
              return {
                  straight: baseOffset,
                  approach: -dir * offset * strength,
                  entry:    -dir * offset * strength * 0.5,
                  mid:       dir * offset * strength,
                  exit:     -dir * offset * strength * 0.6,
              };
          case C.LINE_STRATEGY.LATE_APEX:
              return {
                  straight: baseOffset,
                  approach: -dir * offset * strength,
                  entry:    -dir * offset * strength * 0.7,
                  mid:       dir * offset * strength,
                  exit:      baseOffset * 0.3,
              };
          case C.LINE_STRATEGY.IN_IN_IN:
              return {
                  straight:  dir * offset * strength * 0.5,
                  approach:  dir * offset * strength,
                  entry:     dir * offset * strength,
                  mid:       dir * offset * strength,
                  exit:      dir * offset * strength * 0.8,
              };
          case C.LINE_STRATEGY.WIDE_ENTRY:
              return {
                  straight: baseOffset,
                  approach: -dir * offset * strength * 1.5,
                  entry:    -dir * offset * strength * 0.8,
                  mid:       dir * offset * strength * 1.3,
                  exit:      baseOffset * 0.4,
              };
          default:
              return { straight: baseOffset, approach: baseOffset, entry: baseOffset, mid: baseOffset, exit: baseOffset };
      }
  }

  _getNextPhase(phase) {
      const order = { straight: 'approach', approach: 'entry', entry: 'mid', mid: 'exit', exit: 'straight' };
      return order[phase] || 'straight';
  }

  updateDrift(curveAngle, curveTiltDirection, forwardVector, speedScalingFactor) {
      const mildCurveThreshold = C.DRIFT.MILD_CURVE_THRESHOLD;
      const sharpCurveThreshold = C.DRIFT.SHARP_CURVE_THRESHOLD;

      const prevPos = (this.position - C.DRIFT.PREV_NEXT_DIST + 1) % 1;
      const nextPos = (this.position + C.DRIFT.PREV_NEXT_DIST) % 1;
      const futurePos = (this.position + C.DRIFT.FUTURE_DIST) % 1;

      const farPoints = C.DRIFT.SAMPLE_DISTANCES.map(d => (this.position + d) % 1);

      const prevCurve = this.calculateCurvature(prevPos).angle;
      const nextCurve = this.calculateCurvature(nextPos).angle;
      const futureCurve = this.calculateCurvature(futurePos).angle;

      const farCurves = farPoints.map(p => this.calculateCurvature(p).angle);

      const maxFutureCurvature = Math.max(...farCurves);
      const hasSharpCurveAhead = maxFutureCurvature > sharpCurveThreshold * C.DRIFT.SHARP_AHEAD_RATIO;

      const nearFutureCurvatureGradient = (farCurves[1] - curveAngle) / C.DRIFT.NEAR_GRADIENT_DIST;
      const farFutureCurvatureGradient = (farCurves[3] - curveAngle) / C.DRIFT.FAR_GRADIENT_DIST;
      const isApproachingSharpCurve = (nearFutureCurvatureGradient > C.DRIFT.APPROACH_NEAR_GRADIENT || farFutureCurvatureGradient > C.DRIFT.APPROACH_FAR_GRADIENT) &&
                                     maxFutureCurvature > mildCurveThreshold * C.DRIFT.APPROACH_CURVE_RATIO;

      const curvatureRateOfChange = (nextCurve - prevCurve) / (C.DRIFT.PREV_NEXT_DIST * 2);
      const futureCurvatureChange = (futureCurve - curveAngle) / C.DRIFT.FUTURE_DIST;

      const isRapidCurvatureIncrease = nearFutureCurvatureGradient > C.DRIFT.RAPID_INCREASE_THRESHOLD;

      const isEnteringCorner = curveAngle > prevCurve;
      const isExitingCorner = curveAngle > nextCurve;
      const isApproachingExit = futureCurvatureChange < C.DRIFT.EXIT_CURVE_CHANGE && curveAngle > mildCurveThreshold * C.DRIFT.EXIT_CURVE_RATIO;
      const isAtCornerPeak = isEnteringCorner && isExitingCorner;

      const isNearCornerPeak = Math.abs(curvatureRateOfChange) < 0.5 && curveAngle > mildCurveThreshold;

      const isInStraightLine = curveAngle < mildCurveThreshold * C.DRIFT.STRAIGHT_CURRENT_RATIO &&
                              maxFutureCurvature < mildCurveThreshold * C.DRIFT.STRAIGHT_FUTURE_RATIO &&
                              prevCurve < mildCurveThreshold * C.DRIFT.STRAIGHT_PREV_RATIO;

      const isInStraightAfterCorner = curveAngle < mildCurveThreshold * C.DRIFT.STRAIGHT_AFTER_RATIO &&
                                    (prevCurve > mildCurveThreshold * C.DRIFT.STRAIGHT_AFTER_PREV_RATIO ||
                                     this.currentDriftStrength > C.DRIFT.STRAIGHT_AFTER_DRIFT_MIN);

      const isTransitioningToStraight = curveAngle < mildCurveThreshold * C.DRIFT.TRANSITION_RATIO &&
                                       prevCurve > mildCurveThreshold * C.DRIFT.TRANSITION_PREV_RATIO &&
                                       this.currentDriftStrength > C.DRIFT.TRANSITION_DRIFT_MIN;

      const hasFinishedCurrentCorner = (curveAngle < mildCurveThreshold * C.DRIFT.FINISHED_CORNER_RATIO1 && prevCurve > mildCurveThreshold * C.DRIFT.FINISHED_CORNER_PREV_RATIO1) ||
                                      (curveAngle < mildCurveThreshold * C.DRIFT.FINISHED_CORNER_RATIO2 && prevCurve > mildCurveThreshold * C.DRIFT.FINISHED_CORNER_PREV_RATIO2) ||
                                      isExitingCorner;

      const currentDriftIsStrong = this.currentDriftStrength > C.DRIFT.STRONG_DRIFT_THRESHOLD &&
                                (isInStraightAfterCorner || isExitingCorner || curveAngle > mildCurveThreshold * C.DRIFT.STRONG_DRIFT_CURVE_RATIO);

      const shouldMaintainCurrentDrift = (this.currentDriftStrength > C.DRIFT.MAINTAIN_DRIFT_MIN &&
                                      (isInStraightAfterCorner || isTransitioningToStraight || isExitingCorner)) ||
                                      (this.currentDriftStrength > C.DRIFT.MAINTAIN_STRONG_MIN && !hasFinishedCurrentCorner) ||
                                      currentDriftIsStrong;

      let targetDriftStrength = 0;

      if (curveAngle > mildCurveThreshold * C.DRIFT.START_CURRENT_RATIO ||
         (hasSharpCurveAhead && maxFutureCurvature > mildCurveThreshold * C.DRIFT.START_AHEAD_CURVE_RATIO && curveAngle > mildCurveThreshold * C.DRIFT.START_AHEAD_CURRENT_RATIO) ||
         (isApproachingSharpCurve && curveAngle > mildCurveThreshold * C.DRIFT.START_APPROACH_RATIO)) {

          const entryPhase = curveAngle / Math.max(curveAngle, prevCurve);
          let cornerProgressFactor = 0;

          if (isAtCornerPeak || isNearCornerPeak) {
              cornerProgressFactor = C.DRIFT.PEAK_FACTOR;
          } else if (isExitingCorner) {
              cornerProgressFactor = C.DRIFT.EXIT_FACTOR;
          } else if (isEnteringCorner) {
              const entrySuppressionFactor = Math.min(1, Math.max(0, curvatureRateOfChange * C.DRIFT.ENTRY_SUPPRESSION_MULT));
              const entryProgress = Math.min(1, entryPhase * 2);
              cornerProgressFactor = C.DRIFT.ENTRY_BASE_FACTOR - entrySuppressionFactor * C.DRIFT.ENTRY_SUPPRESSION + entryProgress * C.DRIFT.ENTRY_PROGRESS_FACTOR;
          } else if (hasSharpCurveAhead || isApproachingSharpCurve) {
              const distanceAdjustment = isRapidCurvatureIncrease ? C.DRIFT.AHEAD_RAPID_FACTOR : C.DRIFT.AHEAD_MILD_FACTOR;
              cornerProgressFactor = distanceAdjustment;
          }

          if (curveAngle <= sharpCurveThreshold) {
              const currentCurveDrift = Math.max(0, (curveAngle - mildCurveThreshold * C.DRIFT.CURRENT_START_RATIO) / (sharpCurveThreshold - mildCurveThreshold));
              let futureCurveDrift = 0;
              if (hasSharpCurveAhead) {
                  futureCurveDrift = Math.max(0, (maxFutureCurvature - mildCurveThreshold * C.DRIFT.FUTURE_START_RATIO) / (sharpCurveThreshold - mildCurveThreshold));
                  const distanceFactor = isRapidCurvatureIncrease ? C.DRIFT.FUTURE_RAPID_FACTOR : C.DRIFT.FUTURE_MILD_FACTOR;
                  futureCurveDrift *= distanceFactor;
              }
              targetDriftStrength = Math.max(currentCurveDrift, futureCurveDrift);
          } else {
              const extremeCurveFactor = Math.min(1.0, (curveAngle - sharpCurveThreshold) / (sharpCurveThreshold * C.DRIFT.EXTREME_CURVE_DIVISOR) + C.DRIFT.EXTREME_CURVE_BASE);
              targetDriftStrength = extremeCurveFactor;
          }

          targetDriftStrength = Math.min(1.0, targetDriftStrength * C.DRIFT.STRENGTH_MULTIPLIER);
          targetDriftStrength *= cornerProgressFactor;

          const minDriftSpeed = this.MAX_SPEED * C.DRIFT.MIN_DRIFT_SPEED_RATIO;
          const fullDriftSpeed = this.MAX_SPEED * C.DRIFT.FULL_DRIFT_SPEED_RATIO;
          const driftSpeedFactor = Math.min(1.0, Math.max(0, (this.speed - minDriftSpeed) / (fullDriftSpeed - minDriftSpeed)));
          targetDriftStrength *= driftSpeedFactor;

          if (this.speed < this.MAX_SPEED * C.DRIFT.NO_DRIFT_SPEED_RATIO) {
              targetDriftStrength = 0;
          }
      } else if (isInStraightAfterCorner && this.currentDriftStrength > C.DRIFT.STRAIGHT_AFTER_DRIFT_MIN) {
          targetDriftStrength = this.currentDriftStrength * C.DRIFT.DECAY_STRAIGHT_AFTER;
      } else if (isTransitioningToStraight && this.currentDriftStrength > C.DRIFT.TRANSITION_DRIFT_MIN) {
          targetDriftStrength = this.currentDriftStrength * C.DRIFT.DECAY_TRANSITIONING;
      } else if (isInStraightLine && this.currentDriftStrength > 0) {
          targetDriftStrength = this.currentDriftStrength * C.DRIFT.DECAY_STRAIGHT;
      }

      const enterDriftSpeed = this.speed * C.DRIFT.ENTER_SPEED_MULT;
      let exitDriftSpeed = C.DRIFT.EXIT_SPEED_BASE;

      if (targetDriftStrength === 0 && this.currentDriftStrength < C.DRIFT.EXIT_WEAK_THRESHOLD) {
          exitDriftSpeed = C.DRIFT.EXIT_WEAK_SPEED;
          if (this.currentDriftStrength < C.DRIFT.EXIT_VERY_WEAK_THRESHOLD) {
              exitDriftSpeed = C.DRIFT.EXIT_VERY_WEAK_SPEED;
          }
      }

      if (isInStraightLine && this.currentDriftStrength > 0) {
          exitDriftSpeed *= C.DRIFT.EXIT_STRAIGHT_MULT;
      }

      if (isInStraightLine && this.currentDriftStrength < 0.3) {
          this.lastDriftDirection *= C.DRIFT.DIRECTION_STRAIGHT_DECAY;
      }

      if (isApproachingExit && this.currentDriftStrength > C.DRIFT.APPROACHING_EXIT_MIN) {
          exitDriftSpeed *= C.DRIFT.EXIT_APPROACHING_MULT;
      }

      if (isTransitioningToStraight && this.currentDriftStrength > C.DRIFT.TRANSITION_EXIT_MIN) {
          exitDriftSpeed *= C.DRIFT.EXIT_TRANSITION_MULT;
      }

      const interpolationSpeed = targetDriftStrength > this.currentDriftStrength ?
                              enterDriftSpeed : exitDriftSpeed;

      this.currentDriftStrength += (targetDriftStrength - this.currentDriftStrength) * interpolationSpeed;

      if (this.currentDriftStrength < C.DRIFT.STRENGTH_ZERO_THRESHOLD) {
          this.currentDriftStrength = 0;
      }

      if (this.currentDriftStrength < C.DRIFT.DIRECTION_WEAK_THRESHOLD && this.targetDriftDirection === 0) {
          this.lastDriftDirection *= C.DRIFT.DIRECTION_WEAK_DECAY;
          if (Math.abs(this.lastDriftDirection) < C.DRIFT.DIRECTION_ZERO_THRESHOLD) {
              this.lastDriftDirection = 0;
          }
      }

      const currentDirection = curveTiltDirection;
      let immediateDirection = currentDirection;

      if (curveAngle > mildCurveThreshold * C.DRIFT.DIRECTION_CURVE_THRESHOLD) {
          immediateDirection = currentDirection;
      } else if (this.currentDriftStrength > C.DRIFT.DIRECTION_SUSTAIN_THRESHOLD) {
          immediateDirection = Math.sign(this.lastDriftDirection) || currentDirection;
      } else {
          const nearFutureData = this.calculateCurvature((this.position + C.DRIFT.DIRECTION_NEAR_FUTURE_DIST) % 1);
          if (nearFutureData.angle > mildCurveThreshold * C.DRIFT.DIRECTION_NEAR_CURVE_RATIO) {
              immediateDirection = nearFutureData.direction;
          } else {
              immediateDirection = currentDirection;
          }
      }

      if (this.currentDriftStrength > C.DRIFT.DIRECTION_SUSTAIN_MIN) {
          this.targetDriftDirection = immediateDirection;
      } else {
          this.targetDriftDirection = 0;
      }

      const directionChangeSpeed = C.DRIFT.DIRECTION_CHANGE_SPEED;

      if (this.lastDriftDirection !== this.targetDriftDirection) {
          if (Math.abs(this.lastDriftDirection) < C.DRIFT.DIRECTION_NEAR_ZERO) {
              this.lastDriftDirection += (this.targetDriftDirection - this.lastDriftDirection) * directionChangeSpeed;
          } else if (Math.sign(this.lastDriftDirection) !== Math.sign(this.targetDriftDirection) &&
                    Math.abs(this.targetDriftDirection) > C.DRIFT.DIRECTION_CLEAR_DIFF) {
              this.lastDriftDirection += (0 - this.lastDriftDirection) * directionChangeSpeed * C.DRIFT.DIRECTION_REVERSE_DECAY;
              if (Math.abs(this.lastDriftDirection) < C.DRIFT.DIRECTION_REVERSE_NEAR) {
                  this.lastDriftDirection = this.targetDriftDirection * C.DRIFT.DIRECTION_REVERSE_INIT;
              }
          } else {
              this.lastDriftDirection += (this.targetDriftDirection - this.lastDriftDirection) * directionChangeSpeed;
          }
      }

      let adjustedForwardVector = this._driftForward.copy(forwardVector);

      if (this.currentDriftStrength > C.DRIFT.DRIFT_VISUAL_MIN) {
          const sideVector = this._driftSide.set(-forwardVector.z, 0, forwardVector.x).normalize();
          const baseMaxDriftAngle = C.DRIFT.BASE_MAX_ANGLE;
          let transitionFactor = 1.0;
          const targetDriftAngle = this.currentDriftStrength * baseMaxDriftAngle * speedScalingFactor * this.lastDriftDirection * transitionFactor;
          const angleInterpolationBase = C.DRIFT.ANGLE_INTERP_BASE;
          const angleInterpolationFactor = Math.abs(this.lastDriftAngle - targetDriftAngle) > C.DRIFT.ANGLE_LARGE_DIFF ?
                                          angleInterpolationBase * C.DRIFT.ANGLE_INTERP_SLOW : angleInterpolationBase;
          this.lastDriftAngle += (targetDriftAngle - this.lastDriftAngle) * angleInterpolationFactor;
          const sideMultiplier = Math.sin(this.lastDriftAngle) * C.DRIFT.SIDE_MULTIPLIER;
          sideVector.multiplyScalar(sideMultiplier);
          adjustedForwardVector.x = forwardVector.x * Math.cos(this.lastDriftAngle) + sideVector.x;
          adjustedForwardVector.z = forwardVector.z * Math.cos(this.lastDriftAngle) + sideVector.z;
          adjustedForwardVector.normalize();
      } else {
          this.lastDriftAngle *= C.DRIFT.ANGLE_RESET_DECAY;
          if (Math.abs(this.lastDriftAngle) < C.DRIFT.ANGLE_ZERO_THRESHOLD) {
              this.lastDriftAngle = 0;
          }
      }

      return adjustedForwardVector;
  }

  updateWheels(curveTiltDirection, curveAngle, finalTiltFactor) {
      const wheelRotationSpeed = this.speed * 0.3;
      const baseSteeringMultiplier = 3.5;
      let steeringMultiplier = baseSteeringMultiplier;
      let steeringAngle = -curveTiltDirection * Math.abs(curveAngle) * steeringMultiplier * 0.5;
      const maxSteeringAngle = Math.PI / 2.5;
      const clampedSteeringAngle = Math.max(-maxSteeringAngle, Math.min(maxSteeringAngle, steeringAngle));

      for (let i = 0; i < this.wheels.length; i++) {
          this.wheels[i].rotation.x += wheelRotationSpeed;
          const wheelGroup = this.wheelGroups[i];
          const isLeftSide = (i % 2 === 0);
          const isFrontWheel = (i < 2);

          if (isFrontWheel) {
              if (this.currentDriftStrength > C.DRIFT.COUNTER_STEER_THRESHOLD) {
                  const counterSteerBase = C.DRIFT.COUNTER_STEER_BASE;
                  const counterSteerStrength = counterSteerBase + this.currentDriftStrength * C.DRIFT.COUNTER_STEER_DRIFT;
                  wheelGroup.rotation.y = -clampedSteeringAngle * counterSteerStrength;
              } else {
                  wheelGroup.rotation.y = clampedSteeringAngle;
              }
          } else {
              wheelGroup.rotation.y = 0;
              if (this.currentDriftStrength > C.DRIFT.REAR_OFFSET_THRESHOLD) {
                  const rearOffset = this.currentDriftStrength * C.DRIFT.REAR_OFFSET_MULT * this.lastDriftDirection;
                  const baseWheelX = isLeftSide ? -1.1 : 1.1;
                  wheelGroup.position.x = baseWheelX + (isLeftSide ? -rearOffset : rearOffset);
              } else {
                  wheelGroup.position.x = isLeftSide ? -1.1 : 1.1;
              }
          }

          const wheelBaseHeight = 0.5;
          const tiltOffsetMultiplier = C.DRIFT.TILT_OFFSET_BASE + this.currentDriftStrength * C.DRIFT.TILT_OFFSET_DRIFT;
          const wheelTiltOffset = isLeftSide ?
              -finalTiltFactor * curveTiltDirection * tiltOffsetMultiplier :
              finalTiltFactor * curveTiltDirection * tiltOffsetMultiplier;
          wheelGroup.position.y = wheelBaseHeight + wheelTiltOffset;
      }
  }

  updateHeadlights() {
      if (!this.leftHeadlight || !this.rightHeadlight) return;
      this.leftHeadlight.visible = false;
      this.rightHeadlight.visible = false;
  }

  findCarAhead(cars) {
      const myT = this.position;
      let nearestCar = null;
      let nearestGap = Infinity;

      for (const car of cars) {
          const tDelta = Car.pathDelta(myT, car.position);
          if (tDelta < C.GAP.FIND_AHEAD_MIN || tDelta > C.GAP.FIND_AHEAD_MAX) continue;

          const dx = car.object.position.x - this.object.position.x;
          const dz = car.object.position.z - this.object.position.z;
          const dist3D = Math.sqrt(dx * dx + dz * dz);
          if (dist3D > C.OVERTAKE.DISTANCE) continue;

          if (tDelta < nearestGap) {
              nearestGap = tDelta;
              nearestCar = car;
          }
      }
      return { car: nearestCar, gap: nearestGap };
  }

  handleOvertaking(cars) {
      this._state.update(cars);
  }

  transitionTo(StateClass, params = {}) {
      this._state.exit();
      this._state = new StateClass(this);
      this._state.enter(params);
  }

  get isPassing() {
      return this._state instanceof PassState;
  }
  get isOvertaking() {
      return this._state instanceof PassState || this._state instanceof ReturningState;
  }
  get isReturning() {
      return this._state instanceof ReturningState;
  }
  get isTandemFollowing() {
      return this._state instanceof TandemState;
  }
  get stateName() {
      return this._state.name;
  }
  get tandemDuration() {
      return this._state instanceof TandemState ? this._state.duration : 0;
  }
  get slipstreamCharge() {
      if (this._state instanceof TandemState) return this._state.slipstreamCharge;
      if (this._state instanceof PassState) return this._state.slipstreamCharge;
      return 0;
  }
  get tandemMaxDuration() {
      return this._state instanceof TandemState ? this._state.maxDuration : 0;
  }
  get overtakeTargetCar() {
      return this._state instanceof PassState ? this._state.target : null;
  }

  _calcDriftScalingFactor(speedKmh) {
      if (!this.drivingStyle || !this.drivingStyle.useDrift) return 0.01;
      if (speedKmh <= 60)  return 0.05;
      if (speedKmh <= 80)  return 0.05 + (speedKmh - 60) * (0.1 / 20);
      if (speedKmh <= 100) return 0.15 + (speedKmh - 80) * (0.15 / 20);
      if (speedKmh <= 130) return 0.3 + (speedKmh - 100) * (0.3 / 30);
      if (speedKmh <= 150) return 0.6 + (speedKmh - 130) * (0.4 / 20);
      if (speedKmh <= 180) return 1.0 + (speedKmh - 150) * (0.7 / 30);
      return 1.7;
  }

  _isCarBusy(car) {
      return car.isOvertaking || car.isTandemFollowing;
  }

  _countCarsCloselyBehind(cars) {
      let count = 0;
      for (const c of cars) {
          if (c === this) continue;
          const behindGap = Car.pathDelta(c.position, this.position);
          if (behindGap > 0 && behindGap < C.GAP.BEHIND_CHECK) count++;
      }
      return count;
  }

  isReturnPathBlocked(cars) {
      if (!this.object || !cars || this.overtakeDirection === 0) return false;
      const myPos = this.object.position;
      const fwd = this._frameFwd;
      const right = this._frameRight;

      for (const other of cars) {
          if (!other.object || other === this) continue;
          let pathDist = Math.abs(this.position - other.position);
          if (pathDist > 0.5) pathDist = 1.0 - pathDist;
          if (pathDist > 0.015) continue;

          const dx = other.object.position.x - myPos.x;
          const dz = other.object.position.z - myPos.z;
          const forwardDist = fwd.x * dx + fwd.z * dz;
          if (Math.abs(forwardDist) > 8.0) continue;
          const lateralDist = right.x * dx + right.z * dz;
          const towardReturn = -this.overtakeDirection * lateralDist;
          if (towardReturn > 0 && towardReturn < 3.0) {
              return true;
          }
      }
      return false;
  }

  avoidCollision(otherCars) {
      if (!this.object || !otherCars) return;

      const myPos = this.object.position;
      const fwd = this._frameFwd;
      const right = this._frameRight;

      const laneWidth = this.isReturning
          ? C.COLLISION.LANE_WIDTH + C.OVERTAKE.OFFSET * this.overtakeProgress
          : C.COLLISION.LANE_WIDTH;

      for (const other of otherCars) {
          if (!other.object) continue;

          const dx = other.object.position.x - myPos.x;
          const dz = other.object.position.z - myPos.z;

          const forwardDist = fwd.x * dx + fwd.z * dz;
          const lateralDist = Math.abs(right.x * dx + right.z * dz);

          if (forwardDist > 0 && forwardDist <= C.COLLISION.AHEAD_DIST && lateralDist <= laneWidth) {
              if (this.speed > other.speed) {
                  if (forwardDist < C.COLLISION.BRAKE_DIST * 0.4) {
                      this.speed = Math.min(this.speed, Math.max(other.speed * 0.9, this.MIN_SPEED));
                  } else if (forwardDist < C.COLLISION.BRAKE_DIST) {
                      this.speed = Math.min(this.speed, Math.max(other.speed, this.MIN_SPEED));
                  } else {
                      const t = 1.0 - (forwardDist - C.COLLISION.BRAKE_DIST) / (C.COLLISION.AHEAD_DIST - C.COLLISION.BRAKE_DIST);
                      const limitSpeed = other.speed + (this.speed - other.speed) * (1.0 - t);
                      this.speed = Math.min(this.speed, Math.max(limitSpeed, this.MIN_SPEED));
                  }
              }
          }

          if (Math.abs(forwardDist) < C.COLLISION.SIDE_FORWARD
              && lateralDist > 0.5 && lateralDist < C.COLLISION.SIDE_LATERAL) {
              if (this.speed <= other.speed) {
                  this.speed = Math.max(this.MIN_SPEED, this.speed * C.COLLISION.SIDE_BRAKE);
              }
          }

          if (Math.abs(forwardDist) < C.COLLISION.BODY_LENGTH
              && lateralDist < C.COLLISION.BODY_WIDTH) {
              if (forwardDist >= 0) {
                  this.speed = Math.min(this.speed, Math.max(other.speed * 0.85, this.MIN_SPEED));
              }
              let pushForce = lateralDist < 0.1 ? 0.3 : 0.15;
              if (this._state instanceof PassState && this.overtakeProgress < 0.5) {
                  pushForce *= 2.0;
              }
              const pushDir = right.x * dx + right.z * dz > 0 ? -1 : 1;
              this._emergencyPush = (this._emergencyPush || 0) + pushForce * pushDir;
          }
      }
  }

  calcLateralAvoidance() {
      if (!this.object || !this.otherCars) return 0;

      const AV = C.AVOIDANCE;
      const myPos = this.object.position;
      const rightVec = this._frameRight;

      let totalPush = 0;

      for (const other of this.otherCars) {
          if (!other.object) continue;
          let pathDist = Math.abs(this.position - other.position);
          if (pathDist > 0.5) pathDist = 1.0 - pathDist;
          if (pathDist > AV.PATH_DIST_MAX) continue;

          const dx = other.object.position.x - myPos.x;
          const dz = other.object.position.z - myPos.z;
          const distXZSq = dx * dx + dz * dz;
          if (distXZSq > AV.RADIUS * AV.RADIUS) continue;

          const lateralSigned = rightVec.x * dx + rightVec.z * dz;
          const lateralAbs = Math.abs(lateralSigned);
          if (lateralAbs < 0.01) continue;

          const pushMag = (1.0 - lateralAbs / AV.RADIUS) * AV.MAX_PUSH;
          totalPush += lateralSigned > 0 ? -pushMag : pushMag;
      }

      if (this._state instanceof PassState) {
          totalPush *= AV.OVERTAKE_DAMPING;
      }

      this._avoidanceOffset = this._avoidanceOffset * (1.0 - AV.SMOOTH_FACTOR) + totalPush * AV.SMOOTH_FACTOR;
      this._avoidanceOffset = Math.max(-AV.MAX_PUSH, Math.min(AV.MAX_PUSH, this._avoidanceOffset));

      return this._avoidanceOffset;
  }

  fadeOvertakeOffset() {
      const returnSpeed = Math.max(0.015, this.overtakeProgress * 0.08);
      this.overtakeProgress = Math.max(0, this.overtakeProgress - returnSpeed);
      if (this.overtakeProgress <= 0) {
          this.overtakeDirection = 0;
      }
  }

  dispose(scene) {
      if (this.object) {
          this.object.traverse(child => {
              if (child.geometry) child.geometry.dispose();
              if (child.material) {
                  if (Array.isArray(child.material)) {
                      child.material.forEach(m => { m.map?.dispose(); m.dispose(); });
                  } else {
                      child.material.map?.dispose();
                      child.material.dispose();
                  }
              }
          });
          scene.remove(this.object);
      }
      if (this.leftHeadlight) this.leftHeadlight.dispose();
      if (this.rightHeadlight) this.rightHeadlight.dispose();
      if (this._speedLineRenderer) this._speedLineRenderer.dispose(scene);
      if (this._driftSmokeRenderer) this._driftSmokeRenderer.dispose(scene);
      // 国旗スプライトの削除
      if (this._flagSprite) {
          if (this._flagSprite.material) {
              if (this._flagSprite.material.map) this._flagSprite.material.map.dispose();
              this._flagSprite.material.dispose();
          }
          this._flagSprite = null;
      }
      // デバッグラベル（P1等）の削除 — scene直下に追加されているため個別にremove
      if (this._debugLabel) {
          scene.remove(this._debugLabel);
          if (this._debugLabel.material) {
              if (this._debugLabel.material.map) this._debugLabel.material.map.dispose();
              this._debugLabel.material.dispose();
          }
          this._debugLabel = null;
          this._debugCanvas = null;
          this._debugTexture = null;
          this._lastDebugKey = null;
      }
      this._pool = null;
      this._speedLineRenderer = null;
      this._driftSmokeRenderer = null;
      this._frameFwd = null;
      this._frameRight = null;
      this._driftForward = null;
      this._driftSide = null;
      this._curvatureCache = null;
      this.otherCars = null;
      this._state = null;
  }
}
