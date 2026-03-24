// CarModelLoader.js — OBJ/MTL・FBXモデルのロード・キャッシュ・clone提供

const CAR_MODEL_PATH = 'models/';
const OBJ_FILE = 'Low_Poly_City_Cars.obj';
const MTL_FILE = 'Low_Poly_City_Cars.mtl';

// 複数車OBJ: 使用停止（トラック系のため）
const OBJ_CAR_NAMES = [
];

// 単体OBJ: 1ファイル1車種
const SINGLE_OBJ_CARS = [
    { obj: 'RedCar.obj',      mtl: 'RedCar.mtl',      name: 'OBJ_RedCar',     bodyColor: 0xCC0404, rotationY: 0 },
    { obj: 'NormalCar1.obj',   mtl: 'NormalCar1.mtl',   name: 'OBJ_NormalCar',  bodyColor: 0x476EA3, rotationY: Math.PI },
    { obj: 'Cop.obj',          mtl: 'Cop.mtl',          name: 'OBJ_PoliceCar',  bodyColor: 0x8C8C8C, rotationY: Math.PI },
    { obj: 'SportsCar.obj',    mtl: 'SportsCar.mtl',    name: 'OBJ_SportsCar',  bodyColor: 0xE05520, rotationY: Math.PI },
    { obj: 'Taxi.obj',         mtl: 'Taxi.mtl',         name: 'OBJ_Taxi',       bodyColor: 0xA37713, rotationY: Math.PI },
];

// FBX: 追加車種
const FBX_CARS = [
    { file: 'car_1.fbx',   name: 'FBX_car_1',  bodyColor: 0xFF6633, texture: 'tex/Car Texture 1.png' },  // レーシングカー
    { file: 'car_2.fbx',   name: 'FBX_car_2',  bodyColor: 0x4466AA, texture: 'tex/Car Texture 2.png' },  // パトカー
    { file: 'Car2.fbx',    name: 'FBX_Car2',   bodyColor: 0x3366AA, fixRotation: 'car2' },                // ローポリカー
];

// 複数車OBJ内の各車の代表ボディカラー
const CAR_BODY_COLORS = {
    'Car_07': 0xFFBB00,
    'Car_08': 0xBB44FF,
    'Car_09': 0x44FFCC,
};

const TARGET_CAR_LENGTH = 5.0;
const _cache = new Map();
let _loaded = false;
let _pickQueue = [];  // 未選択の車種キュー（全車種を一巡してからシャッフルし直す）

function log(message) {
    console.log(`[${new Date().toISOString()}] [CarModelLoader] ${message}`);
}

/**
 * モデルを正規化してキャッシュに追加する共通処理
 */
function normalizeAndCache(child, name, bodyColor, rotationY, extraRotations) {
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
    if (rotationY) child.rotation.y = rotationY;
    if (extraRotations) {
        if (extraRotations.x) child.rotation.x = extraRotations.x;
        if (extraRotations.z) child.rotation.z = extraRotations.z;
    }

    const wrapper = new THREE.Group();
    wrapper.add(child);
    wrapper.userData.carName = name;
    wrapper.userData.bodyColor = bodyColor;

    _cache.set(name, wrapper);
    log(`  ${name}: size=(${size.x.toFixed(1)}, ${size.y.toFixed(1)}, ${size.z.toFixed(1)}), scale=${scale.toFixed(4)}`);
}

/**
 * 複数車OBJモデルをロード（Low_Poly_City_Cars.obj）
 */
function loadOBJ() {
    return new Promise((resolve, reject) => {
        const mtlLoader = new THREE.MTLLoader();
        mtlLoader.setPath(CAR_MODEL_PATH);
        mtlLoader.load(MTL_FILE, (materials) => {
            materials.preload();

            const objLoader = new THREE.OBJLoader();
            objLoader.setMaterials(materials);
            objLoader.setPath(CAR_MODEL_PATH);
            objLoader.load(OBJ_FILE, (object) => {
                const children = [...object.children];
                for (const child of children) {
                    if (!OBJ_CAR_NAMES.includes(child.name)) continue;
                    normalizeAndCache(child, child.name, CAR_BODY_COLORS[child.name] || 0xCCCCCC, Math.PI / 2);
                }
                log(`複数車OBJロード完了: ${_cache.size}車種`);
                resolve();
            }, null, (error) => { reject(error); });
        }, null, (error) => { reject(error); });
    });
}

/**
 * 単体OBJモデルを1台ロード
 */
function loadSingleOBJ(carDef) {
    return new Promise((resolve, reject) => {
        const mtlLoader = new THREE.MTLLoader();
        mtlLoader.setPath(CAR_MODEL_PATH);
        mtlLoader.load(carDef.mtl, (materials) => {
            materials.preload();
            const objLoader = new THREE.OBJLoader();
            objLoader.setMaterials(materials);
            objLoader.setPath(CAR_MODEL_PATH);
            objLoader.load(carDef.obj, (object) => {
                const rotY = carDef.rotationY !== undefined ? carDef.rotationY : Math.PI / 2;
                normalizeAndCache(object, carDef.name, carDef.bodyColor, rotY, { x: carDef.rotationX, z: carDef.rotationZ });
                log(`単体OBJロード完了: ${carDef.name}`);
                resolve();
            }, null, (error) => { reject(error); });
        }, null, (error) => { reject(error); });
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
            // テクスチャがある場合は手動適用
            if (carDef.texture) {
                const texture = textureLoader.load(CAR_MODEL_PATH + carDef.texture);
                texture.encoding = THREE.sRGBEncoding;
                object.traverse((obj) => {
                    if (obj.isMesh) {
                        obj.material = new THREE.MeshPhongMaterial({ map: texture, shininess: 80, specular: 0x333333 });
                    }
                });
            }

            // FBXLoaderの座標変換をジオメトリに焼き込み + 向き補正
            object.updateMatrixWorld(true);
            let fixRotation;
            if (carDef.fixRotation === 'car2') {
                fixRotation = new THREE.Matrix4().makeRotationY(Math.PI);
            } else {
                fixRotation = new THREE.Matrix4()
                    .makeRotationX(Math.PI / 2)
                    .multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
            }
            object.traverse((obj) => {
                if (obj.isMesh && obj.geometry) {
                    obj.geometry.applyMatrix4(obj.matrixWorld);
                    obj.geometry.applyMatrix4(fixRotation);
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
        }, null, (error) => { reject(error); });
    });
}

/**
 * 全モデルをプリロード（OBJ・単体OBJ・FBXを並列ロード）
 */
async function preload() {
    if (_loaded) return;
    log('モデルのプリロード開始');

    const tasks = [
        loadOBJ().catch(e => { log(`OBJロード失敗: ${e}`); }),
        ...SINGLE_OBJ_CARS.map(car =>
            loadSingleOBJ(car).catch(e => { log(`単体OBJロード失敗(${car.obj}): ${e}`); })
        ),
        ...FBX_CARS.map(car =>
            loadFBX(car).catch(e => { log(`FBXロード失敗(${car.file}): ${e}`); })
        ),
    ];

    await Promise.all(tasks);
    _loaded = true;
    log(`プリロード完了: ${_cache.size}車種キャッシュ`);
}

/**
 * キャッシュからなるべくダブりなく車種を選んでcloneを返す
 * 全車種を一巡してからシャッフルし直す
 */
function getCarModel() {
    if (!_loaded || _cache.size === 0) return null;

    // キューが空になったらシャッフルして補充
    if (_pickQueue.length === 0) {
        _pickQueue = Array.from(_cache.keys());
        for (let i = _pickQueue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [_pickQueue[i], _pickQueue[j]] = [_pickQueue[j], _pickQueue[i]];
        }
    }

    const name = _pickQueue.pop();
    const original = _cache.get(name);

    return {
        model: original.clone(),
        bodyColor: original.userData.bodyColor,
        carName: name,
    };
}

function isLoaded() {
    return _loaded;
}

export const CarModelLoader = {
    preload,
    getCarModel,
    isLoaded,
};
