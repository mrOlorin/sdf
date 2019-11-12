import Points from './Points.js';
import '../vendor/ace/src-min/ace.js';

export default class Loader {
    constructor(options) {
        this.objects = [];
        this.current = undefined;
        this.options = options;
        this.aceOptions = {
            highlightGutterLine: false,
            printMargin: false,
            mode: 'ace/mode/glsl',
            highlightActiveLine: false,
            maxLines: 15,
            minLines: 3,
        };
        this.initEditors();
        this.initGui();
    }
    async loadScene(sceneName) {
        const defaultScenePath = `./scenes/1.js`;
        let scenePath;
        if (sceneName) {
            scenePath = `./scenes/${sceneName}.js`;
        } else {
            scenePath = defaultScenePath;
        }
        let scene;
        try {
            scene = await (await import (scenePath)).default;
        } catch (e) {
            if (scenePath !== defaultScenePath) {
                scene = await (await import (defaultScenePath)).default;
                console.warn(`Сцена ${sceneName} не найдена. Используем дефолтную.`);
            } else {
                throw e;
            }
        }
        return scene;
    }
    initGui() {
        this.gui = this.options.space.gui.addFolder('Сцена');
    }
    initEditors() {
        this.positionEditor = ace.edit(this.options.editorContainers.position);
        this.positionEditor.setOptions(this.aceOptions);
        this.sdfEditor = ace.edit(this.options.editorContainers.sdf);
        this.sdfEditor.setOptions(this.aceOptions);
        this.sdfMaterialEditor = ace.edit(this.options.editorContainers.material);
        this.sdfMaterialEditor.setOptions(this.aceOptions);
    }
    async createPoints(sceneName) {
        const scene = await this.loadScene(sceneName);
        this.points = new Points();
        this.setEditors(this.points, scene);
        this.points.build(scene);

        this.gui.add(this.points, 'pointSize')
            .min(0)
            .max(1024)
            .step(1)
            .name('Размер')
            .listen();
        this.gui.add(scene, 'pointsCount')
            .min(0)
            .max(100)
            .step(1)
            .name('Количество')
            .onChange(() => {
                scene.pointSize = this.points.pointSize;
                this.points.build(scene);
            });
        this.options.space.add(this.points);
        return this.points;
    };
    setEditors(obj, scene) {
        this.positionEditor.setValue(scene.position);
        this.positionEditor.session.selection.clearSelection();
        this.positionEditor.session.on('change', () => {
            scene.position = this.positionEditor.getValue();
            scene.pointSize = this.points.pointSize;
            obj.build(scene);
        });
        this.sdfEditor.setValue(scene.sdf);
        this.sdfEditor.session.selection.clearSelection();
        this.sdfEditor.session.on('change', () => {
            scene.sdf = this.sdfEditor.getValue();
            scene.pointSize = this.points.pointSize;
            obj.build(scene);
        });
        this.sdfMaterialEditor.setValue(scene.sdfMaterial);
        this.sdfMaterialEditor.session.selection.clearSelection();
        this.sdfMaterialEditor.session.on('change', () => {
            scene.sdfMaterial = this.sdfMaterialEditor.getValue();
            scene.pointSize = this.points.pointSize;
            obj.build(scene);
        });
    }
}
