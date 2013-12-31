var g1, g2;

var socket, connected = false;

var ai = false;
var aiMinWait = 200;
var aiMaxWait = 1500;
var aiTimeout = null;


function reset()
{
	g1.reset();
}

function undo()
{
	g1.undo();
}

function init()
{
	g1 = new Game(12, 24, 64, 64, 2, "1", true);
	g1.init();
}

function sendChat()
{
	var inp = document.getElementById("chatInput");
	var msg = inp.value.trim();
	if (msg.length > 0)
	{
		socket.emit("chat", { text: msg });
		inp.value = "";
	}
}

function init2()
{
	g1 = new Game(12, 24, 32, 32, 1, "1", false);
	g2 = new Game(12, 24, 32, 32, 1, "2", false);
	g1.init();
	g2.init();
	g1.addListener('move', onGame1Move);
	g1.addListener('idle', onGame1Idle);
	g2.addListener('idle', onGame2Idle);

	var inp = document.getElementById("chatInput");
	inp.addEventListener("keydown", function(ev)
	{
		if (ev.keyCode == 13) sendChat();
	})

	initSocketIO();
	updatePresence();
}

function initSocketIO()
{	
	socket = io.connect();

	// base events
	socket.on('connecting', onIoLog.bind(this, 'connecting..'));
	socket.on('connect', onIoConnected);
	socket.on('connect_failed', onIoLog.bind(this, 'connect failed'));
	socket.on('error', onIoLog.bind(this,' error'));
	socket.on('reconnect_failed', onIoLog.bind(this,' reconnect failed'));
	socket.on('reconnect', onIoLog.bind(this, 'reconnected'));
	socket.on('reconnecting', onIoLog.bind(this, 'reconnecting..'));
	socket.on('disconnect', onIoDisconnected);

	// our events
	socket.on('hello', onIoHello);
	socket.on('joined', onIoJoined);
	socket.on('left', onIoLeft);
	socket.on('quit', onIoQuit);
	socket.on('room', onIoRoom);
	socket.on('chat', onIoChat);
	socket.on('game', onIoGame);
} 

var myId = null;
var currentRoomName = 'test';

function addClass(idOrElement, className)
{
	return toggleClass(idOrElement, className, true);
}

function removeClass(idOrElement, className)
{
	return toggleClass(idOrElement, className, false);
}

function toggleClass(idOrElement, className, state)
{
	var el = (typeof idOrElement == 'object') ? idOrElement : document.getElementById(idOrElement);
	if (el)
	{
		var attrs = (el.getAttribute("class") || "").split(/\s+/);
		var idx = attrs.indexOf(className);
		if (state == null) state = !(idx > -1);
		if (!state && idx > -1) attrs.splice(idx, 1); // remove
		if (state && idx < 0) attrs.push(className); // add
		el.setAttribute("class", attrs.join(" "));
	}
}

function onIoConnected()
{
	console.log("CONNECTED")
	myId = null;
	connected = true;
	updatePresence();
}

function onIoDisconnected()
{
	console.log("DISCONNECTED")
	myId = null;
	connected = false;
	updatePresence();
}

function onIoHello(info)
{
	myId = info.id;
	socket.emit("join", currentRoomName);
}

function onIoChat(msg)
{
	console.log("CHAT", msg);
	var h = document.getElementById("chatHistory");
	h.value = (h.value + "\n" + "<" + (msg.id == myId ? "YOU" : "STRANGER") + "> " + msg.text).trim();
	h.scrollTop = h.scrollHeight;
}

function onIoLog(msg, a)
{
	console.log("io:", msg, a);
}

var room = null;

function onIoRoom(ev)
{
	console.log("ROOM", ev);
	room = ev;
}

function onIoJoined(ev)
{
	console.log("JOINED", ev);
	if (room)
	{
		room.clients[ev.id] = { joined: new Date() }
		room.numClients = Object.keys(room.clients).length;
	}
	updatePresence();
}

function onIoLeft(ev)
{
	console.log("LEFT", ev);
	if (room)
	{
		delete room.clients[ev.id];
		room.numClients = Object.keys(room.clients).length;
	}
	updatePresence();
}

function updatePresence()
{
	var youHere = false;
	var strangerHere = false;

	if (connected && room)
	{
		for (var id in room.clients)
		{
			if (id == myId) youHere = true;
			else strangerHere = true;
		}
	}

	g1.text(youHere ? null : "Waiting to join..");
	toggleClass("board1", "vacant", !youHere)

	g2.text(strangerHere ? null : "Waiting for stranger to join..")
	toggleClass("board2", "vacant", !strangerHere)
}

function onIoQuit(ev)
{
	console.log("QUIT", ev);
	onIoLeft(ev);
}

function onIoGame(ev)
{
	console.log("GAME", ev);

	if (ev.type == 'suggest')
	{
		// stranger suggested game
		g2.load(ev.state);
		if (ev.id != myId)
		{
			document.getElementById("acceptButton").style.display = "inline";
			if (ai)
			{
				console.log("AI: accepting game")				
				acceptGame()
			}
		}
	}
	else if (ev.type == 'accept')
	{
		strangerIdle = true;
		strangerMoves = [];
		g1.interactive = !ai;
		if (ev.id != myId)
		{
			// stranger accepted our game
			console.log("Stranger accepted our game")
			g2.load(g1.save());
			startGame(false);
		}
		else
		{
			// accepting stranger's game			
			console.log("Accepting stranger's game")
			g1.load(g2.save());
			startGame(true);
		}
	}
	else if (ev.type == 'move')
	{
		if (ev.id != myId)
		{
			console.log("---- g2 move:", ev)
			strangerMoves.push(ev);
			nextStrangerMove();
		}
	}
}

function resetGame()
{
	console.log("Reset game")
	//g1.interactive = false;
	g1.reset();

	document.getElementById("suggestButton").style.display = "inline";
	document.getElementById("acceptButton").style.display = "none";
}

function suggestGame()
{
	var colors = g1.save();
	socket.emit("game", { room: currentRoomName, type: 'suggest', state: colors })
	console.log("sent suggestion..")	
	// TODO: display "waiting for stranger to accept.. [abort]" message
}

function acceptGame()
{
	socket.emit("game", { room: currentRoomName, type: 'accept' })
}

function startGame(acceptStranger)
{
	document.getElementById("suggestButton").style.display = "none";
	document.getElementById("acceptButton").style.display = "none";
	g1.start();
	g2.start();
}

function onGame1Move(ev)
{
	console.log("game 1 move", ev.x, ev.y);
	socket.emit("game", { type: 'move', x: ev.x, y: ev.y })
}

function onGame2Idle(ev)
{
	// perform next queued event, if any
	console.log("---- Game 2 is idle")
	strangerIdle = true;
	nextStrangerMove();
}

var strangerIdle = true;
var strangerMoves = [];

function nextStrangerMove()
{
	console.log("---- nextStrangerMove ---- " + strangerIdle)

	if (strangerIdle)
	{
		if (strangerMoves.length > 0)
		{
			strangerIdle = false;
			var move = strangerMoves.shift();
			console.log("Dispatching game 2 move:", move.x, move.y);
			g2.clicked(move.x, move.y);			
		}
	}
}

function onGame1Idle(ev)
{
	console.log("Game 1 is idle")
	if (ai)
	{
		var moves = g1.scan();
		if (moves.length > 0)
		{
			var wait = aiMinWait + Math.floor(Math.random() * (aiMaxWait - aiMinWait));
			console.log("AI: waiting " + wait + "ms")
			aiTimeout = setTimeout(function() 
			{
				aiTimeout = null;
				var m = moves.shift();
				console.log("AI: clicking " + m.x + "," + m.y);
				g1.clicked(m.x, m.y);
			}, wait)
		}
	}	
}