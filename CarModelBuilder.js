// CarModelBuilder.js
import { pickDriverName } from './CarConstants.js';

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

export function buildCarModel(car) {
    const carGroup = new THREE.Group();

    // === 車種選択 ===
    const carTypeIndex = Math.floor(Math.random() * 4); // 0:ランボ 1:コルベット 2:スープラ 3:GRヤリス
    const carTypeNames = ['ランボルギーニ', 'コルベット', 'スープラ', 'GRヤリス'];

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
        // GRヤリス
        [
            { name: 'スーパーホワイトII', body: 0xF0F0F0 },
            { name: 'エモーショナルレッドII', body: 0xCC1122 },
            { name: 'プレシャスブラックパール', body: 0x1A1A2A },
            { name: 'プラチナホワイトパール', body: 0xE8E8E0 },
            { name: 'アッシュ', body: 0x666670 },
        ],
    ];

    const selectedColor = colorSets[carTypeIndex][Math.floor(Math.random() * colorSets[carTypeIndex].length)];
    car.bodyColor = selectedColor.body;
    car.driverName = pickDriverName();
    log(`車種: ${carTypeNames[carTypeIndex]} / カラー: ${selectedColor.name} / ライン: ${car.drivingStyle.lineStrategy}`);

    // === 共通マテリアル ===
    const bodyMat = new THREE.MeshPhongMaterial({ color: selectedColor.body, shininess: 120, specular: 0x444444 });
    const glassMat = new THREE.MeshPhongMaterial({ color: 0x88CCFF, transparent: true, opacity: 0.0, shininess: 200, specular: 0xFFFFFF });
    const carbonMat = new THREE.MeshPhongMaterial({ color: 0x222222, shininess: 40, specular: 0x333333 });
    const darkMat = new THREE.MeshPhongMaterial({ color: 0x111111, shininess: 30 });
    const chromeMat = new THREE.MeshPhongMaterial({ color: 0xCCCCCC, shininess: 250, specular: 0xFFFFFF });
    const hlMat = new THREE.MeshPhongMaterial({ color: 0xFFFFFF, emissive: 0xFFFFFF, emissiveIntensity: 0.8, shininess: 200, transparent: true, opacity: 0.9 });
    const tlMat = new THREE.MeshPhongMaterial({ color: 0xFF0000, emissive: 0xFF0000, emissiveIntensity: 0.5, shininess: 100 });
    const exhaustMat = new THREE.MeshPhongMaterial({ color: 0x888888, shininess: 200, specular: 0xFFFFFF });

    // 各車種で使う共通値
    let frontEnd, rearEnd, trackW;

    // ============================================================
    // ランボルギーニ・ウラカンEVO風：低い曲線ボディ・ファストバックライン
    // ============================================================
    if (carTypeIndex === 0) {
        trackW = 1.25;
        frontEnd = -3.2;
        rearEnd = 2.4;

        // フラットな底板
        const floorGeo = new THREE.BoxGeometry(2.7, 0.06, 5.8);
        const floor = new THREE.Mesh(floorGeo, darkMat);
        floor.position.set(0, 0.28, -0.4);
        carGroup.add(floor);

        // メインボディ：曲線的なウェッジシェイプ（フロントが低くリアへ滑らかに上がる）
        const bodyShape = new THREE.Shape();
        bodyShape.moveTo(-1.35, 0);
        bodyShape.lineTo(1.35, 0);
        bodyShape.quadraticCurveTo(1.38, 0.12, 1.3, 0.2);
        bodyShape.lineTo(-1.3, 0.2);
        bodyShape.quadraticCurveTo(-1.38, 0.12, -1.35, 0);
        bodyShape.closePath();
        const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: 5.6, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.08, bevelSegments: 4 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(0, 0.32, -3.1);
        carGroup.add(body);

        // フロントノーズ：鋭く尖った楔形（曲線で滑らかに）
        const noseShape = new THREE.Shape();
        noseShape.moveTo(-1.25, 0);
        noseShape.quadraticCurveTo(-0.3, 0, 0, 0.03);
        noseShape.quadraticCurveTo(0.3, 0, 1.25, 0);
        noseShape.lineTo(1.2, 0.1);
        noseShape.quadraticCurveTo(0, 0.14, -1.2, 0.1);
        noseShape.closePath();
        const noseGeo = new THREE.ExtrudeGeometry(noseShape, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 3 });
        const nose = new THREE.Mesh(noseGeo, bodyMat);
        nose.position.set(0, 0.32, -3.6);
        carGroup.add(nose);

        // リアのエンジンカバー（膨らみのある曲面）
        const engineShape = new THREE.Shape();
        engineShape.moveTo(-1.15, 0);
        engineShape.lineTo(1.15, 0);
        engineShape.quadraticCurveTo(1.2, 0.2, 1.0, 0.35);
        engineShape.quadraticCurveTo(0.5, 0.42, 0, 0.44);
        engineShape.quadraticCurveTo(-0.5, 0.42, -1.0, 0.35);
        engineShape.quadraticCurveTo(-1.2, 0.2, -1.15, 0);
        engineShape.closePath();
        const engineGeo = new THREE.ExtrudeGeometry(engineShape, { depth: 2.4, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 4 });
        const engine = new THREE.Mesh(engineGeo, bodyMat);
        engine.position.set(0, 0.52, 0.0);
        carGroup.add(engine);

        // キャビン：流線形ファストバックライン（ルーフからリアへ滑らかに下がる）
        const cabShape = new THREE.Shape();
        cabShape.moveTo(-0.78, 0);
        cabShape.lineTo(0.78, 0);
        cabShape.quadraticCurveTo(0.8, 0.18, 0.7, 0.3);
        cabShape.quadraticCurveTo(0.4, 0.38, 0, 0.4);
        cabShape.quadraticCurveTo(-0.4, 0.38, -0.7, 0.3);
        cabShape.quadraticCurveTo(-0.8, 0.18, -0.78, 0);
        cabShape.closePath();
        const cabGeo = new THREE.ExtrudeGeometry(cabShape, { depth: 1.6, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 4 });
        const cab = new THREE.Mesh(cabGeo, bodyMat);
        cab.position.set(0, 0.52, -1.6);
        carGroup.add(cab);

        // フロントガラス（非常に寝ている・曲面的）
        const wsGeo = new THREE.BoxGeometry(1.5, 0.03, 1.1);
        const ws = new THREE.Mesh(wsGeo, glassMat);
        ws.position.set(0, 0.8, -1.8);
        ws.rotation.x = 0.85;
        carGroup.add(ws);

        // サイドウィンドウ（薄く・曲線的に見えるよう傾斜）
        [-1, 1].forEach(side => {
            const swGeo = new THREE.BoxGeometry(0.03, 0.24, 1.3);
            const sw = new THREE.Mesh(swGeo, glassMat);
            sw.position.set(side * 0.8, 0.76, -0.85);
            sw.rotation.z = side * 0.08;
            carGroup.add(sw);
        });

        // フロントスプリッター（低く幅広）
        const splGeo = new THREE.BoxGeometry(2.7, 0.03, 0.5);
        const spl = new THREE.Mesh(splGeo, carbonMat);
        spl.position.set(0, 0.26, -3.5);
        carGroup.add(spl);

        // サイドスカート（地面に近い流線形ライン）
        [-1, 1].forEach(side => {
            const skGeo = new THREE.BoxGeometry(0.06, 0.12, 4.0);
            const sk = new THREE.Mesh(skGeo, carbonMat);
            sk.position.set(side * 1.38, 0.34, -0.4);
            carGroup.add(sk);
        });

        // サイドインテーク（六角形風の大きな開口）
        [-1, 1].forEach(side => {
            const intShape = new THREE.Shape();
            intShape.moveTo(0, 0);
            intShape.lineTo(0, 0.3);
            intShape.lineTo(0.06, 0.32);
            intShape.lineTo(0.06, -0.02);
            intShape.closePath();
            const intGeo = new THREE.ExtrudeGeometry(intShape, { depth: 1.2, bevelEnabled: false });
            const intake = new THREE.Mesh(intGeo, darkMat);
            intake.position.set(side * 1.32, 0.38, -0.2);
            carGroup.add(intake);
        });

        // フェンダー（曲面的な張り出し）
        [-1, 1].forEach(side => {
            // フロントフェンダー
            const ffShape = new THREE.Shape();
            ffShape.moveTo(0, 0);
            ffShape.quadraticCurveTo(0.12, 0.15, 0, 0.22);
            ffShape.lineTo(-0.05, 0.22);
            ffShape.quadraticCurveTo(0.05, 0.12, -0.05, 0);
            ffShape.closePath();
            const ffGeo = new THREE.ExtrudeGeometry(ffShape, { depth: 1.5, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02, bevelSegments: 3 });
            const ff = new THREE.Mesh(ffGeo, bodyMat);
            ff.position.set(side * 1.3, 0.38, -2.3);
            carGroup.add(ff);
            // リアフェンダー（より大きく膨らむ）
            const rfShape = new THREE.Shape();
            rfShape.moveTo(0, 0);
            rfShape.quadraticCurveTo(0.16, 0.18, 0, 0.28);
            rfShape.lineTo(-0.06, 0.28);
            rfShape.quadraticCurveTo(0.06, 0.15, -0.06, 0);
            rfShape.closePath();
            const rfGeo = new THREE.ExtrudeGeometry(rfShape, { depth: 1.8, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 3 });
            const rf = new THREE.Mesh(rfGeo, bodyMat);
            rf.position.set(side * 1.32, 0.38, 0.6);
            carGroup.add(rf);
        });

        // リアウイング（控えめ、EVO風リップ）
        const wingGeo = new THREE.BoxGeometry(2.0, 0.04, 0.35);
        const wing = new THREE.Mesh(wingGeo, carbonMat);
        wing.position.set(0, 0.82, 2.2);
        wing.rotation.x = -0.08;
        carGroup.add(wing);

        // エンジンカバーのエアインテーク（Y字スリット）
        [-1, 1].forEach(side => {
            const slitGeo = new THREE.BoxGeometry(0.4, 0.03, 1.0);
            const slit = new THREE.Mesh(slitGeo, darkMat);
            slit.position.set(side * 0.4, 0.97, 1.2);
            slit.rotation.z = side * 0.05;
            carGroup.add(slit);
        });

        // 4本エキゾースト（中央集中型）
        for (let i = 0; i < 4; i++) {
            const exGeo = new THREE.CylinderGeometry(0.055, 0.07, 0.2, 10);
            const ex = new THREE.Mesh(exGeo, exhaustMat);
            ex.position.set((i - 1.5) * 0.2, 0.36, rearEnd + 0.15);
            ex.rotation.x = Math.PI / 2;
            carGroup.add(ex);
        }

        // ヘッドライト（鋭くY字型・ウラカンEVO特有）
        [-1, 1].forEach(side => {
            const hlGeo = new THREE.BoxGeometry(0.55, 0.06, 0.12);
            const hl = new THREE.Mesh(hlGeo, hlMat);
            hl.position.set(side * 0.6, 0.43, -3.45);
            carGroup.add(hl);
            // DRL（Y字の上部ライン）
            const drlGeo = new THREE.BoxGeometry(0.3, 0.03, 0.08);
            const drl = new THREE.Mesh(drlGeo, hlMat);
            drl.position.set(side * 0.75, 0.48, -3.35);
            drl.rotation.z = side * -0.3;
            carGroup.add(drl);
        });

        // テールライト（横一文字・ウラカンEVO風）
        const tailGeo = new THREE.BoxGeometry(2.1, 0.05, 0.05);
        const tail = new THREE.Mesh(tailGeo, tlMat);
        tail.position.set(0, 0.62, rearEnd + 0.1);
        carGroup.add(tail);

        // ディフューザー（大型・フィン付き）
        const diffGeo = new THREE.BoxGeometry(2.2, 0.08, 0.55);
        const diff = new THREE.Mesh(diffGeo, carbonMat);
        diff.position.set(0, 0.24, rearEnd - 0.1);
        carGroup.add(diff);
        for (let i = -3; i <= 3; i++) {
            const finGeo = new THREE.BoxGeometry(0.025, 0.08, 0.5);
            const fin = new THREE.Mesh(finGeo, carbonMat);
            fin.position.set(i * 0.22, 0.26, rearEnd - 0.1);
            carGroup.add(fin);
        }
    }

    // ============================================================
    // コルベット C8.R風：ミッドシップGTレーサー・ワイド＆アグレッシブ
    // ============================================================
    else if (carTypeIndex === 1) {
        trackW = 1.2;
        frontEnd = -3.1;
        rearEnd = 2.5;

        // フラット底板
        const floorGeo = new THREE.BoxGeometry(2.5, 0.06, 5.8);
        const floor = new THREE.Mesh(floorGeo, darkMat);
        floor.position.set(0, 0.28, -0.3);
        carGroup.add(floor);

        // メインボディ：低くワイド、筋肉質な曲面
        const bodyShape = new THREE.Shape();
        bodyShape.moveTo(-1.25, 0);
        bodyShape.lineTo(1.25, 0);
        bodyShape.quadraticCurveTo(1.3, 0.15, 1.2, 0.25);
        bodyShape.lineTo(-1.2, 0.25);
        bodyShape.quadraticCurveTo(-1.3, 0.15, -1.25, 0);
        bodyShape.closePath();
        const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: 5.6, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.08, bevelSegments: 4 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(0, 0.3, -3.0);
        carGroup.add(body);

        // フロントノーズ：低くアグレッシブ、大開口
        const noseShape = new THREE.Shape();
        noseShape.moveTo(-1.15, 0);
        noseShape.quadraticCurveTo(-0.3, 0.01, 0, 0.04);
        noseShape.quadraticCurveTo(0.3, 0.01, 1.15, 0);
        noseShape.lineTo(1.05, 0.15);
        noseShape.quadraticCurveTo(0, 0.2, -1.05, 0.15);
        noseShape.closePath();
        const noseGeo = new THREE.ExtrudeGeometry(noseShape, { depth: 1.2, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 3 });
        const nose = new THREE.Mesh(noseGeo, bodyMat);
        nose.position.set(0, 0.3, -3.6);
        carGroup.add(nose);

        // フロントグリル（大開口ダーク）
        const grillGeo = new THREE.BoxGeometry(1.8, 0.12, 0.06);
        const grill = new THREE.Mesh(grillGeo, darkMat);
        grill.position.set(0, 0.38, -3.65);
        carGroup.add(grill);

        // キャビン：前寄りミッドシップ配置、低く流線形
        const cabShape = new THREE.Shape();
        cabShape.moveTo(-0.78, 0);
        cabShape.lineTo(0.78, 0);
        cabShape.quadraticCurveTo(0.82, 0.25, 0.65, 0.42);
        cabShape.quadraticCurveTo(0.35, 0.48, 0, 0.5);
        cabShape.quadraticCurveTo(-0.35, 0.48, -0.65, 0.42);
        cabShape.quadraticCurveTo(-0.82, 0.25, -0.78, 0);
        cabShape.closePath();
        const cabGeo = new THREE.ExtrudeGeometry(cabShape, { depth: 1.5, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 4 });
        const cab = new THREE.Mesh(cabGeo, bodyMat);
        cab.position.set(0, 0.55, -1.8);
        carGroup.add(cab);

        // リアエンジンカバー（ミッドシップ、大きく膨らむ曲面）
        const rearShape = new THREE.Shape();
        rearShape.moveTo(-1.2, 0);
        rearShape.lineTo(1.2, 0);
        rearShape.quadraticCurveTo(1.25, 0.2, 1.05, 0.35);
        rearShape.quadraticCurveTo(0.5, 0.42, 0, 0.44);
        rearShape.quadraticCurveTo(-0.5, 0.42, -1.05, 0.35);
        rearShape.quadraticCurveTo(-1.25, 0.2, -1.2, 0);
        rearShape.closePath();
        const rearGeo = new THREE.ExtrudeGeometry(rearShape, { depth: 2.2, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 4 });
        const rear = new THREE.Mesh(rearGeo, bodyMat);
        rear.position.set(0, 0.55, 0.2);
        carGroup.add(rear);

        // フロントガラス（寝ている）
        const wsGeo = new THREE.BoxGeometry(1.5, 0.03, 1.0);
        const ws = new THREE.Mesh(wsGeo, glassMat);
        ws.position.set(0, 0.88, -1.9);
        ws.rotation.x = 0.8;
        carGroup.add(ws);

        // リアウィンドウ（急傾斜ファストバック）
        const rwGeo = new THREE.BoxGeometry(1.3, 0.03, 0.8);
        const rw = new THREE.Mesh(rwGeo, glassMat);
        rw.position.set(0, 0.88, -0.1);
        rw.rotation.x = -0.6;
        carGroup.add(rw);

        // サイドウィンドウ
        [-1, 1].forEach(side => {
            const swGeo = new THREE.BoxGeometry(0.03, 0.3, 1.4);
            const sw = new THREE.Mesh(swGeo, glassMat);
            sw.position.set(side * 0.82, 0.82, -1.0);
            sw.rotation.z = side * 0.06;
            carGroup.add(sw);
        });

        // 大型フロントスプリッター
        const splGeo = new THREE.BoxGeometry(2.6, 0.04, 0.5);
        const spl = new THREE.Mesh(splGeo, carbonMat);
        spl.position.set(0, 0.26, -3.5);
        carGroup.add(spl);

        // フロントカナード
        [-1, 1].forEach(side => {
            const canGeo = new THREE.BoxGeometry(0.4, 0.03, 0.2);
            const can = new THREE.Mesh(canGeo, carbonMat);
            can.position.set(side * 1.1, 0.34, -3.3);
            can.rotation.z = side * -0.1;
            carGroup.add(can);
        });

        // ワイドフェンダー（曲面的な大きな張り出し）
        [-1, 1].forEach(side => {
            // フロント
            const ffShape = new THREE.Shape();
            ffShape.moveTo(0, 0);
            ffShape.quadraticCurveTo(0.14, 0.16, 0, 0.26);
            ffShape.lineTo(-0.06, 0.26);
            ffShape.quadraticCurveTo(0.06, 0.14, -0.06, 0);
            ffShape.closePath();
            const ffGeo = new THREE.ExtrudeGeometry(ffShape, { depth: 1.6, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02, bevelSegments: 3 });
            const ff = new THREE.Mesh(ffGeo, bodyMat);
            ff.position.set(side * 1.22, 0.34, -2.5);
            carGroup.add(ff);
            // リア（GTカーらしく大きく膨らむ）
            const rfShape = new THREE.Shape();
            rfShape.moveTo(0, 0);
            rfShape.quadraticCurveTo(0.18, 0.2, 0, 0.32);
            rfShape.lineTo(-0.07, 0.32);
            rfShape.quadraticCurveTo(0.08, 0.17, -0.07, 0);
            rfShape.closePath();
            const rfGeo = new THREE.ExtrudeGeometry(rfShape, { depth: 1.9, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 3 });
            const rf = new THREE.Mesh(rfGeo, bodyMat);
            rf.position.set(side * 1.25, 0.34, 0.5);
            carGroup.add(rf);
        });

        // サイドスカート（地面近く）
        [-1, 1].forEach(side => {
            const skGeo = new THREE.BoxGeometry(0.06, 0.1, 3.8);
            const sk = new THREE.Mesh(skGeo, carbonMat);
            sk.position.set(side * 1.3, 0.32, -0.4);
            carGroup.add(sk);
        });

        // 大型サイドインテーク（C8.R特有の巨大開口）
        [-1, 1].forEach(side => {
            const intShape = new THREE.Shape();
            intShape.moveTo(0, 0);
            intShape.lineTo(0, 0.28);
            intShape.lineTo(0.07, 0.3);
            intShape.lineTo(0.07, -0.02);
            intShape.closePath();
            const intGeo = new THREE.ExtrudeGeometry(intShape, { depth: 1.4, bevelEnabled: false });
            const intake = new THREE.Mesh(intGeo, darkMat);
            intake.position.set(side * 1.28, 0.38, -0.1);
            carGroup.add(intake);
        });

        // 大型リアウイング（GT風・高い位置）
        const wingGeo = new THREE.BoxGeometry(2.3, 0.05, 0.4);
        const wing = new THREE.Mesh(wingGeo, carbonMat);
        wing.position.set(0, 1.15, 2.1);
        wing.rotation.x = -0.1;
        carGroup.add(wing);
        // ウイングステー
        [-1, 1].forEach(side => {
            const stayGeo = new THREE.BoxGeometry(0.05, 0.4, 0.06);
            const stay = new THREE.Mesh(stayGeo, carbonMat);
            stay.position.set(side * 1.0, 0.95, 2.1);
            carGroup.add(stay);
            // ウイングエンドプレート
            const epGeo = new THREE.BoxGeometry(0.05, 0.3, 0.5);
            const ep = new THREE.Mesh(epGeo, carbonMat);
            ep.position.set(side * 1.15, 1.1, 2.1);
            carGroup.add(ep);
        });

        // エンジンカバーのエアアウトレット
        [-1, 1].forEach(side => {
            const ventGeo = new THREE.BoxGeometry(0.35, 0.03, 0.8);
            const vent = new THREE.Mesh(ventGeo, darkMat);
            vent.position.set(side * 0.45, 1.0, 1.2);
            carGroup.add(vent);
        });

        // 4本エキゾースト（中央上方出し・GT風）
        for (let i = 0; i < 4; i++) {
            const exGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.25, 10);
            const ex = new THREE.Mesh(exGeo, exhaustMat);
            ex.position.set((i - 1.5) * 0.2, 0.5, rearEnd + 0.12);
            ex.rotation.x = Math.PI / 2;
            carGroup.add(ex);
        }

        // ヘッドライト（シャープな横長）
        [-1, 1].forEach(side => {
            const hlGeo = new THREE.BoxGeometry(0.5, 0.08, 0.12);
            const hl = new THREE.Mesh(hlGeo, hlMat);
            hl.position.set(side * 0.6, 0.44, -3.5);
            carGroup.add(hl);
        });

        // テールライト（C8.R風・縦型ダブル）
        [-1, 1].forEach(side => {
            const tailGeo = new THREE.BoxGeometry(0.12, 0.2, 0.05);
            const tail = new THREE.Mesh(tailGeo, tlMat);
            tail.position.set(side * 0.55, 0.7, rearEnd + 0.1);
            carGroup.add(tail);
            const tail2Geo = new THREE.BoxGeometry(0.12, 0.2, 0.05);
            const tail2 = new THREE.Mesh(tail2Geo, tlMat);
            tail2.position.set(side * 0.35, 0.7, rearEnd + 0.1);
            carGroup.add(tail2);
        });

        // 大型ディフューザー（GTカー風・フィン多数）
        const diffGeo = new THREE.BoxGeometry(2.3, 0.1, 0.6);
        const diff = new THREE.Mesh(diffGeo, carbonMat);
        diff.position.set(0, 0.24, rearEnd - 0.1);
        carGroup.add(diff);
        for (let i = -4; i <= 4; i++) {
            const finGeo = new THREE.BoxGeometry(0.025, 0.1, 0.55);
            const fin = new THREE.Mesh(finGeo, carbonMat);
            fin.position.set(i * 0.18, 0.26, rearEnd - 0.1);
            carGroup.add(fin);
        }
    }

    // ============================================================
    // スープラ風：丸みのあるグラマラスボディ、FRプロポーション
    // ============================================================
    else if (carTypeIndex === 2) {
        trackW = 1.1;
        frontEnd = -2.8;
        rearEnd = 2.3;

        // フロア
        const floorGeo = new THREE.BoxGeometry(2.3, 0.08, 5.3);
        const floor = new THREE.Mesh(floorGeo, darkMat);
        floor.position.set(0, 0.32, -0.25);
        carGroup.add(floor);

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
        carGroup.add(body);

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
        carGroup.add(nose);

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
        carGroup.add(cab);

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
        carGroup.add(rear);

        // フロントガラス（きれいな曲面風）
        const wsGeo = new THREE.BoxGeometry(1.6, 0.04, 1.1);
        const ws = new THREE.Mesh(wsGeo, glassMat);
        ws.position.set(0, 1.1, -1.4);
        ws.rotation.x = 0.75;
        carGroup.add(ws);

        // リアウィンドウ
        const rwGeo = new THREE.BoxGeometry(1.3, 0.04, 0.9);
        const rw = new THREE.Mesh(rwGeo, glassMat);
        rw.position.set(0, 1.1, 0.5);
        rw.rotation.x = -0.45;
        carGroup.add(rw);

        // サイドウィンドウ
        [-1, 1].forEach(side => {
            const swGeo = new THREE.BoxGeometry(0.04, 0.4, 1.3);
            const sw = new THREE.Mesh(swGeo, glassMat);
            sw.position.set(side * 0.83, 0.98, -0.4);
            carGroup.add(sw);
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
            carGroup.add(ff);

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
            carGroup.add(rf);
        });

        // サイドスカート
        [-1, 1].forEach(side => {
            const skGeo = new THREE.BoxGeometry(0.06, 0.12, 3.0);
            const sk = new THREE.Mesh(skGeo, darkMat);
            sk.position.set(side * 1.15, 0.35, -0.4);
            carGroup.add(sk);
        });

        // FRPフロントリップ
        const lipGeo = new THREE.BoxGeometry(2.1, 0.04, 0.3);
        const lip = new THREE.Mesh(lipGeo, darkMat);
        lip.position.set(0, 0.3, frontEnd - 0.3);
        carGroup.add(lip);

        // 大型グリル（スープラ特有の大開口）
        const grillGeo = new THREE.BoxGeometry(1.4, 0.25, 0.06);
        const grill = new THREE.Mesh(grillGeo, darkMat);
        grill.position.set(0, 0.48, frontEnd - 0.25);
        carGroup.add(grill);

        // GTウイング（高い位置）
        const wingGeo = new THREE.BoxGeometry(1.8, 0.05, 0.35);
        const wing = new THREE.Mesh(wingGeo, carbonMat);
        wing.position.set(0, 1.25, 1.9);
        wing.rotation.x = -0.12;
        carGroup.add(wing);
        // サポートピラー
        [-1, 1].forEach(side => {
            const pilGeo = new THREE.BoxGeometry(0.08, 0.5, 0.1);
            const pil = new THREE.Mesh(pilGeo, chromeMat);
            pil.position.set(side * 0.6, 1.0, 1.85);
            carGroup.add(pil);
        });
        // ガーニーフラップ
        const gurneyGeo = new THREE.BoxGeometry(1.8, 0.1, 0.03);
        const gurney = new THREE.Mesh(gurneyGeo, carbonMat);
        gurney.position.set(0, 1.28, 2.1);
        carGroup.add(gurney);

        // 2本エキゾースト（太め）
        [-1, 1].forEach(side => {
            const exGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.3, 10);
            const ex = new THREE.Mesh(exGeo, exhaustMat);
            ex.position.set(side * 0.45, 0.38, rearEnd + 0.15);
            ex.rotation.x = Math.PI / 2;
            carGroup.add(ex);
        });

        // サイドエアインテーク（ドア後方）
        [-1, 1].forEach(side => {
            const intGeo = new THREE.BoxGeometry(0.05, 0.2, 0.6);
            const int1 = new THREE.Mesh(intGeo, darkMat);
            int1.position.set(side * 1.15, 0.6, 0.3);
            carGroup.add(int1);
        });

        // ヘッドライト（スリムで丸み）
        [-1, 1].forEach(side => {
            const hlGeo = new THREE.BoxGeometry(0.45, 0.12, 0.2);
            const hl = new THREE.Mesh(hlGeo, hlMat);
            hl.position.set(side * 0.55, 0.55, frontEnd - 0.15);
            carGroup.add(hl);
            // DRL
            const drlGeo = new THREE.BoxGeometry(0.35, 0.03, 0.04);
            const drlMat2 = new THREE.MeshPhongMaterial({ color: 0xCCEEFF, emissive: 0xCCEEFF, emissiveIntensity: 0.6 });
            const drl = new THREE.Mesh(drlGeo, drlMat2);
            drl.position.set(side * 0.55, 0.49, frontEnd - 0.2);
            carGroup.add(drl);
        });

        // テールライト（横長バー型）
        const tailGeo = new THREE.BoxGeometry(1.8, 0.08, 0.06);
        const tail = new THREE.Mesh(tailGeo, tlMat);
        tail.position.set(0, 0.78, rearEnd + 0.1);
        carGroup.add(tail);

        // ディフューザー
        const diffGeo = new THREE.BoxGeometry(1.8, 0.08, 0.45);
        const diff = new THREE.Mesh(diffGeo, carbonMat);
        diff.position.set(0, 0.28, rearEnd - 0.1);
        carGroup.add(diff);
        for (let i = -2; i <= 2; i++) {
            const finGeo = new THREE.BoxGeometry(0.03, 0.08, 0.4);
            const fin = new THREE.Mesh(finGeo, carbonMat);
            fin.position.set(i * 0.25, 0.3, rearEnd - 0.1);
            carGroup.add(fin);
        }
    }

    // ============================================================
    // GRヤリス風：コンパクトホットハッチ・ワイドボディ・GTウイング
    // ============================================================
    else {
        trackW = 1.05;
        frontEnd = -2.5;
        rearEnd = 2.0;

        // フロア（コンパクト）
        const floorGeo = new THREE.BoxGeometry(2.2, 0.06, 4.7);
        const floor = new THREE.Mesh(floorGeo, darkMat);
        floor.position.set(0, 0.3, -0.25);
        carGroup.add(floor);

        // メインボディ：コンパクトだが幅広、ハッチバック形状
        const bodyShape = new THREE.Shape();
        bodyShape.moveTo(-1.1, 0);
        bodyShape.lineTo(1.1, 0);
        bodyShape.quadraticCurveTo(1.15, 0.18, 1.05, 0.3);
        bodyShape.lineTo(-1.05, 0.3);
        bodyShape.quadraticCurveTo(-1.15, 0.18, -1.1, 0);
        bodyShape.closePath();
        const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: 4.6, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.08, bevelSegments: 4 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(0, 0.32, -2.6);
        carGroup.add(body);

        // フロントノーズ（低く攻撃的、大開口グリル）
        const noseShape = new THREE.Shape();
        noseShape.moveTo(-1.05, 0);
        noseShape.quadraticCurveTo(0, 0.02, 1.05, 0);
        noseShape.lineTo(0.95, 0.2);
        noseShape.quadraticCurveTo(0, 0.25, -0.95, 0.2);
        noseShape.closePath();
        const noseGeo = new THREE.ExtrudeGeometry(noseShape, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 3 });
        const nose = new THREE.Mesh(noseGeo, bodyMat);
        nose.position.set(0, 0.32, -2.9);
        carGroup.add(nose);

        // フロントグリル（大型メッシュ風）
        const grillGeo = new THREE.BoxGeometry(1.6, 0.18, 0.05);
        const grill = new THREE.Mesh(grillGeo, darkMat);
        grill.position.set(0, 0.42, -2.95);
        carGroup.add(grill);

        // カーボンボンネット
        const hoodGeo = new THREE.BoxGeometry(1.8, 0.04, 2.0);
        const hood = new THREE.Mesh(hoodGeo, carbonMat);
        hood.position.set(0, 0.62, -1.6);
        hood.rotation.x = -0.03;
        carGroup.add(hood);

        // ボンネットエアインテーク
        const hoodIntGeo = new THREE.BoxGeometry(0.6, 0.06, 0.5);
        const hoodInt = new THREE.Mesh(hoodIntGeo, darkMat);
        hoodInt.position.set(0, 0.65, -1.8);
        carGroup.add(hoodInt);

        // キャビン：ハッチバック形状（高め、前方に位置）
        const cabShape = new THREE.Shape();
        cabShape.moveTo(-0.72, 0);
        cabShape.lineTo(0.72, 0);
        cabShape.quadraticCurveTo(0.75, 0.3, 0.6, 0.48);
        cabShape.quadraticCurveTo(0.3, 0.54, 0, 0.55);
        cabShape.quadraticCurveTo(-0.3, 0.54, -0.6, 0.48);
        cabShape.quadraticCurveTo(-0.75, 0.3, -0.72, 0);
        cabShape.closePath();
        const cabGeo = new THREE.ExtrudeGeometry(cabShape, { depth: 1.8, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 4 });
        const cab = new THREE.Mesh(cabGeo, bodyMat);
        cab.position.set(0, 0.62, -1.2);
        carGroup.add(cab);

        // リアハッチ（短く急傾斜で落ちる）
        const hatchShape = new THREE.Shape();
        hatchShape.moveTo(-0.95, 0);
        hatchShape.lineTo(0.95, 0);
        hatchShape.quadraticCurveTo(0.98, 0.12, 0.9, 0.2);
        hatchShape.lineTo(-0.9, 0.2);
        hatchShape.quadraticCurveTo(-0.98, 0.12, -0.95, 0);
        hatchShape.closePath();
        const hatchGeo = new THREE.ExtrudeGeometry(hatchShape, { depth: 1.2, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.04, bevelSegments: 3 });
        const hatch = new THREE.Mesh(hatchGeo, bodyMat);
        hatch.position.set(0, 0.62, 0.6);
        carGroup.add(hatch);

        // フロントガラス
        const wsGeo = new THREE.BoxGeometry(1.4, 0.03, 0.9);
        const ws = new THREE.Mesh(wsGeo, glassMat);
        ws.position.set(0, 0.95, -1.3);
        ws.rotation.x = 0.65;
        carGroup.add(ws);

        // リアウィンドウ（急傾斜ハッチ）
        const rwGeo = new THREE.BoxGeometry(1.2, 0.03, 0.7);
        const rw = new THREE.Mesh(rwGeo, glassMat);
        rw.position.set(0, 0.95, 0.8);
        rw.rotation.x = -0.55;
        carGroup.add(rw);

        // サイドウィンドウ
        [-1, 1].forEach(side => {
            const swGeo = new THREE.BoxGeometry(0.03, 0.32, 1.5);
            const sw = new THREE.Mesh(swGeo, glassMat);
            sw.position.set(side * 0.75, 0.9, -0.3);
            carGroup.add(sw);
        });

        // フロントスプリッター（大型カーボン）
        const splGeo = new THREE.BoxGeometry(2.3, 0.04, 0.4);
        const spl = new THREE.Mesh(splGeo, carbonMat);
        spl.position.set(0, 0.28, -2.8);
        carGroup.add(spl);

        // フロントカナード
        [-1, 1].forEach(side => {
            const canGeo = new THREE.BoxGeometry(0.35, 0.03, 0.18);
            const can = new THREE.Mesh(canGeo, carbonMat);
            can.position.set(side * 0.95, 0.35, -2.6);
            can.rotation.z = side * -0.15;
            carGroup.add(can);
        });

        // ワイドオーバーフェンダー（ホットハッチ特有の張り出し）
        [-1, 1].forEach(side => {
            // フロント
            const ffShape = new THREE.Shape();
            ffShape.moveTo(0, 0);
            ffShape.quadraticCurveTo(0.12, 0.14, 0, 0.22);
            ffShape.lineTo(-0.05, 0.22);
            ffShape.quadraticCurveTo(0.05, 0.12, -0.05, 0);
            ffShape.closePath();
            const ffGeo = new THREE.ExtrudeGeometry(ffShape, { depth: 1.2, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02, bevelSegments: 3 });
            const ff = new THREE.Mesh(ffGeo, bodyMat);
            ff.position.set(side * 1.08, 0.38, -1.8);
            carGroup.add(ff);
            // リア（さらにワイド）
            const rfShape = new THREE.Shape();
            rfShape.moveTo(0, 0);
            rfShape.quadraticCurveTo(0.15, 0.16, 0, 0.26);
            rfShape.lineTo(-0.06, 0.26);
            rfShape.quadraticCurveTo(0.06, 0.14, -0.06, 0);
            rfShape.closePath();
            const rfGeo = new THREE.ExtrudeGeometry(rfShape, { depth: 1.3, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 3 });
            const rf = new THREE.Mesh(rfGeo, bodyMat);
            rf.position.set(side * 1.12, 0.38, 0.4);
            carGroup.add(rf);
        });

        // サイドスカート
        [-1, 1].forEach(side => {
            const skGeo = new THREE.BoxGeometry(0.06, 0.1, 3.0);
            const sk = new THREE.Mesh(skGeo, carbonMat);
            sk.position.set(side * 1.15, 0.32, -0.3);
            carGroup.add(sk);
        });

        // サイドスプリッター（マッドフラップ風）
        [-1, 1].forEach(side => {
            const mudGeo = new THREE.BoxGeometry(0.15, 0.2, 0.03);
            const mud = new THREE.Mesh(mudGeo, carbonMat);
            mud.position.set(side * 1.1, 0.38, 1.3);
            carGroup.add(mud);
        });

        // 大型GTウイング（高い位置）
        const wingGeo = new THREE.BoxGeometry(2.0, 0.05, 0.35);
        const wing = new THREE.Mesh(wingGeo, carbonMat);
        wing.position.set(0, 1.45, 1.5);
        wing.rotation.x = -0.12;
        carGroup.add(wing);
        // ウイングステー（2本）
        [-1, 1].forEach(side => {
            const stayGeo = new THREE.BoxGeometry(0.05, 0.35, 0.06);
            const stay = new THREE.Mesh(stayGeo, carbonMat);
            stay.position.set(side * 0.7, 1.28, 1.5);
            carGroup.add(stay);
            // エンドプレート
            const epGeo = new THREE.BoxGeometry(0.04, 0.25, 0.4);
            const ep = new THREE.Mesh(epGeo, carbonMat);
            ep.position.set(side * 1.0, 1.4, 1.5);
            carGroup.add(ep);
        });

        // デュアルエキゾースト（左右）
        [-1, 1].forEach(side => {
            const exGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.2, 10);
            const ex = new THREE.Mesh(exGeo, exhaustMat);
            ex.position.set(side * 0.4, 0.36, rearEnd + 0.12);
            ex.rotation.x = Math.PI / 2;
            carGroup.add(ex);
        });

        // ヘッドライト（シャープ・鋭角）
        [-1, 1].forEach(side => {
            const hlGeo = new THREE.BoxGeometry(0.45, 0.1, 0.15);
            const hl = new THREE.Mesh(hlGeo, hlMat);
            hl.position.set(side * 0.55, 0.5, -2.75);
            carGroup.add(hl);
        });

        // テールライト（横長バー型）
        const tailGeo = new THREE.BoxGeometry(1.6, 0.08, 0.05);
        const tail = new THREE.Mesh(tailGeo, tlMat);
        tail.position.set(0, 0.72, rearEnd + 0.08);
        carGroup.add(tail);

        // ディフューザー
        const diffGeo = new THREE.BoxGeometry(1.8, 0.08, 0.4);
        const diff = new THREE.Mesh(diffGeo, carbonMat);
        diff.position.set(0, 0.26, rearEnd - 0.1);
        carGroup.add(diff);
        for (let i = -2; i <= 2; i++) {
            const finGeo = new THREE.BoxGeometry(0.025, 0.08, 0.35);
            const fin = new THREE.Mesh(finGeo, carbonMat);
            fin.position.set(i * 0.25, 0.28, rearEnd - 0.1);
            carGroup.add(fin);
        }
    }

    // === 共通：サイドミラー ===
    [-1, 1].forEach(side => {
        const mirGeo = new THREE.BoxGeometry(0.12, 0.08, 0.16);
        const mir = new THREE.Mesh(mirGeo, bodyMat);
        mir.position.set(side * 1.05, 0.9, -0.8);
        carGroup.add(mir);
        const stayGeo = new THREE.BoxGeometry(0.12, 0.03, 0.03);
        const stay = new THREE.Mesh(stayGeo, darkMat);
        stay.position.set(side * 0.98, 0.88, -0.8);
        carGroup.add(stay);
    });

    // === 共通：スポットライト ===
    const leftLight = new THREE.SpotLight(0xFFFFFF, 5.5, 50, Math.PI / 10, 0.3, 1);
    leftLight.position.set(0.6, 6.0, -2.0);
    leftLight.target.position.set(0.3, 0.0, -20);
    leftLight.visible = true;
    carGroup.add(leftLight);
    carGroup.add(leftLight.target);

    const rightLight = new THREE.SpotLight(0xFFFFFF, 5.5, 50, Math.PI / 10, 0.3, 1);
    rightLight.position.set(-0.6, 6.0, -2.0);
    rightLight.target.position.set(-0.3, 0.0, -20);
    rightLight.visible = true;
    carGroup.add(rightLight);
    carGroup.add(rightLight.target);

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
        carGroup.add(wheelGroup);
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
    carGroup.position.copy(car.carPath.getPointAt(0));
    carGroup.position.y = 1.0; // 地面からの高さ

    // 車の初期方向
    const initialTangent = car.carPath.getTangentAt(0);
    const initialDirection = new THREE.Vector3(initialTangent.x, 0, initialTangent.z).normalize();

    // 車の向きを設定（Y軸は常に上）
    const initialTarget = new THREE.Vector3().addVectors(carGroup.position, initialDirection);
    carGroup.lookAt(initialTarget);

    return { car: carGroup, wheels, wheelGroups, upVector, leftHeadlight: leftLight, rightHeadlight: rightLight };
}
