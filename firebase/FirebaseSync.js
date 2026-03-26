// FirebaseSync.js - Firebase通信・プレゼンス管理（世界共有版）
// 車の位置同期は行わず、各プレイヤーの「世界情報」(天気・時刻・場所)を共有する

// テストモード: アクセスごとにランダムな都市を割り当て（URLに ?test=true で有効化）
const TEST_MODE = new URLSearchParams(window.location.search).get('test') === 'true';

const WORLD_CITIES = [
    { name: 'Tokyo',        country: 'JP', lat: 35.6762,  lon: 139.6503, tz: 'Asia/Tokyo',           offset: -540 },
    { name: 'New York',     country: 'US', lat: 40.7128,  lon: -74.0060, tz: 'America/New_York',     offset: 300 },
    { name: 'London',       country: 'GB', lat: 51.5074,  lon: -0.1278,  tz: 'Europe/London',        offset: 0 },
    { name: 'Paris',        country: 'FR', lat: 48.8566,  lon: 2.3522,   tz: 'Europe/Paris',         offset: -60 },
    { name: 'Sydney',       country: 'AU', lat: -33.8688, lon: 151.2093, tz: 'Australia/Sydney',     offset: -660 },
    { name: 'Dubai',        country: 'AE', lat: 25.2048,  lon: 55.2708,  tz: 'Asia/Dubai',           offset: -240 },
    { name: 'São Paulo',    country: 'BR', lat: -23.5505, lon: -46.6333, tz: 'America/Sao_Paulo',    offset: 180 },
    { name: 'Mumbai',       country: 'IN', lat: 19.0760,  lon: 72.8777,  tz: 'Asia/Kolkata',         offset: -330 },
    { name: 'Cairo',        country: 'EG', lat: 30.0444,  lon: 31.2357,  tz: 'Africa/Cairo',         offset: -120 },
    { name: 'Moscow',       country: 'RU', lat: 55.7558,  lon: 37.6173,  tz: 'Europe/Moscow',        offset: -180 },
    { name: 'Los Angeles',  country: 'US', lat: 34.0522,  lon: -118.2437,tz: 'America/Los_Angeles',  offset: 480 },
    { name: 'Singapore',    country: 'SG', lat: 1.3521,   lon: 103.8198, tz: 'Asia/Singapore',       offset: -480 },
    { name: 'Berlin',       country: 'DE', lat: 52.5200,  lon: 13.4050,  tz: 'Europe/Berlin',        offset: -60 },
    { name: 'Bangkok',      country: 'TH', lat: 13.7563,  lon: 100.5018, tz: 'Asia/Bangkok',         offset: -420 },
    { name: 'Reykjavik',    country: 'IS', lat: 64.1466,  lon: -21.9426, tz: 'Atlantic/Reykjavik',   offset: 0 },
    { name: 'Honolulu',     country: 'US', lat: 21.3069,  lon: -157.8583,tz: 'Pacific/Honolulu',     offset: 600 },
    { name: 'Anchorage',    country: 'US', lat: 61.2181,  lon: -149.9003,tz: 'America/Anchorage',    offset: 540 },
    { name: 'Helsinki',     country: 'FI', lat: 60.1699,  lon: 24.9384,  tz: 'Europe/Helsinki',      offset: -120 },
    { name: 'Buenos Aires', country: 'AR', lat: -34.6037, lon: -58.3816, tz: 'America/Argentina/Buenos_Aires', offset: 180 },
    { name: 'Nairobi',      country: 'KE', lat: -1.2921,  lon: 36.8219,  tz: 'Africa/Nairobi',       offset: -180 },
];

function getRandomCity() {
    return WORLD_CITIES[Math.floor(Math.random() * WORLD_CITIES.length)];
}

// 都市のタイムゾーンでの現在時刻文字列を返す
function getCityLocalTime(city) {
    try {
        return new Date().toLocaleTimeString('ja-JP', {
            hour: '2-digit', minute: '2-digit', timeZone: city.tz
        });
    } catch (e) {
        // フォールバック: オフセットから手動計算
        const now = new Date();
        const utc = now.getTime() + now.getTimezoneOffset() * 60000;
        const cityTime = new Date(utc - city.offset * 60000);
        return cityTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    }
}

// 都市のタイムゾーンのUTCオフセット（分）を動的に計算（DST対応）
function getCityTimezoneOffset(city) {
    try {
        const now = new Date();
        const utcStr = now.toLocaleString('en-US', { timeZone: 'UTC', hour12: false });
        const cityStr = now.toLocaleString('en-US', { timeZone: city.tz, hour12: false });
        const utcDate = new Date(utcStr);
        const cityDate = new Date(cityStr);
        return (utcDate.getTime() - cityDate.getTime()) / 60000;
    } catch (e) {
        return city.offset;
    }
}

// 都市のタイムゾーンでの現在時刻（hours + minutes/60）を返す
function getCityGameTime(city) {
    try {
        const parts = new Date().toLocaleString('en-US', {
            hour: 'numeric', minute: 'numeric', hour12: false, timeZone: city.tz
        }).split(':');
        return parseInt(parts[0]) + parseInt(parts[1]) / 60;
    } catch (e) {
        const now = new Date();
        const utc = now.getTime() + now.getTimezoneOffset() * 60000;
        const cityTime = new Date(utc - city.offset * 60000);
        return cityTime.getHours() + cityTime.getMinutes() / 60;
    }
}

export class FirebaseSync {
    constructor() {
        this.db = null;
        this.sessionId = null;
        this.playersRef = null;
        this.myRef = null;
        this._worldUpdateInterval = null;
        this._listeners = { join: [], leave: [], worldUpdate: [], selfUpdate: [] };
        this._knownPlayers = new Map(); // sessionId → worldData
        this.testCity = null; // テストモード時に割り当てられた都市
    }

    init() {
        const firebaseConfig = {
            projectId: 'endlesscar-5d92e',
            databaseURL: 'https://endlesscar-5d92e-default-rtdb.asia-southeast1.firebasedatabase.app/'
        };

        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        this.db = firebase.database();
        this.sessionId = this._generateSessionId();
        this.playersRef = this.db.ref('endlesscar/players');
        this.myRef = this.playersRef.child(this.sessionId);

        // テストモード: 外部から渡された都市を使う（二重抽選を防ぐ）
        if (TEST_MODE && !this.testCity) {
            this.testCity = getRandomCity();
            console.log(`[TestMode] Assigned city: ${this.testCity.name}`);
        }

        // プレゼンス: 切断時に自動削除
        this.myRef.onDisconnect().remove();

        // 初期登録
        const initialData = TEST_MODE ? this._getTestModeInitialData() : this._getNormalInitialData();
        this.myRef.set(initialData);

        // 他プレイヤーの監視
        this.playersRef.on('child_added', (snap) => {
            const id = snap.key;
            if (id === this.sessionId) return;
            const data = snap.val();
            this._knownPlayers.set(id, data);
            this._emit('join', id, data);
        });

        this.playersRef.on('child_changed', (snap) => {
            const id = snap.key;
            const data = snap.val();
            this._knownPlayers.set(id, data);
            if (id === this.sessionId) {
                this._emit('selfUpdate', id, data);
            } else {
                this._emit('worldUpdate', id, data);
            }
        });

        this.playersRef.on('child_removed', (snap) => {
            const id = snap.key;
            if (id === this.sessionId) return;
            this._knownPlayers.delete(id);
            this._emit('leave', id);
        });

        // 通常モード: 位置情報は fetchCurrentWeather 経由で取得され、
        // syncMyWorldToFirebase() で lat/lon が Firebase に書き込まれる。
        // _initWorldInfo での二重取得はしない。
    }

    _getTestModeInitialData() {
        const city = this.testCity;
        return {
            name: city.name,
            joinedAt: firebase.database.ServerValue.TIMESTAMP,
            lastUpdate: firebase.database.ServerValue.TIMESTAMP,
            localTime: getCityLocalTime(city),
            timeOffset: city.offset,
            location: city.name,
            locationName: city.name,
            lat: city.lat,
            lon: city.lon,
            weather: 'sunny',
            temperature: null,
            humidity: null,
            windSpeed: null,
            pressure: null,
        };
    }

    _getNormalInitialData() {
        return {
            name: this.sessionId.substring(0, 6),
            joinedAt: Date.now(),
            lastUpdate: Date.now(),
            localTime: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
            timeOffset: new Date().getTimezoneOffset(),
            location: '',
            locationName: '',
            countryCode: '',
            lat: 0,
            lon: 0,
            weather: 'sunny',
            temperature: 20,
            humidity: 50,
            windSpeed: 0,
            pressure: 1013,
        };
    }

    // 自分の世界情報を更新（天気取得後に呼ぶ）
    updateMyWorld(worldData) {
        if (!this.myRef) return;
        const localTime = TEST_MODE && this.testCity
            ? getCityLocalTime(this.testCity)
            : new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        const update = {
            ...worldData,
            lastUpdate: firebase.database.ServerValue.TIMESTAMP,
            localTime,
        };
        this.myRef.update(update);
    }

    // 定期的にlocalTimeを更新（30秒ごと）
    startWorldUpdates() {
        this.stopWorldUpdates();
        this._worldUpdateInterval = setInterval(() => {
            if (this.myRef) {
                const localTime = TEST_MODE && this.testCity
                    ? getCityLocalTime(this.testCity)
                    : new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
                this.myRef.update({
                    localTime,
                    lastUpdate: firebase.database.ServerValue.TIMESTAMP,
                });
            }
        }, 30000);
    }

    stopWorldUpdates() {
        if (this._worldUpdateInterval) {
            clearInterval(this._worldUpdateInterval);
            this._worldUpdateInterval = null;
        }
    }

    getPlayerWorld(sessionId) {
        return this._knownPlayers.get(sessionId) || null;
    }

    getMySessionId() {
        return this.sessionId;
    }

    // テストモード時の割り当て都市を返す
    getTestCity() {
        return this.testCity;
    }

    getAllPlayers() {
        return this._knownPlayers;
    }

    async getFirstVisitor() {
        const snap = await this.playersRef.orderByChild('joinedAt').limitToFirst(1).once('value');
        let first = null;
        snap.forEach((child) => {
            first = { id: child.key, ...child.val() };
        });
        return first;
    }

    onPlayerJoin(callback) {
        this._listeners.join.push(callback);
        // 既に検知済みのプレイヤーを即座に通知（取りこぼし防止）
        for (const [id, data] of this._knownPlayers) {
            callback(id, data);
        }
    }
    onPlayerLeave(callback) { this._listeners.leave.push(callback); }
    onWorldUpdate(callback) { this._listeners.worldUpdate.push(callback); }
    onSelfUpdate(callback) { this._listeners.selfUpdate.push(callback); }

    destroy() {
        this.stopWorldUpdates();
        if (this.myRef) {
            this.myRef.remove();
        }
        if (this.playersRef) {
            this.playersRef.off();
        }
    }

    _generateSessionId() {
        return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
    }

    _emit(event, ...args) {
        for (const cb of this._listeners[event]) {
            try { cb(...args); } catch (e) { console.error('FirebaseSync listener error:', e); }
        }
    }

    async _initWorldInfo() {
        try {
            const pos = await this._getPosition();
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;

            // 地名取得
            let locationName = '';
            try {
                const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ja`);
                const data = await resp.json();
                if (data.address) {
                    const city = data.address.city || data.address.town || data.address.village || '';
                    const state = data.address.state || data.address.province || '';
                    locationName = city ? `${city}, ${state}` : state;
                }
            } catch (e) {
                locationName = `${lat.toFixed(1)}, ${lon.toFixed(1)}`;
            }

            this.myRef.update({
                lat, lon,
                locationName,
                location: locationName,
            });

        } catch (e) {
            console.warn('位置情報の取得に失敗:', e.message);
        }
    }

    _getPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
    }

    // === 訪問履歴 ===
    // 訪問を記録（1セッション1回）
    recordVisit(data) {
        if (!this.db) return;
        const ref = this.db.ref(`endlesscar/visitors/${this.sessionId}`);
        ref.set({
            joinedAt: firebase.database.ServerValue.TIMESTAMP,
            countryCode: data.countryCode || '',
            locationName: data.locationName || '',
            weather: data.weather || '',
            temperature: data.temperature ?? null,
        });
    }

    // 訪問履歴を取得（最新N件）
    async getVisitorHistory(limit = 100) {
        if (!this.db) return [];
        const snap = await this.db.ref('endlesscar/visitors')
            .orderByChild('joinedAt')
            .limitToLast(limit)
            .once('value');
        const visitors = [];
        snap.forEach(child => {
            visitors.push(child.val());
        });
        return visitors.reverse(); // 新しい順
    }
}

// テストモード用ユーティリティをエクスポート
export { TEST_MODE, WORLD_CITIES, getRandomCity, getCityLocalTime, getCityGameTime, getCityTimezoneOffset };
