let path = require('path');
let express = require('express');
let app = express();

app.use(express.static(path.join(__dirname, 'dist')));
app.get('/csv-template', (req, res) => {
    res.download(path.join(__dirname, 'web/src/assets/csv-template.xlsx'), 'testname.xlsx');
});

let port = process.env.PORT || 8080

app.listen(port, () => {
    console.log('Listening on port ' + port);
});
