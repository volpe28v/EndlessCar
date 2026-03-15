// CarModelLoader.js — OBJ/MTLモデルのロード・キャッシュ・clone提供

const CAR_MODEL_PATH = 'models/';
const OBJ_FILE = 'Low_Poly_City_Cars.obj';
const MTL_FILE = 'Low_Poly_City_Cars.mtl';

// バス(10-12)とPlaneを除外した9車種
const CAR_NAMES = [
    'CAR_01', 'CAR_02', 'CAR_03',       // ハッチバック
    'Car_04', 'Car_05', 'Car_06',        // SUV (OBJのオブジェクト名は大文字小文字混在)
    'Car_07', 'Car_08', 'Car_09',        // セダン
];

// 各車の代表ボディカラー（テクスチャの主要色）
const CAR_BODY_COLORS = {
    'CAR_01': 0xFF4477,  // ピンク
    'CAR_02': 0x2288FF,  // ブルー
    'CAR_03': 0x44FFCC,  // シアン
    'Car_04': 0xFFCC00,  // イエロー
    'Car_05': 0x0088FF,  // ブルー
    'Car_06': 0xCCFFFF,  // ライトブルー
    'Car_07': 0xFFBB00,  // イエロー
    'Car_08': 0xBB44FF,  // パープル
    'Car_09': 0x44FFCC,  // シアン
};

// ゲーム内での車の目標サイズ（長さ方向）
const TARGET_CAR_LENGTH = 5.0;

const _cache = new Map();
let _loaded = false;

function log(message) {
    console.log(`[${new Date().toISOString()}] [CarModelLoader] ${message}`);
}

/**
 * OBJ/MTLをロードし、各車をキャッシュする
 */
async function preload() {
    if (_loaded) return;

    log('OBJモデルのプリロード開始');

    return new Promise((resolve, reject) => {
        const mtlLoader = new THREE.MTLLoader();
        mtlLoader.setPath(CAR_MODEL_PATH);
        mtlLoader.load(MTL_FILE, (materials) => {
            materials.preload();
            log('MTLロード完了');

            const objLoader = new THREE.OBJLoader();
            objLoader.setMaterials(materials);
            objLoader.setPath(CAR_MODEL_PATH);
            objLoader.load(OBJ_FILE, (object) => {
                log(`OBJロード完了: ${object.children.length} オブジェクト`);

                // 各車オブジェクトを抽出・正規化・キャッシュ
                // children配列をスナップショット（add()で元配列が変更されるため）
                const children = [...object.children];
                for (const child of children) {
                    const name = child.name;

                    // Planeとバス(10-12)を除外
                    if (name === 'Plane') continue;
                    if (name === 'Car_10' || name === 'Car_11' || name === 'Car_12') continue;

                    if (!CAR_NAMES.includes(name)) continue;

                    // バウンディングボックスを計算
                    const box = new THREE.Box3().setFromObject(child);
                    const size = new THREE.Vector3();
                    box.getSize(size);
                    const center = new THREE.Vector3();
                    box.getCenter(center);

                    // ジオメトリ頂点を直接移動してセンタリング（position offsetだとlookAt回転時にずれる）
                    // Y方向は底面基準にする
                    const offsetX = -center.x;
                    const offsetY = -center.y + size.y / 2;
                    const offsetZ = -center.z;
                    child.traverse((obj) => {
                        if (obj.isMesh && obj.geometry) {
                            obj.geometry.translate(offsetX, offsetY, offsetZ);
                        }
                    });

                    // スケール正規化: 最長軸を基準にTARGET_CAR_LENGTHに合わせる
                    const maxDim = Math.max(size.x, size.z);
                    const scale = TARGET_CAR_LENGTH / maxDim;
                    child.scale.set(scale, scale, scale);

                    // OBJモデルのX軸が車の長さ方向 → ゲームのZ軸（前方）に合わせるため回転
                    child.rotation.y = Math.PI / 2;

                    // グループでラップして正規化済みの状態を保持
                    const wrapper = new THREE.Group();
                    wrapper.add(child);
                    wrapper.userData.carName = name;
                    wrapper.userData.bodyColor = CAR_BODY_COLORS[name] || 0xCCCCCC;

                    _cache.set(name, wrapper);
                    log(`  ${name}: size=(${size.x.toFixed(1)}, ${size.y.toFixed(1)}, ${size.z.toFixed(1)}), scale=${scale.toFixed(4)}`);
                }

                _loaded = true;
                log(`プリロード完了: ${_cache.size}車種キャッシュ`);
                resolve();
            },
            (xhr) => {
                // progress
            },
            (error) => {
                log(`OBJロードエラー: ${error}`);
                reject(error);
            });
        },
        (xhr) => {
            // progress
        },
        (error) => {
            log(`MTLロードエラー: ${error}`);
            reject(error);
        });
    });
}

/**
 * キャッシュからランダムな車種のcloneを返す
 * @returns {{ model: THREE.Group, bodyColor: number, carName: string } | null}
 */
function getCarModel() {
    if (!_loaded || _cache.size === 0) return null;

    const names = Array.from(_cache.keys());
    const randomName = names[Math.floor(Math.random() * names.length)];
    const original = _cache.get(randomName);

    const cloned = original.clone();

    // materialはcloneで共有参照されるのでdisposeしないこと
    return {
        model: cloned,
        bodyColor: original.userData.bodyColor,
        carName: randomName,
    };
}

/**
 * ロード済みかどうか
 */
function isLoaded() {
    return _loaded;
}

export const CarModelLoader = {
    preload,
    getCarModel,
    isLoaded,
};
