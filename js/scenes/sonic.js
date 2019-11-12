export default {
    pointSize: 35,
    pointsCount: 25,
    bang: (sideLength = 25) => {
        const scale = .2;
        const getPos = (n) => {
            const shift = sideLength * .5 - .5;
            const x = Math.floor(n % sideLength);
            const y = Math.floor(n / sideLength);
            return {
                x: (x - shift) * scale,
                y: (y - shift) * scale,
                z: 0,
            };
        };
        const componentsLength = sideLength*sideLength*3;
        const positions = new Float32Array(componentsLength);
        const velocities = new Float32Array(componentsLength);
        for (let i = 0, lasti = componentsLength, offset = 0; i <= lasti; i ++) {
            const pos = getPos(i);
            positions[offset] = pos.x;
            velocities[offset++] = 0;
            positions[offset] = pos.y;
            velocities[offset++] = 0;
            positions[offset] = pos.z;
            velocities[offset++] = 0;
        }
        return {positions, velocities};
    },
    position: `vec3 getPosition(vec3 p) {
    p.x += 1.5;
    return p;
}`,
    sdf: `float getDistance(vec3 p) {
    p.z -= -5.;

    float c = 1.;
    float freq = 5.;
    vec2 waveSrc = vec2(sin(uTime), cos(uTime));
    float a = cos((length(vPosition.xy - waveSrc) - uTime) * freq / c);
    mat2 rotationMatrix = mat2(cos(a), -sin(a), sin(a), cos(a));
    p.yz *= rotationMatrix;

    float torusRadius = 2.;
    float torusThickness = .5;
    vec2 q = vec2(length(p.xy) - torusRadius, p.z);

    float distance = length(q) - torusThickness;
    return distance;
}`,
    sdfMaterial: `Material getMaterial(vec3 p) {
    Material m;
    m.color = vec3(1., .8, 0.);
    m.diffuse = .5;
    m.specular = .1;
    m.ambient = .4;
    m.shininess = 1.;
    m.receiveShadows = 1.;
    return m;
}`,
};