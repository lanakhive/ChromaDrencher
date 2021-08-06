//////////////////////////////////////////////////////////////////////////////
// WebGL Utility Functions
/////////////////////////////////////////////////////////////////////////////

function Camera(width, height) {
	this.viewPort = {x:0, y:0, width:width, height:height}
	this.projectionMatrix = null;
	this.viewMatrix = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
}

// generate 2d orthographic projection matrix
function orthoMatrix(left, right, bottom, top, near, far) {
	const rl = right - left;
	const tb = top - bottom;
	const fn = far - near;
	return new Float32Array([
		2/rl, 0, 0, 0,
		0, 2/tb, 0, 0,
		0, 0, -2/fn, 0,
		-(left+right)/rl, -(top+bottom)/tb, -(far+near)/fn, 1]);
}

function frustMatrix(left, right, bottom, top, near, far) {
	const rl = right - left;
	const tb = top - bottom;
	const fn = far - near;
	return new Float32Array([
		(near*2)/rl, 0, 0, 0,
		0, (near*2)/tb, 0, 0,
		(right+left)/rl, (top+bottom)/tb, -(far+near)/fn, -1,
		0, 0, -(far*near*2)/fn, 0]);
}

function perspectMatrix(fovy, aspect, near, far) {
	const top = near * Math.tan(fovy * Math.PI / 360.0);
	const right = top * aspect;
	return frustMatrix(-right, right, -top, top, near, far);
}

function Program(gl, vertexShaderSource, fragmentShaderSource, transformFeedback) {
	// create program
	const program = gl.createProgram();
	if (transformFeedback != null) {
		gl.transformFeedbackVaryings(program, transformFeedback, gl.INTERLEAVED_ATTRIBS);
	}
	// create shaders
	const vertexShader = gl.createShader(gl.VERTEX_SHADER);
	const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.shaderSource(vertexShader, vertexShaderSource);
	gl.shaderSource(fragmentShader, fragmentShaderSource);

	this.gl = gl;
	this.uniform = {};
	this.attribute = {};
	this.program = program;
	this.vertexShader = vertexShader;
	this.fragmentShader = fragmentShader;
	this.linked = false;
	// add to programs array for batch compile and link later
	Program.programs.push(this);
}

Program.programs = [];
Program.current = null;

Program.assemblePrograms = function() {
	const programs = Program.programs;

	// compile all program shaders together
	for (const prog of programs) {
		const gl = prog.gl;
		gl.compileShader(prog.vertexShader);
		gl.compileShader(prog.fragmentShader);
	}
	// link all programs together
	for (const prog of programs) {
		const gl = prog.gl;
		gl.linkProgram(prog.program);
	}
	// check for compile and link errors
	for (const prog of programs) {
		const gl = prog.gl;
		if (!gl.getProgramParameter(prog.program, gl.LINK_STATUS)) {
			console.error("Link fail: " + gl.getProgramInfoLog(prog.program));
			console.error("Vertex: " + gl.getShaderInfoLog(prog.vertexShader));
			console.error("Fragment: " + gl.getShaderInfoLog(prog.fragmentShader));
			throw "Shader failure";
		} else {
			prog.linked = true;
		}
	}
	// get attribute and uniform locations
	for (const prog of programs) {
		const gl = prog.gl;
		const totalAttributes = gl.getProgramParameter(prog.program, gl.ACTIVE_ATTRIBUTES);
		for (let i = 0; i < totalAttributes; ++i) {
			const active = gl.getActiveAttrib(prog.program, i);
			const location = gl.getAttribLocation(prog.program, active.name);
			if (location >= 0) {

				const info = {};
				info.location = location;
				info.type = active.type;
				info.size = active.size;
				prog.attribute[active.name] = info;
			}
		}
		const totalUniforms = gl.getProgramParameter(prog.program, gl.ACTIVE_UNIFORMS);
		for (let i = 0; i < totalUniforms; ++i) {
			const active = gl.getActiveUniform(prog.program, i);
			const cleanName = active.name.split('[')[0];
			const location = gl.getUniformLocation(prog.program, active.name);
			if (location != null) {

				const info = {};
				info.location = location;
				info.type = active.type;
				info.size = active.size;
				info.isArray = active.size > 1;

				prog.uniform[cleanName] = info;
			}
		}
	}
}

Program.prototype.activate = function() {
	if (Program.current != this) {
		gl.useProgram(this.program);
		Program.current = this;
	}
}

Program.prototype.setUniform = function(uniformName, value1, value2, value3, value4) {
	this.activate();
	const gl = this.gl;
	const uniform = this.uniform[uniformName];
	uniform.value1 = value1;
	uniform.value2 = value2;
	uniform.value3 = value3;
	uniform.value4 = value4;
	switch(uniform.type) {
		case gl.FLOAT:      uniform.isArray ? gl.uniform1fv(uniform.location, value1) : gl.uniform1f(uniform.location, value1); break;
		case gl.FLOAT_VEC2: uniform.isArray ? gl.unfiorm2fv(uniform.location, value1) : gl.uniform2f(uniform.location, value1, value2); break;
		case gl.FLOAT_VEC3: uniform.isArray ? gl.uniform3fv(uniform.location, value1) : gl.uniform3f(uniform.location, value1, value2, value3); break;
		case gl.FLOAT_VEC4: uniform.isArray ? gl.uniform4fv(uniform.location, value1) : gl.uniform4f(uniform.location, value1, value2, value3, value4); break;
		case gl.FLOAT_MAT2: gl.uniformMatrix2fv(uniform.location, false, value1); break;
		case gl.FLOAT_MAT3: gl.uniformMatrix3fv(uniform.location, false, value1); break;
		case gl.FLOAT_MAT4: gl.uniformMatrix4fv(uniform.location, false, value1); break;
		default: throw "Shader uniform type not implemented";
	}
}

Program.clearAll = function() {
	Program.programs = [];
}

function Buffer(gl, data, format) {
	this.gl = gl;
	this.buffer = gl.createBuffer();
	this.format = format;

	if (data != null) {
		gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
		gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
	}
	this.stride = 0;
	for (const source of format) {
		source.bytes = source.size * Float32Array.BYTES_PER_ELEMENT;
		source.offset = this.stride;
		this.stride += source.bytes;
	}
}

Buffer.prototype.sizeData = function(data) {
	const gl = this.gl;
	gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
	gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.STREAM_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

Buffer.prototype.setData = function(data, start, length) {
	const gl = this.gl;
	start = start || 0; 
	length = length || data.length; 
	gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
	gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.STREAM_DRAW);
	gl.bufferSubData(gl.ARRAY_BUFFER, start, data, 0, length);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

Buffer.prototype.streamData = function(data) {
	const gl = this.gl;

	gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
	// not clear which method is faster to stream data 
	//gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
	if (gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE) != data.byteLength) {
		gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.STREAM_DRAW);
		console.log("Array Buffer resize: " + data.byteLength + " bytes");
	}
	gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, data.length);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

Buffer.prototype.getData = function(destBuffer) {
	const gl = this.gl;
	const copyBuffer = gl.createBuffer();

	// resize copy buffer
	gl.bindBuffer(gl.ARRAY_BUFFER, copyBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, destBuffer.byteLength, gl.STREAM_READ);
	gl.bindBuffer(gl.ARRAY_BUFFER, null)

	// copy from current buffer to copy
	gl.bindBuffer(gl.COPY_READ_BUFFER, this.buffer);
	gl.bindBuffer(gl.COPY_WRITE_BUFFER, copyBuffer);
	gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.COPY_WRITE_BUFFER, 0, 0, destBuffer.byteLength);
	gl.bindBuffer(gl.COPY_READ_BUFFER, null);
	gl.bindBuffer(gl.COPY_WRITE_BUFFER, null);

	// wait for copy command to finish
	gl.finish();

	// read data from gpu and deserialize to chroma linaes
	gl.bindBuffer(gl.ARRAY_BUFFER, copyBuffer);
	gl.getBufferSubData(gl.ARRAY_BUFFER, 0, destBuffer);
	gl.bindBuffer(gl.ARRAY_BUFFER, null)

	gl.deleteBuffer(copyBuffer);
}

// create vao to bind program attributes from sources in buffers
function createBinding(gl, program, buffers, divisors) {
	const vao = gl.createVertexArray();
	gl.bindVertexArray(vao);
	for (const buffer of buffers) {
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer.buffer);
		for (const source of buffer.format) {
			if (program.attribute[source.name]) {
				//console.log("Binding attribute " + source.name + " " + source.offset + "/" + buffer.stride);
				gl.vertexAttribPointer(program.attribute[source.name].location, source.size, gl.FLOAT, false, buffer.stride, source.offset);
				gl.enableVertexAttribArray(program.attribute[source.name].location);
			}
		}
	}
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	if (divisors != null) {
		for (const divisor of divisors) {
			if (program.attribute[divisor.name]) {
				//console.log("Attribute divisor " + divisor.name);
				gl.vertexAttribDivisor(program.attribute[divisor.name].location, divisor.size);
			}
		}
	}
	gl.bindVertexArray(null);
	return vao;
}

