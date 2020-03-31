import * as express from 'express';
import * as http from 'http';
import * as WebSocket from 'ws';
import {AddressInfo} from 'ws';

const app = express();

// initialize a simple http server
const server = http.createServer(app);
let port = 9875;
let frequency = 100;
// initialize the WebSocket server instance
const wss = new WebSocket.Server({ server });
if (process.argv.length >= 3 && !isNaN(Number(process.argv[2]))) {
    port = Number(process.argv[2]);
}
if (process.argv.length >= 4 && !isNaN(Number(process.argv[3]))) {
    frequency = Number(process.argv[3]);
}
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
    }, frequency);

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
server.listen(process.env.PORT || port, () => {
    console.log(`Server started on port ${(server.address()) ? (server.address() as AddressInfo).port : 'unknown'}`);
});
