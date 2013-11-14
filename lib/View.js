module.exports.View = resultFormatFactory;

function resultFormatFactory(){
	return function (rows,err) {
		if (typeof rows == 'string') rows = [{result: rows}];
		if (! (rows instanceof Array)) {
			rows = [rows];
		}
		var rv = { results : rows };
		if (err) rv.error = err;
		return rv;
	}
}
