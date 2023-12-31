const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cookie = require('cookie');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(bodyParser.json());

app.use(express.static('public'));
app.use('/images', express.static('images'));
app.use('/styles', express.static('styles'));
app.use(cookieParser());


app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});
    
app.get('/waitingRoom', (req, res) => {
    res.sendFile(__dirname + '/waitingRoom.html');
});

var roomIDs = new Map();
var playerIDs = new Map();

var idList = new Set();
function generateID(){
    let id = Math.random().toString(36).substring(2, 9);
    while(idList.has(id)){
        id = Math.random().toString(36).substring(2, 9);
    }
    //console.log(id);
    idList.add(id);
    return id;
}

io.on('connection', (socket) => {
    //socket.handshake.header.cookie = null;
    var userID, roomID;
    socket.on('checkCookie', (fromIndex) => {

        if(!socket.handshake.headers.cookie){
                if(fromIndex){
                    //console.log("I come here")
                    userID = generateID();
                    //console.log(userID);
                    //console.log(userID);
                    io.to(socket.id).emit("createCookie", userID);
                    io.to(socket.id).emit("normal");
                }
                else{
                    //console.log("restarted");
                    io.to(socket.id).emit("restart");
                }
                
        }
        else{
            //const cook = socket.handshake.headers.cookie;
            //console.log(socket.handshake.headers);
            userID = socket.handshake.headers.cookie.split('=')[1];
            if(playerIDs.has(userID)){
                //console.log(userID);
                //console.log(playerIDs.get(userID));
                playerIDs.get(userID).socketID = socket.id;
                io.to(socket.id).emit("normal");
            }
            else{
                //console.log("restarted");
                io.to(socket.id).emit("restart");
            }
        }
        console.log(userID + " connected on socket " + socket.id);
    })
    
    //console.log(socket.handshake.headers);
    socket.on('createRoom', (roomNumber, name) => {
        //console.log(socket.handshake.headers);
        if(roomIDs.has(roomNumber)){
            io.to(socket.id).emit("alert", "Room number is taken!");
            //console.log("I got here");
        }
        else{
            const player = new Player(name, roomNumber, userID, socket.id, true);
            playerIDs.set(userID, player);
            const room = new Room(roomNumber, player);
            console.log(name + " has created room: " + roomNumber);
            roomIDs.set(roomNumber, room);
            //console.log(roomIDs);
            io.to(socket.id).emit("success");
        }
        
    });

    socket.on('joinRoom', (roomNumber, name) => {
        if(!roomIDs.has(roomNumber)){
            io.to(socket.id).emit("alert", "Room doesn't exist!");
        }
        else{
            const player = new Player(name, roomNumber, userID, socket.id, false);
            playerIDs.set(userID, player);
            const room = roomIDs.get(roomNumber);
            room.add(player);
            console.log(name + " has joined room: " + roomNumber);
            for(const user of room.players){
                //console.log(user);
                io.to(user.socketID).emit("receiveNames", room.players, user.isLeader);
            }
            //console.log(roomID + " : " + room.players[1].playerID + ', ' + room.players[1].name);
            io.to(socket.id).emit("success");
        }
        
    });

    socket.on("requestNames", () =>{
        //console.log(playerIDs.get(userID));
        const roomID = playerIDs.get(userID).roomID;
        //console.log(roomIDs);
        //console.log(roomID);
        //console.log(playerIDs.get(userID).roomID);
        io.to(socket.id).emit("receiveNames", roomIDs.get(roomID).players, playerIDs.get(userID).isLeader);
    })
    
    socket.on("kick", (number) => {
        const roomID = playerIDs.get(userID).roomID;
        //console.log(roomIDs.get(roomID));
        var playerKicked = roomIDs.get(roomID).players[number - 1];
        var socketID = playerKicked.socketID;
        io.to(socketID).emit("kicked");
        playerIDs.delete(userID);
        roomIDs.get(roomID).delete(playerKicked);
        console.log(roomIDs.get(roomID).players);
        //console.log(roomIDs.get(roomID))
        for(const user of roomIDs.get(roomID).players){
            console.log(user.socketID);
            io.to(user.socketID).emit("receiveNames", roomIDs.get(roomID).players, user.isLeader);
        }
    })

    socket.on("start", () => {
        let room = roomIDs.get(playerIDs.get(userID).roomID)
        for(const user of room.players){
            io.to(user.socketID).emit("gameStarted");
        }
        room.status = "1a";
    })


    // Listen for disconnection
    socket.on('disconnect', () => {
        console.log(userID + ' disconnected');
    });

    

});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


class Player{
    constructor(name, roomID, playerID, socketID, isLeader){
        this._name = name;
        this._roomID = roomID;
        this._playerID = playerID;
        this._socketID = socketID;
        this._isLeader = isLeader;
    }
    get name(){
        return this._name;
    }
    get roomID(){
        return this._roomID;
    }
    get socketID(){
        return this._socketID;
    }
    set socketID(newID){
        this._socketID = newID;
    }
    get isLeader(){
        return this._isLeader;
    }
    
}

class Room{
    constructor(id, player1){
        this._id = id;
        this._players = [];
        this._players.push(player1);
        this._status = "not started";
    }
    add(player) {
        this._players.push(player);
    }
    get players(){
        return this._players;
    }
    delete(number) {
        this._players = this._players.filter(item => item !== number);
    }
    isFull(){
        return this._players.size == 10;
    }
    inGame(){
        return this._status !== "not started";
    }
    set status(newStatus){
        this._status = newStatus;
    }

}