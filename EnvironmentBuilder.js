import { ctx } from './GameContext.js';

function log(message) { console.log(`[${new Date().toISOString()}] ${message}`); }

// 環境オブジェクトを配置
export function placeEnvironmentObjects() {
    log("環境オブジェクトの配置開始");

    // 街灯を配置
    createStreetlights();

    // 岩肌の構造物を配置
    createRockFormations();

    log("環境オブジェクトの配置完了");
}

// コース全周の連続地形メッシュを作成（リッジレーサー風）
function createRockFormations() {
    const terrainGroup = new THREE.Group();
    ctx.scene.add(terrainGroup);

    // シード付き乱数
    function seededRandom(seed) {
        const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
        return x - Math.floor(x);
    }

    // シンプルなノイズ関数（2Dバリューノイズ）
    function noise2D(x, z) {
        const ix = Math.floor(x);
        const iz = Math.floor(z);
        const fx = x - ix;
        const fz = z - iz;
        // スムーズステップ補間
        const ux = fx * fx * (3 - 2 * fx);
        const uz = fz * fz * (3 - 2 * fz);
        // 4隅の値
        const a = seededRandom(ix * 73.7 + iz * 157.3);
        const b = seededRandom((ix + 1) * 73.7 + iz * 157.3);
        const c = seededRandom(ix * 73.7 + (iz + 1) * 157.3);
        const d = seededRandom((ix + 1) * 73.7 + (iz + 1) * 157.3);
        return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
    }

    // フラクタルノイズ（オクターブ重ね）
    function fractalNoise(x, z, octaves, persistence, scale) {
        let total = 0;
        let amplitude = 1;
        let frequency = scale;
        let maxVal = 0;
        for (let i = 0; i < octaves; i++) {
            total += noise2D(x * frequency, z * frequency) * amplitude;
            maxVal += amplitude;
            amplitude *= persistence;
            frequency *= 2;
        }
        return total / maxVal;
    }

    // コース沿いの地形帯（strips）を両サイドに生成
    // 各帯: 道路端→外側に広がる複数リングの頂点
    const pathSegments = 200; // コース周方向の分割数
    const radialSteps = 6;   // 道路端から外側への帯数
    const radialDistances = [0, 5, 15, 30, 55, 90]; // 道路端からの距離
    const baseHeights =      [0, 2, 8, 18, 30, 40]; // 各帯の基本的な高さ上昇

    function createSideTerrain(side) {
        const vertices = [];
        const indices = [];
        const colors = [];

        // 頂点を生成
        for (let i = 0; i <= pathSegments; i++) {
            const t = (i / pathSegments) % 1;
            const point = ctx.carPath.getPointAt(t);
            const tangent = ctx.carPath.getTangentAt(t);
            const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

            for (let r = 0; r < radialSteps; r++) {
                const dist = ctx.roadWidth / 2 + 1.2 + radialDistances[r]; // ガードレール外側から
                const pos = new THREE.Vector3().addVectors(
                    point,
                    normal.clone().multiplyScalar(side * dist)
                );

                // 高さの計算
                let h = point.y;
                if (r === 0) {
                    // 道路端: 道路面とほぼ同じ高さ（少し下）
                    h = point.y - 0.5;
                } else {
                    // ノイズで自然な起伏を生成
                    const nx = pos.x * 0.008;
                    const nz = pos.z * 0.008;
                    const noiseVal = fractalNoise(nx, nz, 3, 0.5, 1.0);
                    // 基本高さ + ノイズによる変動
                    h = point.y - 2 + baseHeights[r] * (0.5 + noiseVal * 1.0);

                    // 高架部分は地形を下げない（柱が地面から出るように）
                    if (point.y > 3 && r >= 2) {
                        h = Math.min(h, point.y * 0.3);
                    }
                }

                vertices.push(pos.x, h, pos.z);

                // 頂点カラー（高さに応じて岩色を変化）
                const heightRatio = Math.min(1, Math.max(0, (h - point.y) / 35));
                const baseColor = new THREE.Color(0x6B5B4F); // 茶褐色
                const peakColor = new THREE.Color(0x8B7D6B); // 砂岩色
                const darkColor = new THREE.Color(0x4A3F35); // 暗い岩色
                const noiseColor = fractalNoise(pos.x * 0.02, pos.z * 0.02, 2, 0.5, 1.0);

                const color = baseColor.clone().lerp(peakColor, heightRatio);
                // ノイズで色に変化をつける
                color.lerp(darkColor, noiseColor * 0.3);
                colors.push(color.r, color.g, color.b);
            }
        }

        // インデックス生成（帯をつなぐ三角形）
        for (let i = 0; i < pathSegments; i++) {
            for (let r = 0; r < radialSteps - 1; r++) {
                const v0 = i * radialSteps + r;
                const v1 = v0 + 1;
                const v2 = v0 + radialSteps;
                const v3 = v2 + 1;

                if (side > 0) {
                    indices.push(v0, v2, v1);
                    indices.push(v1, v2, v3);
                } else {
                    indices.push(v0, v1, v2);
                    indices.push(v1, v3, v2);
                }
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        const material = new THREE.MeshLambertMaterial({
            vertexColors: true,
            flatShading: true,
            side: THREE.DoubleSide,
        });

        terrainGroup.add(new THREE.Mesh(geometry, material));
    }

    // 両サイドに地形を生成
    createSideTerrain(1);  // 右側
    createSideTerrain(-1); // 左側

    log("連続地形の生成完了");
}

// 街灯を作成する関数
function createStreetlights() {
    // 街灯の間隔（パスの割合）
    const streetlightSpacing = 0.04; // コース全体で約25本の街灯

    // 街灯用のグループを作成
    const streetlightGroup = new THREE.Group();
    ctx.roadGroup.add(streetlightGroup);

    // コース全体に街灯を配置
    let currentT = 0;
    while (currentT < 1) {
        // パス上の位置と接線を取得
        const point = ctx.carPath.getPointAt(currentT);
        const tangent = ctx.carPath.getTangentAt(currentT);

        // 垂直方向ベクトル（外側方向）
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

        // 道路の右側に街灯を設置
        createSingleStreetlight(point, normal, 1); // 右側

        currentT += streetlightSpacing;
    }

    // 1本の街灯を作成する関数
    function createSingleStreetlight(point, normal, side) {
        // 街灯の位置（道路の外側）
        const lightPosition = new THREE.Vector3().addVectors(
            point,
            normal.clone().multiplyScalar(side * (ctx.roadWidth / 2 + 2.0))
        );

        // 街灯の支柱
        const poleGeometry = new THREE.CylinderGeometry(0.15, 0.2, 8, 8);
        const poleMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });
        const pole = new THREE.Mesh(poleGeometry, poleMaterial);

        // 支柱の位置を設定
        pole.position.copy(new THREE.Vector3(
            lightPosition.x,
            point.y + 4, // 地面からの高さ
            lightPosition.z
        ));

        // 支柱を垂直に立てる
        pole.rotation.x = Math.PI / 2;

        streetlightGroup.add(pole);

        // 街灯の頭部
        const headGeometry = new THREE.BoxGeometry(1.0, 0.4, 0.4);
        const headMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            emissive: 0xFFDD99,
            emissiveIntensity: 0.1 // 初期値は低く
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);

        // 頭部の位置を設定
        head.position.copy(new THREE.Vector3(
            lightPosition.x,
            point.y + 8, // 支柱の上部
            lightPosition.z
        ));

        // 頭部を道路に向ける
        head.lookAt(new THREE.Vector3(
            point.x,
            point.y + 8,
            point.z
        ));

        // ユーザーデータに街灯フラグを設定
        head.userData.isStreetlight = true;

        streetlightGroup.add(head);

        // 街灯のライト
        const light = new THREE.PointLight(0xFFDD99, 0.2, 10, 2);
        light.position.copy(new THREE.Vector3(
            lightPosition.x,
            point.y + 8, // 支柱の上部
            lightPosition.z
        ));

        // ライトを街灯の頭部に関連付ける
        head.userData.pointLight = light;

        streetlightGroup.add(light);
    }
}
