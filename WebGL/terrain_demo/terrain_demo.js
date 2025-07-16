// Last edited by Dietrich Geisler 2025

const VSHADER_SOURCE = `
    attribute vec3 a_Position;
    uniform mat4 u_Model;
    uniform mat4 u_World;
    uniform mat4 u_Camera;
    uniform mat4 u_Projection;
    attribute vec3 a_Color;
    varying vec3 v_Color;
    void main() {
        gl_Position = u_Projection * u_Camera * u_World * u_Model * vec4(a_Position, 1.0);
        v_Color = a_Color;
    }
`

const FSHADER_SOURCE = `
    varying mediump vec3 v_Color;
    void main() {
        gl_FragColor = vec4(v_Color, 1.0);
    }
`

// references to general information
var g_canvas
var gl
var g_lastFrameMS

// GLSL uniform references
var g_u_model_ref
var g_u_world_ref
var g_u_camera_ref
var g_u_projection_ref

// camera/projection
// note that we are using an identity matrix for our terrain for this demo
var g_terrainModelMatrix
var g_terrainWorldMatrix
var g_projectionMatrix

// keep track of the camera position, always looking at (0, height, 0)
var g_cameraDistance
var g_cameraAngle
var g_cameraHeight

// Mesh definition
var g_terrainMesh

// Key states
var g_movingUp
var g_movingDown
var g_movingLeft
var g_movingRight
var g_movingForward
var g_movingBackward

// The size in bytes of a floating point
const FLOAT_SIZE = 4

function main() {
    setupKeyBinds()

    g_canvas = document.getElementById('canvas')

    // Get the rendering context for WebGL
    gl = getWebGLContext(g_canvas, true)
    if (!gl) {
        console.log('Failed to get the rendering context for WebGL')
        return
    }

    // We have no OBJ files to construct for this demo
    startRendering()
}

function startRendering() {
    // Initialize GPU's vertex and fragment shaders programs
    if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
        console.log('Failed to intialize shaders.')
        return
    }

    // class for building the terrain mesh
    var terrainGenerator = new TerrainGenerator()
    // use the current milliseconds as our seed by default
    // TODO: consider setting this as a constant when testing stuff!
    //   just make sure to change it back to something semi-random before submitting :)
    var seed = new Date().getMilliseconds()

    // Setup the options for our terrain generation
    // TODO: try messing around with these options!  
    //   noisefn and roughness in particular give some interesting results when changed
    var options = { 
        width: 100, 
        height: 10, 
        depth: 100, 
        seed: seed,
        noisefn: "wave", // Other options are "simplex" and "perlin"
        roughness: 20
    }

    // construct a terrain mesh of an array of 3-vectors
    // TODO: integrate this with your code!
    var terrain = terrainGenerator.generateTerrainMesh(options)

    // give basic height-based colors based on the 3-vertex specified terrain
    // TODO: make this more interesting (see the function itself)
    var terrainColors = buildTerrainColors(terrain, options.height)

    // "flatten" the terrain above to construct our usual global mesh
    g_terrainMesh = []
    for (var i = 0; i < terrain.length; i++) {
        g_terrainMesh.push(...terrain[i])
    }

    // put the terrain and colors into the VBO
    var data = g_terrainMesh.concat(terrainColors)
    if (!initVBO(new Float32Array(data))) {
        return
    }

    // Send our vertex data to the GPU
    if (!setupVec3('a_Position', 0, 0)) {
        return
    }
    if (!setupVec3('a_Color', 0, g_terrainMesh.length * FLOAT_SIZE)) {
        return
    }

    // Get references to GLSL uniforms
    g_u_model_ref = gl.getUniformLocation(gl.program, 'u_Model')
    g_u_world_ref = gl.getUniformLocation(gl.program, 'u_World')
    g_u_camera_ref = gl.getUniformLocation(gl.program, 'u_Camera')
    g_u_projection_ref = gl.getUniformLocation(gl.program, 'u_Projection')

    // Setup a model and world matrix for our terrain
    // Position can be given by our width/height, 
    //   noting that we are centered initially at the "midpoint"
    // We want to be a bit above the terrain initially so we can see it
    // TODO: resize the terrain as needed to "fit" with your animation
    g_terrainModelMatrix = new Matrix4()
    // move in view of the initial camera
    // TODO: you may want to move your terrain!  This is just placed for the demo
    g_terrainWorldMatrix = new Matrix4().translate(-options.width / 2, -options.height, -options.depth / 2)

    // Initially set our camera to be at the origin, looking in the negative direction
    g_cameraMatrix = new Matrix4().setLookAt(0, 0, 0, 0, 0, -1, 0, 1, 0)

    // Setup a reasonable "basic" perspective projection
    g_projectionMatrix = new Matrix4().setPerspective(90, 1, 1, 1000)

    // Initially place the camera in "front" and above the teapot a bit
    g_cameraDistance = 1.5
    g_cameraAngle = 0
    g_cameraHeight = .2

    // Initialize control values
    g_movingUp = false
    g_movingDown = false
    g_movingLeft = false
    g_movingRight = false
    g_movingForward = false
    g_movingBackward = false

    // Enable culling and depth
    gl.enable(gl.CULL_FACE)
    gl.enable(gl.DEPTH_TEST)

    // Setup for ticks
    g_lastFrameMS = Date.now()

    tick()
}

// tick constants
const ROTATION_SPEED = .05
const CAMERA_SPEED = .01
const CAMERA_ROT_SPEED = .1

// function to apply all the logic for a single frame tick
function tick() {
    // time since the last frame
    var deltaTime

    // calculate deltaTime
    var current_time = Date.now()
    deltaTime = current_time - g_lastFrameMS
    g_lastFrameMS = current_time

    updateCameraPosition(deltaTime)

    draw()

    requestAnimationFrame(tick, g_canvas)
}

// draw to the screen on the next frame
function draw() {
    var cameraMatrix = calculateCameraPosition()

    // Clear the canvas with a black background
    gl.clearColor(0.0, 0.0, 0.0, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // Update with our global transformation matrices
    gl.uniformMatrix4fv(g_u_model_ref, false, g_terrainModelMatrix.elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, g_terrainWorldMatrix.elements)
    gl.uniformMatrix4fv(g_u_camera_ref, false, cameraMatrix.elements)
    gl.uniformMatrix4fv(g_u_projection_ref, false, g_projectionMatrix.elements)

    gl.drawArrays(gl.TRIANGLES, 0, g_terrainMesh.length / 3)
}

/*
 * Helper function to update the camera position each frame
 */
function updateCameraPosition(deltaTime) {
    // move the camera based on user input
    if (g_movingUp) {
        g_cameraHeight += CAMERA_SPEED * deltaTime
    }
    if (g_movingDown) {
        g_cameraHeight -= CAMERA_SPEED * deltaTime
    }
    if (g_movingLeft) {
        g_cameraAngle += CAMERA_ROT_SPEED * deltaTime
    }
    if (g_movingRight) {
        g_cameraAngle -= CAMERA_ROT_SPEED * deltaTime
    }
    if (g_movingForward) {
        // note that moving "forward" means "towards the teapot"
        g_cameraDistance -= CAMERA_SPEED * deltaTime
        // we don't want to hit a distance of 0
        g_cameraDistance = Math.max(g_cameraDistance, 1.0)
    }
    if (g_movingBackward) {
        g_cameraDistance += CAMERA_SPEED * deltaTime
    }
}

/*
 * Helper function to calculate camera position from the properties we update
 * Taken from the lecture 16 demos
 */
function calculateCameraPosition() {
    // Calculate the camera position from our angle and height
    // we get to use a bit of clever 2D rotation math
    // note that we can only do this because we're "fixing" our plane of motion
    // if we wanted to allow arbitrary rotation, we would want quaternions!
    var cameraPosition = new Vector3()
    cameraPosition.x = Math.cos(Math.PI * g_cameraAngle / 180)
    cameraPosition.y = g_cameraHeight
    cameraPosition.z = Math.sin(Math.PI * g_cameraAngle / 180)
    cameraPosition.normalize()
    
    // calculate distance and turn into an array for matrix entry
    var cameraPositionArray = [
        cameraPosition.x * g_cameraDistance,
        cameraPosition.y * g_cameraDistance,
        cameraPosition.z * g_cameraDistance
    ]

    // Build a new lookat matrix each frame
    return new Matrix4().setLookAt(...cameraPositionArray, 0, cameraPositionArray[1], 0, 0, 1, 0)
}

/*
 * Helper function to setup camera movement key binding logic
 * Taken from lecture 16 demos
 */
function setupKeyBinds() {
    // Start movement when the key starts being pressed
    document.addEventListener('keydown', function(event) {
        if (event.key == 'r') {
			g_movingUp = true
		}
        else if (event.key == 'f') {
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
	})

    // End movement on key release
    document.addEventListener('keyup', function(event) {
        if (event.key == 'r') {
			g_movingUp = false
		}
        else if (event.key == 'f') {
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
	})
}

/*
 * Helper to construct _basic_ per-vertex terrain colors
 * We use the height of the terrain to select a color between white and blue
 * Requires that we pass in the height of the terrain (as a number), but feel free to change this
 * TODO: you should expect to modify this helper with custom (or more interesting) colors
 */
function buildTerrainColors(terrain, height) {
    var colors = []
    for (var i = 0; i < terrain.length; i++) {
        // calculates the vertex color for each vertex independent of the triangle
        // the rasterizer can help make this look "smooth"

        // we use the y axis of each vertex alone for color
        // higher "peaks" have more shade
        var shade = (terrain[i][1] / height) + 1/2
        var color = [shade, shade, 1.0]

        // give each triangle 3 colors
        colors.push(...color)
    }

    return colors
}

/*
 * Initialize the VBO with the provided data
 * Assumes we are going to have "static" (unchanging) data
 */
function initVBO(data) {
    // get the VBO handle
    var VBOloc = gl.createBuffer()
    if (!VBOloc) {
        console.log('Failed to create the vertex buffer object')
        return false
    }

    // Bind the VBO to the GPU array and copy `data` into that VBO
    gl.bindBuffer(gl.ARRAY_BUFFER, VBOloc)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)

    return true
}

/*
 * Helper function to load the given vec3 data chunk onto the VBO
 * Requires that the VBO already be setup and assigned to the GPU
 */
function setupVec3(name, stride, offset) {
    // Get the attribute by name
    var attributeID = gl.getAttribLocation(gl.program, `${name}`)
    if (attributeID < 0) {
        console.log(`Failed to get the storage location of ${name}`)
        return false
    }

    // Set how the GPU fills the a_Position variable with data from the GPU 
    gl.vertexAttribPointer(attributeID, 3, gl.FLOAT, false, stride, offset)
    gl.enableVertexAttribArray(attributeID)

    return true
}