// GhostCar.js - リモートプレイヤーの車管理（世界共有版）
// 車はすべてローカルAIで走る。各車にプレイヤーの世界情報を紐付ける。
import { Car } from './Car.js';

export class PlayerCarManager {
    constructor(carPath, scene, carsArray) {
        this.carPath = carPath;
        this.scene = scene;
        this.carsArray = carsArray;
        this.playerCars = new Map(); // sessionId → { car, worldData }
        this._localSessionId = null;
        this._localCarIndex = 0;
    }

    setLocalSessionId(sessionId) {
        this._localSessionId = sessionId;
    }

    getLocalCarIndex() {
        return this._localCarIndex;
    }

    // 新プレイヤーの車を追加（ローカルAI車）
    addPlayerCar(sessionId, worldData) {
        if (this.playerCars.has(sessionId)) return;

        const car = new Car(this.carPath);
        car.position = Math.random(); // ランダム開始位置
        car._index = this.carsArray.length;
        car.createObject(this.scene);
        car.driverName = worldData?.name || sessionId.substring(0, 6);
        car.setFlagSprite(worldData?.countryCode);

        this.carsArray.push(car);
        this.playerCars.set(sessionId, { car, worldData: worldData || {} });

        // otherCars を全車に再設定
        this._updateOtherCars();

        console.log(`Player car added: ${sessionId} (total: ${this.carsArray.length})`);
    }

    // プレイヤーの世界情報を更新
    updatePlayerWorld(sessionId, worldData) {
        const entry = this.playerCars.get(sessionId);
        if (entry) {
            if (worldData?.countryCode && !entry.car._flagSprite) {
                entry.car.setFlagSprite(worldData.countryCode);
            }
            entry.worldData = worldData;
        }
    }

    // プレイヤーの車を削除
    removePlayerCar(sessionId) {
        const entry = this.playerCars.get(sessionId);
        if (!entry) return;

        const idx = this.carsArray.indexOf(entry.car);
        if (idx !== -1) {
            entry.car.dispose(this.scene);
            this.carsArray.splice(idx, 1);
        }

        this.playerCars.delete(sessionId);
        this._updateOtherCars();

        console.log(`Player car removed: ${sessionId} (total: ${this.carsArray.length})`);
    }

    // 現在フォーカスしている車のプレイヤー情報を取得
    getFocusedPlayerWorld(carIndex) {
        const focusedCar = this.carsArray[carIndex];
        if (!focusedCar) return null;

        for (const [sessionId, entry] of this.playerCars) {
            if (entry.car === focusedCar) {
                return {
                    sessionId,
                    isLocal: sessionId === this._localSessionId,
                    ...entry.worldData,
                };
            }
        }
        return null;
    }

    // セッションIDから車のインデックスを取得
    getCarIndex(sessionId) {
        const entry = this.playerCars.get(sessionId);
        if (!entry) return -1;
        return this.carsArray.indexOf(entry.car);
    }

    getPlayerCount() {
        return this.playerCars.size;
    }

    _updateOtherCars() {
        for (const car of this.carsArray) {
            car.setOtherCars(this.carsArray.filter(c => c !== car));
        }

        // ローカル車のインデックスを更新
        if (this._localSessionId) {
            const entry = this.playerCars.get(this._localSessionId);
            if (entry) {
                this._localCarIndex = this.carsArray.indexOf(entry.car);
            }
        }
    }
}
