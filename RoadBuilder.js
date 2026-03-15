import { ctx } from './GameContext.js';

function log(message) { console.log(`[${new Date().toISOString()}] ${message}`); }

// アスファルト部分を作成
export function createRoadSurface() {
    // 道路の左右のエッジを計算
    const leftEdgePoints = [];
    const rightEdgePoints = [];

    for (let i = 0; i < ctx.detailedPathPoints.length; i++) {
        const point = ctx.detailedPathPoints[i];
        const nextPoint = ctx.detailedPathPoints[(i + 1) % ctx.detailedPathPoints.length];

        // 進行方向ベクトルを計算
        const direction = new THREE.Vector3().subVectors(nextPoint, point).normalize();

        // 上向きベクトル（法線）を計算
        // 高さの変化を考慮した法線ベクトルを計算する（地形に沿った道路）
        const up = new THREE.Vector3(0, 1, 0);

        // 右向きベクトル（進行方向と上向きの外積）
        const right = new THREE.Vector3().crossVectors(direction, up).normalize();

        // 修正した上向きベクトル（進行方向と右向きの外積）
        const correctedUp = new THREE.Vector3().crossVectors(right, direction).normalize();

        // 道路の左右のエッジを計算（修正した法線ベクトルを使用）
        const leftEdge = new THREE.Vector3().addVectors(point, right.clone().multiplyScalar(ctx.roadWidth / 2));
        const rightEdge = new THREE.Vector3().addVectors(point, right.clone().multiplyScalar(-ctx.roadWidth / 2));

        // 高さを維持（道路面の高さは既にdetailedPathPointsに含まれる）
        // 道路を少し浮かせる（0.05）
        leftEdge.y += 0.05;
        rightEdge.y += 0.05;

        leftEdgePoints.push(leftEdge);
        rightEdgePoints.push(rightEdge);
    }

    // 道路の表面を三角形メッシュで作成
    const roadGeometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];

    // すべてのポイントを頂点配列に追加
    for (let i = 0; i < leftEdgePoints.length; i++) {
        vertices.push(leftEdgePoints[i].x, leftEdgePoints[i].y, leftEdgePoints[i].z);
        vertices.push(rightEdgePoints[i].x, rightEdgePoints[i].y, rightEdgePoints[i].z);
    }

    // 三角形インデックスを作成
    for (let i = 0; i < leftEdgePoints.length - 1; i++) {
        const v0 = i * 2;
        const v1 = v0 + 1;
        const v2 = v0 + 2;
        const v3 = v0 + 3;

        // 2つの三角形で四角形を作成
        indices.push(v0, v1, v2);
        indices.push(v2, v1, v3);
    }

    // 最後の部分を閉じる
    const v0 = (leftEdgePoints.length - 1) * 2;
    const v1 = v0 + 1;
    const v2 = 0;
    const v3 = 1;

    indices.push(v0, v1, v2);
    indices.push(v2, v1, v3);

    roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    roadGeometry.setIndex(indices);
    roadGeometry.computeVertexNormals();

    const roadMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,    // より暗めのグレーに
        roughness: 0.98,    // roughnessを最大限に近く設定
        metalness: 0.05,    // metalnessをさらに下げて光の反射を抑える
        side: THREE.DoubleSide
    });

    const roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);
    ctx.roadGroup.add(roadMesh);

    // 白線（実線）を作成 - 削除
    // createRoadLine(ctx.detailedPathPoints, 0.05, 0xFFFFFF);

    // 縁石を作成（コーナー部分） - 削除
    // createCurbstones();

    return roadMesh;
}

// 道路の白線を作成
export function createRoadLine(pathPoints, lineWidth, color) {
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
    const lineMaterial = new THREE.LineBasicMaterial({ color: color, linewidth: lineWidth });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    line.position.y = 0.1; // 道路の上に浮かせる
    ctx.roadGroup.add(line);

    return line;
}

// 縁石を作成（コース全体の両側に沿って）
export function createCurbstones() {
    // 縁石の間隔（パスの割合）- 滑らかな見た目のために密に配置
    const curbSpacing = 0.001; // 0.003から0.001へ変更してセグメント数を3倍に増加

    // 縁石用のグループを作成
    const curbGroup = new THREE.Group();
    ctx.roadGroup.add(curbGroup);

    // 道路の両側に縁石を設置
    createSideCurb(1);  // 右側
    createSideCurb(-1); // 左側

    // 特定の側（右側または左側）に縁石を作成する関数
    function createSideCurb(side) {
        // 縁石の頂点とインデックスを収集
        const curbVertices = [];
        const curbIndices = [];
        const curbNormals = [];

        let vertexIndex = 0;
        let currentT = 0;

        // 縁石の頂点データを生成
        while (currentT < 1) {
            const point = ctx.carPath.getPointAt(currentT);
            const tangent = ctx.carPath.getTangentAt(currentT);

            // 垂直方向ベクトル（外側方向）
            const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

            // 次のポイントと前のポイントを取得して傾斜を計算
            const nextT = (currentT + 0.005) % 1;
            const prevT = (currentT - 0.005 + 1) % 1;
            const nextPoint = ctx.carPath.getPointAt(nextT);
            const prevPoint = ctx.carPath.getPointAt(prevT);

            // 縁石の基本位置（道路のエッジ、side=1で右側、side=-1で左側）
            const edgePosition = new THREE.Vector3().addVectors(
                point,
                normal.clone().multiplyScalar(side * (ctx.roadWidth / 2))
            );

            // 縁石の外側位置
            const outerPosition = new THREE.Vector3().addVectors(
                point,
                normal.clone().multiplyScalar(side * (ctx.roadWidth / 2 + 0.2)) // 0.3から0.2へ変更して幅を狭く
            );

            // 頂点を追加（縁石の4つの角）
            // 1. 道路側の下部
            curbVertices.push(
                edgePosition.x,
                point.y,
                edgePosition.z
            );

            // 2. 道路側の上部
            curbVertices.push(
                edgePosition.x,
                point.y + 0.12, // 高さを少し低くして0.15から0.12へ
                edgePosition.z
            );

            // 3. 外側の上部
            curbVertices.push(
                outerPosition.x,
                point.y + 0.12, // 高さを少し低くして0.15から0.12へ
                outerPosition.z
            );

            // 4. 外側の下部
            curbVertices.push(
                outerPosition.x,
                point.y,
                outerPosition.z
            );

            // 法線ベクトルを追加（縁石の各頂点の法線）
            const upVector = new THREE.Vector3(0, 1, 0);
            const sideNormal = normal.clone().multiplyScalar(side);

            // 下部の道路側は下向き法線
            curbNormals.push(0, -1, 0);

            // 道路側の上部は内側向き法線
            curbNormals.push(-sideNormal.x, 0, -sideNormal.z);

            // 外側の上部は上向き法線
            curbNormals.push(0, 1, 0);

            // 外側の下部は外側向き法線
            curbNormals.push(sideNormal.x, 0, sideNormal.z);

            // インデックスを追加（縁石の面を定義）
            if (vertexIndex > 0) {
                const baseIdx = vertexIndex * 4;
                const prevBaseIdx = (vertexIndex - 1) * 4;

                // 上面（四角形）
                curbIndices.push(
                    prevBaseIdx + 1, baseIdx + 1, prevBaseIdx + 2,
                    prevBaseIdx + 2, baseIdx + 1, baseIdx + 2
                );

                // 外側面（四角形）
                curbIndices.push(
                    prevBaseIdx + 2, baseIdx + 2, prevBaseIdx + 3,
                    prevBaseIdx + 3, baseIdx + 2, baseIdx + 3
                );

                // 内側面（四角形）
                curbIndices.push(
                    prevBaseIdx, baseIdx, prevBaseIdx + 1,
                    prevBaseIdx + 1, baseIdx, baseIdx + 1
                );
            }

            vertexIndex++;
            currentT += curbSpacing;
        }

        // 最後の縁石を最初の縁石に接続（ループを閉じる）
        const lastBaseIdx = (vertexIndex - 1) * 4;

        // 上面の接続
        curbIndices.push(
            lastBaseIdx + 1, 1, lastBaseIdx + 2,
            lastBaseIdx + 2, 1, 2
        );

        // 外側面の接続
        curbIndices.push(
            lastBaseIdx + 2, 2, lastBaseIdx + 3,
            lastBaseIdx + 3, 2, 3
        );

        // 内側面の接続
        curbIndices.push(
            lastBaseIdx, 0, lastBaseIdx + 1,
            lastBaseIdx + 1, 0, 1
        );

        // 縁石のジオメトリを作成
        const curbGeometry = new THREE.BufferGeometry();
        curbGeometry.setAttribute('position', new THREE.Float32BufferAttribute(curbVertices, 3));
        curbGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(curbNormals, 3));
        curbGeometry.setIndex(curbIndices);

        // コンクリート風の材質
        const curbMaterial = new THREE.MeshStandardMaterial({
            color: 0xE8E8E8, // 少し明るい色に変更
            roughness: 0.9,  // より粗い質感に
            metalness: 0.05, // わずかな光沢を追加
            flatShading: false // スムーズシェーディング
        });

        // 縁石メッシュを作成
        const curbMesh = new THREE.Mesh(curbGeometry, curbMaterial);
        curbGroup.add(curbMesh);
    }
}

// ガードレールを作成（コース全体の外側）
export function createGuardrails() {
    // ガードレールの間隔（パスの割合）
    const railSpacing = 0.005; // より密に配置
    const postSpacing = 0.025; // 支柱の間隔

    // ガードレール用のグループを作成
    const guardrailGroup = new THREE.Group();
    ctx.roadGroup.add(guardrailGroup);

    // 道路の両側にガードレールを設置
    createSideGuardrail(1); // 右側
    createSideGuardrail(-1); // 左側

    // 特定の側（右側または左側）にガードレールを作成する関数
    function createSideGuardrail(side) {
        // 連続したガードレールのセグメントを格納する配列
        const railSegments = [];
        const railPosts = [];

        // ガードレール用の頂点とインデックスを収集
        const railVertices = [];
        const railIndices = [];
        const railUvs = [];

        let vertexIndex = 0;
        let currentT = 0;

        // ガードレールの頂点データを生成
        while (currentT < 1) {
            const point = ctx.carPath.getPointAt(currentT);
            const tangent = ctx.carPath.getTangentAt(currentT);

            // 次のポイントと前のポイントを取得して傾斜を計算
            const nextT = (currentT + 0.005) % 1;
            const prevT = (currentT - 0.005 + 1) % 1;
            const nextPoint = ctx.carPath.getPointAt(nextT);
            const prevPoint = ctx.carPath.getPointAt(prevT);

            // 垂直方向ベクトル（外側方向）
            const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

            // ガードレールの位置（道路の外側、side=1で右側、side=-1で左側）
            const railPosition = new THREE.Vector3().addVectors(
                point,
                normal.clone().multiplyScalar(side * (ctx.roadWidth / 2 + 1.2))
            );

            // 前後方向の傾斜角を計算
            const slopeDistance = Math.sqrt(
                Math.pow(nextPoint.x - prevPoint.x, 2) +
                Math.pow(nextPoint.z - prevPoint.z, 2));
            const slope = Math.atan2(nextPoint.y - prevPoint.y, slopeDistance);

            // ガードレールの高さ調整
            const railHeight = point.y + 0.8; // 道路面から少し高く

            // ガードレールの上部と下部の頂点を追加
            const topRailPos = new THREE.Vector3(
                railPosition.x,
                railHeight + 0.4, // 上部の高さ
                railPosition.z
            );

            const bottomRailPos = new THREE.Vector3(
                railPosition.x,
                railHeight, // 下部の高さ
                railPosition.z
            );

            // 支柱を作成（一定間隔ごと）
            if (Math.abs(currentT % postSpacing) < railSpacing) {
                const postGeometry = new THREE.CylinderGeometry(0.08, 0.08, 1.0, 6);
                const postMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });
                const post = new THREE.Mesh(postGeometry, postMaterial);

                // 支柱の位置を設定
                post.position.copy(new THREE.Vector3(
                    railPosition.x,
                    point.y + 0.5, // 地面からの高さ
                    railPosition.z
                ));

                // 支柱を少し内側に傾ける
                const postLookAt = new THREE.Vector3().addVectors(
                    post.position,
                    normal.clone().multiplyScalar(-0.1 * side) // 内側に少し傾ける
                );
                post.lookAt(postLookAt);
                post.rotateX(Math.PI / 2); // 支柱の向きを修正

                // 上下の傾斜に合わせて追加の回転
                post.rotateZ(slope); // X軸ではなくZ軸で回転（支柱の向きが変わっているため）

                guardrailGroup.add(post);
                railPosts.push(post);
            }

            // 頂点データを追加
            railVertices.push(
                topRailPos.x, topRailPos.y, topRailPos.z,
                bottomRailPos.x, bottomRailPos.y, bottomRailPos.z
            );

            // テクスチャ座標を追加
            railUvs.push(
                currentT * 20, 0, // 上部のUV座標
                currentT * 20, 1  // 下部のUV座標
            );

            // インデックスを追加（四角形を作成）
            if (vertexIndex > 0) {
                // 各セグメント間を三角形で接続
                railIndices.push(
                    vertexIndex * 2 - 2, vertexIndex * 2, vertexIndex * 2 - 1, // 最初の三角形
                    vertexIndex * 2 - 1, vertexIndex * 2, vertexIndex * 2 + 1  // 二番目の三角形
                );
            }

            vertexIndex++;
            currentT += railSpacing;
        }

        // 最後のセグメントを最初のセグメントと接続して閉じる
        railIndices.push(
            (vertexIndex - 1) * 2, 0, (vertexIndex - 1) * 2 + 1, // 最初の三角形
            (vertexIndex - 1) * 2 + 1, 0, 1  // 二番目の三角形
        );

        // ガードレールのジオメトリを作成
        const railGeometry = new THREE.BufferGeometry();
        railGeometry.setAttribute('position', new THREE.Float32BufferAttribute(railVertices, 3));
        railGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(railUvs, 2));
        railGeometry.setIndex(railIndices);
        railGeometry.computeVertexNormals();

        // 高速道路のガードレールらしい素材
        const railMaterial = new THREE.MeshLambertMaterial({
            color: 0xE0E0E0,
            side: THREE.DoubleSide,
            flatShading: false
        });

        // ガードレールメッシュを作成
        const railMesh = new THREE.Mesh(railGeometry, railMaterial);
        guardrailGroup.add(railMesh);
    }
}

// 高層道路の柱を生成する関数
export function createRoadPillars() {
    const pillarGroup = new THREE.Group();
    ctx.roadGroup.add(pillarGroup);

    // 柱の間隔（パスの割合）
    const pillarSpacing = 0.04; // 約25本の柱

    // コース全体に柱を配置
    let currentT = 0;
    while (currentT < 1) {
        const point = ctx.carPath.getPointAt(currentT);
        const tangent = ctx.carPath.getTangentAt(currentT);

        // 地上からの高さが1以上の場合のみ柱を設置
        if (point.y > 1) {
            // 道路の左右に柱を設置
            createSinglePillar(point, tangent, 1);  // 右側
            createSinglePillar(point, tangent, -1); // 左側
        }

        currentT += pillarSpacing;
    }

    // 1本の柱を生成する関数
    function createSinglePillar(point, tangent, side) {
        // 垂直方向ベクトル（外側方向）
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

        // 柱の位置（道路の外側）
        const pillarPosition = new THREE.Vector3().addVectors(
            point,
            normal.clone().multiplyScalar(side * (ctx.roadWidth / 2 - 1))
        );

        // 柱の高さを計算（地上から道路面まで）
        const pillarHeight = point.y;

        // 柱のジオメトリとマテリアル
        const pillarGeometry = new THREE.BoxGeometry(2, pillarHeight, 2);
        const pillarMaterial = new THREE.MeshLambertMaterial({
            color: 0x888888,
            roughness: 0.7,
            metalness: 0.3
        });

        const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);

        // 柱の位置を設定（Y座標は高さの半分）
        pillar.position.set(
            pillarPosition.x,
            pillarHeight / 2,
            pillarPosition.z
        );

        pillarGroup.add(pillar);
    }
}
