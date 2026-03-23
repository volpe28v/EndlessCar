// PathLUT.js - CatmullRomCurve3 の getPointAt/getTangentAt を事前計算テーブルで高速化
// 初期化時に等間隔ポイントをFloat32Arrayに保存し、実行時は線形補間のみ（O(1)）

export class PathLUT {
    /**
     * @param {THREE.CatmullRomCurve3} curve
     * @param {number} resolution - LUTのポイント数（デフォルト2000）
     */
    constructor(curve, resolution = 2000) {
        this.resolution = resolution;
        this.points = new Float32Array(resolution * 3);
        this.tangents = new Float32Array(resolution * 3);

        // 事前計算
        for (let i = 0; i < resolution; i++) {
            const t = i / resolution;
            const p = curve.getPointAt(t);
            const tg = curve.getTangentAt(t);
            const j = i * 3;
            this.points[j] = p.x;
            this.points[j + 1] = p.y;
            this.points[j + 2] = p.z;
            this.tangents[j] = tg.x;
            this.tangents[j + 1] = tg.y;
            this.tangents[j + 2] = tg.z;
        }

        // 再利用用の内部Vector3（getPointAt/getTangentAtがtarget未指定時に使う）
        this._tmpPoint = new THREE.Vector3();
        this._tmpTangent = new THREE.Vector3();
    }

    /**
     * LUTから線形補間でポイントを取得
     * @param {number} t - パス上の位置（0〜1、ループ対応）
     * @param {THREE.Vector3} [target] - 結果を書き込むVector3（省略時は内部tmpを返す）
     * @returns {THREE.Vector3}
     */
    getPointAt(t, target) {
        const out = target || this._tmpPoint;
        const res = this.resolution;
        t = ((t % 1) + 1) % 1; // 0〜1にクランプ（負の値も対応）
        const idx = t * res;
        const i0 = Math.floor(idx) % res;
        const i1 = (i0 + 1) % res;
        const frac = idx - Math.floor(idx);
        const j0 = i0 * 3;
        const j1 = i1 * 3;
        const pts = this.points;
        out.x = pts[j0] + (pts[j1] - pts[j0]) * frac;
        out.y = pts[j0 + 1] + (pts[j1 + 1] - pts[j0 + 1]) * frac;
        out.z = pts[j0 + 2] + (pts[j1 + 2] - pts[j0 + 2]) * frac;
        return out;
    }

    /**
     * LUTから線形補間で接線を取得
     * @param {number} t - パス上の位置（0〜1、ループ対応）
     * @param {THREE.Vector3} [target] - 結果を書き込むVector3（省略時は内部tmpを返す）
     * @returns {THREE.Vector3}
     */
    getTangentAt(t, target) {
        const out = target || this._tmpTangent;
        const res = this.resolution;
        t = ((t % 1) + 1) % 1;
        const idx = t * res;
        const i0 = Math.floor(idx) % res;
        const i1 = (i0 + 1) % res;
        const frac = idx - Math.floor(idx);
        const j0 = i0 * 3;
        const j1 = i1 * 3;
        const tgs = this.tangents;
        out.x = tgs[j0] + (tgs[j1] - tgs[j0]) * frac;
        out.y = tgs[j0 + 1] + (tgs[j1 + 1] - tgs[j0 + 1]) * frac;
        out.z = tgs[j0 + 2] + (tgs[j1 + 2] - tgs[j0 + 2]) * frac;
        return out;
    }
}
