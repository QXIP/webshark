'use strict'

const fs = require('fs');
const fileUpload = require('fastify-file-upload');
const CAPTURES_PATH = process.env.CAPTURES_PATH || "/captures/";

module.exports = function (fastify, opts, next) {
  fastify.register(fileUpload);
  fastify.post('/webshark/upload', function (req, reply) {
    const files = req.raw.files
    let fileArr = []
    for(let key in files){
        if(!files[key].name||!files[key].data) return;
        fs.writeFile(CAPTURES_PATH+files[key].name, files[key].data, function(err) {
          if(err) {
            return console.log(err);
          }
        });

        fileArr.push({
          name: files[key].name,
          mimetype: files[key].mimetype,
          size: files[key].size
        })
    }
    if (fileArr.length === 1) {
      reply.code(200).send(fileArr[0])
    } else {
      reply.code(200).send(fileArr)
    }
  })

  next()
}
