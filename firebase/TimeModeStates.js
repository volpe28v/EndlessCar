// TimeModeStates.js - 時間モード状態クラス群
import { ctx } from './GameContext.js';
import { fetchCurrentWeather, updateWeatherDisplay } from './WeatherSystem.js';

// --- TimeModeState ステートパターン ---
export class TimeModeState {
    get name() { return ''; }
    get icon() { return ''; }
    get title() { return ''; }
    enter() {}
    exit() {}
    getGameTime(gameTime, timeSpeed) { return gameTime; }
    shouldAutoSwitch() { return false; }
    shouldAutoChangeWeather() { return false; }
    shouldShowWeatherText(isFromCurrentLocation) { return true; }
    getTimeDisplayText(gameTime) { return ''; }
    initWeather() {}
}

export class RealtimeState extends TimeModeState {
    get name() { return 'realtime'; }
    get icon() { return '🕒'; }
    get title() { return '現在の時刻に連動（クリックで切替）'; }
    enter() {
        ctx.weatherSystem.lastChangeTime = Date.now();
        ctx.weatherSystem.changeInterval = 30000;
        ctx.lastCameraChangeTime = Date.now();
        ctx.cameraChangeInterval = 30000;
        fetchCurrentWeather();
    }
    getGameTime(gameTime, timeSpeed) {
        // リモートの世界 or 近接天気 or lerp遷移中なら、index.html側で設定されたgameTimeをそのまま使う
        if ((ctx._remoteWorldActive && ctx._remoteGameTime != null) || ctx._proximityGameTime != null || ctx._gameTimeLerping) {
            return gameTime;
        }
        // 外部から差し替え可能な現在時刻取得
        if (typeof ctx._getCurrentGameTime === 'function') {
            return ctx._getCurrentGameTime();
        }
        const now = new Date();
        return now.getHours() + now.getMinutes() / 60;
    }
    shouldAutoSwitch() { return false; }
    shouldShowWeatherText(isFromCurrentLocation) { return isFromCurrentLocation; }
    getTimeDisplayText(gameTime) {
        const hours = Math.floor(gameTime).toString().padStart(2, '0');
        const minutes = Math.floor((gameTime % 1) * 60).toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }
    initWeather() {
        fetchCurrentWeather();
    }
}

class AutoModeState extends TimeModeState {
    enter() {
        updateWeatherDisplay(null, false);
        ctx.weatherSystem.lastChangeTime = Date.now();
        ctx.weatherSystem.changeInterval = 20000 + Math.random() * 20000;
        ctx.lastCameraChangeTime = Date.now();
        ctx.cameraChangeInterval = 10000 + Math.random() * 5000;
        ctx.lastCarChangeTime = Date.now();
        ctx.carChangeInterval = 20000 + Math.random() * 10000;
    }
    shouldAutoSwitch() { return true; }
    shouldAutoChangeWeather() { return true; }
    shouldShowWeatherText(isFromCurrentLocation) { return false; }
    initWeather() {
        const randomWeather = ctx.weatherSystem.available[Math.floor(Math.random() * ctx.weatherSystem.available.length)];
        ctx.weatherSystem.change(randomWeather);
    }
}

export class AutoState extends AutoModeState {
    get name() { return 'auto'; }
    get icon() { return '🔄'; }
    get title() { return 'オート切替モード（クリックで切替）'; }
    enter() {
        super.enter();
        fetchCurrentWeather();
    }
    shouldAutoChangeWeather() { return false; }
    shouldShowWeatherText(isFromCurrentLocation) { return true; }
    getGameTime(gameTime, timeSpeed) {
        const now = new Date();
        return now.getHours() + now.getMinutes() / 60;
    }
    getTimeDisplayText(gameTime) {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }
}

export class FastForwardState extends AutoModeState {
    get name() { return 'fastforward'; }
    get icon() { return '⏩'; }
    get title() { return '早送りモード（クリックで切替）'; }
    getGameTime(gameTime, timeSpeed) {
        return (gameTime + timeSpeed) % 24;
    }
    getTimeDisplayText(gameTime) {
        const hours = Math.floor(gameTime).toString().padStart(2, '0');
        const minutes = Math.floor((gameTime % 1) * 60).toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }
}

export const TIME_MODE_CYCLE = [RealtimeState, AutoState, FastForwardState];

export function transitionTimeTo(StateClass) {
    ctx.timeModeState.exit();
    ctx.timeModeState = new StateClass();
    ctx.timeModeState.enter();
}

export function toggleTimeMode() {
    const currentIndex = TIME_MODE_CYCLE.findIndex(C => ctx.timeModeState instanceof C);
    const nextIndex = (currentIndex + 1) % TIME_MODE_CYCLE.length;
    transitionTimeTo(TIME_MODE_CYCLE[nextIndex]);
    const btn = document.getElementById('timeToggleButton');
    btn.textContent = ctx.timeModeState.icon;
    btn.title = ctx.timeModeState.title;
}
