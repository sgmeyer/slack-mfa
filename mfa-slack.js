var Express = require('express');
var Webtask = require('webtask-tools');
var jwt = require('jsonwebtoken');

var app = Express();

var bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({ extended: false }));

var Promise = require('bluebird');
var request = Promise.promisify(require('request'));

app.get('/', function (req, res) {
  var token = req.query.token;

  jwt.verify(token, new Buffer(req.webtaskContext.data.client_secret,'base64'), function(err, decoded) {

    if (err) {
      res.end('error');
      return;
    }

    var slack_username = decoded.slack_username ? decoded.slack_username.toLowerCase() : undefined;
    var slack_enrolled = decoded.slack_enrolled;
    var slackApiToken = req.webtaskContext.data.slack_api_token;

    if (slack_username && !!slack_enrolled)  {
      sendUrlToSlack(req, res, token, slackApiToken, slack_username, slack_enrolled);
    } else {

      showEnrollmentStep(res, req.webtaskContext, token, slack_username);
    }
  });
});

app.post('/', function (req, res) {
  var token = req.body.token;

  jwt.verify(token, new Buffer(req.webtaskContext.data.client_secret, 'base64'), function (err, decoded) {
    if (err) {
      res.end('error on enrollment token verification');
      return;
    }

    var slack_username = req.body.slack_username ? req.body.slack_username.toLowerCase() : undefined;
    var slackApiToken = req.webtaskContext.data.slack_api_token;
    var slack_enrolled = decoded.slack_enrolled;
    if (slack_username) {
      startMfaEnrollment(req.webtaskContext, decoded.sub, slack_username, slack_enrolled);
      sendUrlToSlack(req, res, token, slackApiToken, slack_username);
    }
  });
});

app.get('/verify', function (req, res) {
  var token = req.query.token;

  jwt.verify(token, new Buffer(req.webtaskContext.data.client_secret, 'base64'), function(err, decoded) {

    if (err) {
      res.end('error on callback token verification');
      return;
    }

    completeMfaEnrollment(req.webtaskContext, decoded.sub);
    redirectBack(res, req.webtaskContext, decoded, true);
  });
});

function hereDoc(f) {
  return f.toString().
    replace(/^[^\/]+\/\*!?/, '').
    replace(/\*\/[^\/]+$/, '');
}

function redirectBack(res, webtaskContext, decoded, success) {
  var token = jwt.sign({
      status: success ? 'ok' : 'fail'
    },
    new Buffer(webtaskContext.data.client_secret, 'base64'),
    {
      subject: decoded.sub,
      expiresInMinutes: 30,
      audience: decoded.aud,
      issuer: 'urn:sgmeyer:slack:mfa'
    });

  res.writeHead(301, {Location: 'https://' + webtaskContext.data.auth0_domain + '/continue?id_token=' + token});
  res.end();
}

/**
 * This sends a direct message to the users Slack username utilizing the Slack API.
 **/
function sendUrlToSlack(req, res, token, slackApiToken, slackUsername, slackEnrolled) {
  var callback_url = '<https://webtask.it.auth0.com/api/run/'
                   + req.x_wt.container + '/' + req.x_wt.jtn
                   + '/verify?token=' + token + " | Complete Login>";

  var text = JSON.stringify([{
    fallback: 'Follow this link to complete login: ' + callback_url,
    title: 'You have attempted to log into a remote site.  Please click the link below to continue.',
    text: callback_url,
    color: '#3AA3E3'
  }]);

  var apiUrl = 'https://slack.com/api/chat.postMessage?token='
             + slackApiToken + '&channel=%40' + slackUsername
             + '&attachments=' + require('querystring').escape(text)
             + '&pretty=1&as_user=true&unfurl_links=false&unfurl_media=false';

  request({
      method: 'GET',
      url: apiUrl
    }).then(function () {
      res.writeHead(200, {
        'Content-Type': 'text/html'
      });

      res.end(require('ejs').render(hereDoc(verificationSent), {
        slack_username: slackUsername,
        slack_enrolled: slackEnrolled
      }));
    });
}

function showEnrollmentStep(res, webtaskContext, token, slackUsername) {
  res.writeHead(200, {
    'Content-Type': 'text/html'
  });

  res.end(require('ejs').render(hereDoc(enrollmentForm), {
      token: token,
      slack_username: slackUsername
    }
  ));
}

function startMfaEnrollment(webtaskContext, userId, slackUsername) {
  var payload = { user_metadata: { slack_mfa_username: slackUsername, slack_mfa_enrolled: false } };
  updateUserData(webtaskContext, userId, payload);
}

function completeMfaEnrollment(webtaskContext, userId, slackUsername) {
  var payload = { user_metadata: { slack_mfa_enrolled: true }  };
  updateUserData(webtaskContext, userId, payload);
}

function updateUserData(webtaskContext, userId, payload) {
  var options = { method: 'PATCH',
    url: 'https://sgmeyer.auth0.com/api/v2/users/' + userId,
    headers:
     { 'cache-control': 'no-cache',
       'authorization': 'Bearer ' + webtaskContext.data.auth0_api_token,
       'content-type': 'application/json' },
    body: payload,
    json: true };

    request(options, function (error, response, body) {
      if (error) throw new Error(error);

      console.log(body);
    });
}

/**
 * The HTML page to display once a direct message is sent to the Slack username.
 */
function verificationSent() {
  /*
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" href="https://cdn.auth0.com/styleguide/1.0.0/img/badge.png">
    <meta charset="UTF-8">
    <title>Auth0 - SMS multifactor authentication</title>
    <style>.modal .body input,body,html{font-family:avenir-next-web,Avenir,"Helvetica Neue",Hevetica,sans-serif;width:100%}.modal .wrong-username{font-size: 13px;margin-top: 20px;font-weight: 400;text-align:center;color: rgba(0,0,0,.86);cursor: pointer;}.modal .body .auth0-lock-input-wrap .auth0-lock-input:focus,a,a:active,a:hover,a:visited,button,button:active,button:hover,button:visited{outline:0}html{box-sizing:border-box}*,:after,:before{box-sizing:inherit}@import url(http://fast.fonts.net/t/1.css?apiType=css&projectid=857b99c8-12c9-4d60-85ee-16ebd935d187);@font-face{font-family:avenir-next-web_n2;src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/5db267f9-3612-485c-ae18-5698d2692816.eot?#iefix) format("eot")}@font-face{font-family:avenir-next-web;src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/5db267f9-3612-485c-ae18-5698d2692816.eot?#iefix);src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/5db267f9-3612-485c-ae18-5698d2692816.eot?#iefix) format("eot"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/174d458a-81e0-4174-9473-35e3bf0a613c.woff2) format("woff2"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/57a79aa3-9b06-4ba7-a9a4-2b766d826ecf.woff) format("woff"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/733cb7bd-50e1-4dee-893a-0b40ef382b02.ttf) format("truetype"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/594135c6-6c4f-4880-a0d2-ba923b5ef38e.svg#594135c6-6c4f-4880-a0d2-ba923b5ef38e) format("svg");font-weight:200;font-style:normal}@font-face{font-family:avenir-next-web_i2;src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/9e4f77ac-2ea3-4f4e-b592-290f5c4af932.eot?#iefix) format("eot")}@font-face{font-family:avenir-next-web;src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/9e4f77ac-2ea3-4f4e-b592-290f5c4af932.eot?#iefix);src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/9e4f77ac-2ea3-4f4e-b592-290f5c4af932.eot?#iefix) format("eot"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/69a545eb-cdd0-4c00-9035-0029d8cede28.woff2) format("woff2"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/642cb581-067a-4f15-9df9-55c49c6b5446.woff) format("woff"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/972d8132-0f21-4d94-b42d-8f4022e6aa17.ttf) format("truetype"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/670d40f3-affd-4e16-8ad8-055f11470e24.svg#670d40f3-affd-4e16-8ad8-055f11470e24) format("svg");font-weight:200;font-style:italic}@font-face{font-family:avenir-next-web_n4;src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/069faa0e-9913-48c4-9ef7-89a4bc080b65.eot?#iefix) format("eot")}@font-face{font-family:avenir-next-web;src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/069faa0e-9913-48c4-9ef7-89a4bc080b65.eot?#iefix);src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/069faa0e-9913-48c4-9ef7-89a4bc080b65.eot?#iefix) format("eot"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/7db1f672-3a8f-4d19-9c49-7f61aed450b5.woff2) format("woff2"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/4ab86b35-c0c2-42b5-98ad-4b6eba66b197.woff) format("woff"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/276b3566-1c3b-4bc1-8915-15314f091f29.ttf) format("truetype"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/5d02f5f4-46e7-453a-aef9-3e7106d7bb68.svg#5d02f5f4-46e7-453a-aef9-3e7106d7bb68) format("svg");font-weight:400;font-style:normal}@font-face{font-family:avenir-next-web_i4;src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/78f55966-cc8e-4f4c-bf8b-8fe59be9fe96.eot?#iefix) format("eot")}@font-face{font-family:avenir-next-web;src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/78f55966-cc8e-4f4c-bf8b-8fe59be9fe96.eot?#iefix);src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/78f55966-cc8e-4f4c-bf8b-8fe59be9fe96.eot?#iefix) format("eot"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/b17468ea-cf53-4635-984b-4d930a68ed4d.woff2) format("woff2"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/4d1d0d0d-9ea6-4117-901f-8b32ca1ab936.woff) format("woff"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/66b50093-e606-427c-a42a-a44b2f9ff219.ttf) format("truetype"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/78695677-7ebb-4ef8-8996-eff09dc64f26.svg#78695677-7ebb-4ef8-8996-eff09dc64f26) format("svg");font-weight:400;font-style:italic}@font-face{font-family:avenir-next-web_n5;src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/c6970a14-8b0f-4629-9072-71c7e123908f.eot?#iefix) format("eot")}@font-face{font-family:avenir-next-web;src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/c6970a14-8b0f-4629-9072-71c7e123908f.eot?#iefix);src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/c6970a14-8b0f-4629-9072-71c7e123908f.eot?#iefix) format("eot"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/b0b84e4d-2164-45c7-a674-1662f19f3ba6.woff2) format("woff2"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/e91d1bbf-3fea-45e2-b003-a22b12ce6e5f.woff) format("woff"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/ead8b64b-1abd-4d5b-a642-a21dfe2f463b.ttf) format("truetype"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/e536e1c2-92a4-4db4-8a41-1c55354d11b7.svg#e536e1c2-92a4-4db4-8a41-1c55354d11b7) format("svg");font-weight:700;font-style:normal}@font-face{font-family:avenir-next-web_i5;src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/1f022c78-180e-4c6b-b5ee-e1573f17e4b6.eot?#iefix) format("eot")}@font-face{font-family:avenir-next-web;src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/1f022c78-180e-4c6b-b5ee-e1573f17e4b6.eot?#iefix);src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/1f022c78-180e-4c6b-b5ee-e1573f17e4b6.eot?#iefix) format("eot"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/349e5647-5161-46bb-a19f-8a609ae235e4.woff2) format("woff2"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/cc0a88c2-524b-4c90-b6f0-a80570222c30.woff) format("woff"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/03aefdc0-0198-4662-a9c7-640a4734063e.ttf) format("truetype"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/132a539d-37fa-48fb-92ec-1f4591f98ee1.svg#132a539d-37fa-48fb-92ec-1f4591f98ee1) format("svg");font-weight:700;font-style:italic}@font-face{font-family:budicon-font;src:url(https://cdn.auth0.com/fonts/budicons/fonts/budicon-font.eot);src:url(https://cdn.auth0.com/fonts/budicons/fonts/budicon-font.eot?#iefix) format("embedded-opentype"),url(https://cdn.auth0.com/fonts/budicons/fonts/budicon-font.woff) format("woff"),url(https://cdn.auth0.com/fonts/budicons/fonts/budicon-font.ttf) format("truetype"),url(https://cdn.auth0.com/fonts/budicons/fonts/budicon-font.svg#budicon-font) format("svg");font-weight:400;font-style:normal}body,html{height:100%;margin:0;padding:0;font-size:62.5%;min-height:100%;background-color:#222228;z-index:1}.modal .body input{border:none;font-size:13px;outline:0}.modal-wrapper{width:100%;height:100%;display:table;background-color:rgba(0,0,0,.15);z-index:2;-webkit-animation:fadein 1s;-moz-animation:fadein 1s;-ms-animation:fadein 1s;-o-animation:fadein 1s;animation:fadein 1s}.modal-centrix{padding:0;vertical-align:middle;display:table-cell;margin:0}.modal{width:100%;max-width:300px;z-index:3;border-radius:0;box-shadow:0 2px 4px rgba(0,0,0,.5);margin:auto}.modal .head{background:#efefef;background:-moz-linear-gradient(left,#efefef 0,#fefefe 50%,#efefef 100%);background:-webkit-gradient(linear,left top,right top,color-stop(0,#efefef),color-stop(50%,#fefefe),color-stop(100%,#efefef));background:-webkit-linear-gradient(left,#efefef 0,#fefefe 50%,#efefef 100%);background:-o-linear-gradient(left,#efefef 0,#fefefe 50%,#efefef 100%);background:-ms-linear-gradient(left,#efefef 0,#fefefe 50%,#efefef 100%);background:linear-gradient(to right,#efefef 0,#fefefe 50%,#efefef 100%);text-align:center;height:132px}.modal .head .logo{display:inline-block;margin:14px auto 0;width:53px}.modal .head .first-line{display:block;line-height:30px;height:30px;margin:15px 0 0;font-size:22px;color:#333}@media (min-width:414px){.modal{border-radius:5px;top:calc(50% + 40px)}.modal .head{border-radius:5px 5px 0 0}.modal .head .first-line{margin:9px 0 0}}.modal .head .second-line{display:block;line-height:16px;height:16px;margin:3px 0 21px;font-size:12px;color:#333;text-transform:uppercase}.modal .errors{text-align:center;background-color:#f04848;color:#fff;line-height:1.6;font-size:12px;padding:10px}.modal .errors p{margin:0}.modal .errors.hidden{display:none}.modal .body{background-color:#fff;padding:30px;overflow:hidden;border-radius: 0 0 5px 5px;}.modal .body .description{display:block;max-width:290px;font-size:13px;line-height:1.8;color:rgba(0,0,0,.56);text-align:center;margin-bottom:20px}[class*=" icon-"]:before,[class^=icon-]:before,[data-icon]:before{font-family:budicon-font!important;font-style:normal!important;font-weight:400!important;font-variant:normal!important;text-transform:none!important;speak:none;line-height:1;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}.modal .body .auth0-lock-input-wrap,.modal .body .auth0-lock.auth0-lock .auth0-lock-input-wrap{border-radius:3px;border:1px solid #f1f1f1;position:relative;background:#f1f1f1;padding-left:40px;-webkit-transition:border-color .8s;transition:border-color .8s}.modal .body .auth0-lock-input-wrap .auth0-lock-icon.auth0-lock-icon-box{width:12px;height:14px;top:13px;left:14px;position:absolute;font-size:12px}.modal .body .auth0-lock-input-wrap .auth0-lock-input{border:0;padding:0 14px;right:0;height:40px;font-size:13px;width:100%;border-radius:0 2px 2px 0;-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box;position:relative;color:#727578}.modal .ok-cancel{display:block;width:100%;overflow:hidden}.modal .ok-cancel button{height:70px;vertical-align:middle;width:50%;float:left;border:0;text-align:center;cursor:pointer;padding:0}.modal .ok-cancel button.ok{background-color:#ea5323}.modal .ok-cancel button.ok:hover{background-color:#ac3610;-webkit-transition:background .3s ease;transition:background .3s ease}.modal .ok-cancel button.ok.full-width{width:100%}.modal .ok-cancel button.cancel{background-color:#5c666f}@media (min-width:414px){.modal .body .description{max-width:348px}.modal .ok-cancel button.ok{border-radius:0 0 5px}.modal .ok-cancel button.ok.full-width{border-radius:0 0 5px 5px}.modal .ok-cancel button.cancel{border-radius:0 0 0 5px}}[data-icon]:before{content:attr(data-icon)}.icon-budicon-377:before{content:""}.icon-budicon-509:before{content:""}.icon-budicon-460:before{content:""}.custom-select{display:inline-block;vertical-align:top;position:relative;border-radius:3px;height:32px;line-height:32px;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;font-size:1.6rem;padding-right:28px}.custom-select:hover{color:#333}.custom-select i{font-size:12px;position:absolute;top:3px;right:9px;opacity:.7;animation:none}.custom-select span{color:#000;border-bottom:1px solid #6b6b6b;padding-bottom:1px;text-transform:uppercase}.custom-select select{position:absolute;top:0;left:0;width:100%;height:100%;opacity:0}@-ms-keyframes fadein{from{opacity:0}to{opacity:1}}.auth0-spinner{position:relative}.auth0-spinner:before{content:"";background:url(data:image/png;base64,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) center center no-repeat;height:15px;width:15px;background-size:contain;display:inline-block;top:50%;left:50%;-webkit-transform:translate(-50%,-50%);transform:translate(-50%,-50%);position:absolute}.auth0-spinner .icon{display:none}.auth0-spinner .spinner{margin:0 auto;top:0;position:relative;text-indent:-9999em;border-width:2px;border-style:solid;border-color:rgba(255,255,255,.4) rgba(255,255,255,.4) rgba(255,255,255,.2) rgba(255,255,255,.2);-webkit-animation:loaderAnim .8s infinite linear;animation:loaderAnim .8s infinite linear}.auth0-spinner .spinner,.auth0-spinner .spinner:after{border-radius:50%;width:40px;height:40px}@-moz-keyframes fadein{from{opacity:0}to{opacity:1}}@-webkit-keyframes fadein{from{opacity:0}to{opacity:1}}@-o-keyframes fadein{from{opacity:0}to{opacity:1}}@keyframes fadein{from{opacity:0}to{opacity:1}}@-moz-keyframes loaderAnim{0%{-webkit-transform:rotate(0);transform:rotate(0)}100%{-webkit-transform:rotate(360deg);transform:rotate(360deg)}}@-webkit-keyframes loaderAnim{0%{-webkit-transform:rotate(0);transform:rotate(0)}100%{-webkit-transform:rotate(360deg);transform:rotate(360deg)}}@-o-keyframes loaderAnim{0%{-webkit-transform:rotate(0);transform:rotate(0)}100%{-webkit-transform:rotate(360deg);transform:rotate(360deg)}}@keyframes loaderAnim{0%{-webkit-transform:rotate(0);transform:rotate(0)}100%{-webkit-transform:rotate(360deg);transform:rotate(360deg)}}@-moz-keyframes fadeIn{0%{opacity:0}100%{opacity:1}}@-webkit-keyframes fadeIn{0%{opacity:0}100%{opacity:1}}@-o-keyframes fadeIn{0%{opacity:0}100%{opacity:1}}@keyframes fadeIn{0%{opacity:0}100%{opacity:1}}</style>
  </head>
  <body>
    <div class="modal-wrapper">
      <div class="modal-centrix">
        <div class="modal">
          <div class="head"><img src="https://cdn.auth0.com/styleguide/2.0.9/lib/logos/img/badge.png" class="logo auth0"><span class="first-line">Auth0</span></div>
          <div class="body">
            <span class="description">We have sent a DM to @<%= slack_username %>.  Click the link in the DM to complete your login request.</span>
            <% if (!slack_enrolled) { %>
            <p class="wrong-username">
              <a href="#" onclick="restartFlow()">Wrong Slack username?</a>
            </p>
            <% } %>
          </div>
        </div>
      </div>
    </div>
    <script>
      function restartFlow() {
        var loc = window.location;
        window.location = loc.protocol + '//' + loc.host + loc.pathname + loc.search;
      }
    </script>
  </body>
  </html>
  */
}

function enrollmentForm() {
  /*
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="icon" href="https://cdn.auth0.com/styleguide/1.0.0/img/badge.png">
      <meta charset="UTF-8">
      <title>Auth0 - SMS multifactor authentication</title>
      <style>.hide{display: none}.modal .body input,body,html{font-family:avenir-next-web,Avenir,"Helvetica Neue",Hevetica,sans-serif;width:100%}.validation-error{border-color: red !important;}.validation-error-message{color:red;font-size: 13px;line-height: 1.8;}.modal .body .auth0-lock-input-wrap .auth0-lock-input:focus,a,a:active,a:hover,a:visited,button,button:active,button:hover,button:visited{outline:0}html{box-sizing:border-box}*,:after,:before{box-sizing:inherit}@import url(http://fast.fonts.net/t/1.css?apiType=css&projectid=857b99c8-12c9-4d60-85ee-16ebd935d187);@font-face{font-family:avenir-next-web_n2;src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/5db267f9-3612-485c-ae18-5698d2692816.eot?#iefix) format("eot")}@font-face{font-family:avenir-next-web;src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/5db267f9-3612-485c-ae18-5698d2692816.eot?#iefix);src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/5db267f9-3612-485c-ae18-5698d2692816.eot?#iefix) format("eot"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/174d458a-81e0-4174-9473-35e3bf0a613c.woff2) format("woff2"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/57a79aa3-9b06-4ba7-a9a4-2b766d826ecf.woff) format("woff"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/733cb7bd-50e1-4dee-893a-0b40ef382b02.ttf) format("truetype"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/594135c6-6c4f-4880-a0d2-ba923b5ef38e.svg#594135c6-6c4f-4880-a0d2-ba923b5ef38e) format("svg");font-weight:200;font-style:normal}@font-face{font-family:avenir-next-web_i2;src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/9e4f77ac-2ea3-4f4e-b592-290f5c4af932.eot?#iefix) format("eot")}@font-face{font-family:avenir-next-web;src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/9e4f77ac-2ea3-4f4e-b592-290f5c4af932.eot?#iefix);src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/9e4f77ac-2ea3-4f4e-b592-290f5c4af932.eot?#iefix) format("eot"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/69a545eb-cdd0-4c00-9035-0029d8cede28.woff2) format("woff2"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/642cb581-067a-4f15-9df9-55c49c6b5446.woff) format("woff"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/972d8132-0f21-4d94-b42d-8f4022e6aa17.ttf) format("truetype"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/670d40f3-affd-4e16-8ad8-055f11470e24.svg#670d40f3-affd-4e16-8ad8-055f11470e24) format("svg");font-weight:200;font-style:italic}@font-face{font-family:avenir-next-web_n4;src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/069faa0e-9913-48c4-9ef7-89a4bc080b65.eot?#iefix) format("eot")}@font-face{font-family:avenir-next-web;src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/069faa0e-9913-48c4-9ef7-89a4bc080b65.eot?#iefix);src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/069faa0e-9913-48c4-9ef7-89a4bc080b65.eot?#iefix) format("eot"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/7db1f672-3a8f-4d19-9c49-7f61aed450b5.woff2) format("woff2"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/4ab86b35-c0c2-42b5-98ad-4b6eba66b197.woff) format("woff"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/276b3566-1c3b-4bc1-8915-15314f091f29.ttf) format("truetype"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/5d02f5f4-46e7-453a-aef9-3e7106d7bb68.svg#5d02f5f4-46e7-453a-aef9-3e7106d7bb68) format("svg");font-weight:400;font-style:normal}@font-face{font-family:avenir-next-web_i4;src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/78f55966-cc8e-4f4c-bf8b-8fe59be9fe96.eot?#iefix) format("eot")}@font-face{font-family:avenir-next-web;src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/78f55966-cc8e-4f4c-bf8b-8fe59be9fe96.eot?#iefix);src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/78f55966-cc8e-4f4c-bf8b-8fe59be9fe96.eot?#iefix) format("eot"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/b17468ea-cf53-4635-984b-4d930a68ed4d.woff2) format("woff2"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/4d1d0d0d-9ea6-4117-901f-8b32ca1ab936.woff) format("woff"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/66b50093-e606-427c-a42a-a44b2f9ff219.ttf) format("truetype"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/78695677-7ebb-4ef8-8996-eff09dc64f26.svg#78695677-7ebb-4ef8-8996-eff09dc64f26) format("svg");font-weight:400;font-style:italic}@font-face{font-family:avenir-next-web_n5;src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/c6970a14-8b0f-4629-9072-71c7e123908f.eot?#iefix) format("eot")}@font-face{font-family:avenir-next-web;src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/c6970a14-8b0f-4629-9072-71c7e123908f.eot?#iefix);src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/c6970a14-8b0f-4629-9072-71c7e123908f.eot?#iefix) format("eot"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/b0b84e4d-2164-45c7-a674-1662f19f3ba6.woff2) format("woff2"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/e91d1bbf-3fea-45e2-b003-a22b12ce6e5f.woff) format("woff"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/ead8b64b-1abd-4d5b-a642-a21dfe2f463b.ttf) format("truetype"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/e536e1c2-92a4-4db4-8a41-1c55354d11b7.svg#e536e1c2-92a4-4db4-8a41-1c55354d11b7) format("svg");font-weight:700;font-style:normal}@font-face{font-family:avenir-next-web_i5;src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/1f022c78-180e-4c6b-b5ee-e1573f17e4b6.eot?#iefix) format("eot")}@font-face{font-family:avenir-next-web;src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/1f022c78-180e-4c6b-b5ee-e1573f17e4b6.eot?#iefix);src:url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/1f022c78-180e-4c6b-b5ee-e1573f17e4b6.eot?#iefix) format("eot"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/349e5647-5161-46bb-a19f-8a609ae235e4.woff2) format("woff2"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/cc0a88c2-524b-4c90-b6f0-a80570222c30.woff) format("woff"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/03aefdc0-0198-4662-a9c7-640a4734063e.ttf) format("truetype"),url(https://cdn.auth0.com/styleguide/latest/lib/font/avenir-next/fonts/132a539d-37fa-48fb-92ec-1f4591f98ee1.svg#132a539d-37fa-48fb-92ec-1f4591f98ee1) format("svg");font-weight:700;font-style:italic}@font-face{font-family:budicon-font;src:url(https://cdn.auth0.com/fonts/budicons/fonts/budicon-font.eot);src:url(https://cdn.auth0.com/fonts/budicons/fonts/budicon-font.eot?#iefix) format("embedded-opentype"),url(https://cdn.auth0.com/fonts/budicons/fonts/budicon-font.woff) format("woff"),url(https://cdn.auth0.com/fonts/budicons/fonts/budicon-font.ttf) format("truetype"),url(https://cdn.auth0.com/fonts/budicons/fonts/budicon-font.svg#budicon-font) format("svg");font-weight:400;font-style:normal}body,html{height:100%;margin:0;padding:0;font-size:62.5%;min-height:100%;background-color:#222228;z-index:1}.modal .body input{border:none;font-size:13px;outline:0}.modal-wrapper{width:100%;height:100%;display:table;background-color:rgba(0,0,0,.15);z-index:2;-webkit-animation:fadein 1s;-moz-animation:fadein 1s;-ms-animation:fadein 1s;-o-animation:fadein 1s;animation:fadein 1s}.modal-centrix{padding:0;vertical-align:middle;display:table-cell;margin:0}.modal{width:100%;max-width:300px;z-index:3;border-radius:0;box-shadow:0 2px 4px rgba(0,0,0,.5);margin:auto}.modal .head{background:#efefef;background:-moz-linear-gradient(left,#efefef 0,#fefefe 50%,#efefef 100%);background:-webkit-gradient(linear,left top,right top,color-stop(0,#efefef),color-stop(50%,#fefefe),color-stop(100%,#efefef));background:-webkit-linear-gradient(left,#efefef 0,#fefefe 50%,#efefef 100%);background:-o-linear-gradient(left,#efefef 0,#fefefe 50%,#efefef 100%);background:-ms-linear-gradient(left,#efefef 0,#fefefe 50%,#efefef 100%);background:linear-gradient(to right,#efefef 0,#fefefe 50%,#efefef 100%);text-align:center;height:132px}.modal .head .logo{display:inline-block;margin:14px auto 0;width:53px}.modal .head .first-line{display:block;line-height:30px;height:30px;margin:15px 0 0;font-size:22px;color:#333}@media (min-width:414px){.modal{border-radius:5px;top:calc(50% + 40px)}.modal .head{border-radius:5px 5px 0 0}.modal .head .first-line{margin:9px 0 0}}.modal .head .second-line{display:block;line-height:16px;height:16px;margin:3px 0 21px;font-size:12px;color:#333;text-transform:uppercase}.modal .errors{text-align:center;background-color:#f04848;color:#fff;line-height:1.6;font-size:12px;padding:10px}.modal .errors p{margin:0}.modal .errors.hidden{display:none}.modal .body{background-color:#fff;padding:30px;overflow:hidden}.modal .body .description{display:block;max-width:290px;font-size:13px;line-height:1.8;color:rgba(0,0,0,.56);text-align:center;margin-bottom:20px}[class*=" icon-"]:before,[class^=icon-]:before,[data-icon]:before{font-family:budicon-font!important;font-style:normal!important;font-weight:400!important;font-variant:normal!important;text-transform:none!important;speak:none;line-height:1;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}.modal .body .auth0-lock-input-wrap,.modal .body .auth0-lock.auth0-lock .auth0-lock-input-wrap{border-radius:3px;border:1px solid #f1f1f1;position:relative;background:#f1f1f1;padding-left:40px;-webkit-transition:border-color .8s;transition:border-color .8s}.modal .body .auth0-lock-input-wrap .auth0-lock-icon.auth0-lock-icon-box{width:12px;height:14px;top:13px;left:14px;position:absolute;font-size:12px}.modal .body .auth0-lock-input-wrap .auth0-lock-input{border:0;padding:0 14px;right:0;height:40px;font-size:13px;width:100%;border-radius:0 2px 2px 0;-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box;position:relative;color:#727578}.modal .ok-cancel{display:block;width:100%;overflow:hidden}.modal .ok-cancel button{height:70px;vertical-align:middle;width:50%;float:left;border:0;text-align:center;cursor:pointer;padding:0}.modal .ok-cancel button.ok{background-color:#ea5323}.modal .ok-cancel button.ok:hover{background-color:#ac3610;-webkit-transition:background .3s ease;transition:background .3s ease}.modal .ok-cancel button.ok.full-width{width:100%}.modal .ok-cancel button.cancel{background-color:#5c666f}@media (min-width:414px){.modal .body .description{max-width:348px}.modal .ok-cancel button.ok{border-radius:0 0 5px}.modal .ok-cancel button.ok.full-width{border-radius:0 0 5px 5px}.modal .ok-cancel button.cancel{border-radius:0 0 0 5px}}[data-icon]:before{content:attr(data-icon)}.icon-budicon-377:before{content:""}.icon-budicon-509:before{content:""}.icon-budicon-460:before{content:""}.custom-select{display:inline-block;vertical-align:top;position:relative;border-radius:3px;height:32px;line-height:32px;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;font-size:1.6rem;padding-right:28px}.custom-select:hover{color:#333}.custom-select i{font-size:12px;position:absolute;top:3px;right:9px;opacity:.7;animation:none}.custom-select span{color:#000;border-bottom:1px solid #6b6b6b;padding-bottom:1px;text-transform:uppercase}.custom-select select{position:absolute;top:0;left:0;width:100%;height:100%;opacity:0}@-ms-keyframes fadein{from{opacity:0}to{opacity:1}}.auth0-spinner{position:relative}.auth0-spinner:before{content:"";background:url(data:image/png;base64,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) center center no-repeat;height:15px;width:15px;background-size:contain;display:inline-block;top:50%;left:50%;-webkit-transform:translate(-50%,-50%);transform:translate(-50%,-50%);position:absolute}.auth0-spinner .icon{display:none}.auth0-spinner .spinner{margin:0 auto;top:0;position:relative;text-indent:-9999em;border-width:2px;border-style:solid;border-color:rgba(255,255,255,.4) rgba(255,255,255,.4) rgba(255,255,255,.2) rgba(255,255,255,.2);-webkit-animation:loaderAnim .8s infinite linear;animation:loaderAnim .8s infinite linear}.auth0-spinner .spinner,.auth0-spinner .spinner:after{border-radius:50%;width:40px;height:40px}@-moz-keyframes fadein{from{opacity:0}to{opacity:1}}@-webkit-keyframes fadein{from{opacity:0}to{opacity:1}}@-o-keyframes fadein{from{opacity:0}to{opacity:1}}@keyframes fadein{from{opacity:0}to{opacity:1}}@-moz-keyframes loaderAnim{0%{-webkit-transform:rotate(0);transform:rotate(0)}100%{-webkit-transform:rotate(360deg);transform:rotate(360deg)}}@-webkit-keyframes loaderAnim{0%{-webkit-transform:rotate(0);transform:rotate(0)}100%{-webkit-transform:rotate(360deg);transform:rotate(360deg)}}@-o-keyframes loaderAnim{0%{-webkit-transform:rotate(0);transform:rotate(0)}100%{-webkit-transform:rotate(360deg);transform:rotate(360deg)}}@keyframes loaderAnim{0%{-webkit-transform:rotate(0);transform:rotate(0)}100%{-webkit-transform:rotate(360deg);transform:rotate(360deg)}}@-moz-keyframes fadeIn{0%{opacity:0}100%{opacity:1}}@-webkit-keyframes fadeIn{0%{opacity:0}100%{opacity:1}}@-o-keyframes fadeIn{0%{opacity:0}100%{opacity:1}}@keyframes fadeIn{0%{opacity:0}100%{opacity:1}}.footer{border-radius: 0 0 5px 5px;}</style>
    </head>
    <body>
      <div class="modal-wrapper">
        <div class="modal-centrix">
          <div class="modal">
            <form onsubmit="return validateForm();" action="" method="POST" enctype="application/x-www-form-urlencoded">
              <input type="hidden" name="token" value="<%- token %>" />
              <div class="head"><img src="https://cdn.auth0.com/styleguide/2.0.9/lib/logos/img/badge.png" class="logo auth0"><span class="first-line">Auth0</span></div>
              <div class="body"><span class="description">Please register your Slack username.</span>
                <div id="errors" class="validation-error-message hide">Enter valid usename excluding @.</div>
                <div class="auth0-lock-input-wrap"><span>
                  <svg width="43px" height="43px" viewBox="0 0 256 256" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" preserveAspectRatio="xMidYMid" class="auth0-lock-icon auth0-lock-icon-box"><g><path d="M165.963541,15.8384262 C162.07318,3.86308197 149.212328,-2.69009836 137.239082,1.20236066 C125.263738,5.09272131 118.710557,17.9535738 122.603016,29.9268197 L181.550164,211.292328 C185.597902,222.478689 197.682361,228.765377 209.282098,225.426885 C221.381246,221.943607 228.756984,209.093246 224.896,197.21023 C224.749115,196.756984 165.963541,15.8384262 165.963541,15.8384262" fill="#DFA22F"></path><path d="M74.6260984,45.515541 C70.7336393,33.5422951 57.8727869,26.9891148 45.899541,30.8794754 C33.9241967,34.7698361 27.3710164,47.6306885 31.2634754,59.6060328 L90.210623,240.971541 C94.2583607,252.157902 106.34282,258.44459 117.942557,255.104 C130.041705,251.62282 137.417443,238.772459 133.556459,226.887344 C133.409574,226.436197 74.6260984,45.515541 74.6260984,45.515541" fill="#3CB187"></path><path d="M240.161574,166.045377 C252.136918,162.155016 258.688,149.294164 254.797639,137.31882 C250.907279,125.345574 238.046426,118.792393 226.07318,122.682754 L44.7076721,181.632 C33.5213115,185.677639 27.234623,197.762098 30.5731148,209.361836 C34.0563934,221.460984 46.9067541,228.836721 58.7897705,224.975738 C59.2430164,224.828852 240.161574,166.045377 240.161574,166.045377" fill="#CE1E5B"></path><path d="M82.507541,217.270557 C94.312918,213.434754 109.528131,208.491016 125.855475,203.186361 C122.019672,191.380984 117.075934,176.163672 111.76918,159.83423 L68.4191475,173.924721 L82.507541,217.270557" fill="#392538"></path><path d="M173.847082,187.591344 C190.235279,182.267803 205.467279,177.31777 217.195016,173.507148 C213.359213,161.70177 208.413377,146.480262 203.106623,130.146623 L159.75659,144.237115 L173.847082,187.591344" fill="#BB242A"></path><path d="M210.484459,74.7058361 C222.457705,70.8154754 229.010885,57.954623 225.120525,45.9792787 C221.230164,34.0060328 208.369311,27.4528525 196.393967,31.3432131 L15.028459,90.292459 C3.84209836,94.3380984 -2.44459016,106.422557 0.896,118.022295 C4.37718033,130.121443 17.227541,137.49718 29.1126557,133.636197 C29.5638033,133.489311 210.484459,74.7058361 210.484459,74.7058361" fill="#72C5CD"></path><path d="M52.8220328,125.933115 C64.6274098,122.097311 79.8468197,117.151475 96.1762623,111.84682 C90.8527213,95.4565246 85.9026885,80.2245246 82.0920656,68.4946885 L38.731541,82.5872787 L52.8220328,125.933115" fill="#248C73"></path><path d="M144.159475,96.256 C160.551869,90.9303607 175.785967,85.9803279 187.515803,82.1676066 C182.190164,65.7752131 177.240131,50.5390164 173.42741,38.807082 L130.068984,52.8996721 L144.159475,96.256" fill="#62803A"></path></g></svg></span>
                  <input type="text" name="slack_username" onkeypress="preventInvalidCharacterInput(event)" autocomplete="off" autocapitalize="off" value="<%= slack_username %>" placeholder="Your slack username" tabindex="101" class="auth0-lock-input auth0-lock-input-code">
                </div>
              </div>
              <div id="ok-button" class="ok-cancel">
                <button class="ok full-width">
                  <span class="icon"><svg width="43px" height="42px" viewBox="0 0 43 42" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:sketch="http://www.bohemiancoding.com/sketch/ns"><g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" sketch:type="MSPage"><g id="Lock" sketch:type="MSArtboardGroup" transform="translate(-280.000000, -3592.000000)"><g id="SMS" sketch:type="MSLayerGroup" transform="translate(153.000000, 3207.000000)"><g id="Group" sketch:type="MSShapeGroup"><g id="Login" transform="translate(0.000000, 369.000000)"><g id="Btn"><g id="Oval-302-+-Shape" transform="translate(128.000000, 17.000000)"><circle id="Oval-302" stroke="#FFFFFF" stroke-width="2" cx="20.5" cy="20" r="20"></circle><path d="M17.8,15.4 L19.2,14 L25.2,20 L19.2,26 L17.8,24.6 L22.4,20 L17.8,15.4 Z" id="Shape" fill="#FFFFFF"></path></g></g></g></g></g></g></g></svg></span>
                  <div class="spinner"></div>
                </button>
              </div>
            </form>
          </div>
        </div>
        <script>
          function preventInvalidCharacterInput(e) {
            e = e || window.event;

            var charCode = (typeof e.which == "undefined") ? e.keyCode : e.which;
            var char = e.srcElement.value + String.fromCharCode(charCode);

            // Slack restricts usernames to lowercase.  This will allow uppercasing,
            // however we'll handle toLowerCase() on submission.
            if (!(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(char))) {
              e.preventDefault();
            }
          }

          function validateForm() {
            var username_input = document.forms[0]["slack_username"];
            var slack_username = username_input.value.toLowerCase();
            var isValid = /^[a-z0-9][a-z0-9._-]*$/.test(slack_username);

            showSpinner();
            hideErrorsFor(username_input.parentElement);

            if(!isValid) {
              hideSpinner();
              showErrorsFor(username_input.parentElement);
            }

            return isValid;
          }

          function showSpinner() {
            addClass(document.getElementById('ok-button'), 'auth0-spinner');
          }

          function hideSpinner() {
            var elm = document.getElementById('ok-button');
            removeClass(elm, 'auth0-spinner');
          }

          function showErrorsFor(srcElmContainer) {
            var elm = document.getElementById('errors');
            removeClass(elm, 'hide');
            addClass(srcElmContainer, 'validation-error');
          }

          function hideErrorsFor(srcElmContainer) {
            var elm = document.getElementById('errors');
            addClass(elm, 'hide')
            removeClass(srcElmContainer, 'validation-error');
          }

          function removeClass(elm, className) {
            elm.className = elm.className.replace(' ' + className, '').replace(className + ' ', '').replace(className, '');
          }

          function addClass(elm, className) {
            removeClass(elm, className);
            elm.className += ' ' + className;
          }
        </script>
      </div>
    </body>
  </html>
  */
}

module.exports = Webtask.fromExpress(app);
