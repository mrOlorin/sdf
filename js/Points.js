import * as THREE from "../vendor/three.module.js";

export default class Points extends THREE.Points {
    tick(time) {
        if(!this.material.uniforms) return;
        this.material.uniforms.tMax.value = time.tMax;
        this.material.uniforms.tStep.value = time.tStep;
        this.material.uniforms.uTime.value = time.uTime;
    }
    set pointSize(pointSize) {
        this.material.uniforms.pointSize.value = pointSize;
    }
    get pointSize() {
        return this.material.uniforms.pointSize.value;
    }
    build(params) {
        console.time("Объект создан");
        if (!params.bang) {
            console.warn("Не задано распределение.");
            console.warn("Объект не создан.");
            return;
        }
        this.material = this.buildMaterial(params);
        this.geometry = new THREE.BufferGeometry();
        let bang;
        if ("function" === typeof params.bang) {
            bang = params.bang(params.pointsCount);
        } else {
            bang = params.bang;
        }
        this.positions = bang.positions;
        this.velocities = bang.velocities;
        this.geometry.addAttribute("position", new THREE.BufferAttribute(this.positions, 3));
        this.geometry.addAttribute("velocity", new THREE.BufferAttribute(this.velocities, 3));
        console.timeEnd("Объект создан");
    }

    buildMaterial(params) {
        if (!params.position) {
            console.warn("params.position");
            return;
        }
        if (!params.sdf) {
            console.warn("params.sdf");
            return;
        }
        if (!params.sdfMaterial) {
            console.warn("params.sdfMaterial");
            return;
        }
        if (!params.pointSize) {
            console.warn("Не задан размер точки.");
            return;
        }
        return new THREE.ShaderMaterial({
            extensions: {
                derivatives: false,
                fragDepth: false,
                drawBuffers: true,
                shaderTextureLOD: false,
            },
            uniforms: {
                tMax: {value: 0.0},
                tStep: {value: 0.0},
                uTime: {value: 0.0},
                pointSize: {value: params.pointSize},
            },

            vertexShader: `
                varying vec3 vColor;
                varying vec4 vPosition;
                in vec3 velocity;
                uniform float pointSize;
                uniform float tMax;
                uniform float tStep;
                uniform float uTime;
                out mat3 camera;
                out vec3 lightPos;
                ${params.position}
                void main() {
                    vec3 p = getPosition(position);
                    lightPos = p-vec3(3.,0.,0);
                    vec3 rayDirection = vec3(0,0,-1);
                    vec3 forward = normalize(rayDirection);
                    vec3 right = normalize(cross(vec3(0., 1., 0.), forward));
                    vec3 up = normalize(cross(forward, right));
                    camera = mat3(right, up, forward);

                    gl_PointSize = pointSize;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4( p, 1.0 );
                    vPosition = gl_Position;
                }
            `,
            fragmentShader: `
                #define MAX_STEPS 256
                #define PLANK_LENGTH .001
                #define FOG_DIST 501.
                #define MAX_DIST FOG_DIST
                #define FOG_COLOR vec3(1.,1.,1.)
                in vec3 lightPos;
                in mat3 camera;
                varying vec3 vColor;
                varying vec4 vPosition;
                uniform float pointSize;
                uniform float tMax;
                uniform float tStep;
                uniform float uTime;
                const vec3 gammaCorrection = vec3(1.0 / 2.2);
                struct Material {
                    vec3 color;
                    float diffuse;
                    float specular;
                    float ambient;
                    float shininess;
                    float reflection;
                    float transparency;
                    float ior;
                    float receiveShadows;
                };
                struct HitObject {
                    vec3 point;
                    float distance;
                    Material material;
                };
                ${params.sdf}
                ${params.sdfMaterial}
                void rayMarch(inout HitObject obj, in vec3 rayOrigin, in vec3 rayDirection, float plankLength) {
                    float stepDistance;
                    obj.distance = plankLength;
                    for (int i = 0; i < MAX_STEPS; i++) {
                        stepDistance = abs(getDistance(rayOrigin + rayDirection * obj.distance));
                        obj.distance += stepDistance;
                        if (stepDistance < plankLength) {
                            break;
                        }
                        if (obj.distance >= FOG_DIST) {
                            break;
                        }
                    }
                    obj.point = rayOrigin + rayDirection * obj.distance;
                }
                vec3 getNormal(in vec3 point) {
                    vec2 offset = vec2(.01, 0);
                    return normalize(getDistance(point) - vec3(
                        getDistance(point - offset.xyy),
                        getDistance(point - offset.yxy),
                        getDistance(point - offset.yyx)
                    ));
                }
                // https://www.youtube.com/watch?v=TnhM0xc_zFc
                vec3 blend(in vec3 color, in vec3 blendColor, in float blendAmount) {
                    return color * (1. - blendAmount) + blendColor * blendAmount;
                }
                float softShadow(in vec3 point, in vec3 lightDir) {
                    point += lightDir * .1;
                    float totalDist = .1;
                    float result = 1.;
                    float d;
                    for ( int i = 0; i < 32; i ++ ) {
                        d = getDistance(point);
                        if (d <= PLANK_LENGTH) return 0.;
                        result = min(result, d / (totalDist * .001));
                        totalDist += d;
                        if (totalDist > 10.) return result;
                        point += lightDir * d;
                    }
                    return result;
                }
                // https://www.shadertoy.com/view/wd2SWD
                float calcAO(in vec3 p, in vec3 n) {
                    float k = 1.;
                    float occ = 0.;
                    float len;
                    for ( float i = 1.; i < 6.; i += 1. ) {
                        len = .15 * i;
                        occ += (len - getDistance(n * len + p)) * k;
                        k *= .5;
                    }
                    return clamp(1. - occ, 0., 1.);
                }
                vec3 phongLighting(in vec3 point, in Material mat, in vec3 ray) {
                    vec3 normal = getNormal(point);
                    vec3 lightDir = normalize(lightPos - point);
                    float diffuse = max(0., mat.diffuse * dot(normal, lightDir));
                    float specular = pow(max(0., mat.specular * dot(lightDir, reflect(ray, normal))), mat.shininess);
                    float shadow = mat.receiveShadows * softShadow(point, lightDir) * calcAO(point, normal);
                    return (mat.ambient + diffuse * shadow) * pow(mat.color, gammaCorrection) + specular * shadow * vec3(1.);
                }
                vec4 getColor(in vec3 origin, in vec3 direction) {
                    HitObject hitObject;
                    rayMarch(hitObject, origin, direction, PLANK_LENGTH);
                    if (hitObject.distance >= FOG_DIST) {
                        discard;
                    }
                    hitObject.material = getMaterial(hitObject.point);
                    vec3 color = phongLighting(hitObject.point, hitObject.material, direction);
                    return vec4(color, 1.);//blend(color, FOG_COLOR, hitObject.distance / FOG_DIST);
                }
                void main() {
                    vec2 uv = gl_PointCoord - vec2(.5);
                    gl_FragColor = getColor(vec3(0,0,0), normalize(camera * vec3(uv, .6)));
                }
            `,
            blending: THREE.NoBlending,
            depthTest: true,
            transparent: true
        });
    }

}
