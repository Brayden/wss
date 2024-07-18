'use strict';

const express = require('express');
const path = require('path');
const { createServer } = require('http');

const WebSocket = require('ws');

const app = express();
app.use(express.static(path.join(__dirname, '/public')));

const server = createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', function (ws) {
    const id = setInterval(function () {
        ws.send(JSON.stringify(process.memoryUsage()), function () {
            //
            // Ignore errors.
            //
        });
    }, 100);
    console.log('started client interval');

    ws.on('message', (message) => {
        const data = JSON.parse(message);

        // If the message contains only the workspace_id, set it for the client
        if (data.workspace_id && !data.text) {
            ws.workspaceId = data.workspace_id;
        } else {
            const workspaceId = ws.workspaceId;
            const text = data.text;

            // Broadcast the message to all clients in the same workspace
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN && client.workspaceId === workspaceId) {
                    client.send(JSON.stringify({ workspace_id: workspaceId, text: text }));
                }
            });
        }
    });

    ws.on('close', function () {
        console.log('stopping client interval');
        clearInterval(id);
    });
});

server.listen(8080, function () {
    console.log('Listening on http://0.0.0.0:8080');
});