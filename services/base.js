'use strict';

const express = require('express');
const path = require('path');
const { createServer } = require('http');

const WebSocket = require('ws');

const app = express();
app.use(express.static(path.join(__dirname, '/public')));

const server = createServer(app);
const wss = new WebSocket.Server({ server });

const workspaceState = {
    'workspaceId': {
        'baseId': ['userId_1', 'userId_2']
    }
};

function updateWorkspace(workspaceId, baseId, userId) {
    Object.keys(workspaceState).forEach((workspaceId) => {
        Object.keys(workspaceState[workspaceId]).forEach((baseId) => {
            workspaceState[workspaceId][baseId] = workspaceState[workspaceId][baseId].filter((id) => id !== userId);
        });
    });

    const currentBaseId = baseId || '_none';
    workspaceState[workspaceId][currentBaseId].push(userId);
}

function updateBase(workspaceId, baseId, userId) {
    Object.keys(workspaceState[workspaceId]).forEach((baseId) => {
        workspaceState[workspaceId][baseId] = workspaceState[workspaceId][baseId].filter((id) => id !== userId);
    });

    if (workspaceId && userId) {
        const currentBaseId = baseId || '_none';
        workspaceState[workspaceId][currentBaseId].push(userId);
    }
}

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
            ws.send(JSON.stringify(workspaceState[workspaceId]));
        }

        if (status === 'leave_base') {
            // Remove the user from the workspace
            if (workspaceState[workspaceId] && workspaceState[workspaceId][baseId]) {
                workspaceState[workspaceId][baseId] = workspaceState[workspaceId][baseId].filter((id) => id !== userId);
            }
        } else if (status === 'update_base') {
            // updateBase(workspaceId, baseId, userId);
            Object.keys(workspaceState[workspaceId]).forEach((baseId) => {
                workspaceState[workspaceId][baseId] = workspaceState[workspaceId][baseId].filter((id) => id !== userId);
            });
        
            if (workspaceId && userId) {
                const currentBaseId = baseId || '_none';
                workspaceState[workspaceId][currentBaseId].push(userId);
            }
        } else if (status === 'update_workspace') {
            // updateWorkspace(workspaceId, baseId, userId);
            Object.keys(workspaceState).forEach((workspaceId) => {
                Object.keys(workspaceState[workspaceId]).forEach((baseId) => {
                    workspaceState[workspaceId][baseId] = workspaceState[workspaceId][baseId].filter((id) => id !== userId);
                });
            });
        
            const currentBaseId = baseId || '_none';
            workspaceState[workspaceId][currentBaseId].push(userId);
        } else if (status === 'leave_workspace') {
            // Remove the user from the workspace
            if (workspaceState[workspaceId]) {
                Object.keys(workspaceState[workspaceId]).forEach((baseId) => {
                    workspaceState[workspaceId][baseId] = workspaceState[workspaceId][baseId].filter((id) => id !== userId);
                });
            }
        }

        // Cleanup workspaceState object when no users exist in any bases
        // if (workspaceState[workspaceId]) {
        //     let userCount = 0;
        //     Object.keys(workspaceState[workspaceId]).forEach((baseId) => {
        //         userCount += workspaceState[workspaceId][baseId].length;
        //     });

        //     if (userCount === 0) {
        //         delete workspaceState[workspaceId];
        //     }
        // }

        console.log('Workspace State: ', JSON.stringify(workspaceState[workspaceId]))

        wss.clients.forEach((client) => {
            if (/* Send to all clients in a ready state */
                client.readyState === WebSocket.OPEN && 
                /* Send to all clients in the same workspace */
                client.workspaceId === workspaceId// &&
                /* Send to all clients with a userId not of the message author */
                // client.userId !== userId
            ) {
                client.send(JSON.stringify(workspaceState[workspaceId]));
            }
        });
    });
});

server.listen(8080, function () {
    console.log('Listening on http://0.0.0.0:8080 from base.js');
});