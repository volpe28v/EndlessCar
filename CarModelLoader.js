// CarModelLoader.js — OBJ/MTL・FBXモデルのロード・キャッシュ・clone提供

const CAR_MODEL_PATH = 'models/';
const OBJ_FILE = 'Low_Poly_City_Cars.obj';
const MTL_FILE = 'Low_Poly_City_Cars.mtl';

// OBJ: バス(10-12)とPlaneを除外した9車種
const OBJ_CAR_NAMES = [
    'CAR_01', 'CAR_02', 'CAR_03',       // ハッチバック
    'Car_04', 'Car_05', 'Car_06',        // SUV
    'Car_07', 'Car_08', 'Car_09',        // セダン
];

// FBX: 追加車種
const FBX_CARS = [
    { file: 'car_1.fbx', name: 'FBX_car_1', bodyColor: 0xFF6633, texture: 'tex/Car Texture 1.png' },  // レーシングカー（オレンジ）
    { file: 'car_2.fbx', name: 'FBX_car_2', bodyColor: 0x4466AA, texture: 'tex/Car Texture 2.png' },  // パトカー（ブルーグレー）
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
 * モデルを正規化してキャッシュに追加する共通処理
 */
function normalizeAndCache(child, name, bodyColor, rotationY) {
    const box = new THREE.Box3().setFromObject(child);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // ジオメトリ頂点を直接移動してセンタリング（position offsetだとlookAt回転時にずれる）
    const offsetX = -center.x;
    const offsetY = -center.y + size.y / 2;
    const offsetZ = -center.z;
    child.traverse((obj) => {
        if (obj.isMesh && obj.geometry) {
            obj.geometry.translate(offsetX, offsetY, offsetZ);
        }
    });

    // スケール正規化: 最長軸を基準にTARGET_CAR_LENGTHに合わせる
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = TARGET_CAR_LENGTH / maxDim;
    child.scale.multiplyScalar(scale);

    // 車の向きをゲーム座標に合わせるための回転
    if (rotationY !== 0) {
        child.rotation.y = rotationY;
    }

    // グループでラップ
    const wrapper = new THREE.Group();
    wrapper.add(child);
    wrapper.userData.carName = name;
    wrapper.userData.bodyColor = bodyColor;

    _cache.set(name, wrapper);
    log(`  ${name}: size=(${size.x.toFixed(1)}, ${size.y.toFixed(1)}, ${size.z.toFixed(1)}), scale=${scale.toFixed(4)}`);
}

/**
 * OBJモデルをロード
 */
function loadOBJ() {
    return new Promise((resolve, reject) => {
        const mtlLoader = new THREE.MTLLoader();
        mtlLoader.setPath(CAR_MODEL_PATH);
        mtlLoader.load(MTL_FILE, (materials) => {
            materials.preload();
            log('OBJ MTLロード完了');

            const objLoader = new THREE.OBJLoader();
            objLoader.setMaterials(materials);
            objLoader.setPath(CAR_MODEL_PATH);
            objLoader.load(OBJ_FILE, (object) => {
                const children = [...object.children];
                for (const child of children) {
                    const name = child.name;
                    if (name === 'Plane') continue;
                    if (name === 'Car_10' || name === 'Car_11' || name === 'Car_12') continue;
                    if (!OBJ_CAR_NAMES.includes(name)) continue;

                    normalizeAndCache(child, name, CAR_BODY_COLORS[name] || 0xCCCCCC, Math.PI / 2);
                }
                log(`OBJロード完了: ${_cache.size}車種`);
                resolve();
            }, null, (error) => {
                log(`OBJロードエラー: ${error}`);
                reject(error);
            });
        }, null, (error) => {
            log(`MTLロードエラー: ${error}`);
            reject(error);
        });
    });
}

/**
 * FBXモデルを1台ロード
 */
function loadFBX(carDef) {
    return new Promise((resolve, reject) => {
        const loader = new THREE.FBXLoader();
        const textureLoader = new THREE.TextureLoader();

        loader.load(CAR_MODEL_PATH + carDef.file, (object) => {
            // テクスチャを手動適用
            const texture = textureLoader.load(CAR_MODEL_PATH + carDef.texture);
            texture.encoding = THREE.sRGBEncoding;
            object.traverse((obj) => {
                if (obj.isMesh) {
                    obj.material = new THREE.MeshPhongMaterial({
                        map: texture,
                        shininess: 80,
                        specular: 0x333333,
                    });
                }
            });

            // FBXLoaderの座標変換を適用してからジオメトリに焼き込む
            object.updateMatrixWorld(true);
            object.traverse((obj) => {
                if (obj.isMesh && obj.geometry) {
                    obj.geometry.applyMatrix4(obj.matrixWorld);
                    obj.position.set(0, 0, 0);
                    obj.rotation.set(0, 0, 0);
                    obj.scale.set(1, 1, 1);
                    obj.updateMatrix();
                }
            });
            object.position.set(0, 0, 0);
            object.rotation.set(0, 0, 0);
            object.scale.set(1, 1, 1);

            normalizeAndCache(object, carDef.name, carDef.bodyColor, 0);
            log(`FBXロード完了: ${carDef.name}`);
            resolve();
        }, null, (error) => {
            log(`FBXロードエラー(${carDef.file}): ${error}`);
            reject(error);
        });
    });
}

/**
 * 全モデルをプリロード
 */
async function preload() {
    if (_loaded) return;

    log('モデルのプリロード開始');

    // OBJとFBXを並列ロード
    const tasks = [
        loadOBJ().catch(e => { log(`OBJロード失敗: ${e}`); }),
        ...FBX_CARS.map(car =>
            loadFBX(car).catch(e => { log(`FBXロード失敗(${car.file}): ${e}`); })
        ),
    ];

    await Promise.all(tasks);

    _loaded = true;
    log(`プリロード完了: ${_cache.size}車種キャッシュ`);
}

/**
 * キャッシュからランダムな車種のcloneを返す
 */
function getCarModel() {
    if (!_loaded || _cache.size === 0) return null;

    const names = Array.from(_cache.keys());
    const randomName = names[Math.floor(Math.random() * names.length)];
    const original = _cache.get(randomName);

    const cloned = original.clone();

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
