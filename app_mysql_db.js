#!/usr/bin/env node
var App		= require('./lib/Server');
var Model	= require('./lib/Model');
var View	= require('./lib/View');

var dbConfig = {
	host     			: 'localhost',
	user     			: process.env.dbuser || 'root',
	password 			: process.env.dbpass || 'password',
	database 			: process.env.dbname || 'mysql',
	insecureAuth		: process.env.dbpass? false : true,
	connectionLimit		: 20,
	supportBigNumbers	: true
};

var model = app = new App.Server(
	new Model.Model(
		dbConfig,
		new View.View
	)
);
