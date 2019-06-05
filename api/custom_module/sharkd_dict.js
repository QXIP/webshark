const {PromiseSocket} = require('promise-socket');
var sharkd_objects = {};
const SHARKD_SOCKET = process.env.SHARKD_SOCKET || "/var/run/sharkd.sock";
const CAPTURES_PATH = process.env.CAPTURES_PATH || "/captures/";
const fs = require('fs');

get_sharkd_cli = async function(capture) {
  if (capture in sharkd_objects) {
    return sharkd_objects[capture];
  } else {
    let new_socket = new PromiseSocket();
    new_socket.stream.setEncoding('utf8');
    try {
      await new_socket.connect(SHARKD_SOCKET);
    }
    catch(err) {
      return null;
    }
    sharkd_objects[capture] = new_socket;
    
    if(capture !== '') {
      await send_req({'req':'load', 'file': capture}, sharkd_objects[capture]);
      return sharkd_objects[capture];
    } else {
      return sharkd_objects[capture];
    }
  }
}

function _str_is_json(str) {
  try {
    var json = JSON.parse(str);
    return (typeof json === 'object');
  } catch (e) {
    return false;
  }
}

send_req = async function(request, sock) {
  let cap_file = '';
  
  if ("capture" in request) {
    if (request.capture.includes('..')) {
      return JSON.stringify({"err": 1, "errstr": "Nope"});
    }
    cap_file = `${CAPTURES_PATH}${request.capture}`;

    // verify that pcap exists
    if (fs.existsSync(cap_file) === false) {
        return JSON.stringify({"err": 1, "errstr": "Nope"});
    }
  }

  let new_sock = sock;

  if (typeof(new_sock) === 'undefined') {
    new_sock = await get_sharkd_cli(cap_file);
  }

  if (new_sock === null) {
    return JSON.stringify({"err": 1, "errstr": `cannot connect to sharkd using socket: ${SHARKD_SOCKET}`});
  }

  //dont allow req=download
  if ("req" in request) {
    if (request.req === 'download') {
      return JSON.stringify({"err": 1, "errstr": "Nope"});
    }
  }
  
  await new_sock.write(JSON.stringify(request)+"\n");
  let data = '';
  let chunk = await new_sock.read();
  data += chunk;
  while (_str_is_json(data) === false) {
    chunk = await new_sock.read();
    data += chunk;
  }
  return data;
}

exports.get_sharkd_cli = get_sharkd_cli;
exports.send_req = send_req;