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
          speedScalingFactor = 0.05; // 極めて小さなドリフト量
      } else if (speedKmh <= 80) {
          // 60-80km/h: 最小ドリフト（0.05から0.15へ線形補間）
          speedScalingFactor = 0.05 + (speedKmh - 60) * (0.1 / 20);
      } else if (speedKmh <= 100) {
          // 80-100km/h: 小さめドリフト（0.15から0.25へ線形補間）
          speedScalingFactor = 0.15 + (speedKmh - 80) * (0.1 / 20);
      } else if (speedKmh <= 130) {
          // 100-130km/h: 控えめなドリフト（0.25から0.6へ線形補間）
          speedScalingFactor = 0.25 + (speedKmh - 100) * (0.35 / 30);
      } else if (speedKmh <= 150) {
          // 130-150km/h: 中くらいのドリフト（0.6から1.0へ線形補間）
          speedScalingFactor = 0.6 + (speedKmh - 130) * (0.4 / 20);
      } else if (speedKmh <= 180) {
          // 150-180km/h: 大きいドリフト（1.0から1.8へ線形補間）
          speedScalingFactor = 1.0 + (speedKmh - 150) * (0.8 / 30);
      } else {
          // 180km/h超: より派手な最大ドリフト幅
          speedScalingFactor = 1.8;
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
          outInOutStrength: Math.random()
      };

      // スタイル情報をログ出力
      console.log('ドライビングスタイル生成:', {
          linePreference: Math.round(style.linePreference * 100),
          cornerEntryAggression: Math.round(style.cornerEntryAggression * 100),
          cornerExitAggression: Math.round(style.cornerExitAggression * 100),
          brakingTiming: Math.round(style.brakingTiming * 100),
          lineTransitionTiming: Math.round(style.lineTransitionTiming * 100),
          lineConsistency: Math.round(style.lineConsistency * 100),
          outInOutStrength: Math.round(style.outInOutStrength * 100)
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
      
      // 速度に応じたスケーリング係数の決定
      if (speedKmh <= 60) {
          // 60km/h以下: ほぼドリフトなし
          speedScalingFactor = 0.05; // 極めて小さなドリフト量
      } else if (speedKmh <= 80) {
          // 60-80km/h: 最小ドリフト（0.05から0.15へ線形補間）
          speedScalingFactor = 0.05 + (speedKmh - 60) * (0.1 / 20);
      } else if (speedKmh <= 100) {
          // 80-100km/h: 小さめドリフト（0.15から0.25へ線形補間）
          speedScalingFactor = 0.15 + (speedKmh - 80) * (0.1 / 20);
      } else if (speedKmh <= 130) {
          // 100-130km/h: 控えめなドリフト（0.25から0.6へ線形補間）
          speedScalingFactor = 0.25 + (speedKmh - 100) * (0.35 / 30);
      } else if (speedKmh <= 150) {
          // 130-150km/h: 中くらいのドリフト（0.6から1.0へ線形補間）
          speedScalingFactor = 0.6 + (speedKmh - 130) * (0.4 / 20);
      } else if (speedKmh <= 180) {
          // 150-180km/h: 大きいドリフト（1.0から1.8へ線形補間）
          speedScalingFactor = 1.0 + (speedKmh - 150) * (0.8 / 30);
      } else {
          // 180km/h超: より派手な最大ドリフト幅
          speedScalingFactor = 1.8;
      }
      
      // デバッグ用: 60フレームごとに現在の速度とスケーリング係数をログ出力
      if (Math.random() < 0.016) { // 約60フレームに1回
          console.log(`現在の速度: ${speedKmh.toFixed(1)}km/h, スケーリング係数: ${speedScalingFactor.toFixed(2)}`);
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
      const mildCurveThreshold = 0.022; // 緩やかなカーブの閾値（ドリフト開始を早めるため下げる）
      const sharpCurveThreshold = 0.04; // 急カーブの閾値
      
      // コーナーの進行度をより詳細に判定
      // 現在地点と前後の曲率を比較して、コーナーのどの位置にいるかを判定
      const prevPos = (this.position - 0.01 + 1) % 1; // 少し前の位置
      const nextPos = (this.position + 0.01) % 1;     // 少し先の位置
      const futurePos = (this.position + 0.02) % 1;   // さらに先の位置（コーナー出口の予測用）

      // より先の複数のポイントでの曲率も取得（急カーブの早期検出用）
      const farPoint1 = (this.position + 0.03) % 1;
      const farPoint2 = (this.position + 0.05) % 1;
      const farPoint3 = (this.position + 0.07) % 1;
      
      const prevCurve = this.calculateCurvature(prevPos).angle;
      const nextCurve = this.calculateCurvature(nextPos).angle;
      const futureCurve = this.calculateCurvature(futurePos).angle; // コーナー出口の予測
      
      // 前方の曲率も計算
      const farCurve1 = this.calculateCurvature(farPoint1).angle;
      const farCurve2 = this.calculateCurvature(farPoint2).angle;
      const farCurve3 = this.calculateCurvature(farPoint3).angle;
      
      // 将来の最大曲率を予測（前方に急カーブがあるかチェック）
      const maxFutureCurvature = Math.max(farCurve1, farCurve2, farCurve3);
      const hasSharpCurveAhead = maxFutureCurvature > sharpCurveThreshold * 0.9;
      
      // 将来の曲率変化率も計算
      const futureCurvatureGradient = (farCurve3 - curveAngle) / 0.07;
      const isApproachingSharpCurve = futureCurvatureGradient > 0.4 && maxFutureCurvature > mildCurveThreshold;
      
      // 曲率変化率の計算
      const curvatureRateOfChange = (nextCurve - prevCurve) / 0.02; // 単位距離あたりの曲率変化
      const futureCurvatureChange = (futureCurve - curveAngle) / 0.02; // 先の曲率変化
      
      // 急激な曲率の増加があるかどうか
      const isRapidCurvatureIncrease = futureCurvatureGradient > 0.6;
      
      // コーナーの進行度を判定
      const isEnteringCorner = curveAngle > prevCurve; // 曲率が増加中（コーナー入り中）
      const isExitingCorner = curveAngle > nextCurve;  // 曲率が減少へ（コーナー頂点通過）
      const isApproachingExit = futureCurvatureChange < -0.2; // コーナー出口に近づいている
      const isAtCornerPeak = isEnteringCorner && isExitingCorner; // コーナーの頂点付近
      
      // コーナーの曲率ピークに近いかどうか
      const isNearCornerPeak = Math.abs(curvatureRateOfChange) < 0.5 && curveAngle > mildCurveThreshold;
      
      // コーナー出口の検出を強化（次のコーナーまでの直線区間を検出）
      const isInStraightAfterCorner = curveAngle < mildCurveThreshold * 0.7 && prevCurve > mildCurveThreshold;
      
      // 曲率に基づくドリフト強度を計算（0〜1の連続値）
      let targetDriftStrength = 0;
      
      // より厳密なドリフト開始条件
      // 1. 曲率が閾値を超えているか、急カーブが近づいている
      // 2. コーナーの入口〜ピーク付近であること
      if (curveAngle > mildCurveThreshold || hasSharpCurveAhead || isApproachingSharpCurve) {
          // コーナー進入中はドリフト効果を調整
          let cornerProgressFactor = 0;
          
          if (isAtCornerPeak || isNearCornerPeak) {
              // コーナーのピーク付近では最大効果
              cornerProgressFactor = 1.0;
          } else if (isExitingCorner) {
              // コーナー出口では少し強め（0.8→0.9）に
              cornerProgressFactor = 0.9;
          } else if (isEnteringCorner) {
              // コーナー入り口でも効果を強める（早めにドリフト開始）
              const entrySuppressionFactor = Math.min(1, Math.max(0, curvatureRateOfChange * 2)); // さらに抑制効果を弱める（3→2）
              cornerProgressFactor = 0.6 - entrySuppressionFactor * 0.2; // 入口でもより効果を強める（0.5→0.6）
          } else if (hasSharpCurveAhead || isApproachingSharpCurve) {
              // 前方に急カーブがある場合は早めにドリフト効果を適用
              const distanceAdjustment = isRapidCurvatureIncrease ? 0.7 : 0.5; // 曲率の増加が急激なら効果を強める
              cornerProgressFactor = distanceAdjustment;
          }
          
          // 緩やかなカーブ以上の場合にドリフト効果を徐々に適用
          if (curveAngle <= sharpCurveThreshold) {
              // 現在の曲率に基づくドリフト強度
              const currentCurveDrift = (curveAngle - mildCurveThreshold) / (sharpCurveThreshold - mildCurveThreshold);
              
              // 前方の曲率予測に基づくドリフト強度（急カーブが前方にある場合）
              let futureCurveDrift = 0;
              if (hasSharpCurveAhead) {
                  // 前方の急カーブによるドリフト強度
                  futureCurveDrift = (maxFutureCurvature - mildCurveThreshold) / (sharpCurveThreshold - mildCurveThreshold);
                  // 距離に応じて減衰
                  const distanceFactor = isRapidCurvatureIncrease ? 0.8 : 0.5; // 急激な曲率増加なら減衰を弱める
                  futureCurveDrift *= distanceFactor;
              }
              
              // 現在の曲率と前方予測の大きい方を採用
              targetDriftStrength = Math.max(currentCurveDrift, futureCurveDrift);
          } else {
              // 急カーブ以上は最大強度
              targetDriftStrength = 1.0;
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
      } else if (isInStraightAfterCorner && this.currentDriftStrength > 0.2) {
          // コーナーを出た直後の直線区間でもドリフト効果を持続
          // 現在のドリフト強度を徐々に下げるが、急激には下げない
          targetDriftStrength = this.currentDriftStrength * 0.95; // より緩やかに減衰（0.9→0.95）
      }
      
      // 現在のドリフト強度を目標値に徐々に近づける
      // ドリフト開始時はより速く
      const enterDriftSpeed = this.speed * 0.40; // ドリフト開始の補間速度を上げる（より早く開始）
      
      // ドリフト終了時の補間速度を調整
      // 完全に終了する直前はさらに緩やかに
      let exitDriftSpeed = 0.06; // 基本終了速度を下げる（0.08→0.06）
      
      // ドリフト強度が弱くなってきたら、さらに緩やかに終了
      if (targetDriftStrength === 0 && this.currentDriftStrength < 0.35) { // 閾値を上げる（0.25→0.35）
          // 弱いドリフトの終了時はより緩やかに
          exitDriftSpeed = 0.04; // さらに遅く（0.05→0.04）
          
          // さらに弱い場合は、さらに緩やかに
          if (this.currentDriftStrength < 0.2) { // 閾値を上げる（0.15→0.2）
              exitDriftSpeed = 0.015; // 極めて緩やかに（0.025→0.015）
          }
      }
      
      // コーナー出口付近ではさらに終了を遅くする
      if (isApproachingExit && this.currentDriftStrength > 0.2) {
          exitDriftSpeed *= 0.7; // コーナー出口ではさらに終了を遅く
      }
      
      // 目標値が現在値より大きい場合（ドリフトを強める方向）はenterDriftSpeedを使用
      // 目標値が現在値より小さい場合（ドリフトを弱める方向）はexitDriftSpeedを使用
      const interpolationSpeed = targetDriftStrength > this.currentDriftStrength ? 
                              enterDriftSpeed : exitDriftSpeed;
      
      this.currentDriftStrength += (targetDriftStrength - this.currentDriftStrength) * interpolationSpeed;
      
      // 小さい値の閾値処理 - 段階的な補間のため、急に0にしない
      // 非常に小さな値のみ0にする
      if (this.currentDriftStrength < 0.02) {
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
      
      // 目標ドリフト方向を更新
      if (this.currentDriftStrength > 0.15) {
          // ドリフト中は現在のカーブ方向を目標方向に設定
          this.targetDriftDirection = curveTiltDirection;
      } else {
          // ドリフトしていないときは方向をリセット
          // ただし急にリセットするのではなく、lastDriftDirectionを通じて緩やかに0に近づける
          this.targetDriftDirection = 0;
      }
      
      // ドリフト方向をスムーズに補間
      // 急な方向変化を防ぐ
      const directionChangeSpeed = 0.05; // 方向転換の速度（小さいほど緩やか）
      
      // 方向転換が必要な場合（現在と目標の方向が異なる場合）
      if (this.lastDriftDirection !== this.targetDriftDirection) {
          // 方向をスムーズに変化させる
          // 現在0なら目標方向へ、そうでなければ0を経由して変化
          if (Math.abs(this.lastDriftDirection) < 0.1) {
              // ほぼ0なら直接目標方向へ
              this.lastDriftDirection += (this.targetDriftDirection - this.lastDriftDirection) * directionChangeSpeed;
          } else if (Math.sign(this.lastDriftDirection) !== Math.sign(this.targetDriftDirection)) {
              // 符号が異なる場合（左右反転）は、一旦0に向けて変化
              this.lastDriftDirection += (0 - this.lastDriftDirection) * directionChangeSpeed * 1.5;
              
              // ほぼ0になったら、目標方向に変え始める
              if (Math.abs(this.lastDriftDirection) < 0.1) {
                  this.lastDriftDirection = this.targetDriftDirection * 0.1;
              }
          } else {
              // 同じ符号の場合は直接目標値へ
              this.lastDriftDirection += (this.targetDriftDirection - this.lastDriftDirection) * directionChangeSpeed;
          }
      }
      
      // 最終的なドリフト方向（スムーズに補間された値）
      const driftDirection = this.lastDriftDirection;
      
      // 調整された進行方向ベクトル（ドリフト時に使用）
      let adjustedForwardVector = forwardVector.clone();
      
      // 現在のドリフト強度に応じてドリフト効果を適用
      if (this.currentDriftStrength > 0.001) { // 非常に小さな値でも効果を適用（滑らかな終了のため）
          // 側方向ベクトル（カーブの方向）を取得
          const sideVector = new THREE.Vector3(-forwardVector.z, 0, forwardVector.x).normalize();
          
          // 目標ドリフト角度を計算 - ドリフト方向にスムーズ補間値を使用
          // 速度に応じてドリフト角度をスケーリング - より強調
          const baseMaxDriftAngle = 0.65; // 基本最大ドリフト角度
          // 速度スケーリングを大幅に強調（元の値よりも大きな差）
          const maxDriftAngle = baseMaxDriftAngle * speedScalingFactor; // 速度範囲に基づくスケーリング
          
          const targetDriftAngle = this.currentDriftStrength * maxDriftAngle * driftDirection;
          
          // 前回のドリフト角度から目標角度へ徐々に補間 - 速度に応じて変化速度を調整
          const angleInterpolationBase = 0.12; // 基本補間速度をわずかに上げる（0.1→0.12）
          // 方向転換時はより緩やかに、同じ方向の強度変化時は素早く
          const angleInterpolationFactor = Math.abs(this.lastDriftAngle - targetDriftAngle) > 0.1 ? 
                                          angleInterpolationBase * 0.5 : angleInterpolationBase;
          
          this.lastDriftAngle += (targetDriftAngle - this.lastDriftAngle) * angleInterpolationFactor;
          
          // 角度に基づいて側方向ベクトルを調整 - 強調
          const sideMultiplier = Math.sin(this.lastDriftAngle) * 1.2; // サイドベクトルを強調（1.0→1.2）
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
      
      // 9. カーブに応じた横傾斜（Z軸回転）- ドリフト時は強調
      // 速度に応じて傾き量をスケーリング - より強調
      const baseTilt = this.currentDriftStrength > 0.1 ? 0.02 : 0.01; // 通常の最大傾き
      const driftTiltBoost = this.currentDriftStrength * 0.05; // ドリフト時の追加傾き
      
      // 速度に応じて傾きをスケーリング - より強い差
      const tiltSpeedScale = Math.max(0.6, speedScalingFactor * 0.8); // 傾きスケールは控えめに
      const maxTilt = (baseTilt + driftTiltBoost) * tiltSpeedScale;
      
      // 傾斜係数も強調と速度スケーリング - より強調
      const baseTiltMultiplier = 0.03 + this.currentDriftStrength * 0.07; // 基本傾き係数
      const tiltMultiplier = baseTiltMultiplier * speedScalingFactor; // 速度に応じたスケーリングを強化
      
      // 傾斜係数を計算
      const tiltFactor = Math.min(maxTilt, curveAngle * this.speed * tiltMultiplier);
      
      // ドリフト時は傾きをさらに大きく
      const finalTiltFactor = tiltFactor * (1.0 + this.currentDriftStrength * 0.8 * speedScalingFactor);
      this.object.rotateZ(-finalTiltFactor * curveTiltDirection);
      
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
              if (this.currentDriftStrength > 0.1) {
                  // ドリフト時は前輪にカウンターステア（逆ステア）を適用 - より強調
                  const counterSteerStrength = 1.2; // カウンターステアを強調（1.0→1.2）
                  wheelGroup.rotation.y = -clampedSteeringAngle * counterSteerStrength;
              } else {
                  // 通常のステアリング
                  wheelGroup.rotation.y = clampedSteeringAngle;
              }
          } else {
              // 後輪は直進
              wheelGroup.rotation.y = 0;
              
              // ドリフト時は後輪の位置も若干調整（車体の傾きに合わせる）
              if (this.currentDriftStrength > 0.2) {
                  // 後輪の横方向オフセット - ドリフト時に若干強調
                  const rearOffset = this.currentDriftStrength * 0.2 * driftDirection;
                  const baseWheelX = isLeftSide ? -1.1 : 1.1;
                  wheelGroup.position.x = baseWheelX + (isLeftSide ? -rearOffset : rearOffset);
              } else {
                  // 通常時は初期位置
                  wheelGroup.position.x = isLeftSide ? -1.1 : 1.1;
              }
          }
          
          // タイヤの基本高さとオフセット - ドリフト時は強調
          const wheelBaseHeight = 0.5;
          // ドリフト時は傾きを強調
          const tiltOffsetMultiplier = 0.2 + this.currentDriftStrength * 0.3; // 傾き強調（0.2→0.2+0.3）
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