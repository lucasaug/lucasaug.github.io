let gl = null;
let glCanvas = null;
let initTime = new Date();

let mouseX = 0;
let mouseY = 0;

if (matchMedia('(pointer:fine)').matches) {
    window.onmousemove = (event) => {
        mouseX = event.screenX;
        mouseY = event.screenY;
    };
}

// Code created following the tutorial at
// https://wdf-dev.gitlab.io/background-intro.html

function initwebGL() {
    glCanvas = document.getElementById("glcanvas");
    gl = glCanvas.getContext("webgl");
}

function compileShader(id, type) {
    let code = document.getElementById(id).firstChild.nodeValue;
    let shader = gl.createShader(type);

    gl.shaderSource(shader, code);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.log(`Error compiling ${type === gl.VERTEX_SHADER ? "vertex" :
            "fragment"} shader:`);
        console.log(gl.getShaderInfoLog(shader));
    }
    return shader;
}

function buildShaderProgram(shaderInfo, uniforms, attributes) {
    let program = gl.createProgram();

    shaderInfo.forEach(function(desc) {
        let shader = compileShader(desc.id, desc.type);

        if (shader) {
            gl.attachShader(program, shader);
        }
    });

    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.log("Error linking shader program:");
        console.log(gl.getProgramInfoLog(program));
    }

    var uniforms_dict = {}
    uniforms.forEach(function(name) {
        uniform_id = gl.getUniformLocation(program, name);
        uniforms_dict[name] = uniform_id;
    });

    var attributes_dict = {}
    attributes.forEach(function(name) {
        attrib_id = gl.getAttribLocation(program, name);
        attributes_dict[name] = attrib_id;
    });

    return {
        program:program,
        uniforms:uniforms_dict,
        attributes:attributes_dict
    };
}

// Vertex information
let vertexBuffer;
let vertexCount;

window.addEventListener("load", startup, false);

function startup() {
    initwebGL();

    const shaderSet = [
    {
      type: gl.VERTEX_SHADER,
      id: "vertex-shader"
    },
    {
      type: gl.FRAGMENT_SHADER,
      id: "fragment-shader"
    }
    ];
    const shaderUniforms = [
        "iResolution",
        "iTime",
        "iMouse",
    ];
    const shaderAttributes = [
        "aVertexPosition",
    ];
    shaderProgram = buildShaderProgram(shaderSet,
                                     shaderUniforms,
                                     shaderAttributes);
    // console.log(shaderProgram)

    // Here are attributes for 4 vertices (one per line):
    // - Two numbers for the vertex positions.
    let vertices = new Float32Array([
      -1,  1,
       1,  1,
      -1, -1,
       1, -1
    ]);

    vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    vertexCount = vertices.length / 2;

    animateScene();
}

function resize(canvas) {
    // Look up the size the browser is displaying the canvas.
    var displayWidth  = canvas.clientWidth;
    var displayHeight = canvas.clientHeight;

    // Check if the canvas has different size and make it the same.
    if (canvas.width  !== displayWidth ||
        canvas.height !== displayHeight)
    {
        canvas.width  = displayWidth;
        canvas.height = displayHeight;
    }
}

function animateScene() {
    // We need an actual window size for correctly viewport setup.
    resize(glCanvas);

    // Setup viewport and clear it with black non transparent colour.
    gl.viewport(0, 0, glCanvas.width, glCanvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Select a buffer for vertices attributes.
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

    // Enable and setup attributes.
    gl.enableVertexAttribArray(shaderProgram.attributes["aVertexPosition"]);
    gl.vertexAttribPointer(shaderProgram.attributes["aVertexPosition"], 2,
        gl.FLOAT, false, 4 * 2, 0);

    // Select shader program.
    gl.useProgram(shaderProgram.program);

    const vw = Math.max(document.documentElement.clientWidth || 0,
        window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight || 0,
        window.innerHeight || 0);

    const elapsedSec = ((new Date()) - initTime) / 1000;

    gl.uniform2fv(shaderProgram.uniforms["iResolution"],
        new Float32Array([vw, vh]));
    gl.uniform1f(shaderProgram.uniforms["iTime"],
        new Float32Array([elapsedSec]));
    gl.uniform2fv(shaderProgram.uniforms["iMouse"],
        new Float32Array([mouseX, mouseY]));

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertexCount);

    window.requestAnimationFrame(function(currentTime) {
        previousTime = currentTime;
        animateScene();
    });
}
