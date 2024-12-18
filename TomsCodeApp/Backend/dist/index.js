"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const db_1 = __importDefault(require("./db"));
const cors_1 = __importDefault(require("cors"));
const codeBlockRoutes_1 = __importDefault(require("./routes/codeBlockRoutes"));
const codeBlockController_1 = require("./Controllers/codeBlockController");
dotenv_1.default.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const PORT = process.env.PORT || 5000;
// חיבור לדאטה בייס
(0, db_1.default)();
// חיבור WebSocketל
(0, codeBlockController_1.setSocketIO)(io);
//בדיקה
app.get("/", (req, res) => {
    res.send("Backend is running!");
});
app.use("/api/code-blocks", codeBlockRoutes_1.default);
//משתנה שיאחסן מידע על הסוקטים
const rooms = {};
io.on("connection", (socket) => {
    console.log("User connected:", socket.id);
    // הצטרפות לחדר
    socket.on("join-room", (roomId) => {
        socket.join(roomId);
        // אם אין מנחה, המשתמש הראשון הופך למנחה
        if (!rooms[roomId]) {
            rooms[roomId] = { mentor: socket.id };
            socket.emit("role-assigned", "mentor");
        }
        else {
            socket.emit("role-assigned", "student");
        }
        // שליחת מספר המשתמשים בחדר
        const numUsers = io.sockets.adapter.rooms.get(roomId)?.size || 0;
        io.to(roomId).emit("user-count", numUsers);
    });
    // עדכון קוד בלייב
    socket.on("code-update", ({ roomId, code }) => {
        socket.to(roomId).emit("receive-code", code); // שולח את הקוד לשאר המשתמשים
    });
    // יציאה מהחדר
    socket.on("leave-room", (roomId) => {
        socket.leave(roomId);
        // אם המנחה עוזב
        if (rooms[roomId]?.mentor === socket.id) {
            delete rooms[roomId];
            io.to(roomId).emit("mentor-left"); // הודעה לכל המשתמשים שהמנחה עזב
        }
        else {
            const numUsers = io.sockets.adapter.rooms.get(roomId)?.size || 0;
            io.to(roomId).emit("user-count", numUsers); // עדכון מספר המשתמשים
        }
    });
    // טיפול בניתוק משתמש
    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
        for (const [roomId, room] of Object.entries(rooms)) {
            if (room.mentor === socket.id) {
                delete rooms[roomId];
                io.to(roomId).emit("mentor-left");
            }
            else {
                const numUsers = io.sockets.adapter.rooms.get(roomId)?.size || 0;
                io.to(roomId).emit("user-count", numUsers);
            }
        }
    });
});
// הרצת השרת
httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});