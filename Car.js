// Car.js
  // デバッグ用のログ
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

export class Car {
  constructor(carPath) {
      this.carPath = carPath;
      this.position = 0;  // パス上の位置（0から1）
      this.speed = 0.3;   // 車の速度
      this.targetSpeed = 0.3; // 目標速度
      this.object = null; // 車の3Dオブジェクト
      this.wheels = [];    // タイヤオブジェクト
      this.wheelGroups = []; // タイヤグループ
      this.upVector = new THREE.Vector3(0, 1, 0);
      this.lastPosition = new THREE.Vector3();
      this.lastRotation = new THREE.Quaternion();
      this.lastTiltAngle = 0;
      
      // 速度の制限
      this.MIN_SPEED = 0.25;  // 最低速度
      this.MAX_SPEED = 0.6;   // 最高速度
      this.ACCELERATION_RATE = 0.01;
      this.DECELERATION_RATE = 0.02;
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
      const leftLight = new THREE.SpotLight(0xFFFFFF, 1.5, 50, Math.PI / 6, 0.3, 1);
      leftLight.position.set(0.6, 2.0, -2.0);
      leftLight.target.position.set(0.3, 0.0, -20);
      leftLight.visible = false;
      car.add(leftLight);
      car.add(leftLight.target);
      
      const rightLight = new THREE.SpotLight(0xFFFFFF, 1.5, 50, Math.PI / 6, 0.3, 1);
      rightLight.position.set(-0.6, 2.0, -2.0);
      rightLight.target.position.set(-0.3, 0.0, -20);
      rightLight.visible = false;
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
  
  update(deltaTime) {
      // 速度を更新（カーブに応じて）
      this.updateSpeed();
      
      // 位置を更新
      this.position += this.speed * 0.001;
      if (this.position >= 1) this.position -= 1;
      
      // 道路上の位置を厳密に取得
      const point = this.carPath.getPointAt(this.position);
      
      // パスの接線ベクトルを取得（進行方向）
      const tangent = this.carPath.getTangentAt(this.position).normalize();
      // XZ平面上の接線ベクトル（高さを無視）
      const flatTangent = new THREE.Vector3(tangent.x, 0, tangent.z).normalize();
      
      // 次のポイントと前のポイントを取得して傾斜を計算（上り下りの計算用）
      const nextPos = (this.position + 0.01) % 1;
      const prevPos = (this.position - 0.01 + 1) % 1;
      const nextPoint = this.carPath.getPointAt(nextPos);
      const prevPoint = this.carPath.getPointAt(prevPos);
      
      // 前後方向の傾斜角を計算（Y軸方向の変化から）
      const forwardSlope = Math.atan2(nextPoint.y - point.y, 
          Math.sqrt(Math.pow(nextPoint.x - point.x, 2) + Math.pow(nextPoint.z - point.z, 2)));
      
      // サンプリング範囲を拡大して、より正確な傾斜を取得
      const farNextPos = (this.position + 0.02) % 1;
      const farPrevPos = (this.position - 0.02 + 1) % 1;
      const farNextPoint = this.carPath.getPointAt(farNextPos);
      const farPrevPoint = this.carPath.getPointAt(farPrevPos);
      
      // 広い範囲での前後方向の傾斜角を計算
      const farForwardSlope = Math.atan2(farNextPoint.y - farPrevPoint.y, 
          Math.sqrt(Math.pow(farNextPoint.x - farPrevPoint.x, 2) + Math.pow(farNextPoint.z - farPrevPoint.z, 2)));
      
      // 近距離と遠距離の傾斜を組み合わせて、より安定した傾斜値を得る
      const combinedSlope = (forwardSlope * 0.7 + farForwardSlope * 0.3);
      
      // 曲率を計算
      const curvatureData = this.calculateCurvature(this.position);
      const curveAngle = curvatureData.angle;
      const curveTiltDirection = curvatureData.direction;
      
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
      
      // 5. 回転行列を作成（3つの直交ベクトルから）
      const rotationMatrix = new THREE.Matrix4().makeBasis(
          rightVector,
          correctedUpVector,
          forwardVector.clone().negate() // THREE.jsの車モデルはZ-方向が前方なので反転
      );
      
      // 6. 回転行列からクォータニオンに変換
      const targetRotation = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix);
      
      // 7. 回転を直接適用
      this.object.quaternion.copy(targetRotation);
      
      // 8. 上り下りの傾斜を反映
      this.object.rotateX(combinedSlope * 1.5);
      
      // 9. カーブに応じた微小な横傾斜（Z軸回転）
      const maxTilt = 0.005;
      const tiltFactor = Math.min(maxTilt, curveAngle * this.speed * 0.02);
      this.object.rotateZ(-tiltFactor * curveTiltDirection);
      
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
          
          // 前輪の場合、ステアリング角度を適用
          if (isFrontWheel) {
              wheelGroup.rotation.y = clampedSteeringAngle;
          }
          
          // タイヤの基本高さとオフセット
          const wheelBaseHeight = 0.5;
          const wheelTiltOffset = isLeftSide ? 
              -tiltFactor * curveTiltDirection * 0.2 : 
              tiltFactor * curveTiltDirection * 0.2;
          
          // タイヤの高さを設定
          wheelGroup.position.y = wheelBaseHeight + wheelTiltOffset;
      }
  }
  
  updateSpeed() {
      // 現在のカーブ強度を取得
      const currentCurvature = this.calculateCurvature(this.position).angle;
      
      // 前方のカーブ強度を予測
      const upcomingCurvature = this.predictUpcomingCurve(this.position, 0.05);
      
      // カーブ強度に基づいて目標速度を計算
      const maxCurveAngle = 0.5;
      const curvatureToSpeedRatio = 0.5;
      const curvatureSpeedFactor = 1.0 - Math.min(1.0, Math.abs(upcomingCurvature) / maxCurveAngle) * curvatureToSpeedRatio;
      this.targetSpeed = this.MAX_SPEED * curvatureSpeedFactor;
      
      // 速度を目標に近づける
      if (this.speed < this.targetSpeed) {
          this.speed = Math.min(this.targetSpeed, this.speed + this.ACCELERATION_RATE);
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
}