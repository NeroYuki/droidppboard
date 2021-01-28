var express = require('express');
var mongodb = require('mongodb');
var pug = require('pug');
var https = require('https');
var osu = require ('./ojsama')
require("dotenv").config();
var dbkey = process.env.DB_KEY

var app = express();

app.set('view engine', 'pug');

let uri = 'mongodb://' + dbkey + '@elainadb-shard-00-00-r6qx3.mongodb.net:27017,elainadb-shard-00-01-r6qx3.mongodb.net:27017,elainadb-shard-00-02-r6qx3.mongodb.net:27017/test?ssl=true&replicaSet=ElainaDB-shard-0&authSource=admin&retryWrites=true';
let maindb = '';
let clientdb = new mongodb.MongoClient(uri, {useNewUrlParser: true})

function convertURI(input) {
    input = decodeURIComponent(input);
    var arr = input.split("");
    for (i in arr) if (i != arr.length-1 && arr[i] == '+' && arr[parseInt(i)+1] != '+') {arr[i] = ' ';}  
    input = arr.join("");
    return input;
}

function convertURIregex(input) {
    input = decodeURIComponent(input);
    var arr = input.split("");
    for (i in arr) {
        if (arr[i] == '*') {arr[i] = '[*]';}
        if (arr[i] == '?') {arr[i] = '[?]';}
        if (arr[i] == '$') {arr[i] = '[$]';}
        if (arr[i] == '(') {arr[i] = '[(]';}
        if (arr[i] == ')') {arr[i] = '[)]';}
        if (arr[i] == '[') {arr[i] = '[[]';}
        if (arr[i] == ']') {arr[i] = '[]]';}
        if (arr[i] == '"') {arr[i] = '["]';}
        if (arr[i] == "'") {arr[i] = "[']";}
        if (arr[i] == ":") {arr[i] = "[:]";}
        if (i != arr.length-1 && arr[i] == '+' && arr[parseInt(i)+1] != '+') {arr[i] = ' ';}
        if (arr[i] == "+") {arr[i] = "[+]";}
    }
    input = arr.join("");
    return input;
}

top_pp_list = [];

clientdb.connect( function(err, db) {
    if (err) throw err;
    //if (db) 
    maindb = db.db('ElainaDB');
    console.log("DB connection established");
    binddb = maindb.collection('userbind');
    whitelistdb = maindb.collection('mapwhitelist');
    refreshtopPP(binddb)
    setInterval(() => {
        refreshtopPP(binddb)
    }, 1800000)
    makeBoard();
});

function refreshtopPP(binddb) {
    top_pp_list = []
    binddb.find({}, { projection: { _id: 0, username: 1, pp: 1}}).toArray(function(err, res) {
        top_pp_list = [];
        res.forEach((val, index) => {
            for (i in val.pp) {
                var top_pp_entry = {
                    username: val.username,
                    map: val.pp[i].title + (val.pp[i].mods ? " +" + val.pp[i].mods : ""),
                    rawpp: val.pp[i].pp,
                    combo: val.pp[i].combo,
                    acc_percent: val.pp[i].accuracy,
                    miss_c: val.pp[i].miss
                }
                top_pp_list.push(top_pp_entry)
            }
            top_pp_list.sort(function(a, b) {return b.rawpp - a.rawpp;})
            if (top_pp_list.length >= 100) top_pp_list.splice(100);
            if (index == res.length - 1) {console.log("done")}
        })
    })
}

function makeBoard() {
    app.get('/', (req, res) => {
        var page = parseInt(req.url.split('?page=')[1]);
        if (!page) {page = 1;}
        var ppsort = { pptotal: -1 };
        binddb.find({}, { projection: { _id: 0, discordid: 1, uid: 1, pptotal: 1 , playc: 1, username: 1}}).sort(ppsort).skip((page-1)*50).limit(50).toArray(function(err, resarr) {
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
                list: entries,
                page: page
            });        
        });
    });

    app.get('/whitelist', (req, res) => {
        var page = parseInt(req.url.split('?page=')[1]);
        var query = req.url.split('?query=')[1]
        var mapquery;
        if (!page) {page = 1;}
        if (!query) {mapquery = {}; query = '';}
        else {
            var regexquery = new RegExp(convertURIregex(query), 'i'); 
            mapquery = {mapname: regexquery};
        }
        var mapsort = { mapname: 1 };
        whitelistdb.find(mapquery, {projection: {_id: 0}}).sort(mapsort).skip((page-1)*30).limit(30).toArray(function(err, resarr) {
            //console.log(resarr);
            var title = 'Map Whitelisting Board'
            res.render('whitelist', {
                title: title,
                list: resarr,
                page: page,
                query: convertURI(query)
            })
        })
    });

    app.get('/about', (req, res) => {
        res.render('about');
    });

    app.get('/toppp', (req, res) => {
        res.render('toppp', {
            pplist: top_pp_list
        });
    });

    app.get('/profile', (req, res) => {
        var uid = req.url.split('uid=')[1]
        if (!uid) {res.send("404 Page Not Found"); return;}
        else if (isNaN(uid)) {res.send("404 Page Not Found"); return;}
        else {
        binddb.findOne({uid: uid}, function(err, findres){
            if (err) throw err;
            var title = "Player Profile";
            var username = findres.username;
            var pptotal = findres.pptotal.toFixed(2);
            var ppentries = findres.pp;
            res.render('profile', {
                title: title,
                username: username,
                pptotal: pptotal,
                entries: ppentries
            })
        })}
    })

    app.get('/beatmapsr', (req, res) => {
        console.log(req.url);
        var input = req.url.split('?b=')[1];
        var lineslit = input.split('+')
        var b = lineslit[0];
        var m = lineslit[1];
        if (!b) {
            console.log('error: no map input'); 
            res.send('error: no map input')
            return;
        }
        if (m) var mods = osu.modbits.from_string(m.slice(0) || "")
        else var mods = 0;
        console.log(mods);
        https.get('https://osu.ppy.sh/osu/' + b, (mres) => {
            var data = '';
            mres.on('data', (chunk) => {data += chunk;})
            mres.on('end', () => {
                if (!data) {
                    console.log('error: map not found'); 
                    res.send('error: map not found')
                    return;
                }
                var parser = new osu.parser();
                parser.feed(data);
                map = parser.map;
                if (map.ncircles == 0 && map.nsliders == 0) {
                    console.log('error: no object found'); 
                    res.send('error: no object found')
                    return;
                }
                var stars = new osu.diff().calc({map: map, mods: mods});
                res.send(stars.toString());
                parser.reset();
            }) 
        })
    })

    // app.get('/', (req, res) => {
    //     res.send(resArr);
    // });
    
    const port = process.env.PORT || 5000;
    
    app.listen(port, () => {
        console.log(`Express running → PORT ${port}`);
    });
}


