"use strict";
/////////////////////////////////////////////////////////////////////////////
// Setup
/////////////////////////////////////////////////////////////////////////////

// container for canvas
let container;

// canvas for drawing
let canvas;

function start() {

	// create container with canvas
	container = document.createElement('div');
	container.style.width = '100%';
	container.style.height = '100%';
	container.id = "chromadrencher";
	canvas = document.createElement('canvas');
	canvas.style.width = '100%';
	canvas.style.height = '100%';
	container.appendChild(canvas);

	// insert container right before this script tag
	const scripts = document.getElementsByTagName('script');
	const script = scripts[scripts.length - 1];
	script.parentNode.insertBefore(container, script);

	// calculate canvas drawing size
	const dpr = state.dprscale ? (window.devicePixelRatio || 1) : 1;
	const dimensions = canvas.getBoundingClientRect();
	canvas.width = dimensions.width * dpr;
	canvas.height = dimensions.height * dpr;

	// prepare context event handlers, can happen anytime after context creation
	canvas.addEventListener('webglcontextcreationerror', contextError, false);
	canvas.addEventListener('webglcontextlost', contextLost, false);
	canvas.addEventListener('webglcontextrestored', contextRegen, false);

	console.log("Chroma Drencher v1.2");

	chromad = new Chroma();
	setupGL(canvas);
	run();
}

/////////////////////////////////////////////////////////////////////////////
// WebGL Rendering
/////////////////////////////////////////////////////////////////////////////

// webgl context
let gl;

// chroma webgl state
let state = {
	fps: 0,
	fpslock: true,
	fpsThreshold: 0,
	totaldt: 0,
	dprscale: false,
	lastTime: 0,
	lastDt: 0,
	frameID: 0,
	resizeID: null,
	renderer: null,
	language: null,
	camera: new Camera(0,0,0,0),
	vrcamera: new Camera(0,0,0,0),
};

let chromad;
let chromagl;

function setupGL(canvas) {

	// create webgl context
	gl = canvas.getContext('webgl2', {antialias: false, preserveDrawingBuffer: false, xrCompatible: true});
	gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
	gl.enable(gl.BLEND);
	//gl.blendEquation(gl.FUNC_ADD);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	gl.clearColor(0.0, 0.0, 0.0, 1.0);
	gl.clear(gl.COLOR_BUFFER_BIT);

	state.renderer = gl.getParameter(gl.RENDERER);
	state.language = gl.getParameter(gl.SHADING_LANGUAGE_VERSION);

	chromagl = new Chromagl(chromad, gl);
	chromagl.setup();

	//set fixed camera matrix uniforms
	setCamera(gl);

	window.addEventListener('resize', onResize, false);

	chromagl.resetLineState();
}


function drawGL() {

	chromagl.updateUniforms();

	// clear before draw
	gl.clearColor(chromad.backgroundColor[0], chromad.backgroundColor[1], chromad.backgroundColor[2], 1.0);
	gl.clearDepth(1.0)
	gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

	chromagl.draw(state.camera);
}

function setCamera(gl) {
	// if ortho is not used, gl-matrix library is required
	const useOrtho = true;

	if (useOrtho) {
		const identityMatrix = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
		const width = gl.canvas.width / 2;
		const height = (chromad.rotation == 180) ? (gl.canvas.height / 2) : (gl.canvas.height / -2);
		const projectionMatrix = orthoMatrix(-width, width, -height, height, 0, 200);
		state.camera.projectionMatrix = projectionMatrix;
		state.camera.viewMatrix = identityMatrix;
		state.camera.viewPort.x = 0;
		state.camera.viewPort.y = 0;
		state.camera.viewPort.width = gl.drawingBufferWidth;
		state.camera.viewPort.height = gl.drawingBufferHeight;

	} else {
		// use client value to get actual size ignoring css
		const aspectRatio = gl.canvas.clientWidth/gl.canvas.clientHeight;
		
		//triangles will be drawn on plane of half canvas.height distance for full converage in perspective projection
		const perspectiveMatrix = perspectMatrix(90, aspectRatio, 0.1, 1000);

		const scaleFactor = 2.0 / gl.canvas.height;
		const modelMatrix = mat4.create();
		mat4.translate(modelMatrix, modelMatrix, [0,0, -1]);
		mat4.scale(modelMatrix, modelMatrix, [scaleFactor,scaleFactor,scaleFactor]);
		mat4.rotateZ(modelMatrix, modelMatrix, glMatrix.toRadian(180));
		mat4.rotateZ(modelMatrix, modelMatrix, glMatrix.toRadian(chromad.rotation));
		//mat4.rotateX(modelMatrix, modelMatrix, glMatrix.toRadian(-8));

		state.camera.projectionMatrix = perspectiveMatrix;
		state.camera.viewMatrix = modelMatrix;
		state.camera.viewPort.x = 0;
		state.camera.viewPort.y = 0;
		state.camera.viewPort.width = gl.drawingBufferWidth;
		state.camera.viewPort.height = gl.drawingBufferHeight;

	}
}

function bufferstats() {
	gl.bindBuffer(gl.ARRAY_BUFFER, chromagl.bufferOffset.front.buffer);
	console.log("LineCount: " + chromad.linecount);
	console.log("LineList: " + chromad.linelist.length);
	console.log("Lineinuse: " + chromagl.linesInUse);
	console.log("Linebuffer size:" + chromagl.lineBuffer.byteLength);
	console.log("GLBuffer size: " + gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE));
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

// Webgl context creation error event handler
function contextError(event) {
	console.error("WebGL Context could not be created.");
}

// Webgl context lost event handler
function contextLost(event) {
	event.preventDefault();
	cancelAnimationFrame(state.frameID);
}

// Webgl context restored event handler
function contextRegen() {
	const dpr = state.dprscale ? (window.devicePixelRatio || 1) : 1;
	const dimensions = canvas.getBoundingClientRect();
	canvas.width = dimensions.width * dpr;
	canvas.height = dimensions.height * dpr;
	Program.clearAll();
	setupGL(canvas);
	run();
}

// test lost and restore for webgl
function testLoss() {
	let ext = gl.getExtension('WEBGL_lose_context');
	ext.loseContext();
	window.setTimeout(function(ext) {
		ext.restoreContext();
	},1000,ext);
}

function onResize() {
	if (state.resizeID != null) {
		window.clearTimeout(state.resizeID);
		state.resizeID = null;
	}
	state.resizeID = window.setTimeout(onResizeActivate, 250);
}

function onResizeActivate() {
	//console.log("Window Resized");
	const dpr = state.dprscale ? (window.devicePixelRatio || 1) : 1;
	const dimensions = canvas.getBoundingClientRect();
	canvas.width = dimensions.width * dpr;
	canvas.height = dimensions.height * dpr;
	setCamera(gl);
	chromad.prepareLines();
	chromagl.lineBufferReload(false);
}

function run() {
	state.lastTime = performance.now() / 1000;
	state.frameID = window.requestAnimationFrame(onAnimationFrame);
}

function onAnimationFrame(timestamp) {
	// Keep animating
	state.frameID = window.requestAnimationFrame(onAnimationFrame);

	// Figure out how much time passed since the last animation
	const now = performance.now() / 1000;
	let dt = Math.min(now - state.lastTime, 1);
	state.lastTime = now;

	// accumulate total time over skipped frames
	state.totaldt += dt;

	// seperate update would go here if updating independent of draw
	//

	// If there is an FPS limit, abort updating the animation if we reached the desired FPS
	// this reqires canvas to preserve drawing buffer
	if (state.fps > 0 && state.fpslock) {
		state.fpsThreshold += dt;
		if (state.fpsThreshold < 1.0 / state.fps) {
			return;
		}
		state.fpsThreshold -= 1.0 / state.fps;
	}

	// update state using total dt
	chromad.update(state.totaldt);
	chromagl.update(state.totaldt);

	// Set 2d canvas camera and draw scene
	setCamera(gl);
	drawGL();

	state.totaldt = 0;
	state.lastDt = dt;
}


start();
