// Car.js
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

export class Car {
  // 距離閾値定数
  static GAP = {
      OVERTAKE_COMPLETE: -0.01,   // 抜き切り判定
      OVERTAKE_LOST: 0.04,        // 離されすぎ判定
      TANDEM_BEHIND: -0.002,      // TANDEM追い越し判定
      TANDEM_FAR: 0.08,           // TANDEM離れすぎ
      AHEAD_BUSY: 0.02,           // 前方busy車のTANDEM判定距離
      APPROACH: 0.018,            // 接近判定距離
      FORCE_TANDEM: 0.01,         // 強制TANDEM距離
      SLOW_DOWN: 0.015,           // 減速開始距離
      BEHIND_CHECK: 0.015,        // 後方詰まり判定距離
      FIND_AHEAD_MIN: 0.002,      // findCarAhead最小距離
      FIND_AHEAD_MAX: 0.04,       // findCarAhead最大距離
      ENDTANDEM_CHECK: 0.02,      // endTandem前方チェック距離
      ENDTANDEM_PASS_START: 0.03, // endTandemでPASS開始する距離
  };

  // ターボブースト定数
  static TURBO = {
      DURATION: 90,               // 持続フレーム（約1.5秒）
      INITIAL_MULT: 1.12,         // 初期倍率
      DECAY: 0.05,                // 減衰量（1.12→1.07）
      MAX_SPEED_RATIO: 1.1,       // MAX_SPEEDに対する上限比
  };

  constructor(carPath) {
      this.carPath = carPath;
      this.position = 0;  // パス上の位置（0から1）
      this.speed = 0.2;   // 車の速度
      this.targetSpeed = 0.2; // 目標速度
      this.object = null; // 車の3Dオブジェクト
      this.wheels = [];    // タイヤオブジェクト
      this.wheelGroups = []; // タイヤグループ
      this.upVector = new THREE.Vector3(0, 1, 0);
      this.lastPosition = new THREE.Vector3();
      this.lastRotation = new THREE.Quaternion();
      this.lastTiltAngle = 0;
      this.lastDriftAngle = 0; // 前回のドリフト角度（スムーズな補間用）
      this.currentDriftStrength = 0; // 現在のドリフト強度（0〜1）
      this.lastDriftDirection = 0; // 前回のドリフト方向（スムーズな方向転換用）
      this.targetDriftDirection = 0; // 目標とするドリフト方向
      
      // 速度と表示用速度（km/h）の変換係数
      this.SPEED_TO_KMH = 450; // 内部速度を km/h に変換する係数
      
      // ヘッドライト関連
      this.leftHeadlight = null;  // 左ヘッドライト
      this.rightHeadlight = null; // 右ヘッドライト
      this.headlightIntensity = 5.5; // ヘッドライトの強さ
      
      // スペックを生成
      this.specs = this.generateRandomSpecs();
      
      // ラインどり特性を生成
      this.drivingStyle = this.generateDrivingStyle();
      
      // スペックに基づいて速度制限を設定
      this.MIN_SPEED = 0.15 * this.specs.acceleration;
      this.MAX_SPEED = 0.4 * this.specs.topSpeed;
      this.ACCELERATION_RATE = 0.01 * this.specs.acceleration;
      this.DECELERATION_RATE = 0.02 * this.specs.handling;
      
      // 追い抜き関連のパラメータ
      this.overtakeDistance = 40.0;        // 前方の車を検知する距離
      this.overtakeOffset = 5.0;           // 追い抜き時の横方向オフセット（車2台分）
      this.isOvertaking = false;           // 追い抜き中フラグ
      this.overtakeDirection = 0;          // 追い抜き方向（-1: 左, 1: 右）
      this.overtakeTargetCar = null;       // 追い抜き中の対象（距離判定用）
      this._approachJudged = false;         // 接近時の追走/追い抜き判定済みフラグ
      this._approachTarget = null;          // 判定対象の車
      this.overtakeProgress = 0;           // 追い越し進捗（0.0 〜 1.0）
      this.overtakePhaseSpeed = 0.015;     // 追い越し進捗の更新速度
      this.overtakeDuration = 0;           // 追い抜き継続フレーム数
      this.overtakeMaxDuration = 300;      // 追い抜き最大継続フレーム（約5秒）

      // 追走ドリフト関連のパラメータ
      this.tandemLeader = null;            // 追走リーダー（前の車）
      this.tandemFollower = null;          // 追走フォロワー（後ろの車）
      this.isTandemFollowing = false;      // 追走フォロワー中フラグ
      this.tandemDuration = 0;             // 追走継続フレーム数
      this.tandemMaxDuration = 0;          // 追走最大継続フレーム数
      this.tandemTargetGap = 0;             // リーダーとの目標パス距離（startTandemで設定）
      this.originalSpeed = 0;              // 追走前の元の速度
  }
  
  setOtherCars(otherCars) {
    this.otherCars = otherCars;
  }

  // ランダムなスペックを生成するメソッド
  generateRandomSpecs() {
      // 基本スペックの範囲を定義
      const specRanges = {
          topSpeed: { min: 0.8, max: 1.2 },      // 最高速度係数
          acceleration: { min: 0.7, max: 1.3 },   // 加速性能係数
          handling: { min: 0.8, max: 1.2 },       // ハンドリング性能係数
          grip: { min: 0.8, max: 1.2 }           // グリップ性能係数
      };

      // ランダムな値を生成する関数
      const randomInRange = (min, max) => min + Math.random() * (max - min);

      // スペックを生成
      const specs = {
          topSpeed: randomInRange(specRanges.topSpeed.min, specRanges.topSpeed.max),
          acceleration: randomInRange(specRanges.acceleration.min, specRanges.acceleration.max),
          handling: randomInRange(specRanges.handling.min, specRanges.handling.max),
          grip: randomInRange(specRanges.grip.min, specRanges.grip.max)
      };

      return specs;
  }
  
  // ラインどり特性を生成するメソッド
  generateDrivingStyle() {
      const style = {
          // インコース寄りかアウトコース寄りか（0: インコース、1: アウトコース）
          linePreference: Math.random(),
          
          // コーナー進入の積極性（0: 慎重、1: 積極的）
          cornerEntryAggression: Math.random(),
          
          // コーナー立ち上がりの積極性（0: 慎重、1: 積極的）
          cornerExitAggression: Math.random(),
          
          // ブレーキングの早さ（0: 早め、1: ギリギリ）
          brakingTiming: Math.random(),

          // 追加: ラインの切り替えタイミング（0: 早め、1: 遅め）
          lineTransitionTiming: Math.random(),

          // 追加: コーナー中のライン維持（0: 大きく振る、1: 一定を保つ）
          lineConsistency: Math.random(),

          // 追加: アウトインアウトの強さ（0: 控えめ、1: 大胆）
          outInOutStrength: Math.random(),

          // 全車ドリフト
          useDrift: true
      };

      return style;
  }
  
  createDetailedCar() {
      const car = new THREE.Group();

      // === 車種選択 ===
      const carTypeIndex = Math.floor(Math.random() * 3); // 0:ランボ 1:コルベット 2:スープラ
      const carTypeNames = ['ランボルギーニ', 'コルベット', 'スープラ'];

      const colorSets = [
          // ランボルギーニ
          [
              { name: 'ヴェルデマンティス', body: 0x44CC00 },
              { name: 'アランチョボレアリス', body: 0xFF6600 },
              { name: 'ジアッロオリオン', body: 0xFFDD00 },
              { name: 'ビアンコイカルス', body: 0xF0F0F0 },
              { name: 'ヴィオラパルセ', body: 0x8800CC },
          ],
          // コルベット
          [
              { name: 'トーチレッド', body: 0xCC0000 },
              { name: 'アクセラレートイエロー', body: 0xFFCC00 },
              { name: 'エルクハートレイクブルー', body: 0x0055AA },
              { name: 'アークティックホワイト', body: 0xFFFFFF },
              { name: 'セバリングオレンジ', body: 0xDD5500 },
          ],
          // スープラ
          [
              { name: 'プロミネンスレッド', body: 0xBB0000 },
              { name: 'ライトニングイエロー', body: 0xEEDD00 },
              { name: 'ディープブルーメタリック', body: 0x003366 },
              { name: 'ホワイトメタリック', body: 0xEEEEEE },
              { name: 'マットストームグレー', body: 0x555555 },
          ],
      ];

      const selectedColor = colorSets[carTypeIndex][Math.floor(Math.random() * colorSets[carTypeIndex].length)];
      log(`車種: ${carTypeNames[carTypeIndex]} / カラー: ${selectedColor.name}`);

      // === 共通マテリアル ===
      const bodyMat = new THREE.MeshPhongMaterial({ color: selectedColor.body, shininess: 120, specular: 0x444444 });
      const glassMat = new THREE.MeshPhongMaterial({ color: 0x88CCFF, transparent: true, opacity: 0.35, shininess: 200, specular: 0xFFFFFF });
      const carbonMat = new THREE.MeshPhongMaterial({ color: 0x222222, shininess: 40, specular: 0x333333 });
      const darkMat = new THREE.MeshPhongMaterial({ color: 0x111111, shininess: 30 });
      const chromeMat = new THREE.MeshPhongMaterial({ color: 0xCCCCCC, shininess: 250, specular: 0xFFFFFF });
      const hlMat = new THREE.MeshPhongMaterial({ color: 0xFFFFFF, emissive: 0xFFFFFF, emissiveIntensity: 0.8, shininess: 200, transparent: true, opacity: 0.9 });
      const tlMat = new THREE.MeshPhongMaterial({ color: 0xFF0000, emissive: 0xFF0000, emissiveIntensity: 0.5, shininess: 100 });
      const exhaustMat = new THREE.MeshPhongMaterial({ color: 0x888888, shininess: 200, specular: 0xFFFFFF });

      // 各車種で使う共通値
      let frontEnd, rearEnd, trackW;

      // ============================================================
      // ランボルギーニ風：極端に低い・幅広・ウェッジシェイプ
      // ============================================================
      if (carTypeIndex === 0) {
          trackW = 1.25;
          frontEnd = -3.2;
          rearEnd = 2.4;

          // フラットで幅広な底板
          const floorGeo = new THREE.BoxGeometry(2.7, 0.08, 5.8);
          const floor = new THREE.Mesh(floorGeo, darkMat);
          floor.position.set(0, 0.3, -0.4);
          car.add(floor);

          // メインボディ：極端に薄くワイド（ウェッジ）
          // フロント側が低く、リア側がやや高い
          const bodyShape = new THREE.Shape();
          bodyShape.moveTo(-1.35, 0);
          bodyShape.lineTo(1.35, 0);
          bodyShape.lineTo(1.3, 0.22);
          bodyShape.lineTo(-1.3, 0.22);
          bodyShape.closePath();
          const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: 5.6, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.05, bevelSegments: 3 });
          const body = new THREE.Mesh(bodyGeo, bodyMat);
          body.position.set(0, 0.34, -3.1);
          car.add(body);

          // フロントウェッジ（先端がナイフのように鋭い）
          const wedgeShape = new THREE.Shape();
          wedgeShape.moveTo(-1.3, 0);
          wedgeShape.lineTo(1.3, 0);
          wedgeShape.lineTo(0.8, 0.05);
          wedgeShape.lineTo(-0.8, 0.05);
          wedgeShape.closePath();
          const wedgeGeo = new THREE.ExtrudeGeometry(wedgeShape, { depth: 0.8, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02, bevelSegments: 2 });
          const wedge = new THREE.Mesh(wedgeGeo, bodyMat);
          wedge.position.set(0, 0.34, -3.5);
          car.add(wedge);

          // リアのエンジンカバー（大きく膨らむ）
          const engineShape = new THREE.Shape();
          engineShape.moveTo(-1.1, 0);
          engineShape.lineTo(1.1, 0);
          engineShape.quadraticCurveTo(1.1, 0.35, 0.6, 0.38);
          engineShape.lineTo(-0.6, 0.38);
          engineShape.quadraticCurveTo(-1.1, 0.35, -1.1, 0);
          engineShape.closePath();
          const engineGeo = new THREE.ExtrudeGeometry(engineShape, { depth: 2.2, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.04, bevelSegments: 3 });
          const engine = new THREE.Mesh(engineGeo, bodyMat);
          engine.position.set(0, 0.55, 0.2);
          car.add(engine);

          // キャビン：極端に低くフラット
          const cabShape = new THREE.Shape();
          cabShape.moveTo(-0.75, 0);
          cabShape.lineTo(0.75, 0);
          cabShape.lineTo(0.7, 0.32);
          cabShape.lineTo(0.4, 0.35);
          cabShape.lineTo(-0.4, 0.35);
          cabShape.lineTo(-0.7, 0.32);
          cabShape.closePath();
          const cabGeo = new THREE.ExtrudeGeometry(cabShape, { depth: 1.4, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.04, bevelSegments: 3 });
          const cab = new THREE.Mesh(cabGeo, bodyMat);
          cab.position.set(0, 0.55, -1.5);
          car.add(cab);

          // フロントガラス（非常に寝ている）
          const wsGeo = new THREE.BoxGeometry(1.5, 0.04, 1.0);
          const ws = new THREE.Mesh(wsGeo, glassMat);
          ws.position.set(0, 0.82, -1.7);
          ws.rotation.x = 0.9;
          car.add(ws);

          // サイドウィンドウ
          [-1, 1].forEach(side => {
              const swGeo = new THREE.BoxGeometry(0.04, 0.28, 1.2);
              const sw = new THREE.Mesh(swGeo, glassMat);
              sw.position.set(side * 0.78, 0.78, -0.9);
              car.add(sw);
          });

          // 巨大フロントスプリッター
          const splGeo = new THREE.BoxGeometry(2.8, 0.04, 0.6);
          const spl = new THREE.Mesh(splGeo, carbonMat);
          spl.position.set(0, 0.28, -3.5);
          car.add(spl);

          // サイドインテーク（巨大な六角形風）
          [-1, 1].forEach(side => {
              const intGeo = new THREE.BoxGeometry(0.08, 0.35, 1.5);
              const int1 = new THREE.Mesh(intGeo, darkMat);
              int1.position.set(side * 1.35, 0.52, 0.3);
              car.add(int1);
          });

          // ワイドフェンダー（張り出し大）
          [-1, 1].forEach(side => {
              // フロント
              const ffGeo = new THREE.BoxGeometry(0.2, 0.25, 1.4);
              const ff = new THREE.Mesh(ffGeo, bodyMat);
              ff.position.set(side * 1.35, 0.48, -2.0);
              car.add(ff);
              // リア（もっと大きい）
              const rfGeo = new THREE.BoxGeometry(0.25, 0.3, 1.6);
              const rf = new THREE.Mesh(rfGeo, bodyMat);
              rf.position.set(side * 1.38, 0.5, 1.2);
              car.add(rf);
          });

          // 大型リアウイング
          const wingGeo = new THREE.BoxGeometry(2.2, 0.06, 0.45);
          const wing = new THREE.Mesh(wingGeo, carbonMat);
          wing.position.set(0, 1.1, 2.1);
          wing.rotation.x = -0.1;
          car.add(wing);
          [-1, 1].forEach(side => {
              const epGeo = new THREE.BoxGeometry(0.06, 0.35, 0.55);
              const ep = new THREE.Mesh(epGeo, carbonMat);
              ep.position.set(side * 1.1, 1.0, 2.1);
              car.add(ep);
              const pilGeo = new THREE.BoxGeometry(0.06, 0.45, 0.08);
              const pil = new THREE.Mesh(pilGeo, carbonMat);
              pil.position.set(side * 0.6, 0.85, 2.0);
              car.add(pil);
          });

          // カナード
          [-1, 1].forEach(side => {
              const canGeo = new THREE.BoxGeometry(0.5, 0.04, 0.25);
              const can = new THREE.Mesh(canGeo, carbonMat);
              can.position.set(side * 1.1, 0.38, -3.0);
              can.rotation.z = side * -0.12;
              car.add(can);
          });

          // 4本エキゾースト（中央集中型）
          for (let i = 0; i < 4; i++) {
              const exGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.25, 10);
              const ex = new THREE.Mesh(exGeo, exhaustMat);
              ex.position.set((i - 1.5) * 0.22, 0.38, rearEnd + 0.15);
              ex.rotation.x = Math.PI / 2;
              car.add(ex);
          }

          // ヘッドライト（シャープでスリム）
          [-1, 1].forEach(side => {
              const hlGeo = new THREE.BoxGeometry(0.6, 0.08, 0.15);
              const hl = new THREE.Mesh(hlGeo, hlMat);
              hl.position.set(side * 0.65, 0.45, -3.4);
              car.add(hl);
          });

          // テールライト（横一文字）
          const tailGeo = new THREE.BoxGeometry(2.0, 0.06, 0.06);
          const tail = new THREE.Mesh(tailGeo, tlMat);
          tail.position.set(0, 0.65, rearEnd + 0.1);
          car.add(tail);

          // ディフューザー
          const diffGeo = new THREE.BoxGeometry(2.2, 0.1, 0.6);
          const diff = new THREE.Mesh(diffGeo, carbonMat);
          diff.position.set(0, 0.26, rearEnd - 0.1);
          car.add(diff);
          for (let i = -3; i <= 3; i++) {
              const finGeo = new THREE.BoxGeometry(0.03, 0.1, 0.55);
              const fin = new THREE.Mesh(finGeo, carbonMat);
              fin.position.set(i * 0.22, 0.28, rearEnd - 0.1);
              car.add(fin);
          }
      }

      // ============================================================
      // コルベット風：ロングノーズ＆ショートデッキ、筋肉質
      // ============================================================
      else if (carTypeIndex === 1) {
          trackW = 1.15;
          frontEnd = -3.0;
          rearEnd = 2.6;

          // フロア
          const floorGeo = new THREE.BoxGeometry(2.4, 0.08, 5.8);
          const floor = new THREE.Mesh(floorGeo, darkMat);
          floor.position.set(0, 0.32, -0.2);
          car.add(floor);

          // メインボディ：均一な高さ、やや角張った筋肉質
          const bodyShape = new THREE.Shape();
          bodyShape.moveTo(-1.2, 0);
          bodyShape.lineTo(1.2, 0);
          bodyShape.lineTo(1.15, 0.4);
          bodyShape.lineTo(-1.15, 0.4);
          bodyShape.closePath();
          const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: 5.6, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.06, bevelSegments: 3 });
          const body = new THREE.Mesh(bodyGeo, bodyMat);
          body.position.set(0, 0.35, -3.0);
          car.add(body);

          // ロングノーズ（長く低くせり出す）
          const noseShape = new THREE.Shape();
          noseShape.moveTo(-1.0, 0);
          noseShape.lineTo(1.0, 0);
          noseShape.lineTo(0.85, 0.15);
          noseShape.lineTo(-0.85, 0.15);
          noseShape.closePath();
          const noseGeo = new THREE.ExtrudeGeometry(noseShape, { depth: 1.8, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.04, bevelSegments: 2 });
          const nose = new THREE.Mesh(noseGeo, bodyMat);
          nose.position.set(0, 0.4, -3.5);
          nose.rotation.x = -0.04;
          car.add(nose);

          // ボンネットの隆起（パワーバルジ）
          const bulgeShape = new THREE.Shape();
          bulgeShape.moveTo(-0.4, 0);
          bulgeShape.lineTo(0.4, 0);
          bulgeShape.quadraticCurveTo(0.4, 0.12, 0, 0.14);
          bulgeShape.quadraticCurveTo(-0.4, 0.12, -0.4, 0);
          bulgeShape.closePath();
          const bulgeGeo = new THREE.ExtrudeGeometry(bulgeShape, { depth: 2.5, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 2 });
          const bulge = new THREE.Mesh(bulgeGeo, bodyMat);
          bulge.position.set(0, 0.72, -2.8);
          car.add(bulge);

          // キャビン：やや高めで前寄り
          const cabShape = new THREE.Shape();
          cabShape.moveTo(-0.8, 0);
          cabShape.lineTo(0.8, 0);
          cabShape.quadraticCurveTo(0.8, 0.5, 0.5, 0.58);
          cabShape.lineTo(-0.5, 0.58);
          cabShape.quadraticCurveTo(-0.8, 0.5, -0.8, 0);
          cabShape.closePath();
          const cabGeo = new THREE.ExtrudeGeometry(cabShape, { depth: 1.6, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.05, bevelSegments: 4 });
          const cab = new THREE.Mesh(cabGeo, bodyMat);
          cab.position.set(0, 0.72, -1.2);
          car.add(cab);

          // リアデッキ（ショート＆ワイド）
          const rearShape = new THREE.Shape();
          rearShape.moveTo(-1.15, 0);
          rearShape.lineTo(1.15, 0);
          rearShape.lineTo(1.1, 0.28);
          rearShape.lineTo(-1.1, 0.28);
          rearShape.closePath();
          const rearGeo = new THREE.ExtrudeGeometry(rearShape, { depth: 1.8, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.04, bevelSegments: 2 });
          const rear = new THREE.Mesh(rearGeo, bodyMat);
          rear.position.set(0, 0.72, 0.4);
          rear.rotation.x = 0.03;
          car.add(rear);

          // フロントガラス（やや起きている）
          const wsGeo = new THREE.BoxGeometry(1.6, 0.04, 1.1);
          const ws = new THREE.Mesh(wsGeo, glassMat);
          ws.position.set(0, 1.05, -1.35);
          ws.rotation.x = 0.7;
          car.add(ws);

          // リアウィンドウ（ファストバック的に傾斜）
          const rwGeo = new THREE.BoxGeometry(1.4, 0.04, 1.2);
          const rw = new THREE.Mesh(rwGeo, glassMat);
          rw.position.set(0, 1.05, 0.5);
          rw.rotation.x = -0.5;
          car.add(rw);

          // サイドウィンドウ
          [-1, 1].forEach(side => {
              const swGeo = new THREE.BoxGeometry(0.04, 0.4, 1.4);
              const sw = new THREE.Mesh(swGeo, glassMat);
              sw.position.set(side * 0.83, 0.95, -0.4);
              car.add(sw);
          });

          // マッシブなフェンダー
          [-1, 1].forEach(side => {
              // フロント
              const ffGeo = new THREE.BoxGeometry(0.18, 0.35, 1.5);
              const ff = new THREE.Mesh(ffGeo, bodyMat);
              ff.position.set(side * 1.2, 0.52, -2.2);
              car.add(ff);
              // リア（もっとマッシブ）
              const rfGeo = new THREE.BoxGeometry(0.22, 0.4, 1.5);
              const rf = new THREE.Mesh(rfGeo, bodyMat);
              rf.position.set(side * 1.22, 0.55, 1.3);
              car.add(rf);
          });

          // サイドスカート
          [-1, 1].forEach(side => {
              const skGeo = new THREE.BoxGeometry(0.08, 0.15, 3.5);
              const sk = new THREE.Mesh(skGeo, darkMat);
              sk.position.set(side * 1.2, 0.35, -0.3);
              car.add(sk);
          });

          // フロントスプリッター（控えめ）
          const splGeo = new THREE.BoxGeometry(2.2, 0.04, 0.35);
          const spl = new THREE.Mesh(splGeo, darkMat);
          spl.position.set(0, 0.3, frontEnd - 0.3);
          car.add(spl);

          // リップスポイラー（控えめ）
          const lipGeo = new THREE.BoxGeometry(1.8, 0.05, 0.2);
          const lip = new THREE.Mesh(lipGeo, carbonMat);
          lip.position.set(0, 0.98, 2.2);
          lip.rotation.x = -0.08;
          car.add(lip);

          // 4本エキゾースト（左右2本ずつ）
          [-1, 1].forEach(side => {
              for (let j = 0; j < 2; j++) {
                  const exGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.3, 10);
                  const ex = new THREE.Mesh(exGeo, exhaustMat);
                  ex.position.set(side * (0.35 + j * 0.2), 0.38, rearEnd + 0.15);
                  ex.rotation.x = Math.PI / 2;
                  car.add(ex);
              }
          });

          // サイドエアインテーク
          [-1, 1].forEach(side => {
              const intGeo = new THREE.BoxGeometry(0.06, 0.2, 0.8);
              const int1 = new THREE.Mesh(intGeo, darkMat);
              int1.position.set(side * 1.22, 0.6, 0.5);
              car.add(int1);
          });

          // ヘッドライト（丸みのある大きめ）
          [-1, 1].forEach(side => {
              const hlGeo = new THREE.BoxGeometry(0.5, 0.15, 0.2);
              const hl = new THREE.Mesh(hlGeo, hlMat);
              hl.position.set(side * 0.6, 0.55, frontEnd - 0.2);
              car.add(hl);
          });

          // テールライト（左右独立した丸型風）
          [-1, 1].forEach(side => {
              const tailGeo = new THREE.BoxGeometry(0.35, 0.15, 0.06);
              const tail = new THREE.Mesh(tailGeo, tlMat);
              tail.position.set(side * 0.65, 0.78, rearEnd + 0.1);
              car.add(tail);
              // 内側もう一つ
              const tail2 = new THREE.Mesh(tailGeo, tlMat);
              tail2.position.set(side * 0.3, 0.78, rearEnd + 0.1);
              car.add(tail2);
          });

          // ディフューザー
          const diffGeo = new THREE.BoxGeometry(2.0, 0.08, 0.5);
          const diff = new THREE.Mesh(diffGeo, carbonMat);
          diff.position.set(0, 0.28, rearEnd - 0.1);
          car.add(diff);
      }

      // ============================================================
      // スープラ風：丸みのあるグラマラスボディ、FRプロポーション
      // ============================================================
      else {
          trackW = 1.1;
          frontEnd = -2.8;
          rearEnd = 2.3;

          // フロア
          const floorGeo = new THREE.BoxGeometry(2.3, 0.08, 5.3);
          const floor = new THREE.Mesh(floorGeo, darkMat);
          floor.position.set(0, 0.32, -0.25);
          car.add(floor);

          // メインボディ：丸みのある断面
          const bodyShape = new THREE.Shape();
          bodyShape.moveTo(-1.15, 0);
          bodyShape.lineTo(1.15, 0);
          bodyShape.quadraticCurveTo(1.2, 0.2, 1.1, 0.4);
          bodyShape.lineTo(-1.1, 0.4);
          bodyShape.quadraticCurveTo(-1.2, 0.2, -1.15, 0);
          bodyShape.closePath();
          const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: 5.1, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.08, bevelSegments: 4 });
          const body = new THREE.Mesh(bodyGeo, bodyMat);
          body.position.set(0, 0.35, -2.8);
          car.add(body);

          // フロントノーズ（丸みのあるバブル形状）
          const noseShape = new THREE.Shape();
          noseShape.moveTo(-0.95, 0);
          noseShape.lineTo(0.95, 0);
          noseShape.quadraticCurveTo(0.95, 0.15, 0.7, 0.18);
          noseShape.lineTo(-0.7, 0.18);
          noseShape.quadraticCurveTo(-0.95, 0.15, -0.95, 0);
          noseShape.closePath();
          const noseGeo = new THREE.ExtrudeGeometry(noseShape, { depth: 1.0, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.05, bevelSegments: 3 });
          const nose = new THREE.Mesh(noseGeo, bodyMat);
          nose.position.set(0, 0.42, -3.2);
          nose.rotation.x = -0.05;
          car.add(nose);

          // キャビン：ダブルバブルルーフ（グラマラスな丸み）
          const cabShape = new THREE.Shape();
          cabShape.moveTo(-0.8, 0);
          cabShape.lineTo(0.8, 0);
          cabShape.quadraticCurveTo(0.85, 0.55, 0.45, 0.65);
          cabShape.quadraticCurveTo(0, 0.72, 0, 0.72);
          cabShape.quadraticCurveTo(0, 0.72, -0.45, 0.65);
          cabShape.quadraticCurveTo(-0.85, 0.55, -0.8, 0);
          cabShape.closePath();
          const cabGeo = new THREE.ExtrudeGeometry(cabShape, { depth: 1.5, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.06, bevelSegments: 5 });
          const cab = new THREE.Mesh(cabGeo, bodyMat);
          cab.position.set(0, 0.72, -1.2);
          car.add(cab);

          // リアセクション（グラマラスなヒップライン）
          const rearShape = new THREE.Shape();
          rearShape.moveTo(-1.12, 0);
          rearShape.lineTo(1.12, 0);
          rearShape.quadraticCurveTo(1.15, 0.2, 1.0, 0.3);
          rearShape.lineTo(-1.0, 0.3);
          rearShape.quadraticCurveTo(-1.15, 0.2, -1.12, 0);
          rearShape.closePath();
          const rearGeo = new THREE.ExtrudeGeometry(rearShape, { depth: 1.6, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.05, bevelSegments: 3 });
          const rear = new THREE.Mesh(rearGeo, bodyMat);
          rear.position.set(0, 0.7, 0.5);
          rear.rotation.x = 0.04;
          car.add(rear);

          // フロントガラス（きれいな曲面風）
          const wsGeo = new THREE.BoxGeometry(1.6, 0.04, 1.1);
          const ws = new THREE.Mesh(wsGeo, glassMat);
          ws.position.set(0, 1.1, -1.4);
          ws.rotation.x = 0.75;
          car.add(ws);

          // リアウィンドウ
          const rwGeo = new THREE.BoxGeometry(1.3, 0.04, 0.9);
          const rw = new THREE.Mesh(rwGeo, glassMat);
          rw.position.set(0, 1.1, 0.5);
          rw.rotation.x = -0.45;
          car.add(rw);

          // サイドウィンドウ
          [-1, 1].forEach(side => {
              const swGeo = new THREE.BoxGeometry(0.04, 0.4, 1.3);
              const sw = new THREE.Mesh(swGeo, glassMat);
              sw.position.set(side * 0.83, 0.98, -0.4);
              car.add(sw);
          });

          // グラマラスフェンダー（丸く膨らむ）
          [-1, 1].forEach(side => {
              // フロント
              const ffShape = new THREE.Shape();
              ffShape.moveTo(0, 0);
              ffShape.lineTo(0.18, 0);
              ffShape.quadraticCurveTo(0.2, 0.2, 0.12, 0.3);
              ffShape.lineTo(0.03, 0.3);
              ffShape.quadraticCurveTo(0, 0.2, 0, 0);
              ffShape.closePath();
              const ffGeo = new THREE.ExtrudeGeometry(ffShape, { depth: 1.3, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 3 });
              const ff = new THREE.Mesh(ffGeo, bodyMat);
              ff.position.set(side * 1.08, 0.4, -2.3);
              ff.scale.x = side;
              car.add(ff);

              // リア（大きめに膨らむ）
              const rfShape = new THREE.Shape();
              rfShape.moveTo(0, 0);
              rfShape.lineTo(0.22, 0);
              rfShape.quadraticCurveTo(0.25, 0.25, 0.15, 0.38);
              rfShape.lineTo(0.04, 0.38);
              rfShape.quadraticCurveTo(0, 0.25, 0, 0);
              rfShape.closePath();
              const rfGeo = new THREE.ExtrudeGeometry(rfShape, { depth: 1.5, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 3 });
              const rf = new THREE.Mesh(rfGeo, bodyMat);
              rf.position.set(side * 1.05, 0.4, 0.8);
              rf.scale.x = side;
              car.add(rf);
          });

          // サイドスカート
          [-1, 1].forEach(side => {
              const skGeo = new THREE.BoxGeometry(0.06, 0.12, 3.0);
              const sk = new THREE.Mesh(skGeo, darkMat);
              sk.position.set(side * 1.15, 0.35, -0.4);
              car.add(sk);
          });

          // FRPフロントリップ
          const lipGeo = new THREE.BoxGeometry(2.1, 0.04, 0.3);
          const lip = new THREE.Mesh(lipGeo, darkMat);
          lip.position.set(0, 0.3, frontEnd - 0.3);
          car.add(lip);

          // 大型グリル（スープラ特有の大開口）
          const grillGeo = new THREE.BoxGeometry(1.4, 0.25, 0.06);
          const grill = new THREE.Mesh(grillGeo, darkMat);
          grill.position.set(0, 0.48, frontEnd - 0.25);
          car.add(grill);

          // GTウイング（高い位置）
          const wingGeo = new THREE.BoxGeometry(1.8, 0.05, 0.35);
          const wing = new THREE.Mesh(wingGeo, carbonMat);
          wing.position.set(0, 1.25, 1.9);
          wing.rotation.x = -0.12;
          car.add(wing);
          // サポートピラー
          [-1, 1].forEach(side => {
              const pilGeo = new THREE.BoxGeometry(0.08, 0.5, 0.1);
              const pil = new THREE.Mesh(pilGeo, chromeMat);
              pil.position.set(side * 0.6, 1.0, 1.85);
              car.add(pil);
          });
          // ガーニーフラップ
          const gurneyGeo = new THREE.BoxGeometry(1.8, 0.1, 0.03);
          const gurney = new THREE.Mesh(gurneyGeo, carbonMat);
          gurney.position.set(0, 1.28, 2.1);
          car.add(gurney);

          // 2本エキゾースト（太め）
          [-1, 1].forEach(side => {
              const exGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.3, 10);
              const ex = new THREE.Mesh(exGeo, exhaustMat);
              ex.position.set(side * 0.45, 0.38, rearEnd + 0.15);
              ex.rotation.x = Math.PI / 2;
              car.add(ex);
          });

          // サイドエアインテーク（ドア後方）
          [-1, 1].forEach(side => {
              const intGeo = new THREE.BoxGeometry(0.05, 0.2, 0.6);
              const int1 = new THREE.Mesh(intGeo, darkMat);
              int1.position.set(side * 1.15, 0.6, 0.3);
              car.add(int1);
          });

          // ヘッドライト（スリムで丸み）
          [-1, 1].forEach(side => {
              const hlGeo = new THREE.BoxGeometry(0.45, 0.12, 0.2);
              const hl = new THREE.Mesh(hlGeo, hlMat);
              hl.position.set(side * 0.55, 0.55, frontEnd - 0.15);
              car.add(hl);
              // DRL
              const drlGeo = new THREE.BoxGeometry(0.35, 0.03, 0.04);
              const drlMat2 = new THREE.MeshPhongMaterial({ color: 0xCCEEFF, emissive: 0xCCEEFF, emissiveIntensity: 0.6 });
              const drl = new THREE.Mesh(drlGeo, drlMat2);
              drl.position.set(side * 0.55, 0.49, frontEnd - 0.2);
              car.add(drl);
          });

          // テールライト（横長バー型）
          const tailGeo = new THREE.BoxGeometry(1.8, 0.08, 0.06);
          const tail = new THREE.Mesh(tailGeo, tlMat);
          tail.position.set(0, 0.78, rearEnd + 0.1);
          car.add(tail);

          // ディフューザー
          const diffGeo = new THREE.BoxGeometry(1.8, 0.08, 0.45);
          const diff = new THREE.Mesh(diffGeo, carbonMat);
          diff.position.set(0, 0.28, rearEnd - 0.1);
          car.add(diff);
          for (let i = -2; i <= 2; i++) {
              const finGeo = new THREE.BoxGeometry(0.03, 0.08, 0.4);
              const fin = new THREE.Mesh(finGeo, carbonMat);
              fin.position.set(i * 0.25, 0.3, rearEnd - 0.1);
              car.add(fin);
          }
      }

      // === 共通：サイドミラー ===
      [-1, 1].forEach(side => {
          const mirGeo = new THREE.BoxGeometry(0.12, 0.08, 0.16);
          const mir = new THREE.Mesh(mirGeo, bodyMat);
          mir.position.set(side * 1.05, 0.9, -0.8);
          car.add(mir);
          const stayGeo = new THREE.BoxGeometry(0.12, 0.03, 0.03);
          const stay = new THREE.Mesh(stayGeo, darkMat);
          stay.position.set(side * 0.98, 0.88, -0.8);
          car.add(stay);
      });

      // === 共通：スポットライト ===
      const leftLight = new THREE.SpotLight(0xFFFFFF, 5.5, 50, Math.PI / 10, 0.3, 1);
      leftLight.position.set(0.6, 6.0, -2.0);
      leftLight.target.position.set(0.3, 0.0, -20);
      leftLight.visible = true;
      car.add(leftLight);
      car.add(leftLight.target);

      const rightLight = new THREE.SpotLight(0xFFFFFF, 5.5, 50, Math.PI / 10, 0.3, 1);
      rightLight.position.set(-0.6, 6.0, -2.0);
      rightLight.target.position.set(-0.3, 0.0, -20);
      rightLight.visible = true;
      car.add(rightLight);
      car.add(rightLight.target);

      // === 共通：タイヤ ===
      function createWheel(x, z) {
          const wheelGroup = new THREE.Group();
          const tireGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.32, 22);
          const tireMat = new THREE.MeshPhongMaterial({ color: 0x1A1A1A, shininess: 8 });
          const tire = new THREE.Mesh(tireGeo, tireMat);
          tire.rotation.z = Math.PI / 2;
          wheelGroup.add(tire);
          const rimGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.33, 22);
          const rimMat = new THREE.MeshPhongMaterial({ color: 0xDDDDDD, shininess: 220, specular: 0xFFFFFF });
          const rim = new THREE.Mesh(rimGeo, rimMat);
          rim.rotation.z = Math.PI / 2;
          wheelGroup.add(rim);
          const capGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.34, 6);
          const capMat2 = new THREE.MeshPhongMaterial({ color: 0x444444, shininess: 150 });
          const cap = new THREE.Mesh(capGeo, capMat2);
          cap.rotation.z = Math.PI / 2;
          wheelGroup.add(cap);
          for (let i = 0; i < 5; i++) {
              const spokeGeo = new THREE.BoxGeometry(0.035, 0.018, 0.26);
              const spokeMat = new THREE.MeshPhongMaterial({ color: 0xCCCCCC, shininess: 200 });
              const angle = (Math.PI * 2 / 5) * i;
              [-0.02, 0.02].forEach(off => {
                  const spoke = new THREE.Mesh(spokeGeo, spokeMat);
                  spoke.rotation.z = Math.PI / 2;
                  spoke.rotation.x = angle + off;
                  wheelGroup.add(spoke);
              });
          }
          const calGeo = new THREE.BoxGeometry(0.1, 0.05, 0.14);
          const calMat = new THREE.MeshPhongMaterial({ color: 0xCC0000, shininess: 80 });
          const cal = new THREE.Mesh(calGeo, calMat);
          cal.position.set(0, -0.13, 0);
          wheelGroup.add(cal);
          wheelGroup.position.set(x, 0.38, z);
          car.add(wheelGroup);
          return { wheel: tire, wheelGroup };
      }

      const wbFront = carTypeIndex === 0 ? -2.0 : carTypeIndex === 1 ? -2.2 : -1.8;
      const wbRear = carTypeIndex === 0 ? 1.7 : carTypeIndex === 1 ? 1.8 : 1.5;
      const frontLeftWheel = createWheel(-trackW, wbFront);
      const frontRightWheel = createWheel(trackW, wbFront);
      const rearLeftWheel = createWheel(-trackW, wbRear);
      const rearRightWheel = createWheel(trackW, wbRear);
      
      const wheels = [
          frontLeftWheel.wheel,
          frontRightWheel.wheel,
          rearLeftWheel.wheel,
          rearRightWheel.wheel
      ];
      
      const wheelGroups = [
          frontLeftWheel.wheelGroup,
          frontRightWheel.wheelGroup,
          rearLeftWheel.wheelGroup,
          rearRightWheel.wheelGroup
      ];
      
      // 車の向きベクトル（常に上方向）
      const upVector = new THREE.Vector3(0, 1, 0);
      
      // 車の初期位置（スタート地点）
      car.position.copy(this.carPath.getPointAt(0));
      car.position.y = 1.0; // 地面からの高さ
      
      // 車の初期方向
      const initialTangent = this.carPath.getTangentAt(0);
      const initialDirection = new THREE.Vector3(initialTangent.x, 0, initialTangent.z).normalize();
      
      // 車の向きを設定（Y軸は常に上）
      const initialTarget = new THREE.Vector3().addVectors(car.position, initialDirection);
      car.lookAt(initialTarget);
      
      return { car, wheels, wheelGroups, upVector, leftHeadlight: leftLight, rightHeadlight: rightLight };
  }
  
  createObject(scene) {
      const result = this.createDetailedCar();
      this.object = result.car;
      this.wheels = result.wheels;
      this.wheelGroups = result.wheelGroups;
      this.upVector = result.upVector;
      this.leftHeadlight = result.leftHeadlight;
      this.rightHeadlight = result.rightHeadlight;
      
      // 初期位置と向き
      this.object.position.copy(this.carPath.getPointAt(this.position));
      this.object.position.y = 1.0; // 地面からの高さ
      
      const initialTangent = this.carPath.getTangentAt(this.position);
      const initialDirection = new THREE.Vector3(initialTangent.x, 0, initialTangent.z).normalize();
      const initialTarget = new THREE.Vector3().addVectors(this.object.position, initialDirection);
      this.object.lookAt(initialTarget);
      
      // 初期状態を保存
      this.lastPosition.copy(this.object.position);
      this.lastRotation.copy(this.object.quaternion);
      
      scene.add(this.object);
  }
  
  update(deltaTime, isNight = false) {
      // ヘッドライトは処理が重いので一旦オフ
      isNight = false;
      // ヘッドライトの更新
      this.updateHeadlights(isNight);

      // 速度を更新（カーブに応じて）→ その後に追い抜き処理（ブースト上乗せ）
      this.updateSpeed();

      // 追い抜き処理を実行（updateSpeedの後にブースト上乗せ）
      this.handleOvertaking(this.otherCars);

      const speedKmh = this.speed * this.SPEED_TO_KMH;
      const speedScalingFactor = this._calcDriftScalingFactor(speedKmh);
      
      // 位置を更新
      this.position += this.speed * 0.001;
      if (this.position >= 1) this.position -= 1;
      
      // 道路上の位置を厳密に取得
      const point = this.carPath.getPointAt(this.position);
      
      // パスの接線ベクトルを取得（進行方向）
      const tangent = this.carPath.getTangentAt(this.position).normalize();
      // XZ平面上の接線ベクトル（高さを無視）
      const flatTangent = new THREE.Vector3(tangent.x, 0, tangent.z).normalize();
      
      // 曲率を計算
      const curvatureData = this.calculateCurvature(this.position);
      const curveAngle = curvatureData.angle;

      // 曲がり方向は現在位置の直近3点から直接計算（先読みしない）
      const dirSampleDist = 0.002;
      const dirP0 = this.carPath.getPointAt((this.position - dirSampleDist + 1) % 1);
      const dirP1 = this.carPath.getPointAt(this.position);
      const dirP2 = this.carPath.getPointAt((this.position + dirSampleDist) % 1);
      const dirV1x = dirP1.x - dirP0.x, dirV1z = dirP1.z - dirP0.z;
      const dirV2x = dirP2.x - dirP1.x, dirV2z = dirP2.z - dirP1.z;
      const curveTiltDirection = Math.sign(dirV1x * dirV2z - dirV1z * dirV2x) || 0;
      
      // ラインどりの計算
      const baseLineOffset = 0.5; // 基本のオフセット距離（メートル）
      const linePreference = this.drivingStyle.linePreference; // 0: インコース、1: アウトコース
      
      // 次のカーブの方向を予測
      const nextCurveData = this.calculateCurvature((this.position + 0.05) % 1);
      const nextCurveDirection = nextCurveData.direction;
      
      // カーブの強さに応じたオフセット量の調整
      const outInOutStrength = this.drivingStyle.outInOutStrength;
      const lineOffset = baseLineOffset * (0.8 + outInOutStrength * 0.4);
      
      // カーブに応じたラインオフセットを計算
      const lineDirection = new THREE.Vector3().crossVectors(flatTangent, new THREE.Vector3(0, 1, 0)).normalize();
      
      // ラインの一貫性を考慮したオフセット量の計算
      const consistencyFactor = 0.5 + this.drivingStyle.lineConsistency * 0.5;
      const rawOffsetAmount = lineOffset * (linePreference * 2 - 1) * Math.min(1, curveAngle * 10);
      const smoothedOffsetAmount = rawOffsetAmount * consistencyFactor;
      
      // カーブ進入時と出口でラインを調整
      const transitionTiming = 0.05 + this.drivingStyle.lineTransitionTiming * 0.05;
      const approachingCurve = this.predictUpcomingCurve(this.position, transitionTiming) > 0.1;
      const exitingCurve = curveAngle < 0.1 && this.calculateCurvature((this.position - transitionTiming + 1) % 1).angle > 0.1;
      
      let finalLineOffset = smoothedOffsetAmount;
      
      if (approachingCurve) {
          // カーブ進入時のライン取り
          const transitionFactor = Math.min(1, curveAngle * (15 + this.drivingStyle.cornerEntryAggression * 10));
          const entryOffset = lineOffset * nextCurveDirection * outInOutStrength;
          finalLineOffset = entryOffset * (1 - transitionFactor) + smoothedOffsetAmount * transitionFactor;
      } else if (exitingCurve) {
          // カーブ出口でのライン取り
          const exitFactor = Math.min(1, curveAngle * (10 + this.drivingStyle.cornerExitAggression * 10));
          const exitOffset = -lineOffset * curveTiltDirection * outInOutStrength;
          finalLineOffset = smoothedOffsetAmount * (1 - exitFactor) + exitOffset * exitFactor;
      }
      
      // 通常のライン取りを適用
      point.add(lineDirection.multiplyScalar(finalLineOffset));
      
      // 追い抜き用の追加オフセットを計算
      if (this.isOvertaking || this.overtakeProgress > 0) {
          const overtakeVector = new THREE.Vector3(-flatTangent.z, 0, flatTangent.x).normalize();
          point.add(overtakeVector.multiplyScalar(this.overtakeOffset * this.overtakeDirection * this.overtakeProgress));
      }
      
      // 車の高さは道路の高さに合わせる
      const carHeight = point.y + 0.3;
      
      // スピードファクターを計算
      const speedFactor = Math.min(1.0, this.speed / 0.7);
      
      // ---------- 車の回転方向の計算 ----------
      
      // 1. 進行方向ベクトル（常にXZ平面に平行）
      const forwardVector = flatTangent;
      
      // 2. 上向きベクトル（常に世界座標のY軸方向）
      const upVector = new THREE.Vector3(0, 1, 0);
      
      // 3. 右向きベクトル（進行方向と上向きの外積）
      const rightVector = new THREE.Vector3().crossVectors(forwardVector, upVector).normalize();
      
      // 4. 最終的な上向きベクトル（右向きと進行方向の外積で再計算）
      const correctedUpVector = new THREE.Vector3().crossVectors(rightVector, forwardVector).normalize();
      
      // 急カーブ判定用の閾値設定
      const mildCurveThreshold = 0.038; // 緩やかなカーブの閾値をさらに大幅に引き上げ（0.032→0.038）
      const sharpCurveThreshold = 0.065; // 急カーブの閾値も大幅に引き上げ（0.055→0.065）
      
      // コーナーの進行度をより詳細に判定
      // 現在地点と前後の曲率を比較して、コーナーのどの位置にいるかを判定
      const prevPos = (this.position - 0.01 + 1) % 1; // 少し前の位置
      const nextPos = (this.position + 0.01) % 1;     // 少し先の位置
      const futurePos = (this.position + 0.02) % 1;   // さらに先の位置（コーナー出口の予測用）

      // より先の複数のポイントでの曲率も取得（急カーブの早期検出用）
      // 検出距離を極限まで短くして現在のカーブだけに集中
      const farPoint1 = (this.position + 0.003) % 1;   // 0.005→0.003にさらに短縮
      const farPoint2 = (this.position + 0.005) % 1;   // 0.008→0.005にさらに短縮
      const farPoint3 = (this.position + 0.007) % 1;   // 0.01→0.007にさらに短縮
      const farPoint4 = (this.position + 0.009) % 1;   // 0.0125→0.009にさらに短縮
      const farPoint5 = (this.position + 0.011) % 1;   // 0.015→0.011にさらに短縮
      const farPoint6 = (this.position + 0.013) % 1;   // 0.0175→0.013にさらに短縮
      
      // より先の検出ポイントを追加 - 連続カーブの検出性能を向上
      const farPoint7 = (this.position + 0.018) % 1;   // 新しい検出ポイント
      const farPoint8 = (this.position + 0.023) % 1;   // 新しい検出ポイント
      const farPoint9 = (this.position + 0.028) % 1;   // 新しい検出ポイント
      
      const prevCurve = this.calculateCurvature(prevPos).angle;
      const nextCurve = this.calculateCurvature(nextPos).angle;
      const futureCurve = this.calculateCurvature(futurePos).angle; // コーナー出口の予測
      
      // 前方の曲率も計算（より詳細なサンプリング）
      const farCurve1 = this.calculateCurvature(farPoint1).angle;
      const farCurve2 = this.calculateCurvature(farPoint2).angle;
      const farCurve3 = this.calculateCurvature(farPoint3).angle;
      const farCurve4 = this.calculateCurvature(farPoint4).angle;
      const farCurve5 = this.calculateCurvature(farPoint5).angle;
      const farCurve6 = this.calculateCurvature(farPoint6).angle;
      
      // 新しい検出ポイントの曲率も計算
      const farCurve7 = this.calculateCurvature(farPoint7).angle;
      const farCurve8 = this.calculateCurvature(farPoint8).angle;
      const farCurve9 = this.calculateCurvature(farPoint9).angle;
      
      // 将来の最大曲率を予測（前方に急カーブがあるかチェック）- 検出距離を拡張
      const maxFutureCurvature = Math.max(
          farCurve1, farCurve2, farCurve3, farCurve4, farCurve5, farCurve6,
          farCurve7, farCurve8, farCurve9 // 新しい検出ポイントを追加
      );
      const hasSharpCurveAhead = maxFutureCurvature > sharpCurveThreshold * 0.85; // 閾値を少し緩和 (0.9→0.85)
      
      // 将来の曲率変化率も計算 - より先の検出ポイントも考慮
      const nearFutureCurvatureGradient = (farCurve6 - curveAngle) / 0.07; // 近い将来の変化率
      const farFutureCurvatureGradient = (farCurve9 - curveAngle) / 0.028; // 遠い将来の変化率
      // カーブ接近判定の条件を少し緩和
      const isApproachingSharpCurve = (nearFutureCurvatureGradient > 0.65 || farFutureCurvatureGradient > 0.5) && 
                                     maxFutureCurvature > mildCurveThreshold * 1.2; // 条件を緩和 (0.7/1.3→0.65/1.2)
      
      // 曲率変化率の計算
      const curvatureRateOfChange = (nextCurve - prevCurve) / 0.02; // 単位距離あたりの曲率変化
      const futureCurvatureChange = (futureCurve - curveAngle) / 0.02; // 先の曲率変化
      
      // 急激な曲率の増加があるかどうか - 変数名を修正
      const isRapidCurvatureIncrease = nearFutureCurvatureGradient > 0.9; // 閾値をさらに引き上げ（0.7→0.9）
      
      // コーナーの進行度を判定
      const isEnteringCorner = curveAngle > prevCurve; // 曲率が増加中（コーナー入り中）
      const isExitingCorner = curveAngle > nextCurve;  // 曲率が減少へ（コーナー頂点通過）
      // コーナー出口判定の精度を向上 - 条件を調整
      const isApproachingExit = futureCurvatureChange < -0.15 && curveAngle > mildCurveThreshold * 0.6;
      const isAtCornerPeak = isEnteringCorner && isExitingCorner; // コーナーの頂点付近
      
      // コーナーの曲率ピークに近いかどうか
      const isNearCornerPeak = Math.abs(curvatureRateOfChange) < 0.5 && curveAngle > mildCurveThreshold;
      
      // 直線区間かどうかの判定を追加 - 完全な直線区間を検出
      // 判定条件をさらに大幅に緩和して、より多くのカーブを直線として扱う
      const isInStraightLine = curveAngle < mildCurveThreshold * 0.75 && 
                              maxFutureCurvature < mildCurveThreshold * 0.85 &&
                              prevCurve < mildCurveThreshold * 0.8;
      
      // コーナー出口の検出を強化（次のコーナーまでの直線区間を検出）
      // 判定条件を極限まで緩和
      const isInStraightAfterCorner = curveAngle < mildCurveThreshold * 1.1 && 
                                    (prevCurve > mildCurveThreshold * 0.25 || 
                                     this.currentDriftStrength > 0.04); // 現在のドリフト強度の閾値をさらに下げる
                                     
      // コーナー出口から完全な直線への移行段階を検出 - 条件を極限まで緩和
      const isTransitioningToStraight = curveAngle < mildCurveThreshold * 0.9 && 
                                       prevCurve > mildCurveThreshold * 0.1 && 
                                       this.currentDriftStrength > 0.015;
                                      
      // 次のコーナー検出前に必ず現在のコーナーを曲がり切るための判定 - 条件を緩和
      const hasFinishedCurrentCorner = (curveAngle < mildCurveThreshold * 0.5 && prevCurve > mildCurveThreshold * 0.6) || 
                                      (curveAngle < mildCurveThreshold * 0.3 && prevCurve > mildCurveThreshold * 0.4) ||
                                      isExitingCorner; // コーナー出口も完了と見なす
      
      // 現在カーブのドリフトが強い場合は次のドリフト検出を遅らせる - 条件緩和
      const currentDriftIsStrong = this.currentDriftStrength > 0.2 && 
                                (isInStraightAfterCorner || isExitingCorner || curveAngle > mildCurveThreshold * 0.4);

      // 現在のドリフト方向を維持すべきかどうかを判定 - 極限まで緩和
      const shouldMaintainCurrentDrift = (this.currentDriftStrength > 0.05 && 
                                      (isInStraightAfterCorner || isTransitioningToStraight || isExitingCorner)) || 
                                      (this.currentDriftStrength > 0.1 && !hasFinishedCurrentCorner) ||
                                      currentDriftIsStrong;
      
      // 曲率に基づくドリフト強度を計算（0〜1の連続値）
      let targetDriftStrength = 0;
      
      // より厳密なドリフト開始条件
      // カーブがより強いときのみドリフト開始 - 条件をさらに厳しく
      if (curveAngle > mildCurveThreshold * 2.0 || // 通常カーブの閾値をさらに上げる (1.7→2.0)
         (hasSharpCurveAhead && maxFutureCurvature > mildCurveThreshold * 2.2 && curveAngle > mildCurveThreshold * 1.6) || // 先読み条件もさらに厳しく (2.0/1.4→2.2/1.6)
         (isApproachingSharpCurve && curveAngle > mildCurveThreshold * 1.7)) { // 接近時も厳しく (1.5→1.7)
          
          // コーナーの進入状態を詳細に判定
          const entryPhase = curveAngle / Math.max(curveAngle, prevCurve);
          
          // コーナー進入中はドリフト効果を調整
          let cornerProgressFactor = 0;
          
          if (isAtCornerPeak || isNearCornerPeak) {
              // コーナーのピーク付近でも効果を抑制
              cornerProgressFactor = 0.8; // 最大効果を抑制（0.9→0.8）
          } else if (isExitingCorner) {
              // コーナー出口での効果も抑制
              cornerProgressFactor = 0.7; // 効果を抑制（0.8→0.7）
          } else if (isEnteringCorner) {
              // コーナー入り口での効果をさらに大幅に抑制
              const entrySuppressionFactor = Math.min(1, Math.max(0, curvatureRateOfChange * 7)); // 抑制効果をさらに強める（6→7）
              // 進入度合いによって抑制度合いを変化させる - 入り口ほど強く抑制
              const entryProgress = Math.min(1, entryPhase * 2); // 進入度合いを0~1で評価
              cornerProgressFactor = 0.15 - entrySuppressionFactor * 0.6 + entryProgress * 0.25; // 入口での効果をさらに大幅に弱める（0.2→0.15, 0.5→0.6, 0.3→0.25）
          } else if (hasSharpCurveAhead || isApproachingSharpCurve) {
              // 前方に急カーブがある場合のドリフト効果をさらに減らす
              const distanceAdjustment = isRapidCurvatureIncrease ? 0.1 : 0.03; // 効果をさらに大幅に弱める（0.15→0.1、0.05→0.03）
              cornerProgressFactor = distanceAdjustment;
          }
          
          // 緩やかなカーブ以上の場合にドリフト効果を徐々に適用
          if (curveAngle <= sharpCurveThreshold) {
              // 現在の曲率に基づくドリフト強度 - 開始閾値をさらに大幅に引き上げ
              const currentCurveDrift = Math.max(0, (curveAngle - mildCurveThreshold * 1.8) / (sharpCurveThreshold - mildCurveThreshold));
              
              // 前方の曲率予測に基づくドリフト強度（急カーブが前方にある場合）
              let futureCurveDrift = 0;
              if (hasSharpCurveAhead) {
                  // 前方の急カーブによるドリフト強度 - 開始閾値をさらに大幅に引き上げ
                  futureCurveDrift = Math.max(0, (maxFutureCurvature - mildCurveThreshold * 2.0) / (sharpCurveThreshold - mildCurveThreshold));
                  // 距離に応じて減衰をさらに大幅に強める
                  const distanceFactor = isRapidCurvatureIncrease ? 0.15 : 0.03; // 減衰をさらに強める（0.2→0.15、0.05→0.03）
                  futureCurveDrift *= distanceFactor;
              }
              
              // 現在の曲率と前方予測の大きい方を採用
              targetDriftStrength = Math.max(currentCurveDrift, futureCurveDrift);
          } else {
              // 急カーブ以上は最大強度 - ただし急カーブでも徐々に強度を上げる
              const extremeCurveFactor = Math.min(1.0, (curveAngle - sharpCurveThreshold) / (sharpCurveThreshold * 0.6) + 0.4);
              targetDriftStrength = extremeCurveFactor;
          }
          
          // 基本ドリフト強度を上げる
          targetDriftStrength = Math.min(1.0, targetDriftStrength * 1.3);
          
          // コーナー進行度による補正
          targetDriftStrength *= cornerProgressFactor;
          
          // 速度による補正（さらに低速でもドリフトできるように）
          const minDriftSpeed = this.MAX_SPEED * 0.25; // 最低ドリフト速度
          const fullDriftSpeed = this.MAX_SPEED * 0.5; // 完全ドリフト速度
          
          const speedFactor = Math.min(1.0, Math.max(0, (this.speed - minDriftSpeed) / (fullDriftSpeed - minDriftSpeed)));
          targetDriftStrength *= speedFactor;
          
          // 速度条件
          if (this.speed < this.MAX_SPEED * 0.2) {
              targetDriftStrength = 0;
          }
      } else if (isInStraightAfterCorner && this.currentDriftStrength > 0.04) { // 閾値をさらに下げる (0.06→0.04)
          // コーナーを出た直後の直線区間でもドリフト効果を持続
          // 現在のドリフト強度をより急速に下げる
          targetDriftStrength = this.currentDriftStrength * 0.995; // 減衰率を強める（0.9995→0.995）
      } else if (isTransitioningToStraight && this.currentDriftStrength > 0.015) { // 閾値をさらに下げる (0.02→0.015)
          // 直線への移行中は早めに減衰させる
          targetDriftStrength = this.currentDriftStrength * 0.998; // 減衰率を強める（0.9998→0.998）
      } else if (isInStraightLine && this.currentDriftStrength > 0) {
          // 直線区間ではドリフトを非常に急速に減衰させる
          targetDriftStrength = this.currentDriftStrength * 0.93; // 減衰率をさらに強める（0.96→0.93）
      }
      
      // 現在のドリフト強度を目標値に徐々に近づける
      // ドリフト開始時の速度を遅くする
      const enterDriftSpeed = this.speed * 0.2; // ドリフト開始の補間速度をさらに下げる (0.25→0.2)（より遅く開始）
      
      // ドリフト終了時の補間速度を調整
      // 完全に終了する直前はさらに緩やかに
      let exitDriftSpeed = 0.005; // 基本終了速度を上げる（0.002→0.005）- 通常の終了を早める
      
      // ドリフト強度が弱くなってきたら、さらに緩やかに終了
      if (targetDriftStrength === 0 && this.currentDriftStrength < 0.35) { // 閾値を上げる（0.25→0.35）
          // 弱いドリフトの終了時はより緩やかに
          exitDriftSpeed = 0.002; // 少し早める（0.001→0.002）
          
          // さらに弱い場合は、さらに緩やかに
          if (this.currentDriftStrength < 0.2) { // 閾値を上げる（0.15→0.2）
              exitDriftSpeed = 0.001; // 少し早める（0.0005→0.001）
          }
      }
      
      // 直線区間では終了速度を上げる
      if (isInStraightLine && this.currentDriftStrength > 0) {
          exitDriftSpeed *= 5.0; // 直線区間ではドリフト終了をより急激に早める（3.0→5.0）
      }
      
      // 直線区間でのドリフト方向の急速な補正
      if (isInStraightLine && this.currentDriftStrength < 0.3) {
          // ドリフト方向を0に向けてより急速に戻す
          this.lastDriftDirection *= 0.8; // 0.9→0.8
      }
      
      // コーナー出口付近ではさらに終了を遅くする
      if (isApproachingExit && this.currentDriftStrength > 0.08) { // 閾値をさらに下げる (0.1→0.08)
          exitDriftSpeed *= 0.1; // コーナー出口ではさらに終了を遅く（0.15→0.1）
      }
      
      // 直線区間移行中はさらに終了を遅くする
      if (isTransitioningToStraight && this.currentDriftStrength > 0.015) { // 閾値をさらに下げる (0.02→0.015)
          exitDriftSpeed *= 0.1; // 直線移行中の変化率を引き上げ（0.05→0.1）
      }
      
      // 目標値が現在値より大きい場合（ドリフトを強める方向）はenterDriftSpeedを使用
      // 目標値が現在値より小さい場合（ドリフトを弱める方向）はexitDriftSpeedを使用
      const interpolationSpeed = targetDriftStrength > this.currentDriftStrength ? 
                              enterDriftSpeed : exitDriftSpeed;
      
      this.currentDriftStrength += (targetDriftStrength - this.currentDriftStrength) * interpolationSpeed;
      
      // 小さい値の閾値処理 - 段階的な補間のため、急に0にしない
      // 非常に小さな値のみ0にする - 閾値を引き上げてより早く終了
      if (this.currentDriftStrength < 0.003) { // 閾値を引き上げる (0.001→0.003)
          this.currentDriftStrength = 0;
      }
      
      // ドリフト中ではない（強度が弱い）が、まだ完全に0ではない場合の処理
      // ドリフト方向の補間を継続し、自然な終了を実現
      if (this.currentDriftStrength < 0.15 && this.targetDriftDirection === 0) {
          // ドリフト方向を0に向けて徐々に戻す
          this.lastDriftDirection *= 0.9;
          
          // 方向が十分小さくなったら完全に0に
          if (Math.abs(this.lastDriftDirection) < 0.05) {
              this.lastDriftDirection = 0;
          }
      }
      
      // ドリフト方向の決定：現在の曲率が十分あるなら現在の方向を優先
      // 先読みは現在の曲率がほぼゼロの場合のみ
      const currentDirection = curveTiltDirection;
      let immediateDirection = currentDirection;
      let curvePattern = "simple";

      // 現在の曲率が十分ある場合：目の前のコーナーの方向をそのまま使う
      if (curveAngle > mildCurveThreshold * 0.5) {
          // 現在曲がっているコーナーの方向に従う（先読みしない）
          immediateDirection = currentDirection;
          curvePattern = "current-corner";
      } else if (this.currentDriftStrength > 0.1) {
          // 現在ドリフト中だが曲率が弱まっている：現在のドリフト方向を維持
          immediateDirection = Math.sign(this.lastDriftDirection) || currentDirection;
          curvePattern = "drift-sustain";
      } else {
          // 直線区間：ごく近い先だけ確認（position + 0.01 まで）
          const nearFutureData = this.calculateCurvature((this.position + 0.008) % 1);
          if (nearFutureData.angle > mildCurveThreshold * 1.5) {
              // ごく近い将来に強いカーブがある場合のみ先の方向を採用
              immediateDirection = nearFutureData.direction;
              curvePattern = "near-prepare";
          } else {
              immediateDirection = currentDirection;
              curvePattern = "straight";
          }
      }

      // 目標ドリフト方向を更新
      if (this.currentDriftStrength > 0.08) {
          this.targetDriftDirection = immediateDirection;
      } else {
          this.targetDriftDirection = 0;
      }
      
      // ドリフト方向をスムーズに補間
      const directionChangeSpeed = 0.12; // 方向転換速度を上げる（実車のアクセル/ブレーキ振り出し感）
      
      // 方向転換が必要な場合（現在と目標の方向が異なる場合）
      if (this.lastDriftDirection !== this.targetDriftDirection) {
          // 方向をスムーズに変化させる
          // 現在0なら目標方向へ、そうでなければ0を経由して変化
          if (Math.abs(this.lastDriftDirection) < 0.1) {
              // ほぼ0なら直接目標方向へ - 元の速度に戻す
              this.lastDriftDirection += (this.targetDriftDirection - this.lastDriftDirection) * directionChangeSpeed; // 速度を元に戻す (0.8→1.0)
          } else if (Math.sign(this.lastDriftDirection) !== Math.sign(this.targetDriftDirection) && 
                    Math.abs(this.targetDriftDirection) > 0.1) { // 方向が明確に異なる場合のみ処理
              
              // 符号が異なる場合（左右反転）は、一旦0に向けて変化
              // 方向転換：一旦0を経由して切り返す
              this.lastDriftDirection += (0 - this.lastDriftDirection) * directionChangeSpeed * 0.8;
              
              // ほぼ0になったら、目標方向に変え始める - 値を元に戻す
              if (Math.abs(this.lastDriftDirection) < 0.2) { // 閾値を元に戻す (0.15→0.2)
                  this.lastDriftDirection = this.targetDriftDirection * 0.2; // 初期値を元に戻す (0.1→0.2)
              }
          } else {
              // 同じ符号の場合は直接目標値へ - 元の速度に戻す
              this.lastDriftDirection += (this.targetDriftDirection - this.lastDriftDirection) * directionChangeSpeed; // 速度を元に戻す (0.9→1.0)
          }
      }
      
      // 調整された進行方向ベクトル（ドリフト時に使用）
      let adjustedForwardVector = forwardVector.clone();
      
      // 現在のドリフト強度に応じてドリフト効果を適用
      if (this.currentDriftStrength > 0.001) { // 非常に小さな値でも効果を適用（滑らかな終了のため）
          // 側方向ベクトル（カーブの方向）を取得
          const sideVector = new THREE.Vector3(-forwardVector.z, 0, forwardVector.x).normalize();
          
          // 目標ドリフト角度を計算 - ドリフト方向にスムーズ補間値を使用
          // 速度に応じてドリフト角度をスケーリング - 値を上げる
          const baseMaxDriftAngle = 0.65; // 基本最大ドリフト角度を上げる (0.55→0.65)
          
          let transitionFactor = 1.0;
          
          // 速度スケーリングを大幅に強調（元の値よりも大きな差）
          const targetDriftAngle = this.currentDriftStrength * baseMaxDriftAngle * speedScalingFactor * this.lastDriftDirection * transitionFactor;
          
          // 前回のドリフト角度から目標角度へ徐々に補間 - 速度に応じて変化速度を調整
          const angleInterpolationBase = 0.15; // 基本補間速度を元に戻す (0.1→0.15)
          // 方向転換時はより緩やかに、同じ方向の強度変化時は素早く
          const angleInterpolationFactor = Math.abs(this.lastDriftAngle - targetDriftAngle) > 0.2 ? 
                                          angleInterpolationBase * 0.6 : angleInterpolationBase; // 方向転換時の補間速度を元に戻す (0.5→0.6)
          
          this.lastDriftAngle += (targetDriftAngle - this.lastDriftAngle) * angleInterpolationFactor;
          
          // 角度に基づいて側方向ベクトルを調整 - 強調
          const sideMultiplier = Math.sin(this.lastDriftAngle) * 1.1; // サイドベクトルを強調 (0.9→1.1)
          sideVector.multiplyScalar(sideMultiplier);
          
          // 進行方向ベクトルを角度に基づいて調整
          adjustedForwardVector.x = forwardVector.x * Math.cos(this.lastDriftAngle) + sideVector.x;
          adjustedForwardVector.z = forwardVector.z * Math.cos(this.lastDriftAngle) + sideVector.z;
          adjustedForwardVector.normalize();
      } else {
          // ドリフトなし時は角度をゆっくり0に戻す
          this.lastDriftAngle *= 0.9;
          
          // 十分小さくなったら完全に0に
          if (Math.abs(this.lastDriftAngle) < 0.01) {
              this.lastDriftAngle = 0;
          }
      }
      
      // 調整した進行方向ベクトルに基づいて、新しい右向きベクトルと上向きベクトルを計算
      const adjustedRightVector = new THREE.Vector3().crossVectors(adjustedForwardVector, upVector).normalize();
      const adjustedUpVector = new THREE.Vector3().crossVectors(adjustedRightVector, adjustedForwardVector).normalize();
      
      // 5. 回転行列を作成（3つの直交ベクトルから）
      const rotationMatrix = new THREE.Matrix4().makeBasis(
          adjustedRightVector,
          adjustedUpVector,
          adjustedForwardVector.clone().negate() // THREE.jsの車モデルはZ-方向が前方なので反転
      );
      
      // 6. 回転行列からクォータニオンに変換
      const targetRotation = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix);
      
      // 7. 回転を直接適用
      this.object.quaternion.copy(targetRotation);
      
      // 8. 上り下りの傾斜を反映
      this.object.rotateX(this.lastTiltAngle * 1.5);
      
      // 9. カーブに応じた横傾斜（Z軸回転）- ドリフト時の傾きを強調
      // 速度に応じて傾き量をスケーリング - 強調
      const baseTilt = this.currentDriftStrength > 0.1 ? 0.03 : 0.013; // 通常の最大傾きを上げる (0.025/0.01→0.03/0.013)
      const driftTiltBoost = this.currentDriftStrength * 0.07; // ドリフト時の追加傾きを上げる (0.05→0.07)
      
      // 速度に応じて傾きをスケーリング - 強調
      const tiltSpeedScale = Math.max(0.65, speedScalingFactor * 0.85); // 傾きスケールを上げる (0.6/0.8→0.65/0.85)
      const maxTilt = (baseTilt + driftTiltBoost) * tiltSpeedScale;
      
      // 傾斜係数も強調
      const baseTiltMultiplier = 0.035 + this.currentDriftStrength * 0.09; // 基本傾き係数を上げる (0.03/0.07→0.035/0.09)
      const tiltMultiplier = baseTiltMultiplier * speedScalingFactor * 1.1; // 速度に応じたスケーリングを上げる (1.0→1.1)
      
      // 傾斜係数を計算
      const tiltFactor = Math.min(maxTilt, curveAngle * this.speed * tiltMultiplier);
      
      // ドリフト時の傾きも強調
      const finalTiltFactor = tiltFactor * (1.0 + this.currentDriftStrength * speedScalingFactor * 1.0); // 係数を上げる (0.8→1.0)
      this.object.rotateZ(-finalTiltFactor * curveTiltDirection * 1.1); // 傾きを強調 (1.0→1.1)
      
      // 車の位置を設定
      this.object.position.set(point.x, carHeight, point.z);
      
      // タイヤの回転と位置調整
      const wheelRotationSpeed = this.speed * 0.3;
      
      // フロントタイヤのステアリング角度計算
      const baseSteeringMultiplier = 3.5;
      let steeringMultiplier = baseSteeringMultiplier;
      
      // 最終的なステアリング角度を計算
      let steeringAngle = -curveTiltDirection * Math.abs(curveAngle) * steeringMultiplier * 0.5;
      const maxSteeringAngle = Math.PI / 2.5;
      const clampedSteeringAngle = Math.max(-maxSteeringAngle, Math.min(maxSteeringAngle, steeringAngle));
      
      // タイヤの更新
      for (let i = 0; i < this.wheels.length; i++) {
          // タイヤを回転
          this.wheels[i].rotation.x += wheelRotationSpeed;
          
          const wheelGroup = this.wheelGroups[i];
          const isLeftSide = (i % 2 === 0);
          const isFrontWheel = (i < 2);
          
          if (isFrontWheel) {
              if (this.currentDriftStrength > 0.08) { // 閾値を下げる (0.1→0.08)
                  // ドリフト時は前輪にカウンターステア（逆ステア）を適用 - 控えめに
                  const counterSteerBase = 1.2; // カウンターステア基本係数を下げる (1.5→1.2)
                  // ドリフト強度に応じて可変のカウンターステア - 控えめに
                  const counterSteerStrength = counterSteerBase + this.currentDriftStrength * 0.3; // 係数を下げる (0.5→0.3)
                  wheelGroup.rotation.y = -clampedSteeringAngle * counterSteerStrength;
              } else {
                  // 通常のステアリング
                  wheelGroup.rotation.y = clampedSteeringAngle;
              }
          } else {
              // 後輪は直進
              wheelGroup.rotation.y = 0;
              
              // ドリフト時は後輪の位置も若干調整（車体の傾きに合わせる）
              if (this.currentDriftStrength > 0.15) { // 閾値を下げる (0.2→0.15)
                  // 後輪の横方向オフセット - 控えめに
                  const rearOffset = this.currentDriftStrength * 0.18 * this.lastDriftDirection; // 調整値を下げる (0.25→0.18)
                  const baseWheelX = isLeftSide ? -1.1 : 1.1;
                  wheelGroup.position.x = baseWheelX + (isLeftSide ? -rearOffset : rearOffset);
              } else {
                  // 通常時は初期位置
                  wheelGroup.position.x = isLeftSide ? -1.1 : 1.1;
              }
          }
          
          // タイヤの基本高さとオフセット - 控えめに
          const wheelBaseHeight = 0.5;
          // ドリフト時は傾きを控えめに
          const tiltOffsetMultiplier = 0.2 + this.currentDriftStrength * 0.25; // 傾き強調を下げる (0.25/0.4→0.2/0.25)
          const wheelTiltOffset = isLeftSide ? 
              -finalTiltFactor * curveTiltDirection * tiltOffsetMultiplier : 
              finalTiltFactor * curveTiltDirection * tiltOffsetMultiplier;
          
          // タイヤの高さを設定
          wheelGroup.position.y = wheelBaseHeight + wheelTiltOffset;
      }
      
      // 注：急カーブ時に追加の車体傾斜は不要（既に回転行列で処理）
  }
  
  updateSpeed() {
      // TANDEM/PASS中もカーブ減速は適用する（モード別の速度制御はhandleOvertakingで上書き）

      // 現在のカーブ強度を取得
      const currentCurvature = this.calculateCurvature(this.position).angle;
      
      // 前方のカーブ強度を予測
      const upcomingCurvature = this.predictUpcomingCurve(this.position, 0.05);
      
      // カーブ強度に基づいて目標速度を計算
      // 現在の曲率と前方の曲率の大きい方を使う（ブレーキは早めに）
      const effectiveCurvature = Math.max(currentCurvature, upcomingCurvature);
      const maxCurveAngle = 0.3; // カーブ角度の正規化基準を下げて減速を強める
      const curvatureToSpeedRatio = 0.8 * (1 / this.specs.grip); // 減速比率を上げる (0.5→0.8)

      // ドライビングスタイルに基づく補正
      const cornerAggression = this.drivingStyle.cornerEntryAggression * 0.15; // 補正を控えめに (0.3→0.15)
      const brakingAdjustment = this.drivingStyle.brakingTiming * 0.1; // 補正を控えめに (0.2→0.1)

      // 曲率が大きいほど大幅に減速（2乗カーブで急カーブほど急減速）
      const normalizedCurvature = Math.min(1.0, effectiveCurvature / maxCurveAngle);
      const curvatureSpeedFactor = 1.0 -
          normalizedCurvature * normalizedCurvature *  // 2乗で急カーブの減速を強調
          curvatureToSpeedRatio *
          (1.0 - cornerAggression);

      // 最低速度を設定（完全に止まらないように）
      this.targetSpeed = Math.max(this.MIN_SPEED * 1.2, this.MAX_SPEED * (curvatureSpeedFactor + brakingAdjustment));

      // 速度を目標に近づける（TANDEM中も通常通り加減速する）
      const accelerationBoost = this.drivingStyle.cornerExitAggression * 0.2;
      if (this.speed < this.targetSpeed) {
          this.speed = Math.min(this.targetSpeed,
              this.speed + (this.ACCELERATION_RATE * (1 + accelerationBoost)));
      } else if (this.speed > this.targetSpeed) {
          // 減速は加速より速く（ブレーキング感）
          const brakingForce = this.DECELERATION_RATE * (1 + normalizedCurvature * 2);
          this.speed = Math.max(this.targetSpeed, this.speed - brakingForce);
      }
  }

  calculateCurvature(t, samplePoints = 15, sampleDistance = 0.005) {
    const angles = [];
    
    // 複数のサンプル点で角度を計算し平均を取る
    for (let i = 0; i < samplePoints - 1; i++) {
        const currentPos = (t + i * sampleDistance) % 1;
        const nextPos = (currentPos + sampleDistance) % 1;
        const nextNextPos = (nextPos + sampleDistance) % 1;
        
        const point = this.carPath.getPointAt(currentPos);
        const nextPoint = this.carPath.getPointAt(nextPos);
        const nextNextPoint = this.carPath.getPointAt(nextNextPos);
        
        const v1 = new THREE.Vector2(nextPoint.x - point.x, nextPoint.z - point.z).normalize();
        const v2 = new THREE.Vector2(nextNextPoint.x - nextPoint.x, nextNextPoint.z - nextPoint.z).normalize();
        
        // 2つのベクトル間の角度
        const angle = Math.acos(Math.min(1, Math.max(-1, v1.dot(v2))));
        angles.push(angle);
    }
    
    // 角度の平均値を計算
    const avgAngle = angles.reduce((sum, angle) => sum + angle, 0) / angles.length;
    
    // 曲がる方向の判定（中央のサンプルポイントで判定）
    const middleIndex = Math.floor(samplePoints / 2);
    const currentPos = (t + middleIndex * sampleDistance) % 1;
    const nextPos = (currentPos + sampleDistance) % 1;
    const nextNextPos = (nextPos + sampleDistance) % 1;
    
    const pointStart = this.carPath.getPointAt(currentPos);
    const pointNext = this.carPath.getPointAt(nextPos);
    const pointNextNext = this.carPath.getPointAt(nextNextPos);
    
    const vec1 = new THREE.Vector2(pointNext.x - pointStart.x, pointNext.z - pointStart.z).normalize();
    const vec2 = new THREE.Vector2(pointNextNext.x - pointNext.x, pointNextNext.z - pointNext.z).normalize();
    
    // 曲がり方向を判定（外積）
    const crossProduct = vec1.x * vec2.y - vec1.y * vec2.x;
    const tiltDirection = Math.sign(crossProduct);
    
    return { angle: avgAngle, direction: tiltDirection };
  }

  predictUpcomingCurve(currentPosition, lookAheadDistance = 0.05) {
    // 現在の位置から少し先の位置でのカーブ強度を取得
    const upcomingPos = (currentPosition + lookAheadDistance) % 1;
    const curvatureData = this.calculateCurvature(upcomingPos);
    return curvatureData.angle;
}

  // ヘッドライトの制御
  updateHeadlights(isNight) {
      if (!this.leftHeadlight || !this.rightHeadlight) return;
      
      // 夜間のみヘッドライトを点灯
      this.leftHeadlight.visible = isNight;
      this.rightHeadlight.visible = isNight;
      
      if (isNight) {
          // 夜間は通常の明るさ
          this.leftHeadlight.intensity = this.headlightIntensity;
          this.rightHeadlight.intensity = this.headlightIntensity;
      }
  }

  // パス上の距離差を計算（ループ対応、正=前方）
  static pathDelta(from, to) {
      let d = to - from;
      if (d > 0.5) d -= 1;
      if (d < -0.5) d += 1;
      return d;
  }

  // 前方の最も近い車を検索
  findCarAhead(cars) {
      const myT = this.position;
      let nearestCar = null;
      let nearestGap = Infinity;

      for (const car of cars) {
          const tDelta = Car.pathDelta(myT, car.position);
          // 前方かつ検知範囲内
          if (tDelta < Car.GAP.FIND_AHEAD_MIN || tDelta > Car.GAP.FIND_AHEAD_MAX) continue;

          // 3D距離も確認（パス上は近くても実際は遠い場合がある）
          const dx = car.object.position.x - this.object.position.x;
          const dz = car.object.position.z - this.object.position.z;
          const dist3D = Math.sqrt(dx * dx + dz * dz);
          if (dist3D > this.overtakeDistance) continue;

          if (tDelta < nearestGap) {
              nearestGap = tDelta;
              nearestCar = car;
          }
      }
      return { car: nearestCar, gap: nearestGap };
  }

  // 追い抜き＆追走処理（モード別ディスパッチ）
  handleOvertaking(cars) {
      // TANDEM中
      if (this.isTandemFollowing && this.tandemLeader) {
          this._handleTandemMode(cars);
          return;
      }

      const { car: aheadCar, gap: aheadGap } = this.findCarAhead(cars);
      const carsCloselyBehind = this._countCarsCloselyBehind(cars);

      // PASS中（ターゲットあり）
      if (this.isOvertaking && this.overtakeTargetCar) {
          this._handlePassMode(cars, aheadCar, aheadGap, carsCloselyBehind);
          return;
      }

      // オフセット戻し中（PASS終了後）
      if (this.isOvertaking && !this.overtakeTargetCar) {
          this._fadeOvertakeOffset();
          if (this.overtakeProgress > 0) return;
      }

      // 通常モード
      this._handleNormalMode(cars, aheadCar, aheadGap, carsCloselyBehind);
  }

  // --- モード別ハンドラ ---

  _handleTandemMode(cars) {
      this.tandemDuration++;

      // 追走終了条件: 時間切れ or リーダー消失
      if (this.tandemDuration > this.tandemMaxDuration || !this.tandemLeader.object) {
          this.endTandem(cars);
          return;
      }

      const gap = Car.pathDelta(this.position, this.tandemLeader.position);

      // 追走終了条件: 距離異常（追い越し or 離れすぎ）
      if (gap < Car.GAP.TANDEM_BEHIND || gap > Car.GAP.TANDEM_FAR) {
          this.endTandem(cars);
          return;
      }

      // リーダー割り込みチェック
      const { car: closestAhead, gap: closestGap } = this.findCarAhead(cars);
      if (closestAhead && closestAhead !== this.tandemLeader && closestGap < gap) {
          this.tandemLeader.tandemFollower = null;
          this.tandemLeader = closestAhead;
          closestAhead.tandemFollower = this;
          this.tandemTargetGap = 0.003 + Math.random() * 0.002;
      }

      // 速度制御: リーダーが近い場合のみキャップ、遠い場合は通常走行
      const currentGap = Car.pathDelta(this.position, this.tandemLeader.position);
      if (currentGap <= this.tandemTargetGap) {
          this.speed = Math.min(this.speed, this.tandemLeader.speed);
      }

      this._fadeOvertakeOffset();
  }

  _handlePassMode(cars, aheadCar, aheadGap, carsCloselyBehind) {
      // 前方busy車チェック（毎フレーム・最優先）
      if (aheadCar && aheadGap < Car.GAP.AHEAD_BUSY && carsCloselyBehind === 0 && this.speed >= aheadCar.speed) {
          if (this._isCarBusy(aheadCar)) {
              this.isOvertaking = false;
              this.overtakeTargetCar = null;
              this.overtakeProgress = 0;
              this.overtakeDirection = 0;
              this.startTandem(aheadCar);
              return;
          }
      }

      this.overtakeDuration++;
      const targetGap = Car.pathDelta(this.position, this.overtakeTargetCar.position);

      if (targetGap < Car.GAP.OVERTAKE_COMPLETE || targetGap > Car.GAP.OVERTAKE_LOST) {
          // 抜き切った or 離されすぎた → PASS終了
          this._endPass();
      } else if (this.overtakeDuration > this.overtakeMaxDuration) {
          // 時間切れ → TANDEMに切り替え or ライン戻し
          this.overtakeTargetCar = null;
          this.overtakeDuration = 0;
          if (aheadCar && aheadGap < Car.GAP.ENDTANDEM_PASS_START) {
              this.startTandem(aheadCar);
          } else {
              this._fadeOvertakeOffset();
          }
      } else {
          // 継続 → スリップストリームターボ
          const turboProgress = Math.min(1.0, this.overtakeDuration / Car.TURBO.DURATION);
          const turboMultiplier = Car.TURBO.INITIAL_MULT - turboProgress * Car.TURBO.DECAY;
          const boostSpeed = Math.min(
              this.MAX_SPEED * Car.TURBO.MAX_SPEED_RATIO,
              this.overtakeTargetCar.speed * turboMultiplier
          );
          this.speed = Math.max(this.speed, boostSpeed);
          this.overtakeProgress = Math.min(1.0, this.overtakeProgress + this.overtakePhaseSpeed);
      }
  }

  _handleNormalMode(cars, aheadCar, aheadGap, carsCloselyBehind) {
      if (!aheadCar) {
          this._fadeOvertakeOffset();
          return;
      }

      // 前方busy車 → 無条件TANDEM（後方詰まりなし & 自分が速い場合）
      if (aheadGap < Car.GAP.AHEAD_BUSY && carsCloselyBehind === 0 && this.speed >= aheadCar.speed) {
          if (this._isCarBusy(aheadCar)) {
              this.startTandem(aheadCar);
              return;
          }
      }

      // 接近判定（1回限り）
      this._updateApproachJudgement(cars, aheadCar, aheadGap, carsCloselyBehind);

      // 超接近 → 強制TANDEM
      if (aheadGap < Car.GAP.FORCE_TANDEM) {
          this.startTandem(aheadCar);
          return;
      }

      // やや接近 → 減速
      if (aheadGap < Car.GAP.SLOW_DOWN) {
          this.speed += (aheadCar.speed * 0.95 - this.speed) * 0.05;
      }
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
          const targetGap = Car.pathDelta(this.position, this._approachTarget.position);
          if (targetGap < Car.GAP.OVERTAKE_COMPLETE || targetGap > Car.GAP.OVERTAKE_LOST) {
              this._approachJudged = false;
              this._approachTarget = null;
          }
      }

      // 判定発動条件: 接近距離内 & 未判定 & 自分が速い(離れていく場合は判定しない)
      if (aheadGap >= Car.GAP.APPROACH || this._approachJudged || this.speed < aheadCar.speed * 0.95) {
          return;
      }

      this._approachJudged = true;
      this._approachTarget = aheadCar;

      const isAlreadyBeingOvertaken = cars.some(c => c.isOvertaking && c.overtakeTargetCar === aheadCar);

      // 他車が既に抜き中 → TANDEM
      if (isAlreadyBeingOvertaken) {
          this.startTandem(aheadCar);
          return;
      }

      // 後方詰まり → 100% PASS（速度差に関わらずブーストで抜く）
      if (carsCloselyBehind >= 1) {
          this._startPass(aheadCar, 0);
          this.overtakeProgress = Math.min(1.0, this.overtakeProgress + this.overtakePhaseSpeed);
          return;
      }

      // 自分が遅い → TANDEM
      if (this.speed <= aheadCar.speed) {
          this.startTandem(aheadCar);
          return;
      }

      // 通常判定: TANDEM(60%) / PASS(40%)
      if (Math.random() < 0.6) {
          this.startTandem(aheadCar);
      } else {
          this._startPass(aheadCar, 0);
          this.overtakeProgress = Math.min(1.0, this.overtakeProgress + this.overtakePhaseSpeed);
      }
  }
  // --- ヘルパーメソッド ---

  // 速度(km/h)に応じたドリフトスケーリング係数を計算
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

  // 車がbusy状態か（PASS中/TANDEM中/TANDEMリーダー）
  _isCarBusy(car) {
      return car.isOvertaking || car.isTandemFollowing || car.tandemFollower;
  }

  // 後方に詰まっている車の台数（自分のTANDEMフォロワーは除外）
  _countCarsCloselyBehind(cars) {
      return cars.filter(c => {
          if (c === this || c === this.tandemFollower) return false;
          const behindGap = Car.pathDelta(c.position, this.position);
          return behindGap > 0 && behindGap < Car.GAP.BEHIND_CHECK;
      }).length;
  }

  // 追い抜き方向を計算（-1: 左, 1: 右）
  _calculateOvertakeDirection(targetCar) {
      const myDirection = new THREE.Vector3();
      this.object.getWorldDirection(myDirection);
      const rightVector = new THREE.Vector3(-myDirection.z, 0, myDirection.x);
      const dx = targetCar.object.position.x - this.object.position.x;
      const dz = targetCar.object.position.z - this.object.position.z;
      const lateralDot = rightVector.dot(new THREE.Vector3(dx, 0, dz));
      return lateralDot > 0 ? -1 : 1;
  }

  // 追い抜きオフセットを徐々に戻す
  _fadeOvertakeOffset() {
      const returnSpeed = Math.max(0.003, this.overtakeProgress * 0.04);
      this.overtakeProgress = Math.max(0, this.overtakeProgress - returnSpeed);
      if (this.overtakeProgress <= 0) {
          this.isOvertaking = false;
          this.overtakeDirection = 0;
          this.overtakeTargetCar = null;
      }
  }

  // PASS終了共通処理
  _endPass() {
      this.overtakeTargetCar = null;
      this.overtakeDuration = 0;
      this.speed = Math.min(this.speed, this.MAX_SPEED);
      this._fadeOvertakeOffset();
  }

  // PASS開始
  _startPass(targetCar, initialProgress = 0) {
      this.isOvertaking = true;
      this.isTandemFollowing = false;
      this.overtakeProgress = initialProgress;
      this.overtakeDuration = 0;
      this.overtakeTargetCar = targetCar;
      this.overtakeDirection = this._calculateOvertakeDirection(targetCar);
  }

  // --- 状態遷移 ---

  startTandem(leader) {
      this.isTandemFollowing = true;
      this.tandemLeader = leader;
      leader.tandemFollower = this;
      this.tandemDuration = 0;
      this.tandemMaxDuration = 600 + Math.floor(Math.random() * 900);
      this.originalSpeed = this.speed;
      this.tandemTargetGap = 0.003 + Math.random() * 0.002;
      this.isOvertaking = false;
      // overtakeProgress/Direction は保持 → _fadeOvertakeOffset で徐々に戻る
  }

  endTandem(cars) {
      // リーダーとの関係を解除
      if (this.tandemLeader) {
          this.tandemLeader.tandemFollower = null;
      }
      this.isTandemFollowing = false;
      this.tandemLeader = null;
      this.tandemDuration = 0;
      this._approachJudged = false;
      this._approachTarget = null;

      if (!cars) return;

      // 前方車を再チェックして即座に次のモードへ遷移
      const { car: aheadCar, gap: aheadGap } = this.findCarAhead(cars);
      if (!aheadCar || aheadGap > Car.GAP.ENDTANDEM_CHECK) return;
      if (aheadCar.speed > this.speed * 1.05) return; // 離れていく車は追わない

      if (this._isCarBusy(aheadCar)) {
          this.startTandem(aheadCar); // busy車 → 再TANDEM
      } else {
          this._startPass(aheadCar, 0.3); // 通常車 → PASS
      }
  }
}