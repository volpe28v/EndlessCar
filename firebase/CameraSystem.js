// CameraSystem.js - カメラ制御・視点ボタン
import { ctx } from './GameContext.js';

// カメラの位置と向きを更新
export function updateCamera() {
    const currentCar = ctx.cars[ctx.currentCarIndex];
    if (!currentCar || !currentCar.object) return;

    switch (ctx.cameraMode) {
        case 0: { // 俯瞰
            const topOffset = new THREE.Vector3(0, 100, 0);
            const targetTopCameraPos = new THREE.Vector3().addVectors(currentCar.object.position, topOffset);
            ctx.camera.position.lerp(targetTopCameraPos, 0.1);
            ctx.camera.lookAt(currentCar.object.position);
            ctx.camera.fov = 70;
            ctx.camera.updateProjectionMatrix();
            break;
        }
        case 1: { // 追従
            const followOffset = new THREE.Vector3(0, 5, 10);
            const rotatedOffset = followOffset.clone().applyQuaternion(currentCar.object.quaternion);
            const targetCameraPos = new THREE.Vector3().addVectors(currentCar.object.position, rotatedOffset);
            ctx.camera.position.lerp(targetCameraPos, 0.1);
            const lookAheadOffset = new THREE.Vector3(0, -2, -20).applyQuaternion(currentCar.object.quaternion);
            const lookAtPoint = new THREE.Vector3().addVectors(currentCar.object.position, lookAheadOffset);
            ctx.camera.lookAt(lookAtPoint);
            ctx.camera.fov = 60;
            ctx.camera.updateProjectionMatrix();
            break;
        }
        case 2: { // 車載（ドライバー視点）
            const fpvOffset = new THREE.Vector3(0, 1.8, 0.0);
            const rotatedFpvOffset = fpvOffset.clone().applyQuaternion(currentCar.object.quaternion);
            ctx.camera.position.copy(currentCar.object.position).add(rotatedFpvOffset);
            const fpvLookAheadOffset = new THREE.Vector3(0, 0.5, -30).applyQuaternion(currentCar.object.quaternion);
            const fpvLookAtPoint = new THREE.Vector3().addVectors(currentCar.object.position, fpvLookAheadOffset);
            if (!ctx.camera.userData.fpvLookTarget) ctx.camera.userData.fpvLookTarget = fpvLookAtPoint.clone();
            ctx.camera.userData.fpvLookTarget.lerp(fpvLookAtPoint, 0.1);
            ctx.camera.lookAt(ctx.camera.userData.fpvLookTarget);
            ctx.camera.fov = 80;
            ctx.camera.updateProjectionMatrix();
            break;
        }
        case 3: { // 斜め上視点
            const diagonalOffset = new THREE.Vector3(50, 40, 20);
            const rotatedDiagOffset = diagonalOffset.clone().applyQuaternion(currentCar.object.quaternion);
            const targetDiagCameraPos = new THREE.Vector3().addVectors(currentCar.object.position, rotatedDiagOffset);
            ctx.camera.position.lerp(targetDiagCameraPos, 0.1);
            const diagLookOffset = new THREE.Vector3(0, -1, -5).applyQuaternion(currentCar.object.quaternion);
            const diagLookAtPoint = new THREE.Vector3().addVectors(currentCar.object.position, diagLookOffset);
            ctx.camera.lookAt(diagLookAtPoint);
            ctx.camera.fov = 60;
            ctx.camera.updateProjectionMatrix();
            break;
        }
        case 4: { // 車前方から後方を見る視点
            const frontOffset = new THREE.Vector3(0, 5, -32);
            const rotatedFrontOffset = frontOffset.clone().applyQuaternion(currentCar.object.quaternion);
            const targetFrontCameraPos = new THREE.Vector3().addVectors(currentCar.object.position, rotatedFrontOffset);
            ctx.camera.position.lerp(targetFrontCameraPos, 0.1);
            const lookBackOffset = new THREE.Vector3(0, 0, 20).applyQuaternion(currentCar.object.quaternion);
            const lookBackPoint = new THREE.Vector3().addVectors(currentCar.object.position, lookBackOffset);
            ctx.camera.lookAt(lookBackPoint);
            ctx.camera.fov = 60;
            ctx.camera.updateProjectionMatrix();
            break;
        }
        case 5: { // ヘリコプター周回（フォーカス車追従）
            if (!ctx.camera.userData.heliAngle) {
                ctx.camera.userData.heliAngle = 0;
            }
            ctx.camera.userData.heliAngle += 0.001;
            const a = ctx.camera.userData.heliAngle;
            const carPos = currentCar.object.position;
            const radius = 200;
            const height = 250;
            const heliPos = new THREE.Vector3(
                carPos.x + Math.cos(a) * radius,
                height,
                carPos.z + Math.sin(a) * radius
            );
            ctx.camera.position.lerp(heliPos, 0.02);
            ctx.camera.lookAt(new THREE.Vector3(carPos.x, -250, carPos.z));
            ctx.camera.fov = 95;
            ctx.camera.updateProjectionMatrix();
            break;
        }
    }
}

// 視点切り替えボタンの設定
export function setupViewButtons() {
    document.querySelectorAll('.view-buttons .viewButton').forEach(button => {
        button.addEventListener('click', () => {
            ctx.cameraMode = parseInt(button.getAttribute('data-view'));
            updateButtonActiveState();
        });
    });
}

// ボタンのアクティブ状態を更新
export function updateButtonActiveState() {
    document.querySelectorAll('.view-buttons .viewButton').forEach(button => {
        const viewMode = parseInt(button.getAttribute('data-view'));
        if (viewMode === ctx.cameraMode) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}
