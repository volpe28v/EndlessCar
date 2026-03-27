// DayNightCycle.js - 昼夜サイクルと街灯制御
import { ctx } from './GameContext.js';

export function updateDayNightCycle() {
    // 時間モードに応じて時間を更新
    ctx.gameTime = ctx.timeModeState.getGameTime(ctx.gameTime, ctx.timeSpeed);

    updateTimeDisplay();

    // 時間帯に応じた空の色の設定
    let timeSkyColor;
    let lightIntensity;
    let ambientIntensity;

    ctx.isNight = false;
    if (ctx.gameTime >= 5 && ctx.gameTime < 7) {
        // 朝焼け（5時～7時）
        const t = (ctx.gameTime - 5) / 2;
        timeSkyColor = ctx.renderCache.tmpColor1.set(0xff9966).lerp(ctx.renderCache.tmpColor2.set(0x87CEEB), t);
        lightIntensity = 0.5 + t * 0.5;
        ambientIntensity = 0.3 + t * 0.3;
    } else if (ctx.gameTime >= 7 && ctx.gameTime < 17) {
        // 昼間（7時～17時）
        timeSkyColor = ctx.renderCache.tmpColor1.set(0x87CEEB);
        lightIntensity = 1.0;
        ambientIntensity = 0.6;
    } else if (ctx.gameTime >= 17 && ctx.gameTime < 19) {
        // 夕焼け（17時～19時）
        const t = (ctx.gameTime - 17) / 2;
        timeSkyColor = ctx.renderCache.tmpColor1.set(0x87CEEB).lerp(ctx.renderCache.tmpColor2.set(0xff7733), t);
        lightIntensity = 1.0 - t * 0.5;
        ambientIntensity = 0.6 - t * 0.3;
    } else if (ctx.gameTime >= 19 && ctx.gameTime < 21) {
        // 日没後（19時～21時）
        const t = (ctx.gameTime - 19) / 2;
        timeSkyColor = ctx.renderCache.tmpColor1.set(0xff7733).lerp(ctx.renderCache.tmpColor2.set(0x111133), t);
        lightIntensity = 0.5 - t * 0.4;
        ambientIntensity = 0.3 - t * 0.2;
        ctx.isNight = true;
    } else {
        // 夜間（21時～5時）
        if (ctx.gameTime >= 21) {
            timeSkyColor = ctx.renderCache.tmpColor1.set(0x111133);
        } else {
            // 夜明け前（0時～5時）
            const t = ctx.gameTime / 5;
            timeSkyColor = ctx.renderCache.tmpColor1.set(0x111133).lerp(ctx.renderCache.tmpColor2.set(0xff9966), t);
        }
        lightIntensity = 0.25;
        ambientIntensity = 0.2;
        ctx.isNight = true;
    }

    // 時間帯の色と天気の色を合成
    timeSkyColor.lerp(ctx.renderCache.weatherSkyColor, 0.7);

    // 空の色をスムーズに遷移
    if (!ctx.renderCache._currentSkyColor) {
        ctx.renderCache._currentSkyColor = timeSkyColor.clone();
    }
    ctx.renderCache._currentSkyColor.lerp(timeSkyColor, 0.03);
    ctx.renderer.setClearColor(ctx.renderCache._currentSkyColor.getHex());

    // 光源の強度を設定
    ctx.directionalLight.intensity = lightIntensity;
    ctx.ambientLight.intensity = ambientIntensity;

    // 夜間は街灯を明るく
    updateStreetLights(ctx.isNight);
}

// 街灯の明るさを更新
export function updateStreetLights(isNight) {
    // 前フレームと同じなら何もしない
    if (isNight === ctx.renderCache.lastIsNight) return;
    ctx.renderCache.lastIsNight = isNight;

    // 街灯参照を初回のみキャッシュ
    if (!ctx.renderCache.streetLights) {
        ctx.renderCache.streetLights = [];
        ctx.scene.traverse((object) => {
            if (object.userData && object.userData.isStreetlight) {
                ctx.renderCache.streetLights.push(object);
            }
        });
    }

    // キャッシュ済みの街灯のみ更新
    for (const object of ctx.renderCache.streetLights) {
        if (object.material && object.material.emissive) {
            if (isNight) {
                object.material.emissive.set(0xFFDD99);
                object.material.emissiveIntensity = 1.0;
            } else {
                object.material.emissive.set(0x333333);
                object.material.emissiveIntensity = 0.1;
            }
        }
        if (object.userData.pointLight) {
            const pointLight = object.userData.pointLight;
            if (isNight) {
                pointLight.intensity = 2.5;
                pointLight.distance = 50;
            } else {
                pointLight.intensity = 0.2;
                pointLight.distance = 10;
            }
        }
    }
}

// 時刻表示を更新する関数
let _lastTimeText = '';
function updateTimeDisplay() {
    const text = ctx.timeModeState.getTimeDisplayText(ctx.gameTime);
    if (text !== _lastTimeText) {
        _lastTimeText = text;
        document.getElementById('currentTime').textContent = text;
    }
}
