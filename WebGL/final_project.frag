varying mediump vec4 v_Color;

precision highp float;
varying vec3 v_Normal;
varying vec3 v_Position;
uniform mat4 u_Model;
uniform mat4 u_World;
uniform mat4 u_Camera;
uniform mat4 u_ModelWorldInverseTranspose;
uniform vec3 u_HouseLight;
uniform vec3 u_MoonLight;
uniform vec3 u_LampLight;
uniform vec3 u_HouseColor;
uniform vec3 u_MoonColor;
uniform vec3 u_LampColor;

// How much "spread" we allow
uniform float u_HouseSpec;
uniform float u_HouseConstant;
uniform float u_HouseLinear;
uniform float u_HouseQuadratic;

uniform float u_LampSpec;
uniform float u_LampConstant;
uniform float u_LampLinear;
uniform float u_LampQuadratic;

uniform float u_MoonSpec;

// tells us whether or not to use lighting at all
// if not, we use a default color
uniform bool u_FlatLighting;

// if we are using flat lighting, give a color to use
uniform vec4 u_FlatColor;

void main() {
    if (u_FlatLighting) {
        // use a slightly faded green "by default"
        gl_FragColor = u_FlatColor;
    }
    else {
        // Calculate positions and normals
        vec3 worldPosition = vec3(u_World * u_Model * vec4(v_Position, 1.0));
        vec3 worldNormal = normalize(vec3(u_ModelWorldInverseTranspose * vec4(v_Normal, 0.0)));
        vec3 cameraSpacePosition = vec3(u_Camera * vec4(worldPosition, 1.0));

        // Work out the direction from our light to our position
        vec3 houseLightDir = normalize(u_HouseLight - worldPosition);
        vec3 lampLightDir = normalize(u_LampLight - worldPosition);
        vec3 moonLightDir = normalize(u_MoonLight - worldPosition);

        // Calculate our fragment diffuse amount
        float houseDiffuse = max(dot(houseLightDir, worldNormal), 0.0);
        float lampDiffuse = max(dot(lampLightDir, worldNormal), 0.0);
        float moonDiffuse = max(dot(moonLightDir, worldNormal), 0.0);

        // Calculate our reflection across the normal and into camera space
        vec3 houseReflectDir = normalize(reflect(-houseLightDir, worldNormal));
        vec3 houseCameraReflectDir = vec3(u_Camera * vec4(houseReflectDir, 0.0));
        vec3 lampReflectDir = normalize(reflect(-lampLightDir, worldNormal));
        vec3 lampCameraReflectDir = vec3(u_Camera * vec4(lampReflectDir, 0.0));
        vec3 moonReflectDir = normalize(reflect(-moonLightDir, worldNormal));
        vec3 moonCameraReflectDir = vec3(u_Camera * vec4(moonReflectDir, 0.0));

        // our camera is at the origin of camera space, so calculate direction from that
        vec3 cameraDir = normalize(vec3(0.0, 0.0, 0.0) - cameraSpacePosition);

        // use the angle to calculate specular
        float houseAngle = max(dot(cameraDir, houseCameraReflectDir), 0.0);
        float houseSpecular = max(pow(houseAngle, u_HouseSpec), 0.0);
        float lampAngle = max(dot(cameraDir, lampCameraReflectDir), 0.0);
        float lampSpecular = max(pow(lampAngle, u_LampSpec), 0.0);
        float moonAngle = max(dot(cameraDir, moonCameraReflectDir), 0.0);
        float moonSpecular = max(pow(moonAngle, u_MoonSpec), 0.0);

        // Attenuation (House/Lamp only)
        float houseDistance = length(u_HouseLight - worldPosition);
        float houseAttenuation = u_HouseConstant + 
        u_HouseLinear * houseDistance + 
        u_HouseQuadratic * houseDistance * houseDistance;
        float lampDistance = length(u_LampLight - worldPosition);
        float lampAttenuation =u_LampConstant + 
        u_LampLinear* lampDistance + 
        u_LampQuadratic * lampDistance * lampDistance;

        // set constant colors for the lights
        // TODO: use textures instead (at least for the non-specular component)
        // vec3 diffuseColor = vec3(1.0, 0.0, 0.0);
        // vec3 specularColor = vec3(1.0, 0.0, 0.0);
        vec3 ambientColor = vec3(0.3);

        // add up and save our components
        vec3 houseColor = ambientColor + 
            houseDiffuse * u_HouseColor + 
            houseSpecular * u_HouseColor;
        vec3 lampColor = ambientColor + 
            lampDiffuse * u_LampColor + 
            lampSpecular * u_LampColor;
        vec3 moonColor = ambientColor + 
            moonDiffuse * u_MoonColor + 
            moonSpecular * u_MoonColor;
        vec3 color = (houseColor / houseAttenuation) + (lampColor / lampAttenuation) + moonColor;
        // vec3 color = ambientColor + (houseColor / houseAttenuation) + (lampColor / lampAttenuation) + moonColor;
        gl_FragColor = vec4(color, 1.0) * v_Color;
        // gl_FragColor = vec4(color, 1.0);
    }
}