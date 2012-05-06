exports = {
  Product: Backbone.Model.extend({
    urlRoot: 'products'
  }),
  
  ProductCollection: Backbone.Collection.extend({
    urlRoot: 'products',
    model: Product
  })
}
  

