const fs = require('fs');
const path = require('path');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/build', express.static(path.join(__dirname, 'build')));

app.get('/', (req, res) => {
    fs.readFile('./index.html', (error, html) => {
        if(error) throw error;

        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    })
});

app.listen(PORT, () => {
    console.log(`App running on port ${PORT}`);
});
