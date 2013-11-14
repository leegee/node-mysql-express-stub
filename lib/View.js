module.exports.View = resultFormatFactory;

function resultFormatFactory(){
	return function (rows,err) {
		var rv = { results : rows };
		if (err) rv.error = err;
		return rv;
	}
}
