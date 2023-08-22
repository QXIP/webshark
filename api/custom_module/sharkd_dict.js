const {PromiseSocket} = require('promise-socket');
const { spawn } = require('child_process');
const fs = require('fs');

const SHARKD_SOCKET = process.env.SHARKD_SOCKET || "/var/run/sharkd.sock";

// Make sure CAPTURES_PATH has a trailing /
let _captures_path = process.env.CAPTURES_PATH || "/captures/";
if (_captures_path.at(-1) !== "/") {
  _captures_path += "/";
}
const CAPTURES_PATH = _captures_path;
delete _captures_path

// newer versions of sharkd are picky about JSON types
// from sharkd_session.c: struct member_attribute name_array[]
const SHARKD_INTEGER_PARAMS = new Set(["frame", "ref_frame", "prev_frame", "skip", "limit", "interval"]);
const SHARKD_BOOLEAN_PARAMS = new Set(["proto", "columns", "color", "bytes", "hidden"]);
const SHARKD_TRUE_VALUES = new Set(["yes", "true", "1"]);

var sharkd_objects = {};
var AsyncLock = require('async-lock');
var lock = new AsyncLock({timeout: 300000}); // 5 minutes timeout for the lock
var sharkd_proc = null;
const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));

/**
 * Returns array of socket names with loaded pcap file
 * @returns {[string]} Array of existing sharkd sockets with loaded file
 */
get_loaded_sockets = function() {
  let return_array = [];
  Object.keys(sharkd_objects).forEach(function(socket_name){
    if (sharkd_objects[socket_name].stream.readable) {
      return_array.push(socket_name);
    } else {
      sharkd_objects[socket_name].destroy();
      delete sharkd_objects[socket_name];
    }
  });
  return return_array;
}

/**
 * Returns a sharkd socket with the PCAP file loaded
 * @param {string} capture the full path of the pcap file to load
 * @returns {PromiseSocket} sharkd socket with loaded file
 */
get_sharkd_cli = async function(capture) {
  let socket_name = capture.replace(CAPTURES_PATH,"");
  if (socket_name.startsWith("/")) {
    socket_name = socket_name.substr(1);
  }
  if (socket_name in sharkd_objects) { // return existing socket
    if (sharkd_objects[socket_name].stream.readable === false) {
      sharkd_objects[socket_name].destroy();
      delete sharkd_objects[socket_name];
      return get_sharkd_cli(capture);
    }
    return sharkd_objects[socket_name];
  } else { // no socket for this capture existst, create new one
    let new_socket = new PromiseSocket();
    new_socket.setTimeout(300000); // 5 minutes timeout per socket connection
    new_socket.stream.setEncoding('utf8');
    try {
      await new_socket.connect(SHARKD_SOCKET);
    }
    catch(err) {
      console.log("Error trying to connect to " + SHARKD_SOCKET)
      console.log(err);
      if (sharkd_proc !== null && sharkd_proc.pid) {
        console.log("sharkd_proc.pid: " + sharkd_proc.pid)
        sharkd_proc.kill('SIGHUP');
        await sleep(250);
        sharkd_proc = null;
      }
      try {
        console.log(`Trying to spawn unix:${SHARKD_SOCKET}`)
        sharkd_proc = spawn('sharkd', ['unix:' + SHARKD_SOCKET]);
        await sleep(250);
        if (sharkd_proc.exitCode === 1) {
          console.log(`Error spawning sharkd under ${SHARKD_SOCKET} / exit 1`);
          process.exit(1);
        }
      } catch (err_2) {
        console.log(`Error spawning sharkd under ${SHARKD_SOCKET} / err_2`);
        console.log(err_2);
        process.exit(1);
      }
      return get_sharkd_cli(capture);
    }
    sharkd_objects[socket_name] = new_socket;
    
    if(capture !== '') {
      await send_req({'method':'load', 'file': capture}, sharkd_objects[socket_name]);
      return sharkd_objects[socket_name];
    } else {
      return sharkd_objects[socket_name];
    }
  }
}

/**
 * Checks if str is a valid JSON object
 * @param {string} str the string to check
 * @returns {boolean} is str a valid JSON object
 */
function _str_is_json(str) {
  try {
    var json = JSON.parse(str);
    return (typeof json === 'object');
  } catch (e) {
    return false;
  }
}

/**
 * Sends a command to the socket and return the answer as string.
 * If no sock is provided, one is requested from `get_sharkd_cli` using the capture file inside the request
 * @param {string} request the string to check
 * @param {PromiseSocket|null} sock optional socket to use for communication
 * @returns {string} data returned from sharkd as string
 */
let jsonrpc_id=0;
send_req = async function(request, sock) {
  let cap_file = '';

  // newer versions of sharkd require jsonrpc, add required fields to request
  // FIXME: should use a jsonrpc library for this
  request["jsonrpc"] = "2.0";
  request["id"] = ++jsonrpc_id;

  // FIXME: should update the frontend/backend to use a POST with json
  // the current approach of GET params makes every value a string
  for (var key of Object.keys(request)) {
    if (SHARKD_INTEGER_PARAMS.has(key)) {
      if(typeof request[key] === "string" || request[key] instanceof String) {
        request[key] = parseInt(request[key]);
      }
    }
    if (SHARKD_BOOLEAN_PARAMS.has(key)) {
      if(typeof request[key] === "string" || request[key] instanceof String) {
        request[key] = SHARKD_TRUE_VALUES.has(request[key]);
      }
    }
  }
  
  if ("capture" in request) {
    if (request.capture.includes('..')) {
      return JSON.stringify({"err": 1, "errstr": "Nope"});
    }

    let req_capture = request.capture;

    // newer versions of sharkd don't allow extraneous fields
    // capture is used by webshark to track connection handles
    delete request.capture;

    if (req_capture.startsWith("/")) {
      req_capture = req_capture.substr(1);
    }

    cap_file = `${CAPTURES_PATH}${req_capture}`;

    // verify that pcap exists
    if (fs.existsSync(cap_file) === false) {
        return JSON.stringify({"err": 1, "errstr": "Nope"});
    }
  }
  
  async function _send_req_internal() {
    let new_sock = sock;
    if (typeof(new_sock) === 'undefined') {
      new_sock = await get_sharkd_cli(cap_file);
    }
  
    if (new_sock === null) {
      return JSON.stringify({"err": 1, "errstr": `cannot connect to sharkd using socket: ${SHARKD_SOCKET}`});
    }
    try {
      await new_sock.write(JSON.stringify(request)+"\n");
    } catch (err) {
      console.log("Error writing to sharkd socket")
      console.log(err)
      return null;
    }

    let data = '';
    let chunk = await new_sock.read();

    data += chunk;
    while (_str_is_json(data) === false) {
      chunk = await new_sock.read();
      data += chunk;
    }
    
    // newer versions of webshark wrap return data in a "result" field
    // try to simulate the old behavior to avoid rewriting a bunch of js
    // FIXME: should probably rewrite dependent code and remove this
    result = JSON.parse(data);

    if ("result" in result) {
      result = result["result"];
    }

    return JSON.stringify(result);
  }

  return await lock.acquire(cap_file, _send_req_internal);
}

exports.get_sharkd_cli = get_sharkd_cli;
exports.send_req = send_req;
exports.get_loaded_sockets = get_loaded_sockets;
