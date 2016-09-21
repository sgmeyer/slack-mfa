var express = require('express');
var router = express();

function getCancel(req, res) {
  res.status(200).send("Thanks for the cancel.");
}

router.get('/cancel', getCancel);

module.exports = router;
