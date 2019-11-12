import {WEBGL} from '../vendor/WebGL.js';
import * as THREE from '../vendor/three.module.js';
import "../vendor/jszip/dist/jszip.min.js"
import {saveAs} from "../vendor/jszip/vendor/FileSaver.js";

export default class Space extends THREE.Scene {
    get state() {
        return {
            tMax: this.tMax,
            tStep: this.tStep,
            uTime: this.uTime,
            frame: this.frame,
            frameTime: this.frameTime,
            averageFrameTime: this.averageFrameTime,
            averageFPS: this.averageFPS,
            FPS: this.FPS,
        };
    }

    get rendererOptions() {
        return {
            pixelRatio: window.devicePixelRatio,
            size: new THREE.Vector2(window.innerWidth, window.innerHeight),
        }
    }

    get cameraOptions() {
        const rendererOptions = this.rendererOptions;
        return {
            fov: 90,
            aspect: rendererOptions.size.x / rendererOptions.size.y,
            near: .01,
            far: 10000,
            position: new THREE.Vector3(0, 0, 3),
        }
    }

    constructor(container) {
        super();
        this.container = container;
        console.time("Сцена создана");
        if (WEBGL.isWebGL2Available() === false) {
            console.error("Webgl2 не доступен.");
            console.log("Устройство идентифицировано: \"Электроника МК85\".");
            document.body.appendChild(WEBGL.getWebGL2ErrorMessage());
        }
        this.reset();
        const cameraOptions = this.cameraOptions;
        this.camera = new THREE.PerspectiveCamera(
            cameraOptions.fov,
            cameraOptions.aspect,
            cameraOptions.near,
            cameraOptions.far,
        );
        this.camera.position.copy(cameraOptions.position);
        console.log("Камера создана.", cameraOptions);
        window.addEventListener('resize', () => {
            cameraOptions.aspect = window.innerWidth / window.innerHeight;
            this.camera.aspect = cameraOptions.aspect;
            this.camera.updateProjectionMatrix();
            //cameraOptions.siz = window.innerWidth / window.innerHeight;
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }, false);
        //console.log("Обработчик изменения размера окна развешен.");
        this.initRenderer();
        this.initGUI();
        console.timeEnd("Сцена создана");
    }

    reset() {
        this.capturedFrames = [];
        this.tMax = Math.PI * 2;
        this.tStep = Math.PI / 1920;
        this.uTime = 0;
        this.frame = 1;
        this.frameTime = 0;
        this.averageFrameTime = 0;
        this.averageFPS = 0;
        this.FPS = 0;
        console.log("Параметры сброшены.");
    }

    initGUI() {
        console.time("Панель управления создана");
        this.gui = new dat.GUI({ autoPlace: false });
        const tMaxMax = Math.PI * 100.;
        this.gui.add(this, "FPS")
            .name("Фэпээс")
            .listen();
        this.gui.add(this, "frame")
            .name("Кадр")
            .listen();
        this.gui.add(this, "tMax")
            .min(0)
            .max(tMaxMax)
            .step(Math.PI * .25)
            .name("tMax")
            .listen();
        this.gui.add(this, "tStep")
            .min(-1)
            .max(1)
            .step(0.0001)
            .name("tStep")
            .listen();
        this.gui.add(this, "uTime")
            .min(0)
            .max(tMaxMax + .0001)
            .step(0.0001)
            .name("uTime")
            .listen();
        this.gui.add(this, "reset").name("По-новой");
        console.timeEnd("Панель управления создана");
    }

    initRenderer() {
        console.time("Рендерер создан");
        this.canvas = document.createElement('canvas');
        const context = this.canvas.getContext('webgl2', {alpha: true});
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            context,
        });
        const rendererOptions = {
            pixelRatio: window.devicePixelRatio,
            size: new THREE.Vector2(window.innerWidth, window.innerHeight),
        };
        this.renderer.setPixelRatio(rendererOptions.pixelRatio);
        this.renderer.setSize(rendererOptions.size.x, rendererOptions.size.y);
        this.container.appendChild(this.renderer.domElement);
        console.timeEnd("Рендерер создан");
        console.log("Параметры рендерера:", rendererOptions);
    }

    capture() {
        this.capturing = true;
        console.warn('Тихо! Идёт запись.');
    }

    run() {
        this.reset();
        let previousTime = 0;
        const animateScene = (currentTime = 0) => {
            for (const child of this.children) {
                if (child.tick) {
                    child.tick(this.state);
                }
            }
            this.renderer.render(this, this.camera);
            if (this.capturing) {
                this.captureFrame();
            }
            if (this.tMax && Math.abs(this.uTime) >= Math.abs(this.tMax)) {
                this.uTime = 0;
                console.info('Луп');
            }
            this.uTime += this.tStep;

            this.frameTime = .001 * (currentTime - previousTime);
            this.averageFrameTime = (this.frameTime + this.averageFrameTime * (this.frame - 1)) / this.frame++;
            this.FPS = 1 / this.frameTime;
            this.averageFPS = 1 / this.averageFrameTime;
            previousTime = currentTime;
            window.requestAnimationFrame(animateScene);
        };
        animateScene();
        console.info("Сцена запущена.");
    }

    captureFrame() {
        this.capturedFrames.push(this.canvas.toDataURL());
        if (this.capturedFrames.length > Math.ceil(this.tMax / this.tStep)) {
            this.capturing = false;
            console.info("Снято.");
            this.download(this.capturedFrames);
        }
    }

    async download(dataUrlList) {
        console.info("Архивация...");
        console.time("Архивация завершена");
        const zip = new JSZip();
        zip.file("_towebm.bat",
            "ffmpeg -framerate 60 -i frame-%%04d.png -c:v libvpx-vp9 -b:v 0 -crf 0 -pass 1 -an -f webm NULL\n" +
            "ffmpeg -framerate 60 -i frame-%%04d.png -c:v libvpx-vp9 -b:v 0 -crf 23 -pass 2 -c:a libopus _result.webm");
        for (let i = 0, length = dataUrlList.length - 1; i < length; i++) {
            const n = `${i}`.padStart(4, '0');
            zip.file(`frame-${n}.png`, dataUrlList[i].replace(/^data:image\/(png|jpg);base64,/, ""), {base64: true});
        }
        const content = await zip.generateAsync({type: "blob"});
        console.timeEnd("Архивация завершена");
        console.log("Скачивание архива...");
        console.time("Скачивание архива завершено");
        saveAs(content, "frames.zip");
        console.timeEnd("Скачивание архива завершено");
    }
}
