// WeatherSystem.js - 天気システム（index.html から抽出）
import { ctx } from './GameContext.js';

function log(message) { console.log(`[${new Date().toISOString()}] ${message}`); }

class RenderCache {
    constructor() {
        this.tmpColor1 = new THREE.Color();
        this.tmpColor2 = new THREE.Color();
        this.weatherSkyColor = new THREE.Color(0x87CEEB);
        this.streetLights = null;   // 初回traverse後にキャッシュ
        this.lastIsNight = null;    // 街灯状態の変化検知
        this.minimap = null;        // ミニマップPath2Dキャッシュ
    }
    setWeatherSkyColor(hex) {
        this.weatherSkyColor.set(hex);  // new THREE.Color() を避ける
    }
    dispose() {
        this.streetLights = null;
        this.minimap = null;
        this.lastIsNight = null;
    }
}

class WeatherSystem {
    constructor(scene) {
        this.scene = scene;
        this.current = 'sunny';
        this.rainParticles = null;
        this.snowParticles = null;
        this.cloudParticles = null;
        this.isRaining = false;
        this.isSnowing = false;
        this.isCloudy = false;
        this.lastChangeTime = Date.now();
        this.changeInterval = 30000;
        this.available = ['sunny', 'cloudy', 'rain', 'snow'];
    }

    createRainParticles() {
        const rainGeometry = new THREE.BufferGeometry();
        const rainCount = 7500;
        const rainPositions = new Float32Array(rainCount * 6);
        const rainSpeeds = new Float32Array(rainCount);
        const rainSwayFactors = new Float32Array(rainCount);
        const rainPhases = new Float32Array(rainCount);

        for (let i = 0; i < rainCount; i++) {
            const baseIndex = i * 6;
            const x = Math.random() * 2000 - 1000;
            const y = Math.random() * 1000;
            const z = Math.random() * 2000 - 1000;
            rainPositions[baseIndex] = x;
            rainPositions[baseIndex + 1] = y;
            rainPositions[baseIndex + 2] = z;
            rainPositions[baseIndex + 3] = x;
            rainPositions[baseIndex + 4] = y - 10;
            rainPositions[baseIndex + 5] = z;
            rainSpeeds[i] = 20.0 + Math.random() * 10.0;
            rainSwayFactors[i] = 0.1 + Math.random() * 0.2;
            rainPhases[i] = Math.random() * Math.PI * 2;
        }

        rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
        const rainMaterial = new THREE.LineBasicMaterial({
            color: 0x99ccff,
            opacity: 0.4,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.rainParticles = new THREE.LineSegments(rainGeometry, rainMaterial);
        this.rainParticles.visible = false;
        this.scene.add(this.rainParticles);
        this.rainParticles.userData = {
            positions: rainPositions,
            speeds: rainSpeeds,
            swayFactors: rainSwayFactors,
            phases: rainPhases
        };
    }

    createSnowParticles() {
        const snowGeometry = new THREE.BufferGeometry();
        const snowCount = 5000;
        const snowPositions = new Float32Array(snowCount * 3);
        const snowSpeeds = new Float32Array(snowCount);
        const snowSwayFactors = new Float32Array(snowCount);
        const snowPhases = new Float32Array(snowCount);

        for (let i = 0; i < snowCount * 3; i += 3) {
            snowPositions[i] = Math.random() * 2000 - 1000;
            snowPositions[i + 1] = Math.random() * 1000;
            snowPositions[i + 2] = Math.random() * 2000 - 1000;
            const index = i / 3;
            snowSpeeds[index] = 0.5 + Math.random() * 1.0;
            snowSwayFactors[index] = 0.3 + Math.random() * 0.4;
            snowPhases[index] = Math.random() * Math.PI * 2;
        }

        snowGeometry.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
        const snowMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 2,
            opacity: 0.8,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.snowParticles = new THREE.Points(snowGeometry, snowMaterial);
        this.snowParticles.visible = false;
        this.scene.add(this.snowParticles);
        this.snowParticles.userData = {
            positions: snowPositions,
            speeds: snowSpeeds,
            swayFactors: snowSwayFactors,
            phases: snowPhases
        };
    }

    createCloudParticles() {
        const cloudGeometry = new THREE.BufferGeometry();
        const cloudCount = 500;
        const cloudPositions = new Float32Array(cloudCount * 3);
        const cloudSizes = new Float32Array(cloudCount);

        for (let i = 0; i < cloudCount * 3; i += 3) {
            cloudPositions[i] = Math.random() * 3000 - 1500;
            cloudPositions[i+1] = 500 + Math.random() * 500;
            cloudPositions[i+2] = Math.random() * 3000 - 1500;
            cloudSizes[i/3] = 20.0 + Math.random() * 30.0;
        }

        cloudGeometry.setAttribute('position', new THREE.BufferAttribute(cloudPositions, 3));
        cloudGeometry.setAttribute('size', new THREE.BufferAttribute(cloudSizes, 1));

        const cloudTexture = new THREE.TextureLoader().load('https://threejs.org/examples/textures/sprites/cloud10.png');
        const cloudMaterial = new THREE.PointsMaterial({
            color: 0xcccccc,
            size: 30.0,
            transparent: true,
            opacity: 0.7,
            map: cloudTexture,
            sizeAttenuation: true,
            depthWrite: false
        });

        this.cloudParticles = new THREE.Points(cloudGeometry, cloudMaterial);
        this.cloudParticles.visible = false;
        this.scene.add(this.cloudParticles);
    }

    change(weather, isFromCurrentLocation = false, temperature = null, windSpeed = null) {
        this.current = weather;
        updateWeatherDisplay(weather, isFromCurrentLocation, temperature, windSpeed);
        updateWeatherButtonState(weather);

        switch(weather) {
            case 'sunny':
                this.isRaining = false;
                this.isSnowing = false;
                this.isCloudy = false;
                if (this.rainParticles) this.rainParticles.visible = false;
                if (this.snowParticles) this.snowParticles.visible = false;
                if (this.cloudParticles) this.cloudParticles.visible = false;
                applyWeatherEnvironment('sunny');
                break;
            case 'cloudy':
                this.isRaining = false;
                this.isSnowing = false;
                this.isCloudy = true;
                if (this.rainParticles) this.rainParticles.visible = false;
                if (this.snowParticles) this.snowParticles.visible = false;
                if (this.cloudParticles) this.cloudParticles.visible = true;
                applyWeatherEnvironment('cloudy');
                break;
            case 'rain':
                this.isRaining = true;
                this.isSnowing = false;
                this.isCloudy = true;
                if (this.rainParticles) this.rainParticles.visible = true;
                if (this.snowParticles) this.snowParticles.visible = false;
                if (this.cloudParticles) this.cloudParticles.visible = true;
                applyWeatherEnvironment('rain');
                break;
            case 'snow':
                this.isRaining = false;
                this.isSnowing = true;
                this.isCloudy = true;
                if (this.rainParticles) this.rainParticles.visible = false;
                if (this.snowParticles) this.snowParticles.visible = true;
                if (this.cloudParticles) this.cloudParticles.visible = true;
                applyWeatherEnvironment('snow');
                break;
        }
    }

    update(deltaTime, camera) {
        const currentTime = Date.now();

        // 早送りモード時の天気自動変更
        if (ctx.timeModeState.shouldAutoChangeWeather()) {
            if (currentTime - this.lastChangeTime > this.changeInterval) {
                const availableChoices = this.available.filter(w => w !== this.current);
                const nextWeather = availableChoices[Math.floor(Math.random() * availableChoices.length)];
                this.change(nextWeather);
                this.lastChangeTime = currentTime;
                this.changeInterval = 20000 + Math.random() * 20000;
            }
        }

        // オート・早送りモード時のカメラ自動切り替え
        if (ctx.timeModeState.shouldAutoSwitch()) {
            if (currentTime - ctx.lastCameraChangeTime > ctx.cameraChangeInterval) {
                const availableViews = ctx.availableCameraModes.filter(mode => mode !== ctx.cameraMode);
                const nextCameraMode = availableViews[Math.floor(Math.random() * availableViews.length)];
                ctx.cameraMode = nextCameraMode;
                const updateCameraButtonState = ctx.updateButtonActiveState;
                updateCameraButtonState();

                ctx.lastCameraChangeTime = currentTime;
                ctx.cameraChangeInterval = 10000 + Math.random() * 5000;
            }
        }

        // 雲のアニメーション
        if (this.isCloudy && this.cloudParticles) {
            this.cloudParticles.visible = true;
            this.cloudParticles.position.x = camera.position.x;
            this.cloudParticles.position.z = camera.position.z;
        } else if (this.cloudParticles) {
            this.cloudParticles.visible = false;
        }

        // 雨のアニメーション
        if (this.isRaining && this.rainParticles) {
            const positions = this.rainParticles.userData.positions;
            const speeds = this.rainParticles.userData.speeds;
            const swayFactors = this.rainParticles.userData.swayFactors;
            const phases = this.rainParticles.userData.phases;
            const time = Date.now() * 0.001;

            for (let i = 0; i < positions.length; i += 6) {
                const index = i / 6;
                positions[i + 1] -= speeds[index] * deltaTime;
                positions[i + 4] -= speeds[index] * deltaTime;
                const swayAmount = swayFactors[index];
                const phase = phases[index];
                const swayX = Math.sin(time + phase) * swayAmount * 0.1 * deltaTime;
                const swayZ = Math.cos(time * 0.8 + phase) * swayAmount * 0.1 * deltaTime;
                positions[i] += swayX;
                positions[i + 2] += swayZ;
                positions[i + 3] += swayX;
                positions[i + 5] += swayZ;
                if (positions[i + 4] < 0) {
                    const x = Math.random() * 2000 - 1000;
                    const y = 1000;
                    const z = Math.random() * 2000 - 1000;
                    positions[i] = x;
                    positions[i + 1] = y;
                    positions[i + 2] = z;
                    positions[i + 3] = x;
                    positions[i + 4] = y - 10;
                    positions[i + 5] = z;
                }
            }
            this.rainParticles.position.x = camera.position.x;
            this.rainParticles.position.z = camera.position.z;
            this.rainParticles.geometry.attributes.position.needsUpdate = true;
        } else if (this.rainParticles) {
            this.rainParticles.visible = false;
        }

        // 雪のアニメーション
        if (this.isSnowing && this.snowParticles) {
            const positions = this.snowParticles.userData.positions;
            const speeds = this.snowParticles.userData.speeds;
            const swayFactors = this.snowParticles.userData.swayFactors;
            const phases = this.snowParticles.userData.phases;
            const time = Date.now() * 0.001;

            for (let i = 0; i < positions.length; i += 3) {
                const index = i / 3;
                positions[i + 1] -= speeds[index] * deltaTime;
                const swayAmount = swayFactors[index];
                const phase = phases[index];
                positions[i] += Math.sin(time + phase) * swayAmount * 0.1 * deltaTime;
                positions[i + 2] += Math.cos(time * 0.8 + phase) * swayAmount * 0.1 * deltaTime;
                if (positions[i + 1] < 0) {
                    positions[i] = Math.random() * 2000 - 1000;
                    positions[i + 1] = 1000;
                    positions[i + 2] = Math.random() * 2000 - 1000;
                }
            }
            this.snowParticles.position.x = camera.position.x;
            this.snowParticles.position.z = camera.position.z;
            this.snowParticles.geometry.attributes.position.needsUpdate = true;
        } else if (this.snowParticles) {
            this.snowParticles.visible = false;
        }
    }

    dispose() {
        for (const p of [this.rainParticles, this.snowParticles, this.cloudParticles]) {
            if (p) { p.geometry.dispose(); p.material.dispose(); this.scene.remove(p); }
        }
        this.rainParticles = this.snowParticles = this.cloudParticles = null;
    }
}

// 天気ごとの環境パラメータテーブル
const weatherEnvironmentTable = {
    sunny: {
        fogColor: null,        // 霧なし
        fogDensityBirdseye: 0,  // 俯瞰視点の霧の濃度
        fogDensityNormal: 0,    // 通常視点の霧の濃度
        skyColor: 0x87CEEB,     // 晴れの空の色（明るい青空）
        floorColor: 0x336633,   // 通常の芝生の色
        floorRoughness: 0.8,
        floorMetalness: 0.2,
    },
    cloudy: {
        fogColor: 0xaaaaaa,     // 曇りの霧の色
        fogDensityBirdseye: 0.0008, // 俯瞰視点の場合
        fogDensityNormal: 0.003,
        skyColor: 0x8c8c8c,     // 曇りの空の色（グレーがかった色）
        floorColor: 0x2a552a,   // 曇り時の芝生の色
        floorRoughness: 0.8,
        floorMetalness: 0.2,
    },
    rain: {
        fogColor: 0x555555,     // 雨の霧の色
        fogDensityBirdseye: 0.001,
        fogDensityNormal: 0.007,
        skyColor: 0x4a4a4a,     // 雨の空の色（暗いグレー）
        floorColor: 0x1c4d1c,   // 地面を濡れた感じに
        floorRoughness: 0.9,    // より反射するように
        floorMetalness: 0.5,    // より金属感を増やして反射を強める
    },
    snow: {
        fogColor: 0xaaaaaa,     // 雪の霧の色
        fogDensityBirdseye: 0.0005,
        fogDensityNormal: 0.005,
        skyColor: 0xd8d8d8,     // 雪の空の色（明るいグレー）
        floorColor: 0xf0f0f0,   // 地面を雪で覆われたように
        floorRoughness: 0.9,
        floorMetalness: 0.0,
    },
};

// 天気に応じた環境を適用
function applyWeatherEnvironment(weather) {
    const params = weatherEnvironmentTable[weather];
    if (!params) return;

    // 霧の設定（カメラモードに応じて濃度を調整、既存fogインスタンスを再利用）
    if (params.fogColor === null) {
        ctx.scene.fog = null;
    } else {
        const density = ctx.cameraMode === 0 ? params.fogDensityBirdseye : params.fogDensityNormal;
        if (ctx.scene.fog) {
            ctx.scene.fog.color.set(params.fogColor);
            ctx.scene.fog.density = density;
        } else {
            ctx.scene.fog = new THREE.FogExp2(params.fogColor, density);
        }
    }

    // 空の色を設定
    ctx.renderCache.setWeatherSkyColor(params.skyColor);

    // 床マテリアルの更新
    ctx.floor.material.color.setHex(params.floorColor);
    ctx.floor.material.roughness = params.floorRoughness;
    ctx.floor.material.metalness = params.floorMetalness;
    ctx.floor.material.needsUpdate = true;
}

// 天気システムの初期化
function initWeatherSystem() {
    ctx.weatherSystem.createSnowParticles();
    ctx.weatherSystem.createRainParticles();
    ctx.weatherSystem.createCloudParticles();
    ctx.timeModeState.initWeather();

    // 10分ごとに天気情報を再取得
    setInterval(() => {
        if (ctx.timeModeState && ctx.timeModeState.shouldShowWeatherText(true)) {
            log('定期天気更新を実行');
            fetchCurrentWeather();
        }
    }, 30 * 60 * 1000);
}

// デフォルトの位置取得関数（Geolocation API → IPフォールバック）
async function _defaultGetLocation() {
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                timeout: 5000,
                maximumAge: 0
            });
        });
        return { lat: position.coords.latitude, lon: position.coords.longitude };
    } catch (geoError) {
        log(`Geolocation API 失敗、IPベースにフォールバック: ${geoError.message}`);
        const geoResp = await fetch('https://ipapi.co/json/');
        const geoData = await geoResp.json();
        return { lat: geoData.latitude, lon: geoData.longitude };
    }
}

// 位置取得関数（外部から差し替え可能）
// ctx._getLocation に関数をセットすると、そちらが使われる
async function getLocation() {
    if (typeof ctx._getLocation === 'function') {
        return ctx._getLocation();
    }
    return _defaultGetLocation();
}

// 地名取得関数（外部から差し替え可能）
// ctx._getLocationName に関数をセットすると、そちらが使われる
function getLocationName(apiName) {
    if (typeof ctx._getLocationName === 'function') {
        return ctx._getLocationName(apiName);
    }
    return apiName;
}

// 現在位置の天気を取得する関数
async function fetchCurrentWeather() {
    try {
        const { lat, lon } = await getLocation();

        log(`現在位置を取得しました: 緯度 ${lat}, 経度 ${lon}`);

        // OpenWeatherMap APIを呼び出し
        const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${ctx.weatherApiKey}&units=metric`);

        if (!response.ok) {
            throw new Error('天気情報の取得に失敗しました');
        }

        const data = await response.json();

        // 気象データを取得
        const temperature = data.main.temp;
        const windSpeed = data.wind.speed;
        const humidity = data.main.humidity;
        const pressure = data.main.pressure;
        const locationName = getLocationName(data.name);

        // 気象データを保存
        ctx.currentTemperature = temperature;
        ctx.currentWindSpeed = windSpeed;
        ctx.currentHumidity = humidity;
        ctx.currentPressure = pressure;
        ctx.currentLocationName = locationName;

        log(`${locationName} 気温: ${temperature}℃, 風速: ${windSpeed}m/s, 湿度: ${humidity}%, 気圧: ${pressure}hPa`);

        // 天気コードに基づいて天気を設定
        const weatherCode = data.weather[0].id;
        let gameWeather = 'sunny'; // デフォルト

        // 天気コードに基づいて天気を判定
        if (weatherCode >= 600 && weatherCode < 623) {
            gameWeather = 'snow';
        } else if ((weatherCode >= 500 && weatherCode < 532) || (weatherCode >= 200 && weatherCode < 233)) {
            gameWeather = 'rain';
        } else if (weatherCode >= 801 && weatherCode < 805) {
            gameWeather = 'cloudy';
        } else if (weatherCode === 800) {
            gameWeather = 'sunny';
        } else {
            gameWeather = 'cloudy';
        }

        log(`天気を変更します: ${gameWeather}`);

        // 天気を変更（気温と風速も渡す）
        ctx.weatherSystem.change(gameWeather, true, temperature, windSpeed);

        // 天気データ更新コールバック（Firebase送信等に使用）
        if (typeof ctx._onWeatherDataUpdated === 'function') {
            ctx._onWeatherDataUpdated();
        }

        return gameWeather;
    } catch (error) {
        console.error('天気情報の取得エラー:', error);
        log('天気情報の取得に失敗しました。デフォルトの天気を使用します。');

        updateWeatherDisplay('-', false); // エラー時は天気表示を非表示に

        // エラーの場合はランダムな天気を設定（表示はしない）
        const randomWeather = ctx.weatherSystem.available[Math.floor(Math.random() * ctx.weatherSystem.available.length)];
        ctx.weatherSystem.change(randomWeather, false);

        return null;
    }
}

// 天気表示を更新する関数
function updateWeatherDisplay(weather, isFromCurrentLocation = false, temperature = null, windSpeed = null) {
    const weatherDisplay = document.getElementById('currentWeatherText');

    // 各モードの表示判定に委譲
    if (!ctx.timeModeState.shouldShowWeatherText(isFromCurrentLocation)) {
        weatherDisplay.textContent = '-';
        return;
    }

    const weatherMap = {
        'sunny': '\u2600\uFE0F',
        'cloudy': '\u2601\uFE0F',
        'rain': '\uD83C\uDF27\uFE0F',
        'snow': '\u2744\uFE0F'
    };

    let displayText = weatherMap[weather] || '-';
    if (temperature !== null) displayText += ` ${Math.round(temperature)}\u2103`;
    if (ctx.currentHumidity !== null) displayText += ` \uD83D\uDCA7${ctx.currentHumidity}%`;
    if (windSpeed !== null) displayText += ` ${Math.round(windSpeed)}m/s`;
    if (ctx.currentPressure !== null) displayText += ` ${ctx.currentPressure}hPa`;

    weatherDisplay.textContent = displayText;

    // 位置名は時間行に表示
    const locEl = document.getElementById('currentLocation');
    if (locEl) {
        locEl.textContent = ctx.currentLocationName ? `\uD83D\uDCCD${ctx.currentLocationName}` : '';
    }
}

// 天気ボタンのイベントリスナーを修正
function setupWeatherButtons() {
    document.querySelectorAll('.weather-button').forEach(button => {
        button.addEventListener('click', function() {
            const selectedWeather = this.getAttribute('data-weather');

            // 以前の天気をリセット
            document.querySelectorAll('.weather-button').forEach(btn => {
                btn.classList.remove('active');
            });

            // 選択された天気をアクティブに
            this.classList.add('active');

            // 天気を変更（手動変更なのでisFromCurrentLocation = false）
            ctx.weatherSystem.change(selectedWeather, false);
        });
    });
}

// 天気ボタンのアクティブ状態を更新する関数
function updateWeatherButtonState(weather) {
    document.querySelectorAll('.weather-button').forEach(button => {
        if (button.getAttribute('data-weather') === weather) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}

export {
    RenderCache,
    WeatherSystem,
    weatherEnvironmentTable,
    applyWeatherEnvironment,
    initWeatherSystem,
    fetchCurrentWeather,
    updateWeatherDisplay,
    setupWeatherButtons,
    updateWeatherButtonState,
};
