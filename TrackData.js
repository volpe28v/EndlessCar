// TrackData.js - トラックポイントとパス生成

const HORIZONTAL_SCALE = 100;
const VERTICAL_SCALE = 4;

// トラックポイントの定義
const originalTrackPoints = [
    [4, 0, 7],
    [1, 0, 7],
    [0, 1, 5],
    [0.5, 2, 4],
    [1.2, 2, 4.3],
    [2.5, 2, 2.8],
    [2, 5, 1],
    [2.7, 3, 0],
    [4, 0, 1],
    [4.4, 0, 0.8],
    [5.9, 0, 1.8],
    [5.7, 1, 2.1],
    [4.2, 1, 2.2],
    [3.7, 2, 2.9],
    [3, 2, 4.7],
    [3.4, 1, 5.5],
    [4.4, 1, 5.5],
    [5.4, 2, 4.5],
    [5.7, 2, 3.6],
    [7.3, 1, 3],
    [8, 1, 3.3],
    [9.5, 2, 3.5],
    [9, 1, 5],
    [7.9, 1, 5.7],
    [7, 1, 5.3],
    [6, 0, 5.5],
    [4.9, 0, 7],
    [4, 0, 7]
];

// スケールを適用してtrackPointsを生成
const trackPoints = originalTrackPoints.map(point => [
    point[0] * HORIZONTAL_SCALE,
    point[1] * VERTICAL_SCALE,
    point[2] * HORIZONTAL_SCALE
]);

export function createTrack() {
    // 3Dパスポイントに変換
    const carPathPoints = [];
    for (let i = 0; i < trackPoints.length; i++) {
        carPathPoints.push(new THREE.Vector3(trackPoints[i][0], trackPoints[i][1] + 0.3, trackPoints[i][2]));
    }

    // カトマル・ロムスプラインで滑らかな曲線を作成
    const carPath = new THREE.CatmullRomCurve3(carPathPoints);
    carPath.closed = true;

    // パスの詳細なポイントを取得（道路生成用）
    const detailedPathPoints = carPath.getPoints(500);

    return { carPath, detailedPathPoints };
}
