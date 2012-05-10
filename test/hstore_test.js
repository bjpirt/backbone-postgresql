var should      = require('should'),
    Backbone    = require('../backbone-postgresql'),
    table_name  = 'test_hstore';

var Test = Backbone.Model.extend({
  urlRoot: table_name
});

var TestCollection = Backbone.Collection.extend({
  urlRoot: table_name,
  model: Test
});

Backbone.pg_connector.config = {
  "name":"bb_pg_test",
  "user":"bb_pg",
  "password":"test"
};

var conString = 'pg://' + Backbone.pg_connector.config.user + ':' + Backbone.pg_connector.config.password + '@localhost/' + Backbone.pg_connector.config.name
var pg = require('pg').native;

describe('PostgreSQL hstore support', function() {
  var client;

  before(function(done){
    Backbone.Model.column_defs = {};
    pg.connect(conString, function(err, client_arg){
      client = client_arg;
      client.query('DROP TABLE ' + table_name, function(err, result){
        client.query('CREATE TABLE ' + table_name + '(id SERIAL, one VARCHAR(64), two VARCHAR(64), attributes hstore)', function(err, result){
          done();
        });
      });
    });
  });

  beforeEach(function(done){
    client.query("TRUNCATE TABLE " + table_name + " CASCADE;", [], function(err, result) {
      done();
    });
  });

  describe("fetching a model", function(done) {
    it('should correctly handle hstore attributes', function(done) {
      client.query("INSERT INTO " + table_name + " (id, one, two, attributes) VALUES (123, 'one', 'two', 'three => three, four => four'::hstore)", [], function(err, result) {
        var model = new Test({id: 123});
        model.fetch({success: function(){
          model.id.should.eql(123);
          model.attributes.should.eql({id: 123, one: 'one', two: 'two', three: 'three', four: 'four'});
          done();
        }});
      });
    });

    it('should prioritise the real columns over the attributes', function(done) {
      client.query("INSERT INTO " + table_name + " (id, one, two, attributes) VALUES (123, 'one', 'two', 'three => three, one => four'::hstore)", [], function(err, result) {
        var test_model = new Test({id: 123});
        test_model.fetch({success: function(model){
          model.id.should.eql(123);
          model.attributes.should.eql({id: 123, one: 'one', two: 'two', three: 'three'});
          done();
        }});
      });
    });
  });

  describe('saving a new model', function(done){
    it('should save the extra attributes correctly', function(done){
      var test_model = new Test({one: 'testone', two: 'testtwo', three: 'testthree', four: 'testfour'});
      should.not.exist(test_model.id);
      test_model.save(null, {success: function(model){
        model.id.should.be.a('number');
        model.attributes.should.eql({id: model.id, one: 'testone', two: 'testtwo', three: 'testthree', four: 'testfour'});
        client.query("SELECT *, %# attributes as attributes FROM " + table_name + " WHERE id = $1", [model.id], function(err, result) {
          result.rows.length.should.eql(1);
          var new_attrs = {};
          result.rows[0].attributes.map(function(attr){; new_attrs[attr[0]] = attr[1]; });
          result.rows[0].attributes = new_attrs;
          result.rows[0].should.eql({
            id: model.id,
            one: 'testone',
            two: 'testtwo',
            attributes: {three: 'testthree', four: 'testfour'}
          });
          done();
        });
      }});
    });
  });

  describe('saving an existing model', function(done){
    var model;
    beforeEach(function(done){
      var test_model = new Test({one: 'testone', two: 'testtwo', three: 'testthree'});
      test_model.save(null, {success: function(thismodel){
        model = thismodel;
        done();
      }});
    });

    it('should save the extra attributes correctly', function(done){
      model.isNew().should.be.false;
      model.set('one', 'updated');
      model.set('four', 'testfour');
      model.save(null, {success: function(thismodel){
        model.attributes.should.eql({id: thismodel.id, one: 'updated', two: 'testtwo', three: 'testthree', four: 'testfour'});
        client.query("SELECT *, %# attributes as attributes FROM " + table_name + " WHERE id = $1", [thismodel.id], function(err, result) {
          should.not.exist(err);
          result.rows.length.should.eql(1);
          var new_attrs = {};
          result.rows[0].attributes.map(function(attr){; new_attrs[attr[0]] = attr[1]; });
          result.rows[0].attributes = new_attrs;
          result.rows[0].should.eql({
            id: model.id,
            one: 'updated',
            two: 'testtwo',
            attributes: {three: 'testthree', four: 'testfour'}
          });
          done();
        });
      }});
    });
  });
});

