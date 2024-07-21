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
    'workspaceId': {
        'baseId': ['userId_1', 'userId_2']
    }
};

wss.on('connection', function (ws) {
    // When a message event is received from any client
    ws.on('message', (message) => {
        const data = JSON.parse(message);

        const userId = data.user_id || ws.userId;
        const workspaceId = data.workspace_id || ws.workspaceId;
        const baseId = data.base_id
        const status = data.status;

        // Initial setup of workspace object
        if (workspaceId && !workspaceState[workspaceId]) {
            workspaceState[workspaceId] = {};
        }

        // Initial setup of base object within a workspace
        if (workspaceId && baseId && !workspaceState[workspaceId][baseId]) {
            workspaceState[workspaceId][baseId] = [];
        }

        if (workspaceId && !workspaceState[workspaceId]['_none']) {
            workspaceState[workspaceId]['_none'] = [];
        }

        if (userId && workspaceId) {
            ws.userId = userId;
            ws.workspaceId = workspaceId;

            // Send the current state of the workspace changes to the client
            console.log('Sending: ', JSON.stringify(workspaceState[workspaceId]))
            ws.send(JSON.stringify(workspaceState[workspaceId]));
        }

        if (status === 'leave_base') {
            // Remove the user from the workspace
            if (workspaceState[workspaceId] && workspaceState[workspaceId][baseId]) {
                workspaceState[workspaceId][baseId] = workspaceState[workspaceId][baseId].filter((id) => id !== userId);
            }
        } else if (status === 'update_base') {
            // Go through all other bases in this workspace and filter out the userId from those before adding to the current base
            Object.keys(workspaceState[workspaceId]).forEach((baseId) => {
                workspaceState[workspaceId][baseId] = workspaceState[workspaceId][baseId].filter((id) => id !== userId);
            });

            if (workspaceId && userId) {
                const currentBaseId = baseId || '_none';
                workspaceState[workspaceId][currentBaseId].push(userId);
            }
        } else if (status === 'update_workspace') {
            // Remove the user from the workspace
            if (workspaceState[workspaceId]) {
                Object.keys(workspaceState[workspaceId]).forEach((baseId) => {
                    workspaceState[workspaceId][baseId] = workspaceState[workspaceId][baseId].filter((id) => id !== userId);
                });
            }

            // Add the user to the designated workspace
            if (workspaceId && userId) {
                const currentBaseId = baseId || '_none';
                workspaceState[workspaceId][currentBaseId].push(userId);
            }
        } else if (status === 'leave_workspace') {
            // Remove the user from the workspace
            if (workspaceState[workspaceId]) {
                Object.keys(workspaceState[workspaceId]).forEach((baseId) => {
                    workspaceState[workspaceId][baseId] = workspaceState[workspaceId][baseId].filter((id) => id !== userId);
                });
            }
        }

        wss.clients.forEach((client) => {
            if (/* Send to all clients in a ready state */
                client.readyState === WebSocket.OPEN && 
                /* Send to all clients in the same workspace */
                client.workspaceId === workspaceId &&
                /* Send to all clients with a userId not of the message author */
                client.userId !== userId
            ) {
                client.send(JSON.stringify(workspaceState[ws.workspaceId]));
            }
        });
    });
});

server.listen(8080, function () {
    console.log('Listening on http://0.0.0.0:8080');
});