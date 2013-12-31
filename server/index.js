var FS = require('fs');
var HTTP = require('http');
var Express = require('express');
var SocketIO = require('socket.io');
var Q = require('q');

var app, io;

var config =
{ 
	http:
	{
		port: 8884
	}
}

initExpress().then(function()
{
	console.log("All systems are go!")
});


function initExpress()
{
    var deferred = Q.defer();
    try
    {
        console.info("Initializing Express..");

        // set up web stuff
        app = Express();
        var server = HTTP.createServer(app);
        io = SocketIO.listen(server);
        io.configure(function ()
        {
            io.set('log level', 1);
        });
        io.sockets.on('connection', onIoConnection);

        app.configure(function ()
        {
            app.set('json spaces', 0);
            app.use(Express.compress());
            app.use(Express.urlencoded())
            app.use(Express.json())
        });

        //app.get("/js/JsonOptimize.js", function (req, res) { res.sendfile(__dirname + '/lib/JsonOptimize.js') });
        app.use(Express.static(__dirname + '/../web'));

        // listing/retrieving
        //app.get('/api/1/terms/:term', appGetTerm);

        server.listen(config.http.port);
        deferred.resolve();
        return deferred.promise;
    }
    catch (err)
    {
        console.error("Error while initializing Express: ", err, err.stack);
        deferred.reject();
    }
}

var ioClientId = 0;
var ioClientCount = 0;
var ioClients = { };
var ioRooms = {};

function ioLeaveRoom(room, clientId)
{
    if (typeof room != 'string') return 'invalid room name';
	var cli = ioClients[clientId];
	if (cli == null) return 'invalid client'; // client doesn't exist
	if (cli.rooms[room] == null) return 'client not in room'; // client is not in that room

	io.sockets.in(room).emit('left', { id: clientId, room: room });

	cli.socket.leave(room);
	delete cli.rooms[room];

	delete ioRooms[room].clients[clientId];
	ioRooms[room].numClients--;

	if (ioRooms[room].numClients == 0)
	{
		console.log("room empty - deleting: " + room)
		delete ioRooms[room];
	}

    return true;
}

function ioJoinRoom(roomName, clientId, maxClientCount)
{
        if (typeof roomName != 'string') return 'invalid room name';
        var cli = ioClients[clientId];
        if (cli == null) return 'invalid client';
        if (cli.rooms[roomName] != null) return 'client already in room';
        var room = ioRooms[roomName];
        if (room == null)
        {
            console.log("room created: " + roomName)
            room = ioRooms[roomName] = { created: new Date(), numClients: 0, clients: {}, maxClientCount: maxClientCount || 0 };
        }
        else
        {
            if (room.maxClientCount > 0 && room.numClients >= room.maxClientCount) return "room is full";
        }
        cli.socket.join(roomName);
        cli.rooms[roomName] = true;
        room.clients[clientId] = { joined: new Date() };
        room.numClients++;
        cli.socket.emit('room', room);
        io.sockets.in(roomName).emit('joined', { id: clientId, room: roomName });
        return true;
}

function onIoConnection(socket)
{
    var id = ++ioClientId;
    ioClientCount++;

    console.info("# clients = " + ioClientCount + ", new = #" + id);
    var cli = ioClients[id] = { id:id, socket: socket, rooms: {} };

    socket.on('chat', function(msg)
    {        
        for (var k in cli.rooms)
        {
            io.sockets.in(k).emit('chat', { id: id, room: k, text: msg.text })
        }
    })

    socket.on('game', function(ev)
    {
        if (ev == null || typeof ev != 'object') ev = {};
        ev.id = id;
        io.sockets.in(ev.room).emit('game', ev);
    })

    socket.on('join', function(room)
    {
        if (typeof room == 'string')
        {
            room = { room: room, maxClientCount: 2 };
        }
        console.log('JOIN', id, room, ioJoinRoom(room.room, id, room.maxClientCount || 0))
    })

    socket.on('leave', function(room)
    {
        console.log('LEAVE', id, room, ioLeaveRoom(room, id))
    })

    socket.on('disconnect', function ()
    {
        // make sure all other clients know he left
    	for (var room in cli.rooms)
    	{
            console.log('QUITLEAVE', id, room, ioLeaveRoom(room, id))
    	}

        // decrease counter and remove ref
        console.info("io: client " + id + " disconnected");
        ioClientCount--;
        delete ioClients[id];
    });

    socket.on('list', function()
    {
        console.log("--------- ROOMS ---------")
        console.dir(ioRooms);
        console.log("--------- CLIENTS ---------")
        console.dir(ioClients);
        console.log("---------")
    })

    socket.emit("hello", { id: id });
}
