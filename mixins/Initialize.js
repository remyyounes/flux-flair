/** @jsx React.DOM */

var Initialize = {
  collection: function(store, actions) {
    return{
      debug: function(eventType) {
        console.log(this.constructor.displayName.toUpperCase(), "||", "COLLECTION", eventType, this.props.parent.id);
      },
      getInitialState: function() {
        if (this.initOverride) return this.initOverride();
        return {
          parent: this.props.parent,
          objects: []
        }
      },
      componentWillReceiveProps: function(nextProps){
        if(this.props.parent.id !== nextProps.parent.id){
          this.setState({
            parent: nextProps.parent
          });
          this.loadData();
        }
      },
      componentDidMount: function() {
        if (this.customComponentDidMount) this.customComponentDidMount();
        actions.setLiveEdit(this.props.liveEdit);
        this.listenTo(store, this.onStoreChange);
        this.loadData();
      },
      loadData: function(){
        if (this.loadDataOverride){
          this.loadDataOverride();
        }
        else{
          var dbAction = this.state.parent && this.state.parent.dbAction;
          if (true) {
            setTimeout(function(){
              actions.loadCollection(this.state.parent);
            }.bind(this), 0);
          }
        }
      },
      onStoreChange: function(eventType, eventData){
        if (this.isMounted() && eventType !== "syncRequest"){
          this.setState({
            objects: store.getCollection(this.state.parent.id),
            editable: this.props.editable
          });
        }
      },
      _onAdd: function(){
        if(this._customOnAdd) return this._customOnAdd();
        actions.createObject(this.props.parent);
      }
    }
  },
  self: function(store, actions){
    return{
      debug: function(eventType){
        console.log(this.constructor.displayName.toUpperCase(), "||", "SELF", eventType, this.props.self.id);
      },
      getInitialState: function(){
        if(this.initOverride) return this.initOverride();
        return {
          // do not set state.self to props on mount. Otherwise we have
          // no way of knowing when the component is ready
          // self: this.props.self
        }
      },
      componentWillReceiveProps: function(nextProps){
        this.setState({
          self: nextProps.self
        });
      },
      componentDidMount: function(){
        this.debug("componentDidMount");
        actions.setLiveEdit(this.props.liveEdit);
        this.listenTo(store, this.onStoreChange);
        this.loadData();
        if (this.customComponentDidMount) this.customComponentDidMount();
      },
      loadData: function(){
        if(this.props.parent.loader){
          var self = this.props.self;
        }
        else{
          var self = store.getObject(this.props.parent.id, this.props.self.id);
        }

        if (!self){
          setTimeout(function(){
            actions.loadObject(this.props.parent, this.props.self.id);
          }.bind(this), 0);
        }else{
          this.setState({self: self});
        }
      },
      _update: function(attribute, value){
        if(this._updateOverride) return this._updateOverride(attribute, value);
        var object = this.state.self;
        object[attribute] = value;
        actions.updateObject(this.props.parent, object);
      },
      onStoreChange: function(eventType, eventData){
        var isSyncRequest = eventType === "syncRequest";
        var isEmptySync = (eventType==="sync" && !eventData.action );
        var canAcceptChange = !isSyncRequest && !isEmptySync && this.isMounted();
        if ( canAcceptChange && this.getResourceState ) {
          this.setState(this.getResourceState());
        }
      }
    }
  }
}

module.exports = Initialize;
