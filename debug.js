debugEnabled = false;

let debug = {
	dcount: 0,
	fpsavgslots: [],
	fpsavgslot: 0,
	fpsavg: 0
}

function drawDebug() {
	if (debug.dcount > .1)	{
		debug.fpsavg = (debug.fpsavgslots.reduce((a,b) => parseFloat(a)+parseFloat(b), 0)/20).toFixed(1);
		let debugText = document.getElementById('debugtext');
		if (!debugText) return;
		debugText.innerHTML = "Chroma Drencher WebGL2 v1.2<br/>"
			+ "<br/>renderer: "+ state.renderer 
			+ "<br/>shading: "+ state.language 
			+ "<br/>avgfps: "+ debug.fpsavg
			+ "<br/>frame: "+ state.frameID
			+ "<br/> offset buffer mem: " + chromagl.lineBuffer.length*4/1024 + " kb"
			+ "<br/> line count: " + chromad.linecount
			+ "<br/> transition time: " + (chromad.ctime/255).toFixed(1)
			+ "<br/> color set 1: " + chromad.gradientLength1 + " = " + chromad.gradientColors1.toString() 
			+ "<br/> color set 2: " + chromad.gradientLength2 + " = " + chromad.gradientColors2.toString() 
			+ "<br/> bg color: " +  chromad.backgroundColor.toString() 
		;
		debug.dcount = 0;
	} else {
		debug.fpsavgslots[debug.fpsavgslot] = (1/state.lastDt).toFixed(1);
		debug.fpsavgslot = (debug.fpsavgslot+1)%20
		
		debug.dcount += state.lastDt;
	}
	window.setTimeout(drawDebug, 10);
}

const debugHTML = `
<div id="debug" style="position:absolute;top:10px;left:10px;font-family:sans-serif;color:white;">
	<p id="debugtext"></p>
	height<br/>
	<input id="debugslide1"type="range" value="1024" min="32" max="1024" oninput="chromad.setLineHeight(debugslide1.value)"/><br/>
	width<br/>
	<input id="debugslide2"type="range" value="2" min="1" max="10" oninput="chromad.setLineWidth(debugslide2.value)"/><br/>
	speed<br/>
	<input id="debugslide3"type="range" value="10" min="0" max="100" oninput="chromad.setLineSpeed(debugslide3.value)"/><br/>
	count<br/>
	<input id="debugslide4"type="range" value="100" min="1" max="400" oninput="chromad.setLineCount(debugslide4.value)"/><br/>
	color speed<br/>
	<input id="debugslide5"type="range" value="30" min="1" max="100" oninput="chromad.setColorSpeed(debugslide5.value)"/><br/>
	direction<br/>
	<input id="debugslide6"type="range" value="0" min="0" max="1" oninput="chromad.rotation = debugslide6.value * 180;"/><br/>
	preview color<br/>
	preview color<br/>
	<input id="debugslideR"style="width:100px;"type="range" value="30" min="1" max="255" oninput="chromad.previewColor(debugslideR.value, debugslideG.value, debugslideB.value)"/>
	<input id="debugslideG"style="width:100px;"type="range" value="30" min="1" max="255" oninput="chromad.previewColor(debugslideR.value, debugslideG.value, debugslideB.value)"/>
	<input id="debugslideB"style="width:100px;"type="range" value="30" min="1" max="255" oninput="chromad.previewColor(debugslideR.value, debugslideG.value, debugslideB.value)"/>
	<br/>
	bg tint<br/>
	<input id="debugslideBR"style="width:100px;"type="range" value="0" min="0" max="25" oninput="chromad.setColorBackground(debugslideBR.value, debugslideBG.value, debugslideBB.value)"/>
	<input id="debugslideBG"style="width:100px;"type="range" value="0" min="0" max="25" oninput="chromad.setColorBackground(debugslideBR.value, debugslideBG.value, debugslideBB.value)"/>
	<input id="debugslideBB"style="width:100px;"type="range" value="0" min="0" max="25" oninput="chromad.setColorBackground(debugslideBR.value, debugslideBG.value, debugslideBB.value)"/>
	<br/>
	color presets<br/>
	<button type="button" onclick="chromad.setColorProgram(1)">Original</button>
	<button type="button" onclick="chromad.setColorProgram(2)">Single Color</button>
	<button type="button" onclick="chromad.setColorProgram(3)">Type 3</button>
	<button type="button" onclick="chromad.setColorProgram(4)">Type 4</button>
	<br/><br/>
	<button id="reloadbutton" type="button" onclick="onResizeActivate()">Reload</button>
	<button id="vrbutton" type="button" onclick="toggleVR()" disabled>Start VR</button>
	<button id="ledbutton" type="button" onclick="ledControl.setupEffectCanvas()">Test rgb</button>
</div>
`;

if (debugEnabled) {
	debugElement = document.createElement('div');
	debugElement.innerHTML = debugHTML;
	document.body.appendChild(debugElement);
	window.setTimeout(drawDebug, 10);
	document.addEventListener("keydown",(e)=>{
		if(e.key=="q") {
			if (debugElement.style.visibility == "hidden") debugElement.style.visibility = "visible";
			else debugElement.style.visibility = "hidden";
		}
	});
}