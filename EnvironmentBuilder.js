import { ctx } from './GameContext.js';

function log(message) { console.log(`[${new Date().toISOString()}] ${message}`); }

// 環境オブジェクトを配置
export function placeEnvironmentObjects() {
    log("環境オブジェクトの配置開始");

    // 街灯を配置
    createStreetlights();

    // 岩肌の構造物を配置
    createRockFormations();

    // トンネルを配置
    createTunnels();

    // 斜張橋を配置
    createCableStayedBridges();

    log("環境オブジェクトの配置完了");
}

// モナコ風トンネルを作成（ジオメトリ結合で軽量化）
function createTunnels() {
    const tunnelGroup = new THREE.Group();
    ctx.roadGroup.add(tunnelGroup);

    const tunnelSections = [
        { start: 0.12, length: 0.06 },
    ];

    const tunnelHeight = 7.0;
    const tunnelWidth = ctx.roadWidth + 4;
    const wallThickness = 0.8;
    const segmentSpacing = 0.004; // 間隔を広げて軽量化

    // ジオメトリ結合ヘルパー: 個別Meshの位置・回転を焼き込んで1つのジオメトリに
    function mergeGeos(entries) {
        const merged = new THREE.BufferGeometry();
        let totalVerts = 0, totalIdx = 0;
        for (const e of entries) { totalVerts += e.geo.attributes.position.count; totalIdx += (e.geo.index ? e.geo.index.count : 0); }
        const pos = new Float32Array(totalVerts * 3);
        const nrm = new Float32Array(totalVerts * 3);
        const idx = totalIdx > 0 ? new Uint32Array(totalIdx) : null;
        let vOff = 0, iOff = 0, vBase = 0;
        const m4 = new THREE.Matrix4();
        const n3 = new THREE.Matrix3();
        for (const e of entries) {
            m4.compose(e.pos, e.quat, new THREE.Vector3(1,1,1));
            n3.getNormalMatrix(m4);
            const gp = e.geo.attributes.position;
            const gn = e.geo.attributes.normal;
            const v = new THREE.Vector3();
            for (let i = 0; i < gp.count; i++) {
                v.set(gp.getX(i), gp.getY(i), gp.getZ(i)).applyMatrix4(m4);
                pos[vOff] = v.x; pos[vOff+1] = v.y; pos[vOff+2] = v.z;
                if (gn) { v.set(gn.getX(i), gn.getY(i), gn.getZ(i)).applyMatrix3(n3).normalize(); nrm[vOff] = v.x; nrm[vOff+1] = v.y; nrm[vOff+2] = v.z; }
                vOff += 3;
            }
            if (e.geo.index && idx) {
                for (let i = 0; i < e.geo.index.count; i++) { idx[iOff++] = e.geo.index.array[i] + vBase; }
            }
            vBase += gp.count;
        }
        merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        merged.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
        if (idx) merged.setIndex(new THREE.BufferAttribute(idx, 1));
        merged.computeBoundingSphere();
        return merged;
    }

    function fwdQuat(fwd) {
        const q = new THREE.Quaternion();
        q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), fwd);
        return q;
    }

    for (const section of tunnelSections) {
        const wallEntries = [];
        const ceilEntries = [];
        const lightEntries = [];
        const stripeEntries = [];

        // 壁・天井用の共有ジオメトリ
        const segLen = 6.0;
        const wallGeo = new THREE.BoxGeometry(wallThickness, tunnelHeight, segLen);
        const ceilGeo = new THREE.BoxGeometry(tunnelWidth + wallThickness * 2, 0.6, segLen);
        const lightGeo = new THREE.BoxGeometry(0.3, 0.08, 6.0);
        const stripeGeo = new THREE.BoxGeometry(0.15, 0.15, 6.0);

        // 壁・天井セグメント
        for (let t = section.start; t < section.start + section.length; t += segmentSpacing) {
            const point = ctx.carPath.getPointAt(t % 1);
            const tangent = ctx.carPath.getTangentAt(t % 1);
            const fwd = new THREE.Vector3(tangent.x, 0, tangent.z).normalize();
            const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
            const q = fwdQuat(fwd);

            // 左壁
            wallEntries.push({ geo: wallGeo, pos: new THREE.Vector3(
                point.x - right.x * (tunnelWidth / 2 + wallThickness / 2),
                point.y + tunnelHeight / 2,
                point.z - right.z * (tunnelWidth / 2 + wallThickness / 2)
            ), quat: q });
            // 右壁
            wallEntries.push({ geo: wallGeo, pos: new THREE.Vector3(
                point.x + right.x * (tunnelWidth / 2 + wallThickness / 2),
                point.y + tunnelHeight / 2,
                point.z + right.z * (tunnelWidth / 2 + wallThickness / 2)
            ), quat: q });
            // 天井
            ceilEntries.push({ geo: ceilGeo, pos: new THREE.Vector3(
                point.x, point.y + tunnelHeight + 0.3, point.z
            ), quat: q });
            // 照明ライン
            lightEntries.push({ geo: lightGeo, pos: new THREE.Vector3(
                point.x, point.y + tunnelHeight - 0.1, point.z
            ), quat: q });
            // ストライプ左右
            [-1, 1].forEach(side => {
                stripeEntries.push({ geo: stripeGeo, pos: new THREE.Vector3(
                    point.x + right.x * side * (tunnelWidth / 2 - 0.2),
                    point.y + 1.5,
                    point.z + right.z * side * (tunnelWidth / 2 - 0.2)
                ), quat: q });
            });
        }

        // マテリアル
        const wallMat = new THREE.MeshPhongMaterial({ color: 0x888888, shininess: 20, specular: 0x222222 });
        const ceilingMat = new THREE.MeshPhongMaterial({ color: 0x666666, shininess: 10 });
        const lightMat = new THREE.MeshPhongMaterial({ color: 0xFFFFDD, emissive: 0xFFFFDD, emissiveIntensity: 0.8 });
        const stripeMat = new THREE.MeshPhongMaterial({ color: 0xFFAA00, emissive: 0xFFAA00, emissiveIntensity: 0.3 });

        // 結合してメッシュ化（4ドローコールに）
        if (wallEntries.length) tunnelGroup.add(new THREE.Mesh(mergeGeos(wallEntries), wallMat));
        if (ceilEntries.length) tunnelGroup.add(new THREE.Mesh(mergeGeos(ceilEntries), ceilingMat));
        if (lightEntries.length) tunnelGroup.add(new THREE.Mesh(mergeGeos(lightEntries), lightMat));
        if (stripeEntries.length) tunnelGroup.add(new THREE.Mesh(mergeGeos(stripeEntries), stripeMat));

        // ポイントライトは入口と出口の2つだけ
        [section.start, (section.start + section.length) % 1].forEach(t => {
            const point = ctx.carPath.getPointAt(t);
            const pLight = new THREE.PointLight(0xFFFFCC, 3.0, 40, 1.5);
            pLight.position.set(point.x, point.y + tunnelHeight - 1, point.z);
            tunnelGroup.add(pLight);
        });

        // トンネル入口・出口のアーチ
        const archMat = new THREE.MeshPhongMaterial({ color: 0x555555, shininess: 15 });
        [section.start, (section.start + section.length) % 1].forEach(t => {
            const point = ctx.carPath.getPointAt(t);
            const tangent = ctx.carPath.getTangentAt(t);
            const fwd = new THREE.Vector3(tangent.x, 0, tangent.z).normalize();
            const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
            const q = fwdQuat(fwd);

            const archTop = new THREE.Mesh(new THREE.BoxGeometry(tunnelWidth + wallThickness * 2 + 1, 1.2, 1.5), archMat);
            archTop.position.set(point.x, point.y + tunnelHeight + 0.8, point.z);
            archTop.quaternion.copy(q);
            tunnelGroup.add(archTop);

            [-1, 1].forEach(side => {
                const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.2, tunnelHeight + 2, 1.5), archMat);
                pillar.position.set(
                    point.x + right.x * side * (tunnelWidth / 2 + wallThickness),
                    point.y + tunnelHeight / 2,
                    point.z + right.z * side * (tunnelWidth / 2 + wallThickness)
                );
                pillar.quaternion.copy(q);
                tunnelGroup.add(pillar);
            });
        });
    }

    log(`トンネル作成完了: ${tunnelSections.length}箇所`);
}

// リッジレーサー風 斜張橋を作成（ジオメトリ結合で軽量化）
function createCableStayedBridges() {
    const bridgeGroup = new THREE.Group();
    ctx.roadGroup.add(bridgeGroup);

    // 橋の区間定義（パス上の位置）
    const bridgeSections = [
        { center: 0.72, span: 0.05 }, // 主塔の位置と橋の半径
    ];

    const concreteMat = new THREE.MeshPhongMaterial({ color: 0xCCCCCC, shininess: 30, specular: 0x333333 });
    const cableMat = new THREE.MeshPhongMaterial({ color: 0xAAAAAAA, shininess: 80, specular: 0x666666 });
    const towerMat = new THREE.MeshPhongMaterial({ color: 0xDDDDDD, shininess: 40, specular: 0x444444 });

    const bridgeWidth = ctx.roadWidth + 6;
    const towerHeight = 55;
    const cableRadius = 0.08;

    for (const section of bridgeSections) {
        const towerPoint = ctx.carPath.getPointAt(section.center);
        const towerTangent = ctx.carPath.getTangentAt(section.center);
        const towerFwd = new THREE.Vector3(towerTangent.x, 0, towerTangent.z).normalize();
        const towerRight = new THREE.Vector3(-towerFwd.z, 0, towerFwd.x);

        // === 主塔（左右2本のA型タワー） ===
        [-1, 1].forEach(side => {
            const baseX = towerPoint.x + towerRight.x * side * (bridgeWidth / 2 + 1);
            const baseZ = towerPoint.z + towerRight.z * side * (bridgeWidth / 2 + 1);
            const baseY = towerPoint.y;

            // 主柱（やや内側に傾斜するA型）
            const pillarGeo = new THREE.BoxGeometry(1.5, towerHeight, 2.0);
            const pillar = new THREE.Mesh(pillarGeo, towerMat);
            pillar.position.set(baseX, baseY + towerHeight / 2, baseZ);
            const q = new THREE.Quaternion();
            q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), towerFwd);
            pillar.quaternion.copy(q);
            bridgeGroup.add(pillar);

            // 主塔上部の横梁
            const beamGeo = new THREE.BoxGeometry(3.0, 1.5, 2.0);
            const beam = new THREE.Mesh(beamGeo, towerMat);
            beam.position.set(baseX, baseY + towerHeight - 2, baseZ);
            beam.quaternion.copy(q);
            bridgeGroup.add(beam);
        });

        // === ケーブル（主塔頂部から道路面へ放射状）→ ジオメトリ結合 ===
        const cableCount = 8; // 片側のケーブル本数
        const cableEntries = [];
        [-1, 1].forEach(side => {
            const towerTopX = towerPoint.x + towerRight.x * side * (bridgeWidth / 2 + 1);
            const towerTopZ = towerPoint.z + towerRight.z * side * (bridgeWidth / 2 + 1);
            const towerTopY = towerPoint.y + towerHeight - 3;

            // 前後にケーブルを張る
            [-1, 1].forEach(dir => {
                for (let i = 1; i <= cableCount; i++) {
                    const ratio = i / cableCount;
                    const anchorT = (section.center + dir * ratio * section.span + 1) % 1;
                    const anchorPoint = ctx.carPath.getPointAt(anchorT);
                    const anchorTangent = ctx.carPath.getTangentAt(anchorT);
                    const anchorRight = new THREE.Vector3(
                        -anchorTangent.z, 0, anchorTangent.x
                    ).normalize();

                    // ケーブルの下端（道路端のアンカー位置）
                    const anchorX = anchorPoint.x + anchorRight.x * side * (bridgeWidth / 2 - 1);
                    const anchorY = anchorPoint.y + 2.0;
                    const anchorZ = anchorPoint.z + anchorRight.z * side * (bridgeWidth / 2 - 1);

                    // ケーブルの長さと方向を計算
                    const dx = anchorX - towerTopX;
                    const dy = anchorY - towerTopY;
                    const dz = anchorZ - towerTopZ;
                    const cableLen = Math.sqrt(dx * dx + dy * dy + dz * dz);

                    const cableGeo = new THREE.CylinderGeometry(cableRadius, cableRadius, cableLen, 4);
                    const cableDir = new THREE.Vector3(dx, dy, dz).normalize();
                    const cableQ = new THREE.Quaternion();
                    cableQ.setFromUnitVectors(new THREE.Vector3(0, 1, 0), cableDir);

                    cableEntries.push({
                        geo: cableGeo,
                        pos: new THREE.Vector3(
                            (towerTopX + anchorX) / 2,
                            (towerTopY + anchorY) / 2,
                            (towerTopZ + anchorZ) / 2
                        ),
                        quat: cableQ
                    });
                }
            });
        });

        // ケーブルをジオメトリ結合して1 Meshに
        if (cableEntries.length) {
            const merged = new THREE.BufferGeometry();
            let totalVerts = 0, totalIdx = 0;
            for (const e of cableEntries) { totalVerts += e.geo.attributes.position.count; totalIdx += (e.geo.index ? e.geo.index.count : 0); }
            const pos = new Float32Array(totalVerts * 3);
            const nrm = new Float32Array(totalVerts * 3);
            const idx = totalIdx > 0 ? new Uint32Array(totalIdx) : null;
            let vOff = 0, iOff = 0, vBase = 0;
            const m4 = new THREE.Matrix4();
            const n3 = new THREE.Matrix3();
            for (const e of cableEntries) {
                m4.compose(e.pos, e.quat, new THREE.Vector3(1,1,1));
                n3.getNormalMatrix(m4);
                const gp = e.geo.attributes.position;
                const gn = e.geo.attributes.normal;
                const v = new THREE.Vector3();
                for (let j = 0; j < gp.count; j++) {
                    v.set(gp.getX(j), gp.getY(j), gp.getZ(j)).applyMatrix4(m4);
                    pos[vOff] = v.x; pos[vOff+1] = v.y; pos[vOff+2] = v.z;
                    if (gn) { v.set(gn.getX(j), gn.getY(j), gn.getZ(j)).applyMatrix3(n3).normalize(); nrm[vOff] = v.x; nrm[vOff+1] = v.y; nrm[vOff+2] = v.z; }
                    vOff += 3;
                }
                if (e.geo.index && idx) { for (let j = 0; j < e.geo.index.count; j++) { idx[iOff++] = e.geo.index.array[j] + vBase; } }
                vBase += gp.count;
            }
            merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            merged.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
            if (idx) merged.setIndex(new THREE.BufferAttribute(idx, 1));
            merged.computeBoundingSphere();
            bridgeGroup.add(new THREE.Mesh(merged, cableMat));
        }

        // === 橋桁（道路の両側の壁・欄干）===
        const railEntries = [];
        const railGeo = new THREE.BoxGeometry(0.4, 1.8, 5.0);
        const railSpacing = 0.003;
        const startT = (section.center - section.span + 1) % 1;
        const endT = (section.center + section.span) % 1;

        for (let t = startT; t !== endT; t = (t + railSpacing) % 1) {
            if (Math.abs(t - endT) < railSpacing) break;
            const p = ctx.carPath.getPointAt(t);
            const tg = ctx.carPath.getTangentAt(t);
            const f = new THREE.Vector3(tg.x, 0, tg.z).normalize();
            const r = new THREE.Vector3(-f.z, 0, f.x);
            const q = new THREE.Quaternion();
            q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), f);

            [-1, 1].forEach(side => {
                railEntries.push({
                    geo: railGeo,
                    pos: new THREE.Vector3(
                        p.x + r.x * side * (bridgeWidth / 2),
                        p.y + 0.9,
                        p.z + r.z * side * (bridgeWidth / 2)
                    ),
                    quat: q
                });
            });
        }

        // 欄干をジオメトリ結合
        if (railEntries.length) {
            // mergeGeosはcreateTunnelsで定義済みなのでスコープ外 → インライン結合
            const merged = new THREE.BufferGeometry();
            let totalVerts = 0, totalIdx = 0;
            for (const e of railEntries) { totalVerts += e.geo.attributes.position.count; totalIdx += (e.geo.index ? e.geo.index.count : 0); }
            const pos = new Float32Array(totalVerts * 3);
            const nrm = new Float32Array(totalVerts * 3);
            const idx = totalIdx > 0 ? new Uint32Array(totalIdx) : null;
            let vOff = 0, iOff = 0, vBase = 0;
            const m4 = new THREE.Matrix4();
            const n3 = new THREE.Matrix3();
            for (const e of railEntries) {
                m4.compose(e.pos, e.quat, new THREE.Vector3(1,1,1));
                n3.getNormalMatrix(m4);
                const gp = e.geo.attributes.position;
                const gn = e.geo.attributes.normal;
                const v = new THREE.Vector3();
                for (let i = 0; i < gp.count; i++) {
                    v.set(gp.getX(i), gp.getY(i), gp.getZ(i)).applyMatrix4(m4);
                    pos[vOff] = v.x; pos[vOff+1] = v.y; pos[vOff+2] = v.z;
                    if (gn) { v.set(gn.getX(i), gn.getY(i), gn.getZ(i)).applyMatrix3(n3).normalize(); nrm[vOff] = v.x; nrm[vOff+1] = v.y; nrm[vOff+2] = v.z; }
                    vOff += 3;
                }
                if (e.geo.index && idx) { for (let i = 0; i < e.geo.index.count; i++) { idx[iOff++] = e.geo.index.array[i] + vBase; } }
                vBase += gp.count;
            }
            merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            merged.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
            if (idx) merged.setIndex(new THREE.BufferAttribute(idx, 1));
            merged.computeBoundingSphere();
            bridgeGroup.add(new THREE.Mesh(merged, concreteMat));
        }
    }

    // === 川の生成（橋の下を横切る） ===
    for (const section of bridgeSections) {
        const centerPoint = ctx.carPath.getPointAt(section.center);
        const centerTangent = ctx.carPath.getTangentAt(section.center);
        const roadDir = new THREE.Vector3(centerTangent.x, 0, centerTangent.z).normalize();
        // 川は道路と直交する方向に流れる
        const riverDir = new THREE.Vector3(-roadDir.z, 0, roadDir.x);

        const riverWidth = 60;
        const riverLength = 300;
        const riverY = centerPoint.y - 6; // 道路面より少し下

        // 川の水面
        const riverGeo = new THREE.PlaneGeometry(riverWidth, riverLength, 1, 1);
        const riverMat = new THREE.MeshPhongMaterial({
            color: 0x225588,
            shininess: 120,
            specular: 0x88AACC,
            transparent: true,
            opacity: 0.7,
        });
        const river = new THREE.Mesh(riverGeo, riverMat);
        river.rotation.x = -Math.PI / 2;
        river.position.set(centerPoint.x, riverY, centerPoint.z);
        // 川を道路と直交する方向に向ける
        const riverAngle = Math.atan2(riverDir.z, riverDir.x);
        river.rotation.z = -riverAngle + Math.PI / 2;
        bridgeGroup.add(river);

        // 川底（少し暗い色の平面）
        const bedGeo = new THREE.PlaneGeometry(riverWidth + 10, riverLength + 20, 1, 1);
        const bedMat = new THREE.MeshPhongMaterial({ color: 0x334422, shininess: 5 });
        const bed = new THREE.Mesh(bedGeo, bedMat);
        bed.rotation.x = -Math.PI / 2;
        bed.position.set(centerPoint.x, riverY - 1.5, centerPoint.z);
        bed.rotation.z = river.rotation.z;
        bridgeGroup.add(bed);

        // 川岸（左右の土手）
        const bankMat = new THREE.MeshPhongMaterial({ color: 0x556633, shininess: 10 });
        [-1, 1].forEach(side => {
            const bankGeo = new THREE.BoxGeometry(8, 4, riverLength + 20);
            const bank = new THREE.Mesh(bankGeo, bankMat);
            bank.position.set(
                centerPoint.x + riverDir.x * side * (riverWidth / 2 + 4),
                riverY - 0.5,
                centerPoint.z + riverDir.z * side * (riverWidth / 2 + 4)
            );
            const bankQ = new THREE.Quaternion();
            bankQ.setFromUnitVectors(new THREE.Vector3(0, 0, 1), riverDir);
            bank.quaternion.copy(bankQ);
            bridgeGroup.add(bank);
        });
    }

    log(`斜張橋作成完了: ${bridgeSections.length}箇所`);
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
