/////////////////////////////////////////////////////////////////////////////
// Wallpaper Engine 
/////////////////////////////////////////////////////////////////////////////

window.wallpaperPropertyListener = {
	//wallpaper engine events
	applyUserProperties: function(properties) {
		if (properties.linecount) {
			chromad.setLineCount(properties.linecount.value);
		}
		if (properties.lineheight) {
			chromad.setLineHeight(properties.lineheight.value);
		}
		if (properties.linewidth) {
			chromad.setLineWidth(properties.linewidth.value);
		}
		if (properties.linespeed) {
			chromad.setLineSpeed(properties.linespeed.value);
		}
		if (properties.colorspeed) {
			chromad.setColorSpeed(properties.colorspeed.value);
		}
		if (properties.direction) {
			chromad.rotation = properties.direction.value;
		}
		if (properties.color0) {
			let color = mapColor(properties.color0.value);
			chromad.setCustomColor(0, color);
		}
		if (properties.color1) {
			let color = mapColor(properties.color1.value);
			chromad.setCustomColor(1, color);
		}
		if (properties.color2) {
			let color = mapColor(properties.color2.value);
			chromad.setCustomColor(2, color);
		}
		if (properties.color3) {
			let color = mapColor(properties.color3.value);
			chromad.setCustomColor(3, color);
		}
		if (properties.color4) {
			let color = mapColor(properties.color4.value);
			chromad.setCustomColor(4, color);
		}
		if (properties.color5) {
			let color = mapColor(properties.color5.value);
			chromad.setCustomColor(5, color);
		}
		if (properties.color6) {
			let color = mapColor(properties.color6.value);
			chromad.setCustomColor(6, color);
		}
		if (properties.gradient) {
			let gradientBands = properties.gradient.value ? 5 : 1;
			if (chromad.colorMax != gradientBands) {
				chromad.colorMax = gradientBands;
				chromad.applyColors();
			}
		}
		if (properties.tint) {
			let color = mapColor(properties.tint.value);
			chromad.setColorBackground(color[0],color[1],color[2]);
		}
		if (properties.fpslock) {
			state.fpslock = properties.fpslock.value;
		}
	},
	applyGeneralProperties: function(properties) {
		if (properties.fps) {
			state.fps = properties.fps;
		}
	}
};

window.wallpaperPluginListener = {
	onPluginLoaded: function(name, version) {
		if (name === 'led') {
			ledControl.ledAvailable = true;
			ledControl.start();
		}
	}
}

function mapColor(color) {
	let colorval = color.split(' ');
	colorval = colorval.map(function(c) {
		return Math.ceil(c * 255);
	});
	return colorval;
}

function sameColor(color1, color2) {
	//not nice but prob the fastest method
	return (color1[0] == color2[0] && color1[1] == color2[1] && color1[2] == color2[2]);	
}

/////////////////////////////////////////////////////////////////////////////
// RGB LED Hardware
/////////////////////////////////////////////////////////////////////////////

const ledControl = {
	ledAvailable: false,
	ctx: null,
	updateInterval: 100,
};

ledControl.start = function() {
	if (ledControl.ledAvailable) {
		ledControl.setupEffectCanvas();
		ledControl.drawEffectCanvas();
	}
}

ledControl.setupEffectCanvas = function() {
	let canvas = document.createElement('canvas');
	canvas.width = 25;
	canvas.height = 6;
	//canvas.style.position = "absolute";
	//canvas.style.width = "250px";
	//canvas.style.height = "60px";
	//canvas.style.left = "10px";
	//canvas.style.bottom = "-100px";
	//const debugElement = document.getElementById("debug");
	//debugElement.appendChild(canvas);
	ledControl.ctx = canvas.getContext("2d");
}

ledControl.drawEffectCanvas = function() {
	const ctx = ledControl.ctx;
	ctx.globalAlpha = 1.0;
	ctx.fillStyle = "black";
	ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

	const set1 = chromad.gradientColors1;
	const set2 = chromad.gradientColors2;
	const opacity = chromad.ctime / 255;
	ledControl.colorSpan(ctx, set1, 1.0);
	ledControl.colorSpan(ctx, set2, opacity);

	ledControl.applyEffectCanvas();
	window.setTimeout(ledControl.drawEffectCanvas, ledControl.updateInterval);
}

ledControl.applyEffectCanvas = function() {
	const encodedImageData = ledControl.getEncodedCanvasImageData(ledControl.ctx.canvas);
	window.wpPlugins.led.setAllDevicesByImageData(encodedImageData, ledControl.ctx.canvas.width, ledControl.ctx.canvas.height);
}

ledControl.colorSpan = function(context, colorSet, opacity)
{
	const width = context.canvas.width;
	const height = context.canvas.height;

	let gap = width / (colorSet.length/3-1);
	let x = 0;

	var gradient = context.createLinearGradient(0, 0, width, 0);
	for (let i = 0; i < colorSet.length; i+=3)
	{
		gradient.addColorStop(x, "rgb(" + colorSet[i] + "," + colorSet[i+1] + "," + colorSet[i+2] + ")");
		x = x + ((gap) / width);
	}
	context.globalAlpha = opacity;
	context.fillStyle = gradient;
	context.fillRect(0, 0, width, height);
}

ledControl.getEncodedCanvasImageData = function(canvas) {
    var context = canvas.getContext('2d');
    var imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    var colorArray = [];

    for (var d = 0; d < imageData.data.length; d += 4) {
        var write = d / 4 * 3;
        colorArray[write] = imageData.data[d];
        colorArray[write + 1] = imageData.data[d + 1];
        colorArray[write + 2] = imageData.data[d + 2];
    }
    return String.fromCharCode.apply(null, colorArray);
}
