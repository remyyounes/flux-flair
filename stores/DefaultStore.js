var util = require("../utils/StoreUtils");
var _ = require('underscore');

var DefaultStore = function(actions) {
  var store = {
    init: function() {
      this.customInit && this.customInit();
      for(var key in actions) {
        var callback = this[key];
        callback && this.listenTo(actions[key], callback);
      }
    },
    //SYNC
    syncResource: function(parent, object) {
      var params = { parent: parent, object: object};
      this.emitSyncRequest("forcedUpdate", params, true).then(function(){
      });
    },
    emitSyncRequest: function(action, params, force) {
      params.action = action;
      var eventType = (this.liveEdit || force) ? "syncRequest" : "change";
      return this.trigger(eventType, params);
    },
    emitSyncCreate: function(parent, object, newObject) {
      var params = {
        action: object.dbAction,
        parent: parent,
        object: object,
        newObject: newObject
      };
      return this.trigger("syncCreate", params);
    },
    emitSync: function(parent, object) {
      var params = {
        action: object.dbAction,
        parent: parent,
        object: object
      };
      return this.trigger("sync", params);
    },
    setLiveEdit: function(liveEdit) {
      if (liveEdit === undefined) return;
      this.liveEdit = liveEdit;
    },
    //LOADING
    loadObject: function(parent, objectId) {
      var object = { dbAction: "get",id: objectId };
      var params = { parent: parent, object: object };
      this.emitSyncRequest("get", params, true);
    },
    loadCollection: function(parent) {
      var object = { dbAction: "getCollection" };
      var params = { parent: parent, object: object};
      this.emitSyncRequest("getCollection", params, true);
    },
    // OBJECT CRUD
    getObject: function(collectionId, objectId) {
      var collection = this.getCollection(collectionId);
      return collection[objectId] || null;
    },
    setObject: function(collectionId, object) {
      var collection = this.getCollection(collectionId);
      object.id = object.id || util.generateTempId();
      collection[object.id] = object;
    },
    addObject: function(parent, object, trigger) {
      object.dbAction = "create";
      object.id = object.id || util.generateTempId();
      object.parent_id = parent.id;
      this.setObject(parent.id, object);
      trigger!==false && this.emitSyncRequest("create", {parent: parent, object: object});
      return object;
    },
    updateObject: function(parent, object, trigger) {
      object.dbAction = object.dbAction || "update";
      this.setObject(parent.id, object);
      trigger!==false && this.emitSyncRequest("update", {parent: parent, object: object});
    },
    deleteObject: function(parent, object, remove, trigger) {
      var collectionId = parent.id;
      var id = object.id;
      var collection = this.getCollection(collectionId);
      object = collection[object.id];
      if(!remove && object.dbAction !== "create") object.dbAction = "delete";
      else delete collection[id];
      if(trigger !== false) {
        this.emitSyncRequest("delete", {parent: parent, object: object});
      }
    },
    // COLLECTION CRUD
    addCollection: function(id, collection) {
      // collection.dbAction = "create";
      this._collections[id] = collection;
      this.emitSyncRequest("create_collection", {object: object});
    },
    deleteCollection: function(id, remove) {
      // this._collections[id].dbAction = "delete";
      remove && delete this._collections[id];
    },
    setCollection: function(id, collection) {
      this._collections[id] = collection;
      return this.trigger("setCollection", id);
    },
    getCollection: function(id) {
      this._collections[id] = this._collections[id] || {};
      return this._collections[id];
    },
    getCollections: function() {
      return this._collections;
    },
    sortCollection: function(parent, objectIds, previousParent) {
      var collection = this.getCollection(parent.id);
      var position = 1;
      _.each(objectIds, function(objectId) {
        var object = collection[objectId];
        object = object || this.changeCollection(previousParent, parent, objectId);
        object.position = position;
        if (object.dbAction !== "create") object.dbAction = "update";
        position++;
      }.bind(this));
      this.trigger("change");
    },
    changeCollection: function(fromCollection, toCollection, objectId) {
      var emitTrigger = false;
      var object = this.getObject(fromCollection.id, objectId);
      this.deleteObject(fromCollection, object, true, emitTrigger);
      var oldDbAction = object.dbAction;
      this.addObject(toCollection, object, emitTrigger);
      if ( oldDbAction !== "create" ) object.dbAction = "update";
      return object;
    },
    getResourceType: function() {
      return this.resourceType;
    }
  };
  return store;
};

module.exports = DefaultStore;
