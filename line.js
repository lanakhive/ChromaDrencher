"use strict";
//////////////////////////////////////////////////////////////////////////
// Setup HTML and Canvas
/////////////////////////////////////////////////////////////////////////
var usingGL=true;
var container;

//canvas for drawing
var canvas;

function start() {
	//create container
	container = document.createElement("div");
	container.style.width="100%";
	container.style.height="100%";
	//container.style.position="relative";
	container.id = "chromadrencher";

	if (usingGL) {
		setupGL(container);
		run();
	}
	else {
		setupCanvas(container);
		run();
	}
	createFS();
	console.log("Started");
}

function setupCanvas(container) {
	//create canvas
	canvas = document.createElement("canvas");
	canvas.style.width="100%";
	canvas.style.height="100%";
	canvas.style.backgroundColor = "#000";
	canvas.mozOpaque = true;
	container.appendChild(canvas);
	//insert at position
	var scripts = document.getElementsByTagName('script')
	var script = scripts[scripts.length-1];
	script.parentNode.insertBefore(container,script);
	//set size after adding
	var boundsize = canvas.getBoundingClientRect();
	canvas.width = boundsize.width || 100;
	canvas.height = boundsize.height || 100;
	window.addEventListener('resize',figuresize,false);
}

var renderer;
var camera;
var scene;
function setupGL(container) {
	//insert at position
	var scripts = document.getElementsByTagName('script')
	var script = scripts[scripts.length-1];
	script.parentNode.insertBefore(container,script);

	var boundsize = container.getBoundingClientRect();
	var width = boundsize.width;
	var height = boundsize.height;
	scene = new THREE.Scene();
	// create 2d ortho cam facing-z with non-normalized coordinates at zero center
	camera = new THREE.OrthographicCamera(width/-2,width/2,height/2,height/-2,0,30);
	camera.rotation.z = Math.PI;
	// move camera so origin is bottom left
	camera.position.x = width/2;
	camera.position.y = height/2;
	camera.position.z = 10;
	// create renderer
	renderer = new THREE.WebGLRenderer();
	//renderer.sortObjects = false;
	// renderer.context.disable(renderer.context.DEPTH_TEST);
	renderer.setSize(width, height);
	container.appendChild(renderer.domElement);
	renderer.render(scene,camera);
	window.addEventListener('resize',figuresize,false);
	canvas = renderer.domElement;
}
function createFS()
{
	if (canvas.mozRequestFullScreen||canvas.webkitRequestFullScreen)
		//if (0)
	{
		var but = document.createElement("button");
		but.innerHTML='□';
		but.style.cssText="width:30px;height:30px;margin:10px;padding:0;position:absolute;bottom:0;right:0;background:#444;border:1px solid;border-radius:0;color:#eee;box-shadow:none;font:20px sans-serif;text-align:center;opacity:.5;-moz-user-select:none;-webkit-user-select: none";
		container.appendChild(but);
		but.addEventListener('click',function(){
			console.log("Enter fullscreen");
			if (canvas.mozRequestFullScreen) canvas.mozRequestFullScreen();
			else if (canvas.webkitRequestFullScreen) canvas.webkitRequestFullScreen();
		});
	}

	var but2 = document.createElement("button");
	if (usingGL) but2.innerHTML='G';
	else but2.innerHTML='C';
	but2.style.cssText="width:30px;height:30px;margin:10px;padding:0;position:absolute;bottom:0;right:35px;background:#444;border:1px solid;border-radius:0;color:#eee;box-shadow:none;font:20px sans-serif;text-align:center;opacity:.5;-moz-user-select:none;-webkit-user-select: none";
	container.appendChild(but2);
	but2.addEventListener('click',function(){
		console.log("Toggle mode");
		toggleGL(!usingGL);
		if (usingGL) but2.innerHTML='G';
		else but2.innerHTML='C';
	});
}
///////////////////////////////////////////////////////////////////////
// Utility functions
///////////////////////////////////////////////////////////////////////
function randI(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

Array.prototype.shuffle = function() {
  var i = this.length, j, temp;
  if ( i == 0 ) return this;
  while ( --i ) {
     j = Math.floor( Math.random() * ( i + 1 ) );
     temp = this[i];
     this[i] = this[j];
     this[j] = temp;
  }
  return this;
}
//////////////////////////////////////////////////////////////
// Main App
//////////////////////////////////////////////////////////////

var env = {
	linedensity : 100, // percentage amount of lines for canvas width
	lineheight : 1024, // height of lines in px
	linewidth : 2,     // width of lines in px
	tipheight : 64,    // height of tip in px
	linespeed : 10,    // speed of falling lines
	cspeed : 30,       // speed of color gradient change
	linecount : null,    // actual amount of lines
	tipcount: 0,       // actual amount of tips
	line : null,       // ref to line canvas object
	tip : null,      // ref to tip canvas object
	fadeB : null,       // ref to bottom gradient fade object
	fadeT : null,      // ref to top gradient fade object
	cs : null,         // ref to top color gradient object (only canvas)
	cs2 : null,        // ref to bottom color gradient object (only canvas)
	csback : null,     // ref to main color gradient object
	ctime : null,      // blend amount between color gradients
	cup : null,        // blend direction between color gradients
	linelist : [],     // array of line objects
	frameID: 0,        // ref to requestAnimationFrame
};

function genShader()
{
	var vxshad =
`precision highp float;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
attribute vec3 position;

attribute vec4 acolor;
attribute vec3 offset;
attribute float opacity;
varying vec4 vacolor;
varying float op;
void main() {
vacolor = acolor;
op = opacity;
vec4 modelViewPosition = modelViewMatrix * vec4(offset + position, 1.0);
gl_Position = projectionMatrix * modelViewPosition;
}`;
	var fgshad =
`precision highp float;
varying vec4 vacolor;
varying float op;
void main() {
gl_FragColor = vacolor;
gl_FragColor.a *= op;
}`;
	var shad = new THREE.RawShaderMaterial({
		vertexShader: vxshad,
		fragmentShader: fgshad,
		transparent: true,
	});
	return shad;
}

function genShaderBlend()
{
	var vxshad =
`precision highp float;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
attribute vec3 position;

void main() {
vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
gl_Position = projectionMatrix * modelViewPosition;
}`;
	var fgshad =
`precision highp float;
uniform vec3 acolor[5];
uniform vec3 acolor2[5];
uniform float alen;
uniform float alen2;
uniform float opacity;
uniform vec2 resolution;
void main() {
float div1 = 1.0/(alen-1.0);
float div2 = 1.0/(alen2-1.0);
float x = gl_FragCoord.x / resolution.x;
vec3 color1 = mix(acolor[0],acolor[1], smoothstep(0.0, div1, x));
color1 = mix(color1,acolor[2], smoothstep(div1, div1*2.0, x));
color1 = mix(color1,acolor[3], smoothstep(div1*2.0, div1*3.0, x));
color1 = mix(color1,acolor[4], smoothstep(div1*3.0, div1*4.0, x));
vec3 color2 = mix(acolor2[0],acolor2[1], smoothstep(0.0, div2, x));
color2 = mix(color2,acolor2[2], smoothstep(div2, div2*2.0, x));
color2 = mix(color2,acolor2[3], smoothstep(div2*2.0, div2*3.0, x));
color2 = mix(color2,acolor2[4], smoothstep(div2*3.0, div2*4.0, x));
gl_FragColor = vec4(mix(color1/255.0, color2/255.0, opacity), 1.0);
}`;
	var shad = new THREE.RawShaderMaterial({
		vertexShader: vxshad,
		fragmentShader: fgshad,
		transparent: true,
		blending: THREE.MultiplyBlending,
		uniforms : {
			"acolor": {value: new Float32Array(5*3)},
			"acolor2": {value: new Float32Array(5*3)},
			"alen": {value: 3.0},
			"alen2": {value: 2.0},
			"opacity": {value: 1.0},
			"resolution": {value: new THREE.Vector2()},
		},
	});
	return shad;
}

function genGLGradientGeo(w,h,r,g,b,topa,bota)
{
	var bgeo = new THREE.InstancedBufferGeometry();
	var ver = new Float32Array([
		0.0,0.0,0.0,
		w  ,0.0,0.0,
		0.0,h  ,0.0,

		0.0,h  ,0.0,
		w  ,0.0,0.0,
		w  ,h  ,0.0
	]);
	var acol = new Float32Array([
		r,g,b,topa,
		r,g,b,topa,
		r,g,b,bota,

		r,g,b,bota,
		r,g,b,topa,
		r,g,b,bota,
	]);
	bgeo.addAttribute('position', new THREE.BufferAttribute(ver, 3));
	bgeo.addAttribute('acolor', new THREE.BufferAttribute(acol, 4));
	return bgeo;
}

function genGradient(w,h,r,g,b,top,bottom)
{
	var c = document.createElement("canvas");
	c.width = w;
	c.height = h;
	var ctx = c.getContext("2d");

	var grad = ctx.createLinearGradient(0,0,0,h);
	grad.addColorStop(0, "rgba("+r+","+g+","+b+","+top+")");
	grad.addColorStop(1, "rgba("+r+","+g+","+b+","+bottom+")");
	ctx.fillStyle = grad;
	ctx.fillRect(0,0,w,h);
	return c;
}

function coolColors()
{
	var ct = [[255,40,100],[255,255,0],[255,150,0],[150,0,255],[150,255,100],[255,0,200],[40,100,255]];
	ct.shuffle();
	var r = randI(3,5);
	ct = ct.slice(0,r);
	return ct;
}

function colorSpan(top)
{
	var w = canvas.width;
	var h = canvas.height;
	var c;
	if (top) c = env.cs;
	else c = env.cs2
	var ct = coolColors();
	var ctx = c.getContext("2d", {alpha:false});
	ctx.clearRect(0,0,w,h);
	var gap = w/(ct.length-1);
	var x = 0;

	var grad = ctx.createLinearGradient(0,0,w,0);
	for (var i=0; i<ct.length; i++)
	{
		grad.addColorStop(x, "rgb("+ct[i][0]+","+ct[i][1]+","+ct[i][2]+")");
		x = x + ((gap)/w);
	}
	ctx.fillStyle = grad;
	ctx.fillRect(0,0,w,h);
	return c;
}

function colorSpanGL(top)
{
	var ct, len, i;
	ct = coolColors();
	len = ct.length;
	for (i=0;i<len;++i)
	{
		if (top) env.csback.material.uniforms["acolor"].value.set(ct[i],i*3);
		else env.csback.material.uniforms["acolor2"].value.set(ct[i],i*3);
	}
	if (top) env.csback.material.uniforms["alen"].value = len;
	else env.csback.material.uniforms["alen2"].value = len;
	//console.log(len);
}

function prepareLines()
{
	env.linecount = env.linedensity * canvas.width / 100;
	if (env.linelist.length == env.linecount) return;
	env.tipcount = 0;
	//generate lines
	while (env.linelist.length < env.linecount)
	{
		var t = {};
		t.x = randI(0, canvas.width);
		//align to linewidth
		//t.x = t.x - (t.x%env.linewidth);
		t.y = randI(0-env.lineheight, canvas.height);
		t.sp = 5*Math.random()+3;
		t.op = randI(25,255);
		t.tip = false;
		t.alpha = randI(25,100)/255.0;
		//bright tip
		if (randI(1,10) == 10)
		{
			t.tip = true;
			t.alpha = 220/255.0;
		}
		env.linelist.push(t);
	}
	//remove extra lines
	while (env.linelist.length > env.linecount)
	{
		env.linelist.pop();
	}
	//count tipcount
	var i;
	for (i=env.linelist.length-1;i>=0;i--) {
		if (env.linelist[i].tip) env.tipcount++;
	}
}

// Z order
// 0 - Lines
// 1 - ColorGradient
// 2 - Tips
// 3 - Fades
//
//
function initGL()
{
	prepareLines();
	env.ctime = 0;
	env.cup = 1.0;

	//setup lines
	var length = env.linelist.length;
	var linegeo = genGLGradientGeo(2,1024,1.0,1.0,1.0,0.0,1.0);
	var tipgeo = genGLGradientGeo(2,64,1.0,1.0,1.0,0.0,1.0);
	linegeo.maxInstancedCount = length;
	var a = linegeo.addAttribute('opacity',new THREE.InstancedBufferAttribute(new Float32Array(length), 1, 1));
	linegeo.addAttribute('offset',new THREE.InstancedBufferAttribute(new Float32Array(3*length), 3, 1));
	linegeo.getAttribute('offset').dynamic = true;
	tipgeo.maxInstancedCount = env.tipcount;
	tipgeo.addAttribute('opacity',new THREE.InstancedBufferAttribute(new Float32Array(length), 1, 1));
	tipgeo.addAttribute('offset',new THREE.InstancedBufferAttribute(new Float32Array(3*length), 3, 1));
	tipgeo.getAttribute('offset').dynamic = true;

	var shader = genShader();
	var lineobj = new THREE.Mesh(linegeo, shader);
	var tipobj = new THREE.Mesh(tipgeo, shader);
	lineobj.scale.x=env.linewidth/2;
	tipobj.scale.x=env.linewidth/2;
	lineobj.scale.y=env.lineheight/1024;
	tipobj.scale.y=env.tipheight/64;
	tipobj.position.z = 2;
	scene.add(lineobj);
	scene.add(tipobj);

	//setup color
	var colorgeo = new THREE.PlaneGeometry(canvas.width,canvas.height);
	var colorshader = genShaderBlend();
	colorshader.uniforms["resolution"].value.set(canvas.width,canvas.height);
	var colorobj = new THREE.Mesh(colorgeo, colorshader );
	colorobj.position.x = canvas.width/2;
	colorobj.position.y = canvas.height/2;
	colorobj.position.z = 1;
	scene.add(colorobj);
	env.csback = colorobj;
	colorSpanGL(true);
	colorSpanGL(false);

	// setup data structs
	env.line = {geo: linegeo, obj: lineobj};
	env.tip = {geo: tipgeo, obj: tipobj};

	//set line opacities
	var opacities = env.line.geo.getAttribute('opacity').array;
	var opacitiestip = env.tip.geo.getAttribute('opacity').array;
	var opi = 0;
	var opt = 0;
	var i,j;
	for (i=env.linelist.length-1;i>=0;i--) {
		j = env.linelist[i];
		opacities[opi++] = j.alpha;
		if (j.tip) opacitiestip[opt++] = 0.6274509;
	}
	env.line.geo.getAttribute('opacity').needsUpdate = true;
	env.tip.geo.getAttribute('opacity').needsUpdate = true;

	//setup fade overlay
	var fadeB = genGLGradientGeo(canvas.width,canvas.height/2,0.0,0.0,0.0,0.0,1.0)
	fadeB.maxInstancedCount = 1;
	fadeB.addAttribute('opacity',new THREE.InstancedBufferAttribute(new Float32Array([1.0]), 1, 1));
	fadeB.addAttribute('offset',new THREE.InstancedBufferAttribute(new Float32Array([0.0,0.0,0.0]), 3, 1));
	var fadeBobj = new THREE.Mesh(fadeB, shader);
	fadeBobj.position.z = 3;
	fadeBobj.position.y = canvas.height/2
	var fadeT = genGLGradientGeo(canvas.width,canvas.height/4,0.0,0.0,0.0,0.7,0.0)
	fadeT.maxInstancedCount = 1;
	fadeT.addAttribute('opacity',new THREE.InstancedBufferAttribute(new Float32Array([1.0]), 1, 1));
	fadeT.addAttribute('offset',new THREE.InstancedBufferAttribute(new Float32Array([0.0,0.0,0.0]), 3, 1));
	var fadeTobj = new THREE.Mesh(fadeT, shader);
	fadeTobj.position.z = 3;
	scene.add(fadeBobj);
	scene.add(fadeTobj);
}
function GLdraw()
{
	var offsets = env.line.geo.getAttribute('offset').array;
	var offsetstip = env.tip.geo.getAttribute('offset').array;
	var ofi = 0, oft = 0;
	var widthScale = 2/env.linewidth;
	var heightScale = 1024/env.lineheight;
	var heightScaleS = 64/env.tipheight;
	var i,j;
	for (i=env.linelist.length-1;i>=0;i--)
	{
		j = env.linelist[i];
		offsets[ofi++] = j.x*widthScale;
		offsets[ofi++] = j.y*heightScale;
		ofi++;
		//offsets[ofi++] = 0.0;
		if (j.tip)
		{
			offsetstip[oft++] = j.x*widthScale;
			offsetstip[oft++] = (j.y+env.lineheight-env.tipheight)*heightScaleS;
			oft++;
			//offsetstip[oft++] = 0.0;
		}
	}
	env.line.geo.getAttribute('offset').needsUpdate = true;
	env.tip.geo.getAttribute('offset').needsUpdate = true;

	// set blend between two color gradients
	env.csback.material.uniforms["opacity"].value = env.ctime/255.0;

	// issue draw calls
	renderer.render( scene, camera );
	//console.log(renderer.info.render.calls);

}

function initCanvas()
{
	//generate gradient offscreen canvases
	env.line = genGradient(env.linewidth,env.lineheight,255,255,255,0,1);
	env.tip = genGradient(env.linewidth,env.tipheight,255,255,255,0,1);
	env.fadeB = genGradient(canvas.width,canvas.height/2,0,0,0,0,1);
	env.fadeT = genGradient(canvas.width,canvas.height/4,0,0,0,0.7,0);
	//create colorblend canvases
	env.cs = document.createElement("canvas");
	env.cs.width = canvas.width;
	env.cs.height = canvas.height;
	colorSpan(true);
	env.cs2 = document.createElement("canvas");
	env.cs2.width = canvas.width;
	env.cs2.height = canvas.height;
	colorSpan(false);
	env.csback = document.createElement("canvas");
	env.csback.width = canvas.width;
	env.csback.height = canvas.height;

	prepareLines();
	env.ctime = 0;
	env.cup = 1.0;
}

function update(dt)
{
	var i,j,cw,ch;
	cw = canvas.width;
	ch = canvas.height;
	//update lines
	for (i=env.linelist.length-1;i>=0;i--)
	{
		j = env.linelist[i];
		j.y = j.y + (j.sp*env.linespeed) * dt;
		if (j.y > ch) 
		{
			j.y = 0 - env.lineheight;
		}
	}
	//update background color
	env.ctime = env.ctime + (env.cup * env.cspeed * dt);

	if (env.ctime > 255) 
	{
		env.ctime = 255;
		env.cup = -1.0;
		if (usingGL) colorSpanGL(true);
		else colorSpan(true);
	}
	if (env.ctime < 0)
	{
		env.ctime = 0;
		env.cup = 1.0;
		if (usingGL) colorSpanGL(false);
		else colorSpan(false);
	}

}

function draw()
{
	var i,j,ctx,ctx3,cw,ch;
	cw = canvas.width;
	ch = canvas.height;
	ctx = canvas.getContext('2d', {alpha:false});
	//clear canvas
	//ctx.clearRect(0,0,cw,ch);
	ctx.fillStyle = "#000";
	ctx.fillRect(0,0,cw,ch);
	//draw lines
	for (i=env.linelist.length-1;i>=0;i--)
	{
		j = env.linelist[i];
		ctx.globalAlpha = j.alpha;
		ctx.drawImage(env.line, cw-j.x, Math.floor(j.y));
	}
	ctx.globalAlpha = 1.0;

	//preblend color gradient overlay to temp canvas
	ctx3 = env.csback.getContext("2d", {alpha:false});
	ctx3.globalAlpha = 1.0;
	ctx3.drawImage(env.cs,0,0,cw,ch);
	ctx3.globalAlpha = env.ctime/255;
	ctx3.drawImage(env.cs2,0,0,cw,ch);

	//multiply overlay
	ctx.globalCompositeOperation = "multiply";
	ctx.drawImage(env.csback,0,0,cw,ch);
	ctx.globalCompositeOperation = "source-over";
	
	//draw small lines
	//ctx.globalAlpha = 160.0/255.0;
	ctx.globalAlpha = 0.6274509;
	for (i=env.linelist.length-1;i>=0;i--)
	{
		j = env.linelist[i];
		if (j.tip)
		{
			ctx.drawImage(env.tip,cw-j.x,Math.floor(j.y)+env.lineheight-env.tipheight);
		}
	}
	ctx.globalAlpha = 1.0;

	//draw top gradient
	ctx.drawImage(env.fadeT,0,0);
	//draw bottom gradient
	ctx.drawImage(env.fadeB,0,ch-env.fadeB.height);

	
}

function setLineCount(n)
{
	if (n!=env.linedensity)
	{
		env.linedensity = n;
		prepareLines();
	}
	if (usingGL) {
		while (scene.children.length > 0) scene.remove(scene.children[0]);
		initGL();
	}
}

function setLineHeight(n)
{
	if (n!=env.lineheight)
	{
		var oldheight = env.lineheight;
		env.lineheight = n;
		if (env.lineheight < 128) env.tipheight = env.lineheight/2;
		else env.tipheight = 64;
		if (usingGL) {
			env.line.obj.scale.y=n/1024;
			env.tip.obj.scale.y=env.tipheight/64;
		} else {
			env.line = genGradient(env.linewidth,env.lineheight,255,255,255,0,1);
			env.tip = genGradient(env.linewidth,env.tipheight,255,255,255,0,1);
		}
		for (var i=0; i < env.linelist.length; i++)
		{
			var j = env.linelist[i];
			j.y = j.y + (oldheight - env.lineheight);

			//don't jump all shrunken lines to exact top
			//use original bottom displacement
			if ((oldheight > n)&&(j.y > canvas.height)) 
			{
				j.y = 0 - env.lineheight - (j.y-canvas.height);
			}

		}
	}
}

function setLineWidth(n)
{
	if (n<=0 || n > 8) return;
	env.linewidth = n;
	if (usingGL) {
		env.line.obj.scale.x=n/2;
		env.tip.obj.scale.x=n/2;
	} else {
		env.line = genGradient(env.linewidth,env.lineheight,255,255,255,0,1);
		env.tip = genGradient(env.linewidth,env.tipheight,255,255,255,0,1);
	}
}

function setLineSpeed(n)
{
	if (n!=env.linespeed)
	{
		env.linespeed = n/3;
	}
}

function setColorSpeed(n)
{
	if (n!=env.cspeed)
	{
		env.cspeed = n;
	}
}
function toggleGL(enabled)
{
	if ((usingGL && enabled)||(!usingGL && !enabled)) return;

	window.cancelAnimationFrame(env.frameID);
	document.body.removeChild(container);

	// cleanup webgl
	if (renderer) {
		renderer.dispose();
		renderer.forceContextLoss();
		renderer = null;
	}

	// initiate toggle
	if (!usingGL && enabled)
	{
		console.log("Enabling WebGL");
		usingGL = true;
		start();
	}
	if (usingGL && !enabled)
	{
		console.log("Enabling Canvas");
		usingGL = false;
		start();
	}
}

function figuresize()
{
	console.log("Resize event");
	if (usingGL) {
		var boundsize = container.getBoundingClientRect();
		var w = boundsize.width;
		var h = boundsize.height;
		camera.left = w/-2;
		camera.right = w/2;
		camera.top = h/2;
		camera.bottom = h/-2;
		camera.updateProjectionMatrix();
		camera.position.x = w/2;
		camera.position.y = h/2;
		renderer.setSize(w,h);
		while (scene.children.length > 0) scene.remove(scene.children[0]);
		initGL();
	}
	else {
		var boundsize = canvas.getBoundingClientRect();
		canvas.width = boundsize.width;
		canvas.height = boundsize.height;
		initCanvas();
	}
	//randomize line x and y for even distribution
	var i;
	for (i=env.linelist.length-1;i>=0;i--) {
		env.linelist[i].x = randI(0,canvas.width)
		env.linelist[i].y = randI(0-env.lineheight, canvas.height);
	}
}

function run()
{
	if (usingGL) initGL();
	else initCanvas();
	var lastUpdate = Date.now();
	var lastTimestep = 0;
	var dt = 0;
	env.frameID = window.requestAnimationFrame(tick);

	function tick(timestep) {
		dt = (timestep - lastTimestep) / 1000;
		lastTimestep =  timestep;
		if (dt<0) { dt=0; }
		if (dt>.1) { dt=.1; }

		if (usingGL) {
			update(dt);
			GLdraw();
		} else {
			update(dt);
			draw();
		}
		env.frameID = window.requestAnimationFrame(tick);
	}
}

start();
