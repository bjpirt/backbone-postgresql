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
console.log(result);
          done();
        });
      });
    });
  });

  beforeEach(function(done){
    client.query("TRUNCATE TABLE " + table_name + " CASCADE;", [], function(err, result) {
console.log(result);
      done();
    });
  });
  describe('saving a new model', function(done){
    it('should save the extra attributes correctly', function(done){
      var test_model = new Test({one: 'testone', two: 'testtwo', three: 'testthree', four: 'testfour'});
      should.not.exist(test_model.id);
      test_model.save(null, {success: function(model){
console.log(model.id);
console.log(typeof model.id);
       // model.id.should.be.a('number');
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
});

