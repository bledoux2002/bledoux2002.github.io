// Last edited by Benjamin Ledoux 2025

// references to the GLSL programs we need to load
var g_vshader
var g_fshader

// references to general information
var g_canvas
var gl
var g_lastFrameMS

// GLSL uniform references
var g_u_model_ref
var g_u_world_ref
var g_u_camera_ref
var g_u_projection_ref
var g_u_inversetranspose_ref

var g_u_houselight_ref
var g_u_houseColor
var g_u_houseS_ref
var g_u_houseC_ref
var g_u_houseL_ref
var g_u_houseQ_ref

var g_u_lamplight_ref
var g_u_lampColor
var g_u_lampS_ref
var g_u_lampC_ref
var g_u_lampL_ref
var g_u_lampQ_ref

var g_u_moonlight_ref
var g_u_moonColor
var g_u_moonS_ref

var g_u_flatlighting_ref
var g_u_flatcolor_ref

// usual model/world matrices
var g_worldMatrix
var g_projectionMatrix
var g_cameraMatrix
var g_diceModelMatrix
var g_houseModelMatrix
var g_boatModelMatrix
var g_moonModelMatrix
var g_terrainModelMatrix
var g_terrainWorldMatrix
var g_waterModelMatrix

// camera projection values
const g_fovy = 90
const g_aspect = 1
const g_near = 0.1
const g_far = 100

// camera movement/rotation
var g_cameraX
var g_cameraY
var g_cameraZ

var g_quaternion

var g_movingUp
var g_movingDown
var g_movingLeft
var g_movingRight
var g_movingForward
var g_movingBackward
var g_rotatingUp
var g_rotatingDown
var g_rotatingLeft
var g_rotatingRight

var g_pitchControl // Camera Pitch Control swap (true = Standard, false = airplane)

// Meshes
var g_diceMesh
var g_boatMesh
var g_houseMesh
var g_moonMesh
var g_terrainMesh
const g_waterMesh = [
    -50.0, 0.0, -50.0,
    -50.0, 0.0, 50.0,
    50.0, 0.0, 50.0,
    50.0, 0.0, 50.0,
    50.0, 0.0, -50.0,
    -50.0, 0.0, -50.0
]

// Colors
var diceColors
var houseColors
var boatColors
var moonColors
var terrainColors
const waterColors = [
    0.375, 0.625, 1.0, 0.75,
    0.375, 0.625, 1.0, 0.75,
    0.375, 0.625, 1.0, 0.75,
    0.375, 0.625, 1.0, 0.75,
    0.375, 0.625, 1.0, 0.75,
    0.375, 0.625, 1.0, 0.75
]
const g_diceColor = [10.0, 1.5, 1.5, 1.0]
const g_houseColor = [1.0, 1.0, 1.0, 1.0]
const g_boatColor = [0.8, 0.5, 0.2, 1.0]
const g_moonColor = [3.0, 3.0, 2.5, 1.0]


// Normals
var diceNormals
var boatNormals
var houseNormals
var terrainNormals
var waterNormals = [ //try generating them w/ fn?
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
    0, 1, 0
]

// Terrain
var terrainGenerator
var terrain
const options = { 
    width: 100, 
    height: 5, 
    depth: 100, 
    seed: 10,
    noisefn: "perlin", // Options are "wave" "simplex" and "perlin"
    roughness: 5
}

// Lighting
var g_houselightPosition
var g_moonlightPosition
var g_lamplightPosition
// Sliders
var houseSpecS
var houseCS
var houseLS
var houseQS
var lampSpecS
var lampCS
var lampLS
var lampQS
var moonSpecS
// Values
var houseSpec
var houseC
var houseL
var houseQ
var lampSpec
var lampC
var lampL
var lampQ
var moonSpec

// Water Level
var waterS //slider
var g_water //height
var g_underwater //screen overlay

// We're using triangles, so our vertices each have 3 elements
const TRIANGLE_SIZE = 3

// The size (in bytes) of a floating point
const FLOAT_SIZE = 4

function main() {
    g_canvas = document.getElementById('canvas')

    // Get the rendering context for WebGL
    gl = getWebGLContext(g_canvas, true)
    if (!gl) {
        console.log('Failed to get the rendering context for WebGL')
        return
    }

    // HTML Sliders
    setupSliders()

    // Camera Controls
    setupKeyBinds()

    // Terrain Generation
    terrainGenerator = new TerrainGenerator()
    terrain = terrainGenerator.generateTerrainMesh(options)
    // give basic height-based colors based on the 3-vertex specified terrain
    terrainColors = buildTerrainColors()
    // "flatten" the terrain above to construct our usual global mesh
    g_terrainMesh = []
    for (let i = 0; i < terrain.length; i++) {
        g_terrainMesh.push(...terrain[i])
    }

    // Shaders
    loadGLSLFiles()
}

async function loadGLSLFiles() {
    g_vshader = await fetch('./final_project.vert').then(response => response.text()).then((x) => x)
    g_fshader = await fetch('./final_project.frag').then(response => response.text()).then((x) => x)

    // Objects
    loadOBJFiles()
}

/*
 * Helper function to load OBJ files in sequence
 */
async function loadOBJFiles() {
    // open our OBJ file(s)
    data = await fetch('./resources/icosahedron.obj').then(response => response.text()).then((x) => x)
    g_diceMesh = []
    readObjFile(data, g_diceMesh)
    data = await fetch('./resources/boat.obj').then(response => response.text()).then((x) => x)
    g_boatMesh = []
    readObjFile(data, g_boatMesh)
    data = await fetch('./resources/lighthouse.obj').then(response => response.text()).then((x) => x)
    g_houseMesh = []
    readObjFile(data, g_houseMesh)
    data = await fetch('./resources/moon.obj').then(response => response.text()).then((x) => x)
    g_moonMesh = []
    readObjFile(data, g_moonMesh)

    // Wait to load our models before starting to render
    startRendering()
}

function startRendering() {
    // Initialize GPU's vertex and fragment shaders programs
    if (!initShaders(gl, g_vshader, g_fshader)) {
        console.log('Failed to intialize shaders.')
        return
    }

    diceColors = buildMeshColors(g_diceMesh, g_diceColor)
    boatColors = buildMeshColors(g_boatMesh, g_boatColor)
    houseColors = buildMeshColors(g_houseMesh, g_houseColor)
    moonColors = buildMeshColors(g_moonMesh, g_moonColor)

    diceNormals = calculateNormals(g_diceMesh)
    houseNormals = calculateNormals(g_houseMesh)
    boatNormals = calculateNormals(g_boatMesh)
    moonNormals = calculateNormals(g_moonMesh)
    terrainNormals = calculateNormals(g_terrainMesh)
    // waterNormals = calculateNormals(g_waterMesh)

    // initialize the VBO
        // nested in reset() in updateWater(), needs to be reinitialized every time water updated so terrain color can update
    // Set default values of all controls
    reset()

    // Get references to GLSL uniforms
    referenceUniforms()

    // D20 (model)
    g_diceModelMatrix = new Matrix4()
    g_diceModelMatrix = g_diceModelMatrix.setScale(0.2, 0.2, 0.2)
    g_diceModelMatrix.translate(26.0, 50.0, -68.0)

    // Lighthouse
    g_houseModelMatrix = new Matrix4()
    g_houseModelMatrix.scale(0.2, 0.2, 0.2)
    g_houseModelMatrix.translate(25.0, 0.0, -69.0)

    // Boat (model)
    g_boatModelMatrix = new Matrix4()

    // Moon
    g_moonModelMatrix = new Matrix4().translate(0.0, 10.0, 0.0)

    // Setup a model and world matrix for our terrain
    // Position can be given by our width/height, 
    //   noting that we are centered initially at the "midpoint"
    // We want to be a bit above the terrain initially so we can see it
    g_terrainModelMatrix = new Matrix4().translate(0.0, g_water, 0.0)
    // move in view of the initial camera
    g_terrainWorldMatrix = new Matrix4().translate(-options.width / 2, -options.height, -options.depth / 2)

    g_waterModelMatrix = new Matrix4().translate(0.0, 0.0, 0.0)

    // Camera
    // Initially set our camera to be at the origin, looking in the negative direction
    g_cameraMatrix = new Matrix4().setLookAt(0, 0, 0, 0, 0, -1, 0, 1, 0)
    
    g_underwaterMatrix = new Matrix4()
    
    // Setup perspective projection
    g_projectionMatrix = new Matrix4().setPerspective(g_fovy, g_aspect, g_near, g_far)

    // Reposition our mesh (in this case as an identity operation)
    g_worldMatrix = new Matrix4()

    // Initialize control values
    g_movingUp = false
    g_movingDown = false
    g_movingLeft = false
    g_movingRight = false
    g_movingForward = false
    g_movingBackward = false
    
    g_pitchControl = true
    
    // Enable culling and depth tests
    gl.enable(gl.CULL_FACE)
    gl.enable(gl.DEPTH_TEST)
    gl.enable(gl.BLEND) //opacity
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); // Set blending function

    let houseScale = new Vector3([0.2, 0.2, 0.2]) //change to x5? ignore?
    g_houselightPosition = g_diceModelMatrix.multiplyVector3(houseScale)
    
    // Setup for ticks
    g_lastFrameMS = Date.now()

    tick()
}

// extra constants for cleanliness
const ROTATION_SPEED = .05
const CAMERA_SPEED = .01
const CAMERA_ROT_SPEED = .1
const WAVES_SPEED = .001
const WAVES_HEIGHT = 0.075
let time = 0

// function to apply all the logic for a single frame tick
function tick() {
    // time since the last frame
    var deltaTime

    // calculate deltaTime
    var current_time = Date.now()
    deltaTime = current_time - g_lastFrameMS
    g_lastFrameMS = current_time

    updateCameraPosition(deltaTime)

    // rotate the arm constantly around the given axis (of the model)
    angle = ROTATION_SPEED * deltaTime
    g_diceModelMatrix.rotate(-angle, 0, 1, 0)
    
    // Water level oscillating to imitate waves
    time += deltaTime * WAVES_SPEED
    var waves = (Math.sin(time) * WAVES_HEIGHT) + 0.05
    g_waterModelMatrix = new Matrix4().setTranslate(0, waves + g_water - 5.5, 0)
    g_boatModelMatrix.elements[13] = Math.max(waves + g_water - 5.575, -1.25) // Make boat float with water level
    g_moonModelMatrix.setRotate(90.0 - (g_water * 9.0), 0, 0, 1)
    g_moonModelMatrix.translate(0.0, 50.0, 0.0)

    draw()

    requestAnimationFrame(tick, g_canvas)
}

// draw to the screen on the next frame
function draw() {
    // Perspective Projection Matrix
    g_cameraMatrix = calculateCameraPosition()
    g_underwaterMatrix = underwaterMatrix()

    g_moonlightPosition =  g_moonModelMatrix.multiplyVector3(new Vector3())
    g_lamplightPosition =  g_boatModelMatrix.multiplyVector3(new Vector3())

    // Clear the canvas with a black background
    gl.clearColor(0.0, 0.0, 0.0, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // Update with our global transformation matrices
    gl.uniformMatrix4fv(g_u_world_ref, false, g_worldMatrix.elements)
    gl.uniformMatrix4fv(g_u_camera_ref, false, g_cameraMatrix.elements)
    gl.uniformMatrix4fv(g_u_projection_ref, false, g_projectionMatrix.elements)
    
    // don't use flat lighting
    gl.uniform1i(g_u_flatlighting_ref, false)
    
    gl.uniform3fv(g_u_houselight_ref, g_houselightPosition.elements)
    gl.uniform3fv(g_u_houseColor, [1.0, 0.0, 0.0])
    gl.uniform1f(g_u_houseS_ref, houseSpec)
    gl.uniform1f(g_u_houseC_ref, houseC)
    gl.uniform1f(g_u_houseL_ref, houseL)
    gl.uniform1f(g_u_houseQ_ref, houseQ)

    gl.uniform3fv(g_u_lamplight_ref, g_lamplightPosition.elements)
    gl.uniform3fv(g_u_lampColor, [0.0, 1.0, 0.0])
    gl.uniform1f(g_u_lampS_ref, lampSpec)
    gl.uniform1f(g_u_lampC_ref, lampC)
    gl.uniform1f(g_u_lampL_ref, lampL)
    gl.uniform1f(g_u_lampQ_ref, lampQ)

    gl.uniform3fv(g_u_moonlight_ref, g_moonlightPosition.elements)
    gl.uniform3fv(g_u_moonColor, [0.0, 0.0, 1.0])
    gl.uniform1f(g_u_moonS_ref, moonSpec)
    

    // Running length calculator
    var totalVertices = 0
    
    // Dice
    var diceIT = inverseTranspose(g_worldMatrix, g_diceModelMatrix)
    gl.uniformMatrix4fv(g_u_inversetranspose_ref, false, diceIT.elements)
    gl.uniformMatrix4fv(g_u_model_ref, false, g_diceModelMatrix.elements)
    gl.drawArrays(gl.TRIANGLES, 0, g_diceMesh.length / 3)
    
    totalVertices += g_diceMesh.length / 3
    
    // boat
    var boatIT = inverseTranspose(g_worldMatrix, g_boatModelMatrix)
    gl.uniformMatrix4fv(g_u_inversetranspose_ref, false, boatIT.elements)
    gl.uniformMatrix4fv(g_u_model_ref, false, g_boatModelMatrix.elements)
    gl.drawArrays(gl.TRIANGLES, totalVertices, g_boatMesh.length / 3)
    
    totalVertices += g_boatMesh.length / 3
    
    // Lighthouse
    var houseIT = inverseTranspose(g_worldMatrix, g_houseModelMatrix)
    gl.uniformMatrix4fv(g_u_inversetranspose_ref, false, houseIT.elements)
    gl.uniformMatrix4fv(g_u_model_ref, false, g_houseModelMatrix.elements)
    gl.drawArrays(gl.TRIANGLES, totalVertices, g_houseMesh.length / 3)
    
    totalVertices += g_houseMesh.length / 3
    
    // Terrain
    var terrainIT = inverseTranspose(g_worldMatrix, g_terrainModelMatrix)
    gl.uniformMatrix4fv(g_u_inversetranspose_ref, false, terrainIT.elements)
    gl.uniformMatrix4fv(g_u_model_ref, false, g_terrainModelMatrix.elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, g_terrainWorldMatrix.elements)
    gl.drawArrays(gl.TRIANGLES, totalVertices, g_terrainMesh.length / 3)
    
    totalVertices += g_terrainMesh.length / 3

    // Moon
    var moonIT = inverseTranspose(g_worldMatrix, g_moonModelMatrix)
    gl.uniformMatrix4fv(g_u_inversetranspose_ref, false, moonIT.elements)
    gl.uniformMatrix4fv(g_u_model_ref, false, g_moonModelMatrix.elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, new Matrix4().elements)
    gl.drawArrays(gl.TRIANGLES, totalVertices, g_moonMesh.length / 3)

    totalVertices += g_moonMesh.length / 3
    
    // Water
    var waterIT = inverseTranspose(g_worldMatrix, g_waterModelMatrix)
    gl.uniformMatrix4fv(g_u_inversetranspose_ref, false, waterIT.elements)
    gl.uniformMatrix4fv(g_u_model_ref, false, g_waterModelMatrix.elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, new Matrix4().elements)
    gl.drawArrays(gl.TRIANGLES, totalVertices, g_waterMesh.length / 3)
    
    totalVertices += g_waterMesh.length / 3

    // Underwater Screen
    gl.uniform1i(g_u_flatlighting_ref, true)
    gl.uniformMatrix4fv(g_u_model_ref, false, g_underwaterMatrix.elements)
    gl.uniform4fv(g_u_flatcolor_ref, [0.375, 0.625, 1.0, 0.25])
    if (g_underwater) {
        gl.drawArrays(gl.TRIANGLES, totalVertices, g_waterMesh.length / 3)
    }
}


// Helper Functions

function setupSliders() {
    waterS = document.getElementById('water')
    waterS.addEventListener('input', (event) => {
        updateWater(event.target.value)
    })

    // Lighthouse
    houseSpecS = document.getElementById('houseSpecS')
    houseSpecS.addEventListener('input', (event) => {
        houseSpec = updateLight(event.target.value, 'houseSpec', 'Lighthouse Specular')
    })
    houseCS = document.getElementById('houseCS')
    houseCS.addEventListener('input', (event) => {
        houseC = updateLight(event.target.value, 'houseC', 'Lighthouse Constant')
    })
    houseLS = document.getElementById('houseLS')
    houseLS.addEventListener('input', (event) => {
        houseL = updateLight(event.target.value, 'houseL', 'Lighthouse Linear')
    })
    houseQS = document.getElementById('houseQS')
    houseQS.addEventListener('input', (event) => {
        houseQ = updateLight(event.target.value, 'houseQ', 'Lighthouse Quadratic')
    })

    // Boat
    lampSpecS = document.getElementById('lampSpecS')
    lampSpecS.addEventListener('input', (event) => {
        lampSpec = updateLight(event.target.value, 'lampSpec', 'Boat Lamp Specular')
    })
    lampCS = document.getElementById('lampCS')
    lampCS.addEventListener('input', (event) => {
        lampC = updateLight(event.target.value, 'lampC', 'Boat Lamp Constant')
    })
    lampLS = document.getElementById('lampLS')
    lampLS.addEventListener('input', (event) => {
        lampL = updateLight(event.target.value, 'lampL', 'Boat Lamp Linear')
    })
    lampQS = document.getElementById('lampQS')
    lampQS.addEventListener('input', (event) => {
        lampQ = updateLight(event.target.value, 'lampQ', 'Boat Lamp Quadratic')
    })

    // Moon
    moonSpecS = document.getElementById('moonSpecS')
    moonSpecS.addEventListener('input', (event) => {
        moonSpec = updateLight(event.target.value, 'moonSpec', 'Moon Specular')
    })

}

function updateWater(amount) {
    label = document.getElementById('waterLabel')
    label.textContent = `Water Level: ${Number(amount).toFixed(2)}`
    g_water = Number(amount)
    terrainColors = buildTerrainColors() // Update terrain colors to reflect water level (where does grass stop and mud begin?)
    reinitalizeVBO()
}

function updateLight(amount, id, text, variable) {
    label = document.getElementById(id)
    num = Number(amount)
    label.textContent = `${text}: ${num.toFixed(2)}`
    return num
}

function reinitalizeVBO() {
    var data = g_diceMesh.concat(g_boatMesh).concat(g_houseMesh).concat(g_terrainMesh).concat(g_moonMesh).concat(g_waterMesh).concat(g_waterMesh).concat(diceColors).concat(boatColors).concat(houseColors).concat(terrainColors).concat(moonColors).concat(waterColors).concat(waterColors).concat(diceNormals).concat(boatNormals).concat(houseNormals).concat(terrainNormals).concat(waterNormals).concat(waterNormals)
    if (!initVBO(new Float32Array(data))) {
        return -1
    }

    // Send our vertex data to the GPU
    if (!setupVec('a_Position', 3, 0, 0)) {
        return -1
    }
    if (!setupVec('a_Color', 4, 0, (g_diceMesh.length + g_boatMesh.length + g_houseMesh.length + g_terrainMesh.length + g_moonMesh.length + g_waterMesh.length + g_waterMesh.length) * FLOAT_SIZE)) {
        return -1
    }
    if (!setupVec('a_Normal', 3, 0, (g_diceMesh.length + g_boatMesh.length + g_houseMesh.length + g_terrainMesh.length + g_moonMesh.length + g_waterMesh.length + g_waterMesh.length + diceColors.length + boatColors.length + houseColors.length + terrainColors.length + moonColors.length + waterColors.length + waterColors.length) * FLOAT_SIZE)) {
        return -1
    }
}

/*
 * Initialize the VBO with the provided data
 * Assumes we are going to have "static" (unchanging) data
 */
function initVBO(data) {
    // get the VBO handle
    var VBOloc = gl.createBuffer()
    if (!VBOloc) {
        return false
    }

    // Bind the VBO to the GPU array and copy `data` into that VBO
    gl.bindBuffer(gl.ARRAY_BUFFER, VBOloc)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)

    return true
}

/*
 * Helper function to load the given vec3 or vec4 data chunk onto the VBO
 * Requires that the VBO already be setup and assigned to the GPU
 * Modified to be interchangeable with vec4 as well (water opacity)
 */
function setupVec(name, length, stride, offset) {
    // Get the attribute by name
    var attributeID = gl.getAttribLocation(gl.program, `${name}`)
    if (attributeID < 0) {
        console.log(`Failed to get the storage location of ${name}`)
        return false
    }

    // Set how the GPU fills the a_Position variable with data from the GPU 
    gl.vertexAttribPointer(attributeID, length, gl.FLOAT, false, stride, offset)
    gl.enableVertexAttribArray(attributeID)

    return true
}

/*
 * Helper function to setup camera movement key binding logic
 * Taken from terrain_demo.js (by extension lecture 16 demos)
 */
function setupKeyBinds() {
    document.addEventListener('keydown', function(event) {
        //console.log(event)
        if (event.key == ' ') {
			g_movingUp = true
		}
        else if (event.key == 'Shift') {
			g_movingDown = true
		}
        else if (event.key == 'a') {
			g_movingLeft = true
		}
        else if (event.key == 'd') {
			g_movingRight = true
		}
		else if (event.key == 'w') {
			g_movingForward = true
		}
		else if (event.key == 's') {
			g_movingBackward = true
		}
        else if (event.key == 'ArrowLeft') {
			g_rotatingLeft = true
		}
        else if (event.key == 'ArrowRight') {
			g_rotatingRight = true
		}
		else if (event.key == 'ArrowUp') {
			if (g_pitchControl) {
                g_rotatingUp = true
            } else {
                g_rotatingDown = true
            }
		}
		else if (event.key == 'ArrowDown') {
            if (g_pitchControl) {
                g_rotatingDown = true
            } else {
                g_rotatingUp = true
            }
		}
	})

    document.addEventListener('keyup', function(event) {
        //console.log(event)
        if (event.key == ' ') {
			g_movingUp = false
		}
        else if (event.key == 'Shift') {
			g_movingDown = false
		}
        else if (event.key == 'a') {
			g_movingLeft = false
		}
        else if (event.key == 'd') {
			g_movingRight = false
		}
		else if (event.key == 'w') {
			g_movingForward = false
		}
		else if (event.key == 's') {
			g_movingBackward = false
		}
        else if (event.key == 'ArrowLeft') {
			g_rotatingLeft = false
		}
        else if (event.key == 'ArrowRight') {
			g_rotatingRight = false
		}
		else if (event.key == 'ArrowUp') {
            if (g_pitchControl) {
                g_rotatingUp = false
            } else {
                g_rotatingDown = false
            }
		}
		else if (event.key == 'ArrowDown') {
            if (g_pitchControl) {
                g_rotatingDown = false
            } else {
                g_rotatingUp = false
            }
		}
	})
}

/*
 * Helper to construct per-vertex terrain colors
 * Use height of terrain to select color between green and brown
 */
function buildTerrainColors() {
    var colors = []
    for (let i = 0; i < terrain.length; i++) {
        // This was really annoying to figure out how to get it to reflect the water level
        if (terrain[i][1] - g_water < -5) {
            var color = [0.5, 0.25, 0.125, 1.0]
        } else {
            var color = [1.0, 1.0, 1.0, 1.0]
        }
        colors.push(...color)
    }
    return colors
}

function buildMeshColors(mesh, color) {
    colors = []

    for (let i = 0; i < mesh.length / 3; i++) {
        colors.push(...color)
    }

    return colors
}

/*
https://stackoverflow.com/questions/19350792/calculate-normal-of-a-single-triangle-in-3d-space
*/
function calculateNormals(mesh) {
    normals = []
    for (let i = 0; i < mesh.length; i += 9) {
        let N = new Vector3()
        let p1 = new Vector3()
        p1.x = mesh[i]
        p1.y = mesh[i + 1]
        p1.z = mesh[i + 2]
        let p2 = new Vector3()
        p2.x = mesh[i + 3]
        p2.y = mesh[i + 4]
        p2.z = mesh[i + 5]
        let p3 = new Vector3()
        p3.x = mesh[i + 6]
        p3.y = mesh[i + 7]
        p3.z = mesh[i + 8]
        let A = new Vector3()
        A.x = p2.x - p1.x
        A.y = p2.y - p1.y
        A.z = p2.z - p1.z
        let B = new Vector3()
        B.x = p3.x - p1.x
        B.y = p3.y - p1.y
        B.z = p3.z - p1.z
        N.x = A.y * B.z - A.z * B.y
        N.y = A.z * B.x - A.x * B.z
        N.z = A.x * B.y - A.y * B.x
        N = N.normalize()
        normals.push(...[N.x, N.y, N.z])
        normals.push(...[N.x, N.y, N.z])
        normals.push(...[N.x, N.y, N.z])
    }
    return normals
}

// Set all sliders and cam matrix to default
function reset() {
    g_cameraZ = 5
    g_cameraX = 0
    g_cameraY = options.height / 2 + 1

    resetOrientation()

    waterS.value = 5
    houseSpecS.value = 16
    houseCS.value = 1
    houseLS.value = 0.1
    houseQS.value = 0.1
    lampSpecS.value = 16
    lampCS.value = 1
    lampLS.value = 0.1
    lampQS.value = 0.1
    moonSpecS.value = 16

    updateWater(5)
    houseSpec = updateLight(16, 'houseSpec', 'Lighthouse Specular')
    houseC = updateLight(1, 'houseC', 'Lighthouse Constant')
    houseL = updateLight(0.1, 'houseL', 'Lighthouse Linear')
    houseQ = updateLight(0.1, 'houseQ', 'Lighthouse Quadratic')
    lampSpec = updateLight(16, 'lampSpec', 'Boat Lamp Specular')
    lampC = updateLight(1, 'lampC', 'Boat Lamp Constant')
    lampL = updateLight(0.1, 'lampL', 'Boat Lamp Linear')
    lampQ = updateLight(0.1, 'lampQ', 'Boat Lamp Quadratic')
    moonSpec = updateLight(16, 'moonSpec', 'Moon Specular')
    
}

// Reset cam orientation w/o reseting terrain or cam location for convenience
function resetOrientation() {
    g_quaternion = new Quaternion(0, 0, 0, 1)
}

// Change between standard and airplane controls for camera pitch
function swapPitch() {
    button = document.getElementById('pitchButton')
    if (g_pitchControl) {
        button.value="Airplane Pitch"
        g_pitchControl = false
    } else {
        button.value="Standard Pitch"
        g_pitchControl = true
    }
}

function referenceUniforms() {
    g_u_projection_ref = gl.getUniformLocation(gl.program, 'u_Projection')
    g_u_camera_ref = gl.getUniformLocation(gl.program, 'u_Camera')
    g_u_world_ref = gl.getUniformLocation(gl.program, 'u_World')
    g_u_model_ref = gl.getUniformLocation(gl.program, 'u_Model')
    g_u_inversetranspose_ref = gl.getUniformLocation(gl.program, 'u_ModelWorldInverseTranspose')

    g_u_houselight_ref = gl.getUniformLocation(gl.program, 'u_HouseLight')
    g_u_houseColor = gl.getUniformLocation(gl.program, 'u_HouseColor')
    g_u_houseS_ref = gl.getUniformLocation(gl.program, 'u_HouseSpec')
    g_u_houseC_ref = gl.getUniformLocation(gl.program, 'u_HouseConstant')
    g_u_houseL_ref = gl.getUniformLocation(gl.program, 'u_HouseLinear')
    g_u_houseQ_ref = gl.getUniformLocation(gl.program, 'u_HouseQuadratic')

    g_u_lamplight_ref = gl.getUniformLocation(gl.program, 'u_LampLight')
    g_u_lampColor = gl.getUniformLocation(gl.program, 'u_LampColor')
    g_u_lampS_ref = gl.getUniformLocation(gl.program, 'u_LampSpec')
    g_u_lampC_ref = gl.getUniformLocation(gl.program, 'u_LampConstant')
    g_u_lampL_ref = gl.getUniformLocation(gl.program, 'u_LampLinear')
    g_u_lampQ_ref = gl.getUniformLocation(gl.program, 'u_LampQuadratic')

    g_u_moonlight_ref = gl.getUniformLocation(gl.program, 'u_MoonLight')
    g_u_moonColor = gl.getUniformLocation(gl.program, 'u_MoonColor')
    g_u_moonS_ref = gl.getUniformLocation(gl.program, 'u_MoonSpec')

    g_u_flatlighting_ref = gl.getUniformLocation(gl.program, 'u_FlatLighting')
    g_u_flatcolor_ref = gl.getUniformLocation(gl.program, 'u_FlatColor')
}

/*
 * Helper function to update the camera position each frame
 * Adapted from terrain_demo.js
 */
function updateCameraPosition(deltaTime) {

    // These let the camera move relative to the direction its facing
    // I make different ones in calculateCameraPosition. I could probably consolidate these into global vectors but I'm lazy and this works
    var forward = new Vector3()
    forward.x = 0
    forward.y = 0
    forward.z = -1
    var right = new Vector3()
    right.x = 1
    right.y = 0
    right.z = 0
    var up = new Vector3()
    up.x = 0
    up.y = 1
    up.z = 0

    forward = g_quaternion.multiplyVector3(forward);
    right = g_quaternion.multiplyVector3(right);
    up = g_quaternion.multiplyVector3(up);

    if (g_movingUp) {
        g_cameraX += up.x * CAMERA_SPEED * deltaTime;
        g_cameraY += up.y * CAMERA_SPEED * deltaTime;
        g_cameraZ += up.z * CAMERA_SPEED * deltaTime;
    }
    if (g_movingDown) {
        g_cameraX -= up.x * CAMERA_SPEED * deltaTime;
        g_cameraY -= up.y * CAMERA_SPEED * deltaTime;
        g_cameraZ -= up.z * CAMERA_SPEED * deltaTime;
    }
    if (g_movingLeft) {
        g_cameraX -= right.x * CAMERA_SPEED * deltaTime;
        g_cameraY -= right.y * CAMERA_SPEED * deltaTime;
        g_cameraZ -= right.z * CAMERA_SPEED * deltaTime;
    }
    if (g_movingRight) {
        g_cameraX += right.x * CAMERA_SPEED * deltaTime;
        g_cameraY += right.y * CAMERA_SPEED * deltaTime;
        g_cameraZ += right.z * CAMERA_SPEED * deltaTime;
    }

    if (g_movingForward) {
        g_cameraX += forward.x * CAMERA_SPEED * deltaTime;
        g_cameraY += forward.y * CAMERA_SPEED * deltaTime;
        g_cameraZ += forward.z * CAMERA_SPEED * deltaTime;
    }
    if (g_movingBackward) {
        g_cameraX -= forward.x * CAMERA_SPEED * deltaTime;
        g_cameraY -= forward.y * CAMERA_SPEED * deltaTime;
        g_cameraZ -= forward.z * CAMERA_SPEED * deltaTime;
    }

    // AHHHHHHHH Quaternions
    if (g_rotatingUp) {
        let pitch = new Quaternion(0, 0, 0, 1).setFromAxisAngle(1, 0, 0, CAMERA_ROT_SPEED * deltaTime)
        g_quaternion = g_quaternion.multiplySelf(pitch)
    }
    
    if (g_rotatingDown) {
        let pitch = new Quaternion(0, 0, 0, 1).setFromAxisAngle(1, 0, 0, -CAMERA_ROT_SPEED * deltaTime)
        g_quaternion = g_quaternion.multiplySelf(pitch)
    }
    
    if (g_rotatingLeft) {
        let yaw = new Quaternion(0, 0, 0, 1).setFromAxisAngle(0, 1, 0, CAMERA_ROT_SPEED * deltaTime)
        g_quaternion = g_quaternion.multiplySelf(yaw)
    }
    
    if (g_rotatingRight) {
        let yaw = new Quaternion(0, 0, 0, 1).setFromAxisAngle(0, 1, 0, -CAMERA_ROT_SPEED * deltaTime)
        g_quaternion = g_quaternion.multiplySelf(yaw)
    }
    
    g_quaternion.normalize()
}

/*
 * Helper function to calculate camera position from the properties we update
 * Adapted from terrain_demo.js (by extension lecture 16 demos)
 */
function calculateCameraPosition() {
    // Cam coords (redundant but clearer) vector
    var eye = new Vector3()
    eye.x = g_cameraX
    eye.y = g_cameraY
    eye.z = g_cameraZ

    // Forward (view direction) vector
    var forward = new Vector3()
    forward.x = 0
    forward.y = 0
    forward.z = -1

    // Apply cam rotation to forward vec
    forward = g_quaternion.multiplyVector3(forward)

    // Center (view point) vector
    var center = new Vector3()
    center.x = eye.x + forward.x,
    center.y = eye.y + forward.y,
    center.z = eye.z + forward.z

    // Up (orientation) vector
    var up = new Vector3()
    up.x = 0
    up.y = 1
    up.z = 0

    // Apply cam rotation to up vec
    up = g_quaternion.multiplyVector3(up)

    // Cam Matrix (translated and rotated)
        // Lecture 9
    var camMatrix = new Matrix4().setLookAt(
        eye.x, eye.y, eye.z,
        center.x, center.y, center.z,
        up.x, up.y, up.z
    )

    // If cam below water level, inform the masses
    if (eye.y < g_water - 5.4) {
        g_underwater = true
    } else {
        g_underwater = false
    }

    // console.log(camMatrix)
    return camMatrix
}

// Places "underwater" plane directly in front of camera
    // ALSO really annoying to figure out for some reason
    // Use camera matrix as base so no matter where camera goes the plane is always in same relative position
    // CITATION HERE: I used ChatGPT here to figure out why everything looked wonky during development. I was missing matrix.invert()
function underwaterMatrix() {
    matrix = new Matrix4().concat(g_cameraMatrix)
    matrix.invert()
    matrix.rotate(90, 1, 0, 0)
    matrix.translate(0, -0.1001, 0)
    matrix.scale(0.01, 0.01, 0.01)
    return matrix
}

function inverseTranspose(world, model) {
    var inverseTranspose = new Matrix4(world).multiply(model)
    inverseTranspose.invert().transpose()
    return inverseTranspose
}