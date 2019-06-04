const {PromiseSocket} = require('promise-socket');
var sharkd_objects = {};

get_sharkd_cli = async function(capture) {
  if (capture in sharkd_objects) {
    return sharkd_objects[capture];
  } else {
    sharkd_objects[capture] = new PromiseSocket();
    sharkd_objects[capture].stream.setEncoding('utf8');
    await sharkd_objects[capture].connect("/var/run/sharkd.sock");
    
    if(capture !== '') {
      await send_req({'req':'load', 'file':capture}, sharkd_objects[capture]);
      return sharkd_objects[capture];
    } else {
      return sharkd_objects[capture];
    }
  }
}

send_req = async function(request, sock) {

  let cap_file = '';
  if ("capture" in request) {
      cap_file = request.capture;
  }
  let new_sock = sock;
  if (typeof(new_sock) === 'undefined') {
    new_sock = await get_sharkd_cli(cap_file);
  }
  
  await new_sock.write(JSON.stringify(request)+"\n");
  let data = await new_sock.read();
  return data;
}

exports.get_sharkd_cli = get_sharkd_cli;
exports.send_req = send_req;