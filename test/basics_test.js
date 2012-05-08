var should      = require('should'),
    Backbone    = require('../backbone-postgresql');

var Test = Backbone.Model.extend({
  urlRoot: 'test'
});

var TestCollection = Backbone.Collection.extend({
  urlRoot: 'test',
  model: Test
});

Backbone.pg_connector.config = {
  "name":"bb_pg_test",
  "user":"bb_pg",
  "password":"test"
};

var conString = 'pg://' + Backbone.pg_connector.config.user + ':' + Backbone.pg_connector.config.password + '@localhost/' + Backbone.pg_connector.config.name
var pg = require('pg').native;

describe('Backbone PostgreSQL storage adaptor', function() {
  var client;

  beforeEach(function(done){
    pg.connect(conString, function(err, client_arg){
      client = client_arg;
      client.query("TRUNCATE TABLE test CASCADE;", [], function(err, result) {
        done();
      });
    });
  });

  describe('on models', function(done){
    describe("fetching a model", function(done) {
      it('should return the model correctly if it exists', function(done) {
        client.query("INSERT INTO test (id, one, two) VALUES (123, 'one', 'two')", [], function(err, result) {
          var test_model = new Test({id: 123});
          test_model.fetch({success: function(model){
            model.id.should.eql(123);
            model.attributes.should.eql({id: 123, one: 'one', two: 'two'});
            done();
          }});
        });
      });
  
      it('should return an error message if it does not exist', function(done){
        var test_model = new Test({id: 123});
        test_model.fetch({error: function(model, err){
          model.id.should.eql(123);
          err.should.eql("Not found");
          done();
        }});
      });
    });
  
    describe('saving a new model', function(done){
      it('should update the attributes and id', function(done){
        var test_model = new Test({one: 'testone', two: 'testtwo'});
        should.not.exist(test_model.id);
        test_model.save(null, {success: function(model){
          model.id.should.be.a('number');
          model.attributes.should.eql({id: model.id, one: 'testone', two: 'testtwo'});
          done();
        }});
      });
  
      it('should not save invalid columns', function(done){
        var test_model = new Test({one: 'one', two: 'two', bad: 'bad'});
        test_model.has_attributes = function(){return false;}
        test_model.save(null, {success: function(model){
          var test_model2 = new Test({id: model.id});
          test_model2.fetch({success: function(model2){
            model2.attributes.should.eql({id: model.id, one: 'one', two: 'two'});
            done();
          }});
        }});
      });

      it('should raise an error if there is a problem saving', function(done){
        var test_model = new Test();
        test_model.urlRoot = 'bad';
        test_model.save(null, {error: function(model, err){
          should.not.exist(model.id);
          err.message.should.eql('relation "bad" does not exist');
          done();
        }});
      });
    });
  
    describe('saving an existing model', function(done){
      var model;
      beforeEach(function(done){
        var test_model = new Test({one: 'testone', two: 'testtwo'});
        test_model.save(null, {success: function(thismodel){
          model = thismodel;
          done();
        }});
      });
  
      it('should save it correctly', function(done){
        model.isNew().should.be.false;
        model.set('one', 'updated');
        model.save(null, {success: function(thismodel){
          model.attributes.should.eql({id: thismodel.id, one: 'updated', two: 'testtwo'});
          client.query("SELECT * FROM test WHERE id = $1", [thismodel.id], function(err, result) {
            should.not.exist(err);
            result.rows.length.should.eql(1);
            result.rows[0].should.eql({id: thismodel.id, one: 'updated', two: 'testtwo', attributes: ''});
            done();
          });
        }});
      });
   
      it("should not save invalid columns if this table doesn't have an hstore column", function(done){
        model.isNew().should.be.false;
        model.has_attributes = function(){return false;}
        model.set({one: 'new_one', bad: 'bad'});
        model.save(null, {success: function(model){
          var model2 = new Test({id: model.id});
          model2.fetch({success: function(){
            model2.attributes.should.eql({id: model.id, one: 'new_one', two: 'testtwo'});
            done();
          }});
        }});
      });

      it('should raise an error if there was a problem saving it', function(done){
        model.isNew().should.be.false;
        model.urlRoot = 'bad';
        model.save(null, {error: function(model, err){
          err.message.should.eql('relation "bad" does not exist');
          done();
        }});
      });
  
      it("should raise an error if it didn't exist", function(done){
        var test_model = new Test({id: 123});
        test_model.isNew = function(){return false;}
        test_model.set('one', 'updated');
        test_model.save(null, {error: function(deleted_model, err){
          err.should.eql("Not found");
          done();
        }});
      });
    });
  
    describe('deleting a model', function(done){
      it('should delete it correctly', function(done){
        var test_model = new Test({one: 'testone', two: 'testtwo'});
        test_model.save(null, {success: function(thismodel){
          thismodel.destroy({success: function(deleted_model){
            client.query("SELECT * FROM test WHERE id = $1", [thismodel.id], function(err, result) {
              result.rows.length.should.eql(0);
              done();
            });
          }});
        }});
      });
  
      it("should raise an error if it didn't exist", function(done){
        var test_model = new Test({id: 123});
        test_model.destroy({error: function(deleted_model, err){
          err.should.eql("Not found");
          done();
        }});
      });
    });
  });

  describe('on collections', function(done){
    describe("fetching a model", function(done) {
      it('should return the collection correctly', function(done) {
        var test_model1 = new Test({one: 'testone1', two: 'testtwo1'});
        var test_model2 = new Test({one: 'testone2', two: 'testtwo1'});
        test_model1.save(null, {success: function(thismodel1){
          test_model2.save(null, {success: function(thismodel2){
            var collection = new TestCollection();
            collection.fetch({success: function(){
              collection.models.length.should.eql(2);
              collection.map(function(x){return x.id}).sort().should.eql([thismodel1.id, thismodel2.id].sort());
              done();
            }});
          }});
        }});
      });
    });
  });
});

