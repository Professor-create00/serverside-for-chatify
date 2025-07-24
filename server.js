
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

const rooms = {}; // { roomName: { password: string, creatorId: string, users: string[] } }

app.use('/songs', express.static(path.join(__dirname, 'songs')));

io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);

  // Get user's rooms (with callback check)
  socket.on('get_my_rooms', (userId, callback) => {
    if (typeof callback !== 'function') return; // Safety check
    
    try {
      const userRooms = Object.entries(rooms)
        .filter(([_, roomData]) => roomData.creatorId === userId)
        .map(([roomName]) => roomName);
      callback({ success: true, rooms: userRooms });
    } catch (err) {
      console.error('Error in get_my_rooms:', err);
      callback?.({ success: false, error: 'Server error' });
    }
  });

  // Create room (with callback safety)
  socket.on('create_room', ({ room, password, username, creatorId }, callback) => {
    if (typeof callback !== 'function') callback = () => {}; // Default empty function
    
    try {
      if (rooms[room]) {
        return callback({ success: false, error: 'Room already exists' });
      }
      
      rooms[room] = { password, creatorId, users: [username] };
      socket.join(room);
      socket.data = { room, username, userId: creatorId };
      
      // Confirm only to creator
      callback({ success: true });
      
      // Notify room
      io.to(room).emit('receive_message', {
        message: `${username} has joined the chat.`,
        system: true
      });
    } catch (err) {
      console.error('Error in create_room:', err);
      callback({ success: false, error: 'Server error' });
    }
  });

  // Join room (with error handling)
  socket.on('join_room', ({ room, password, username }, callback) => {
    if (typeof callback !== 'function') callback = () => {};
    
    try {
      const roomData = rooms[room];
      if (!roomData) {
        return callback({ success: false, error: 'Room does not exist' });
      }
      if (roomData.password !== password) {
        return callback({ success: false, error: 'Incorrect password' });
      }
      
      socket.join(room);
      socket.data = { room, username };
      roomData.users.push(username);
      
      callback({ success: true });
      io.to(room).emit('receive_message', {
        message: `${username} has joined the chat.`,
        system: true
      });
    } catch (err) {
      console.error('Error in join_room:', err);
      callback({ success: false, error: 'Server error' });
    }
  });

  // Delete room (with validation)
  socket.on('delete_room', ({ room, password, creatorId }, callback) => {
    if (typeof callback !== 'function') callback = () => {};
    
    try {
      const roomData = rooms[room];
      if (!roomData) {
        return callback({ success: false, error: 'Room does not exist' });
      }
      if (roomData.creatorId !== creatorId) {
        return callback({ success: false, error: 'Not authorized' });
      }
      if (roomData.password !== password) {
        return callback({ success: false, error: 'Incorrect password' });
      }
      
      // Notify users before deletion
      io.to(room).emit('room_deleted', { room });
      delete rooms[room];
      
      callback({ success: true });
    } catch (err) {
      console.error('Error in delete_room:', err);
      callback({ success: false, error: 'Server error' });
    }
  });

  // Other events (no callback needed)
  socket.on('send_message', ({ room, message, username }) => {
    const sender = username || socket.data.username || 'Unknown';
    io.to(room).emit('receive_message', { message, username: sender });
  });

  socket.on('get_songs', (callback) => {
    if (typeof callback !== 'function') return;
    
    fs.readdir(path.join(__dirname, 'songs'), (err, files) => {
      if (err) {
        console.error('Error reading songs:', err);
        return callback([]);
      }
      callback(files.filter(file => file.endsWith('.mp3')));
    });
  });

  socket.on('disconnect', () => {
    const { room, username } = socket.data || {};
    if (room && username) {
      io.to(room).emit('receive_message', {
        message: `${username} has left.`,
        system: true
      });
      
      // Cleanup user from room
      if (rooms[room]?.users) {
        rooms[room].users = rooms[room].users.filter(u => u !== username);
      }
    }
    console.log('❌ User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});