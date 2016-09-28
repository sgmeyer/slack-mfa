var jwt = require('jsonwebtoken');
var tokens = require('./tokenStore');
var MongoClient = require('mongodb').MongoClient;

var token = {
  issue: function (payload, secret, options, connectionString) {
    var database;
    return tokens.connect(connectionString).then(function(db) {
      database = db;
      return tokens.find(database, payload)
    }).then(function (record) {
      if (record) { throw new Error('JWT already white listed.'); }
      return tokens.save(database, payload);
    }).then(function (record) {
      if (!record) { throw new Error('Failed to whitelist JWT.'); }
      return sign(payload, secret, options);
    });
  },
  revoke: function(tokenId, connectionString) {
    return tokens.connect(connectionString).then(function(db) {
      return tokens.remove(db, tokenId);
    });
  },
  verify: function (token, secret, connectionString) {
    var decodedToken;
    return verify(token, secret).then(function(decoded) {
      decodedToken = decoded;
      return tokens.connect(connectionString);
    }).then(function (db) {
      return tokens.find(db, decodedToken);
    }).then(function(record) {
      return new Promise(function (resolve, reject) {
        if (!record) { return reject('JWT is not whitelisted.') };
        return resolve(decodedToken);
      });
    });
  }
};

function verify(token, secret) {
  return new Promise(function (resolve, reject) {
    return jwt.verify(token, secret, function (err, decoded) {
      if (err) { return reject(err); }
      return resolve(decoded);
    });
  });
}

function sign(payload, secret, options) {
  return new Promise(function (resolve, reject) {
    var token = jwt.sign(payload, secret, options);
    return resolve(token);
  });
}

module.exports = token;
