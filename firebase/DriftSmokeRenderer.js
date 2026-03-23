// DriftSmokeRenderer.js - ドリフト時のタイヤスモークエフェクト

export class DriftSmokeRenderer {
    constructor() {
        this._points = null;
        this._data = null;
    }

    create(scene) {
        const COUNT = 8;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(COUNT * 3);
        const sizes = new Float32Array(COUNT);
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const mat = new THREE.PointsMaterial({
            color: 0xcccccc,
            transparent: true,
            opacity: 0.35,
            size: 2.0,
            sizeAttenuation: true,
            depthWrite: false,
        });

        const points = new THREE.Points(geo, mat);
        points.frustumCulled = false;
        scene.add(points);
        this._points = points;
        this._data = Array.from({ length: COUNT }, () => ({
            life: 0, maxLife: 0,
            x: 0, y: 0, z: 0,
            vx: 0, vy: 0, vz: 0,
        }));
    }

    update(car) {
        if (!this._points || !car.object) return;

        const driftAngle = Math.abs(car.lastDriftAngle);
        const drift = driftAngle;
        const THRESHOLD = 0.25; // ~14度以上の見た目ドリフトでスモーク発生
        const active = driftAngle > THRESHOLD;
        const positions = this._points.geometry.attributes.position.array;
        const sizes = this._points.geometry.attributes.size.array;
        const data = this._data;

        // スポーンレート: ドリフト角度が深いほど多く出る
        const spawnRate = active ? Math.min(0.4, (driftAngle - THRESHOLD) * 0.6) : 0;

        for (let i = 0; i < data.length; i++) {
            const d = data[i];
            const idx = i * 3;

            if (d.life <= 0) {
                if (active && Math.random() < spawnRate) {
                    // 後輪のローカル位置（左右ランダム）
                    const side = Math.random() < 0.5 ? -1.2 : 1.2;
                    const rearZ = 1.7;

                    // ワールド座標に変換
                    const localPos = new THREE.Vector3(side, 0.1, rearZ);
                    car.object.localToWorld(localPos);

                    d.x = localPos.x;
                    d.y = localPos.y;
                    d.z = localPos.z;

                    // 上方向 + ランダム拡散
                    d.vx = (Math.random() - 0.5) * 0.08;
                    d.vy = 0.03 + Math.random() * 0.04;
                    d.vz = (Math.random() - 0.5) * 0.08;

                    d.maxLife = 15 + Math.floor(Math.random() * 15);
                    d.life = d.maxLife;
                } else {
                    positions[idx] = 0;
                    positions[idx + 1] = -100;
                    positions[idx + 2] = 0;
                    sizes[i] = 0;
                    continue;
                }
            }

            const alpha = d.life / d.maxLife;
            d.life--;

            // 位置を更新
            d.x += d.vx;
            d.y += d.vy;
            d.z += d.vz;
            // 拡散を徐々に弱める
            d.vx *= 0.96;
            d.vz *= 0.96;

            positions[idx] = d.x;
            positions[idx + 1] = d.y;
            positions[idx + 2] = d.z;

            // サイズ: 出現時は小さく、広がってから消える
            sizes[i] = (1.5 + drift * 2.0) * Math.sin(alpha * Math.PI);
        }

        this._points.geometry.attributes.position.needsUpdate = true;
        this._points.geometry.attributes.size.needsUpdate = true;
        this._points.material.opacity = active ? 0.3 + drift * 0.15 : 0;
    }

    dispose(scene) {
        if (this._points) {
            this._points.geometry.dispose();
            this._points.material.dispose();
            scene.remove(this._points);
        }
        this._points = null;
        this._data = null;
    }
}
