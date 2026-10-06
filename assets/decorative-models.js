import * as THREE from './vendor/three-0.180.0/three.module.min.js';

const KINDS = ['controller', 'mouse', 'shield', 'crosshair', 'keys', 'headphones', 'crystal', 'coin', 'spark'];

function palette() {
    const material = (color, metalness = .24, roughness = .48) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
    return {
        shell: material(0x522044, .28, .44),
        graphite: material(0x302335, .20, .57),
        rubber: material(0x211926, .04, .82),
        edge: material(0x88456f, .56, .32),
        pink: material(0xc254aa, .32, .36),
        violet: material(0x8846a0, .30, .42),
        legend: material(0xe2accf, .10, .61)
    };
}

// Coordinates follow the existing 80 × 80 SVG, so native button hit areas stay aligned.
function model(kind, materials) {
    const root = new THREE.Group();
    root.name = kind;
    root.userData.parts = {};
    const point = (x, y, z = 0) => new THREE.Vector3(x - 40, 40 - y, z);
    function add(parent, geometry, material, x = 40, y = 40, z = 0) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(point(x, y, z));
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        parent.add(mesh);
        return mesh;
    }
    function outline(commands) {
        const shape = new THREE.Shape();
        for (const [command, ...values] of commands) {
            const pairs = [];
            for (let i = 0; i < values.length; i += 2) pairs.push(values[i] - 40, 40 - values[i + 1]);
            if (command === 'M') shape.moveTo(...pairs);
            if (command === 'L') shape.lineTo(...pairs);
            if (command === 'Q') shape.quadraticCurveTo(...pairs);
            if (command === 'C') shape.bezierCurveTo(...pairs);
        }
        shape.closePath();
        return shape;
    }
    function extrude(shape, depth, bevel = 1) {
        const geometry = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: true,
            bevelSegments: 3, bevelSize: bevel, bevelThickness: bevel, curveSegments: 10 });
        geometry.translate(0, 0, -depth / 2);
        return geometry;
    }
    function roundGeometry(width, height, depth, radius = 2, bevel = .7) {
        const x = -width / 2, y = -height / 2;
        const shape = new THREE.Shape();
        shape.moveTo(x + radius, y);
        shape.lineTo(x + width - radius, y);
        shape.quadraticCurveTo(x + width, y, x + width, y + radius);
        shape.lineTo(x + width, y + height - radius);
        shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        shape.lineTo(x + radius, y + height);
        shape.quadraticCurveTo(x, y + height, x, y + height - radius);
        shape.lineTo(x, y + radius);
        shape.quadraticCurveTo(x, y, x + radius, y);
        return extrude(shape, depth, bevel);
    }
    const box = (parent, width, height, depth, material, x, y, z, radius = 2) => add(parent, roundGeometry(width, height, depth, radius), material, x, y, z);
    function disc(parent, radius, depth, material, x, y, z) {
        const mesh = add(parent, new THREE.CylinderGeometry(radius, radius, depth, 24), material, x, y, z);
        mesh.rotation.x = Math.PI / 2;
        return mesh;
    }
    function tube(parent, coordinates, radius, material) {
        const curve = new THREE.CatmullRomCurve3(coordinates.map(([x, y, z]) => point(x, y, z)));
        return add(parent, new THREE.TubeGeometry(curve, 28, radius, 8, false), material);
    }
    function part(name) {
        const group = new THREE.Group();
        group.name = name;
        root.userData.parts[name] = group;
        root.add(group);
        return group;
    }

    if (kind === 'controller') {
        const shape = outline([['M', 24, 27], ['L', 56, 27], ['C', 64, 27, 68, 32, 70, 40],
            ['L', 75, 60], ['C', 77, 69, 69, 71, 64, 65], ['L', 53, 54], ['L', 27, 54],
            ['L', 16, 65], ['C', 11, 71, 3, 69, 5, 60], ['L', 10, 40], ['C', 12, 32, 16, 27, 24, 27]]);
        add(root, extrude(shape, 8, 1.3), materials.edge, 40, 40, -.5);
        const face = add(root, extrude(shape, 5.4, 1.3), materials.shell, 40, 40, 1.8);
        face.scale.set(.97, .96, 1);
        const direction = part('direction');
        const cross = outline([['M', 22, 33], ['L', 29, 33], ['L', 29, 40], ['L', 36, 40], ['L', 36, 47],
            ['L', 29, 47], ['L', 29, 54], ['L', 22, 54], ['L', 22, 47], ['L', 15, 47], ['L', 15, 40], ['L', 22, 40]]);
        add(direction, extrude(cross, 2.8, .5), materials.graphite.clone(), 40, 40, 7.4);
        const action = part('action');
        for (const [x, y, color] of [[59, 35, 'violet'], [67, 43, 'pink'], [59, 51, 'edge'], [51, 43, 'violet']]) {
            disc(root, 4, 1, materials.rubber, x, y, 5.8);
            disc(action, 3.2, 2.7, materials[color].clone(), x, y, 7.5);
        }
        for (const x of [33, 47]) {
            disc(root, 4.6, 1.3, materials.edge, x, 55, 5.7);
            disc(root, 3.6, 2.7, materials.rubber, x, 55, 7.7);
        }
        box(root, 7, 1.5, 1, materials.pink, 40, 35, 6.2, .6);
        for (const x of [24, 56]) box(root, 13, 3.4, 4, materials.graphite, x, 25.5, .5, 1.2);
        root.rotation.set(-.17, .26, 0);
    }

    if (kind === 'mouse') {
        const base = add(root, new THREE.SphereGeometry(1, 32, 24), materials.edge, 40, 42, -1.1);
        base.scale.set(27.4, 33.6, 9.2);
        const shell = add(root, new THREE.SphereGeometry(1, 32, 24), materials.shell, 40, 42, .1);
        shell.scale.set(26.7, 33, 9.7);
        const caps = {
            left: [['M', 37, 11], ['C', 23, 12, 15, 22, 15, 39], ['L', 15, 42], ['L', 37, 42]],
            right: [['M', 43, 11], ['C', 57, 12, 65, 22, 65, 39], ['L', 65, 42], ['L', 43, 42]]
        };
        for (const name of ['left', 'right']) {
            const group = part(name);
            const cap = add(group, extrude(outline(caps[name]), 2, .8), materials.shell.clone(), 40, 40, 10);
            cap.rotation.x = -.14;
        }
        box(root, 7, 15, 1.3, materials.rubber, 40, 29, 10, 2.5);
        const wheel = add(root, new THREE.CylinderGeometry(2.5, 2.5, 4.4, 20), materials.graphite, 40, 29, 12);
        wheel.rotation.z = Math.PI / 2;
        for (const y of [26.5, 28.5, 30.5]) box(root, 4.5, .6, .55, materials.edge, 40, y, 13.7, .2);
        box(root, 5.5, 1.2, .7, materials.pink, 40, 57, 9.5, .5);
        root.rotation.set(-.13, .23, 0);
    }

    if (kind === 'shield') {
        const shape = outline([['M', 40, 8], ['L', 64, 18], ['L', 64, 42], ['C', 64, 57, 54, 67, 40, 73],
            ['C', 26, 67, 16, 57, 16, 42], ['L', 16, 18]]);
        add(root, extrude(shape, 7, 1.6), materials.edge);
        const plate = add(root, extrude(shape, 4.5, 1.4), materials.shell, 40, 40, 3.2);
        plate.scale.set(.88, .90, 1);
        for (const angle of [-Math.PI / 4, Math.PI / 4]) {
            const slash = box(root, 31, 3, 1.9, materials.pink, 40, 43, 7.2, 1.2);
            slash.rotation.z = angle;
        }
        for (const [x, y] of [[23, 23], [57, 23], [40, 64]]) disc(root, 1.5, 1, materials.edge, x, y, 7);
        root.rotation.set(-.12, -.30, 0);
    }

    if (kind === 'crosshair') {
        add(root, new THREE.TorusGeometry(26, 2.3, 10, 64), materials.edge);
        add(root, new THREE.TorusGeometry(17, 1.0, 8, 48), materials.graphite, 40, 40, -1);
        for (const [x, y, horizontal] of [[40, 14, false], [40, 66, false], [14, 40, true], [66, 40, true]]) {
            box(root, horizontal ? 19 : 3.5, horizontal ? 3.5 : 19, 4, materials.violet, x, y, 1, 1.3);
        }
        add(root, new THREE.SphereGeometry(3, 16, 12), materials.pink, 40, 40, 1.5);
        root.rotation.set(-.16, -.21, 0);
    }

    if (kind === 'keys') {
        const letters = {
            W: [[-4, 3], [-2, -3], [0, 1], [2, -3], [4, 3]],
            A: [[-4, -3], [0, 3], [4, -3], [2, 0], [-2, 0]],
            S: [[4, 3], [-3, 3], [-4, 1], [3, -1], [4, -3], [-4, -3]],
            D: [[-3, -3], [-3, 3], [1, 3], [4, 1], [4, -1], [1, -3], [-3, -3]]
        };
        for (const [x, y, glyph] of [[40, 20, 'W'], [15, 48, 'A'], [40, 48, 'S'], [65, 48, 'D']]) {
            box(root, 22, 22, 7, materials.edge, x, y, -.3, 3.2);
            box(root, 19.5, 19.5, 4.4, glyph === 'W' ? materials.violet : materials.graphite, x, y, 4, 2.8);
            const coordinates = letters[glyph].map(([dx, dy]) => [x + dx, y - dy, 7.2]);
            for (let i = 1; i < coordinates.length; i += 1) tube(root, [coordinates[i - 1], coordinates[i]], .62, materials.legend);
        }
        root.rotation.set(-.23, .25, 0);
        root.position.y = -2;
    }

    if (kind === 'headphones') {
        add(root, new THREE.TorusGeometry(26, 2.5, 10, 40, Math.PI), materials.edge, 40, 35, 0);
        add(root, new THREE.TorusGeometry(22.5, 2.1, 10, 40, Math.PI), materials.rubber, 40, 35, 1);
        for (const x of [15, 65]) {
            box(root, 4, 13, 5, materials.edge, x, 36, 0, 1.5);
            box(root, 13, 25, 8, materials.shell, x, 48, 1, 4.5);
            box(root, 8.5, 19.5, 3.5, materials.rubber, x, 48, 7, 3);
            box(root, 2, 11, 1.4, materials.violet, x, 48, 9.4, .8);
        }
        tube(root, [[66, 58, 2], [64, 66, 3], [54, 70, 5], [44, 71, 6]], 1.2, materials.graphite);
        box(root, 9, 3.8, 3.4, materials.edge, 41, 71, 6, 1.5);
        root.rotation.set(-.13, -.26, 0);
    }

    if (kind === 'crystal') {
        const shades = [materials.violet.clone(), materials.pink.clone(), materials.violet.clone()];
        shades[2].color.set(0x9780ca);
        shades.forEach(material => { material.flatShading = true; material.roughness = .34; });
        const positions = [];
        const geometry = new THREE.BufferGeometry();
        const facet = (vertices, materialIndex) => {
            const start = positions.length / 3;
            vertices.forEach(vertex => positions.push(...vertex));
            geometry.addGroup(start, vertices.length, materialIndex);
        };
        const ring = (index, y, radius) => {
            const angle = index * Math.PI / 3;
            return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
        };
        for (let i = 0; i < 6; i += 1) {
            const upper = ring(i, 11, 21), nextUpper = ring(i + 1, 11, 21);
            const lower = ring(i, -12, 17), nextLower = ring(i + 1, -12, 17);
            facet([[0, 34, 0], nextUpper, upper], i % 3);
            facet([upper, nextUpper, lower, nextUpper, nextLower, lower], (i + 1) % 3);
            facet([lower, nextLower, [0, -33, 0]], i % 3);
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.computeVertexNormals();
        add(root, geometry, shades);
        root.rotation.set(-.16, .28, -.12);
    }

    if (kind === 'coin') {
        disc(root, 27, 4.8, materials.edge, 40, 40, 0);
        disc(root, 24, .3, materials.graphite, 40, 40, 2.4);
        for (const z of [-2.4, 2.4]) add(root, new THREE.TorusGeometry(26.2, 1.35, 8, 48), materials.pink, 40, 40, z);
        const face = new THREE.Shape();
        face.absarc(0, 0, 24, 0, Math.PI * 2, false);
        const engraving = new THREE.Path();
        engraving.moveTo(0, 15);
        for (const [x, y] of [[3.8, 3.8], [15, 0], [3.8, -3.8], [0, -15], [-3.8, -3.8], [-15, 0], [-3.8, 3.8]]) engraving.lineTo(x, y);
        engraving.closePath();
        face.holes.push(engraving);
        add(root, extrude(face, .8, .25), materials.violet, 40, 40, 2.7);
        // The four-point mark is a shallow cut into the front face, without currency symbols.
        for (let i = 0; i < 12; i += 1) {
            const angle = i * Math.PI / 6;
            const mark = box(root, .9, 2.8, .5, materials.shell, 40 + Math.sin(angle) * 25.7,
                40 - Math.cos(angle) * 25.7, 3.2, .35);
            mark.rotation.z = -angle;
        }
        root.rotation.set(-.12, -.34, .04);
    }

    if (kind === 'spark') {
        const corners = [[40, 5], [46, 33], [74, 40], [46, 47], [40, 75], [34, 47], [6, 40], [34, 33]];
        const shape = outline(corners.map(([x, y], index) => [index ? 'L' : 'M', x, y]));
        add(root, extrude(shape, 3.5, .85), materials.violet);
        const shades = [materials.pink.clone(), materials.violet.clone()];
        shades[1].color.set(0xa28bce);
        shades.forEach(material => {
            material.flatShading = true;
            material.roughness = .34;
            material.emissive.set(0x642052);
            material.emissiveIntensity = .12;
        });
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        for (let i = 0; i < corners.length; i += 1) {
            const a = point(...corners[i], 2.6), b = point(...corners[(i + 1) % corners.length], 2.6);
            // A raised central ridge creates eight broad, readable facets at small sizes.
            positions.push(0, 0, 8.5, b.x, b.y, b.z, a.x, a.y, a.z);
            geometry.addGroup(i * 3, 3, i % 2);
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.computeVertexNormals();
        add(root, geometry, shades);
        root.rotation.set(-.14, .24, .05);
    }

    for (const group of Object.values(root.userData.parts)) {
        group.userData.restZ = group.position.z;
        group.traverse(object => {
            if (object.isMesh) object.userData.restColor = object.material.color.clone();
        });
    }
    return root;
}

function setPressed(root, pressed) {
    const selection = new Set(pressed || []);
    for (const [name, group] of Object.entries(root.userData.parts)) {
        const active = selection.has(name);
        group.position.z = group.userData.restZ - (active ? 1.35 : 0);
        group.traverse(object => {
            if (!object.isMesh) return;
            object.material.color.copy(object.userData.restColor);
            if (active) object.material.color.lerp(new THREE.Color(0xcf60b5), .38);
            object.material.emissive.set(active ? 0x74245d : 0x000000);
            object.material.emissiveIntensity = active ? .36 : 0;
        });
    }
}

/** One WebGL context, copied synchronously into small 2D canvases only when requested. */
export function createDecorativeRenderer({ onContextLost } = {}) {
    if (typeof document === 'undefined') throw new Error('Decorative 3D rendering requires a browser.');
    const surface = document.createElement('canvas');
    const attributes = { alpha: true, antialias: true, powerPreference: 'low-power', premultipliedAlpha: true };
    let context;
    try { context = surface.getContext('webgl2', attributes); } catch (_) { /* Caller keeps SVG fallback. */ }
    if (!context) throw new Error('WebGL2 is unavailable; retain the SVG decorations.');
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: surface, context, ...attributes }); }
    catch (error) { context.getExtension('WEBGL_lose_context')?.loseContext(); throw error; }
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-44, 44, 44, -44, .1, 500);
    camera.position.z = 180;
    scene.add(new THREE.HemisphereLight(0xf1daee, 0x1a1023, 1.8));
    const key = new THREE.DirectionalLight(0xffedf6, 3.7);
    key.position.set(-65, 90, 140);
    key.castShadow = true;
    Object.assign(key.shadow.camera, { left: -65, right: 65, top: 65, bottom: -65, near: .5, far: 350 });
    key.shadow.mapSize.set(512, 512);
    key.shadow.normalBias = .28;
    key.shadow.bias = -.0004;
    key.shadow.radius = 2;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xe27acd, 2.0); rim.position.set(80, 30, 65); scene.add(rim);
    const fill = new THREE.DirectionalLight(0x9166b5, .9); fill.position.set(-30, -60, 80); scene.add(fill);
    const receiver = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), new THREE.ShadowMaterial({ opacity: .30 }));
    receiver.position.z = -30;
    receiver.receiveShadow = true;
    scene.add(receiver);
    const materials = palette();
    const cache = new Map();
    let disposed = false, contextLost = false, drawCount = 0, copyCount = 0, lastSize = '', lastDpr = 0;
    const lost = event => {
        event.preventDefault();
        contextLost = true;
        if (typeof onContextLost === 'function') onContextLost();
    };
    surface.addEventListener('webglcontextlost', lost);

    function render(kind, canvas, pressed = []) {
        if (disposed || contextLost) return false;
        if (!KINDS.includes(kind)) throw new Error(`Unknown decorative model: ${kind}`);
        if (!canvas?.parentElement) return false;
        const width = canvas.parentElement.clientWidth;
        const height = canvas.parentElement.clientHeight;
        if (width < 1 || height < 1) return false;
        const target = canvas.getContext('2d', { alpha: true });
        if (!target) return false;
        const dpr = Math.min(Math.max(globalThis.devicePixelRatio || 1, 1), 2);
        const sizeKey = `${width}:${height}:${dpr}`;
        if (lastSize !== sizeKey) {
            renderer.setPixelRatio(dpr);
            renderer.setSize(width, height, false);
            camera.left = -44 * width / height; camera.right = 44 * width / height;
            camera.updateProjectionMatrix();
            lastSize = sizeKey;
            lastDpr = dpr;
        }
        if (!cache.has(kind)) { const object = model(kind, materials); cache.set(kind, object); scene.add(object); }
        for (const [name, object] of cache) object.visible = name === kind;
        setPressed(cache.get(kind), pressed);
        renderer.render(scene, camera);
        drawCount += 1;
        const physicalWidth = surface.width, physicalHeight = surface.height;
        if (canvas.width !== physicalWidth) canvas.width = physicalWidth;
        if (canvas.height !== physicalHeight) canvas.height = physicalHeight;
        target.clearRect(0, 0, physicalWidth, physicalHeight);
        target.drawImage(surface, 0, 0, physicalWidth, physicalHeight);
        copyCount += 1;
        return true;
    }

    function dispose() {
        if (disposed) return;
        disposed = true;
        surface.removeEventListener('webglcontextlost', lost);
        const geometries = new Set(), usedMaterials = new Set(Object.values(materials)), textures = new Set();
        scene.traverse(object => {
            if (object.geometry) geometries.add(object.geometry);
            const entries = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
            for (const entry of entries) usedMaterials.add(entry);
            object.shadow?.dispose();
        });
        for (const entry of usedMaterials) for (const value of Object.values(entry)) if (value?.isTexture) textures.add(value);
        textures.forEach(texture => texture.dispose());
        geometries.forEach(geometry => geometry.dispose());
        usedMaterials.forEach(entry => entry.dispose());
        cache.clear();
        scene.clear();
        renderer.dispose();
        renderer.forceContextLoss();
        surface.width = 1;
        surface.height = 1;
    }

    return {
        render,
        dispose,
        getStats() {
            return { renderer: 'Three.js', version: THREE.REVISION, sharedContexts: disposed ? 0 : 1,
                cachedModels: [...cache.keys()], draws: drawCount, copies: copyCount,
                dpr: lastDpr, contextLost, disposed, continuousAnimation: false,
                geometries: disposed ? 0 : renderer.info.memory.geometries,
                textures: disposed ? 0 : renderer.info.memory.textures };
        }
    };
}
