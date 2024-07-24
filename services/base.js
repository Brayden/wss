'use strict';

const express = require('express');
const path = require('path');
const { createServer } = require('http');
const WebSocket = require('ws');

const app = express();
app.use(express.static(path.join(__dirname, '/public')));

const server = createServer(app);
const wss = new WebSocket.Server({ server });

const workspaceState = {};

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

function leaveBase(workspaceId, baseId, userId) {
    const currentBaseId = baseId || '_none';
    workspaceState[workspaceId][currentBaseId] = workspaceState[workspaceId][currentBaseId].filter((id) => id !== userId);
}

function leaveWorkspace(workspaceId, userId) {
    if (workspaceState[workspaceId]) {
        Object.keys(workspaceState[workspaceId]).forEach((baseId) => {
            workspaceState[workspaceId][baseId] = workspaceState[workspaceId][baseId].filter((id) => id !== userId);
        });
    }
}

function removeUserFromAllWorkspaces(userId) {
    Object.keys(workspaceState).forEach((workspaceId) => {
        leaveWorkspace(workspaceId, userId);
    });
}

function sendCurrentStatus(ws, workspaceId) {
    if (workspaceState[workspaceId]) {
        ws.send(JSON.stringify(workspaceState[workspaceId]));
    }
}

function cleanupWorkspace(workspaceId) {
    if (!workspaceId) return

    Object.keys(workspaceState[workspaceId]).forEach((baseId) => {
        if (workspaceState[workspaceId][baseId].length === 0) {
            delete workspaceState[workspaceId][baseId];
        }
    
        if (Object.keys(workspaceState[workspaceId]).length === 0) {
            delete workspaceState[workspaceId];
        }
    });
}

function cleanupAllWorkspaces() {
    Object.keys(workspaceState).forEach((workspaceId) => {
        cleanupWorkspace(workspaceId);
    });
}
    

wss.on('connection', function (ws) {
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        const userId = data.user_id || ws.userId;
        const workspaceId = data.workspace_id || ws.workspaceId;
        const baseId = data.base_id;
        const status = data.status;

        if (!workspaceState[workspaceId]) {
            workspaceState[workspaceId] = {};
        }

        if (workspaceId && baseId && !workspaceState[workspaceId][baseId]) {
            workspaceState[workspaceId][baseId] = [];
        }

        if (workspaceId && !workspaceState[workspaceId]['_none']) {
            workspaceState[workspaceId]['_none'] = [];
        }

        if (userId && workspaceId) {
            ws.userId = userId;
            ws.workspaceId = workspaceId;

            if (status === 'update_workspace') {
                updateWorkspace(workspaceId, baseId, userId);
            } else if (status === 'update_base') {
                updateBase(workspaceId, baseId, userId);
            } else if (status === 'leave_base') {
                leaveBase(workspaceId, baseId, userId);
            } else if (status === 'leave_workspace') {
                leaveWorkspace(workspaceId, userId);
            } else if (status === 'current_status') {
                sendCurrentStatus(ws, workspaceId);
            }

            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN && client.workspaceId === workspaceId) {
                    client.send(JSON.stringify(workspaceState[workspaceId]));
                }
            });
        }

        cleanupWorkspace(workspaceId);

        console.log('State: ', status, userId, workspaceId, workspaceState);
    });

    ws.on('open', () => {
        if (ws.workspaceId && workspaceState[ws.workspaceId]) {
            ws.send(JSON.stringify(workspaceState[ws.workspaceId]));
        }
    });

    ws.on('close', () => {
        if (ws.userId) {
            removeUserFromAllWorkspaces(ws.userId);
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN && client.workspaceId) {
                    client.send(JSON.stringify(workspaceState[client.workspaceId]));
                }
            });
        }
    });
});

server.listen(8080, function () {
    console.log('Listening on http://0.0.0.0:8080 from base.js');
    
    // Every 5 minutes cleanup all workspaces
    setInterval(cleanupAllWorkspaces, 300000);
});
