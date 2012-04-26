var logSwitch = false;
var selfTest = false;

var http = require('http');
var parse = require('url').parse;
var mkdirp = require('mkdirp');
var path = require('path');
var fs = require('fs');

var agent = new http.Agent({
    maxSockets: 50
});

var save_dir_root = path.join(process.env['HOME'], process.argv[3] || process.env['autosave_root'] || 'web_image');
var listening_port = process.argv[2] || process.env['autosave_port'];


var server = http.createServer(function(r, p) {

    if (logSwitch) {
        console.log('original request headers');
        console.log(r.headers);
        console.log();
    }

    var headers = r.headers;
    var url = parse(r.url);
    var host = headers.host.split(":");
    var options = {
        method: r.method,
        host: host[0],
        port: host[1] || 80,
        path: url.path,
        headers: headers,
        agent: agent
    };
    if (headers['proxy-connection']) {
        delete headers['proxy-connection'];
    }

    console.log(r.connection.remoteAddress, ' > ', host.join(':'));

    if (logSwitch) {
        console.log(r.url);
        console.log(options);
        console.log('\n');
    }

    if (url.protocol !== 'http:') {
        p.writeHead(404, {
            'Content-Type': 'text/plain'
        });
        p.end('Can not proxy to protocol ' + url.protocol);
        console.log('Can not proxy to protocol ' + r.url);
        return;
    }

    if (selfTest) {
        p.writeHead(200, {
            'content-type': 'text/plain'
        });
        p.end((r.method === 'HEAD') ? '': r.url);
        return;
    }

    var req = http.request(options,
    function(res) {
        var fws;
        if (logSwitch) {
            console.log('STATUS: ' + res.statusCode);
            console.log('HEADERS: ' + JSON.stringify(res.headers));
            console.log('\n\n\n');
        }
        p.writeHead(res.statusCode, res.headers);
        res.on('data',
        function(chunk) {
            p.write(chunk);
            fws && fws.write(chunk);
        });
        res.on('end',
        function() {
            p.end();
            fws && fws.end();
        });
        res.on('error',
        function() {
            p.end();
            fws && fws.end();
        });

        if (!/^\s*image\/\w*$/.test(res.headers['content-type'])) return;
        var fileSize = parseInt(res.headers['content-length']);
        if (!fileSize) return;
        if (fileSize < 100 * 1024) return;
        console.log(r.connection.remoteAddress, ' > ', r.url, fileSize);
        var fpath = path.join(save_dir_root, r.headers.host, options.path.replace(/\//g, '~'));
        if (fpath[fpath.length - 1] === '/') fpath += 'index.htm';
        mkdirp.sync(path.dirname(fpath));

        try {
            if (fs.statSync(fpath)) return;
        } catch(e) {
            fws = fs.createWriteStream(fpath);
        }
    });

    r.on('data',
    function(chunk) {
        req.write(chunk);
    })
    r.on('end',
    function() {
        req.end();
    })

}).listen(listening_port);

console.log('usage : node server.js <port> <top-dir-under-home>');
console.log('use env[autosave_root] to specify where to store the website image under your home directory.');
console.log('use env[autosave_port] to specify proxy server listening port.');
console.log('listening at ' + listening_port);
console.log('saving root directory is at ' + save_dir_root);


