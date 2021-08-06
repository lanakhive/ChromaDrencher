"use strict";
/////////////////////////////////////////////////////////////////////////////
// Chroma App
/////////////////////////////////////////////////////////////////////////////

function Chroma() {
	this.linedensity = 100;
	this.lineheight = 1024;
	this.linewidth = 2;
	this.tipheight = 64;
	this.tipratio = 0.1;
	this.linespeed = 10;
	this.colorspeed = 30;
	this.colorprogram = 1;
	this.linecount = 0;
	this.ctime = null;
	this.cup = null;
	this.linelist = [];
	this.rotation = 0;
	this.gradientLength1= 0;
	this.gradientLength2= 0;
	this.gradientColors1 = [];
	this.gradientColors2 = [];
	this.backgroundColor = [0,0,0];
	//this.colorList = [[255,40,100],[255,255,0],[255,150,0],[150,0,255],[150,255,100],[255,0,200],[40,100,255]];
	this.colorList = [[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]];
	this.colorMax = 5;
	//this.colorCustom = [[255,40,100],[255,255,0],[255,150,0],[150,0,255],[150,255,100],[255,0,200],[40,100,255]];
	this.colorCustom = [[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]];
	this.preview = false;
	this.previewState = {};
	this.loadedCount = 0;

	this.setupChroma();
}

Chroma.prototype.coolColors = function() {
	let colorList = this.colorList.slice();
	colorList.shuffle();
	//colorList = colorList.slice(0, randI(3, 5));
	colorList = colorList.slice(0, randI(Math.min(this.colorMax, 3), Math.min(this.colorMax, 5)));
	return colorList;
}

Chroma.prototype.colorSpan = function(top) {
	const colors = this.coolColors();
	if (top) {
		this.gradientColors1 = [].concat(...colors);
		this.gradientLength1 = colors.length;
	} else {
		this.gradientColors2 = [].concat(...colors);
		this.gradientLength2 = colors.length;
	}
}

Chroma.prototype.prepareLines = function() {
	this.linelist = [];
	this.linecount = Math.floor(this.linedensity * canvas.width / 100);
	//generate lines
	for (let i = 0; i < this.linecount; i++) {
		const line = this.createLine();
		this.linelist.push(line);
	}
}

Chroma.prototype.createLine = function() {
	const newLine = {};
	newLine.x = randI(0, canvas.width);
	//align to linewidth
	//newLine.x = newLine.x - (newLine.x % this.linewidth);
	newLine.y = randI(0, canvas.height+this.lineheight);
	newLine.sp = 5 * Math.random() + 3;
	newLine.tip = false;
	newLine.alpha = randI(25, 100) / 255.0;

	let tiprate = this.tipratio;
	if (this.linecount > 4000) tiprate = this.tipratio/2;
	if (this.linecount > 8000) tiprate = this.tipratio/4;
	//bright tip
	if (Math.random() < tiprate)
	{
		newLine.tip = true;
		newLine.alpha = 220 / 255.0;
	}
	return newLine;
}

Chroma.prototype.setupChroma = function() {
	// regenerate lines and reset color program cycle
	this.prepareLines();
	// apply default color set
	this.applyColors();
}

Chroma.prototype.update = function(dt) {
	// Update line positions (not used with gl particles)
	//this.updateLines(dt);
	if (this.preview) {
		this.updatePreview(dt);
	} else {
		//update background color
		this.ctime = this.ctime + (this.cup * this.colorspeed * dt);

		if (this.ctime > 255) {
			this.ctime = 255;
			this.cup = -1.0;
			this.colorSpan(true);
		} else if (this.ctime < 0) {
			this.ctime = 0;
			this.cup = 1.0;
			this.colorSpan(false);
		}
	}
}

Chroma.prototype.updateLines = function(dt) {
	const cw = canvas.width;
	const ch = canvas.height;
	//update lines
	for (let i = 0; i < this.linecount; i++) {
		const line = this.linelist[i];
		line.y += (line.sp * this.linespeed) * dt;
		if (line.y > ch) line.y = 0 - this.lineheight;
	}
}

Chroma.prototype.setLineCount = function(n) {
	if (n!=this.linedensity)
	{
		this.linedensity = n;
		const newcount = Math.floor(this.linedensity * canvas.width / 100);
		// remove extra lines
		while (this.linecount > newcount) {
			this.linelist.pop();
			this.linecount--;
		}
		// add new lines
		while (this.linecount < newcount)
		{
			const line = this.createLine();
			this.linelist.push(line);
			this.linecount++;
		}
	}
}

Chroma.prototype.setLineHeight = function(n) {
	let newHeight = n * 100 / this.linedensity;
	// limit height range
	if (newHeight > 2048) newHeight = 2048;
	if (newHeight < 64) newHeight = 64;
	// shrink tip if line is very small
	if (n < 128) this.tipheight = n / 2;
	else this.tipheight = 64;
	// update line position so it does not appear to have moved
	for (let i = 0; i < this.linecount; i++) {
		this.linelist[i].y = this.linelist[i].y + (this.lineheight - n)
		if (this.lineheight > n && this.linelist[i].y > canvas.height) {
			this.linelist[i].y = 0 - n - (this.linelist[i].y - canvas.height) - randI(0, canvas.height);
		}
	}
	this.lineheight = n;
}

Chroma.prototype.setLineWidth = function(n) {
	if (n <= 0 || n > 8) return;
	this.linewidth = n;
	//this.applyColors();
}

Chroma.prototype.setLineSpeed = function(n) {
	if (n != this.linespeed) {
		this.linespeed = n/3;
	}
}

Chroma.prototype.setColorSpeed = function(n) {
	if (n != this.colorspeed) {
		this.colorspeed = n;
	}
}

Chroma.prototype.setColorBackground = function(r,g,b) {
	const red = (0.1*r / 255).toFixed(3);
	const green = (0.1*g / 255).toFixed(3);
	const blue = (0.1*b / 255).toFixed(3);
	this.backgroundColor = [red, green, blue];
}

Chroma.prototype.setCustomColor = function(index, color) {
	this.loadedCount++;
	// don't set and preview if existing color is the same
	const existingColor = this.colorCustom[index];
	if (color[0] == existingColor[0] && color[1] == existingColor[1] && color[2] == existingColor[2]) return;	
	// don't allow preview until all slots loaded
	if (this.loadedCount > 7) {
		// start preview and assign
		this.previewColor(color[0], color[1], color[2]);
	}
	// assign color to slot in list
	this.colorCustom[index] = color;
	// immediately apply colors if loading inital set
	if (this.loadedCount == 7) this.applyColors();
}

Chroma.prototype.applyColors = function() {
	//console.log("applying colors..");
	this.colorList = this.colorCustom.slice();

	// slightly dim color as line with increases
	/*
	if (this.linewidth > 2) {
		const fact = (this.linewidth - 2) * 0.05;
		for (var color of this.colorList) {
			color[0] = Math.max(0,color[0] - color[0]*fact);
			color[1] = Math.max(0,color[1] - color[1]*fact);
			color[2] = Math.max(0,color[2] - color[2]*fact);
		}
	}
	*/

	this.colorSpan(true);
	this.colorSpan(false);
	this.ctime = 0;
	this.cup = 1.0;
}

Chroma.prototype.previewColor = function(r,g,b) {
	// if not already previewing, save color state
	if (!this.preview) {
		this.previewState.ctime = this.ctime;
		this.previewState.gradientLength1 = this.gradientLength1;
		this.previewState.gradientColors1 = this.gradientColors1;
	}
	// activate preview
	this.preview = true;
	this.previewState.time = 1;
	this.ctime = 0;
	this.gradientLength1 = 1;
	this.gradientColors1 = [r,g,b];
}

Chroma.prototype.updatePreview = function(dt) {
	if (!this.preview) return;
	this.previewState.time -= dt;
	// restore color state
	if (this.previewState.time <= 0) {
		this.preview = false;
		this.ctime = this.previewState.ctime;
		this.gradientLength1 = this.previewState.gradientLength1;
		this.gradientColors1 = this.previewState.gradientColors1;
		this.applyColors();
	}
}

