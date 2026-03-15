// SpeedLineRenderer.js - スピードライン描画クラス

export class SpeedLineRenderer {
    constructor() {
        this._lines = null;
        this._data = null;
        this._fwd = new THREE.Vector3();
    }

    create(scene) {
        const LINE_COUNT = 12;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(LINE_COUNT * 6); // 2頂点 × 3座標
        const colors = new Float32Array(LINE_COUNT * 6);    // 2頂点 × RGB
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6 });
        const lines = new THREE.LineSegments(geo, mat);
        lines.frustumCulled = false;
        scene.add(lines);
        this._lines = lines;
        this._data = Array.from({ length: LINE_COUNT }, () => ({
            offset: new THREE.Vector3(), life: 0, maxLife: 0, spawnAhead: 0, mode: 'pass',
        }));
    }

    update(car) {
        if (!this._lines || !car.object) return;
        const slip = car.slipstreamCharge;
        const isPassing = car.isPassing;
        const isTandem = car.isTandemFollowing;
        // PASS中はスリップストリーム蓄積がある場合のみ表示
        const active = (isPassing && slip > 0.01) || isTandem;

        const positions = this._lines.geometry.attributes.position.array;
        const colors = this._lines.geometry.attributes.color.array;
        const data = this._data;

        // 車の後方向き（getWorldDirectionで実際の車体方向を取得）
        const fwd = this._fwd;
        car.object.getWorldDirection(fwd);
        const right = car._frameRight;
        const carPos = car.object.position;

        // PASS時: スリップストリーム蓄積量に応じてライン長・密度が変化
        const lineLength = isPassing ? slip * (4 + car.speed * 12) : 2 + car.speed * 6;
        const spawnRate = isPassing ? slip * 0.5 : 0.12;

        for (let i = 0; i < data.length; i++) {
            const d = data[i];
            const idx = i * 6;

            if (d.life <= 0) {
                // スポーン判定
                if (active && Math.random() < spawnRate) {
                    d.mode = isPassing ? 'pass' : 'tandem';
                    if (d.mode === 'tandem') {
                        // TANDEM: 車の左右どちらかの脇にスポーン（前方から流れる風）
                        const side = (Math.random() < 0.5 ? -1 : 1) * (1.2 + Math.random() * 1.5);
                        const height = 0.3 + Math.random() * 1.5;
                        d.offset.set(right.x * side, height, right.z * side);
                        d.spawnAhead = 3 + lineLength + Math.random() * 2;
                        d.maxLife = 10 + Math.floor(Math.random() * 15);
                    } else {
                        // PASS: 車の周囲にスポーン（従来のターボ演出）
                        const side = (Math.random() - 0.5) * 2.5;
                        const height = 0.3 + Math.random() * 1.5;
                        d.offset.set(right.x * side, height, right.z * side);
                        d.spawnAhead = 0;
                        d.maxLife = 8 + Math.floor(Math.random() * 12);
                    }
                    d.life = d.maxLife;
                } else {
                    // 非表示
                    for (let j = 0; j < 6; j++) positions[idx + j] = 0;
                    for (let j = 0; j < 6; j++) colors[idx + j] = 0;
                    continue;
                }
            }

            const alpha = d.life / d.maxLife;
            d.life--;

            let startX, startY, startZ, len;
            if (d.mode === 'tandem') {
                // TANDEM: 前方から後方へ車を通り過ぎるように流れる
                const progress = 1 - alpha;
                const travelDist = d.spawnAhead + lineLength;
                const headDist = -d.spawnAhead + travelDist * progress;
                len = lineLength * (0.3 + 0.7 * alpha);
                startX = carPos.x + d.offset.x + fwd.x * headDist;
                startY = carPos.y + d.offset.y;
                startZ = carPos.z + d.offset.z + fwd.z * headDist;
            } else {
                // PASS: 車の後方に出て後方へ流れる（従来動作）
                startX = carPos.x + d.offset.x + fwd.x * 2;
                startY = carPos.y + d.offset.y;
                startZ = carPos.z + d.offset.z + fwd.z * 2;
                len = lineLength * alpha;
            }
            positions[idx]     = startX;
            positions[idx + 1] = startY;
            positions[idx + 2] = startZ;
            positions[idx + 3] = startX + fwd.x * len;
            positions[idx + 4] = startY;
            positions[idx + 5] = startZ + fwd.z * len;

            // 色: PASS=オレンジ→黄, TANDEM=水色
            if (isPassing) {
                colors[idx]     = 1.0; colors[idx + 1] = 0.6 * alpha; colors[idx + 2] = 0.0;
                colors[idx + 3] = 1.0; colors[idx + 4] = 0.9;         colors[idx + 5] = 0.2 * alpha;
            } else {
                colors[idx]     = 0.3 * alpha; colors[idx + 1] = 0.8 * alpha; colors[idx + 2] = 1.0 * alpha;
                colors[idx + 3] = 0.1 * alpha; colors[idx + 4] = 0.5 * alpha; colors[idx + 5] = 0.8 * alpha;
            }
        }

        this._lines.geometry.attributes.position.needsUpdate = true;
        this._lines.geometry.attributes.color.needsUpdate = true;
        this._lines.material.opacity = active ? 0.6 : 0;
    }

    dispose(scene) {
        if (this._lines) {
            this._lines.geometry.dispose();
            this._lines.material.dispose();
            scene.remove(this._lines);
        }
        this._lines = null;
        this._data = null;
    }
}
