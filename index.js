let express = require('express');
let path = require('path');
let app = express();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, './web/templates/index.html'));
});

app.use('/static', express.static('./web/dist/'));

app.listen(8080);
