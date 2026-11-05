const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let waitingUser = null;
let activeUsers = {}; // Siyalu online users la sahaunage gender eka gabadha kirimata

// Admin wetha stats saha user list eka yawime function eka
function updateAdminStats() {
    let total = Object.keys(activeUsers).length;
    let male = 0;
    let female = 0;

    for (let id in activeUsers) {
        if (activeUsers[id] === 'Male') male++;
        else if (activeUsers[id] === 'Female') female++;
    }

    // Siyalu sockets wetha stats saha activeUsers list eka yawima
    io.emit('update-stats', { total, male, female, activeUsers });
}

io.on('connection', (socket) => {
    console.log('Kenek sambandha wuna ID eka:', socket.id);
    activeUsers[socket.id] = 'Not Selected'; // Mulin gender eka thora natha lesa thabagani
    updateAdminStats();

    // User thorapu gender eka save karaganimata
    socket.on('set-gender', (gender) => {
        activeUsers[socket.id] = gender;
        updateAdminStats();
    });

    socket.on('find-partner', () => {
        if (waitingUser && waitingUser.id !== socket.id) {
            const room = `${waitingUser.id}#${socket.id}`;
            waitingUser.join(room);
            socket.join(room);

            io.to(room).emit('matched', room);
            waitingUser = null;
        } else {
            waitingUser = socket;
            socket.emit('waiting', 'Anikut keneku soyamin pawathi...');
        }
    });

    socket.on('message', ({ room, message }) => {
        socket.to(room).emit('message', message);
    });

    socket.on('leave-room', (room) => {
        socket.leave(room);
        socket.to(room).emit('partner-disconnected');
    });

    socket.on('disconnect', () => {
        if (waitingUser === socket) {
            waitingUser = null;
        }
        
        const rooms = Array.from(socket.rooms);
        rooms.forEach(room => {
            if (room !== socket.id) {
                socket.to(room).emit('partner-disconnected');
            }
        });

        delete activeUsers[socket.id];
        updateAdminStats();
        console.log('Kenek ayin wuna ID eka:', socket.id);
    });
});

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (let name of Object.keys(interfaces)) {
        for (let net of interfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return 'localhost';
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    const ip = getLocalIp();
    console.log('--------------------------------------------------');
    console.log('🚀 Server eka saarthakawa kriyathmakai!');
    console.log('📱 User Chat Site ekata yanna:');
    console.log(`   Local:  http://localhost:${PORT}`);
    console.log(`   Network: http://${ip}:${PORT}`);
    console.log('👑 Admin Dashboard ekata yanna:');
    console.log(`   Local:  http://localhost:${PORT}/admin.html`);
    console.log(`   Network: http://${ip}:${PORT}/admin.html`);
    console.log('--------------------------------------------------');
});

