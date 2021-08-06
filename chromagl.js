"use strict";
/////////////////////////////////////////////////////////////////////////////
// Chroma GL Rendering
/////////////////////////////////////////////////////////////////////////////

Chromagl.vertexShaderSource =
`#version 300 es
precision mediump float;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 lineSize;
uniform vec2 resolution;

layout(location = 0) in vec3 position;
layout(location = 1) in vec4 vertexColor;
layout(location = 2) in vec4 offset;

out vec4 varyingVertexColor;
out float varyingOpacity;

void main() {
	varyingVertexColor = vertexColor;
	varyingOpacity = offset.a;
	vec4 offsetCentered = offset;
	offsetCentered.x -= resolution.x / 2.0;
	offsetCentered.y -= resolution.y / 2.0;
	offsetCentered.y -= lineSize.y;
	vec4 model = vec4(offsetCentered.xyz + position * lineSize, 1.0);
	//model.x = clamp(model.x, -resolution.x / 2.0, resolution.x / 2.0);
	//model.y = clamp(model.y, -resolution.y / 2.0, resolution.y / 2.0);
	vec4 modelViewPosition = modelViewMatrix * model;
	gl_Position = projectionMatrix * modelViewPosition;
}`;

Chromagl.fragmentShaderSource =
`#version 300 es
precision mediump float;

in vec4 varyingVertexColor;
in float varyingOpacity;

out vec4 FragColor;

uniform float tipFrac;
uniform vec2 resolution;
uniform float blendFactor;
uniform float gradientLength1;
uniform float gradientLength2;
uniform vec3 gradientColors1[5];
uniform vec3 gradientColors2[5];

float map(float v, float f1, float f2, float t1, float t2) { return (v-f1)*(t2-t1)/(f2-f1); }
float min3( vec3 a ) { return min( a.x, min( a.y, a.z ) ); }
float max3( vec3 a ) { return max( a.x, max( a.y, a.z ) ); }
vec3 mixa( vec3 col1, vec3 col2, float gradient ) { float m = ( max3( col1 ) + max3( col2 ) ) / 2.; vec3 c = ( col1 + col2 ) * .5; float d = 2. * abs( gradient - .5 ) * min3( c ); c = ( c - d ) / ( 1. - d ); c *= m / max3( c ); float s = step( .5, gradient ); gradient *= 2.; return ( 1. - s ) * mix( col1, c, gradient ) + s * mix( c, col2, gradient - 1. ); }

void main() {
	FragColor = varyingVertexColor;
	FragColor.a *= varyingOpacity;

	float div1 = 1.0 / (gradientLength1 - 1.0);
	float div2 = 1.0 / (gradientLength2 - 1.0);
	float x = mod(gl_FragCoord.x, resolution.x) / resolution.x;
	vec3 color1 = mix(gradientColors1[0],gradientColors1[1], smoothstep(0.0, div1, x));
	color1 = mix(color1,gradientColors1[2], smoothstep(div1, div1*2.0, x));
	color1 = mix(color1,gradientColors1[3], smoothstep(div1*2.0, div1*3.0, x));
	color1 = mix(color1,gradientColors1[4], smoothstep(div1*3.0, div1*4.0, x));
	vec3 color2 = mix(gradientColors2[0],gradientColors2[1], smoothstep(0.0, div2, x));
	color2 = mix(color2,gradientColors2[2], smoothstep(div2, div2*2.0, x));
	color2 = mix(color2,gradientColors2[3], smoothstep(div2*2.0, div2*3.0, x));
	color2 = mix(color2,gradientColors2[4], smoothstep(div2*3.0, div2*4.0, x));
	FragColor *= vec4(mix(color1/255.0, color2/255.0, blendFactor), 1.0);
	float tip = clamp(map(varyingVertexColor.a, tipFrac, 1.0, 0.0, 1.0), 0.0, 1.0);
	float condition = max(sign(varyingOpacity - (200.0 / 255.0)), 0.0);
	FragColor.rgb = mix(FragColor.rgb, vec3(1.0), tip * condition);
	float bottomFade = smoothstep(0.0, resolution.y / 2.0, gl_FragCoord.y);
	float topFade = smoothstep(resolution.y, resolution.y-resolution.y / 4.0, gl_FragCoord.y);
	FragColor.a *= (topFade * 0.7) + 0.3;
	FragColor.a = mix(0.01, FragColor.a, bottomFade);
}`;

Chromagl.particleVertexShaderSource =
`#version 300 es
precision mediump float;

in vec4 offset;
in vec3 velocity;

uniform float dt;
uniform float linespeed;
uniform vec2 windowsize;
uniform vec3 linescale;

out vec4 outOffset;
out vec3 outVelocity;

void main() {
	outOffset = offset;
	outVelocity = velocity;
	outOffset += vec4(velocity * linespeed * dt, 0.0);
	outOffset.y = mod(outOffset.y, (windowsize.y + linescale.y));
}`;

Chromagl.discardFragmentShaderSource =
`#version 300 es
precision mediump float;
void main() {
	discard;
}`;

function Chromagl(chromad, gl) {
	this.chromad = chromad;
	this.gl = gl;
	this.shaderProgram = null;
	this.particleShaderProgram = null;
	this.lineBuffer = null;
	this.linesInUse = 0;
}

Chromagl.prototype.setup = function() {
	// assemble shader programs
	this.shaderProgram = new Program(this.gl, Chromagl.vertexShaderSource, Chromagl.fragmentShaderSource, null);
	this.particleShaderProgram = new Program(this.gl, Chromagl.particleVertexShaderSource, Chromagl.discardFragmentShaderSource, ['outOffset','outVelocity']);
	Program.assemblePrograms();

	// basic normalized quad with vertical gradient
	//position and vertex colors
	// xyz rgba format
	const vertexPositions = new Float32Array([
	0.0,0.0,0.0, 1.0,1.0,1.0,0.0,
	1.0,0.0,0.0, 1.0,1.0,1.0,0.0,
	0.0,1.0,0.0, 1.0,1.0,1.0,1.0,
	1.0,1.0,0.0, 1.0,1.0,1.0,1.0
	]);

	const positionBufferFormat = [
		{name:"position", size:3},
		{name:"vertexColor", size:4},
	];

	const offsetBufferFormat = [
		{name:"offset", size:4},
		{name:"velocity", size:3},
	];

	// create vertex buffer for line with gradient
	this.bufferPosition = new Buffer(gl, vertexPositions, positionBufferFormat);
	// create buffer for particle offsets (will be filled later)
	this.bufferOffset = new Swappable(()=>{return new Buffer(gl, null, offsetBufferFormat)});

	// create vertex array buffer to shader attribute bindings
	// vertexAttribPointer will set format in vao and remember current bound buffer for it
	this.vaoDraw = new Swappable(()=>{});
	this.vaoDraw.front = createBinding(this.gl, this.shaderProgram, [this.bufferPosition, this.bufferOffset.front], [{name:"offset", size:1}])
	this.vaoDraw.back = createBinding(this.gl, this.shaderProgram, [this.bufferPosition, this.bufferOffset.back], [{name:"offset", size:1}])
	this.vaoTransform = new Swappable(()=>{});
	this.vaoTransform.front = createBinding(this.gl, this.particleShaderProgram, [this.bufferOffset.front], null);
	this.vaoTransform.back = createBinding(this.gl, this.particleShaderProgram, [this.bufferOffset.back], null);

}

Chromagl.prototype.update = function(dt) {
	this.GLtransformParticles(dt);
}

Chromagl.prototype.draw = function(camera) {
	const gl = this.gl;

	// draw the rectangles instanced using offsets
	this.shaderProgram.activate();
	this.shaderProgram.setUniform("projectionMatrix", camera.projectionMatrix);
	this.shaderProgram.setUniform("modelViewMatrix", camera.viewMatrix);
	gl.viewport(camera.viewPort.x, camera.viewPort.y, camera.viewPort.width, camera.viewPort.height);
	gl.bindVertexArray(this.vaoDraw.front);
	gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.chromad.linecount);
	gl.bindVertexArray(null);

}

Chromagl.prototype.updateUniforms = function() {
	// select shader program and set per frame variables
	this.shaderProgram.setUniform("tipFrac", 1.0 - (this.chromad.tipheight / this.chromad.lineheight));
	this.shaderProgram.setUniform("lineSize", this.chromad.linewidth, this.chromad.lineheight, 1.0);
	this.shaderProgram.setUniform("blendFactor", this.chromad.ctime / 255.0);
	this.shaderProgram.setUniform("resolution", this.gl.canvas.width, this.gl.canvas.height);
	this.shaderProgram.setUniform("gradientLength1", this.chromad.gradientLength1);
	this.shaderProgram.setUniform("gradientLength2", this.chromad.gradientLength2);
	this.shaderProgram.setUniform("gradientColors1", this.chromad.gradientColors1);
	this.shaderProgram.setUniform("gradientColors2", this.chromad.gradientColors2);
}

Chromagl.prototype.lineBufferReload = function(saveExisting) {
	if (saveExisting) {
		this.getLineState();
	}
	this.resetLineState();
}

Chromagl.prototype.GLtransformParticles = function(dt) {
	const gl = this.gl;

	if (this.chromad.linecount != this.linesInUse) {
		this.lineBufferReload(true);
	}

	this.particleShaderProgram.activate();
	this.particleShaderProgram.setUniform("dt", dt);
	this.particleShaderProgram.setUniform("linespeed", this.chromad.linespeed);
	this.particleShaderProgram.setUniform("linescale", this.chromad.linewidth, this.chromad.lineheight, 1.0);
	this.particleShaderProgram.setUniform("windowsize", gl.canvas.width, gl.canvas.height);
	//for warning if drawing to wrong size even with rasterizer discard
	gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
	//transform from the front buffer to the back buffer	
	gl.bindVertexArray(this.vaoTransform.front);
	gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.bufferOffset.back.buffer);
	gl.enable(gl.RASTERIZER_DISCARD);
	gl.beginTransformFeedback(gl.POINTS);
	gl.drawArrays(gl.POINTS, 0, this.chromad.linecount);
	gl.endTransformFeedback();
	gl.disable(gl.RASTERIZER_DISCARD);
	gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
	gl.bindVertexArray(null);

	// swap the vao that binds the input buffer
	// swap the vao that binds the input offsets
	// swap the output buffer
	this.vaoTransform.swap();
	this.vaoDraw.swap();
	this.bufferOffset.swap();
}

Chromagl.prototype.getLineState = function() {
	this.bufferOffset.front.getData(this.lineBuffer);

	this.deserializeLineList();
}

Chromagl.prototype.resetLineState = function() {
	// generate initial data
	this.serializeLineList();

	this.bufferOffset.front.setData(this.lineBuffer, 0, this.chromad.linecount * 7);
	this.bufferOffset.back.sizeData(this.lineBuffer);

	this.linesInUse = this.chromad.linecount;

	// stream line buffer (when not using transform feedback)
	//this.bufferOffset.front.streamData(this.lineBuffer);

}

Chromagl.prototype.serializeLineList = function() {
	const chunkSize = 8192;
	const elementsPerLine = 7;
	const size = Math.ceil(this.chromad.linecount * elementsPerLine / chunkSize) * chunkSize;
	if (!this.lineBuffer || size > this.lineBuffer.length || size < this.lineBuffer.length) {
		this.lineBuffer = new Float32Array(size);
		//console.log("Line buffer resize: " + size + " (used " + this.chromad.linecount * elementsPerLine + " elements)");
	}
	const minsize = Math.floor(this.chromad.linecount * elementsPerLine / chunkSize) * chunkSize;
	//console.log(minsize + "<" + this.chromad.linecount * elementsPerLine + "<" + size + " (" + this.lineBuffer.length + ")");
	const buffer = this.lineBuffer;
	let index = 0;
	for (let i = 0, j = this.chromad.linecount; i < j; i++) {
		const line = this.chromad.linelist[i];
		buffer[index++] = line.x;     // position x
		buffer[index++] = line.y;     // position y
		buffer[index++] = 0;          // position z
		buffer[index++] = line.alpha; // alpha
		buffer[index++] = 0;          // velocity x
		buffer[index++] = line.sp;    // velocity y
		buffer[index++] = 0;          // velocity z
	}
}

Chromagl.prototype.deserializeLineList = function() {
	const buffer = this.lineBuffer;
	let index = 0;
	const max = Math.min(this.chromad.linecount, this.linesInUse);
	for (let lineIndex = 0, j = max; lineIndex < j; lineIndex++) {
		const line = this.chromad.linelist[lineIndex];
		line.x = buffer[index++];
		line.y = buffer[index++];
		index++;
		line.alpha = buffer[index++];
		index++;
		line.sp = buffer[index++];
		index++;
	}
}
