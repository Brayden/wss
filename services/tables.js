'use strict';

const express = require('express');
const path = require('path');
const { createServer } = require('http');

const WebSocket = require('ws');

const app = express();
app.use(express.static(path.join(__dirname, '/public')));

const server = createServer(app);
const wss = new WebSocket.Server({ server });

// Object to store the current state of each workspace
// type WorkspaceState = {
//     [workspaceId: string]: {
//         [cellId: string]: string
//     }
// };
const workspaceState = {
    'workspace1': {
        'baseId_schema_table_column_pks': 'value'
    }
};

wss.on('connection', function (ws) {
    // When a message event is received from any client
    ws.on('message', (message) => {
        const data = JSON.parse(message);

        // If the message contains only the workspace_id, set it for the client
        if (data.workspace_id && !data.cell_value) {
            ws.userId = data.user_id;
            ws.workspaceId = data.workspace_id;

            // Send the current state of the workspace changes to the client
            if (workspaceState[ws.workspaceId]) {
                Object.keys(workspaceState[ws.workspaceId]).forEach((cellId) => {
                    ws.send(JSON.stringify({ 
                        workspace_id: ws.workspaceId, 
                        cell_id: cellId,
                        cell_value: workspaceState[ws.workspaceId][cellId]
                    }));
                });
            }
        } else {
            const workspaceId = ws.workspaceId;
            // const text = data.text;
            const cellId = data.cell_id;
            const cellValue = data.cell_value;

            // Update the workspace state
            if (!workspaceState[workspaceId]) {
                workspaceState[workspaceId] = {};
            }

            if (cellId && cellValue) {
                workspaceState[workspaceId][cellId] = cellValue;
            }

            // console.log('State: ', workspaceState);

            // Broadcast the message to all clients, besides the emitting user, in the same workspace
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN && 
                    client.workspaceId === workspaceId 
                    // && client.userId !== ws.userId
                    /* TODO: && client.userId !== ws.userId */
                ) {
                    client.send(JSON.stringify({ 
                        workspace_id: workspaceId, 
                        cell_id: cellId,
                        cell_value: cellValue,
                    }));
                }
            });
        }
    });

    // Send the current state of the workspace to the client
    // const id = setInterval(function () {
    //     ws.send(JSON.stringify(process.memoryUsage()), function () {
    //         //
    //         // Ignore errors.
    //         //
    //     });
    // }, 100);
    // console.log('started client interval');

    // ws.on('close', function () {
    //     console.log('stopping client interval');
    //     clearInterval(id);
    // });
});

server.listen(8080, function () {
    console.log('Listening on http://0.0.0.0:8080');
});