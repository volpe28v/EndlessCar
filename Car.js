// Car.js
  // デバッグ用のログ
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

export class Car {
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
      this.overtakeTarget = null;          // 追い抜き対象の車
      this.overtakeProgress = 0;           // 追い越し進捗（0.0 〜 1.0）
      this.overtakePhaseSpeed = 0.015;     // 追い越し進捗の更新速度
      
      // 速度係数の計算（0〜1の範囲で正規化）
      // 速度（km/h）に基づいた係数を計算
      const speedKmh = this.speed * this.SPEED_TO_KMH; // 内部速度を km/h に変換
      
      // 速度範囲の定義
      const slowSpeedMin = 100; // 低速範囲の下限 (km/h)
      const slowSpeedMax = 130; // 低速範囲の上限 (km/h)
      const fastSpeedMin = 150; // 高速範囲の下限 (km/h)
      const fastSpeedMax = 180; // 高速範囲の上限 (km/h)
      
      // 速度に応じたドリフトスケーリング係数 
      let speedScalingFactor;
      
      if (speedKmh <= 60) {
          // 60km/h以下: ほぼドリフトなし
          speedScalingFactor = 0.03; // 値を下げる (0.05→0.03)
      } else if (speedKmh <= 80) {
          // 60-80km/h: 最小ドリフト（0.03から0.1へ線形補間）- 値を下げる
          speedScalingFactor = 0.03 + (speedKmh - 60) * (0.07 / 20);
      } else if (speedKmh <= 100) {
          // 80-100km/h: 小さめドリフト（0.1から0.2へ線形補間）- 値を下げる
          speedScalingFactor = 0.1 + (speedKmh - 80) * (0.1 / 20);
      } else if (speedKmh <= 130) {
          // 100-130km/h: 控えめなドリフト（0.2から0.4へ線形補間）- 値を下げる
          speedScalingFactor = 0.2 + (speedKmh - 100) * (0.2 / 30);
      } else if (speedKmh <= 150) {
          // 130-150km/h: 中くらいのドリフト（0.4から0.7へ線形補間）- 値を下げる
          speedScalingFactor = 0.4 + (speedKmh - 130) * (0.3 / 20);
      } else if (speedKmh <= 180) {
          // 150-180km/h: 大きいドリフト（0.7から1.3へ線形補間）- 値を下げる
          speedScalingFactor = 0.7 + (speedKmh - 150) * (0.6 / 30);
      } else {
          // 180km/h超: 最大ドリフト幅
          speedScalingFactor = 1.3; // 値を下げる (2.0→1.3)
      }
      
      // 速度（km/h）をログに表示
      if (this.logCounter === 0) {
          console.log('現在の速度: ' + speedKmh.toFixed(1) + ' km/h, スケール: ' + speedScalingFactor.toFixed(2));
      }
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

      // スペック情報をログ出力
      console.log('車のスペック生成:', {
          topSpeed: Math.round(specs.topSpeed * 100),
          acceleration: Math.round(specs.acceleration * 100),
          handling: Math.round(specs.handling * 100),
          grip: Math.round(specs.grip * 100)
      });

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

          // 追加: ドリフトスタイルを持っているかどうか
          useDrift: Math.random() > 0.5
      };

      // スタイル情報をログ出力
      console.log('ドライビングスタイル生成:', {
          linePreference: Math.round(style.linePreference * 100),
          cornerEntryAggression: Math.round(style.cornerEntryAggression * 100),
          cornerExitAggression: Math.round(style.cornerExitAggression * 100),
          brakingTiming: Math.round(style.brakingTiming * 100),
          lineTransitionTiming: Math.round(style.lineTransitionTiming * 100),
          lineConsistency: Math.round(style.lineConsistency * 100),
          outInOutStrength: Math.round(style.outInOutStrength * 100),
          useDrift: style.useDrift
      });

      return style;
  }
  
  createDetailedCar() {
      const car = new THREE.Group();
      
      // カラーバリエーション
      const carColors = [
          { name: 'レーシングレッド', body: 0xFF0000, accent: 0x111111 },
          { name: 'クラシックブルー', body: 0x0066CC, accent: 0x111111 },
          { name: 'イエロー', body: 0xFFCC00, accent: 0x111111 },
          { name: 'ブリティッシュグリーン', body: 0x006633, accent: 0x111111 },
          { name: 'パールホワイト', body: 0xFFFFFF, accent: 0x111111 }
      ];
      
      // ランダムにカラーを選択
      const selectedColor = carColors[Math.floor(Math.random() * carColors.length)];
      log(`選択されたカラー: ${selectedColor.name}`);
      
      // 車体ベース（レーシングカー風の低く、幅広いデザイン）
      const carBodyGeometry = new THREE.BoxGeometry(2.4, 0.3, 4.8);
      const carBodyMaterial = new THREE.MeshLambertMaterial({ color: selectedColor.body }); // 選択されたカラー
      const carBody = new THREE.Mesh(carBodyGeometry, carBodyMaterial);
      carBody.position.y = 0.55;
      car.add(carBody);
      
      // フロントノーズ（先端が低く、シャープな形状）
      const noseGeometry = new THREE.BoxGeometry(1.8, 0.2, 1.0);
      const noseMaterial = new THREE.MeshLambertMaterial({ color: selectedColor.body });
      const nose = new THREE.Mesh(noseGeometry, noseMaterial);
      nose.position.set(0, 0.45, -2.2);
      car.add(nose);
      
      // フロントウイング
      const frontWingGeometry = new THREE.BoxGeometry(2.2, 0.1, 0.4);
      const frontWingMaterial = new THREE.MeshLambertMaterial({ color: 0x111111 });
      const frontWing = new THREE.Mesh(frontWingGeometry, frontWingMaterial);
      frontWing.position.set(0, 0.35, -2.4);
      car.add(frontWing);

      // フロントウイングエンドプレート（左）
      const frontWingEndPlateLeftGeometry = new THREE.BoxGeometry(0.1, 0.2, 0.6);
      const frontWingEndPlateLeft = new THREE.Mesh(frontWingEndPlateLeftGeometry, frontWingMaterial);
      frontWingEndPlateLeft.position.set(-1.1, 0.4, -2.4);
      car.add(frontWingEndPlateLeft);

      // フロントウイングエンドプレート（右）
      const frontWingEndPlateRight = frontWingEndPlateLeft.clone();
      frontWingEndPlateRight.position.set(1.1, 0.4, -2.4);
      car.add(frontWingEndPlateRight);
      
      // サイドポンツーン（左）
      const sidePodGeometry = new THREE.BoxGeometry(0.4, 0.3, 2.0);
      const sidePodMaterial = new THREE.MeshLambertMaterial({ color: selectedColor.body });
      const leftSidePod = new THREE.Mesh(sidePodGeometry, sidePodMaterial);
      leftSidePod.position.set(-1.0, 0.5, 0.2);
      car.add(leftSidePod);

      // サイドポンツーン（右）
      const rightSidePod = leftSidePod.clone();
      rightSidePod.position.set(1.0, 0.5, 0.2);
      car.add(rightSidePod);

      // エアボックス（エンジン上部の空気取り入れ口）
      const airboxGeometry = new THREE.BoxGeometry(0.6, 0.4, 0.8);
      const airboxMaterial = new THREE.MeshLambertMaterial({ color: selectedColor.body });
      const airbox = new THREE.Mesh(airboxGeometry, airboxMaterial);
      airbox.position.set(0, 1.0, 0.8);
      car.add(airbox);

      // リアウイング本体（より薄く、幅広に）
      const rearWingGeometry = new THREE.BoxGeometry(2.2, 0.08, 0.6);
      const rearWingMaterial = new THREE.MeshLambertMaterial({ color: 0x111111 });
      const rearWing = new THREE.Mesh(rearWingGeometry, rearWingMaterial);
      rearWing.position.set(0, 1.2, 2.2);
      car.add(rearWing);

      // リアウイングエンドプレート（左）
      const wingEndPlateGeometry = new THREE.BoxGeometry(0.1, 0.4, 0.8);
      const leftWingEndPlate = new THREE.Mesh(wingEndPlateGeometry, rearWingMaterial);
      leftWingEndPlate.position.set(-1.1, 1.2, 2.2);
      car.add(leftWingEndPlate);

      // リアウイングエンドプレート（右）
      const rightWingEndPlate = leftWingEndPlate.clone();
      rightWingEndPlate.position.set(1.1, 1.2, 2.2);
      car.add(rightWingEndPlate);

      // リアウイングサポート（左）
      const wingPillarGeometry = new THREE.BoxGeometry(0.1, 0.5, 0.1);
      const wingPillarMaterial = new THREE.MeshLambertMaterial({ color: 0x111111 });
      const leftWingPillar = new THREE.Mesh(wingPillarGeometry, wingPillarMaterial);
      leftWingPillar.position.set(-0.8, 1.0, 2.2);
      car.add(leftWingPillar);

      // リアウイングサポート（右）
      const rightWingPillar = leftWingPillar.clone();
      rightWingPillar.position.set(0.8, 1.0, 2.2);
      car.add(rightWingPillar);

      // レーシングナンバー（3）- 左側
      const leftNumberGeometry = new THREE.PlaneGeometry(0.8, 0.8);
      const leftNumberMaterial = new THREE.MeshBasicMaterial({ 
          color: 0xFFFFFF,
          transparent: true,
          opacity: 0.9
      });
      const leftNumber = new THREE.Mesh(leftNumberGeometry, leftNumberMaterial);
      leftNumber.position.set(-1.21, 0.85, 0);
      leftNumber.rotation.y = Math.PI / 2;
      car.add(leftNumber);

      // レーシングナンバー（3）- 右側
      const rightNumber = leftNumber.clone();
      rightNumber.position.set(1.21, 0.85, 0);
      rightNumber.rotation.y = -Math.PI / 2;
      car.add(rightNumber);

      // NAMCOロゴ - 左側
      const leftLogoGeometry = new THREE.PlaneGeometry(1.2, 0.3);
      const leftLogoMaterial = new THREE.MeshBasicMaterial({ 
          color: 0xFFFFFF,
          transparent: true,
          opacity: 0.9
      });
      const leftLogo = new THREE.Mesh(leftLogoGeometry, leftLogoMaterial);
      leftLogo.position.set(-1.21, 1.0, -0.5);
      leftLogo.rotation.y = Math.PI / 2;
      car.add(leftLogo);

      // NAMCOロゴ - 右側
      const rightLogo = leftLogo.clone();
      rightLogo.position.set(1.21, 1.0, -0.5);
      rightLogo.rotation.y = -Math.PI / 2;
      car.add(rightLogo);
      
      // フロントガラス（レーシング風に低く）
      const windshieldGeometry = new THREE.BoxGeometry(1.4, 0.25, 1.0);
      const windshieldMaterial = new THREE.MeshLambertMaterial({ 
          color: 0x333333,
          transparent: true,
          opacity: 0.7
      });
      const windshield = new THREE.Mesh(windshieldGeometry, windshieldMaterial);
      windshield.position.set(0, 0.9, -0.4);
      windshield.rotation.x = Math.PI * 0.06;
      car.add(windshield);

      // ヘッドレスト
      const headrestGeometry = new THREE.BoxGeometry(0.4, 0.3, 0.3);
      const headrestMaterial = new THREE.MeshLambertMaterial({ color: 0x111111 });
      const headrest = new THREE.Mesh(headrestGeometry, headrestMaterial);
      headrest.position.set(0, 0.9, 0.4);
      car.add(headrest);

      // リアディフューザー
      const diffuserGeometry = new THREE.BoxGeometry(2.0, 0.15, 0.6);
      const diffuserMaterial = new THREE.MeshLambertMaterial({ color: 0x111111 });
      const diffuser = new THREE.Mesh(diffuserGeometry, diffuserMaterial);
      diffuser.position.set(0, 0.35, 2.3);
      car.add(diffuser);

      // ヘッドライト（レーシング風の小型ライト）
      const headlightGeometry = new THREE.BoxGeometry(0.2, 0.1, 0.1);
      const headlightMaterial = new THREE.MeshLambertMaterial({ 
          color: 0xFFFFFF,
          emissive: 0xFFFFFF,
          emissiveIntensity: 1.0
      });
      
      const leftHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
      leftHeadlight.position.set(0.7, 0.65, -2.35);
      car.add(leftHeadlight);
      
      const rightHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
      rightHeadlight.position.set(-0.7, 0.65, -2.35);
      car.add(rightHeadlight);
      
      // ヘッドライトのスポットライト
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

      // テールライト（レーシング風の細長いデザイン）
      const taillightGeometry = new THREE.BoxGeometry(1.0, 0.1, 0.1);
      const taillightMaterial = new THREE.MeshLambertMaterial({ 
          color: 0xFF0000,
          emissive: 0xFF0000,
          emissiveIntensity: 0.5
      });
      
      const taillight = new THREE.Mesh(taillightGeometry, taillightMaterial);
      taillight.position.set(0, 0.85, 2.35);
      car.add(taillight);
      
      // サイドエアインテーク（レーシングカー風）
      const intakeGeometry = new THREE.BoxGeometry(0.1, 0.4, 1.2);
      const intakeMaterial = new THREE.MeshLambertMaterial({ color: 0x111111 });
      
      const leftIntake = new THREE.Mesh(intakeGeometry, intakeMaterial);
      leftIntake.position.set(1.15, 0.75, 0.5);
      car.add(leftIntake);
      
      const rightIntake = new THREE.Mesh(intakeGeometry, intakeMaterial);
      rightIntake.position.set(-1.15, 0.75, 0.5);
      car.add(rightIntake);
      
      // タイヤを作成する関数（レーシングホイール）
      function createWheel(x, z) {
          const wheelGroup = new THREE.Group();
          
          // タイヤ本体（ワイドタイヤ）
          const wheelGeometry = new THREE.CylinderGeometry(0.45, 0.45, 0.4, 16);
          const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x111111 });
          const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
          wheel.rotation.z = Math.PI / 2;
          wheelGroup.add(wheel);
          
          // レーシングホイール
          const hubGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.41, 12);
          const hubMaterial = new THREE.MeshLambertMaterial({ color: 0xC0C0C0 });
          const hub = new THREE.Mesh(hubGeometry, hubMaterial);
          hub.rotation.z = Math.PI / 2;
          wheelGroup.add(hub);
          
          // センターロック風のキャップ
          const capGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.42, 6);
          const capMaterial = new THREE.MeshLambertMaterial({ color: 0xFF0000 });
          const cap = new THREE.Mesh(capGeometry, capMaterial);
          cap.rotation.z = Math.PI / 2;
          wheelGroup.add(cap);
          
          // レーシングスポーク
          for (let i = 0; i < 6; i++) {
              const spokeGeometry = new THREE.BoxGeometry(0.04, 0.02, 0.35);
              const spokeMaterial = new THREE.MeshLambertMaterial({ color: 0xC0C0C0 });
              const spoke = new THREE.Mesh(spokeGeometry, spokeMaterial);
              spoke.rotation.z = Math.PI / 2;
              spoke.rotation.x = (Math.PI * 2 / 6) * i;
              spoke.position.y = 0;
              wheelGroup.add(spoke);
          }
          
          wheelGroup.position.set(x, 0.4, z);
          car.add(wheelGroup);
          
          return { wheel, wheelGroup };
      }
      
      // 4つのタイヤを作成（ワイドトレッド）
      const frontLeftWheel = createWheel(-1.1, -1.7);
      const frontRightWheel = createWheel(1.1, -1.7);
      const rearLeftWheel = createWheel(-1.1, 1.7);
      const rearRightWheel = createWheel(1.1, 1.7);
      
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
      // 追い抜き処理を実行（他の車の配列を使用）
      this.handleOvertaking(this.otherCars);
      
      // ヘッドライトは処理が重いので一旦オフ
      isNight = false;
      // ヘッドライトの更新
      this.updateHeadlights(isNight);
      
      // 速度を更新（カーブに応じて）
      this.updateSpeed();
      
      // 速度をkm/h単位に変換
      const SPEED_TO_KMH = 450; // 内部速度からkm/hへの変換係数
      const speedKmh = this.speed * SPEED_TO_KMH;
      
      // 速度範囲に基づくスケーリング係数を計算
      let speedScalingFactor;
      
      // この車がドリフトスタイルを持っているかどうかをチェック
      const isDriftStyleCar = this.drivingStyle && this.drivingStyle.useDrift;
      
      if (!isDriftStyleCar) {
          // ドリフトしない車はほぼドリフトなし
          speedScalingFactor = 0.01; // 極小のドリフト効果
      } else {
          // 速度に応じたスケーリング係数の決定 - 全体的に値を上げる
          if (speedKmh <= 60) {
              // 60km/h以下: ほぼドリフトなし
              speedScalingFactor = 0.05; // 値を上げる (0.03→0.05)
          } else if (speedKmh <= 80) {
              // 60-80km/h: 最小ドリフト（0.05から0.15へ線形補間）- 値を上げる
              speedScalingFactor = 0.05 + (speedKmh - 60) * (0.1 / 20);
          } else if (speedKmh <= 100) {
              // 80-100km/h: 小さめドリフト（0.15から0.3へ線形補間）- 値を上げる
              speedScalingFactor = 0.15 + (speedKmh - 80) * (0.15 / 20);
          } else if (speedKmh <= 130) {
              // 100-130km/h: 控えめなドリフト（0.3から0.6へ線形補間）- 値を上げる
              speedScalingFactor = 0.3 + (speedKmh - 100) * (0.3 / 30);
          } else if (speedKmh <= 150) {
              // 130-150km/h: 中くらいのドリフト（0.6から1.0へ線形補間）- 値を上げる
              speedScalingFactor = 0.6 + (speedKmh - 130) * (0.4 / 20);
          } else if (speedKmh <= 180) {
              // 150-180km/h: 大きいドリフト（1.0から1.7へ線形補間）- 値を上げる
              speedScalingFactor = 1.0 + (speedKmh - 150) * (0.7 / 30);
          } else {
              // 180km/h超: 最大ドリフト幅
              speedScalingFactor = 1.7; // 値を上げる (1.3→1.7)
          }
      }
      
      // デバッグ用: 60フレームごとに現在の速度とスケーリング係数をログ出力
      if (Math.random() < 0.016) { // 約60フレームに1回
          const driftStyle = isDriftStyleCar ? "ドリフト車" : "グリップ車";
          console.log(`${driftStyle} - 現在の速度: ${speedKmh.toFixed(1)}km/h, スケーリング係数: ${speedScalingFactor.toFixed(2)}`);
      }
      
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
      const curveTiltDirection = curvatureData.direction;
      
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
      
      // 複合カーブ検出のためのより詳細な分析
      // 既存のnextCurveDataと区別するために別の変数名を使用
      const nearCurveData = this.calculateCurvature(nextPos);
      const farCurveData1 = this.calculateCurvature(farPoint1);
      const farCurveData2 = this.calculateCurvature(farPoint2);
      const farCurveData3 = this.calculateCurvature(farPoint3);
      const farCurveData4 = this.calculateCurvature(farPoint4);
      const farCurveData5 = this.calculateCurvature(farPoint5);
      const farCurveData6 = this.calculateCurvature(farPoint6);
      
      // 現在のカーブと将来のカーブの方向をチェック
      const currentDirection = curveTiltDirection;
      const nearDirection = nearCurveData.direction;
      const farDirection1 = farCurveData1.direction;
      const farDirection2 = farCurveData2.direction;
      const farDirection3 = farCurveData3.direction;
      const farDirection4 = farCurveData4.direction;
      const farDirection5 = farCurveData5.direction;
      const farDirection6 = farCurveData6.direction;
      
      // 新しい検出ポイントの方向も取得
      const farCurveData7 = this.calculateCurvature(farPoint7);
      const farCurveData8 = this.calculateCurvature(farPoint8);
      const farCurveData9 = this.calculateCurvature(farPoint9);
      const farDirection7 = farCurveData7.direction;
      const farDirection8 = farCurveData8.direction;
      const farDirection9 = farCurveData9.direction;
      
      // カーブ方向が変化するポイントを検出
      const directionChanges = [];
      let lastDirection = currentDirection;
      const directions = [
          nearDirection, 
          farDirection1, farDirection2, farDirection3, farDirection4, farDirection5, farDirection6,
          farDirection7, farDirection8, farDirection9 // 新しい検出ポイントを追加
      ];
      const positions = [
          nextPos, 
          farPoint1, farPoint2, farPoint3, farPoint4, farPoint5, farPoint6,
          farPoint7, farPoint8, farPoint9 // 新しい検出ポイントを追加
      ];
      const curves = [
          nextCurve, 
          farCurve1, farCurve2, farCurve3, farCurve4, farCurve5, farCurve6,
          farCurve7, farCurve8, farCurve9 // 新しい検出ポイントを追加
      ];
      
      // 方向変化を検出し、変化点とその位置、強度を記録
      for (let i = 0; i < directions.length; i++) {
          // 方向変化検出の閾値を引き上げて検出を抑制
          if (directions[i] !== lastDirection && 
              curves[i] > mildCurveThreshold * 0.6) { // 閾値を大幅に引き上げ (0.4→0.6)
              
              // カーブ強度に応じて優先度をつける
              const priority = curves[i] / mildCurveThreshold;
              
              directionChanges.push({
                  position: positions[i],
                  direction: directions[i],
                  strength: curves[i],
                  distance: i < 6 ? i * 0.0005 + 0.003 : (i - 6) * 0.005 + 0.018, // 距離を調整
                  priority: priority // 優先度を追加
              });
              lastDirection = directions[i];
          }
      }
      
      // 優先度の高い（＝強いカーブ）順にソート
      directionChanges.sort((a, b) => b.priority - a.priority);
      
      // 複合カーブの種類を特定
      let curvePattern = "simple"; // 単純カーブ（デフォルト）
      let isCompoundCurve = false;
      // デフォルトでは常に現在のカーブの方向を使用する
      let immediateDirection = currentDirection;
      
      // 現在のカーブが十分強いかどうかをより厳格に判定
      const currentCurveIsStrong = curveAngle > mildCurveThreshold * 0.7; // 条件を引き上げ (0.9→0.7)
      
      // 現在のドリフト中であるかの判定を分離
      const isCurrentlyDrifting = this.currentDriftStrength > 0.15;
      
      // 現在のコーナーの進行度をより正確に判定 - より厳格な条件に
      const isCurrentCornerComplete = hasFinishedCurrentCorner || 
                                     (isExitingCorner && curveAngle < mildCurveThreshold * 0.8) || // 閾値を引き下げ (1.0→0.8)
                                     curveAngle < mildCurveThreshold * 0.4; // 閾値を引き下げ (0.5→0.4)
      
      // 詳細なデバッグログを追加 - 重要な状態の変化を記録
      if (Math.random() < 0.01) { // 約100フレームに1回
          const cornerState = isEnteringCorner ? "入口" : isExitingCorner ? "出口" : "中間";
          const completionState = isCurrentCornerComplete ? "完了" : "進行中";
          console.log(`コーナー状態: ${cornerState}, ${completionState}, 曲率=${curveAngle.toFixed(4)}, ドリフト=${this.currentDriftStrength.toFixed(2)}`);
      }
      
      // 複合カーブ検出の条件を大幅に厳しく - 本当に必要な場合のみ検出
      if (directionChanges.length > 0 && 
          (isCurrentCornerComplete || (this.currentDriftStrength < 0.05 && curveAngle < mildCurveThreshold * 0.25)) && // 閾値を引き下げ (0.07/0.35→0.05/0.25)
          !shouldMaintainCurrentDrift) { 
          
          // デバッグログを追加
          if (Math.random() < 0.005) { // 約200フレームに1回
              console.log(`方向変化検出: 変化点数=${directionChanges.length}, 現在の曲率=${curveAngle.toFixed(4)}, 現在のドリフト強度=${this.currentDriftStrength.toFixed(4)}`);
              // 詳細な条件の状態も出力
              console.log(`条件詳細: currentCurveIsStrong=${currentCurveIsStrong}, isCurrentCornerComplete=${isCurrentCornerComplete}, shouldMaintainCurrentDrift=${shouldMaintainCurrentDrift}`);
          }
          
          // 方向変化が検出された場合複合カーブ処理
          isCompoundCurve = true;
          
          // 最も近い変化点までの距離が小さい場合、S字カーブの中間にいる可能性
          const closestChange = directionChanges[0];
          
          // 現在のカーブの強さを優先判定に使用
          const currentCurveStrength = curveAngle > mildCurveThreshold * 1.2 ? "strong" :
                                      curveAngle > mildCurveThreshold * 0.6 ? "medium" : "weak";
          
          // 次のカーブとの距離に基づいて判定
          // 距離条件を大幅に縮小 - かなり近いカーブのみ検出
          if (closestChange.distance < 0.015 && // 検出距離を大幅に縮小 (0.025→0.015)
              (currentCurveStrength === "weak" || 
              (isCurrentCornerComplete && this.currentDriftStrength < 0.2))) { // 条件を引き下げ (0.3→0.2)
              
              // 現在のカーブが弱いまたは完了している場合のみ次のカーブを考慮
              curvePattern = "S-curve-middle";
              // 次のカーブの方向と現在のカーブを比較 - 条件を厳しく
              if (closestChange.strength > curveAngle * 1.4) { // 条件を厳しく (1.15→1.4)
                  // 次のカーブが現在の1.4倍以上強い場合、次のカーブの方向を採用
                  immediateDirection = closestChange.direction;
              }
          } else if (closestChange.distance < 0.023 && // 検出距離を大幅に縮小 (0.037→0.023)
                    (currentCurveStrength === "weak" || 
                    (isCurrentCornerComplete && this.currentDriftStrength < 0.15))) { // 条件を引き下げ (0.2→0.15)
                     
              // 近い場所で方向変化かつ現在のカーブが弱いまたは完了している場合
              curvePattern = "S-curve-approaching";
              
              // 次のカーブと現在のカーブの強さを比較 - 条件を厳しく
              if (closestChange.strength > curveAngle * 1.5) { // 条件を厳しく (1.2→1.5)
                  // 次のカーブが現在の1.5倍以上強い場合、次のカーブの方向を考慮
                  immediateDirection = closestChange.direction;
              }
          } else {
              // その他の場合は常に現在のカーブを優先 - 現在のカーブ重視を強調
              curvePattern = "prioritize-current";
              immediateDirection = currentDirection;
          }
      } else {
          // 方向変化がない場合、または現在のカーブが完了していない場合は単純カーブ処理
          curvePattern = currentCurveIsStrong ? "strong-current" : "simple";
          immediateDirection = currentDirection;
          
          // デバッグログを追加
          if (Math.random() < 0.002) { // 約500フレームに1回
              console.log(`複合カーブ検出スキップ: currentCurveIsStrong=${currentCurveIsStrong}, isCurrentCornerComplete=${isCurrentCornerComplete}, shouldMaintainCurrentDrift=${shouldMaintainCurrentDrift}, curveAngle=${curveAngle.toFixed(4)}, currentDriftStrength=${this.currentDriftStrength.toFixed(4)}`);
          }
      }
      
      // デバッグ用: カーブパターンを表示 - 出力頻度を上げる
      if (Math.random() < 0.01) { // 約100フレームに1回 (0.008→0.01)
          const currentStrength = curveAngle.toFixed(3);
          console.log(`カーブパターン: ${curvePattern}, 現在の強さ: ${currentStrength}, 方向変化数: ${directionChanges.length}, 採用方向: ${immediateDirection}`);
      }
      
      // 目標ドリフト方向を更新 - 閾値を下げてより早く方向を反映
      if (this.currentDriftStrength > 0.08) { // 閾値を下げる (0.15→0.08)
          // 複合カーブパターンに基づいて方向を決定
          this.targetDriftDirection = immediateDirection;
      } else {
          // ドリフトしていないときは方向をリセット
          this.targetDriftDirection = 0;
      }
      
      // ドリフト方向をスムーズに補間
      // 急な方向変化を防ぐ - 方向転換速度を元に戻す
      const directionChangeSpeed = 0.05; // 方向転換の速度を元に戻す (0.03→0.05)
      
      // 方向転換が必要な場合（現在と目標の方向が異なる場合）
      if (this.lastDriftDirection !== this.targetDriftDirection) {
          // 方向をスムーズに変化させる
          // 現在0なら目標方向へ、そうでなければ0を経由して変化
          if (Math.abs(this.lastDriftDirection) < 0.1) {
              // ほぼ0なら直接目標方向へ - 元の速度に戻す
              this.lastDriftDirection += (this.targetDriftDirection - this.lastDriftDirection) * directionChangeSpeed; // 速度を元に戻す (0.8→1.0)
          } else if (Math.sign(this.lastDriftDirection) !== Math.sign(this.targetDriftDirection) && 
                    Math.abs(this.targetDriftDirection) > 0.1) { // 方向が明確に異なる場合のみ処理
              
              // コーナー間の移行タイミングに加算処理 - 値を元に戻す
              const transitionDelay = curvePattern.includes("S-curve") ? 0.8 : 0.6; // 速度を元に戻す (0.5/0.4→0.8/0.6)
              
              // 符号が異なる場合（左右反転）は、一旦0に向けて変化
              // 現在のコーナーでのドリフトが完了していない場合は変化を遅らせる - だが完全に止めない
              if (isCurrentCornerComplete) {
                  // 現在のコーナーが完了している場合は通常の速度で変化
                  this.lastDriftDirection += (0 - this.lastDriftDirection) * directionChangeSpeed * transitionDelay;
                  
                  // 方向転換開始のデバッグログ
                  if (Math.random() < 0.1 && Math.abs(this.lastDriftDirection) > 0.5) {
                      console.log(`方向転換開始: 現在の方向=${this.lastDriftDirection.toFixed(2)}, 目標=${this.targetDriftDirection}, パターン=${curvePattern}`);
                  }
              } else {
                  // 現在のコーナーがまだ完了していない場合は変化を遅くする - ただし停止はしない
                  this.lastDriftDirection += (0 - this.lastDriftDirection) * directionChangeSpeed * 0.3; // 速度を元に戻す (0.2→0.3)
                  
                  // 方向転換遅延のデバッグログ
                  if (Math.random() < 0.05 && Math.abs(this.lastDriftDirection) > 0.5) {
                      console.log(`方向転換遅延中: コーナー未完了, 現在の方向=${this.lastDriftDirection.toFixed(2)}`);
                  }
              }
              
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
          
          // 次のコーナーへの移行中は若干ドリフト角度を制限
          let transitionFactor = 1.0;
          if (curvePattern.includes("S-curve") && Math.sign(this.lastDriftAngle) !== Math.sign(this.lastDriftDirection)) {
              // S字カーブ中で方向転換中の場合、角度を少し制限
              transitionFactor = 0.85; // 値を上げる (0.8→0.85)
          }
          
          // 方向転換中の場合は若干強調して切り替えを促進
          if (Math.sign(this.lastDriftDirection) !== Math.sign(this.targetDriftDirection) && 
              Math.abs(this.targetDriftDirection) > 0.1) {
              // 方向転換中は若干強調 - 値を下げる
              transitionFactor = 1.0; // 値を下げる (1.2→1.0)
          }
          
          // 速度スケーリングを大幅に強調（元の値よりも大きな差）
          const targetDriftAngle = this.currentDriftStrength * baseMaxDriftAngle * speedScalingFactor * this.lastDriftDirection * transitionFactor;
          
          // デバッグ: ドリフト角度の変化を監視
          if (Math.random() < 0.01 && Math.abs(this.lastDriftAngle - targetDriftAngle) > 0.3) {
              console.log(`ドリフト角度変化: 現在=${this.lastDriftAngle.toFixed(2)}, 目標=${targetDriftAngle.toFixed(2)}, パターン=${curvePattern}`);
          }
          
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
      // 現在のカーブ強度を取得
      const currentCurvature = this.calculateCurvature(this.position).angle;
      
      // 前方のカーブ強度を予測
      const upcomingCurvature = this.predictUpcomingCurve(this.position, 0.05);
      
      // カーブ強度に基づいて目標速度を計算（グリップ性能とドライビングスタイルを考慮）
      const maxCurveAngle = 0.5;
      const curvatureToSpeedRatio = 0.5 * (1 / this.specs.grip);
      
      // ドライビングスタイルに基づく補正
      const cornerAggression = this.drivingStyle.cornerEntryAggression * 0.3; // 0〜0.3の補正
      const brakingAdjustment = this.drivingStyle.brakingTiming * 0.2; // 0〜0.2の補正
      
      const curvatureSpeedFactor = 1.0 - 
          Math.min(1.0, Math.abs(upcomingCurvature) / maxCurveAngle) * 
          curvatureToSpeedRatio * 
          (1.0 - cornerAggression); // コーナリングの積極性を反映
      
      this.targetSpeed = this.MAX_SPEED * (curvatureSpeedFactor + brakingAdjustment);
      
      // 速度を目標に近づける（加速性能とコーナー立ち上がりの積極性を考慮）
      const accelerationBoost = this.drivingStyle.cornerExitAggression * 0.3; // 0〜0.3の補正
      if (this.speed < this.targetSpeed) {
          this.speed = Math.min(this.targetSpeed, 
              this.speed + (this.ACCELERATION_RATE * (1 + accelerationBoost)));
      } else if (this.speed > this.targetSpeed) {
          this.speed = Math.max(this.targetSpeed, this.speed - this.DECELERATION_RATE);
      }
  }

  // index と重複してるのでなんとかしたい
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

  // index と重複してるのでなんとかしたい
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

  // シンプルな追い抜き処理
  handleOvertaking(cars) {
      if (this.isOvertaking) {
          // 追い抜き中の場合、対象の車との相対位置をチェック
          if (this.overtakeTarget) {
              const relativePos = this.object.position.clone().sub(this.overtakeTarget.object.position);
              const distance = relativePos.length();
              
              // 追い抜き対象より十分前に出た場合は追い抜き完了
              if (distance > this.overtakeDistance && relativePos.z < 0) {
                  // 追い越し完了時は徐々に元のラインに戻る
                  this.overtakeProgress = Math.max(0, this.overtakeProgress - this.overtakePhaseSpeed);
                  if (this.overtakeProgress <= 0) {
                      this.isOvertaking = false;
                      this.overtakeTarget = null;
                      this.overtakeDirection = 0;
                  }
                  return;
              }
              
              // 追い越し中は進捗を更新
              this.overtakeProgress = Math.min(1.0, this.overtakeProgress + this.overtakePhaseSpeed);
          }
          return;  // 追い抜き中は新たな追い抜き判定を行わない
      }
      
      // 前方の車を検出
      const myPosition = this.object.position.clone();
      const myDirection = new THREE.Vector3();
      this.object.getWorldDirection(myDirection);
      
      let nearestCar = null;
      let minDistance = Infinity;
      
      // 最も近い前方の車を探す
      for (const car of cars) {
          const carPosition = car.object.position.clone();
          const toOtherCar = carPosition.clone().sub(myPosition);
          const distance = toOtherCar.length();
          
          if (distance < this.overtakeDistance && distance < minDistance) {
              nearestCar = car;
              minDistance = distance;
          }
      }
      
      // 前方に車がいて、その車より速い場合に追い抜き開始
      if (nearestCar && this.speed > nearestCar.speed) {
          this.isOvertaking = true;
          this.overtakeTarget = nearestCar;
          this.overtakeProgress = 0;  // 追い越し開始時は進捗を0に初期化
          
          // 追い抜き方向を決定（相対位置から左右どちらが空いているか判断）
          const rightVector = new THREE.Vector3(-myDirection.z, 0, myDirection.x);
          const toTarget = nearestCar.object.position.clone().sub(myPosition);
          this.overtakeDirection = Math.sign(rightVector.dot(toTarget));
      }
  }
}