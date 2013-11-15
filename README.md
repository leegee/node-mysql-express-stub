nodoe-mysql-express-stub
========================

This is me playing with Node, Express, but mainly node-mysql and
connection pooling with dependency injection — a simple REST app
that provides the manipulation of flat tables.

* `GET /` for a list of tables

* `GET /:table/:column` for all values of `:/column`
* `GET /:table/:column/:value` for matches
* `GET /:table/:column1/:value1/:columnN/:valueN` for matches

* `PUT /:table` to create a new record from a JSON structure

* `POST /:table/:column/:value` to update matching records with values in a JSON structure
* `POST /:table/:column/:value/:columnN/:valueN` to update matching records with values in a JSON structure

* `DELETE /:table/:column/:value/` to delete a specific record.

* `GET /:table?` Even the beginning of a query string will case the return value to be
meta information about the table and its columns, including comments, very useful for a GUI.
I would have preferred to do this with `OPTIONS`, but that conflicts with CORS and others.

Again, this is just a stub to expand — there is no authorisation or authentication,
minimal error checking, and minimal configuration options.
