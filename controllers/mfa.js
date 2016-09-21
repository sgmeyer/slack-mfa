var express = require('express');
var jwt = require('jsonwebtoken');

var router = express();

function getMfa(req, res) {
  var token = req.query.token;
  var client_secret = process.env.CLIENT_SECRET || req.webtaskContext.data.client_secret;
  var secret = new Buffer(client_secret, 'base64');

  jwt.verify(token, secret, function (err, decoded) {
     if (err || decoded.slack_username) {
       res.status(500).send('Error.').end();
       return;
     }

     var slackOptions = {
       username = decoded.slack_username.toLowerCase().trim(),
       apiToken = process.env.SLACK_API_TOKEN || req.webtaskContext.data.slack_api_token;
     }

     res.status(200).send('Sent notification to Slack.').end();
  });
}



router.get('/mfa', getMfa);

module.exports = router;
