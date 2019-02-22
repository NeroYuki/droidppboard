var express = require('express');
var mongodb = require('mongodb');
var pug = require('pug');
require("dotenv").config();
var dbkey = process.env.DB_KEY

var app = express();

app.set('view engine', 'pug');

let uri = 'mongodb://' + dbkey + '@elainadb-shard-00-00-r6qx3.mongodb.net:27017,elainadb-shard-00-01-r6qx3.mongodb.net:27017,elainadb-shard-00-02-r6qx3.mongodb.net:27017/test?ssl=true&replicaSet=ElainaDB-shard-0&authSource=admin&retryWrites=true';
let maindb = '';
let clientdb = new mongodb.MongoClient(uri, {useNewUrlParser: true})

clientdb.connect( function(err, db) {
    if (err) throw err;
    //if (db) 
    maindb = db.db('ElainaDB');
    console.log("DB connection established");
    binddb = maindb.collection('userbind');
    makeBoard(binddb);
});

function makeBoard(entries) {
    app.get('/', (req, res) => {
        var ppsort = { pptotal: -1 };
        binddb.find({}, { projection: { _id: 0, discordid: 1, uid: 1, pptotal: 1 , playc: 1, username: 1}}).sort(ppsort).toArray(function(err, resarr) {
            if (err) throw err;
            //console.log(res);
            var entries = [];
            for (i in resarr) {
                if (resarr[i].pptotal) { entries.push(resarr[i]); }
            }
            for (i in entries) {
                entries[i].pptotal = entries[i].pptotal.toFixed(2);
            }
            var title = 'PP Board'
            res.render('main', {
                title: title,
                list: entries
            });        
        });
    });

    // app.get('/', (req, res) => {
    //     res.send(resArr);
    // });
    
    const port = process.env.PORT || 5000;
    
    app.listen(port, () => {
        console.log(`Express running → PORT ${port}`);
    });
}


