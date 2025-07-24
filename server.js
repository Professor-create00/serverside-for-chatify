
// import express from 'express';
// import http from 'http';
// import { Server } from 'socket.io';
// import cors from 'cors';
// import path from 'path';
// import fs from 'fs';
// import { fileURLToPath } from 'url';


// import dotenv from 'dotenv';
// dotenv.config();

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// const app = express();
// app.use(cors());

// const server = http.createServer(app);
// const io = new Server(server, {
//   cors: {
//     origin: ['https://chatify-prat.onrender.com'],
//     methods: ['GET', 'POST']
//   }
// });

// const rooms = {}; // { roomName: password }

// app.use('/songs', express.static(path.join(__dirname, 'songs')));

// io.on('connection', (socket) => {
//   console.log('✅ User connected:', socket.id);

//   // Create room
//   socket.on('create_room', ({ room, password, username }, callback) => {
//     if (rooms[room]) return callback({ success: false, error: 'Room already exists' });
//     rooms[room] = password;
//     socket.join(room);
//     socket.data.room = room;
//     socket.data.username = username; // Save username
//     io.emit('room_list', Object.keys(rooms));
//     io.to(room).emit('receive_message', {
//       message: `${username} has joined the chat.`,
//       system: true
//     });
//     callback({ success: true });
//   });

//   // Join room
//   socket.on('join_room', ({ room, password, username }, callback) => {
//     if (!rooms[room]) return callback({ success: false, error: 'Room does not exist' });
//     if (rooms[room] !== password) return callback({ success: false, error: 'Incorrect password' });
//     socket.join(room);
//     socket.data.room = room;
//     socket.data.username = username; // Save username
//     io.to(room).emit('receive_message', {
//       message: `${username} has joined the chat.`,
//       system: true
//     });
//     callback({ success: true });
//   });

//   // Handle leaving room
//  // Handle leaving room
// socket.on('leave_room', ({ room, username }) => {
//   if (room && username) {
//     // Send system message BEFORE leaving
//     io.to(room).emit('receive_message', {
//       message: `${username} has left the chat.`,
//       system: true
//     });
//   }
//   socket.leave(room); // Then leave the room
//   socket.data.room = null;
//   socket.data.username = null;
// });

//   // Delete room
//   socket.on('delete_room', ({ room, password }, callback) => {
//     if (!rooms[room]) return callback({ success: false, error: 'Room does not exist' });
//     if (rooms[room] !== password) return callback({ success: false, error: 'Incorrect password' });
//     delete rooms[room];
//     io.emit('room_list', Object.keys(rooms));
//     io.to(room).emit('room_deleted', { room });
//     callback({ success: true });
//   });

//   // Messaging
//   socket.on('send_message', ({ room, message, username }) => {
//     const senderUsername = username || socket.data.username || 'Unknown';
//     io.to(room).emit('receive_message', { 
//       message,
//       senderId: socket.id, 
//       username: senderUsername 
//     });
//   });

//   socket.on('get_songs', (callback) => {
//     const songsDir = path.join(__dirname, 'songs');
//     fs.readdir(songsDir, (err, files) => {
//       if (err) {
//         console.error('Error reading songs folder:', err);
//         return callback([]);
//       }
//       const mp3s = files.filter(file => file.endsWith('.mp3'));
//       callback(mp3s);
//     });
//   });

//   // Handle disconnect
//   socket.on('disconnect', () => {
//     const room = socket.data.room;
//     const username = socket.data.username;
//     if (room && username) {
//       io.to(room).emit('receive_message', {
//         message: `${username} has left the chat.`,
//         system: true
//       });
//     }
//     console.log('❌ User disconnected:', socket.id);
//   });
// });

// const PORT = process.env.PORT || 3001
// server.listen(PORT, () => {
//   console.log(`🚀 Server listening on http://localhost:${PORT}`);
// });


import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['https://chatify-prat.onrender.com'],
    methods: ['GET', 'POST']
  }
});

// Modified rooms structure to track creator
const rooms = {}; // { roomName: { password: string, creatorId: string, users: string[] } }

app.use('/songs', express.static(path.join(__dirname, 'songs')));

io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);

  // Get user's rooms
  socket.on('get_my_rooms', (userId, callback) => {
    const userRooms = Object.entries(rooms)
      .filter(([_, roomData]) => roomData.creatorId === userId)
      .map(([roomName]) => roomName);
    callback(userRooms);
  });

  // Create room (now with creator tracking)
  socket.on('create_room', ({ room, password, username, creatorId }, callback) => {
    if (rooms[room]) return callback({ success: false, error: 'Room already exists' });
    
    rooms[room] = {
      password,
      creatorId,
      users: [username]
    };
    
    socket.join(room);
    socket.data.room = room;
    socket.data.username = username;
    socket.data.userId = creatorId;
    
    // Only send back to creator
    socket.emit('my_rooms', Object.keys(rooms).filter(r => rooms[r].creatorId === creatorId));
    
    io.to(room).emit('receive_message', {
      message: `${username} has joined the chat.`,
      system: true
    });
    
    callback({ success: true });
  });

  // Join room (updated for private rooms)
  socket.on('join_room', ({ room, password, username }, callback) => {
    if (!rooms[room]) return callback({ success: false, error: 'Room does not exist' });
    if (rooms[room].password !== password) return callback({ success: false, error: 'Incorrect password' });
    
    socket.join(room);
    socket.data.room = room;
    socket.data.username = username;
    rooms[room].users.push(username);
    
    io.to(room).emit('receive_message', {
      message: `${username} has joined the chat.`,
      system: true
    });
    
    callback({ success: true });
  });

  // Handle leaving room
  socket.on('leave_room', ({ room, username }) => {
    if (room && username) {
      io.to(room).emit('receive_message', {
        message: `${username} has left the chat.`,
        system: true
      });
      
      if (rooms[room] && rooms[room].users) {
        rooms[room].users = rooms[room].users.filter(u => u !== username);
      }
    }
    socket.leave(room);
    socket.data.room = null;
    socket.data.username = null;
  });

  // Delete room (now creator-only)
  socket.on('delete_room', ({ room, password, creatorId }, callback) => {
    if (!rooms[room]) return callback({ success: false, error: 'Room does not exist' });
    if (rooms[room].creatorId !== creatorId) return callback({ success: false, error: 'Not authorized' });
    if (rooms[room].password !== password) return callback({ success: false, error: 'Incorrect password' });
    
    // Notify all users in room
    io.to(room).emit('room_deleted', { room });
    
    // Remove room
    delete rooms[room];
    
    // Update creator's room list
    socket.emit('my_rooms', Object.keys(rooms).filter(r => rooms[r].creatorId === creatorId));
    
    callback({ success: true });
  });

  // Messaging remains the same
  socket.on('send_message', ({ room, message, username }) => {
    const senderUsername = username || socket.data.username || 'Unknown';
    io.to(room).emit('receive_message', { 
      message,
      senderId: socket.id, 
      username: senderUsername 
    });
  });

  // File handling remains the same
  socket.on('get_songs', (callback) => {
    const songsDir = path.join(__dirname, 'songs');
    fs.readdir(songsDir, (err, files) => {
      if (err) {
        console.error('Error reading songs folder:', err);
        return callback([]);
      }
      const mp3s = files.filter(file => file.endsWith('.mp3'));
      callback(mp3s);
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const room = socket.data.room;
    const username = socket.data.username;
    if (room && username) {
      io.to(room).emit('receive_message', {
        message: `${username} has left the chat.`,
        system: true
      });
      
      if (rooms[room] && rooms[room].users) {
        rooms[room].users = rooms[room].users.filter(u => u !== username);
      }
    }
    console.log('❌ User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});