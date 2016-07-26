function (user, context, callback) {

  var CLIENTS_WITH_MFA = ['{REPLACE_WITH_YOUR_CLIENT_ID}'];

  // run only for the specified clients
  if (CLIENTS_WITH_MFA.indexOf(context.clientID) === -1) {
    return callback(null,user,context);
  }

  // returning from MFA validation
  if(context.protocol === 'redirect-callback') {
    jwt.verify(context.request.query.id_token, new Buffer(configuration.slack_mfa_secret,'base64'), function(err, decoded){
      if(!decoded) return callback(new Error('Invalid Token'));
      if(decoded.status !== 'ok') return callback(new Error('Invalid Token Status'));

      var MongoClient = require('mongodb').MongoClient;
      MongoClient.connect(configuration.mongo_connection, function(err, db) {
        var collection = db.collection('UsedToken');

        collection.findOne({ "jti": decoded.jti }, function (err, blacklistedToken) {
          if (blacklistedToken) return callback(new Error('Invalid JWT ID'));

          collection.insertOne({ jti: decoded.jti, "date-blacklisted": new Date() });
          return callback(null,user,context);
        });
      });
    });
  } else {

    var uuid = require('uuid');
    var token_payload = { jti: uuid.v4() };
    if(user.user_metadata) {
      token_payload = {
        slack_username: user.user_metadata.slack_mfa_username,
        slack_enrolled:  user.user_metadata.slack_mfa_enrolled,
        jti: uuid.v4()
      };
    }

    var token = jwt.sign(token_payload,
      new Buffer(configuration.slack_mfa_secret, 'base64'),
      {
        subject: user.user_id,
        expiresInMinutes: 5,
        audience: context.clientID,
        issuer: 'urn:sgmeyer:slack:mfa',
        iat: new Date().getTime() / 1000,
      });

    //Trigger MFA
    context.redirect = {
      url: configuration.slack_mfa_url + '?token=' + token // check this
    };

    callback(null, user, context);
  }
}
