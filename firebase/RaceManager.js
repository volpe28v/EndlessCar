// RaceManager.js - Firebase版レースモード管理（各国NPC車によるレース）
import { ctx } from './GameContext.js';
import { updateButtonActiveState } from './CameraSystem.js';
import { Car } from './Car.js';
import { WORLD_CITIES, getCityLocalTime, getCityGameTime, getCityTimezoneOffset } from './FirebaseSync.js';

function log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
}

function countryCodeToFlag(code) {
    if (!code || code.length !== 2) return '';
    return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}

export class RaceManager {
    constructor() {
        this.phase = 'idle'; // 'idle' | 'grid' | 'countdown' | 'racing' | 'finished'
        this.carData = new Map();
        this.totalLaps = 5;
        this.fastestLap = { time: Infinity, car: null };
        this.raceStartTime = 0;
        this.active = false;
        this.playerCarIndex = 9;
        this.lastPlayerRank = 10;
        this._positionNotifyTimer = null;
        this.raceCities = []; // レースに参加する都市リスト
    }

    get isActive() {
        return this.active;
    }

    getPlayerCar() {
        return ctx.cars[this.playerCarIndex] || null;
    }

    // レース用の20都市を選出（自分は10位スタート）
    selectRaceCities(myCity) {
        const cities = [...WORLD_CITIES];
        // シャッフル
        for (let i = cities.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cities[i], cities[j]] = [cities[j], cities[i]];
        }

        // 重複国を除いて19都市選出（自分の国は除く）
        const used = new Set();
        if (myCity.country) used.add(myCity.country);
        const selected = [];
        for (const city of cities) {
            if (selected.length >= 19) break;
            if (used.has(city.country)) continue;
            used.add(city.country);
            selected.push(city);
        }

        // 自分を10位（インデックス9）に挿入
        const myPos = 9;
        selected.splice(myPos, 0, myCity);

        return selected;
    }

    startRace(scene, carPath, myCity, npcWeatherCache) {
        this.active = true;
        this.phase = 'grid';
        this.carData.clear();
        this.fastestLap = { time: Infinity, car: null };
        this.lastPlayerRank = 10;

        // 既存の車を全て削除
        for (const car of ctx.cars) {
            car.dispose(scene);
        }
        ctx.cars.length = 0;

        // レース用の都市を選出
        this.raceCities = this.selectRaceCities(myCity);

        // 20台の車を生成
        for (let i = 0; i < this.raceCities.length; i++) {
            const city = this.raceCities[i];
            const car = new Car(carPath);
            car.position = 0;
            car._index = i;
            car.createObject(scene);
            car.driverName = city.name;
            car.setFlagSprite(city.country);
            car._raceCity = city;

            // 天気データをキャッシュから取得
            const weatherKey = city.name.replace(/\s+/g, '_');
            const cached = npcWeatherCache?.[weatherKey];
            car._raceWeather = cached ? {
                weather: cached.weather,
                temperature: cached.temperature,
                humidity: cached.humidity,
                windSpeed: cached.windSpeed,
                pressure: cached.pressure,
            } : { weather: 'sunny' };

            ctx.cars.push(car);
        }

        // グリッド配置
        this.placeOnGrid();

        // 全車フリーズ & データ初期化
        const polePosition = ctx.cars[0].position;
        for (let i = 0; i < ctx.cars.length; i++) {
            const car = ctx.cars[i];
            car.frozen = true;
            car.raceRank = i + 1;
            car.totalCars = ctx.cars.length;

            let dist = car.position - polePosition;
            if (dist > 0.5) dist -= 1;
            if (dist < -0.5) dist += 1;

            this.carData.set(car, {
                laps: 0,
                lapTimes: [],
                lapStartTime: 0,
                lastPosition: car.position,
                finished: false,
                finishTime: 0,
                gridPosition: i + 1,
                totalDistance: dist,
            });
        }

        // otherCars を設定
        for (const car of ctx.cars) {
            car.setOtherCars(ctx.cars.filter(c => c !== car));
        }

        // プレイヤーカー（10位 = インデックス9）
        this.playerCarIndex = 9;
        const playerCar = this.getPlayerCar();
        if (playerCar) {
            playerCar.driverName = this.raceCities[this.playerCarIndex].name;
        }

        // AI調整
        this.applyRivalSystem();

        // カメラをプレイヤーカーに
        ctx.currentCarIndex = this.playerCarIndex;
        ctx.cameraMode = 1; // 追従視点
        updateButtonActiveState();

        // UIを表示
        this.showRaceUI();

        // カウントダウン開始
        setTimeout(() => this.startCountdown(), 1000);
    }

    placeOnGrid() {
        const startPosition = 0.05;
        const rowSpacing = 0.005;
        const staggerOffset = 0.002;
        const lateralOffset = 2.5;

        for (let i = 0; i < ctx.cars.length; i++) {
            const row = Math.floor(i / 2);
            const col = i % 2;

            const car = ctx.cars[i];
            car.position = startPosition - row * rowSpacing - col * staggerOffset;
            if (car.position < 0) car.position += 1.0;

            const point = car.carPath.getPointAt(car.position);
            const tangent = car.carPath.getTangentAt(car.position);

            const right = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
            const offsetSign = (col === 0 ? -1 : 1);
            const offset = offsetSign * lateralOffset;

            car.object.position.set(
                point.x + right.x * offset,
                point.y,
                point.z + right.z * offset
            );
            car.gridLateralOffset = offset;

            const forward = new THREE.Vector3(tangent.x, 0, tangent.z).normalize();
            const up = new THREE.Vector3(0, 1, 0);
            const rightDir = new THREE.Vector3().crossVectors(forward, up).normalize();
            const rotMatrix = new THREE.Matrix4().makeBasis(rightDir, up, forward.clone().negate());
            car.object.quaternion.setFromRotationMatrix(rotMatrix);
        }
    }

    startCountdown() {
        this.phase = 'countdown';
        const el = document.getElementById('race-countdown');
        el.style.display = 'flex';

        const steps = ['3', '2', '1', 'GO!'];
        let step = 0;

        const doStep = () => {
            if (step < steps.length) {
                el.textContent = steps[step];
                el.style.color = step < 3 ? '#ff4444' : '#44ff44';
                el.style.fontSize = step < 3 ? '120px' : '100px';
                step++;
                setTimeout(doStep, 1000);
            } else {
                el.style.display = 'none';
            }
        };
        doStep();

        setTimeout(() => {
            this.phase = 'racing';
            this.raceStartTime = performance.now();

            for (const car of ctx.cars) {
                car.frozen = false;
                car.speed = car.MIN_SPEED + Math.random() * (car.MAX_SPEED - car.MIN_SPEED) * 0.3;
                const data = this.carData.get(car);
                data.lapStartTime = this.raceStartTime;
                data.lastPosition = car.position;
            }
        }, 3000);
    }

    updateRace() {
        if (this.phase !== 'racing') return;

        const now = performance.now();
        let allFinished = true;

        for (const car of ctx.cars) {
            const data = this.carData.get(car);
            if (data.finished) continue;
            allFinished = false;

            const prev = data.lastPosition;
            const curr = car.position;
            let delta = curr - prev;
            if (delta < -0.5) delta += 1;
            if (delta > 0.5) delta -= 1;
            data.totalDistance += delta;

            if (prev > 0.8 && curr < 0.2) {
                data.laps++;
                const lapTime = now - data.lapStartTime;
                data.lapTimes.push(lapTime);
                data.lapStartTime = now;

                if (lapTime < this.fastestLap.time) {
                    this.fastestLap = { time: lapTime, car };
                }

                if (data.laps >= this.totalLaps) {
                    data.finished = true;
                    data.finishTime = now - this.raceStartTime;
                }
            }
            data.lastPosition = curr;
        }

        // 順位更新
        const ranked = this.getRankedCars();
        ranked.forEach(([car], i) => {
            car.raceRank = i + 1;
            car.totalCars = ctx.cars.length;
        });

        // プレイヤー順位変動エフェクト
        this.updatePlayerPositionEffects();

        if (allFinished || this.getFinishedCount() >= ctx.cars.length) {
            this.finishRace();
        }
    }

    updatePlayerPositionEffects() {
        const playerCar = this.getPlayerCar();
        if (!playerCar) return;

        const currentRank = playerCar.raceRank;

        if (currentRank !== this.lastPlayerRank && this.lastPlayerRank > 0) {
            const notify = document.getElementById('position-notify');
            if (notify) {
                const isUp = currentRank < this.lastPlayerRank;
                const arrow = isUp ? '\u25b2' : '\u25bc';
                const ordinal = (n) => n + (['st','nd','rd'][((n+90)%100-10)%10-1] || 'th');
                notify.textContent = `${arrow} ${ordinal(this.lastPlayerRank)} \u2192 ${ordinal(currentRank)}`;
                notify.style.color = isUp ? '#44ff44' : '#ff4444';
                notify.style.display = 'block';
                notify.style.opacity = '1';

                if (this._positionNotifyTimer) clearTimeout(this._positionNotifyTimer);
                this._positionNotifyTimer = setTimeout(() => {
                    notify.style.opacity = '0';
                    setTimeout(() => { notify.style.display = 'none'; }, 500);
                }, 2000);
            }
        }
        this.lastPlayerRank = currentRank;
    }

    getFinishedCount() {
        let count = 0;
        for (const [, data] of this.carData) {
            if (data.finished) count++;
        }
        return count;
    }

    getRankedCars() {
        const entries = Array.from(this.carData.entries());
        return entries.sort((a, b) => {
            const da = a[1], db = b[1];
            if (da.finished && db.finished) return da.finishTime - db.finishTime;
            if (da.finished) return -1;
            if (db.finished) return 1;
            return db.totalDistance - da.totalDistance;
        });
    }

    updateUI() {
        if (!this.active || this.phase === 'finished') return;

        const ranked = this.getRankedCars();
        const board = document.getElementById('race-position-board');
        const playerCar = this.getPlayerCar();

        let html = '<table><tr><th>P</th><th></th><th>Car</th><th>Lap</th></tr>';

        ranked.forEach(([car, data], i) => {
            const pos = i + 1;
            const isPlayer = (playerCar === car);
            const isCurrent = car._index === ctx.currentCarIndex;
            const city = car._raceCity;
            const flag = city ? countryCodeToFlag(city.country) : '';
            const cls = isPlayer ? ' class="player-car"' : isCurrent ? ' class="current-car"' : '';
            html += `<tr${cls} data-car-index="${car._index}" style="cursor:pointer;"><td>${pos}</td><td>${flag}</td><td>${car.driverName || ''}</td><td>${data.laps}/${this.totalLaps}</td></tr>`;
        });

        html += '</table>';
        board.innerHTML = html;

        // クリックでカメラ切替
        board.querySelectorAll('tr[data-car-index]').forEach(row => {
            row.addEventListener('click', () => {
                ctx.currentCarIndex = parseInt(row.getAttribute('data-car-index'));
            });
        });
    }

    formatTime(ms) {
        const totalSec = ms / 1000;
        const min = Math.floor(totalSec / 60);
        const sec = Math.floor(totalSec % 60);
        const msec = Math.floor((totalSec % 1) * 1000);
        if (min > 0) {
            return `${min}:${sec.toString().padStart(2, '0')}.${msec.toString().padStart(3, '0')}`;
        }
        return `${sec}.${msec.toString().padStart(3, '0')}`;
    }

    finishRace() {
        this.phase = 'finished';

        for (const car of ctx.cars) {
            car.frozen = true;
        }

        const results = document.getElementById('race-results');
        const ranked = this.getRankedCars();
        const playerCar = this.getPlayerCar();

        let html = '<h2>RACE RESULTS</h2>';
        html += '<table><tr><th>Pos</th><th></th><th>Country</th><th>Time</th></tr>';

        ranked.forEach(([car, data], i) => {
            const pos = i + 1;
            const time = data.finished ? this.formatTime(data.finishTime) : `DNF (${data.laps}L)`;
            const city = car._raceCity;
            const flag = city ? countryCodeToFlag(city.country) : '';
            const isPlayer = (playerCar === car);
            const cls = isPlayer ? ' class="player-car"' : '';
            html += `<tr${cls}><td>${pos}</td><td>${flag}</td><td>${car.driverName || ''}</td><td>${time}</td></tr>`;
        });

        html += '</table>';
        html += '<div class="result-buttons">';
        html += '<button id="raceAgainBtn">Race Again</button>';
        html += '<button id="normalModeBtn">Normal Mode</button>';
        html += '</div>';

        results.innerHTML = html;
        results.style.display = 'flex';

        // ポジションボードを非表示
        document.getElementById('race-position-board').style.display = 'none';
    }

    showRaceUI() {
        document.getElementById('race-ui').style.display = 'block';
        document.getElementById('race-results').style.display = 'none';
        document.getElementById('race-position-board').style.display = 'block';
    }

    endRaceMode(scene, carPath) {
        this.active = false;
        this.phase = 'idle';

        document.getElementById('race-ui').style.display = 'none';
        document.getElementById('race-results').style.display = 'none';
        document.getElementById('race-countdown').style.display = 'none';
        document.getElementById('race-position-board').style.display = 'none';

        // 全車削除
        for (const car of ctx.cars) {
            car.dispose(scene);
        }
        ctx.cars.length = 0;

        ctx.currentCarIndex = 0;
    }

    // 近接天気用: 現在近くにいる車の天気データを返す
    getProximityWeatherData(carIndex) {
        const car = ctx.cars[carIndex];
        if (!car || !car._raceCity) return null;
        return {
            ...car._raceWeather,
            locationName: car._raceCity.name,
            countryCode: car._raceCity.country,
            tz: car._raceCity.tz,
            timeOffset: getCityTimezoneOffset(car._raceCity),
            lat: car._raceCity.lat,
            lon: car._raceCity.lon,
        };
    }

    applyRivalSystem() {
        const randomInRange = (min, max) => min + Math.random() * (max - min);

        // 全車同じ性能レンジ（自分も含む）
        for (const car of ctx.cars) {
            car.specs.topSpeed = randomInRange(0.85, 1.0);
            car.specs.acceleration = randomInRange(0.82, 0.98);
            car.specs.handling = randomInRange(0.85, 1.05);
            car.specs.grip = randomInRange(0.85, 1.05);

            car.MIN_SPEED = 0.22 * car.specs.acceleration;
            car.MAX_SPEED = 0.4 * car.specs.topSpeed;
            car.ACCELERATION_RATE = 0.002 * car.specs.acceleration;
            car.DECELERATION_RATE = 0.004 * car.specs.handling;
        }
    }
}
