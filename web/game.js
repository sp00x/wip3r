"use strict";

function Game(cols, rows, blockWidth, blockHeight, lineWidth, elSuffix, interactive)
{
	EventTarget.call(this); // inherited c'tor

	this.cols = cols || 12;
	this.rows = rows || 24;

	this.ui = (elSuffix != null);
	this.interactive = (this.ui == true) && (interactive != null) ? !!interactive : true;
	this.lineWidth = lineWidth;

	if (this.ui)
	{
		this.boardEl = document.getElementById("board" + elSuffix);
		this.textEl = document.getElementById("text" + elSuffix);
		this.scoreEl = document.getElementById("score" + elSuffix);
	}

	this.enableAudio = false;

	this.blockWidth = blockWidth || 64;
	this.blockHeight = blockHeight || this.blockWidth;

	this.totalScore = 0;
	this.blockScore = 0;
	this.isGameOver = false;
	this.isBusy = false;

	this.history = new Array();
	this.cells = []; // 0=free, 1=red, 2=green, 3=yellow, 4=blue
	//this.colors = [ null, "red", "green", "orange", "blue"];
	this.colors = [ null, "red", "green", "orange", "blue"];
	this.colorCounts = [ 0, 0, 0, 0, 0 ];
	this.colorCounts0 = null;
	this.numShuffles = 40;

	this.popAudioIndex = 0;
	this.popAudioNum = 2;

	this.nextBlockDelay = 80; // millisecond pause between each block

	this.polys = [
		[
			[ [this.blockWidth, 0], [0, 0], [this.blockWidth, this.blockHeight] ],				// \|
			[ [0, 0], [0, this.blockHeight], [this.blockWidth, this.blockHeight] ]	            // |\
		],

		[
			[ [0, 0], [0, this.blockHeight], [this.blockWidth, 0] ],							// |/
			[ [this.blockWidth, 0], [this.blockWidth, this.blockHeight], [0, this.blockHeight] ]	// /|
		]
	];
	/*
	this.polys = [
		[
			[ [this.blockWidth-1, 0], [0, 0], [this.blockWidth-1, this.blockHeight-1] ],				// \|
			[ [0, 0], [0, this.blockHeight-1], [this.blockWidth-1, this.blockHeight-1] ]	            // |\
		],

		[
			[ [0, 0], [0, this.blockHeight-1], [this.blockWidth-1, 0] ],							// |/
			[ [this.blockWidth-1, 0], [this.blockWidth-1, this.blockHeight-1], [0, this.blockHeight - 1] ]	// /|
		]
	];
	*/
}

Game.prototype = new EventTarget();
Game.prototype.constructor = Game;

Game.prototype.isPointInPoly = function(poly, pt)
{
    for(var c = false, i = -1, l = poly.length, j = l - 1; ++i < l; j = i)
        ((poly[i][1] <= pt[1] && pt[1] < poly[j][1]) || (poly[j][1] <= pt[1] && pt[1] < poly[i][1]))
        && (pt[0] < (poly[j][0] - poly[i][0]) * (pt[1] - poly[i][1]) / (poly[j][1] - poly[i][1]) + poly[i][0])
        && (c = !c);
    return c;
}

Game.prototype.init = function()
{
	if (this.ui)
	{
		//var m = this.mainAreaEl;
		//m.style.width = (this.blockWidth * this.cols) + "px";
		//m.style.height = (this.blockHeight * this.rows / 2) + "px";

		this.boardEl.innerHTML = "";
	}

	// initialize arrays
	for (var y=0; this.rows>y; y++)
	{
		var row = [];
		for (var x=0; this.cols>x; x++) row.push({ el: null, alt: false, color: 0 });
		this.cells.push(row);
	}

	for (var y=0; this.rows>y; y+=2)
	{
		for (x=0; this.cols>x; x++)
		{
			this.cells[y][x].el = null;
			this.cells[y+1][x].el = null;
			var a = (x % 2 == 0) ^ (y % 4 == 0); // cols and rows should alternate
			this.cells[y][x].alt = !a;
			this.cells[y+1][x].alt = !a;
		}
	}

	this.reset();
}

Game.prototype.reset = function()
{
	this.isBusy = false;
	this.isGameOver = false;
	this.history = new Array();
	this.totalScore = 0;
	this.randomize2();
	this.update();

	if (this.ui)
	{
		var el =  this.textEl;
		el.innerHTML = "";
		el.style.display = "none";
	}

	this.fire({ type: 'reset' })
}

Game.prototype.load = function(state)
{
	var colors = state.colors;

	var i = 0;
	for (var y=0; this.rows>y; y++)
		for (var x=0; this.cols>x; x++)
			this.cells[y][x].color = state.colors[i++];
	this.update();

	return colors;
}

Game.prototype.save = function()
{
	var colors = [];
	for (var y=0; this.rows>y; y++)
		for (var x=0; this.cols>x; x++)
			colors.push(this.cells[y][x].color);

	return { colors: colors };
}

Game.prototype.randomize2 = function()
{
	for (var i=0; this.colorCounts.length>i; i++) this.colorCounts[i] = 0;

	var num = Math.floor((this.rows * this.cols) / (this.colors.length - 1));
	var vals = [];
	for (var i=1; this.colors.length>i; i++) for (var j=0; num>j; j++) vals.push(i);
	var left = (this.rows * this.cols) - (this.colors.length - 1) * num;
	for (var i=0; left>i; i++) vals.push(i+1);

	for (var y=0; this.rows>y; y++)
	{
		for (var x=0; this.cols>x; x++)
		{
			var i = Math.floor(Math.random() * vals.length);
			var c = vals.splice(0, 1)[0];
			this.cells[y][x].color = c;
			this.cells[y][x].highlight = false;
			this.colorCounts[c]++;
		}
	}

	this.colorCounts0 = [].concat(this.colorCounts); // make a copy

	this.shuffle(this.numShuffles);
}

Game.prototype.randomize3 = function()
{
	for (var i=0; this.colorCounts.length>i; i++) this.colorCounts[i] = 0;

	var num = Math.floor((this.rows * this.cols) / (this.colors.length - 1));
	var vals = [];
	for (var i=1; this.colors.length>i; i++)
	{
		for (var j=0; num>j; j++) vals.push(i);
	}
	var left = (this.rows * this.cols) - (this.colors.length - 1) * num;
	for (var i=0; left>i; i++)
	{
		vals.push(i+1);
	}

	for (var y=0; this.rows>y; y++)
	{
		for (var x=0; this.cols>x; x++)
		{
			var i = Math.floor(Math.random() * vals.length);
			var c = vals.splice(i, 1)[0];
			this.cells[y][x].color = c;
			this.cells[y][x].highlight = false;
			this.colorCounts[c]++;
		}
	}

	//console.log(colorCounts)
	this.colorCounts0 = [].concat(this.colorCounts); // make a copy
}

Game.prototype.shuffle = function(num)
{
	num = num || 0;

	var old = [];
	for (var y=0; this.rows>y; y++)
	{
		var r = [];
		for (var x=0; this.cols>x; x++)
			r.push(this.cells[y][x].color);
		old.push(r);
	}

	var x1 = Math.floor(Math.random() * this.cols);
	var y1 = Math.floor(Math.random() * this.rows);

	var x2 = Math.floor(Math.random() * this.cols);
	var y2 = Math.floor(Math.random() * this.rows);

	if (x1 > x2) { var t = x1; x1 = x2; x2 = t; }
	if (y1 > y2) { var t = y1; y1 = y2; y2 = t; }

	var dy = y2 - y1 + 1;
	var dx = x2 - x1 + 1;

	var sx = 4;
	var sy = 4;

	for (var y=y1; y2>=y; y++)
		for (var x=x1; x2>=x; x++)
		{
			var rx = x - x1;
			var ry = y - y1;

			this.cells[y][x].color = old[y1 + (ry+sy)%dy][x1 + (rx+sx)%dx];
		}

	if (num > 0)
		this.shuffle(num - 1);
	else
		this.update();
}

Game.prototype.updateScore = function()
{
	this.fire({ type: 'score', score: this.totalScore })

	if (this.ui)
	{
		var sel = this.scoreEl;
		sel.innerHTML = this.totalScore;
	}
}

Game.prototype.update = function()
{
	if (!this.ui) return;

	this.updateScore();

	var board = this.boardEl;
	for (var y=0; this.cells.length>y; y+=2)
	{
		var row = this.cells[y];
		for (var x=0; row.length>x; x++)
		{
			this.createBlockCanvas(x, y); 
		}
	}
}

Game.prototype.updateBlock = function(x, y)
{
	this.fire({ type: 'block-updated', x: x, y: y })

	if (!this.ui) return;

	if (y % 2 == 1) y--;
	this.createBlockCanvas(x, y);

}

Game.prototype.createBrush = function(ctx, col)
{
	var g = ctx.createLinearGradient(0, 0, this.blockWidth-1, this.blockHeight-1);
	g.addColorStop(0, col);
	g.addColorStop(0.85, col);
	g.addColorStop(1, "black");
	return g;
}

Game.prototype.createBlockCanvas = function(x, y)
{
	if (!this.ui) return;

	var ca = this.cells[y][x];
	var cb = this.cells[y+1][x];

	var a = ca.color;
	var b = cb.color;
	var v = ca.alt ? 0 : 1;

	var canvas = ca.el;
	if (canvas == null)
	{
		canvas = document.createElement("canvas");
		canvas.setAttribute("class", "block");
		canvas.style.position = "absolute";
		canvas.style.left = (x * this.blockWidth) + "px";
		canvas.style.top = ((y / 2) * this.blockHeight) + "px";
		canvas.width = this.blockWidth;
		canvas.height = this.blockHeight;
		canvas.id = "block_" + y + "_" + x;
		ca.el = canvas;
		cb.el = canvas;
		this.boardEl.appendChild(canvas);
	}	
	
	var ctx = canvas.getContext("2d");
	ctx.clearRect(0, 0, this.blockWidth, this.blockHeight);

	var pa = this.polys[v][0];
	var pb = this.polys[v][1];

	// top
	if (a > 0)
	{
		ctx.beginPath();
		ctx.moveTo(pa[0][0], pa[0][1]);
		ctx.lineTo(pa[1][0], pa[1][1]);
		ctx.lineTo(pa[2][0], pa[2][1]);
		ctx.closePath();
		ctx.fillStyle = this.createBrush(ctx, this.colors[a]);
		//if (ca.highlight) ctx.globalAlpha = 0.25;
		ctx.fill();
		ctx.strokeStyle = "black";
		ctx.lineWidth = this.lineWidth;
		ctx.stroke();
		//ctx.globalAlpha = 1;
	}

	// bottom
	if (b > 0)
	{
		ctx.beginPath();
		ctx.moveTo(pb[0][0], pb[0][1]);
		ctx.lineTo(pb[1][0], pb[1][1]);
		ctx.lineTo(pb[2][0], pb[2][1]);
		ctx.closePath();
		if (cb.highlight) ctx.globalAlpha = 0.25;
		ctx.fillStyle = this.createBrush(ctx, this.colors[b]);
		ctx.fill();
		ctx.strokeStyle = "black";
		ctx.lineWidth = this.lineWidth;
		ctx.stroke();
		ctx.globalAlpha = 1;
	}

	
	if (this.ui)
	{
		var me = this;
		canvas.addEventListener("click", function(e)
		{
			if (me.interactive)
			{
				//var rel = me.boardEl; // me.mainAreaEl;
				//var cx = e.pageX - rel.offsetLeft - canvas.offsetLeft; // e.layerX
				//var cy = e.pageY - rel.offsetTop - canvas.offsetTop; // e.layerY

				var cx = e.offsetX; //+ canvas.offsetLeft;
				var cy = e.offsetY; // + canvas.offsetTop;
				console.log(cx, cy)

				//console.log(rel.offsetLeft, rel.offsetTop, e.pageX, e.pageY, canvas.offsetLeft, canvas.offsetTop)

				me.clickTest.call(me, x, y, cx, cy)
			}
		});
	}

}

Game.prototype.clickTest = function(x, y, cx, cy)
{
	if (this.isBusy) return;
	if (this.isGameOver) { return this.gameover() }

	var v = this.cells[y][x].alt ? 0 : 1;
	var yv = (y % 2 == 0) ? 1 : 0;

	var p1 = [].concat(this.polys[v][yv]);
	p1.push([ p1[0][0], p1[0][1] ]); // close path

	var p2 = [].concat(this.polys[v][(yv + 1) % 2]);
	p2.push([ p2[0][0], p2[0][1] ]); // close path

	var p = [ cx, cy ];
	if (this.isPointInPoly(p1, p)) this.clicked(x, y+1);
	else if (this.isPointInPoly(p2, p)) this.clicked(x, y);
}

Game.prototype.clicked = function(x, y)
{
	console.log(this.colors[this.cells[y][x].color]);

	this.fire({ type: 'clicked', x: x, y: y });

	var color = this.cells[y][x].color;
	if (color > 0)
	{
		var seen = {};
		var score = this.probe(x, y, color, seen);
		if (score > 1)
		{
			this.fire({ type: 'move', x: x, y: y });

			this.colorCounts[color] -= score;
			this.snapshot();
			var blocks = Object.keys(seen).map(function(i) { return seen[i] });
			this.nextBlock(blocks, 10);
		}
	}
	else
	{
		this.fire({ type: 'idle' })
	}
}

Game.prototype.nextBlock = function(blocks, score)
{
	this.isBusy = true;

	if (blocks.length == 0)
	{
		this.isBusy = false;
		this.compact();
		this.update();
		if (this.isOver())
		{
			return this.gameover();
		}
		this.fire({ type: 'idle' });
	}
	else
	{
		this.totalScore += score;
		var b = blocks.shift();
		this.cells[b[1]][b[0]].color = 0;
		this.updateBlock(b[0], b[1]);
		this.updateScore();
		this.playAudio("popAudio" + this.popAudioIndex);
		this.popAudioIndex = (this.popAudioIndex + 1) % this.popAudioNum;
		
		var me = this;
		setTimeout(function() { me.nextBlock.call(me, blocks, score + 10) }, me.nextBlockDelay);
	}
}

Game.prototype.resetHighlight = function()
{
	for (var yy=0; this.rows>yy; yy++)
		for (var xx=0; this.cols>xx; xx++)
			this.cells[yy][xx].highlight = false;
}

Game.prototype.start = function()
{
	this.fire({ type: 'idle' });
}

Game.prototype.hunt = function(x, y, wantColor)
{
	var ty = !!(y % 2);
	var alt = this.cells[y][x].alt;

	var allowLeft = (ty == alt);
	var allowRight = !allowLeft;

	var score = 0;
	var color = this.cells[y][x].color;
	if (color == wantColor)
	{
		score++;
		this.cells[y][x].color = 0;

		if (x > 0 && allowLeft) score += this.hunt(x-1, y, wantColor);
		if (this.cols > (x+1) && allowRight) score += this.hunt(x+1, y, wantColor);

		if (y > 0) score += this.hunt(x, y-1, wantColor);
		if (this.rows > (y+1)) score += this.hunt(x, y+1, wantColor);
	}
	return score;
}

Game.prototype.probe = function(x, y, wantColor, seen)
{
	var ty = !!(y % 2);
	var alt = this.cells[y][x].alt;

	var allowLeft = (ty == alt);
	var allowRight = !allowLeft;

	var score = 0;
	var color = this.cells[y][x].color;
	if (color == wantColor)
	{
		if (seen == null) seen = {};
		var z = x + "|" + y;
		if (seen[z] != null) return 0; // already been here
		seen[z] = [x, y];

		score++;

		if (x > 0 && allowLeft) score += this.probe(x-1, y, wantColor, seen);
		if (this.cols > (x+1) && allowRight) score += this.probe(x+1, y, wantColor, seen);

		if (y > 0) score += this.probe(x, y-1, wantColor, seen);
		if (this.rows > (y+1)) score += this.probe(x, y+1, wantColor, seen);
	}
	return score;
}

Game.prototype.isOver = function()
{
	var t0 = new Date().getTime();
	var a = this.isOverX();
	var d = ((new Date().getTime()) - t0) / 1000;
	//console.log("isOver() ~ " + d)
	return a;
}

Game.prototype.isOverX = function()
{
	for (var y=0; this.rows>y; y++)
		for (var x=0; this.cols>x; x++)
		{
			if (this.cells[y][x].color == 0) continue;
			if (this.probe(x, y, this.cells[y][x].color) > 1) return false;
		}

	return true;
}

Game.prototype.scan = function()
{
	var booty = [];

	var seen = [];
	for (var y=0; this.rows>y; y++)
	{
		var r = [];
		for (var x=0; this.cols>x; x++) r.push(false);
		seen.push(r);
	}

	for (var y=0; this.rows>y; y++)
	{
		for (var x=0; this.cols>x; x++)
		{
			if (!seen[y][x])
			{
				seen[y][x] = true;
				if (this.cells[y][x].color == 0) continue; // nothing to see
				var blocks = {};
				var score = this.probe(x, y, this.cells[y][x].color, blocks);
				if (score > 1)
				{
					for (var j in blocks)
					{
						var b = blocks[j];
						seen[b[1]][b[0]] = true;
					}
					booty.push({ x: b[0], y: b[1], score: score, blocks: blocks })
				}
			}
		}
	}

	booty.sort(function(a,b) { return b.score - a.score });

	return booty;
}

Game.prototype.compact = function()
{
	var compacted = false;
	var counts = [];

	// trickle-down tiles into empty spaces
	for (var x=0; this.cols>x; x++)
	{
		var count = 0;

		var yins = this.rows - 1;
		for (y = yins; y >= 0; y--)
		{
			if (this.cells[y][x].color > 0)
			{
				count++;

				this.cells[yins][x].color = this.cells[y][x].color;
				if (yins != y)
				{
					this.cells[y][x].color = 0;
					compacted = true;
				}
				yins--;
			}
		}

		counts.push(count);
	}
	//console.log(counts);

	// compact empty rows
	var xins = 0;
	for (var x=0; this.cols>x; x++)
	{
		for (var y=0; this.rows>y; y++)
		{
			this.cells[y][xins].color = this.cells[y][x].color;
		}
		if (counts[x] > 0) xins++;
	}
	// clear any remainding
	for (var x=xins; this.cols>x; x++)
	{
		compacted = true;
		for (var y=0; this.rows>y; y++)
			this.cells[y][x].color = 0;
	}

	if (compacted)
	{
		this.playAudio("rumbleAudio");
	}
}

Game.prototype.playAudio = function(id)
{
	if (!this.audioEnabled || !this.interactive || !this.ui) return;

	try
	{
		var aud = document.getElementById(id);
		if (aud && aud.play)
		{
			aud.pause();
			aud.currentTime = 0;
			aud.play();
		}
	}
	catch (E)
	{		
	}
}

Game.prototype.snapshot = function()
{
	try
	{
		var colors = [];
		for (var y=0; this.rows>y; y++)
			for (var x=0; this.cols>x; x++)
				colors.push(this.cells[y][x].color);

		var h = { colors: colors, score: this.totalScore /*, time: new Date().getTime()*/ }
		this.history.push(h);
	}
	catch (E)
	{
		// history.push() fails in android 2.3.x - not sure why
	}
}

Game.prototype.undo = function()
{
	// FIXME this does not undo the changes to the color counts -> can be > 100% at end

	var prev = this.history.pop();
	if (prev != null)		
	{
		this.isGameOver = false;
		this.totalScore = prev.score;
		for (var y=0; this.rows>y; y++)
			for (var x=0; this.cols>x; x++)
				this.cells[y][x].color = prev.colors.shift();
		this.update();
	}
}

Game.prototype.text = function(t)
{
	if (t != null)
	{
		this.textEl.style.display = "block";
		this.textEl.innerHTML = t.replace(/\n/g, "<br/>").replace(/  /g, "&nbsp;&nbsp;");
	}
	else
	{
		this.textEl.style.display = "none";
	}
}

Game.prototype.gameover = function()
{
	this.playAudio("gameoverAudio")

	var t = "<span class='head'>G A M E   O V E R</span>\n\n";

	if (!this.isGameOver) this.blockScore = this.totalScore;
	this.totalScore = this.blockScore;

	t += "Block score:\n" + this.blockScore + "\n\n";

	var bonus = 1000;
	var bonuses = 0;

	for (var i=1; this.colors.length>i; i++)
	{
		t += this.colors[i] + ": " + Math.round(100.0 * (this.colorCounts0[i] - this.colorCounts[i]) / this.colorCounts0[i]) + "%";
		if (this.colorCounts[i] == 0)
		{
			this.totalScore += bonus;
			t += "\nBONUS! +" + bonus;
			bonus += 1000;
			bonuses++;
		}
		t += "\n\n";
	}

	if (bonuses == this.colors.length - 1)
	{
		t += "All blocks cleared!\nBONUS! +10000\n\n";
	}

	t += "Final score:\n" + this.totalScore;

	this.isGameOver = true;

	this.updateScore();

	if (this.ui)
	{
		this.text(t)
	}

	this.fire({ type: 'gameover' })
}
