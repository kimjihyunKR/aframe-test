// Load required modules
const http = require("http"); // http server core module
const path = require("path");
const express = require("express"); // web framework external module

// Set process name
process.title = "networked-aframe-server";

// Get port or default to 8080
const port = process.env.PORT || 8081;

// Setup and configure Express http server.
const app = express();
app.use(express.static(path.resolve(__dirname, "..", "examples")));

// Serve the example and build the bundle in development.
if (process.env.NODE_ENV === "development") {
  const webpackMiddleware = require("webpack-dev-middleware");
  const webpack = require("webpack");
  const config = require("../webpack.config");

  app.use(
    webpackMiddleware(webpack(config), {
      publicPath: "/"
    })
  );
}

// Start Express http server
const webServer = http.createServer(app);
const io = require("socket.io")(webServer);

const rooms = {};

io.on("connection", socket => {
  console.log("user connected", socket.id);

  let curRoom = null;
  
  // 기본 참여방
  socket.join("채팅방 1");

  socket.on('enterRoom', (roomname, userName) => {
    console.log("\n\n\n !!!!!!!!!!!!!!!connection!!!!!!!!!!!!!!! \n\n\n")
    console.log( `${userName}가 ${roomname}에 들어왔다.`);
    returnRoomMember(roomname);
    io.to(roomname).emit('enterRoom', userName);
  })

  socket.on('leaveRoom', (userName, roomname) => {
    console.log(`${userName}가 ${roomname}을 떠났다.`);
    returnRoomMember(roomname);
    io.to(roomname).emit('leaveRoom', socket.id, userName);
  })

  socket.on('usercount', (roomname) => {
    returnRoomMember(roomname);
  });

  // 채팅 받아오고 보내기
  socket.on('message', (msgObj, roomname) => {
    if(msgObj.isShout) {
      io.emit('message', socket.id, msgObj);
      return;
    }
    io.to(roomname).emit('message', socket.id, msgObj);
  });

  // 룸 전환 신호 받기
  socket.on('joinRoom', (roomname, roomToJoin) => {
    socket.leave(roomname);   // 기존의 룸을 나가고
    socket.join(roomToJoin);  // 들어갈 룸에 들어간다.
   
    socket.emit('roomChanged', roomToJoin);   // 룸을 성공적으로 전환했다는 신호 발송
  });

  // 채팅방 생성 신호 받기
  socket.on('makeChatRoom', (roomname, makeUser) => {
    console.log(`${makeUser}가 새로운 방, ${roomname}을 만들었다.`);
  })
  
  const returnRoomMember = (roomname) => {
    if(roomname) {
      // const members = socket.adapter.rooms.get(roomname).size;
      // io.to(roomname).emit('memberCount', members);
    }
    // console.log(`roomname:${roomname} members:${members}`);
    // socket.emit('usercount', io.engine.clientsCount);
  }

  socket.on("joinRoom", data => {
    const { room } = data;

    if (!rooms[room]) {
      rooms[room] = {
        name: room,
        occupants: {},
      };
    }

    const joinedTime = Date.now();
    rooms[room].occupants[socket.id] = joinedTime;
    curRoom = room;

    console.log(`${socket.id} joined room ${room}`);
    socket.join(room);

    socket.emit("connectSuccess", { joinedTime });
    const occupants = rooms[room].occupants;
    io.in(curRoom).emit("occupantsChanged", { occupants });
  });

  socket.on("send", data => {
    io.to(data.to).emit("send", data);
  });

  socket.on("broadcast", data => {
    socket.to(curRoom).broadcast.emit("broadcast", data);
  });

  socket.on("disconnect", () => {
    console.log('disconnected: ', socket.id, curRoom);
    if (rooms[curRoom]) {
      console.log("user disconnected", socket.id);

      delete rooms[curRoom].occupants[socket.id];
      const occupants = rooms[curRoom].occupants;
      socket.to(curRoom).broadcast.emit("occupantsChanged", { occupants });

      if (Object.keys(occupants).length === 0) {
        console.log("everybody left room");
        delete rooms[curRoom];
      }
    }
  });
});

webServer.listen(port, () => {
  console.log("listening on http://localhost:" + port);
});
