import * as express from 'express';
import * as http from 'http';
import * as WebSocket from 'ws';
import {AddressInfo} from 'ws';

const app = express();

// initialize a simple http server
const server = http.createServer(app);

// initialize the WebSocket server instance
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws: WebSocket) => {

    // connection is up, let's add a simple simple event
    ws.on('message', (message: string) => {

        // log the received message and send it back to the client
        console.log('received: %s', message);
    });

    let messageInterval = setInterval(function () {
        try {
            ws.send(JSON.stringify({
                x: Date.now(),
                y: Math.random() * 100
            }));
        } catch (e) {
            clearInterval(messageInterval);
            console.log(e);
        }
    }, 100);

    // connection is up, let's add a simple simple event
    ws.on('close', () => {
        clearInterval(messageInterval);
    });

    // connection is up, let's add a simple simple event
    ws.on('error', (error) => {
        clearInterval(messageInterval);
        console.log(error);
    });
});

// start our server
server.listen(process.env.PORT || 9875, () => {
    console.log(`Server started on port ${(server.address()) ? (server.address() as AddressInfo).port : 'unknown'}`);
});
