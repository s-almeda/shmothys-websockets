const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const mime = require('mime');
const url = require('url');
const WebSocketServer = require('websocket').server;

/******************
 *                *
 * The Web Server *
 *                *
 ******************/

// what web port to listen to? Common values for development systems
// are 8000, 8080, 5000, 3000, etc. Round numbers greater than 1024.
const PORT = process.env.PORT || 8000;

// set up known code paths for reporting...
const PATHS = new Map([
  ['/server', {file: 'server.js', type: 'text/plain'}], 
  ['/client', {file: 'client.html', type: 'text/plain'}]
]);

// create the server module
let server = require('http').createServer(async (req, res) => {
  console.log("Got request!", req.method, req.url);
  
  // get the file path out of the URL, stripping any "query string"
  let path = url.parse(req.url, true).pathname

  // get the default code if the desired path isn't one of the special paths
  let {file, type} = PATHS.get(path) || {file: 'client.html', type: 'text/html'};

  // try to get the requested file.
  try {
    if ((await fsp.stat(file)).isFile()) {
      // if it's a valid file, then serve it! The mime library uses the
      // file extension to figure out the "mimetype" of the file.
      res.writeHead(200, {'Content-Type': type});
      
      // create a "read stream" and "pipe" (connect) it to the response.
      // this sends all the data from the file to the client.
      fs.createReadStream(file).pipe(res);
    } else {
      // if it's not a valid file, return a "404 not found" error.
      console.log("unknown request", path);
      res.writeHead(404, {'Content-Type': 'text/html'});
      res.end("Couldn't find your URL...");
    }
  } catch (err) {
    // if there's an error reading the file, return a 
    // "500 internal server error" error
    console.log("Error reading static file?", err);
    res.writeHead(500, {'Content-Type': 'text/html'});
    res.end("Failed to load something...try again later?");
  }
});
// tell the module to listen on the port we chose.
server.listen(PORT);

/************************
 *                      *
 * The Websocket Server *
 *                      *
 ************************/

// run the websocket server off the main web server
let wsServer = new WebSocketServer({
  httpServer: server
});

const allConnections = new Set();

// when there's a new websocket coming in...
wsServer.on('request', request => {
  // accept the connection
  let connection = request.accept(null, request.origin);
  console.log("New connection!");
  
  // add it to the set of all connections
  allConnections.add(connection);
    
  // when a message comes in on that connection
  connection.on('message', async message => {
    // ignore it if it's not text
    if (message.type !== 'utf8') {
      return;
    }
    
    // get the text out if it is text.
    let messageString = message.utf8Data;
    
    console.log("<-", messageString);
    for (const c of allConnections) {
      if (c !== connection) { // don't echo to sending client
        console.log("->", messageString);
        c.send(messageString);
      }
    }
  });
  
  // when this connection closes, remove it from the set of all connections.
  connection.on('close', c => {
    console.log("Discarding connection!");
    allConnections.delete(connection);
  });
});

// all ready! print the port we're listening on to make connecting easier.
console.log("Listening on port", PORT);