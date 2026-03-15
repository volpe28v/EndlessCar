// RaceManager.js - レースモード管理
import { ctx } from './GameContext.js';
import { updateButtonActiveState } from './CameraSystem.js';
import { SPEED_TO_KMH } from './CarConstants.js';

function log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
}

export class RaceManager {
    constructor() {
        this.phase = 'idle'; // 'idle' | 'grid' | 'countdown' | 'racing' | 'finished'
        this.carData = new Map();
        this.totalLaps = 10;
        this.fastestLap = { time: Infinity, car: null };
        this.raceStartTime = 0;
        this.active = false;
        this.autoCameraInterval = null;
        this.autoCameraMode = true;
        this.predictedCar = null;
    }

    get isActive() {
        return this.active;
    }

    startRace() {
        this.active = true;
        this.phase = 'grid';
        this.carData.clear();
        this._cachedRanked = null;
        this.fastestLap = { time: Infinity, car: null };

        // Hide normal info, show race UI
        document.getElementById('info').style.display = 'none';
        document.getElementById('race-ui').style.display = 'block';
        document.getElementById('race-results').style.display = 'none';

        // Create 16 cars for race
        ctx.createCars(10);

        // Place cars on grid
        this.placeOnGrid();

        // Freeze all cars
        for (const car of ctx.cars) {
            car.frozen = true;
            this.carData.set(car, {
                laps: 0,
                lapTimes: [],
                lapStartTime: 0,
                lastPosition: car.position,
                finished: false,
                finishTime: 0,
                gridPosition: 0,
                totalDistance: 0,
            });
        }

        // Set grid positions and initial totalDistance based on grid order
        const polePosition = ctx.cars[0].position;
        ctx.cars.forEach((car, i) => {
            const data = this.carData.get(car);
            data.gridPosition = i + 1;
            let dist = car.position - polePosition;
            if (dist > 0.5) dist -= 1;
            if (dist < -0.5) dist += 1;
            data.totalDistance = dist;
        });

        // グリッド順で初期順位を設定
        ctx.cars.forEach((car, i) => {
            car.raceRank = i + 1;
            car.totalCars = ctx.cars.length;
        });

        // Focus camera on last car (最後尾)
        ctx.currentCarIndex = ctx.cars.length - 1;
        this.predictedCar = null;

        // Show prediction UI
        document.getElementById('race-predict').style.display = 'block';
    }

    confirmPrediction() {
        this.predictedCar = ctx.cars[ctx.currentCarIndex];
        document.getElementById('race-predict').style.display = 'none';
        setTimeout(() => this.startCountdown(), 500);
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
        const countdownEl = document.getElementById('race-countdown');
        countdownEl.style.display = 'flex';

        const steps = ['3', '2', '1', 'GO!'];
        let step = 0;

        const doStep = () => {
            if (step < steps.length) {
                countdownEl.textContent = steps[step];
                countdownEl.style.color = step < 3 ? '#ff4444' : '#44ff44';
                countdownEl.style.fontSize = step < 3 ? '120px' : '100px';
                step++;

                if (step <= steps.length) {
                    setTimeout(doStep, 1000);
                }
            } else {
                countdownEl.style.display = 'none';
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

            if (this.autoCameraMode) {
                this.startAutoCamera();
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
                    this.fastestLap = { time: lapTime, car: car };
                }

                if (data.laps >= this.totalLaps) {
                    data.finished = true;
                    data.finishTime = now - this.raceStartTime;
                }
            }

            data.lastPosition = curr;
        }

        this._cachedRanked = this.getRankedCars();
        this._cachedRanked.forEach(([car], i) => {
            car.raceRank = i + 1;
            car.totalCars = ctx.cars.length;
        });

        if (allFinished || this.getFinishedCount() >= ctx.cars.length) {
            this.finishRace();
        }
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
        if (!this.active) return;

        const ranked = this._cachedRanked || this.getRankedCars();
        const board = document.getElementById('race-position-board');

        let html = '<table><tr><th>P</th><th>Car</th><th>Lap</th></tr>';

        ranked.forEach(([car, data], i) => {
            const pos = i + 1;
            const colorHex = '#' + (car.bodyColor || 0xffffff).toString(16).padStart(6, '0');
            const isCurrent = car._index === ctx.currentCarIndex;

            const isPredicted = (this.predictedCar === car);
            const classes = [isCurrent ? 'current-car' : '', isPredicted ? 'predicted-car' : ''].filter(Boolean).join(' ');
            const rowAttr = classes ? ` class="${classes}"` : '';

            html += `<tr${rowAttr} data-car-index="${car._index}" style="cursor:pointer;"><td>${pos}</td><td><span style="color:${colorHex};">■</span> ${car.driverName || ''}</td><td>${data.laps}/${this.totalLaps}</td></tr>`;
        });

        html += '</table>';
        board.innerHTML = html;
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
        this.stopAutoCamera();

        for (const car of ctx.cars) {
            car.frozen = true;
        }

        const results = document.getElementById('race-results');
        const ranked = this.getRankedCars();

        let html = '<h2>RACE RESULTS</h2>';
        html += '<table><tr><th>Pos</th><th>Car</th><th>Time</th></tr>';

        ranked.forEach(([car, data], i) => {
            const pos = i + 1;
            const colorHex = '#' + (car.bodyColor || 0xffffff).toString(16).padStart(6, '0');
            const time = data.finished ? this.formatTime(data.finishTime) : `DNF (${data.laps}L)`;

            const resPredictClass = (this.predictedCar === car) ? ' class="predicted-car"' : '';
            html += `<tr${resPredictClass}><td>${pos}</td><td><span style="color:${colorHex};">■</span> ${car.driverName || ''}</td><td>${time}</td></tr>`;
        });

        html += '</table>';
        html += '<div class="result-buttons">';
        html += '<button id="raceAgainBtn">Race Again</button>';
        html += '<button id="normalModeBtn">Normal Mode</button>';
        html += '</div>';

        results.innerHTML = html;
        results.style.display = 'flex';
    }

    endRaceMode() {
        this.active = false;
        this.phase = 'idle';
        this.stopAutoCamera();

        document.getElementById('race-ui').style.display = 'none';
        document.getElementById('race-results').style.display = 'none';
        document.getElementById('race-countdown').style.display = 'none';
        document.getElementById('race-predict').style.display = 'none';

        document.getElementById('info').style.display = 'block';

        for (const car of ctx.cars) {
            car.frozen = false;
        }
        ctx.createCars(10);
        ctx.currentCarIndex = 0;
    }

    startAutoCamera() {
        this.stopAutoCamera();
        this.autoCameraMode = true;
        this.autoCameraInterval = setInterval(() => {
            if (!this.autoCameraMode || this.phase !== 'racing') return;
            const ranked = this.getRankedCars();
            const topN = Math.min(5, ranked.length);
            const idx = Math.random() < 0.7
                ? Math.floor(Math.random() * topN)
                : Math.floor(Math.random() * ranked.length);
            const targetCar = ranked[idx][0];
            ctx.currentCarIndex = targetCar._index;

            ctx.cameraMode = Math.floor(Math.random() * 5);
            updateButtonActiveState();
        }, 8000);
    }

    stopAutoCamera() {
        if (this.autoCameraInterval) {
            clearInterval(this.autoCameraInterval);
            this.autoCameraInterval = null;
        }
    }

    toggleAutoCamera() {
        this.autoCameraMode = !this.autoCameraMode;
        if (this.autoCameraMode && this.phase === 'racing') {
            this.startAutoCamera();
        } else {
            this.stopAutoCamera();
        }
        this.updateAutoCameraButton();
    }

    updateAutoCameraButton() {
        const btn = document.getElementById('race-auto-camera');
        if (btn) {
            if (this.autoCameraMode) {
                btn.classList.add('active');
                btn.textContent = 'Auto';
            } else {
                btn.classList.remove('active');
                btn.textContent = 'Manual';
            }
        }
    }
}
