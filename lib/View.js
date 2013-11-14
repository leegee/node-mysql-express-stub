module.exports = View;

function View () {}

View.version = 0.2;

View.prototype.formatResults = function (rows,err,status) {
	if (typeof rows == 'string') rows = [{result: rows}];
	if (! (rows instanceof Array)) {
		rows = [rows];
	}
	var rv = { results : rows };
	if (err) {
		rv.error = err;
		rv.status = status || 500;
	} else {
		rv.status = status || 200;
	}
	return rv;
}

View.prototype.sendChunkedResponse = function( res,  args ){
	res.writeHead(200, {
		'Content-Type': 'application/json',
		'Transfer-Encoding': 'chunked'
	});
	res.write('{"results":[');
	var onRow  = function onRow (chunk) { res.write(chunk) };
	var onEnd   = function onEnd (haveResults) {
		res.write("\n],\"status\":"+ (haveResults? 200 : 404) +"}");
		res.end();
	};
	var onError = function onError (err) {
		res.write("\n"+'], "error":'
			+ JSON.stringify( err )
			+ ', "status":500}');
		res.end();
	};

	var model  = args.modelInstance;
	delete args.modelInstnace;
	var params = args.modelParams;
	params.onRow = onRow;
	params.onEnd = onEnd;
	params.onError = onError;
	args.modelMethod.call( model, params );
}
