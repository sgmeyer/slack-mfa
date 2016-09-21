var express = require('express');
var router = express();

function getVerify(req, res) {
  res.status(200).send("Thanks for the verify.");
}

router.get('/verify', getVerify);

module.exports = router;
