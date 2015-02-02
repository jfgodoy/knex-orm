'use strict';

var Promise = require('bluebird');
var chai = require('chai');
var expect = chai.expect;

/* global describe, it */

var knex = require('knex')({
  dialect: 'postgres'
});

// install postgis functions in knex.postgis;
var st = require('knex-postgis')(knex);



var Model = require('../lib/index').Model;


var Post = Model.extend({
  knex: knex,
  tableName: 'posts',
  attributes: {
    title: 'text',
    content: 'text',
    likes: 'integer'
  }
});

var Point = Model.extend({
  knex: knex,
  tableName: 'points',
  attributes: {
    name: 'text',
    geom: 'geometry(Point, 4326)'
  }
});


function verifySqlResult(expectedObj, sqlObj) {
  Object.keys(expectedObj).forEach(function(key) {
    expect(sqlObj[key]).to.deep.equal(expectedObj[key]);
  });
}

function testsql(func, res) {
  var sqlRes = func.toSQL();

  if (typeof res === 'string') {
    verifySqlResult({
      sql: res
    }, sqlRes);
  } else {
    verifySqlResult(res, sqlRes);
  }
}

describe('Model insert', function() {

  it('basic insert', function() {
    testsql(Post.insert({title:'a', content:'b', likes:1}),
      'insert into "posts" ("content", "likes", "title") values (?, ?, ?) returning *');
  });

  it('basic insert with special returning for geometry type', function() {
    testsql(Point.insert({name:'p1', geom: st.geomFromText('Point(0 0)', 4326)}),
      'insert into "points" ("geom", "name") values (ST_geomFromText(\'Point(0 0)\', 4326), ?) returning "name", ST_asEWKT("geom") as "geom"');
  });

  it('basic insert geom in wkt format', function() {
    testsql(Point.insert({name:'p1', geom: 'Point(0 0)'}),
      'insert into "points" ("geom", "name") values (ST_geomFromText(\'Point(0 0)\', 4326), ?) returning "name", ST_asEWKT("geom") as "geom"');
  });

});



describe('Model find:', function() {

  it('find without arguments', function() {
    testsql(Post.find(), 'select * from "posts"');
  });

  it('find with object as argument', function() {
    testsql(Post.find({title:'hello world'}), 'select * from "posts" where "title" = ?');
  });

  it('find with knex where', function() {
    testsql(Post.find().where('likes', '>', 10), 'select * from "posts" where "likes" > ?');
  });

  it('find with knex select', function() {
    testsql(Post.find().select('title'), 'select "title" from "posts"');
  });

  it('find with special select for geometry attributes', function() {
    testsql(Point.find(), 'select "name", ST_asEWKT("geom") as "geom" from "points"');
  });


});

describe('Model findOne', function() {

  it('findOne without arguments', function() {
    testsql(Post.findOne(), 'select * from "posts" limit ?');
  });

  it('findOne with object as argument', function() {
    testsql(Post.findOne({title:'hello world'}), 'select * from "posts" where "title" = ? limit ?');
  });

  it('findOne with knex where', function() {
    testsql(Post.findOne().where('likes', '>', 10), 'select * from "posts" where "likes" > ? limit ?');
  });

  it('findOne with knex select', function() {
    testsql(Post.findOne().select('title'), 'select "title" from "posts" limit ?');
  });

});

describe('Model destroy', function() {

  it('destroy without arguments', function() {
    testsql(Post.destroy(), 'delete from "posts"');
  });

  it('destroy with object as argument', function() {
    testsql(Post.destroy({title:'hello world'}), 'delete from "posts" where "title" = ?');
  });

  it('destroy with knex where', function() {
    testsql(Post.destroy().where('likes', '>', 10), 'delete from "posts" where "likes" > ?');
  });

});
