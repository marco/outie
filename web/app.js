let express = require('express');
let app = express();

app.use(express.static('dist'));

let port = process.env.PORT || 8080
app.listen(port, () => {
    console.log('Listening on port ' + port);
});
