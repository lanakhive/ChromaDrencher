"use strict";
(function(){
//////////////////////////////////////////////////////////////////////////
//Setup
/////////////////////////////////////////////////////////////////////////

//canvas for drawing
var canvas, ctx;

function setup() {
	//create container
	var container = document.createElement("div");
	container.style.width="100%";
	container.style.height="100%";
	container.style.position="relative";
	container.id = "linesdemo";
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
	ctx = canvas.getContext("2d");
	window.addEventListener('resize',figuresize,false);

	if (canvas.mozRequestFullScreen)
		//if (0)
	{
		var but = document.createElement("button");
		but.innerHTML='□';
		but.style.cssText="width:30px;height:30px;margin:10px;padding:0;position:absolute;bottom:0;right:0;background:#444;border:1px solid;border-radius:0;color:#eee;box-shadow:none;font:20px sans-serif;text-align:center;opacity:.5;-moz-user-select:none;-webkit-user-select: none";
		container.appendChild(but);
		but.addEventListener('click',function(){
			console.log("Enter fullscreen");
			canvas.mozRequestFullScreen();
		});
	}
}

///////////////////////////////////////////////////////////////////////
//Utility functions
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
//App
//////////////////////////////////////////////////////////////

var env = {
	linedensity : 100,
	lineheight : 1024,
	linewidth : 2,
	tipheight : 64,
	linespeed : 10,
	cspeed : 30,
	density : null,
	line : null,
	lines : null,
	grad : null,
	gradT : null,
	cs : null,
	cs2 : null,
	cs3 : null,
	linebatch : null,
	linebatchS : null,
	ctime : null,
	cup : null,
	linelist : [],
};

function genLine(x,y)
{
	var c = document.createElement("canvas");
	c.width = x;
	c.height = y;
	var ctx = c.getContext("2d");

	var grad = ctx.createLinearGradient(0,0,0,y);
	grad.addColorStop(0, "rgba(255,255,255,0)");
	grad.addColorStop(1, "rgba(255,255,255,1)");
	ctx.fillStyle = grad;
	ctx.fillRect(0,0,x,y);

	return c;
}

function genGradient(w)
{
	var h = canvas.height / 2;
	var c = document.createElement("canvas");
	c.width = w;
	c.height = h;
	var ctx = c.getContext("2d");

	var grad = ctx.createLinearGradient(0,0,0,h);
	grad.addColorStop(0, "rgba(0,0,0,0)");
	grad.addColorStop(1, "rgba(0,0,0,1)");
	ctx.fillStyle = grad;
	ctx.fillRect(0,0,w,h);
	return c;
}

function genGradientTop(w)
{
	var h = canvas.height / 4;
	var c = document.createElement("canvas");
	c.width = w;
	c.height = h;
	var ctx = c.getContext("2d");

	var grad = ctx.createLinearGradient(0,0,0,h);
	grad.addColorStop(0, "rgba(0,0,0,0.7)");
	grad.addColorStop(1, "rgba(0,0,0,0)");
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

function colorSpan(c,w,h)
{
	var ct = coolColors();
	var ctx = c.getContext("2d");
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

function prepareLines()
{
	env.density = env.linedensity * canvas.width / 100;
	//generate lines
	while (env.linelist.length < env.density)
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
	while (env.linelist.length > env.density)
	{
		env.linelist.pop();
	}
}

function init()
{
	//generate gradient offscreen canvases
	env.line = genLine(env.linewidth,env.lineheight);
	env.lines = genLine(env.linewidth,env.tipheight);
	env.grad = genGradient(canvas.width);
	env.gradT = genGradientTop(canvas.width);
	//create colorblend canvases
	env.cs = document.createElement("canvas");
	env.cs.width = canvas.width;
	env.cs.height = canvas.height;
	env.cs = colorSpan(env.cs, canvas.width, canvas.height);
	env.cs2 = document.createElement("canvas");
	env.cs2.width = canvas.width;
	env.cs2.height = canvas.height;
	env.cs2 = colorSpan(env.cs2, canvas.width, canvas.height);
	env.cs3 = document.createElement("canvas");
	env.cs3.width = canvas.width;
	env.cs3.height = canvas.height;

	prepareLines();
	env.ctime = 0;
	env.cup = true;
}

function update(dt)
{
	var i,j,cw,ch;
	cw = canvas.width;
	ch = canvas.height;
	if (dt > 1) dt=0.01;
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
	if (env.cup)
	{
		env.ctime = env.ctime + env.cspeed * dt;
	}
	else
	{
		env.ctime = env.ctime - env.cspeed * dt;
	}
	if (env.ctime > 255) 
	{
		env.ctime = 255;
		env.cup = false;
		env.cs = colorSpan(env.cs, cw, ch);
	}
	if (env.ctime < 0)
	{
		env.ctime = 0;
		env.cup = true;
		env.cs2 = colorSpan(env.cs2, cw, ch);
	}

}

function draw(dt)
{
	var i,j,ctx3,cw,ch;
	cw = canvas.width;
	ch = canvas.height;
	//clear canvas
	//ctx.clearRect(0,0,cw,ch);
	ctx.fillStyle = "#000";
	ctx.fillRect(0,0,cw,ch);
	//draw lines
	for (i=env.linelist.length-1;i>=0;i--)
	{
		j = env.linelist[i];
		ctx.globalAlpha = j.alpha;
		ctx.drawImage(env.line, j.x, Math.floor(j.y));
	}
	ctx.globalAlpha = 1.0;

	//preblend color gradient overlay to temp canvas
	ctx3 = env.cs3.getContext("2d");
	ctx3.globalAlpha = 1.0;
	ctx3.drawImage(env.cs,0,0,cw,ch);
	ctx3.globalAlpha = env.ctime/255;
	ctx3.drawImage(env.cs2,0,0,cw,ch);

	//multiply overlay
	ctx.globalCompositeOperation = "multiply";
	ctx.drawImage(env.cs3,0,0,cw,ch);
	ctx.globalCompositeOperation = "source-over";
	
	//draw small lines
	//ctx.globalAlpha = 160.0/255.0;
	ctx.globalAlpha = 0.6274509;
	for (i=env.linelist.length-1;i>=0;i--)
	{
		j = env.linelist[i];
		if (j.tip)
		{
			ctx.drawImage(env.lines,j.x,Math.floor(j.y)+env.lineheight-env.tipheight);
		}
	}
	ctx.globalAlpha = 1.0;

	//draw top gradient
	ctx.drawImage(env.gradT,0,0);
	//draw bottom gradient
	ctx.drawImage(env.grad,0,ch-env.grad.height);

	
}

function setLineCount(n)
{
	if (n!=env.linedensity)
	{
		env.linedensity = n;
		prepareLines();
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
		env.line = genLine(env.linewidth,env.lineheight);
		env.lines = genLine(env.linewidth,env.tipheight);
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
	env.line = genLine(env.linewidth,env.lineheight);
	env.lines = genLine(env.linewidth,env.tipheight);
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

function figuresize()
{
	var boundsize = canvas.getBoundingClientRect();
	canvas.width = boundsize.width;
	canvas.height = boundsize.height;
	init();
}

function run()
{
	init();
	var lastUpdate = Date.now();
	var lastTimestep = 0;
	var dt = 0;
	//var myInterval = setInterval(tick, 0);
	window.requestAnimationFrame(tick);

	function tick(timestep) {
		//var now = Date.now();
		//var dt = now - lastUpdate;
		//lastUpdate = now;
		dt = timestep - lastTimestep;
		lastTimestep =  timestep;
		if (dt<0) { dt=0; }

		dt = dt/1000;
		update(dt);
		draw(dt);
		window.requestAnimationFrame(tick);
	}
}

setup();
run();
})();
